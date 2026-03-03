export interface UsageSnapshotRecord {
  id: number;
  providerId: string;
  model: string;
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  costUsd: number | null;
  source: 'api' | 'proxy' | 'manual';
  rawData: string | null;
}

export interface RequestLogRecord {
  id: number;
  providerId: string;
  model: string;
  requestBody: string | null;
  responseBody: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  latencyMs: number | null;
  status: 'pending' | 'streaming' | 'success' | 'error' | 'aborted';
  errorCode: string | null;
  streamed: boolean;
  sourceApp: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ErrorRecordRow {
  id: number;
  requestLogId: number | null;
  providerId: string;
  model: string;
  errorCode: string;
  statusCode: number | null;
  message: string;
  rawResponse: string | null;
  retryable: boolean;
  createdAt: string;
}

export interface UsageMetricRecord {
  id: number;
  providerId: string;
  model: string;
  bucketStart: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  errorCount: number;
  rateLimitHitCount: number;
}

export interface ProviderConfigRecord {
  providerId: string;
  displayName: string;
  enabled: boolean;
  authMethod: string;
  encryptedCredentials: string | null;
  baseUrl: string | null;
  organizationId: string | null;
  usageFetchInterval: number;
  lastUsageFetch: string | null;
  timeout: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleRecord {
  id: number;
  name: string;
  enabled: boolean;
  providerId: string | null;
  model: string | null;
  metric: 'error_rate' | 'latency_p95' | 'cost_total' | 'token_usage' | 'rate_limit_hits';
  condition: 'gt' | 'lt' | 'gte';
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  action: string;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface AlertEventRecord {
  id: number;
  alertRuleId: number;
  triggeredAt: string;
  metricValue: number;
  threshold: number;
  message: string;
  acknowledged: boolean;
}

export interface ModelPricingRecord {
  providerId: string;
  modelId: string;
  modelPattern: string | null;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: 'manual' | 'fetched';
  updatedAt: string;
}
