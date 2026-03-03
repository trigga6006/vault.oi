import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { alertRules, alertEvents } from '../schema';

export class AlertRepo {
  private get db() {
    return getDatabase();
  }

  // Alert Rules
  async getAllRules() {
    return this.db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
  }

  async getRuleById(id: number) {
    const results = await this.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async getEnabledRules() {
    return this.db
      .select()
      .from(alertRules)
      .where(eq(alertRules.enabled, true));
  }

  async upsertRule(data: typeof alertRules.$inferInsert & { id?: number }) {
    if (data.id) {
      const { id, ...updateData } = data;
      return this.db
        .update(alertRules)
        .set(updateData)
        .where(eq(alertRules.id, id))
        .returning();
    }
    return this.db.insert(alertRules).values(data).returning();
  }

  async deleteRule(id: number) {
    return this.db.delete(alertRules).where(eq(alertRules.id, id));
  }

  async updateLastTriggered(id: number, timestamp: string) {
    return this.db
      .update(alertRules)
      .set({ lastTriggeredAt: timestamp })
      .where(eq(alertRules.id, id));
  }

  // Alert Events
  async insertEvent(data: typeof alertEvents.$inferInsert) {
    return this.db.insert(alertEvents).values(data).returning();
  }

  async getEvents(params: { ruleId?: number; limit?: number }) {
    const conditions = [];
    if (params.ruleId) conditions.push(eq(alertEvents.alertRuleId, params.ruleId));

    return this.db
      .select()
      .from(alertEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(params.limit ?? 50);
  }

  async acknowledgeEvent(id: number) {
    return this.db
      .update(alertEvents)
      .set({ acknowledged: true })
      .where(eq(alertEvents.id, id));
  }
}

export const alertRepo = new AlertRepo();
