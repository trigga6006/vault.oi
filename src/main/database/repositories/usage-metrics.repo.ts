import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { getDatabase, getRawDatabase } from '../connection';
import { usageMetrics } from '../schema';

export interface IncrementBucketParams {
  providerId: string;
  model: string;
  bucketStart: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  latencyMs: number;
  isError: boolean;
}

export class UsageMetricsRepo {
  private get db() {
    return getDatabase();
  }

  async upsert(data: typeof usageMetrics.$inferInsert) {
    return this.db.insert(usageMetrics).values(data).returning();
  }

  async upsertMany(data: (typeof usageMetrics.$inferInsert)[]) {
    if (data.length === 0) return [];
    return this.db.insert(usageMetrics).values(data).returning();
  }

  /**
   * Atomically increment a metrics bucket using INSERT ... ON CONFLICT DO UPDATE.
   * Requires the unique index on (provider_id, model, bucket_start, granularity).
   */
  async incrementBucket(params: IncrementBucketParams) {
    const raw = getRawDatabase();
    if (!raw) return;

    const stmt = raw.prepare(`
      INSERT INTO usage_metrics (provider_id, model, bucket_start, granularity, request_count, input_tokens, output_tokens, total_cost_usd, avg_latency_ms, error_count, rate_limit_hit_count)
      VALUES (@providerId, @model, @bucketStart, @granularity, @requestCount, @inputTokens, @outputTokens, @totalCostUsd, @latencyMs, @errorCount, 0)
      ON CONFLICT (provider_id, model, bucket_start, granularity) DO UPDATE SET
        request_count = request_count + @requestCount,
        input_tokens = input_tokens + @inputTokens,
        output_tokens = output_tokens + @outputTokens,
        total_cost_usd = COALESCE(total_cost_usd, 0) + @totalCostUsd,
        avg_latency_ms = (COALESCE(avg_latency_ms, 0) * (request_count - @requestCount) + @latencyMs * @requestCount) / request_count,
        error_count = error_count + @errorCount
    `);

    stmt.run({
      providerId: params.providerId,
      model: params.model,
      bucketStart: params.bucketStart,
      granularity: params.granularity,
      requestCount: params.requestCount,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalCostUsd: params.totalCostUsd,
      latencyMs: params.latencyMs,
      errorCount: params.isError ? 1 : 0,
    });
  }

  async query(params: {
    providerId?: string;
    model?: string;
    startDate: string;
    endDate: string;
    granularity: 'hour' | 'day' | 'week' | 'month';
  }) {
    const conditions = [
      eq(usageMetrics.granularity, params.granularity),
      gte(usageMetrics.bucketStart, params.startDate),
      lte(usageMetrics.bucketStart, params.endDate),
    ];
    if (params.providerId) conditions.push(eq(usageMetrics.providerId, params.providerId));
    if (params.model) conditions.push(eq(usageMetrics.model, params.model));

    return this.db
      .select()
      .from(usageMetrics)
      .where(and(...conditions))
      .orderBy(usageMetrics.bucketStart);
  }

  async getLatestBucket(providerId: string, granularity: string) {
    const results = await this.db
      .select()
      .from(usageMetrics)
      .where(
        and(
          eq(usageMetrics.providerId, providerId),
          eq(usageMetrics.granularity, granularity as any),
        ),
      )
      .orderBy(desc(usageMetrics.bucketStart))
      .limit(1);
    return results[0] ?? null;
  }

  async deleteOlderThan(date: string) {
    return this.db
      .delete(usageMetrics)
      .where(lte(usageMetrics.bucketStart, date));
  }
}

export const usageMetricsRepo = new UsageMetricsRepo();
