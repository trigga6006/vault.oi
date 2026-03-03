import { providerRegistry } from '../../providers/registry';
import { providerConfigRepo } from '../database/repositories/provider-config.repo';
import { usageSnapshotRepo } from '../database/repositories/usage-snapshot.repo';
import type { UsageFetchParams } from '../../shared/types/provider.types';

export class UsageFetcher {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[UsageFetcher] Starting scheduled usage polling');
    this.scheduleAll();
  }

  stop(): void {
    this.running = false;
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    console.log('[UsageFetcher] Stopped all polling');
  }

  private async scheduleAll(): Promise<void> {
    const configs = await providerConfigRepo.getEnabled();
    for (const config of configs) {
      this.scheduleProvider(config.providerId, config.usageFetchInterval);
    }
  }

  scheduleProvider(providerId: string, intervalMinutes: number): void {
    // Clear existing timer
    const existing = this.timers.get(providerId);
    if (existing) clearInterval(existing);

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      this.fetchForProvider(providerId).catch((err) => {
        console.error(`[UsageFetcher] Error fetching usage for ${providerId}:`, err);
      });
    }, intervalMs);

    this.timers.set(providerId, timer);

    // Also fetch immediately
    this.fetchForProvider(providerId).catch((err) => {
      console.error(`[UsageFetcher] Initial fetch error for ${providerId}:`, err);
    });
  }

  unscheduleProvider(providerId: string): void {
    const timer = this.timers.get(providerId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(providerId);
    }
  }

  async fetchForProvider(providerId: string): Promise<void> {
    const adapter = providerRegistry.getActive(providerId);
    if (!adapter || !adapter.supportsUsageFetch) return;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);

    const params: UsageFetchParams = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      granularity: 'daily',
    };

    try {
      const usageData = await adapter.fetchUsage(params);
      const fetchedAt = now.toISOString();

      for (const record of usageData.records) {
        await usageSnapshotRepo.insert({
          providerId,
          model: record.model,
          fetchedAt,
          periodStart: usageData.period.start,
          periodEnd: usageData.period.end,
          requestCount: record.requestCount,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          cacheReadTokens: record.cacheReadTokens ?? null,
          cacheWriteTokens: record.cacheWriteTokens ?? null,
          costUsd: record.costUsd ?? null,
          source: 'api',
          rawData: JSON.stringify(record.metadata ?? null),
        });
      }

      await providerConfigRepo.updateLastFetch(providerId, fetchedAt);
      console.log(`[UsageFetcher] Fetched ${usageData.records.length} records for ${providerId}`);
    } catch (error) {
      console.error(`[UsageFetcher] Failed to fetch usage for ${providerId}:`, error);
    }
  }

  async fetchAll(): Promise<void> {
    const active = providerRegistry.getAllActive();
    await Promise.allSettled(
      active.map((adapter) => this.fetchForProvider(adapter.providerId)),
    );
  }
}

export const usageFetcher = new UsageFetcher();
