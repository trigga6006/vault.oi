export enum ErrorCode {
  UNKNOWN = 'unknown',
  AUTH_INVALID = 'auth_invalid',
  AUTH_EXPIRED = 'auth_expired',
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',
  MODEL_NOT_FOUND = 'model_not_found',
  CONTEXT_LENGTH_EXCEEDED = 'context_length_exceeded',
  CONTENT_FILTERED = 'content_filtered',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  BAD_REQUEST = 'bad_request',
  SERVICE_UNAVAILABLE = 'service_unavailable',
}

export interface NormalizedProviderError {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  retryable: boolean;
  raw?: unknown;
}
