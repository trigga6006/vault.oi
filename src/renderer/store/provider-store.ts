import { create } from 'zustand';
import type { ProviderRegistrySummary, HealthCheckResult } from '../../shared/types/provider.types';
import type { ProviderConfigRecord } from '../../shared/types/models.types';

interface ProviderState {
  registeredProviders: ProviderRegistrySummary[];
  providerConfigs: ProviderConfigRecord[];
  healthChecks: Record<string, HealthCheckResult>;
  loading: boolean;
  setRegisteredProviders: (providers: ProviderRegistrySummary[]) => void;
  setProviderConfigs: (configs: ProviderConfigRecord[]) => void;
  setHealthCheck: (providerId: string, result: HealthCheckResult) => void;
  setLoading: (loading: boolean) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  registeredProviders: [],
  providerConfigs: [],
  healthChecks: {},
  loading: false,
  setRegisteredProviders: (providers) => set({ registeredProviders: providers }),
  setProviderConfigs: (configs) => set({ providerConfigs: configs }),
  setHealthCheck: (providerId, result) =>
    set((state) => ({
      healthChecks: { ...state.healthChecks, [providerId]: result },
    })),
  setLoading: (loading) => set({ loading }),
}));
