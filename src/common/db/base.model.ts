export interface DbKeys {
    pk: string;
    sk?: string;
}

export interface OCPIResponse<T> {
    data?: T;
    status_code: number;
    status_message?: string;
    timestamp: string;
}
