import fs from 'node:fs/promises';
import path from 'node:path';
import { projectRepo } from '../database/repositories/project.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import { vaultService } from './vault-service';
import { inferKnownProviderId } from '../../shared/constants/provider-inference';
import type {
  Environment,
  ProjectIntelligence,
  ProjectRepoSyncSummary,
  ProjectSyncedSecret,
  RequiredKeyOccurrence,
} from '../../shared/types/project.types';

type TargetFileKind = '.env' | '.env.local' | 'config.ts' | 'settings.py' | 'docker-compose.yml' | 'docker-compose.yaml';

interface RepoFile {
  absolutePath: string;
  relativePath: string;
  kind: TargetFileKind;
}

interface SecretCandidate {
  environment: Environment;
  keyName: string;
  providerId: string | null;
  sourceFile: string;
  value: string;
}

const TARGET_FILE_NAMES = new Set<TargetFileKind>([
  '.env',
  '.env.local',
  'config.ts',
  'settings.py',
  'docker-compose.yml',
  'docker-compose.yaml',
]);
const MAX_FILE_BYTES = 256 * 1024;
const SKIPPED_DIRS = new Set([
  '.git',
  'dist',
  'node_modules',
  '.next',
  'build',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
]);
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

function normalizeKeyName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function isIgnoredKey(name: string): boolean {
  return ['NODE_ENV', 'PATH', 'HOME', 'PWD'].includes(name);
}

