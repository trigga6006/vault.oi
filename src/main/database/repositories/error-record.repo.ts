import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { errorRecords } from '../schema';

export class ErrorRecordRepo {
  private get db() {
    return getDatabase();
  }

  async insert(data: typeof errorRecords.$inferInsert) {
    return this.db.insert(errorRecords).values(data).returning();
  }

  async query(params: {
    providerId?: string;
    errorCode?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    if (params.providerId) conditions.push(eq(errorRecords.providerId, params.providerId));
    if (params.errorCode) conditions.push(eq(errorRecords.errorCode, params.errorCode));
    if (params.startDate) conditions.push(gte(errorRecords.createdAt, params.startDate));
    if (params.endDate) conditions.push(lte(errorRecords.createdAt, params.endDate));

    return this.db
      .select()
      .from(errorRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(errorRecords.createdAt))
      .limit(params.limit ?? 100)
      .offset(params.offset ?? 0);
  }

  async getByRequestLogId(requestLogId: number) {
    return this.db
      .select()
      .from(errorRecords)
      .where(eq(errorRecords.requestLogId, requestLogId));
  }
}

export const errorRecordRepo = new ErrorRecordRepo();
