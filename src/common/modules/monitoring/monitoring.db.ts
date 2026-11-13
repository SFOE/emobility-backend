import { fetchAll } from '/opt/nodejs/aws/dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';
import { OCPICredentialItem } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
import {
  CpoMonitoringItem,
  CpoMonitoringSummaryItem,
  RegisteredParty,
} from './monitoring.model';

const CPO_PK_PREFIX = 'CPO#';
const SUMMARY_PK = 'SUMMARY';

export interface MonitoringItems {
  cpos: CpoMonitoringItem[];
  summary: CpoMonitoringSummaryItem | null;
}

// The whole (small) Glue-written table: one item per CPO plus SUMMARY.
export const fetchMonitoringItems = async (): Promise<MonitoringItems> => {
  const items = await fetchAll<{ pk: string }>(
    Aws.dynamoDBTables.cpoMonitoring,
  );
  return {
    cpos: items.filter((item) =>
      item.pk.startsWith(CPO_PK_PREFIX),
    ) as CpoMonitoringItem[],
    summary:
      (items.find((item) => item.pk === SUMMARY_PK) as
        CpoMonitoringSummaryItem | undefined) ?? null,
  };
};

/**
 * Every CPO role of every registered party. Bootstrap token items are skipped.
 * Only name, party and registration date leave this function - never tokens,
 * secret references or URLs, because the route has no authentication.
 */
export const fetchRegisteredParties = async (): Promise<RegisteredParty[]> => {
  const items = await fetchAll<OCPICredentialItem>(
    Aws.dynamoDBTables.credentials,
  );
  return items
    .filter((item) => item.sk === 'CREDENTIALS' && !item.bootstrapToken)
    .flatMap((item) =>
      (item.roles ?? [])
        .filter((role) => role.role === 'CPO')
        .map((role) => ({
          country_code: role.country_code,
          party_id: role.party_id,
          name: role.business_details?.name ?? '',
          registered_at: item.createdAt,
        })),
    );
};
