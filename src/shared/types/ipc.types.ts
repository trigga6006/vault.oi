import type { ProviderRegistrySummary, ActivatePayload, HealthCheckResult, ModelDescriptor, UsageFetchParams, UsageData, CompletionRequest, CompletionResponse } from './provider.types';
import type { ProviderConfigRecord, AlertRuleRecord, AlertEventRecord, RequestLogRecord, ErrorRecordRow, UsageMetricRecord } from './models.types';
import type { TokenUsage, CalculatedCost } from './pricing.types';
import type { VaultStatus, ApiKeyMetadata, StoreKeyPayload, RotateKeyPayload, UpdateKeyPayload, TestKeyPayload, VaultInitPayload, VaultUnlockPayload, VaultChangePasswordPayload, VaultAutoLockPayload, SecretsImportResult } from './vault.types';
import type { ProjectRecord, ProjectKeyAssignment, CreateProjectPayload, UpdateProjectPayload, AssignKeyPayload, UnassignKeyPayload, SetActiveProjectPayload, ProjectIntelligence, ProjectEnvExportPlan, ProjectLeakRiskReport, Environment } from './project.types';
import type { CredentialRecord, CreateCredentialPayload, UpdateCredentialPayload } from './credentials.types';
import type { VaultProfile, VaultProfileState, CreateVaultProfilePayload, SwitchVaultProfilePayload } from './profile.types';

export interface MetricsQuery {
  providerId?: string;
  model?: string;
  startDate: string;
  endDate: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface MetricsSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  errorRate: number;
  providerBreakdown: Array<{
    providerId: string;
    requestCount: number;
    costUsd: number;
    tokenCount: number;
  }>;
}

export interface MetricsSummaryQuery {
  startDate: string;
  endDate: string;
  providerId?: string;
}

export interface LogQuery {
  providerId?: string;
  model?: string;
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface ErrorLogQuery {
  providerId?: string;
  errorCode?: string;
  limit?: number;
  offset?: number;
}

export interface ProxyStatus {
  running: boolean;
  port: number | null;
  requestCount: number;
  upSince: string | null;
}

export interface IpcChannelMap {
  'provider:list-registered': { req: void; res: ProviderRegistrySummary[] };
  'provider:activate': { req: ActivatePayload; res: { success: boolean } };
  'provider:deactivate': { req: { providerId: string }; res: { success: boolean } };
  'provider:health-check': { req: { providerId: string }; res: HealthCheckResult };
  'provider:list-models': { req: { providerId: string }; res: ModelDescriptor[] };

  'usage:fetch': { req: { providerId: string; params: UsageFetchParams }; res: UsageData };
  'usage:fetch-all': { req: UsageFetchParams; res: UsageData[] };

  'completion:send': { req: CompletionRequest; res: CompletionResponse };
  'completion:stream-start': { req: CompletionRequest; res: { streamId: string } };

  'metrics:query': { req: MetricsQuery; res: UsageMetricRecord[] };
  'metrics:summary': { req: MetricsSummaryQuery; res: MetricsSummary };

  'logs:query': { req: LogQuery; res: RequestLogRecord[] };
  'logs:errors': { req: ErrorLogQuery; res: ErrorRecordRow[] };

  'alerts:list-rules': { req: void; res: AlertRuleRecord[] };
  'alerts:save-rule': { req: AlertRuleRecord; res: void };
  'alerts:list-events': { req: { ruleId?: number; limit?: number }; res: AlertEventRecord[] };

  'proxy:start': { req: { port: number }; res: { success: boolean } };
  'proxy:stop': { req: void; res: void };
  'proxy:status': { req: void; res: ProxyStatus };

  'config:get-provider': { req: { providerId: string }; res: ProviderConfigRecord | null };
  'config:save-provider': { req: ProviderConfigRecord; res: void };
  'config:list-providers': { req: void; res: ProviderConfigRecord[] };

  'pricing:calculate': { req: { providerId: string; modelId: string; usage: TokenUsage }; res: CalculatedCost };

