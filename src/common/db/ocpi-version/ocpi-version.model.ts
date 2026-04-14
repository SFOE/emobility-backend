import { BaseModel } from '/opt/nodejs/db/base.model';

export interface OCPIVersion extends BaseModel {
    version: string;
    url: string;
}
