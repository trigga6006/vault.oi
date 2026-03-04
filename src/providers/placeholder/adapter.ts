import { BaseProviderAdapter } from '../base-adapter';
import { ErrorCode } from '../../shared/types/errors.types';
import type {
  AuthMethod,
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
  ModelDescriptor,
  NormalizedProviderError,
  ProviderCapabilities,
  StreamHandle,
  UsageData,
  UsageFetchParams,
} from '../../shared/types/provider.types';

export class PlaceholderProviderAdapter extends BaseProviderAdapter {
  readonly supportsUsageFetch = false;
  readonly supportedAuthMethods: AuthMethod[] = ['api_key'];
  readonly capabilities: ProviderCapabilities = {
    chat: false,
    completion: false,
    streaming: false,
    usageFetch: false,
    embeddings: false,
  };

  constructor(
    readonly providerId: string,
    readonly displayName: string,
  ) {
    super();
  }

  protected async onInitialize(): Promise<void> {}

  protected async onDispose(): Promise<void> {}

  async healthCheck(): Promise<HealthCheckResult> {
    this.ensureInitialized();
    return {
      status: 'unknown',
      latencyMs: 0,
      message: `${this.displayName} is available in the UI, but the live adapter is not implemented yet.`,
      checkedAt: new Date().toISOString(),
    };
  }

  async listModels(): Promise<ModelDescriptor[]> {
    this.ensureInitialized();
    return [];
  }

  async fetchUsage(params: UsageFetchParams): Promise<UsageData> {
    this.ensureInitialized();
    return {
      providerId: this.providerId,
      period: { start: params.startDate, end: params.endDate },
      records: [],
      totalCostUsd: 0,
    };
  }

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    this.ensureInitialized();
    throw new Error(`${this.displayName} completion is not implemented yet.`);
  }

  async completeStream(request: CompletionRequest): Promise<StreamHandle> {
    this.ensureInitialized();
    throw new Error(`${this.displayName} streaming is not implemented yet for model ${request.model}.`);
  }

  normalizeError(rawError: unknown): NormalizedProviderError {
    const message = rawError instanceof Error ? rawError.message : `Unknown ${this.displayName} error`;
    return {
      code: ErrorCode.UNKNOWN,
      message,
      retryable: false,
      raw: rawError,
    };
  }
}