  // Vault
  'vault:status': { req: void; res: VaultStatus };
  'vault:initialize': { req: VaultInitPayload; res: { success: boolean } };
  'vault:unlock': { req: VaultUnlockPayload; res: { success: boolean } };
  'vault:lock': { req: void; res: void };
  'vault:change-password': { req: VaultChangePasswordPayload; res: { success: boolean } };
  'vault:set-auto-lock': { req: VaultAutoLockPayload; res: void };
  'vault:export': { req: void; res: { success: boolean } };
  'vault:import': { req: void; res: { imported: number } };
  'vault:import-secrets': { req: void; res: SecretsImportResult };

  // Keys
  'keys:list': { req: void; res: ApiKeyMetadata[] };
  'keys:store': { req: StoreKeyPayload; res: ApiKeyMetadata };
  'keys:update': { req: UpdateKeyPayload; res: void };
  'keys:rotate': { req: RotateKeyPayload; res: void };
  'keys:delete': { req: { id: number }; res: void };
  'keys:test': { req: TestKeyPayload; res: { success: boolean; message?: string } };
  'keys:get-plaintext': { req: { id: number }; res: { secret: string } };

  // Projects
  'projects:list': { req: void; res: ProjectRecord[] };
  'projects:get': { req: { id: number }; res: ProjectRecord | null };
  'projects:create': { req: CreateProjectPayload; res: ProjectRecord };
  'projects:update': { req: UpdateProjectPayload; res: void };
  'projects:delete': { req: { id: number }; res: void };
  'projects:assign-key': { req: AssignKeyPayload; res: void };
  'projects:unassign-key': { req: UnassignKeyPayload; res: void };
  'projects:get-keys': { req: { projectId: number }; res: ProjectKeyAssignment[] };
  'projects:set-active': { req: SetActiveProjectPayload; res: { projectId: number | null } };
  'projects:scan-intelligence': { req: { projectId: number }; res: ProjectIntelligence };
  'projects:get-env-export-plan': { req: { projectId: number; environment: Environment }; res: ProjectEnvExportPlan };
  'projects:export-env-safe': { req: { projectId: number; environment: Environment; selectedKeys: string[]; overwriteConflicts: boolean }; res: { exported: number; path: string } };
  'projects:scan-leak-risk': { req: { projectId: number }; res: ProjectLeakRiskReport };


  // Vault profiles
  'profiles:get-state': { req: void; res: VaultProfileState };
  'profiles:create': { req: CreateVaultProfilePayload; res: VaultProfile };
  'profiles:switch': { req: SwitchVaultProfilePayload; res: { success: boolean } };


  // Credentials
  'credentials:list': { req: void; res: CredentialRecord[] };
  'credentials:create': { req: CreateCredentialPayload; res: CredentialRecord };
  'credentials:update': { req: UpdateCredentialPayload; res: void };
  'credentials:delete': { req: { id: number }; res: void };
  'credentials:get-password': { req: { id: number }; res: { password: string } };
  'credentials:generate-password': { req: { length?: number }; res: { password: string } };

  // Key rotation
  'keys:rotation-policies': { req: void; res: Array<{ id: number; projectId: number | null; providerId: string; rotationIntervalDays: number; reminderDaysBefore: number; enabled: boolean }> };
  'keys:set-rotation-policy': { req: { providerId: string; projectId?: number; rotationIntervalDays: number; reminderDaysBefore: number; enabled: boolean }; res: void };
  'keys:check-rotations': { req: void; res: Array<{ keyId: number; providerId: string; keyLabel: string; ageDays: number; policyDays: number }> };

  // Pricing updates
  'pricing:check-updates': { req: void; res: { checked: boolean; added: number; lastCheck: string } };
  'pricing:apply-updates': { req: void; res: { checked: boolean; added: number; lastCheck: string } };
  'pricing:set-auto-update': { req: { enabled: boolean }; res: void };
}

export type IpcChannel = keyof IpcChannelMap;

export type IpcEventChannel = 'vault:locked' | 'key:rotation-reminder';
