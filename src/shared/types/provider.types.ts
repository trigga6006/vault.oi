export type AuthMethod = 'api_key' | 'oauth' | 'bearer_token';

export interface ProviderCredentials {
  apiKey?: string;
  bearerToken?: string;
  organizationId?: string;
}

export interface ProviderAdapterConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ProviderCapabilities {
  chat: boolean;
  completion: boolean;
  streaming: boolean;
  usageFetch: boolean;
  embeddings: boolean;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs: number;
  message?: string;
  checkedAt: string;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  providerId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
}

export interface UsageFetchParams {
  startDate: string;
  endDate: string;
  granularity?: 'hourly' | 'daily';
}

export interface UsageData {
  providerId: string;
  period: { start: string; end: string };
  records: UsageRecord[];
  totalCostUsd?: number;
  rawResponse?: unknown;
}

export interface UsageRecord {
  timestamp: string;
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  providerId: string;
  model: string;
  messages: CompletionMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface CompletionResponse {
  providerId: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd?: number;
  finishReason: string;
}

export interface StreamHandle {
  streamId: string;
  providerId: string;
  model: string;
}

export interface MiddlewareContext {
  request: CompletionRequest;
  metadata: Record<string, unknown>;
  startTime: number;
}

export type NextFunction = (ctx: MiddlewareContext) => Promise<CompletionResponse>;

export interface CompletionMiddleware {
  name: string;
  priority: number;
  execute(ctx: MiddlewareContext, next: NextFunction): Promise<CompletionResponse>;
}

export interface IProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  readonly supportedAuthMethods: AuthMethod[];
  readonly supportsUsageFetch: boolean;

  initialize(credentials: ProviderCredentials, config?: ProviderAdapterConfig): Promise<void>;
  dispose(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  listModels(): Promise<ModelDescriptor[]>;
  fetchUsage(params: UsageFetchParams): Promise<UsageData>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  completeStream(request: CompletionRequest): Promise<StreamHandle>;
  normalizeError(rawError: unknown): NormalizedProviderError;
}

export interface IProviderRegistry {
  register(id: string, displayName: string, factory: () => IProviderAdapter): void;
  activate(id: string, credentials: ProviderCredentials, config?: ProviderAdapterConfig): Promise<IProviderAdapter>;
  deactivate(id: string): Promise<void>;
  getActive(id: string): IProviderAdapter | undefined;
  getAllActive(): IProviderAdapter[];
  getRegisteredIds(): string[];
}

export interface NormalizedProviderError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
  raw?: unknown;
}

export interface ProviderRegistrySummary {
  id: string;
  displayName: string;
  active: boolean;
  capabilities: ProviderCapabilities;
}

export interface ActivatePayload {
  providerId: string;
  credentials: ProviderCredentials;
  config?: ProviderAdapterConfig;
}
