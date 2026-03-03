import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { apiKeys } from '../schema';

export class ApiKeyRepo {
  private get db() {
    return getDatabase();
  }

  async list() {
    return this.db
      .select()
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));
  }

  async getById(id: number) {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getActiveForProvider(providerId: string) {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.providerId, providerId), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(data: {
    providerId: string;
    keyLabel: string;
    encryptedKey: string;
    keyPrefix: string | null;
    isActive: boolean;
    createdAt: string;
  }) {
    return this.db.insert(apiKeys).values(data).returning();
  }

  async update(
    id: number,
    data: Partial<{
      keyLabel: string;
      encryptedKey: string;
      keyPrefix: string | null;
      isActive: boolean;
      lastUsedAt: string;
      lastRotatedAt: string;
      expiresAt: string | null;
      notes: string | null;
    }>,
  ) {
    return this.db.update(apiKeys).set(data).where(eq(apiKeys.id, id));
  }

  async updateLastUsed(id: number) {
    return this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, id));
  }

  async delete(id: number) {
    return this.db.delete(apiKeys).where(eq(apiKeys.id, id));
  }
}

export const apiKeyRepo = new ApiKeyRepo();
