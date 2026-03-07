import { useCallback, useEffect, useState } from 'react';
import type { ProxyStatus } from '../../shared/types/ipc.types';

const POLL_INTERVAL = 5000;

export function useProxy() {
  const [status, setStatus] = useState<ProxyStatus>({
    running: false,
    port: null,
    requestCount: 0,
    upSince: null,
    logRequestBodies: false,
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await window.omniview.invoke('proxy:status', undefined) as ProxyStatus;
      setStatus(result);
    } catch {
      // ignore fetch errors
    }
  }, []);

  const startProxy = useCallback(async (port: number) => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('proxy:start', { port }) as { success: boolean };
      if (result.success) {
        await fetchStatus();
      }
      return result.success;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const stopProxy = useCallback(async () => {
    setLoading(true);
    try {
      await window.omniview.invoke('proxy:stop', undefined);
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const setLogBodies = useCallback(async (enabled: boolean) => {
    await window.omniview.invoke('proxy:set-log-bodies', { enabled });
    await fetchStatus();
  }, [fetchStatus]);

  // Poll status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, startProxy, stopProxy, setLogBodies };
}
