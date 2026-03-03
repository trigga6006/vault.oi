import { useCallback } from 'react';
import { useProviderStore } from '../store/provider-store';

declare global {
  interface Window {
    omniview: {
      invoke: (channel: string, payload?: unknown) => Promise<unknown>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      platform: NodeJS.Platform;
    };
  }
}

export function useProvider() {
  const { registeredProviders, providerConfigs, healthChecks, loading, setRegisteredProviders, setProviderConfigs, setHealthCheck, setLoading } = useProviderStore();

  const fetchRegistered = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('provider:list-registered', undefined);
      setRegisteredProviders(result as any);
    } finally {
      setLoading(false);
    }
  }, [setRegisteredProviders, setLoading]);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('config:list-providers', undefined);
      setProviderConfigs(result as any);
    } finally {
      setLoading(false);
    }
  }, [setProviderConfigs, setLoading]);

  const checkHealth = useCallback(async (providerId: string) => {
    const result = await window.omniview.invoke('provider:health-check', { providerId });
    setHealthCheck(providerId, result as any);
  }, [setHealthCheck]);

  return {
    registeredProviders,
    providerConfigs,
    healthChecks,
    loading,
    fetchRegistered,
    fetchConfigs,
    checkHealth,
  };
}
