import { registerHandler } from './register-all';
import { usageMetricsRepo } from '../database/repositories/usage-metrics.repo';
import { metricsService } from '../services/metrics-service';
import { costService } from '../services/cost-service';

export function registerMetricsHandlers(): void {
  registerHandler('metrics:query', async (query) => {
    return usageMetricsRepo.query({
      providerId: query.providerId,
      model: query.model,
      startDate: query.startDate,
      endDate: query.endDate,
      granularity: query.granularity,
    });
  });

  registerHandler('metrics:summary', async (query) => {
    return metricsService.getSummary(query.startDate, query.endDate, query.providerId);
  });

  registerHandler('pricing:calculate', async (payload) => {
    const result = costService.calculateCost(payload.providerId, payload.modelId, payload.usage);
    if (!result) {
      return {
        inputCost: 0,
        outputCost: 0,
        cacheCost: 0,
        totalCost: 0,
        currency: 'USD' as const,
        pricingSource: 'manual' as const,
        effectiveDate: new Date().toISOString(),
      };
    }
    return result;
  });
}
