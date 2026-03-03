import { eq, and, lte, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { modelPricing } from '../schema';

export class PricingRepo {
  private get db() {
    return getDatabase();
  }

  async insert(data: typeof modelPricing.$inferInsert) {
    return this.db.insert(modelPricing).values(data).returning();
  }

  async insertMany(data: (typeof modelPricing.$inferInsert)[]) {
    if (data.length === 0) return [];
    return this.db.insert(modelPricing).values(data).returning();
  }

  async findPricing(providerId: string, modelId: string, date?: string) {
    const effectiveDate = date ?? new Date().toISOString();
    const results = await this.db
      .select()
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.providerId, providerId),
          eq(modelPricing.modelId, modelId),
          lte(modelPricing.effectiveFrom, effectiveDate),
        ),
      )
      .orderBy(sql`${modelPricing.effectiveFrom} DESC`)
      .limit(1);
    return results[0] ?? null;
  }

  async getAllForProvider(providerId: string) {
    return this.db
      .select()
      .from(modelPricing)
      .where(eq(modelPricing.providerId, providerId));
  }

  async deleteForProvider(providerId: string) {
    return this.db
      .delete(modelPricing)
      .where(eq(modelPricing.providerId, providerId));
  }
}

export const pricingRepo = new PricingRepo();
