import { useCallback, useState } from 'react';
import type { UsageData, UsageFetchParams } from '../../shared/types/provider.types';

export function useUsage() {
  const [data, setData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async (params: UsageFetchParams) => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('usage:fetch-all', params);
      setData(result as any);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForProvider = useCallback(async (providerId: string, params: UsageFetchParams) => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('usage:fetch', { providerId, params });
      return result as UsageData;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, fetchAll, fetchForProvider };
}
