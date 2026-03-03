import { create } from 'zustand';
import type { MetricsSummary } from '../../shared/types/ipc.types';

interface MetricsState {
  summary: MetricsSummary | null;
  loading: boolean;
  lastFetched: string | null;
  setSummary: (summary: MetricsSummary) => void;
  setLoading: (loading: boolean) => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  summary: null,
  loading: false,
  lastFetched: null,
  setSummary: (summary) => set({ summary, lastFetched: new Date().toISOString() }),
  setLoading: (loading) => set({ loading }),
}));
