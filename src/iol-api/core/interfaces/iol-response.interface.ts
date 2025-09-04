export interface IolApiResponse<T = any> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

export interface BaseQueryParams {
  limit?: number;
  offset?: number;
}