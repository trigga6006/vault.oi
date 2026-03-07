import { dialog } from 'electron';
import fs from 'node:fs';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { projectRepo } from '../database/repositories/project.repo';
import { vaultService } from './vault-service';

const EXPORT_VERSION = 2;

interface ExportPayload {
  version: number;
  exportedAt: string;
  keys: Array<{
    providerId: string;
    keyLabel: string;
    plaintextKey: string;
    keyPrefix: string | null;
    notes: string | null;
  }>;
  projects: Array<{
    name: string;
    description: string | null;
    color: string;
    gitRepoPath: string | null;
  }>;
}

export class VaultExportService {
  /**
   * Export vault to an encrypted file.
   * The file is encrypted with a standalone export password — completely
   * independent of the vault master password. This means the export remains
   * readable even if the master password is changed later.
   */
  async exportVault(exportPassword: string): Promise<boolean> {
    if (!vaultService.isUnlocked) {
      throw new Error('Vault must be unlocked to export');
    }

    const result = await dialog.showSaveDialog({
      title: 'Export Vault',
      defaultPath: 'omniview-vault-backup.enc',
      filters: [{ name: 'Encrypted Vault', extensions: ['enc'] }],
    });

    if (result.canceled || !result.filePath) return false;

    // Gather plaintext data
    const keys = await apiKeyRepo.list();
    const projects = await projectRepo.list();

    const payload: ExportPayload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      keys: keys.map((k) => ({
        providerId: k.providerId,
        keyLabel: k.keyLabel,
        plaintextKey: vaultService.decrypt(k.encryptedKey),
        keyPrefix: k.keyPrefix,
        notes: k.notes,
      })),
      projects: projects.map((p) => ({
        name: p.name,
        description: p.description,
        color: p.color,
        gitRepoPath: p.gitRepoPath,
      })),
    };

    // Encrypt with the export password (independent of vault master key)
    const { encrypted, exportSalt } = vaultService.encryptWithPassword(
      JSON.stringify(payload),
      exportPassword,
    );

    const exportData = {
      version: EXPORT_VERSION,
      exportSalt,
      data: encrypted,
    };

    fs.writeFileSync(result.filePath, JSON.stringify(exportData), 'utf-8');
    return true;
  }

  /**
   * Import vault from an encrypted file.
   * Requires the export password that was used when the file was created.
   */
  async importVault(importPassword: string): Promise<{ imported: number }> {
    if (!vaultService.isUnlocked) {
      throw new Error('Vault must be unlocked to import');
    }

    const result = await dialog.showOpenDialog({
      title: 'Import Vault',
      filters: [{ name: 'Encrypted Vault', extensions: ['enc'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { imported: 0 };
    }

    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const exportData = JSON.parse(raw);

    // v2+: password-based encryption with stored salt
    // v1 (legacy): encrypted with vault's derived key directly
    let plaintext: string;
    if (exportData.version >= 2 && exportData.exportSalt) {
      plaintext = vaultService.decryptWithPassword(exportData.data, importPassword, exportData.exportSalt);
    } else {
      // Legacy v1 backups: decrypt with current vault key
      plaintext = vaultService.decrypt(exportData.data);
    }
    const payload: ExportPayload = JSON.parse(plaintext);

    let imported = 0;

    // Import keys
    for (const key of payload.keys) {
      const encrypted = vaultService.encrypt(key.plaintextKey);
      await apiKeyRepo.insert({
        providerId: key.providerId,
        keyLabel: key.keyLabel,
        encryptedKey: encrypted,
        keyPrefix: key.keyPrefix,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (key.notes) {
        const keys = await apiKeyRepo.list();
        const latest = keys[0];
        if (latest) {
          await apiKeyRepo.update(latest.id, { notes: key.notes });
        }
      }
      imported++;
    }

    // Import projects
    for (const project of payload.projects) {
      try {
        const now = new Date().toISOString();
        await projectRepo.create({
          name: project.name,
          description: project.description,
          color: project.color,
          gitRepoPath: project.gitRepoPath,
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        // Project with same name may already exist
      }
    }

    return { imported };
  }
}

export const vaultExportService = new VaultExportService();
