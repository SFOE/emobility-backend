import {queryByPk, queryBySk} from '/opt/nodejs/db/db-requests';
import {OCPI_VERSION_TABLE_NAME} from '/opt/nodejs/db/db-table-names.constants';
import {OCPIVersion, OCPIVersionDetails, OCPIVersionDetailsItem, OCPIVersionItem} from '/opt/nodejs/db/ocpi-version/ocpi-version.model';
import {toOCPIVersion, toOCPIVersionDetails} from "/opt/nodejs/db/ocpi-version/mapper";

export const getOCPIVersions = async (): Promise<OCPIVersion[]> => {
    const items = await queryByPk<OCPIVersionItem>(OCPI_VERSION_TABLE_NAME, "VERSION");

    return items.map(toOCPIVersion) as OCPIVersion[];
};

export const getOCPIVersionDetails = async (
    version: string,
): Promise<OCPIVersionDetails | null> => {
    const item =
        await queryBySk<OCPIVersionDetailsItem>(OCPI_VERSION_TABLE_NAME, "VERSION_DETAILS", version)
    if (item) {
        return toOCPIVersionDetails(item);
    }
    return null;
};
