import type {
  IProviderAdapter,
  ProviderCapabilities,
  ProviderCredentials,
  ProviderAdapterConfig,
  AuthMethod,
  HealthCheckResult,
  ModelDescriptor,
  UsageFetchParams,
  UsageData,
  CompletionRequest,
  CompletionResponse,
  StreamHandle,
  NormalizedProviderError,
} from '../shared/types/provider.types';

export abstract class BaseProviderAdapter implements IProviderAdapter {
  abstract readonly providerId: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;
  abstract readonly supportedAuthMethods: AuthMethod[];
  abstract readonly supportsUsageFetch: boolean;

  protected credentials: ProviderCredentials | null = null;
  protected config: ProviderAdapterConfig = {};
  protected initialized = false;

  async initialize(credentials: ProviderCredentials, config?: ProviderAdapterConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config ?? {};
    this.initialized = true;
    await this.onInitialize();
  }

  async dispose(): Promise<void> {
    await this.onDispose();
    this.credentials = null;
    this.initialized = false;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.credentials) {
      throw new Error(`Provider ${this.providerId} is not initialized. Call initialize() first.`);
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDispose(): Promise<void>;

  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract listModels(): Promise<ModelDescriptor[]>;
  abstract fetchUsage(params: UsageFetchParams): Promise<UsageData>;
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  abstract completeStream(request: CompletionRequest): Promise<StreamHandle>;
  abstract normalizeError(rawError: unknown): NormalizedProviderError;
}
