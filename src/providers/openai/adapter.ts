import OpenAI from 'openai';
import { BaseProviderAdapter } from '../base-adapter';
import { toOpenAIMessages } from './mapper';
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

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly providerId = 'openai';
  readonly displayName = 'OpenAI';
  readonly supportsUsageFetch = false; // OpenAI usage API requires org admin access; deferred
  readonly supportedAuthMethods: AuthMethod[] = ['api_key'];
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    completion: true,
    streaming: true,
    usageFetch: false,
    embeddings: true,
  };

  private client: OpenAI | null = null;

  protected async onInitialize(): Promise<void> {
    this.client = new OpenAI({
      apiKey: this.credentials!.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout ?? 30000,
      maxRetries: this.config.maxRetries ?? 3,
      organization: this.credentials!.organizationId,
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
      return [
        { id: 'gpt-4o', name: 'GPT-4o', providerId: this.providerId, supportsStreaming: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: this.providerId, supportsStreaming: true },
        { id: 'o3-mini', name: 'o3-mini', providerId: this.providerId, supportsStreaming: true },
        { id: 'o1', name: 'o1', providerId: this.providerId, supportsStreaming: true },
      ];
    }
  }

  async fetchUsage(_params: UsageFetchParams): Promise<UsageData> {
    // OpenAI usage API requires org admin; data will come via proxy or manual entry
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
    const streamId = `openai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return { streamId, providerId: this.providerId, model: request.model };
  }

  normalizeError(rawError: unknown): NormalizedProviderError {
    const err = rawError as any;
    const statusCode = err?.status ?? err?.statusCode;
    const message = err?.message ?? 'Unknown OpenAI error';

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
