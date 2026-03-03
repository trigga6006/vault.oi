import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { projects } from '../schema';

export class ProjectRepo {
  private get db() {
    return getDatabase();
  }

  async list() {
    return this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getById(id: number) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getDefault() {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.isDefault, true))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    name: string;
    description?: string | null;
    color?: string;
    gitRepoPath?: string | null;
    isDefault?: boolean;
    createdAt: string;
    updatedAt: string;
  }) {
    return this.db.insert(projects).values({
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? '#6366f1',
      gitRepoPath: data.gitRepoPath ?? null,
      isDefault: data.isDefault ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }).returning();
  }

  async update(
    id: number,
    data: Partial<{
      name: string;
      description: string | null;
      color: string;
      gitRepoPath: string | null;
      isDefault: boolean;
      updatedAt: string;
    }>,
  ) {
    return this.db.update(projects).set(data).where(eq(projects.id, id));
  }

  async delete(id: number) {
    return this.db.delete(projects).where(eq(projects.id, id));
  }
}

export const projectRepo = new ProjectRepo();
