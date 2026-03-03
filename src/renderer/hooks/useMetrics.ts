import { useCallback } from 'react';
import { useMetricsStore } from '../store/metrics-store';

export function useMetrics() {
  const { summary, loading, lastFetched, setSummary, setLoading } = useMetricsStore();

  const fetchSummary = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('metrics:summary', { startDate, endDate });
      setSummary(result as any);
    } finally {
      setLoading(false);
    }
  }, [setSummary, setLoading]);

  return { summary, loading, lastFetched, fetchSummary };
}
