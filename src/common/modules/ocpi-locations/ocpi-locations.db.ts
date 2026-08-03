import { conditionalUpdateItem } from '/opt/nodejs/aws/dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';
import { EVSEStatus } from './ocpi-locations.model';

export interface EvseStatusRecord {
  countryCode: string;
  partyId: string;
  locationId: string;
  evseUid: string;
  status: EVSEStatus;
  lastUpdated: string;
  receivedAt: string;
}

export const upsertEvseCurrentStatus = async (record: EvseStatusRecord): Promise<boolean> => {
  const pk = `LOCATION#${record.countryCode}#${record.partyId}#${record.locationId}`;
  const sk = `EVSE#${record.evseUid}`;
  const gsi1sk = `${record.receivedAt}#${record.countryCode}#${record.partyId}#${record.locationId}#${record.evseUid}`;

  return conditionalUpdateItem(
    Aws.dynamoDBTables.evseCurrentStatus,
    pk,
    sk,
    'SET #status = :status, last_updated = :last_updated, received_at = :received_at, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk',
    { '#status': 'status' },
    {
      ':status': record.status,
      ':last_updated': record.lastUpdated,
      ':received_at': record.receivedAt,
      ':gsi1pk': 'EVSE_STATUS',
      ':gsi1sk': gsi1sk,
    },
    'attribute_not_exists(last_updated) OR last_updated < :last_updated',
  );
};
