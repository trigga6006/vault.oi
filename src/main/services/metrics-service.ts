import { usageMetricsRepo } from '../database/repositories/usage-metrics.repo';
import { usageSnapshotRepo } from '../database/repositories/usage-snapshot.repo';
import { requestLogRepo } from '../database/repositories/request-log.repo';
import { getBucketStart } from '../../shared/utils/time-buckets';
import type { Granularity } from '../../shared/utils/time-buckets';
import type { MetricsSummary } from '../../shared/types/ipc.types';

export class MetricsService {
  async getSummary(startDate: string, endDate: string, providerId?: string): Promise<MetricsSummary> {
    const metrics = await usageMetricsRepo.query({
      startDate,
      endDate,
      granularity: 'day',
      providerId,
    });

    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalErrors = 0;
    const providerMap = new Map<string, { requests: number; cost: number; tokens: number }>();

    for (const m of metrics) {
      totalRequests += m.requestCount;
      totalInputTokens += m.inputTokens;
      totalOutputTokens += m.outputTokens;
      totalCostUsd += m.totalCostUsd ?? 0;
      totalErrors += m.errorCount;

      if (m.avgLatencyMs) {
        totalLatency += m.avgLatencyMs * m.requestCount;
        latencyCount += m.requestCount;
      }

      const existing = providerMap.get(m.providerId) ?? { requests: 0, cost: 0, tokens: 0 };
      existing.requests += m.requestCount;
      existing.cost += m.totalCostUsd ?? 0;
      existing.tokens += m.inputTokens + m.outputTokens;
      providerMap.set(m.providerId, existing);
    }

    return {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : null,
      p95LatencyMs: null, // Would need full latency distribution
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      providerBreakdown: Array.from(providerMap.entries()).map(([id, data]) => ({
        providerId: id,
        requestCount: data.requests,
        costUsd: data.cost,
        tokenCount: data.tokens,
      })),
    };
  }

  async aggregateFromSnapshots(providerId: string, granularity: Granularity): Promise<void> {
    const snapshots = await usageSnapshotRepo.findByProvider(providerId);
    const buckets = new Map<string, {
      model: string;
      requestCount: number;
      inputTokens: number;
      outputTokens: number;
      totalCostUsd: number;
    }>();

    for (const snap of snapshots) {
      const bucketStart = getBucketStart(new Date(snap.periodStart), granularity);
      const key = `${snap.providerId}:${snap.model}:${bucketStart.toISOString()}`;

      const existing = buckets.get(key) ?? {
        model: snap.model,
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCostUsd: 0,
      };

      existing.requestCount += snap.requestCount;
      existing.inputTokens += snap.inputTokens;
      existing.outputTokens += snap.outputTokens;
      existing.totalCostUsd += snap.costUsd ?? 0;
      buckets.set(key, existing);
    }

    const entries = Array.from(buckets.entries()).map(([key, data]) => {
      const [pId, , bucketStartStr] = key.split(':');
      return {
        providerId: pId,
        model: data.model,
        bucketStart: bucketStartStr,
        granularity,
        requestCount: data.requestCount,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalCostUsd: data.totalCostUsd,
        errorCount: 0,
        rateLimitHitCount: 0,
      };
    });

    if (entries.length > 0) {
      await usageMetricsRepo.upsertMany(entries);
    }
  }
}

export const metricsService = new MetricsService();
