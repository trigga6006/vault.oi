import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';
import { projectRepo } from '../database/repositories/project.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { credentialsRepo } from '../database/repositories/credentials.repo';
import { vaultService } from './vault-service';
import { projectIntelligenceService } from './project-intelligence-service';
import { keyRotationService } from './key-rotation-service';
import type {
  Environment,
  ProjectEnvExportPlan,
  ProjectEnvImportResult,
  ProjectLeakRiskReport,
  ProjectRecord,
} from '../../shared/types/project.types';

interface EnvLine {
  raw: string;
  key?: string;
}

interface ImportedEnvVariable {
  keyName: string;
  value: string;
  providerId: string;
  serviceType: string;
}

const PROVIDER_SECRET_HINTS: Array<{ pattern: RegExp; providerId: string }> = [
  { pattern: /OPENAI/i, providerId: 'openai' },
  { pattern: /AZURE/i, providerId: 'azure' },
  { pattern: /ANTHROPIC|CLAUDE/i, providerId: 'anthropic' },
  { pattern: /GEMINI|GOOGLE/i, providerId: 'google' },
  { pattern: /XAI|GROK/i, providerId: 'xai' },
  { pattern: /MISTRAL/i, providerId: 'mistral' },
  { pattern: /COHERE/i, providerId: 'cohere' },
  { pattern: /TOGETHER/i, providerId: 'together' },
  { pattern: /FIREWORKS/i, providerId: 'fireworks' },
  { pattern: /HUGGING ?FACE|HF_/i, providerId: 'huggingface' },
  { pattern: /PERPLEXITY/i, providerId: 'perplexity' },
  { pattern: /OLLAMA/i, providerId: 'ollama' },
  { pattern: /OPENROUTER/i, providerId: 'openrouter' },
  { pattern: /DEEPSEEK/i, providerId: 'deepseek' },
  { pattern: /QWEN|DASHSCOPE/i, providerId: 'qwen' },
  { pattern: /COPILOT/i, providerId: 'copilot' },
  { pattern: /CURSOR/i, providerId: 'cursor' },
];

function normalizeEnvKeyName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function stripInlineComment(value: string): string {
  const hashIndex = value.indexOf(' #');
  return hashIndex >= 0 ? value.slice(0, hashIndex).trim() : value.trim();
}

function inferProviderSecretId(keyName: string): string | null {
  const normalized = keyName
    .trim()
    .toUpperCase()
    .replace(/^NEXT_PUBLIC_/, '')
    .replace(/^VITE_/, '');

  if (!/(API_KEY|ACCESS_TOKEN|TOKEN|SECRET|CLIENT_SECRET|CLIENT_ID|CONNECTION_STRING|ACCOUNT_KEY|PRIVATE_KEY|KEY)$/.test(normalized)) {
    return null;
  }

  for (const hint of PROVIDER_SECRET_HINTS) {
    if (hint.pattern.test(normalized)) {
      return hint.providerId;
    }
  }

  return null;
}

function classifyImportedEnvVariable(keyName: string): ImportedEnvVariable {
  const providerId = inferProviderSecretId(keyName);
  if (providerId) {
    return {
      keyName,
      value: '',
      providerId,
      serviceType: 'provider',
    };
  }

  const normalized = keyName.toUpperCase();
  const looksSecretLike = /(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|WEBHOOK|DATABASE_URL|CONNECTION_STRING|DSN|ACCESS_KEY|SESSION|COOKIE|AUTH|JWT|ENCRYPTION|SIGNING)/.test(normalized);

  if (looksSecretLike) {
    return {
      keyName,
      value: '',
      providerId: 'app',
      serviceType: 'app_secret',
    };
  }

  return {
    keyName,
    value: '',
    providerId: 'config',
    serviceType: 'config',
  };
}

