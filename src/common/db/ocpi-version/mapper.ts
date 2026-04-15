import {OCPIVersion, OCPIVersionDetails, OCPIVersionDetailsItem, OCPIVersionItem} from "/opt/nodejs/db/ocpi-version/ocpi-version.model";

export const toOCPIVersion = (item: OCPIVersionItem): OCPIVersion => ({
    version: item.version,
    url: item.url,
});

export const toOCPIVersionDetails = (
    item: OCPIVersionDetailsItem
): OCPIVersionDetails => ({
    version: item.version,
    endpoints: item.endpoints,
});
