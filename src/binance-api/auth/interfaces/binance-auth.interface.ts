export interface BinanceSignedRequest {
    url: string;
    headers: Record<string, string>;
    timestamp: number;
    signature: string;
}

export interface BinanceRequestParams {
    [key: string]: string | number | boolean | undefined;
}

export interface BinanceCredentials {
    apiKey: string;
    apiSecret: string;
}

export interface BinanceCredentialsInfo {
    hasApiKey: boolean;
    hasApiSecret: boolean;
}