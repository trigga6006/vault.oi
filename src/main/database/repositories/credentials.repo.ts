import { desc, eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { credentials } from '../schema';

export class CredentialsRepo {
  private get db() {
    return getDatabase();
  }

  async list() {
    return this.db.select().from(credentials).orderBy(desc(credentials.updatedAt));
  }

  async getById(id: number) {
    const rows = await this.db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    title: string;
    providerId: string | null;
    projectId: number | null;
    encryptedUsername: string;
    encryptedPassword: string;
    encryptedNotes: string | null;
    createdAt: string;
    updatedAt: string;
  }) {
    return this.db.insert(credentials).values(data).returning();
  }

  async update(
    id: number,
    data: Partial<{
      title: string;
      providerId: string | null;
      projectId: number | null;
      encryptedUsername: string;
      encryptedPassword: string;
      encryptedNotes: string | null;
      updatedAt: string;
    }>,
  ) {
    return this.db.update(credentials).set(data).where(eq(credentials.id, id));
  }

  async delete(id: number) {
    return this.db.delete(credentials).where(eq(credentials.id, id));
  }

  async deleteForProject(projectId: number) {
    return this.db.delete(credentials).where(eq(credentials.projectId, projectId));
  }
}

export const credentialsRepo = new CredentialsRepo();
