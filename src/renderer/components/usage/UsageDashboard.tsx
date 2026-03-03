import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CostChart } from './CostChart';
import { TokenUsageChart } from './TokenUsageChart';
import { ModelBreakdown } from './ModelBreakdown';
import { ProviderComparison } from './ProviderComparison';
import type { UsageMetricRecord } from '../../../shared/types/models.types';

export function UsageDashboard() {
  const [costData, setCostData] = useState<Array<{ date: string; cost: number }>>([]);
  const [tokenData, setTokenData] = useState<Array<{ date: string; inputTokens: number; outputTokens: number }>>([]);
  const [modelData, setModelData] = useState<Array<{ model: string; providerId: string; costUsd: number; tokenCount: number; requestCount: number }>>([]);
  const [providerData, setProviderData] = useState<Array<{ providerId: string; costUsd: number; requestCount: number }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const metrics = await window.omniview.invoke('metrics:query', {
        startDate: monthStart.toISOString(),
        endDate: now.toISOString(),
        granularity: 'day',
      }) as UsageMetricRecord[];

      // Aggregate by date
      const costByDate = new Map<string, number>();
      const tokensByDate = new Map<string, { input: number; output: number }>();
      const byModel = new Map<string, { costUsd: number; tokenCount: number; requestCount: number; providerId: string }>();
      const byProvider = new Map<string, { costUsd: number; requestCount: number }>();

      for (const m of metrics) {
        const date = m.bucketStart.split('T')[0];

        // Cost by date
        costByDate.set(date, (costByDate.get(date) ?? 0) + (m.totalCostUsd ?? 0));

        // Tokens by date
        const existing = tokensByDate.get(date) ?? { input: 0, output: 0 };
        existing.input += m.inputTokens;
        existing.output += m.outputTokens;
        tokensByDate.set(date, existing);

        // By model
        const modelKey = `${m.providerId}:${m.model}`;
        const modelEntry = byModel.get(modelKey) ?? { costUsd: 0, tokenCount: 0, requestCount: 0, providerId: m.providerId };
        modelEntry.costUsd += m.totalCostUsd ?? 0;
        modelEntry.tokenCount += m.inputTokens + m.outputTokens;
        modelEntry.requestCount += m.requestCount;
        byModel.set(modelKey, modelEntry);

        // By provider
        const provEntry = byProvider.get(m.providerId) ?? { costUsd: 0, requestCount: 0 };
        provEntry.costUsd += m.totalCostUsd ?? 0;
        provEntry.requestCount += m.requestCount;
        byProvider.set(m.providerId, provEntry);
      }

      setCostData(
        Array.from(costByDate.entries())
          .map(([date, cost]) => ({ date, cost }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      );

      setTokenData(
        Array.from(tokensByDate.entries())
          .map(([date, t]) => ({ date, inputTokens: t.input, outputTokens: t.output }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      );

      setModelData(
        Array.from(byModel.entries())
          .map(([key, data]) => ({
            model: key.split(':')[1],
            providerId: data.providerId,
            costUsd: data.costUsd,
            tokenCount: data.tokenCount,
            requestCount: data.requestCount,
          }))
          .sort((a, b) => b.costUsd - a.costUsd),
      );

      setProviderData(
        Array.from(byProvider.entries()).map(([id, data]) => ({
          providerId: id,
          costUsd: data.costUsd,
          requestCount: data.requestCount,
        })),
      );
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usage Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed cost and token usage breakdowns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostChart data={costData} />
        <TokenUsageChart data={tokenData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModelBreakdown data={modelData} />
        <ProviderComparison data={providerData} />
      </div>
    </motion.div>
  );
}
