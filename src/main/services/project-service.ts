import { projectRepo } from '../database/repositories/project.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { vaultService } from './vault-service';
import type { Environment, ProjectRecord } from '../../shared/types/project.types';

export class ProjectService {
  /**
   * Resolve the correct decrypted key for a proxy request.
   * Priority: project+env assignment > project primary > global active key
   */
  async getKeyForRequest(
    providerId: string,
    projectId?: number,
    environment?: Environment,
  ): Promise<{ key: string; keyId: number } | null> {
    if (!vaultService.isUnlocked) return null;

    // If a project and environment are specified, look for an assigned key
    if (projectId && environment) {
      const assignment = await projectKeyRepo.getPrimary(projectId, environment);
      if (assignment) {
        const keyRow = await apiKeyRepo.getById(assignment.apiKeyId);
        if (keyRow && keyRow.isActive) {
          const key = vaultService.decrypt(keyRow.encryptedKey);
          apiKeyRepo.updateLastUsed(keyRow.id).catch(() => {});
          return { key, keyId: keyRow.id };
        }
      }
    }

    // Fallback: global active key for this provider
    const globalKey = await apiKeyRepo.getActiveForProvider(providerId);
    if (globalKey) {
      const key = vaultService.decrypt(globalKey.encryptedKey);
      apiKeyRepo.updateLastUsed(globalKey.id).catch(() => {});
      return { key, keyId: globalKey.id };
    }

    return null;
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const rows = await projectRepo.list();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      gitRepoPath: r.gitRepoPath,
      isDefault: r.isDefault,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getProject(id: number) {
    return projectRepo.getById(id);
  }

  async createProject(data: {
    name: string;
    description?: string;
    color?: string;
    gitRepoPath?: string;
    isDefault?: boolean;
  }): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const [row] = await projectRepo.create({
      name: data.name,
      description: data.description,
      color: data.color,
      gitRepoPath: data.gitRepoPath,
      isDefault: data.isDefault,
      createdAt: now,
      updatedAt: now,
    });
    return row as ProjectRecord;
  }

  async updateProject(
    id: number,
    data: Partial<{
      name: string;
      description: string | null;
      color: string;
      gitRepoPath: string | null;
      isDefault: boolean;
    }>,
  ) {
    await projectRepo.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteProject(id: number) {
    await projectKeyRepo.deleteForProject(id);
    await projectRepo.delete(id);
  }

  async assignKey(
    projectId: number,
    apiKeyId: number,
    environment: Environment,
    isPrimary?: boolean,
  ) {
    return projectKeyRepo.assign({ projectId, apiKeyId, environment, isPrimary });
  }

  async unassignKey(projectId: number, apiKeyId: number, environment: Environment) {
    return projectKeyRepo.unassign(projectId, apiKeyId, environment);
  }

  async getKeysForProject(projectId: number) {
    return projectKeyRepo.listForProject(projectId);
  }
}

export const projectService = new ProjectService();
