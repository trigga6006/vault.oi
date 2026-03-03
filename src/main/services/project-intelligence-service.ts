import fs from 'node:fs/promises';
import path from 'node:path';
import { projectRepo } from '../database/repositories/project.repo';
import { projectKeyRepo } from '../database/repositories/project-key.repo';
import { apiKeyRepo } from '../database/repositories/api-key.repo';
import type { ProjectIntelligence, RequiredKeyOccurrence } from '../../shared/types/project.types';

const TARGET_FILES = ['.env', '.env.local', 'config.ts', 'settings.py', 'docker-compose.yml'];
const MAX_FILE_BYTES = 256 * 1024;

function normalizeKeyName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function isIgnoredKey(name: string): boolean {
  return ['NODE_ENV', 'PATH', 'HOME', 'PWD'].includes(name);
}

function collectMatches(content: string, file: string): RequiredKeyOccurrence[] {
  const occurrences: RequiredKeyOccurrence[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (file === '.env' || file === '.env.local') {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      const keyName = normalizeKeyName(match?.[1] ?? '');
      if (keyName && !isIgnoredKey(keyName)) {
        occurrences.push({ keyName, sourceFile: file, line: lineNo, detectionMethod: 'dotenv' });
      }
      return;
    }

    if (file === 'docker-compose.yml') {
      const envMapMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      const keyName = normalizeKeyName(envMapMatch?.[1] ?? '');
      if (keyName && !isIgnoredKey(keyName)) {
        occurrences.push({ keyName, sourceFile: file, line: lineNo, detectionMethod: 'docker-compose' });
      }

      const interpolationRegex = /\$\{([A-Za-z_][A-Za-z0-9_]*)/g;
      let found = interpolationRegex.exec(line);
      while (found) {
        const keyNameFromInterpolation = normalizeKeyName(found[1]);
        if (keyNameFromInterpolation && !isIgnoredKey(keyNameFromInterpolation)) {
          occurrences.push({
            keyName: keyNameFromInterpolation,
            sourceFile: file,
            line: lineNo,
            detectionMethod: 'docker-compose',
          });
        }
        found = interpolationRegex.exec(line);
      }
      return;
    }

    if (file === 'config.ts') {
      const envRegex = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
      let found = envRegex.exec(line);
      while (found) {
        const keyNameFromTs = normalizeKeyName(found[1]);
        if (keyNameFromTs && !isIgnoredKey(keyNameFromTs)) {
          occurrences.push({ keyName: keyNameFromTs, sourceFile: file, line: lineNo, detectionMethod: 'typescript' });
        }
        found = envRegex.exec(line);
      }
      return;
    }

    if (file === 'settings.py') {
      const pythonRegexes = [
        /os\.getenv\(["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
        /environ\[["']([A-Za-z_][A-Za-z0-9_]*)["']\]/g,
      ];

      for (const regex of pythonRegexes) {
        let found = regex.exec(line);
        while (found) {
          const keyNameFromPy = normalizeKeyName(found[1]);
          if (keyNameFromPy && !isIgnoredKey(keyNameFromPy)) {
            occurrences.push({ keyName: keyNameFromPy, sourceFile: file, line: lineNo, detectionMethod: 'python' });
          }
          found = regex.exec(line);
        }
      }
    }
  });

  return occurrences;
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

    if (!project.gitRepoPath) {
      warnings.push('Project does not have a linked repository path.');
    } else {
      const repoPath = path.resolve(project.gitRepoPath);
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
        for (const target of TARGET_FILES) {
          const fullPath = path.join(repoPath, target);
          try {
            const stat = await fs.stat(fullPath);
            if (!stat.isFile()) continue;
            if (stat.size > MAX_FILE_BYTES) {
              warnings.push(`Skipped ${target}: file exceeds ${MAX_FILE_BYTES} bytes.`);
              continue;
            }

            const content = await fs.readFile(fullPath, 'utf8');
            scannedFiles.push(target);
            occurrences.push(...collectMatches(content, target));
          } catch {
            // Missing files are expected; ignore.
          }
        }
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
      warnings,
    };
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

      const repoPath = path.resolve(project.gitRepoPath);
      let hasMatch = false;

      for (const target of TARGET_FILES) {
        try {
          const fullPath = path.join(repoPath, target);
          const stat = await fs.stat(fullPath);
          if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
          const content = await fs.readFile(fullPath, 'utf8');
          const foundKeys = new Set(collectMatches(content, target).map((o) => o.keyName));
          for (const keyName of requiredKeys) {
            if (foundKeys.has(keyName)) {
              duplicateMap.get(keyName)?.add(project.id);
              hasMatch = true;
            }
          }
        } catch {
          // ignore missing/unreadable file
        }
      }

      if (!hasMatch) continue;
    }

    return Array.from(duplicateMap.entries())
      .filter(([, projectIds]) => projectIds.size > 1)
      .map(([keyName, projectIds]) => ({
        keyName,
        projectIds: Array.from(projectIds).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.keyName.localeCompare(b.keyName));
  }
}

export const projectIntelligenceService = new ProjectIntelligenceService();
