import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { projectKeys } from '../schema';
import type { Environment } from '../../../shared/types/project.types';

export class ProjectKeyRepo {
  private get db() {
    return getDatabase();
  }

  async listForProject(projectId: number) {
    return this.db
      .select()
      .from(projectKeys)
      .where(eq(projectKeys.projectId, projectId));
  }

  async getPrimary(projectId: number, environment: Environment) {
    const rows = await this.db
      .select()
      .from(projectKeys)
      .where(
        and(
          eq(projectKeys.projectId, projectId),
          eq(projectKeys.environment, environment),
          eq(projectKeys.isPrimary, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async assign(data: {
    projectId: number;
    apiKeyId: number;
    environment: Environment;
    isPrimary?: boolean;
  }) {
    return this.db
      .insert(projectKeys)
      .values({
        projectId: data.projectId,
        apiKeyId: data.apiKeyId,
        environment: data.environment,
        isPrimary: data.isPrimary ?? false,
      })
      .returning();
  }

  async unassign(projectId: number, apiKeyId: number, environment: Environment) {
    return this.db
      .delete(projectKeys)
      .where(
        and(
          eq(projectKeys.projectId, projectId),
          eq(projectKeys.apiKeyId, apiKeyId),
          eq(projectKeys.environment, environment),
        ),
      );
  }

  async deleteForProject(projectId: number) {
    return this.db
      .delete(projectKeys)
      .where(eq(projectKeys.projectId, projectId));
  }

  async deleteForKey(apiKeyId: number) {
    return this.db
      .delete(projectKeys)
      .where(eq(projectKeys.apiKeyId, apiKeyId));
  }
}

export const projectKeyRepo = new ProjectKeyRepo();
