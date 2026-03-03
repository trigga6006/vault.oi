import type { PricingEntry, TokenUsage, CalculatedCost } from '../../shared/types/pricing.types';
import { calculateCost } from '../../shared/utils/cost-calculator';

import anthropicPricing from './data/anthropic.json';
import openaiPricing from './data/openai.json';
import fireworksPricing from './data/fireworks.json';
import googlePricing from './data/google.json';
import perplexityPricing from './data/perplexity.json';
import xaiPricing from './data/xai.json';
import mistralPricing from './data/mistral.json';
import togetherPricing from './data/together.json';
import openrouterPricing from './data/openrouter.json';
import ollamaPricing from './data/ollama.json';
import deepseekPricing from './data/deepseek.json';
import qwenPricing from './data/qwen.json';
import huggingfacePricing from './data/huggingface.json';
import copilotPricing from './data/copilot.json';
import coherePricing from './data/cohere.json';
import cursorPricing from './data/cursor.json';

interface PricingDataEntry {
  modelId: string;
  modelPattern?: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  cachedInputPricePerMTok?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export class PricingRegistry {
  private cache = new Map<string, PricingEntry[]>();

  async initialize(): Promise<void> {
    // Load bundled pricing data
    this.loadBundledPricing('anthropic', anthropicPricing as PricingDataEntry[]);
    this.loadBundledPricing('openai', openaiPricing as PricingDataEntry[]);
    this.loadBundledPricing('fireworks', fireworksPricing as PricingDataEntry[]);
    this.loadBundledPricing('google', googlePricing as PricingDataEntry[]);
    this.loadBundledPricing('perplexity', perplexityPricing as PricingDataEntry[]);
    this.loadBundledPricing('xai', xaiPricing as PricingDataEntry[]);
    this.loadBundledPricing('mistral', mistralPricing as PricingDataEntry[]);
    this.loadBundledPricing('together', togetherPricing as PricingDataEntry[]);
    this.loadBundledPricing('openrouter', openrouterPricing as PricingDataEntry[]);
    this.loadBundledPricing('ollama', ollamaPricing as PricingDataEntry[]);
    this.loadBundledPricing('deepseek', deepseekPricing as PricingDataEntry[]);
    this.loadBundledPricing('qwen', qwenPricing as PricingDataEntry[]);
    this.loadBundledPricing('huggingface', huggingfacePricing as PricingDataEntry[]);
    this.loadBundledPricing('copilot', copilotPricing as PricingDataEntry[]);
    this.loadBundledPricing('cohere', coherePricing as PricingDataEntry[]);
    this.loadBundledPricing('cursor', cursorPricing as PricingDataEntry[]);
    console.log('[PricingRegistry] Initialized with bundled pricing data');
  }

  private loadBundledPricing(providerId: string, data: PricingDataEntry[]): void {
    const entries: PricingEntry[] = data.map((d) => ({
      providerId,
      modelId: d.modelId,
      modelPattern: d.modelPattern,
      inputPricePerMTok: d.inputPricePerMTok,
      outputPricePerMTok: d.outputPricePerMTok,
      cachedInputPricePerMTok: d.cachedInputPricePerMTok,
      effectiveFrom: d.effectiveFrom,
      effectiveTo: d.effectiveTo,
      source: 'manual' as const,
    }));
    this.cache.set(providerId, entries);
  }

  findPricing(providerId: string, modelId: string, date?: string): PricingEntry | null {
    const entries = this.cache.get(providerId);
    if (!entries) return null;

    const effectiveDate = date ?? new Date().toISOString().split('T')[0];

    // First try exact match
    let match = entries.find(
      (e) =>
        e.modelId === modelId &&
        e.effectiveFrom <= effectiveDate &&
        (!e.effectiveTo || e.effectiveTo > effectiveDate),
    );

    // Then try pattern match
    if (!match) {
      match = entries.find((e) => {
        if (!e.modelPattern) return false;
        const regex = new RegExp('^' + e.modelPattern.replace(/\*/g, '.*') + '$');
        return (
          regex.test(modelId) &&
          e.effectiveFrom <= effectiveDate &&
          (!e.effectiveTo || e.effectiveTo > effectiveDate)
        );
      });
    }

    return match ?? null;
  }

  calculate(providerId: string, modelId: string, usage: TokenUsage, date?: string): CalculatedCost | null {
    const pricing = this.findPricing(providerId, modelId, date);
    if (!pricing) return null;
    return calculateCost(usage, pricing);
  }

  getAllForProvider(providerId: string): PricingEntry[] {
    return this.cache.get(providerId) ?? [];
  }

  getProviderIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /** Merge fetched pricing entries into the cache */
  mergeFetchedPricing(providerId: string, entries: PricingDataEntry[]): number {
    const existing = this.cache.get(providerId) ?? [];
    let added = 0;

    for (const entry of entries) {
      const exists = existing.some(
        (e) =>
          e.modelId === entry.modelId &&
          e.effectiveFrom === entry.effectiveFrom,
      );
      if (!exists) {
        existing.push({
          providerId,
          modelId: entry.modelId,
          modelPattern: entry.modelPattern,
          inputPricePerMTok: entry.inputPricePerMTok,
          outputPricePerMTok: entry.outputPricePerMTok,
          cachedInputPricePerMTok: entry.cachedInputPricePerMTok,
          effectiveFrom: entry.effectiveFrom,
          effectiveTo: entry.effectiveTo,
          source: 'fetched' as const,
        });
        added++;
      }
    }

    this.cache.set(providerId, existing);
    return added;
  }
}

export const pricingRegistry = new PricingRegistry();
