import https from 'node:https';
import { pricingRegistry } from '../../providers/pricing/registry';
import { getRawDatabase } from '../database/connection';

const PRICING_UPDATE_URL =
  'https://raw.githubusercontent.com/omniview-app/pricing-data/main/pricing.json';

interface PricingUpdateResult {
  checked: boolean;
  added: number;
  lastCheck: string;
}

export class PricingUpdateService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCheck: string | null = null;
  private autoUpdateEnabled = false;

  start(): void {
    // Check daily
    this.timer = setInterval(() => {
      if (this.autoUpdateEnabled) {
        this.checkForUpdates().catch((error: unknown) => {
          console.warn('[PricingUpdate] Scheduled check failed:', error);
        });
      }
    }, 24 * 60 * 60 * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setAutoUpdate(enabled: boolean): void {
    this.autoUpdateEnabled = enabled;
  }

  getLastCheck(): string | null {
    return this.lastCheck;
  }

  async checkForUpdates(): Promise<PricingUpdateResult> {
    this.lastCheck = new Date().toISOString();

    try {
      const data = await this.fetchPricingData();
      if (!data) {
        return { checked: true, added: 0, lastCheck: this.lastCheck };
      }

      let totalAdded = 0;
      for (const [providerId, entries] of Object.entries(data)) {
        if (Array.isArray(entries)) {
          const added = pricingRegistry.mergeFetchedPricing(providerId, entries as any);
          totalAdded += added;

          // Also persist to database
          if (added > 0) {
            this.persistToDatabase(providerId, entries as any);
          }
        }
      }

      console.log(
        `[PricingUpdate] Checked — ${totalAdded} new entries added`,
      );
      return { checked: true, added: totalAdded, lastCheck: this.lastCheck };
    } catch (err) {
      console.warn('[PricingUpdate] Fetch failed:', err);
      return { checked: false, added: 0, lastCheck: this.lastCheck };
    }
  }

  private fetchPricingData(): Promise<Record<string, unknown[]> | null> {
    return new Promise((resolve) => {
      https
        .get(PRICING_UPDATE_URL, (res) => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8');
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        })
        .on('error', () => resolve(null));
    });
  }

  private persistToDatabase(providerId: string, entries: any[]): void {
    const raw = getRawDatabase();
    if (!raw) return;

    const stmt = raw.prepare(`
      INSERT OR IGNORE INTO model_pricing
        (provider_id, model_id, model_pattern, input_price_per_m_tok, output_price_per_m_tok,
         cached_input_price_per_m_tok, effective_from, effective_to, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fetched', ?)
    `);

    const now = new Date().toISOString();
    for (const entry of entries) {
      stmt.run(
        providerId,
        entry.modelId,
        entry.modelPattern ?? null,
        entry.inputPricePerMTok,
        entry.outputPricePerMTok,
        entry.cachedInputPricePerMTok ?? null,
        entry.effectiveFrom,
        entry.effectiveTo ?? null,
        now,
      );
    }
  }
}

export const pricingUpdateService = new PricingUpdateService();
