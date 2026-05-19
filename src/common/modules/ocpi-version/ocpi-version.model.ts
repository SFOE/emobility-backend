import { DbKeys } from '/opt/nodejs/aws/dynamodb';

export interface OCPIVersion {
  version: string;
  url: string;
}

export type OCPIVersionItem = DbKeys & OCPIVersion;

export interface OCPIEndpoint {
  identifier: string;
  role: string;
  url: string;
}

export interface OCPIVersionDetails {
  version: string;
  endpoints: OCPIEndpoint[];
}

export type OCPIVersionDetailsItem = DbKeys & OCPIVersionDetails;
