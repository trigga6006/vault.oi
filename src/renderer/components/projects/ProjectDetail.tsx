import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, FileUp, MoreHorizontal, Plus, RefreshCw, ShieldAlert, Trash2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { EnvironmentBadge } from './EnvironmentBadge';
import { ProjectEnvImportDialog } from './ProjectEnvImportDialog';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { DropdownSelect, type DropdownOption } from '../ui/DropdownSelect';
import { useUiStore } from '../../store/ui-store';
import type {
  Environment,
  ProjectEnvExportPlan,
  ProjectIntelligence,
  ProjectKeyAssignment,
  ProjectLeakRiskReport,
  ProjectRecord,
} from '../../../shared/types/project.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';

interface ProjectDetailProps {
  project: ProjectRecord;
  onBack: () => void;
}

interface ActiveSecretMenuState {
  id: string;
  left: number;
  top: number;
}

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const { openGraph } = useUiStore();
  const [assignments, setAssignments] = useState<ProjectKeyAssignment[]>([]);
  const [allKeys, setAllKeys] = useState<ApiKeyMetadata[]>([]);
  const [addingEnv, setAddingEnv] = useState<Environment | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [intelligence, setIntelligence] = useState<ProjectIntelligence | null>(null);
  const [scanning, setScanning] = useState(false);

  const [exportEnvironment, setExportEnvironment] = useState<Environment>('dev');
  const [exportPlan, setExportPlan] = useState<ProjectEnvExportPlan | null>(null);
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>([]);
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const [loadingExportPlan, setLoadingExportPlan] = useState(false);
  const [expandedEnvironments, setExpandedEnvironments] = useState<Environment[]>([]);
  const [activeSecretMenu, setActiveSecretMenu] = useState<ActiveSecretMenuState | null>(null);
  const [showEnvImport, setShowEnvImport] = useState(false);

  const [leakReport, setLeakReport] = useState<ProjectLeakRiskReport | null>(null);
  const [scanningLeakRisk, setScanningLeakRisk] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke('projects:get-keys', {
        projectId: project.id,
      })) as ProjectKeyAssignment[];
      setAssignments(result);
    } catch {
      toast.error('Failed to load workspace assignments');
    }
  }, [project.id]);

  const fetchKeys = useCallback(async () => {
    try {
      const result = (await window.omniview.invoke(
        'keys:list',
        undefined,
      )) as ApiKeyMetadata[];
      setAllKeys(result);
    } catch {
      toast.error('Failed to load secrets');
    }
  }, []);

  const fetchIntelligence = useCallback(async () => {
    setScanning(true);
    try {
      const result = (await window.omniview.invoke('projects:scan-intelligence', {
        projectId: project.id,
      })) as ProjectIntelligence;
      setIntelligence(result);
    } catch {
      toast.error('Failed to scan repository config files');
    } finally {
      setScanning(false);
    }
  }, [project.id]);

  const fetchExportPlan = useCallback(async () => {
    setLoadingExportPlan(true);
    try {
      const result = (await window.omniview.invoke('projects:get-env-export-plan', {
        projectId: project.id,
        environment: exportEnvironment,
      })) as ProjectEnvExportPlan;
      setExportPlan(result);
      setSelectedExportKeys([]);
    } catch {
      toast.error('Failed to generate .env export diff');
    } finally {
      setLoadingExportPlan(false);
    }
  }, [exportEnvironment, project.id]);

  const fetchLeakRisk = useCallback(async () => {
    setScanningLeakRisk(true);
    try {
      const result = (await window.omniview.invoke('projects:scan-leak-risk', {
        projectId: project.id,
      })) as ProjectLeakRiskReport;
      setLeakReport(result);
    } catch {
      toast.error('Failed to run leak-risk scanner');
    } finally {
      setScanningLeakRisk(false);
    }
  }, [project.id]);

  const refreshWorkspaceData = useCallback(async () => {
    await Promise.all([
      fetchAssignments(),
      fetchKeys(),
      fetchExportPlan(),
    ]);
  }, [fetchAssignments, fetchExportPlan, fetchKeys]);

  const handleScanAndSync = useCallback(async () => {
    await fetchIntelligence();
    await refreshWorkspaceData();
  }, [fetchIntelligence, refreshWorkspaceData]);

  const pickEnvFile = useCallback(async () => {
    const result = await window.omniview.invoke('projects:pick-env-file', undefined) as { path: string | null };
    return result.path;
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchKeys();
    fetchIntelligence();
    fetchExportPlan();
    fetchLeakRisk();
  }, [fetchAssignments, fetchExportPlan, fetchIntelligence, fetchKeys, fetchLeakRisk]);

  useEffect(() => {
    if (!activeSecretMenu) return undefined;

    const closeMenu = () => setActiveSecretMenu(null);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [activeSecretMenu]);

  async function handleAssign(env: Environment) {
    if (!selectedKeyId) return;
    try {
      await window.omniview.invoke('projects:assign-key', {
        projectId: project.id,
        apiKeyId: selectedKeyId,
        environment: env,
        isPrimary: true,
      });
      toast.success('Secret assigned');
      setAddingEnv(null);
      setSelectedKeyId(null);
      await fetchAssignments();
      await fetchIntelligence();
      await fetchExportPlan();
    } catch {
      toast.error('Failed to assign secret');
    }
  }

  async function handleUnassign(assignment: ProjectKeyAssignment) {
    try {
      await window.omniview.invoke('projects:unassign-key', {
        projectId: project.id,
        apiKeyId: assignment.apiKeyId,
        environment: assignment.environment,
      });
      toast.success('Secret removed');
      await fetchAssignments();
      await fetchIntelligence();
      await fetchExportPlan();
    } catch {
      toast.error('Failed to remove secret');
    }
  }

  async function handleExportEnv() {
    if (!exportPlan) return;
    try {
      const result = await window.omniview.invoke('projects:export-env-safe', {
        projectId: project.id,
        environment: exportEnvironment,
        selectedKeys: selectedExportKeys,
        overwriteConflicts,
      });
      toast.success(`Exported ${result.exported} key(s) to ${result.path}`);
      await fetchExportPlan();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    }
  }

  function toggleSelectedKey(key: string, checked: boolean) {
    setSelectedExportKeys((current) => {
      if (checked) return Array.from(new Set([...current, key]));
      return current.filter((item) => item !== key);
    });
  }

  async function handleImportEnv(data: {
    envFilePath: string;
    environment: Environment;
  }) {
    try {
      const result = await window.omniview.invoke('projects:import-env', {
        projectId: project.id,
        envFilePath: data.envFilePath,
        environment: data.environment,
      });
      toast.success(
        `Imported ${result.imported + result.updated} value${result.imported + result.updated === 1 ? '' : 's'} and assigned ${result.assigned} to ${data.environment}.`,
      );
      setShowEnvImport(false);
      await refreshWorkspaceData();
      await fetchIntelligence();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import .env');
    }
  }

  function toggleEnvironmentCard(environment: Environment) {
    setExpandedEnvironments((current) => (
      current.includes(environment)
        ? current.filter((item) => item !== environment)
        : [...current, environment]
    ));
  }

  function getSecretMenuId(secret: ProjectIntelligence['syncedSecrets'][number]) {
    return `${secret.keyName}:${secret.providerId ?? 'unmapped'}:${secret.sourceFile}`;
  }

  function resolveImportedSecretKey(secret: ProjectIntelligence['syncedSecrets'][number]) {
    if (!secret.providerId) return null;

    return allKeys.find(
      (key) =>
        key.providerId === secret.providerId
        && key.keyLabel.trim().toUpperCase() === secret.keyName.trim().toUpperCase(),
    ) ?? null;
  }

  function getAssignedEnvironmentsForKey(apiKeyId: number): Environment[] {
    return assignments
      .filter((assignment) => assignment.apiKeyId === apiKeyId)
      .map((assignment) => assignment.environment);
  }

  async function handleAssignDiscoveredSecret(
    secret: ProjectIntelligence['syncedSecrets'][number],
    environment: Environment,
  ) {
    const matchingKey = resolveImportedSecretKey(secret);
    if (!matchingKey || !secret.providerId) {
      toast.error('This repo secret is not importable yet');
      return;
    }

    const alreadyAssigned = assignments.some(
      (assignment) => assignment.apiKeyId === matchingKey.id && assignment.environment === environment,
    );
    if (alreadyAssigned) {
      const existingAssignment = assignments.find(
        (assignment) => assignment.apiKeyId === matchingKey.id && assignment.environment === environment,
      );
      if (!existingAssignment) {
        setActiveSecretMenu(null);
        return;
      }

      try {
        await window.omniview.invoke('projects:unassign-key', {
          projectId: project.id,
          apiKeyId: matchingKey.id,
          environment,
        });
        toast.success(`Removed ${secret.keyName} from ${environment}`);
        setActiveSecretMenu(null);
        await refreshWorkspaceData();
        await fetchIntelligence();
      } catch {
        toast.error('Failed to remove repo secret assignment');
      }

      return;
    }

    if (!matchingKey || !secret.providerId) {
      setActiveSecretMenu(null);
      return;
    }

    const hasPrimaryForProvider = assignments.some((assignment) => {
      if (assignment.environment !== environment) return false;
      const key = allKeys.find((item) => item.id === assignment.apiKeyId);
      return key?.providerId === secret.providerId && assignment.isPrimary;
    });

    try {
      await window.omniview.invoke('projects:assign-key', {
        projectId: project.id,
        apiKeyId: matchingKey.id,
        environment,
        isPrimary: !hasPrimaryForProvider,
      });
      toast.success(`Assigned ${secret.keyName} to ${environment}`);
      setActiveSecretMenu(null);
      await refreshWorkspaceData();
      await fetchIntelligence();
    } catch {
      toast.error('Failed to assign repo secret');
    }
  }

  const environments: Environment[] = ['dev', 'staging', 'prod'];
  const environmentOptions: DropdownOption[] = [
    { value: 'dev', label: 'Development', description: 'Local and day-to-day work.' },
    { value: 'staging', label: 'Staging', description: 'Pre-production validation.' },
    { value: 'prod', label: 'Production', description: 'Live deployment secrets.' },
  ];
  const assignableKeyOptions = useMemo<DropdownOption[]>(
    () => [
      {
        value: '',
        label: 'Select a secret',
        description: 'Choose a vault secret to assign to this environment.',
      },
      ...allKeys.map((key) => ({
        value: String(key.id),
        label: key.keyLabel,
        description: `${key.providerId} - ${key.keyPrefix}...`,
        icon: <SecretIdentityIcon providerId={key.providerId} keyName={key.keyLabel} size={16} />,
      })),
    ],
    [allKeys],
  );

  const activeSecretMenuSecret = activeSecretMenu && intelligence
    ? intelligence.syncedSecrets.find((secret) => getSecretMenuId(secret) === activeSecretMenu.id) ?? null
    : null;
  const activeSecretMenuKey = activeSecretMenuSecret
    ? resolveImportedSecretKey(activeSecretMenuSecret)
    : null;
  const activeSecretMenuAssignments = activeSecretMenuKey
    ? getAssignedEnvironmentsForKey(activeSecretMenuKey.id)
    : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {project.name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Environment-specific secret assignments for this workspace.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openGraph({ type: 'workspace', id: project.id })}
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-primary/14"
          >
            <Workflow className="h-4 w-4" />
            View graph
          </button>
          <button
            type="button"
            onClick={() => setShowEnvImport(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-white/[0.08]"
          >
            <FileUp className="h-4 w-4" />
            Import .env
          </button>
        </div>
      </div>

      {project.description && (
        <p className="text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
      )}

      {showEnvImport && (
        <ProjectEnvImportDialog
          mode="import"
          project={project}
          onCancel={() => setShowEnvImport(false)}
          onPickFile={pickEnvFile}
          onImport={handleImportEnv}
        />
      )}

      <section className="glass rounded-[24px] border border-white/8 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">.env diff + safe export mode</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Compare Vault values with your existing .env, choose specific keys, and export safely.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownSelect
              value={exportEnvironment}
              onChange={(value) => setExportEnvironment(value as Environment)}
              options={environmentOptions}
              className="min-w-[13rem]"
              align="right"
            />
            <button
              onClick={fetchExportPlan}
              disabled={loadingExportPlan}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground hover:bg-accent disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${loadingExportPlan ? 'animate-spin' : ''}`} />
              {loadingExportPlan ? 'Loading...' : 'Refresh diff'}
            </button>
          </div>
        </div>

        {exportPlan && (
          <div className="space-y-3 text-xs">
            <p className="text-muted-foreground">Target: {exportPlan.targetPath}</p>
            {exportPlan.warnings.map((warning) => (
              <p key={warning} className="text-amber-300">• {warning}</p>
            ))}

            <div className="max-h-56 overflow-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="p-2">Export</th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Vault</th>
                    <th className="p-2">.env</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exportPlan.entries.map((entry) => (
                    <tr key={entry.key} className="border-t border-border/50">
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedExportKeys.includes(entry.key)}
                          onChange={(e) => toggleSelectedKey(entry.key, e.target.checked)}
                        />
                      </td>
                      <td className="p-2 align-top">{entry.key}</td>
                      <td className="p-2 align-top font-mono text-[11px]">••••••••</td>
                      <td className="p-2 align-top font-mono text-[11px]">
                        {entry.existingValue === null ? '(missing)' : '••••••••'}
                      </td>
                      <td className="p-2 align-top">
                        <span className={
                          entry.status === 'changed'
                            ? 'text-amber-300'
                            : entry.status === 'new'
                              ? 'text-emerald-300'
                              : 'text-muted-foreground'
                        }
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={overwriteConflicts}
                onChange={(e) => setOverwriteConflicts(e.target.checked)}
              />
              Allow overwrite for keys marked as changed
            </label>

            <button
              onClick={handleExportEnv}
              disabled={selectedExportKeys.length === 0}
              className="rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-60"
            >
              Export selected keys
            </button>
          </div>
        )}
      </section>

      <section className="glass rounded-[24px] border border-white/8 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Leak risk scanner (local only)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scans repository files for hardcoded token patterns and possible accidental secret commits.
            </p>
          </div>
          <button
            onClick={fetchLeakRisk}
            disabled={scanningLeakRisk}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground hover:bg-accent disabled:opacity-60"
          >
            <ShieldAlert className={`h-3 w-3 ${scanningLeakRisk ? 'animate-pulse' : ''}`} />
            {scanningLeakRisk ? 'Scanning...' : 'Scan leak risk'}
          </button>
        </div>

        {leakReport && (
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">Findings: {leakReport.findings.length}</p>
            {leakReport.warnings.map((warning) => (
              <p key={warning} className="text-amber-300">• {warning}</p>
            ))}
            {leakReport.findings.length === 0 ? (
              <p className="text-emerald-300">No obvious leak patterns detected.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-auto">
                {leakReport.findings.map((finding, index) => (
                  <div key={`${finding.file}-${finding.line}-${index}`} className="rounded-xl border border-destructive/30 bg-destructive/10 p-2">
                    <p className="text-foreground">{finding.message}</p>
                    <p className="text-muted-foreground">{finding.file}:{finding.line}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="glass rounded-[24px] border border-white/8 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Repository key intelligence</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scan linked repo files for env references, then sync discovered repo secrets into this workspace.
            </p>
          </div>
          <button
            onClick={handleScanAndSync}
            disabled={scanning}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan + sync'}
          </button>
        </div>

        {intelligence && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>Scanned {intelligence.scannedFiles.length} file(s)</span>
              <span>|</span>
              <span>{new Date(intelligence.scannedAt).toLocaleString()}</span>
              {intelligence.repoPath && (
                <>
                  <span>|</span>
                  <span className="truncate max-w-[26rem]">{intelligence.repoPath}</span>
                </>
              )}
            </div>

            {intelligence.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 space-y-1">
                {intelligence.warnings.map((warning) => (
                  <p key={warning}>* {warning}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Repo secrets synced</p>
                <p className="text-lg font-semibold text-foreground">
                  {intelligence.syncedSecrets.filter((secret) => secret.status !== 'unmapped').length}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {intelligence.syncSummary.imported} new, {intelligence.syncSummary.updated} updated, {intelligence.syncSummary.unchanged} unchanged
                </p>
              </div>

              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Missing keys</p>
                {intelligence.missingKeys.length === 0 ? (
                  <p className="text-emerald-300">None</p>
                ) : (
                  <ul className="space-y-1 text-foreground">
                    {intelligence.missingKeys.map((key) => (
                      <li key={key}>{key}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Unused assigned keys</p>
                {intelligence.unusedKeys.length === 0 ? (
                  <p className="text-emerald-300">None</p>
                ) : (
                  <ul className="space-y-1 text-foreground">
                    {intelligence.unusedKeys.map((key) => (
                      <li key={key}>{key}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Duplicate keys across projects</p>
                {intelligence.duplicateKeys.length === 0 ? (
                  <p className="text-emerald-300">None</p>
                ) : (
                  <ul className="space-y-1 text-foreground">
                    {intelligence.duplicateKeys.map((entry) => (
                      <li key={entry.keyName}>
                        {entry.keyName} ({entry.projectIds.length} projects)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Unmapped repo values</p>
                {intelligence.syncSummary.unmapped === 0 ? (
                  <p className="text-emerald-300">None</p>
                ) : (
                  <p className="text-foreground">{intelligence.syncSummary.unmapped}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Discovered repo secrets</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Values found in repo files are imported into the vault and attached to this workspace when possible.
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {intelligence.syncedSecrets.length} item(s)
                </p>
              </div>

              {intelligence.syncedSecrets.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No importable secret values were found in the linked repository files.
                </p>
              ) : (
                <div className="mt-3 space-y-2 max-h-60 overflow-auto">
                  {intelligence.syncedSecrets.map((secret) => {
                    const menuId = getSecretMenuId(secret);
                    const importedKey = resolveImportedSecretKey(secret);
                    const assignedEnvironments = importedKey
                      ? getAssignedEnvironmentsForKey(importedKey.id)
                      : [];

                    return (
                      <div
                        key={`${secret.environment}:${secret.keyName}:${secret.sourceFile}`}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/8 bg-background/30 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <SecretIdentityIcon providerId={secret.providerId} keyName={secret.keyName} size={18} />
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {secret.keyName}
                              {secret.providerId && (
                                <span className="ml-2 text-[11px] text-muted-foreground">{secret.providerId}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {secret.sourceFile} | {secret.environment}
                              {secret.keyPrefix && (
                                <span className="ml-2 font-mono text-foreground">{secret.keyPrefix}...****</span>
                              )}
                            </p>
                            {assignedEnvironments.length > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Assigned to: {assignedEnvironments.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="relative flex items-center gap-2">
                          <span
                            className={
                              secret.status === 'unmapped'
                                ? 'rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200'
                                : secret.status === 'updated'
                                  ? 'rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-sky-200'
                                  : secret.status === 'unchanged'
                                    ? 'rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground'
                                    : 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-200'
                            }
                          >
                            {secret.status}
                          </span>

                          <button
                            type="button"
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setActiveSecretMenu((current) => (
                                current?.id === menuId
                                  ? null
                                  : {
                                    id: menuId,
                                    top: rect.bottom + 8,
                                    left: Math.max(12, rect.right - 176),
                                  }
                              ));
                            }}
                            disabled={!importedKey}
                            className="rounded-lg border border-border bg-secondary/30 p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            title={importedKey ? 'Assign to environment' : 'Unavailable until imported'}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {environments.map((env) => {
        const envAssignments = assignments.filter((item) => item.environment === env);
        const isExpanded = expandedEnvironments.includes(env);
        return (
          <section
            key={env}
            className="glass rounded-[24px] border border-white/8 p-4 space-y-3"
          >
            <button
              type="button"
              onClick={() => toggleEnvironmentCard(env)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3">
                <EnvironmentBadge environment={env} className="text-xs" />
                <span className="text-xs text-muted-foreground">
                  {envAssignments.length === 0
                    ? 'No assigned secrets'
                    : `${envAssignments.length} assigned secret${envAssignments.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAddingEnv(env);
                    if (!isExpanded) {
                      toggleEnvironmentCard(env);
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Assign secret
                </button>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {addingEnv === env && (
              <div className="flex items-center gap-2 rounded-2xl bg-secondary/30 p-2">
                <div className="flex-1">
                  <DropdownSelect
                    value={selectedKeyId ? String(selectedKeyId) : ''}
                    onChange={(value) => setSelectedKeyId(value ? Number(value) : null)}
                    options={assignableKeyOptions}
                    placeholder="Select a secret"
                    menuClassName="max-w-[28rem]"
                  />
                </div>
                <button
                  onClick={() => handleAssign(env)}
                  disabled={!selectedKeyId}
                  className="rounded-xl bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Assign
                </button>
                <button
                  onClick={() => {
                    setAddingEnv(null);
                    setSelectedKeyId(null);
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}

            {isExpanded ? (
              <div className="space-y-2">
                {envAssignments.length === 0 && addingEnv !== env ? (
                  <p className="text-xs text-muted-foreground/70">
                    No secrets assigned.
                  </p>
                ) : (
                  envAssignments.map((assignment) => {
                    const keyMeta = allKeys.find(
                      (key) => key.id === assignment.apiKeyId,
                    );

                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded-2xl bg-secondary/20 px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-xs text-foreground">
                          <SecretIdentityIcon providerId={keyMeta?.providerId} keyName={keyMeta?.keyLabel} size={16} />
                          <span>
                            {keyMeta?.providerId ?? '?'} - {keyMeta?.keyLabel ?? '?'}{' '}
                            <span className="text-muted-foreground">
                              ({keyMeta?.keyPrefix ?? '****'}...)
                            </span>
                            {assignment.isPrimary && (
                              <span className="ml-1.5 text-[10px] text-primary">
                                Primary
                              </span>
                            )}
                          </span>
                        </span>
                        <button
                          onClick={() => handleUnassign(assignment)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      {activeSecretMenu && activeSecretMenuSecret && activeSecretMenuKey && (
        <>
          <button
            type="button"
            aria-label="Close repo secret assignment menu"
            onClick={() => setActiveSecretMenu(null)}
            className="fixed inset-0 z-20 cursor-default bg-transparent"
          />
          <div
            className="fixed z-30 w-44 rounded-xl border border-border bg-card p-2 shadow-lg"
            style={{
              top: activeSecretMenu.top,
              left: activeSecretMenu.left,
            }}
          >
            <p className="px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Assign to
            </p>
            <div className="mt-1 space-y-1">
              {environments.map((environment) => {
                const isAssigned = activeSecretMenuAssignments.includes(environment);
                return (
                  <button
                    key={environment}
                    type="button"
                    onClick={() => handleAssignDiscoveredSecret(activeSecretMenuSecret, environment)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <span>{environment}</span>
                    {isAssigned && (
                      <span className="text-[10px] text-primary">Assigned</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