function inferProviderFromName(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const inferred = inferKnownProviderId(text);
  if (inferred) {
    return inferred;
  }

  const normalized = text
    .toUpperCase()
    .replace(/^NEXT_PUBLIC_/, '')
    .replace(/^VITE_/, '');
  const suffixMatch = normalized.match(/^(.*?)(?:_API_KEY|_ACCESS_TOKEN|_TOKEN|_SECRET|_CLIENT_SECRET|_CLIENT_ID)$/);
  const base = suffixMatch?.[1]?.trim();
  if (base && base.length > 1) {
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  return null;
}

function toProviderSlug(input: string): string | null {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

function resolveCandidateProviderId(keyName: string): string | null {
  const inferred = inferProviderFromName(keyName);
  if (inferred) {
    return inferred;
  }

  const normalized = keyName
    .trim()
    .toUpperCase()
    .replace(/^NEXT_PUBLIC_/, '')
    .replace(/^VITE_/, '');

  const stripped = normalized.replace(
    /(?:_API_KEY|_ACCESS_TOKEN|_TOKEN|_SECRET|_CLIENT_SECRET|_CLIENT_ID|_REST_URL|_WS_URL|_BASE_URL|_URL)$/i,
    '',
  );

  return toProviderSlug(stripped) ?? toProviderSlug(normalized);
}

function providerMatchesCandidate(
  existingProviderId: string,
  keyLabel: string,
  candidateProviderId: string,
): boolean {
  if (existingProviderId === candidateProviderId) {
    return true;
  }

  return inferKnownProviderId(`${existingProviderId} ${keyLabel}`) === candidateProviderId;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function stripInlineComment(value: string): string {
  const hashIndex = value.indexOf(' #');
  return hashIndex >= 0 ? value.slice(0, hashIndex).trim() : value.trim();
}

function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('${') || trimmed.startsWith('$')) return false;
  if (/^(example|sample|placeholder|replace[-_ ]?me|changeme|your[-_ ]?api[-_ ]?key)$/i.test(trimmed)) {
    return false;
  }

  return true;
}

function collectMatches(content: string, kind: TargetFileKind, sourceFile: string): RequiredKeyOccurrence[] {
  const occurrences: RequiredKeyOccurrence[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (kind === '.env' || kind === '.env.local') {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      const keyName = normalizeKeyName(match?.[1] ?? '');
      if (keyName && !isIgnoredKey(keyName)) {
        occurrences.push({ keyName, sourceFile, line: lineNo, detectionMethod: 'dotenv' });
      }
      return;
    }

    if (kind === 'docker-compose.yml' || kind === 'docker-compose.yaml') {
      const envMapMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      const keyName = normalizeKeyName(envMapMatch?.[1] ?? '');
      if (keyName && !isIgnoredKey(keyName)) {
        occurrences.push({ keyName, sourceFile, line: lineNo, detectionMethod: 'docker-compose' });
      }

      const interpolationRegex = /\$\{([A-Za-z_][A-Za-z0-9_]*)/g;
      let found = interpolationRegex.exec(line);
      while (found) {
        const interpolationKey = normalizeKeyName(found[1]);
        if (interpolationKey && !isIgnoredKey(interpolationKey)) {
          occurrences.push({
            keyName: interpolationKey,
            sourceFile,
            line: lineNo,
            detectionMethod: 'docker-compose',
          });
        }
        found = interpolationRegex.exec(line);
      }

      return;
    }

    if (kind === 'config.ts') {
      const envRegex = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
      let found = envRegex.exec(line);
      while (found) {
        const keyName = normalizeKeyName(found[1]);
        if (keyName && !isIgnoredKey(keyName)) {
          occurrences.push({ keyName, sourceFile, line: lineNo, detectionMethod: 'typescript' });
        }
        found = envRegex.exec(line);
      }
      return;
    }

    if (kind === 'settings.py') {
      const pythonRegexes = [
        /os\.getenv\(["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
        /environ\[["']([A-Za-z_][A-Za-z0-9_]*)["']\]/g,
      ];

      for (const regex of pythonRegexes) {
        let found = regex.exec(line);
        while (found) {
          const keyName = normalizeKeyName(found[1]);
          if (keyName && !isIgnoredKey(keyName)) {
            occurrences.push({ keyName, sourceFile, line: lineNo, detectionMethod: 'python' });
          }
          found = regex.exec(line);
        }
      }
    }
  });

  return occurrences;
}

function collectSecretCandidates(content: string, kind: TargetFileKind, sourceFile: string): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  const environment: Environment = 'dev';

  if (kind === '.env' || kind === '.env.local') {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      const keyName = normalizeKeyName(match?.[1] ?? '');
      if (!keyName || isIgnoredKey(keyName)) continue;

      const rawValue = stripInlineComment(unquote((match?.[2] ?? '').trim()));
      if (!looksLikeSecretValue(rawValue)) continue;

      candidates.push({
        environment,
        keyName,
        providerId: resolveCandidateProviderId(keyName),
        sourceFile,
        value: rawValue,
      });
    }

    return candidates;
  }

  if (kind === 'docker-compose.yml' || kind === 'docker-compose.yaml') {
    for (const line of content.split(/\r?\n/)) {
      const listMatch = line.match(/^\s*-\s*([A-Za-z_][A-Za-z0-9_]*)=(.+)$/);
      const mapMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      const keyName = normalizeKeyName(listMatch?.[1] ?? mapMatch?.[1] ?? '');
      if (!keyName || isIgnoredKey(keyName)) continue;

      const rawValue = stripInlineComment(unquote((listMatch?.[2] ?? mapMatch?.[2] ?? '').trim()));
      if (!looksLikeSecretValue(rawValue)) continue;

      candidates.push({
        environment,
        keyName,
        providerId: resolveCandidateProviderId(keyName),
        sourceFile,
        value: rawValue,
      });
    }
  }

  return candidates;
}

export class ProjectIntelligenceService {
  async scanProject(projectId: number): Promise<ProjectIntelligence> {
    const project = await projectRepo.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const warnings: string[] = [];
    const occurrences: RequiredKeyOccurrence[] = [];
    const scannedFiles: string[] = [];
    let syncedSecrets: ProjectSyncedSecret[] = [];
    let syncSummary: ProjectRepoSyncSummary = {
      imported: 0,
      updated: 0,
      assigned: 0,
      unchanged: 0,
      unmapped: 0,
    };

    if (!project.gitRepoPath) {
      warnings.push('Project does not have a linked repository path.');
    } else {
      const repoPath = path.resolve(normalizeRepoPathInput(project.gitRepoPath) ?? project.gitRepoPath);
      let repoStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        repoStat = await fs.stat(repoPath);
      } catch {
        warnings.push('Linked repository path is not accessible.');
      }

      if (repoStat && !repoStat.isDirectory()) {
        warnings.push('Linked repository path is not a directory.');
      }

      if (repoStat?.isDirectory()) {
        const repoFiles = await this.findTargetFiles(repoPath);
        const candidateMap = new Map<string, SecretCandidate>();

        for (const file of repoFiles) {
          try {
            const stat = await fs.stat(file.absolutePath);
            if (!stat.isFile()) continue;
            if (stat.size > MAX_FILE_BYTES) {
              warnings.push(`Skipped ${file.relativePath}: file exceeds ${MAX_FILE_BYTES} bytes.`);
              continue;
            }

            const content = await fs.readFile(file.absolutePath, 'utf8');
            scannedFiles.push(file.relativePath);
            occurrences.push(...collectMatches(content, file.kind, file.relativePath));

            for (const candidate of collectSecretCandidates(content, file.kind, file.relativePath)) {
              const key = `${candidate.environment}:${candidate.keyName}`;
              candidateMap.set(key, candidate);
            }
          } catch {
            warnings.push(`Failed to read ${file.relativePath}.`);
          }
        }

        const syncResult = await this.syncSecretCandidates(projectId, Array.from(candidateMap.values()));
        syncedSecrets = syncResult.syncedSecrets;
        syncSummary = syncResult.syncSummary;
        warnings.push(...syncResult.warnings);
      }
    }

    const requiredKeys = Array.from(new Set(occurrences.map((o) => o.keyName))).sort();
    const providedKeyNames = await this.getProvidedKeyNames(projectId);
    const missingKeys = requiredKeys.filter((key) => !providedKeyNames.has(key));
    const unusedKeys = Array.from(providedKeyNames).filter((key) => !requiredKeys.includes(key)).sort();
    const duplicateKeys = await this.findDuplicates(projectId, requiredKeys);

    return {
      projectId,
      scannedAt: new Date().toISOString(),
      repoPath: project.gitRepoPath,
      scannedFiles: scannedFiles.sort(),
      requiredKeys,
      missingKeys,
      unusedKeys,
      duplicateKeys,
      occurrences,
      syncedSecrets,
      syncSummary,
      warnings: Array.from(new Set(warnings)),
    };
  }

  async syncProjectSecrets(projectId: number): Promise<{
    syncedSecrets: ProjectSyncedSecret[];
    syncSummary: ProjectRepoSyncSummary;
    warnings: string[];
  }> {
    const project = await projectRepo.getById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.gitRepoPath) {
      return {
        syncedSecrets: [],
        syncSummary: { imported: 0, updated: 0, assigned: 0, unchanged: 0, unmapped: 0 },
        warnings: ['Project does not have a linked repository path.'],
      };
    }

    const repoPath = path.resolve(normalizeRepoPathInput(project.gitRepoPath) ?? project.gitRepoPath);
    let repoStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
    try {
      repoStat = await fs.stat(repoPath);
    } catch {
      return {
        syncedSecrets: [],
        syncSummary: { imported: 0, updated: 0, assigned: 0, unchanged: 0, unmapped: 0 },
        warnings: ['Linked repository path is not accessible.'],
      };
    }

    if (!repoStat.isDirectory()) {
      return {
        syncedSecrets: [],
        syncSummary: { imported: 0, updated: 0, assigned: 0, unchanged: 0, unmapped: 0 },
        warnings: ['Linked repository path is not a directory.'],
      };
    }

    const repoFiles = await this.findTargetFiles(repoPath);
    const candidateMap = new Map<string, SecretCandidate>();

    for (const file of repoFiles) {
      try {
        const stat = await fs.stat(file.absolutePath);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
        const content = await fs.readFile(file.absolutePath, 'utf8');
        for (const candidate of collectSecretCandidates(content, file.kind, file.relativePath)) {
          candidateMap.set(`${candidate.environment}:${candidate.keyName}`, candidate);
        }
      } catch {
        // Ignore unreadable files during background sync.
      }
    }

    return this.syncSecretCandidates(projectId, Array.from(candidateMap.values()));
  }

  private async syncSecretCandidates(projectId: number, candidates: SecretCandidate[]) {
    const warnings: string[] = [];
    const syncedSecrets: ProjectSyncedSecret[] = [];
    const syncSummary: ProjectRepoSyncSummary = {
      imported: 0,
      updated: 0,
      assigned: 0,
      unchanged: 0,
      unmapped: 0,
    };

    if (candidates.length === 0) {
      return { syncedSecrets, syncSummary, warnings };
    }

    if (!vaultService.isUnlocked) {
      warnings.push('Vault must be unlocked to import discovered repository secrets.');
      return { syncedSecrets, syncSummary, warnings };
    }

    const assignments = await projectKeyRepo.listForProject(projectId);
    const assignmentRows = new Map<number, Awaited<ReturnType<typeof apiKeyRepo.getById>>>();
    for (const assignment of assignments) {
      assignmentRows.set(assignment.apiKeyId, await apiKeyRepo.getById(assignment.apiKeyId));
    }

    for (const candidate of candidates) {
      if (!candidate.providerId) {
        syncSummary.unmapped += 1;
        syncedSecrets.push({
          keyName: candidate.keyName,
          providerId: null,
          environment: candidate.environment,
          sourceFile: candidate.sourceFile,
          keyPrefix: null,
          status: 'unmapped',
        });
        continue;
      }
      const candidateProviderId = candidate.providerId;

      const matchingAssignment = assignments.find((assignment) => {
        if (assignment.environment !== candidate.environment) return false;
        const row = assignmentRows.get(assignment.apiKeyId);
        if (!row) return false;
        return providerMatchesCandidate(row.providerId, row.keyLabel, candidateProviderId) && normalizeKeyName(row.keyLabel) === candidate.keyName;
      });

      const keyPrefix = candidate.value.slice(0, 8);

      if (matchingAssignment) {
        const existingRow = assignmentRows.get(matchingAssignment.apiKeyId);
        if (!existingRow) continue;

        const currentPlaintext = vaultService.decrypt(existingRow.encryptedKey);
        if (currentPlaintext === candidate.value) {
          syncSummary.unchanged += 1;
          syncedSecrets.push({
            keyName: candidate.keyName,
            providerId: candidateProviderId,
            environment: candidate.environment,
            sourceFile: candidate.sourceFile,
            keyPrefix,
            status: 'unchanged',
          });
          continue;
        }

        await apiKeyRepo.update(existingRow.id, {
          providerId: candidateProviderId,
          encryptedKey: vaultService.encrypt(candidate.value),
          keyPrefix,
          updatedAt: new Date().toISOString(),
          generatedWhere: candidate.sourceFile,
          notes: `Imported from ${candidate.sourceFile}`,
        });
        syncSummary.updated += 1;
        syncedSecrets.push({
          keyName: candidate.keyName,
          providerId: candidateProviderId,
          environment: candidate.environment,
          sourceFile: candidate.sourceFile,
          keyPrefix,
          status: 'updated',
        });
        continue;
      }

      const now = new Date().toISOString();
      const [created] = await apiKeyRepo.insert({
        providerId: candidateProviderId,
        keyLabel: candidate.keyName,
        encryptedKey: vaultService.encrypt(candidate.value),
        keyPrefix,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        generatedWhere: candidate.sourceFile,
        notes: `Imported from ${candidate.sourceFile}`,
      });
      syncSummary.imported += 1;

      const hasProviderAssignment = assignments.some((assignment) => {
        if (assignment.environment !== candidate.environment) return false;
        const row = assignmentRows.get(assignment.apiKeyId);
        return row ? providerMatchesCandidate(row.providerId, row.keyLabel, candidateProviderId) : false;
      });

      await projectKeyRepo.assign({
        projectId,
        apiKeyId: created.id,
        environment: candidate.environment,
        isPrimary: !hasProviderAssignment,
      });

      const createdRow = (await apiKeyRepo.getById(created.id)) ?? created;
      assignments.push({
        id: -created.id,
        projectId,
        apiKeyId: created.id,
        environment: candidate.environment,
        isPrimary: !hasProviderAssignment,
      });
      assignmentRows.set(created.id, createdRow);

      syncSummary.assigned += 1;
      syncedSecrets.push({
        keyName: candidate.keyName,
        providerId: candidateProviderId,
        environment: candidate.environment,
        sourceFile: candidate.sourceFile,
        keyPrefix,
        status: 'assigned',
      });
    }

    return { syncedSecrets, syncSummary, warnings };
  }

  private async getProvidedKeyNames(projectId: number): Promise<Set<string>> {
    const assignments = await projectKeyRepo.listForProject(projectId);
    const provided = new Set<string>();

    for (const assignment of assignments) {
      const key = await apiKeyRepo.getById(assignment.apiKeyId);
      if (!key) continue;

      const labelName = normalizeKeyName(key.keyLabel);
      if (labelName) {
        provided.add(labelName);
      }

      const providerDerived = normalizeKeyName(`${key.providerId}_API_KEY`);
      if (providerDerived) {
        provided.add(providerDerived);
      }
    }

    return provided;
  }

  private async findDuplicates(projectId: number, requiredKeys: string[]) {
    const projects = await projectRepo.list();
    const duplicateMap = new Map<string, Set<number>>();

    for (const keyName of requiredKeys) {
      duplicateMap.set(keyName, new Set([projectId]));
    }

    for (const project of projects) {
      if (project.id === projectId || !project.gitRepoPath) continue;

      const repoPath = path.resolve(normalizeRepoPathInput(project.gitRepoPath) ?? project.gitRepoPath);
      let repoStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        repoStat = await fs.stat(repoPath);
      } catch {
        continue;
      }

      if (!repoStat.isDirectory()) continue;

      const repoFiles = await this.findTargetFiles(repoPath);
      const foundKeys = new Set<string>();

      for (const file of repoFiles) {
        try {
          const stat = await fs.stat(file.absolutePath);
          if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
          const content = await fs.readFile(file.absolutePath, 'utf8');
          collectMatches(content, file.kind, file.relativePath).forEach((occurrence) => {
            foundKeys.add(occurrence.keyName);
          });
        } catch {
          // ignore missing/unreadable file
        }
      }

      for (const keyName of requiredKeys) {
        if (foundKeys.has(keyName)) {
          duplicateMap.get(keyName)?.add(project.id);
        }
      }
    }

    return Array.from(duplicateMap.entries())
      .filter(([, projectIds]) => projectIds.size > 1)
      .map(([keyName, projectIds]) => ({
        keyName,
        projectIds: Array.from(projectIds).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.keyName.localeCompare(b.keyName));
  }

  private async findTargetFiles(root: string): Promise<RepoFile[]> {
    const found: RepoFile[] = [];
    const queue = [root];

    while (queue.length) {
      const current = queue.pop();
      if (!current) continue;

      const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (SKIPPED_DIRS.has(entry.name)) continue;
          queue.push(absolutePath);
          continue;
        }

        if (!entry.isFile()) continue;
        if (!TARGET_FILE_NAMES.has(entry.name as TargetFileKind)) continue;

        found.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath),
          kind: entry.name as TargetFileKind,
        });
      }
    }

    return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }
}

export const projectIntelligenceService = new ProjectIntelligenceService();
