export interface OCPIResponse<T> {
  data?: T;
  status_code: number;
  status_message?: string;
  timestamp: string;
}

export interface OCPIAuthorizerContext {
  isBootstrap: boolean;
  partnerId: string;
  secretRef?: string;
  credentialPk?: string;
}
