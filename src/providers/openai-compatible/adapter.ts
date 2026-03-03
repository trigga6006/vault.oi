import OpenAI from 'openai';
import { BaseProviderAdapter } from '../base-adapter';
import { toOpenAIMessages } from '../openai/mapper';
import { ErrorCode } from '../../shared/types/errors.types';
import type {
  ProviderCapabilities,
  AuthMethod,
  HealthCheckResult,
  ModelDescriptor,
  UsageFetchParams,
  UsageData,
  CompletionRequest,
  CompletionResponse,
  StreamHandle,
  NormalizedProviderError,
} from '../../shared/types/provider.types';

export interface OpenAICompatibleConfig {
  providerId: string;
  displayName: string;
  defaultBaseUrl: string;
  fallbackModels: Array<{ id: string; name: string }>;
  supportedAuthMethods?: AuthMethod[];
  capabilities?: Partial<ProviderCapabilities>;
}

export class OpenAICompatibleAdapter extends BaseProviderAdapter {
  readonly providerId: string;
  readonly displayName: string;
  readonly supportsUsageFetch = false;
  readonly supportedAuthMethods: AuthMethod[];
  readonly capabilities: ProviderCapabilities;

  protected client: OpenAI | null = null;
  protected readonly defaultBaseUrl: string;
  protected readonly fallbackModels: Array<{ id: string; name: string }>;

  constructor(config: OpenAICompatibleConfig) {
    super();
    this.providerId = config.providerId;
    this.displayName = config.displayName;
    this.defaultBaseUrl = config.defaultBaseUrl;
    this.fallbackModels = config.fallbackModels;
    this.supportedAuthMethods = config.supportedAuthMethods ?? ['api_key'];
    this.capabilities = {
      chat: true,
      completion: true,
      streaming: true,
      usageFetch: false,
      embeddings: false,
      ...config.capabilities,
    };
  }

  protected getApiKey(): string {
    return this.credentials?.apiKey ?? '';
  }

  protected async onInitialize(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.getApiKey(),
      baseURL: this.config.baseUrl ?? this.defaultBaseUrl,
      timeout: this.config.timeout ?? 30_000,
      maxRetries: this.config.maxRetries ?? 3,
    });
  }

  protected async onDispose(): Promise<void> {
    this.client = null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    this.ensureInitialized();
    const start = Date.now();
    try {
      await this.client!.models.list();
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      const latency = Date.now() - start;
      if (error?.status === 401) {
        return {
          status: 'unhealthy',
          latencyMs: latency,
          message: 'Invalid API key',
          checkedAt: new Date().toISOString(),
        };
      }
      if (error?.status === 429) {
        return {
          status: 'degraded',
          latencyMs: latency,
          message: 'Rate limited',
          checkedAt: new Date().toISOString(),
        };
      }
      return {
        status: 'unhealthy',
        latencyMs: latency,
        message: error?.message ?? 'Unknown error',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    this.ensureInitialized();
    try {
      const response = await this.client!.models.list();
      return response.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        providerId: this.providerId,
        supportsStreaming: true,
      }));
    } catch {
      // Fall back to the static model list provided by the provider config
      return this.fallbackModels.map((m) => ({
        id: m.id,
        name: m.name,
        providerId: this.providerId,
        supportsStreaming: true,
      }));
    }
  }

  async fetchUsage(_params: UsageFetchParams): Promise<UsageData> {
    // Most OpenAI-compatible providers do not expose a usage API
    return {
      providerId: this.providerId,
      period: { start: _params.startDate, end: _params.endDate },
      records: [],
      totalCostUsd: 0,
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.ensureInitialized();
    const start = Date.now();
    const messages = toOpenAIMessages(request.messages);

    const response = await this.client!.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });

    const choice = response.choices[0];
    const usage = response.usage;

    return {
      providerId: this.providerId,
      model: response.model,
      content: choice?.message?.content ?? '',
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      latencyMs: Date.now() - start,
      finishReason: choice?.finish_reason ?? 'unknown',
    };
  }

  async completeStream(request: CompletionRequest): Promise<StreamHandle> {
    this.ensureInitialized();
    const streamId = `${this.providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return { streamId, providerId: this.providerId, model: request.model };
  }

  normalizeError(rawError: unknown): NormalizedProviderError {
    const err = rawError as any;
    const statusCode = err?.status ?? err?.statusCode;
    const message = err?.message ?? `Unknown ${this.displayName} error`;

    if (statusCode === 401) {
      return { code: ErrorCode.AUTH_INVALID, message, statusCode, retryable: false, raw: rawError };
    }
    if (statusCode === 429) {
      return { code: ErrorCode.RATE_LIMITED, message, statusCode, retryable: true, raw: rawError };
    }
    if (statusCode === 400) {
      if (message.includes('context_length_exceeded') || message.includes('maximum context length')) {
        return { code: ErrorCode.CONTEXT_LENGTH_EXCEEDED, message, statusCode, retryable: false, raw: rawError };
      }
      if (message.includes('content_policy') || message.includes('content_filter')) {
        return { code: ErrorCode.CONTENT_FILTERED, message, statusCode, retryable: false, raw: rawError };
      }
      return { code: ErrorCode.BAD_REQUEST, message, statusCode, retryable: false, raw: rawError };
    }
    if (statusCode === 404) {
      return { code: ErrorCode.MODEL_NOT_FOUND, message, statusCode, retryable: false, raw: rawError };
    }
    if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
      return { code: ErrorCode.SERVER_ERROR, message, statusCode, retryable: true, raw: rawError };
    }
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
      return { code: ErrorCode.NETWORK_ERROR, message, retryable: true, raw: rawError };
    }
    if (err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKETTIMEDOUT') {
      return { code: ErrorCode.TIMEOUT, message, retryable: true, raw: rawError };
    }

    return { code: ErrorCode.UNKNOWN, message, statusCode, retryable: false, raw: rawError };
  }
}
