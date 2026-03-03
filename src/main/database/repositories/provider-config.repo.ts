import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { providerConfigs } from '../schema';

export class ProviderConfigRepo {
  private get db() {
    return getDatabase();
  }

  async getAll() {
    return this.db.select().from(providerConfigs);
  }

  async getById(providerId: string) {
    const results = await this.db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.providerId, providerId))
      .limit(1);
    return results[0] ?? null;
  }

  async upsert(data: typeof providerConfigs.$inferInsert) {
    const existing = await this.getById(data.providerId);
    if (existing) {
      return this.db
        .update(providerConfigs)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(providerConfigs.providerId, data.providerId))
        .returning();
    }
    const now = new Date().toISOString();
    return this.db
      .insert(providerConfigs)
      .values({ ...data, createdAt: data.createdAt ?? now, updatedAt: now })
      .returning();
  }

  async delete(providerId: string) {
    return this.db
      .delete(providerConfigs)
      .where(eq(providerConfigs.providerId, providerId));
  }

  async updateLastFetch(providerId: string, timestamp: string) {
    return this.db
      .update(providerConfigs)
      .set({ lastUsageFetch: timestamp, updatedAt: new Date().toISOString() })
      .where(eq(providerConfigs.providerId, providerId));
  }

  async getEnabled() {
    return this.db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.enabled, true));
  }
}

export const providerConfigRepo = new ProviderConfigRepo();
