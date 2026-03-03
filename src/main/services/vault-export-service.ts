import { dialog } from 'electron';
import fs from 'node:fs';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { projectRepo } from '../database/repositories/project.repo';
import { vaultService } from './vault-service';

const EXPORT_VERSION = 1;

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
  async exportVault(): Promise<boolean> {
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

    // Encrypt using vault's derived key
    const plaintext = JSON.stringify(payload);
    const encrypted = vaultService.encrypt(plaintext);

    const exportData = {
      version: EXPORT_VERSION,
      data: encrypted,
    };

    fs.writeFileSync(result.filePath, JSON.stringify(exportData), 'utf-8');
    return true;
  }

  async importVault(): Promise<{ imported: number }> {
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

    // Decrypt using vault's current key
    const plaintext = vaultService.decrypt(exportData.data);
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
