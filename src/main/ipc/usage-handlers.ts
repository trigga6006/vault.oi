import { registerHandler } from './register-all';
import { providerRegistry } from '../../providers/registry';
import type { UsageData } from '../../shared/types/provider.types';

export function registerUsageHandlers(): void {
  registerHandler('usage:fetch', async (payload) => {
    const adapter = providerRegistry.getActive(payload.providerId);
    if (!adapter) {
      return {
        providerId: payload.providerId,
        period: { start: payload.params.startDate, end: payload.params.endDate },
        records: [],
        totalCostUsd: 0,
      };
    }
    return adapter.fetchUsage(payload.params);
  });

  registerHandler('usage:fetch-all', async (params) => {
    const adapters = providerRegistry.getAllActive();
    const results = await Promise.allSettled(
      adapters.map((adapter) => adapter.fetchUsage(params)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<UsageData> => r.status === 'fulfilled')
      .map((r) => r.value);
  });
}