function normalizeRepoPathInput(repoPath?: string | null): string | null {
  if (!repoPath) return null;

  const trimmed = repoPath.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
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

    if (projectId && environment) {
      const assignments = await projectKeyRepo.listForProject(projectId);
      const candidates = await Promise.all(
        assignments
          .filter((assignment) => assignment.environment === environment)
          .map(async (assignment) => {
            const keyRow = await apiKeyRepo.getById(assignment.apiKeyId);
            if (!keyRow || !keyRow.isActive || keyRow.providerId !== providerId) {
              return null;
            }

            return { assignment, keyRow };
          }),
      );

      const resolved = candidates
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => {
          if (a.assignment.isPrimary === b.assignment.isPrimary) {
            return b.keyRow.createdAt.localeCompare(a.keyRow.createdAt);
          }

          return a.assignment.isPrimary ? -1 : 1;
        })[0];

      if (resolved) {
        const key = vaultService.decrypt(resolved.keyRow.encryptedKey);
        apiKeyRepo.updateLastUsed(resolved.keyRow.id).catch((error: unknown) => {
          console.debug('[ProjectService] Failed to update key usage timestamp', error);
        });
        return { key, keyId: resolved.keyRow.id };
      }
    }

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
    const gitRepoPath = normalizeRepoPathInput(data.gitRepoPath);
    const [row] = await projectRepo.create({
      name: data.name,
      description: data.description,
      color: data.color,
      gitRepoPath,
      isDefault: data.isDefault,
      createdAt: now,
      updatedAt: now,
    });

    if (row.gitRepoPath) {
      await projectIntelligenceService.syncProjectSecrets(row.id).catch((error: unknown) => {
        console.warn('[ProjectService] Failed to sync repo secrets on create', error);
      });
    }

    return row as ProjectRecord;
  }

  async pickEnvFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose .env file',
      filters: [
        { name: 'Environment files', extensions: ['env', 'txt', 'local'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0] ?? null;
  }

  async createProjectFromEnv(data: {
    name: string;
    description?: string;
    color?: string;
    gitRepoPath?: string;
    isDefault?: boolean;
    envFilePath: string;
    environment?: Environment;
  }): Promise<ProjectEnvImportResult> {
    const sourcePath = path.resolve(data.envFilePath);
    const sourceStat = await fs.stat(sourcePath).catch(() => null);
    if (!sourceStat?.isFile()) {
      throw new Error('Selected .env file is not accessible.');
    }

    const project = await this.createProject({
      name: data.name,
      description: data.description,
      color: data.color,
      gitRepoPath: data.gitRepoPath,
      isDefault: data.isDefault,
    });

    return this.importEnvIntoProject({
      projectId: project.id,
      envFilePath: sourcePath,
      environment: data.environment ?? 'dev',
    });
  }

  async importEnvIntoProject(input: {
    projectId: number;
    envFilePath: string;
    environment: Environment;
  }): Promise<ProjectEnvImportResult> {
    this.ensureUnlocked();
    await this.requireProject(input.projectId);

    const sourcePath = path.resolve(input.envFilePath);
    const sourceStat = await fs.stat(sourcePath).catch(() => null);
    if (!sourceStat?.isFile()) {
      throw new Error('Selected .env file is not accessible.');
    }

    const raw = await fs.readFile(sourcePath, 'utf8');
    const parsedRows = this.parseEnvFile(raw);

    const assignments = await projectKeyRepo.listForProject(input.projectId);
    const assignmentRows = new Map<number, Awaited<ReturnType<typeof apiKeyRepo.getById>>>();
    for (const assignment of assignments) {
      assignmentRows.set(assignment.apiKeyId, await apiKeyRepo.getById(assignment.apiKeyId));
    }

    const allKeys = await apiKeyRepo.list();
    const now = new Date().toISOString();
    const result: ProjectEnvImportResult = {
      projectId: input.projectId,
      environment: input.environment,
      sourcePath,
      imported: 0,
      updated: 0,
      assigned: 0,
      unchanged: 0,
      skipped: 0,
    };

    for (const parsed of parsedRows) {
      const existingAssignment = assignments.find((assignment) => {
        if (assignment.environment !== input.environment) return false;
        const row = assignmentRows.get(assignment.apiKeyId);
        if (!row) return false;
        return normalizeEnvKeyName(row.keyLabel) === parsed.keyName;
      });

      if (existingAssignment) {
        const existingRow = assignmentRows.get(existingAssignment.apiKeyId);
        if (!existingRow) {
          result.skipped += 1;
          continue;
        }

        const currentPlaintext = vaultService.decrypt(existingRow.encryptedKey);
        if (
          currentPlaintext === parsed.value
          && existingRow.providerId === parsed.providerId
          && existingRow.serviceType === parsed.serviceType
        ) {
          result.unchanged += 1;
          continue;
        }

        await apiKeyRepo.update(existingRow.id, {
          providerId: parsed.providerId,
          encryptedKey: vaultService.encrypt(parsed.value),
          keyPrefix: parsed.value.slice(0, 8),
          updatedAt: now,
          serviceType: parsed.serviceType,
          generatedWhere: sourcePath,
          notes: `Imported from ${sourcePath}`,
        });
        result.updated += 1;
        continue;
      }

      const reusableKey = allKeys.find(
        (row) => normalizeEnvKeyName(row.keyLabel) === parsed.keyName && row.providerId === parsed.providerId,
      ) ?? null;

      let apiKeyId = reusableKey?.id ?? null;
      if (reusableKey) {
        const currentPlaintext = vaultService.decrypt(reusableKey.encryptedKey);
        if (
          currentPlaintext !== parsed.value
          || reusableKey.serviceType !== parsed.serviceType
          || reusableKey.generatedWhere !== sourcePath
        ) {
          await apiKeyRepo.update(reusableKey.id, {
            encryptedKey: vaultService.encrypt(parsed.value),
            keyPrefix: parsed.value.slice(0, 8),
            updatedAt: now,
            serviceType: parsed.serviceType,
            generatedWhere: sourcePath,
            notes: `Imported from ${sourcePath}`,
          });
          result.updated += 1;
        } else {
          result.unchanged += 1;
        }
      } else {
        const [created] = await apiKeyRepo.insert({
          providerId: parsed.providerId,
          keyLabel: parsed.keyName,
          encryptedKey: vaultService.encrypt(parsed.value),
          keyPrefix: parsed.value.slice(0, 8),
          isActive: true,
          createdAt: now,
          updatedAt: now,
          serviceType: parsed.serviceType,
          generatedWhere: sourcePath,
          notes: `Imported from ${sourcePath}`,
        });
        apiKeyId = created.id;
        allKeys.unshift(created);
        result.imported += 1;
      }

      if (!apiKeyId) {
        result.skipped += 1;
        continue;
      }

      const alreadyAssigned = assignments.some(
        (assignment) => assignment.apiKeyId === apiKeyId && assignment.environment === input.environment,
      );
      if (!alreadyAssigned) {
        const hasPrimaryForProvider = assignments.some((assignment) => {
          if (assignment.environment !== input.environment) return false;
          const row = assignmentRows.get(assignment.apiKeyId);
          return row?.providerId === parsed.providerId && assignment.isPrimary;
        });

        const [createdAssignment] = await projectKeyRepo.assign({
          projectId: input.projectId,
          apiKeyId,
          environment: input.environment,
          isPrimary: !hasPrimaryForProvider,
        });
        assignments.push(createdAssignment);
        assignmentRows.set(apiKeyId, (await apiKeyRepo.getById(apiKeyId)) ?? reusableKey);
        result.assigned += 1;
      }
    }

    return result;
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
    const normalizedData = {
      ...data,
      gitRepoPath: data.gitRepoPath !== undefined ? normalizeRepoPathInput(data.gitRepoPath) : undefined,
    };

    await projectRepo.update(id, {
      ...normalizedData,
      updatedAt: new Date().toISOString(),
    });

    const project = await projectRepo.getById(id);
    if (project?.gitRepoPath) {
      await projectIntelligenceService.syncProjectSecrets(id).catch((error: unknown) => {
        console.warn('[ProjectService] Failed to sync repo secrets on update', error);
      });
    }
  }

  async deleteProject(id: number) {
    await credentialsRepo.deleteForProject(id);
    await projectKeyRepo.deleteForProject(id);
    keyRotationService.deletePoliciesForProject(id);
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

  private parseEnvFile(raw: string): ImportedEnvVariable[] {
    const rows: ImportedEnvVariable[] = [];

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      const keyName = normalizeEnvKeyName(match?.[1] ?? '');
      if (!keyName) continue;

      const value = stripInlineComment(unquoteEnvValue(match?.[2] ?? ''));
      if (!value) continue;

      const classification = classifyImportedEnvVariable(keyName);
      rows.push({
        ...classification,
        value,
      });
    }

    return rows;
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
    const normalized = normalizeRepoPathInput(repoPath);
    if (!normalized) throw new Error('Project does not have a linked repository path');
    return path.resolve(normalized);
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
