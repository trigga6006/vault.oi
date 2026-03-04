export type Environment = 'dev' | 'staging' | 'prod';

export interface ProjectRecord {
  id: number;
  name: string;
  description: string | null;
  color: string;
  gitRepoPath: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectKeyAssignment {
  id: number;
  projectId: number;
  apiKeyId: number;
  environment: Environment;
  isPrimary: boolean;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  color?: string;
  gitRepoPath?: string;
  isDefault?: boolean;
}

export interface CreateProjectFromEnvPayload extends CreateProjectPayload {
  envFilePath: string;
  environment?: Environment;
}

export interface UpdateProjectPayload {
  id: number;
  name?: string;
  description?: string;
  color?: string;
  gitRepoPath?: string;
  isDefault?: boolean;
}

export interface AssignKeyPayload {
  projectId: number;
  apiKeyId: number;
  environment: Environment;
  isPrimary?: boolean;
}

export interface UnassignKeyPayload {
  projectId: number;
  apiKeyId: number;
  environment: Environment;
}

export interface SetActiveProjectPayload {
  projectId: number | null;
}

export interface ImportProjectEnvPayload {
  projectId: number;
  envFilePath: string;
  environment: Environment;
}

export interface ProjectEnvImportResult {
  projectId: number;
  environment: Environment;
  sourcePath: string;
  imported: number;
  updated: number;
  assigned: number;
  unchanged: number;
  skipped: number;
}

export interface RequiredKeyOccurrence {
  keyName: string;
  sourceFile: string;
  line: number;
  detectionMethod: 'dotenv' | 'docker-compose' | 'typescript' | 'python';
}

export interface ProjectSyncedSecret {
  keyName: string;
  providerId: string | null;
  environment: Environment;
  sourceFile: string;
  keyPrefix: string | null;
  status: 'imported' | 'updated' | 'assigned' | 'unchanged' | 'unmapped';
}

export interface ProjectRepoSyncSummary {
  imported: number;
  updated: number;
  assigned: number;
  unchanged: number;
  unmapped: number;
}

export interface ProjectIntelligence {
  projectId: number;
  scannedAt: string;
  repoPath: string | null;
  scannedFiles: string[];
  requiredKeys: string[];
  missingKeys: string[];
  unusedKeys: string[];
  duplicateKeys: Array<{
    keyName: string;
    projectIds: number[];
  }>;
  occurrences: RequiredKeyOccurrence[];
  syncedSecrets: ProjectSyncedSecret[];
  syncSummary: ProjectRepoSyncSummary;
  warnings: string[];
}

export interface EnvExportDiffEntry {
  key: string;
  vaultValue: string;
  existingValue: string | null;
  status: 'new' | 'changed' | 'unchanged';
}

export interface ProjectEnvExportPlan {
  projectId: number;
  environment: Environment;
  targetPath: string;
  entries: EnvExportDiffEntry[];
  warnings: string[];
}

export interface LeakRiskFinding {
  type: 'stripe-secret' | 'generic-api-key' | 'token-pattern' | 'possible-commit';
  message: string;
  file: string;
  line: number;
  snippet: string;
}

export interface ProjectLeakRiskReport {
  projectId: number;
  scannedAt: string;
  findings: LeakRiskFinding[];
  warnings: string[];
}
