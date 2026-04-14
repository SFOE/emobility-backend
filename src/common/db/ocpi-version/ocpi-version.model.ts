import { BaseModel } from '/opt/nodejs/db/base.model';

export interface OCPIVersion extends BaseModel {
    version: string;
    url: string;
}

export interface OCPIVersionDetails {
    version: string;
    endpoints: Array<{
        identifier: string;
        role: string;
        url: string;
    }>;
}
