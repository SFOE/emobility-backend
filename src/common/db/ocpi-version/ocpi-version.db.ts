import { fetchAll } from '/opt/nodejs/db/db-requests';
import { OCPI_VERSION_TABLE_NAME } from '/opt/nodejs/db/db-table-names.constants';
import { OcpiVersion } from '/opt/nodejs/db/ocpi-version/ocpi-version.model';

export const getAllOcpiVersions = async (): Promise<OcpiVersion[]> => {
    return fetchAll<OcpiVersion>(OCPI_VERSION_TABLE_NAME);
};
