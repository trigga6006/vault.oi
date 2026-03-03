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

export interface RequiredKeyOccurrence {
  keyName: string;
  sourceFile: string;
  line: number;
  detectionMethod: 'dotenv' | 'docker-compose' | 'typescript' | 'python';
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
  warnings: string[];
}
