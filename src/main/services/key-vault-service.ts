import { vaultService } from './vault-service';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import type { ApiKeyMetadata } from '../../shared/types/vault.types';

export class KeyVaultService {
  /** Store an API key encrypted in the vault */
  async storeKey(
    providerId: string,
    apiKey: string,
    label?: string,
    notes?: string,
    serviceType?: string,
    generatedWhere?: string,
    expiresAt?: string,
  ): Promise<ApiKeyMetadata> {
    const encrypted = vaultService.encrypt(apiKey);
    const keyPrefix = apiKey.slice(0, 8);
    const now = new Date().toISOString();

    const [row] = await apiKeyRepo.insert({
      providerId,
      keyLabel: label ?? 'Default',
      encryptedKey: encrypted,
      keyPrefix,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt ?? null,
      serviceType: serviceType ?? null,
      generatedWhere: generatedWhere ?? null,
      notes: notes ?? null,
    });

    return this.toMetadata((await apiKeyRepo.getById(row.id)) ?? row);
  }

  /** Get decrypted key for a provider (returns plaintext — never send to renderer) */
  async getDecryptedKey(providerId: string): Promise<{ key: string; keyId: number } | null> {
    const row = await apiKeyRepo.getActiveForProvider(providerId);
    if (!row) return null;

    const key = vaultService.decrypt(row.encryptedKey);
    // Update last used timestamp asynchronously
    apiKeyRepo.updateLastUsed(row.id).catch((error: unknown) => {
      console.debug('[KeyVault] Failed to update last-used timestamp', error);
    });
    return { key, keyId: row.id };
  }


  async getPlaintextById(id: number): Promise<string> {
    const row = await apiKeyRepo.getById(id);
    if (!row) {
      throw new Error('Secret not found');
    }

    return vaultService.decrypt(row.encryptedKey);
  }

  /** Rotate a key — store new encrypted key, update timestamp */
  async rotateKey(id: number, newKey: string): Promise<void> {
    const encrypted = vaultService.encrypt(newKey);
    const keyPrefix = newKey.slice(0, 8);
    await apiKeyRepo.update(id, {
      encryptedKey: encrypted,
      keyPrefix,
      lastRotatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /** List all keys as metadata (never includes plaintext) */
  async listKeys(): Promise<ApiKeyMetadata[]> {
    const rows = await apiKeyRepo.list();
    return rows.map(this.toMetadata);
  }

  /** Update key metadata */
  async updateKey(
    id: number,
    data: { label?: string; notes?: string; isActive?: boolean; serviceType?: string; generatedWhere?: string; expiresAt?: string | null; lastVerifiedAt?: string },
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (data.label !== undefined) update.keyLabel = data.label;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.serviceType !== undefined) update.serviceType = data.serviceType;
    if (data.generatedWhere !== undefined) update.generatedWhere = data.generatedWhere;
    if (data.expiresAt !== undefined) update.expiresAt = data.expiresAt;
    if (data.lastVerifiedAt !== undefined) update.lastVerifiedAt = data.lastVerifiedAt;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    update.updatedAt = new Date().toISOString();
    await apiKeyRepo.update(id, update as any);
  }

  async markVerified(id: number): Promise<void> {
    const now = new Date().toISOString();
    await apiKeyRepo.update(id, { lastVerifiedAt: now });
  }

  /** Delete a key */
  async deleteKey(id: number): Promise<void> {
    await projectKeyRepo.deleteForKey(id);
    await apiKeyRepo.delete(id);
  }

  /** Re-encrypt all keys (used during password change) */
  async reEncryptAll(
    decryptFn: (ct: string) => string,
    encryptFn: (pt: string) => string,
  ): Promise<void> {
    const rows = await apiKeyRepo.list();
    for (const row of rows) {
      const plaintext = decryptFn(row.encryptedKey);
      const newEncrypted = encryptFn(plaintext);
      await apiKeyRepo.update(row.id, { encryptedKey: newEncrypted, updatedAt: new Date().toISOString() });
    }
  }

  private toMetadata(row: any): ApiKeyMetadata {
    return {
      id: row.id,
      providerId: row.providerId,
      keyLabel: row.keyLabel,
      keyPrefix: row.keyPrefix,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastUsedAt: row.lastUsedAt,
      lastRotatedAt: row.lastRotatedAt,
      lastVerifiedAt: row.lastVerifiedAt,
      expiresAt: row.expiresAt,
      serviceType: row.serviceType,
      generatedWhere: row.generatedWhere,
      notes: row.notes,
    };
  }
}

export const keyVaultService = new KeyVaultService();
