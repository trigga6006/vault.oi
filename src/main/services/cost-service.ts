import { pricingRegistry } from '../../providers/pricing/registry';
import type { TokenUsage, CalculatedCost } from '../../shared/types/pricing.types';

export class CostService {
  calculateCost(providerId: string, modelId: string, usage: TokenUsage, date?: string): CalculatedCost | null {
    return pricingRegistry.calculate(providerId, modelId, usage, date);
  }

  calculateFromTokens(
    providerId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens?: number,
  ): number | null {
    const result = this.calculateCost(providerId, modelId, {
      inputTokens,
      outputTokens,
      cacheReadTokens,
    });
    return result?.totalCost ?? null;
  }
}

export const costService = new CostService();
