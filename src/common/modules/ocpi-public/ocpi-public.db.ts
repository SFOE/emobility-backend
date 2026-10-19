import {
  batchGetItems,
  getItem,
  queryBySk,
  queryItems,
} from '/opt/nodejs/aws/dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';
import {
  DATE_FROM_INDEX,
  EvseStatusItem,
  META_PK,
  OFFSET_INDEX,
  PublicEvseStatus,
  PublicObjectType,
  SEQ_DIGITS,
  ServingItem,
  ServingMetaItem,
} from './ocpi-public.model';
import { ListQuery, MAX_PAGE_BODY_BYTES } from './ocpi-public.params';

export interface ObjectPage {
  // Serialized OCPI objects, in list order.
  bodies: string[];
  // Objects matching the request in total (before offset/limit).
  total: number;
}

const objectPk = (
  type: PublicObjectType,
  countryCode: string,
  partyId: string,
  id: string,
): string => `${type.key}#${countryCode}#${partyId}#${id}`;

const formatSeq = (offset: number): string =>
  String(offset).padStart(SEQ_DIGITS, '0');

/**
 * Keeps bodies in order until their size reaches the page budget. The first
 * body is always kept, so a page never comes back empty while objects remain.
 */
const withinPageBudget = (bodies: string[]): string[] => {
  const page: string[] = [];
  let bytes = 0;
  for (const body of bodies) {
    bytes += Buffer.byteLength(body);
    if (page.length > 0 && bytes > MAX_PAGE_BODY_BYTES) {
      break;
    }
    page.push(body);
  }
  return page;
};

// One serialized OCPI object, or null if it isn't (or no longer) served.
export const getPublicObject = async (
  type: PublicObjectType,
  countryCode: string,
  partyId: string,
  id: string,
): Promise<string | null> => {
  const item = await getItem<ServingItem | undefined>(type.tableName, {
    TableName: type.tableName,
    Key: { pk: objectPk(type, countryCode, partyId, id) },
  });
  return item?.body ?? null;
};

/**
 * A page of the full list, by `seq` (GSI1). `seq` is dense and gapless, so
 * `seq >= offset` is exactly OCPI's offset and every page costs the same.
 * The total comes from the `#META` item the Glue job writes last.
 */
const listByOffset = async (
  type: PublicObjectType,
  query: ListQuery,
): Promise<ObjectPage> => {
  const meta = await getItem<ServingMetaItem | undefined>(type.tableName, {
    TableName: type.tableName,
    Key: { pk: META_PK },
  });
  const total = Number(meta?.item_count ?? 0);
  if (query.offset >= total) {
    return { bodies: [], total };
  }

  const items = await queryItems<ServingItem>(
    {
      TableName: type.tableName,
      IndexName: OFFSET_INDEX,
      KeyConditionExpression: 'gsi1pk = :type AND seq >= :offset',
      ExpressionAttributeValues: {
        ':type': type.key,
        ':offset': formatSeq(query.offset),
      },
    },
    query.limit,
  );
  return { bodies: withinPageBudget(items.map((item) => item.body)), total };
};

/**
 * A page of the objects with `last_updated >= date_from`, oldest change first
 * (GSI2, keys only). All keys of the range are read - they are tiny - which
 * gives the exact total and lets the page skip `offset` keys; only the page's
 * bodies are then fetched from the table.
 */
const listByDateFrom = async (
  type: PublicObjectType,
  query: ListQuery & { dateFrom: string },
): Promise<ObjectPage> => {
  const keys = await queryItems<{ pk: string }>({
    TableName: type.tableName,
    IndexName: DATE_FROM_INDEX,
    KeyConditionExpression: 'gsi2pk = :type AND gsi2sk >= :dateFrom',
    ExpressionAttributeValues: {
      ':type': type.key,
      ':dateFrom': query.dateFrom,
    },
    ProjectionExpression: 'pk',
  });
  const pagePks = keys
    .slice(query.offset, query.offset + query.limit)
    .map((key) => key.pk);
  if (pagePks.length === 0) {
    return { bodies: [], total: keys.length };
  }

  const items = await batchGetItems<ServingItem>(
    type.tableName,
    pagePks.map((pk) => ({ pk })),
  );
  // BatchGetItem returns items unordered; restore the GSI2 order. A key whose
  // item was swept meanwhile is just skipped.
  const bodyByPk = new Map(items.map((item) => [item.pk, item.body]));
  const bodies = pagePks
    .map((pk) => bodyByPk.get(pk))
    .filter((body): body is string => body !== undefined);
  return { bodies: withinPageBudget(bodies), total: keys.length };
};

export const listPublicObjects = (
  type: PublicObjectType,
  query: ListQuery,
): Promise<ObjectPage> =>
  query.dateFrom === undefined
    ? listByOffset(type, query)
    : listByDateFrom(type, { ...query, dateFrom: query.dateFrom });

const statusPk = (countryCode: string, partyId: string, locationId: string) =>
  `LOCATION#${countryCode}#${partyId}#${locationId}`;

// Current status of one EVSE, or null if none was ever received.
export const getEvseStatus = async (
  countryCode: string,
  partyId: string,
  locationId: string,
  evseUid: string,
): Promise<Pick<EvseStatusItem, 'status' | 'last_updated'> | null> => {
  const item = await queryBySk<EvseStatusItem>(
    Aws.dynamoDBTables.evseCurrentStatus,
    statusPk(countryCode, partyId, locationId),
    `EVSE#${evseUid}`,
  );
  return item ? { status: item.status, last_updated: item.last_updated } : null;
};

// pk = LOCATION#{cc}#{party}#{location_id}, sk = EVSE#{uid}. The ids never
// contain '#' (rejected by assertValidPathIdentifiers on the write path).
const toPublicEvseStatus = (item: EvseStatusItem): PublicEvseStatus => {
  const [, country_code, party_id, location_id] = item.pk.split('#');
  return {
    country_code,
    party_id,
    location_id,
    evse_uid: item.sk.slice('EVSE#'.length),
    status: item.status,
    last_updated: item.last_updated,
  };
};

/**
 * Current statuses received at or after `dateFrom` (an ISO-8601 instant in the
 * `received_at` format), oldest first, at most `limit`. Not paginated.
 */
export const listEvseStatusesSince = async (
  dateFrom: string,
  limit: number,
): Promise<PublicEvseStatus[]> => {
  const items = await queryItems<EvseStatusItem>(
    {
      TableName: Aws.dynamoDBTables.evseCurrentStatus,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :type AND gsi1sk >= :dateFrom',
      ExpressionAttributeValues: {
        ':type': 'EVSE_STATUS',
        ':dateFrom': dateFrom,
      },
    },
    limit,
  );
  return items.map(toPublicEvseStatus);
};
