export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface CalculatedCost {
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
  currency: 'USD';
  pricingSource: 'manual' | 'fetched';
  effectiveDate: string;
}

export interface PricingEntry {
  providerId: string;
  modelId: string;
  modelPattern?: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  source: 'manual' | 'fetched';
}
