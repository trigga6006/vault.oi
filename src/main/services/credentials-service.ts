import crypto from 'node:crypto';
import { credentialsRepo } from '../database/repositories/credentials.repo';
import { projectRepo } from '../database/repositories/project.repo';
import { vaultService } from './vault-service';
import type { CreateCredentialPayload, CredentialRecord, UpdateCredentialPayload } from '../../shared/types/credentials.types';

export class CredentialsService {
  async list(): Promise<CredentialRecord[]> {
    const rows = await credentialsRepo.list();
    const projects = await projectRepo.list();
    const projectMap = new Map(projects.map((project) => [project.id, project.name]));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      providerId: row.providerId,
      projectId: row.projectId,
      projectName: row.projectId ? projectMap.get(row.projectId) ?? null : null,
      username: vaultService.decrypt(row.encryptedUsername),
      notes: row.encryptedNotes ? vaultService.decrypt(row.encryptedNotes) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(payload: CreateCredentialPayload): Promise<CredentialRecord> {
    const now = new Date().toISOString();
    const [created] = await credentialsRepo.create({
      title: payload.title,
      providerId: payload.providerId ?? null,
      projectId: payload.projectId ?? null,
      encryptedUsername: vaultService.encrypt(payload.username),
      encryptedPassword: vaultService.encrypt(payload.password),
      encryptedNotes: payload.notes ? vaultService.encrypt(payload.notes) : null,
      createdAt: now,
      updatedAt: now,
    });

    const project = created.projectId ? await projectRepo.getById(created.projectId) : null;

    return {
      id: created.id,
      title: created.title,
      providerId: created.providerId,
      projectId: created.projectId,
      projectName: project?.name ?? null,
      username: vaultService.decrypt(created.encryptedUsername),
      notes: created.encryptedNotes ? vaultService.decrypt(created.encryptedNotes) : null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async update(payload: UpdateCredentialPayload): Promise<void> {
    const patch: Parameters<typeof credentialsRepo.update>[1] = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.title !== undefined) patch.title = payload.title;
    if (payload.providerId !== undefined) patch.providerId = payload.providerId;
    if (payload.projectId !== undefined) patch.projectId = payload.projectId;
    if (payload.username !== undefined) patch.encryptedUsername = vaultService.encrypt(payload.username);
    if (payload.password !== undefined) patch.encryptedPassword = vaultService.encrypt(payload.password);
    if (payload.notes !== undefined) patch.encryptedNotes = payload.notes ? vaultService.encrypt(payload.notes) : null;

    await credentialsRepo.update(payload.id, patch);
  }

  async delete(id: number): Promise<void> {
    await credentialsRepo.delete(id);
  }

  async getPassword(id: number): Promise<string> {
    const credential = await credentialsRepo.getById(id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    return vaultService.decrypt(credential.encryptedPassword);
  }

  generatePassword(length = 24): string {
    const safeLength = Math.max(16, Math.min(length, 128));
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+-=[]{}~';
    const random = crypto.randomBytes(safeLength * 2);
    let output = '';

    for (let i = 0; output.length < safeLength && i < random.length; i++) {
      output += alphabet[random[i] % alphabet.length];
    }

    return output;
  }
}

export const credentialsService = new CredentialsService();
