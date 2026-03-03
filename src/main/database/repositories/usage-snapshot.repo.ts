import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { usageSnapshots } from '../schema';

export class UsageSnapshotRepo {
  private get db() {
    return getDatabase();
  }

  async insert(data: typeof usageSnapshots.$inferInsert) {
    return this.db.insert(usageSnapshots).values(data).returning();
  }

  async insertMany(data: (typeof usageSnapshots.$inferInsert)[]) {
    if (data.length === 0) return [];
    return this.db.insert(usageSnapshots).values(data).returning();
  }

  async findByProvider(providerId: string, startDate?: string, endDate?: string) {
    const conditions = [eq(usageSnapshots.providerId, providerId)];
    if (startDate) conditions.push(gte(usageSnapshots.periodStart, startDate));
    if (endDate) conditions.push(lte(usageSnapshots.periodEnd, endDate));

    return this.db
      .select()
      .from(usageSnapshots)
      .where(and(...conditions))
      .orderBy(desc(usageSnapshots.periodStart));
  }

  async findLatest(providerId: string, limit = 100) {
    return this.db
      .select()
      .from(usageSnapshots)
      .where(eq(usageSnapshots.providerId, providerId))
      .orderBy(desc(usageSnapshots.fetchedAt))
      .limit(limit);
  }

  async deleteOlderThan(date: string) {
    return this.db
      .delete(usageSnapshots)
      .where(lte(usageSnapshots.fetchedAt, date));
  }
}

export const usageSnapshotRepo = new UsageSnapshotRepo();
