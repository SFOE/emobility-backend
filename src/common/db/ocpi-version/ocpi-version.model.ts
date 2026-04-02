import { BaseModel } from '/opt/nodejs/db/base.model';

export interface OcpiVersion extends BaseModel {
    version: string;
    url: string;
}
