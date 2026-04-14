import {queryByPk, queryBySk} from '/opt/nodejs/db/db-requests';
import {OCPI_VERSION_TABLE_NAME} from '/opt/nodejs/db/db-table-names.constants';
import {OCPIVersion, OCPIVersionDetails} from '/opt/nodejs/db/ocpi-version/ocpi-version.model';

export const getOCPIVersions = async (): Promise<OCPIVersion[]> => {
    const items = await queryByPk<OCPIVersion>(OCPI_VERSION_TABLE_NAME, "VERSION");

    return items.map(({ version, url }) => ({
        version,
        url,
    })) as OCPIVersion[];
};

export const getOCPIVersionDetails = async (
    version: string,
): Promise<OCPIVersionDetails | null> => {
    return await queryBySk<OCPIVersionDetails>(OCPI_VERSION_TABLE_NAME, "VERSION_DETAILS", version);
};
