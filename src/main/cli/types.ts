import type { ApiKeyMetadata, VaultStatus } from '../../shared/types/vault.types';
import type { VaultProfileState } from '../../shared/types/profile.types';
import type { CredentialRecord } from '../../shared/types/credentials.types';
import type {
  Environment,
  ProjectEnvImportResult,
  ProjectKeyAssignment,
  ProjectRecord,
} from '../../shared/types/project.types';

export interface CliServices {
  getVaultStatus: () => Promise<VaultStatus>;
  initializeVault: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => Promise<void>;
  setVaultAutoLock: (minutes: number) => Promise<void>;
  getProfileState: () => Promise<VaultProfileState>;
  createProfile: (name: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  listKeys: () => Promise<ApiKeyMetadata[]>;
  storeKey: (input: {
    providerId: string;
    apiKey: string;
    label?: string;
    notes?: string;
    serviceType?: string;
    generatedWhere?: string;
    expiresAt?: string;
  }) => Promise<ApiKeyMetadata>;
  updateKey: (id: number, data: {
    label?: string;
    notes?: string;
    isActive?: boolean;
    serviceType?: string;
    generatedWhere?: string;
    expiresAt?: string | null;
    lastVerifiedAt?: string;
  }) => Promise<void>;
  markKeyVerified: (id: number) => Promise<void>;
  rotateKey: (id: number, newKey: string) => Promise<void>;
  deleteKey: (id: number) => Promise<void>;
  revealKey: (id: number) => Promise<string>;
  listCredentials: () => Promise<CredentialRecord[]>;
  createCredential: (input: {
    title: string;
    providerId?: string | null;
    projectId?: number | null;
    username: string;
    password: string;
    notes?: string;
  }) => Promise<CredentialRecord>;
  updateCredential: (input: {
    id: number;
    title?: string;
    providerId?: string | null;
    projectId?: number | null;
    username?: string;
    password?: string;
    notes?: string;
  }) => Promise<void>;
  deleteCredential: (id: number) => Promise<void>;
  revealCredentialPassword: (id: number) => Promise<string>;
  generateCredentialPassword: (length?: number) => string;
  listProjects: () => Promise<ProjectRecord[]>;
  createProject: (input: {
    name: string;
    description?: string;
    color?: string;
    gitRepoPath?: string;
    isDefault?: boolean;
  }) => Promise<ProjectRecord>;
  updateProject: (id: number, input: {
    name?: string;
    description?: string | null;
    color?: string;
    gitRepoPath?: string | null;
    isDefault?: boolean;
  }) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  listProjectAssignments: (projectId: number) => Promise<ProjectKeyAssignment[]>;
  assignProjectKey: (
    projectId: number,
    apiKeyId: number,
    environment: Environment,
    isPrimary?: boolean,
  ) => Promise<void>;
  unassignProjectKey: (
    projectId: number,
    apiKeyId: number,
    environment: Environment,
  ) => Promise<void>;
  importProjectEnv: (input: {
    projectId: number;
    envFilePath: string;
    environment: Environment;
  }) => Promise<ProjectEnvImportResult>;
}

export interface CliCommand {
  path: string[];
  summary: string;
  usage: string;
  examples?: string[];
  run: (context: CliContext, args: string[]) => Promise<number>;
}

export interface CliContext {
  argv: string[];
  appVersion: string;
  commands: readonly CliCommand[];
  services: CliServices;
  print: (line?: string) => void;
  error: (line: string) => void;
  promptLine: (label: string) => Promise<string>;
  promptSecret: (label: string) => Promise<string>;
}
