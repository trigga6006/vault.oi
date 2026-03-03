import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { vaultMetadata } from '../schema';

export class VaultRepo {
  private get db() {
    return getDatabase();
  }

  async get() {
    const rows = await this.db.select().from(vaultMetadata).limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    salt: Buffer;
    kdfAlgorithm: string;
    kdfTimeCost: number;
    kdfMemoryCost: number;
    kdfParallelism: number;
    verificationCiphertext: string;
    autoLockMinutes: number;
  }) {
    return this.db.insert(vaultMetadata).values(data).returning();
  }

  async updateVerification(id: number, verificationCiphertext: string) {
    return this.db
      .update(vaultMetadata)
      .set({ verificationCiphertext })
      .where(eq(vaultMetadata.id, id));
  }

  async updateSaltAndVerification(
    id: number,
    salt: Buffer,
    verificationCiphertext: string,
  ) {
    return this.db
      .update(vaultMetadata)
      .set({ salt, verificationCiphertext })
      .where(eq(vaultMetadata.id, id));
  }

  async updateAutoLock(id: number, autoLockMinutes: number) {
    return this.db
      .update(vaultMetadata)
      .set({ autoLockMinutes })
      .where(eq(vaultMetadata.id, id));
  }
}

export const vaultRepo = new VaultRepo();
