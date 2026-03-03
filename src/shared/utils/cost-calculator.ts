import type { TokenUsage, CalculatedCost, PricingEntry } from '../types/pricing.types';

export function calculateCost(
  usage: TokenUsage,
  pricing: PricingEntry,
): CalculatedCost {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPricePerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPricePerMTok;

  let cacheCost = 0;
  if (usage.cacheReadTokens && pricing.cachedInputPricePerMTok) {
    cacheCost = (usage.cacheReadTokens / 1_000_000) * pricing.cachedInputPricePerMTok;
  }

  return {
    inputCost,
    outputCost,
    cacheCost,
    totalCost: inputCost + outputCost + cacheCost,
    currency: 'USD',
    pricingSource: pricing.source,
    effectiveDate: pricing.effectiveFrom,
  };
}
