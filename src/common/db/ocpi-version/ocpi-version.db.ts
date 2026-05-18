import { queryByPk, queryBySk } from '/opt/nodejs/aws/dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';

const TABLE = Aws.dynamoDBTables.versions;
import {
  OCPIVersion,
  OCPIVersionDetails,
  OCPIVersionDetailsItem,
  OCPIVersionItem,
} from '/opt/nodejs/db/ocpi-version/ocpi-version.model';
import {
  toOCPIVersion,
  toOCPIVersionDetails,
} from '/opt/nodejs/db/ocpi-version/mapper';

export const getOCPIVersions = async (): Promise<OCPIVersion[]> => {
  const items = await queryByPk<OCPIVersionItem>(
    TABLE,
    'VERSION',
  );

  return items.map(toOCPIVersion) as OCPIVersion[];
};

export const getOCPIVersionDetails = async (
  version: string,
): Promise<OCPIVersionDetails | null> => {
  const item = await queryBySk<OCPIVersionDetailsItem>(
    TABLE,
    'VERSION_DETAILS',
    version,
  );
  if (item) {
    return toOCPIVersionDetails(item);
  }
  return null;
};
