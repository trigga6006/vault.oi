import fs from 'node:fs/promises';
import path from 'node:path';
import { projectRepo } from '../database/repositories/project.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { vaultService } from './vault-service';
import type {
  Environment,
  ProjectEnvExportPlan,
  ProjectLeakRiskReport,
  ProjectRecord,
} from '../../shared/types/project.types';

interface EnvLine {
  raw: string;
  key?: string;
}

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
          apiKeyRepo.updateLastUsed(keyRow.id).catch((error: unknown) => {
            console.debug('[ProjectService] Failed to update key usage timestamp', error);
          });
          return { key, keyId: keyRow.id };
        }
      }
    }

    // Fallback: global active key for this provider
    const globalKey = await apiKeyRepo.getActiveForProvider(providerId);
    if (globalKey) {
      const key = vaultService.decrypt(globalKey.encryptedKey);
      apiKeyRepo.updateLastUsed(globalKey.id).catch((error: unknown) => {
        console.debug('[ProjectService] Failed to update global key usage timestamp', error);
      });
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

  async getEnvExportPlan(projectId: number, environment: Environment): Promise<ProjectEnvExportPlan> {
    this.ensureUnlocked();
    const project = await this.requireProject(projectId);
    const repoPath = this.requireRepoPath(project.gitRepoPath);
    const targetPath = path.join(repoPath, '.env');

    const existing = await this.readEnvMap(targetPath);
    const vaultValues = await this.getVaultEnvValues(projectId, environment);

    const entries = Array.from(vaultValues.entries())
      .map(([key, vaultValue]) => {
        const existingValue = existing.get(key) ?? null;
        const status = existingValue === null ? 'new' : existingValue === vaultValue ? 'unchanged' : 'changed';
        return { key, vaultValue, existingValue, status } as const;
      })
      .sort((a, b) => a.key.localeCompare(b.key));

    return {
      projectId,
      environment,
      targetPath,
      entries,
      warnings: entries.some((entry) => entry.status === 'changed')
        ? ['Some keys differ from your current .env and may overwrite existing values.']
        : [],
    };
  }

  async exportEnvSafe(input: {
    projectId: number;
    environment: Environment;
    selectedKeys: string[];
    overwriteConflicts: boolean;
  }): Promise<{ exported: number; path: string }> {
    this.ensureUnlocked();
    const plan = await this.getEnvExportPlan(input.projectId, input.environment);
    const selectedSet = new Set(input.selectedKeys);

    const blocked = plan.entries.filter(
      (entry) => entry.status === 'changed' && selectedSet.has(entry.key) && !input.overwriteConflicts,
    );
    if (blocked.length > 0) {
      throw new Error('Export blocked: conflicting keys selected without overwrite permission.');
    }

    const sourceValues = new Map(plan.entries.map((entry) => [entry.key, entry.vaultValue]));
    const lines = await this.readEnvLines(plan.targetPath);
    const lineIndex = new Map<string, number>();

    lines.forEach((line, index) => {
      if (line.key) lineIndex.set(line.key, index);
    });

    let exported = 0;
    for (const key of input.selectedKeys) {
      const value = sourceValues.get(key);
      if (value === undefined) continue;

      const replacement = `${key}=${value}`;
      const idx = lineIndex.get(key);
      if (idx !== undefined) {
        lines[idx] = { raw: replacement, key };
      } else {
        lines.push({ raw: replacement, key });
      }
      exported += 1;
    }

    await fs.writeFile(plan.targetPath, `${lines.map((line) => line.raw).join('\n')}\n`, 'utf8');
    return { exported, path: plan.targetPath };
  }

  async scanLeakRisk(projectId: number): Promise<ProjectLeakRiskReport> {
    const project = await this.requireProject(projectId);
    if (!project.gitRepoPath) {
      return {
        projectId,
        scannedAt: new Date().toISOString(),
        findings: [],
        warnings: ['Project does not have a linked repository path.'],
      };
    }

    const repoPath = path.resolve(project.gitRepoPath);
    const findings: ProjectLeakRiskReport['findings'] = [];
    const warnings: string[] = [];

    const files = await this.walkFiles(repoPath);
    for (const filePath of files) {
      const relative = path.relative(repoPath, filePath);
      if (relative.startsWith('.git/')) continue;

      const content = await fs.readFile(filePath, 'utf8').catch(() => null);
      if (!content) continue;

      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        const lineNo = index + 1;
        if (/sk_(live|test)_[A-Za-z0-9]{12,}/.test(line)) {
          findings.push({
            type: 'stripe-secret',
            file: relative,
            line: lineNo,
            snippet: line.trim().slice(0, 160),
            message: `Looks like a Stripe secret is hardcoded in ${relative} line ${lineNo}.`,
          });
        }
        if (/(ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z\-_]{20,})/.test(line)) {
          findings.push({
            type: 'token-pattern',
            file: relative,
            line: lineNo,
            snippet: line.trim().slice(0, 160),
            message: `Token-like pattern detected in ${relative} line ${lineNo}.`,
          });
        }
        if (/\b(api[_-]?key|secret|token)\b\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/i.test(line)) {
          findings.push({
            type: 'generic-api-key',
            file: relative,
            line: lineNo,
            snippet: line.trim().slice(0, 160),
            message: `Possible hardcoded secret in ${relative} line ${lineNo}.`,
          });
        }
      });
    }

    const possibleCommitFiles = files.filter((filePath) => {
      const relative = path.relative(repoPath, filePath).toLowerCase();
      return relative.includes('.env') || relative.includes('secrets') || relative.includes('credentials');
    });
    for (const filePath of possibleCommitFiles) {
      findings.push({
        type: 'possible-commit',
        file: path.relative(repoPath, filePath),
        line: 1,
        snippet: 'Potentially sensitive file found in repository tree.',
        message: `Potential accidental secret commit risk in ${path.relative(repoPath, filePath)}.`,
      });
    }

    if (findings.length > 250) {
      warnings.push('Leak scan result truncated to first 250 findings.');
    }

    return {
      projectId,
      scannedAt: new Date().toISOString(),
      findings: findings.slice(0, 250),
      warnings,
    };
  }

  private ensureUnlocked(): void {
    if (!vaultService.isUnlocked) {
      throw new Error('Vault must be unlocked');
    }
  }

  private async requireProject(projectId: number) {
    const project = await projectRepo.getById(projectId);
    if (!project) throw new Error('Project not found');
    return project;
  }

  private requireRepoPath(repoPath: string | null): string {
    if (!repoPath) throw new Error('Project does not have a linked repository path');
    return path.resolve(repoPath);
  }

  private async getVaultEnvValues(projectId: number, environment: Environment): Promise<Map<string, string>> {
    const assignments = await projectKeyRepo.listForProject(projectId);
    const envAssignments = assignments.filter((assignment) => assignment.environment === environment);
    const result = new Map<string, string>();

    for (const assignment of envAssignments) {
      const keyRow = await apiKeyRepo.getById(assignment.apiKeyId);
      if (!keyRow) continue;
      const envName = this.toEnvKeyName(keyRow.keyLabel, keyRow.providerId);
      const plaintext = vaultService.decrypt(keyRow.encryptedKey);
      result.set(envName, plaintext);
    }

    return result;
  }

  private toEnvKeyName(label: string, providerId: string): string {
    const normalized = label.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (/^[A-Z_][A-Z0-9_]*$/.test(normalized)) return normalized;
    return `${providerId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_API_KEY`;
  }

  private async readEnvMap(filePath: string): Promise<Map<string, string>> {
    const lines = await this.readEnvLines(filePath);
    const map = new Map<string, string>();
    for (const line of lines) {
      if (line.key) {
        map.set(line.key, line.raw.slice(line.raw.indexOf('=') + 1));
      }
    }
    return map;
  }

  private async readEnvLines(filePath: string): Promise<EnvLine[]> {
    const content = await fs.readFile(filePath, 'utf8').catch(() => '');
    if (!content) return [];

    return content.split(/\r?\n/).filter((line) => line.length > 0).map((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
      if (!match) return { raw: line };
      return { raw: `${match[1]}=${match[2]}`, key: match[1] };
    });
  }

  private async walkFiles(root: string): Promise<string[]> {
    const output: string[] = [];
    const queue = [root];

    while (queue.length) {
      const current = queue.pop();
      if (!current) continue;
      const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
          queue.push(fullPath);
          continue;
        }
        if (entry.isFile()) {
          output.push(fullPath);
        }
      }
    }

    return output;
  }
}

export const projectService = new ProjectService();
