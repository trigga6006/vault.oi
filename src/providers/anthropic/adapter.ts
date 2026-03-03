import Anthropic from '@anthropic-ai/sdk';
import { BaseProviderAdapter } from '../base-adapter';
import { toAnthropicMessages } from './mapper';
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

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly providerId = 'anthropic';
  readonly displayName = 'Anthropic';
  readonly supportsUsageFetch = false; // Anthropic doesn't have a public usage/billing API yet
  readonly supportedAuthMethods: AuthMethod[] = ['api_key'];
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    completion: true,
    streaming: true,
    usageFetch: false,
    embeddings: false,
  };

  private client: Anthropic | null = null;

  protected async onInitialize(): Promise<void> {
    this.client = new Anthropic({
      apiKey: this.credentials!.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout ?? 30000,
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
      // Use a minimal message to check health
      await this.client!.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
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
        name: model.display_name ?? model.id,
        providerId: this.providerId,
        contextWindow: undefined,
        maxOutputTokens: undefined,
        supportsStreaming: true,
        supportsVision: model.id.includes('claude-3') || model.id.includes('claude-4'),
      }));
    } catch {
      // Fallback: return known models if API doesn't support listing
      return [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', providerId: this.providerId, supportsStreaming: true, supportsVision: true },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', providerId: this.providerId, supportsStreaming: true, supportsVision: true },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', providerId: this.providerId, supportsStreaming: true, supportsVision: true },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: this.providerId, supportsStreaming: true, supportsVision: true },
      ];
    }
  }

  async fetchUsage(_params: UsageFetchParams): Promise<UsageData> {
    // Anthropic doesn't expose a public usage/billing API
    // Usage data will come from the local proxy or manual entry
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
    const { system, messages } = toAnthropicMessages(request.messages);

    const response = await this.client!.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
      system,
      messages,
    });

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return {
      providerId: this.providerId,
      model: response.model,
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs: Date.now() - start,
      finishReason: response.stop_reason ?? 'unknown',
    };
  }

  async completeStream(request: CompletionRequest): Promise<StreamHandle> {
    this.ensureInitialized();
    const streamId = `anthropic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Stream implementation will be wired up with IPC events in Phase 3
    return { streamId, providerId: this.providerId, model: request.model };
  }

  normalizeError(rawError: unknown): NormalizedProviderError {
    const err = rawError as any;
    const statusCode = err?.status ?? err?.statusCode;
    const message = err?.message ?? 'Unknown Anthropic error';

    if (statusCode === 401) {
      return { code: ErrorCode.AUTH_INVALID, message, statusCode, retryable: false, raw: rawError };
    }
    if (statusCode === 429) {
      return { code: ErrorCode.RATE_LIMITED, message, statusCode, retryable: true, raw: rawError };
    }
    if (statusCode === 400) {
      if (message.includes('context length') || message.includes('too many tokens')) {
        return { code: ErrorCode.CONTEXT_LENGTH_EXCEEDED, message, statusCode, retryable: false, raw: rawError };
      }
      return { code: ErrorCode.BAD_REQUEST, message, statusCode, retryable: false, raw: rawError };
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
