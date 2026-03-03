import type {
  IProviderAdapter,
  IProviderRegistry,
  ProviderCredentials,
  ProviderAdapterConfig,
  ProviderRegistrySummary,
} from '../shared/types/provider.types';

interface RegisteredProvider {
  id: string;
  displayName: string;
  factory: () => IProviderAdapter;
}

export class ProviderRegistry implements IProviderRegistry {
  private registered = new Map<string, RegisteredProvider>();
  private active = new Map<string, IProviderAdapter>();

  register(id: string, displayName: string, factory: () => IProviderAdapter): void {
    if (this.registered.has(id)) {
      console.warn(`[ProviderRegistry] Provider "${id}" is already registered. Overwriting.`);
    }
    this.registered.set(id, { id, displayName, factory });
  }

  async activate(
    id: string,
    credentials: ProviderCredentials,
    config?: ProviderAdapterConfig,
  ): Promise<IProviderAdapter> {
    const entry = this.registered.get(id);
    if (!entry) {
      throw new Error(`Provider "${id}" is not registered.`);
    }

    // Deactivate existing instance if any
    if (this.active.has(id)) {
      await this.deactivate(id);
    }

    const adapter = entry.factory();
    await adapter.initialize(credentials, config);
    this.active.set(id, adapter);
    console.log(`[ProviderRegistry] Activated provider: ${id}`);
    return adapter;
  }

  async deactivate(id: string): Promise<void> {
    const adapter = this.active.get(id);
    if (adapter) {
      await adapter.dispose();
      this.active.delete(id);
      console.log(`[ProviderRegistry] Deactivated provider: ${id}`);
    }
  }

  getActive(id: string): IProviderAdapter | undefined {
    return this.active.get(id);
  }

  getAllActive(): IProviderAdapter[] {
    return Array.from(this.active.values());
  }

  getRegisteredIds(): string[] {
    return Array.from(this.registered.keys());
  }

  getRegisteredSummaries(): ProviderRegistrySummary[] {
    return Array.from(this.registered.values()).map((entry) => {
      const activeAdapter = this.active.get(entry.id);
      return {
        id: entry.id,
        displayName: entry.displayName,
        active: !!activeAdapter,
        capabilities: activeAdapter?.capabilities ?? {
          chat: false,
          completion: false,
          streaming: false,
          usageFetch: false,
          embeddings: false,
        },
      };
    });
  }

  async disposeAll(): Promise<void> {
    const ids = Array.from(this.active.keys());
    await Promise.all(ids.map((id) => this.deactivate(id)));
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
