import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { requestLogs } from '../schema';

export class RequestLogRepo {
  private get db() {
    return getDatabase();
  }

  async insert(data: typeof requestLogs.$inferInsert) {
    return this.db.insert(requestLogs).values(data).returning();
  }

  async updateStatus(id: number, status: string, completedAt?: string) {
    return this.db
      .update(requestLogs)
      .set({ status: status as any, completedAt })
      .where(eq(requestLogs.id, id));
  }

  async updateResponse(id: number, data: Partial<typeof requestLogs.$inferInsert>) {
    return this.db
      .update(requestLogs)
      .set(data)
      .where(eq(requestLogs.id, id));
  }

  async query(params: {
    providerId?: string;
    model?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    if (params.providerId) conditions.push(eq(requestLogs.providerId, params.providerId));
    if (params.model) conditions.push(eq(requestLogs.model, params.model));
    if (params.status) conditions.push(eq(requestLogs.status, params.status as any));
    if (params.startDate) conditions.push(gte(requestLogs.createdAt, params.startDate));
    if (params.endDate) conditions.push(lte(requestLogs.createdAt, params.endDate));

    const query = this.db
      .select()
      .from(requestLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(requestLogs.createdAt))
      .limit(params.limit ?? 100)
      .offset(params.offset ?? 0);

    return query;
  }

  async getById(id: number) {
    const results = await this.db
      .select()
      .from(requestLogs)
      .where(eq(requestLogs.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async countByProvider(providerId: string, startDate?: string, endDate?: string) {
    const conditions = [eq(requestLogs.providerId, providerId)];
    if (startDate) conditions.push(gte(requestLogs.createdAt, startDate));
    if (endDate) conditions.push(lte(requestLogs.createdAt, endDate));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(requestLogs)
      .where(and(...conditions));
    return result[0]?.count ?? 0;
  }

  async deleteOlderThan(date: string) {
    return this.db
      .delete(requestLogs)
      .where(lte(requestLogs.createdAt, date));
  }
}

export const requestLogRepo = new RequestLogRepo();
