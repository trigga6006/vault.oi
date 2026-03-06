import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { KeyForm } from './KeyForm';
import { cn } from '../ui/cn';
import { DropdownSelect } from '../ui/DropdownSelect';
import type { ProjectKeyAssignment, ProjectRecord } from '../../../shared/types/project.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import { PROVIDER_NAME_BY_ID } from '../../../shared/constants/provider-catalog';
import { useUiStore } from '../../store/ui-store';

const PROVIDER_NAMES: Record<string, string> = {
  ...PROVIDER_NAME_BY_ID,
  app: 'App Secret',
  config: 'Config Value',
};

const CLIPBOARD_CLEAR_SECONDS = 20;

type SortMode = 'updated-desc' | 'alphabetical' | 'provider' | 'recently-used';

const CARD_SPRING = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
  mass: 0.9,
} as const;

const PANEL_EASE = [0.22, 1, 0.36, 1] as const;

interface KeyAssignmentSummary {
  projectId: number;
  projectName: string;
  color: string;
  environment: ProjectKeyAssignment['environment'];
  isPrimary: boolean;
}

interface KeyListItem {
  key: ApiKeyMetadata;
  providerName: string;
  assignments: KeyAssignmentSummary[];
}

export function KeyVault() {
  const { openGraph } = useUiStore();
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [assignmentsByKeyId, setAssignmentsByKeyId] = useState<Record<number, KeyAssignmentSummary[]>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');
  const [expandedKeyIds, setExpandedKeyIds] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<{
    id: number;
    providerId: string;
  } | null>(null);
  const [revealTarget, setRevealTarget] = useState<ApiKeyMetadata | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(false);

  const loadVaultContext = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedKeys, loadedProjects] = await Promise.all([
        window.omniview.invoke('keys:list', undefined) as Promise<ApiKeyMetadata[]>,
        window.omniview.invoke('projects:list', undefined) as Promise<ProjectRecord[]>,
      ]);

      const assignmentGroups = await Promise.all(
        loadedProjects.map(async (project) => ({
          project,
          assignments: await window.omniview.invoke('projects:get-keys', {
            projectId: project.id,
          }) as ProjectKeyAssignment[],
        })),
      );

      const nextAssignmentsByKeyId: Record<number, KeyAssignmentSummary[]> = {};
      assignmentGroups.forEach(({ project, assignments }) => {
        assignments.forEach((assignment) => {
          if (!nextAssignmentsByKeyId[assignment.apiKeyId]) {
            nextAssignmentsByKeyId[assignment.apiKeyId] = [];
          }

          nextAssignmentsByKeyId[assignment.apiKeyId].push({
            projectId: project.id,
            projectName: project.name,
            color: project.color,
            environment: assignment.environment,
            isPrimary: assignment.isPrimary,
          });
        });
      });

      Object.values(nextAssignmentsByKeyId).forEach((items) => {
        items.sort((a, b) => {
          if (a.projectName === b.projectName) {
            if (a.environment === b.environment) {
              return Number(b.isPrimary) - Number(a.isPrimary);
            }
            return a.environment.localeCompare(b.environment);
          }
          return a.projectName.localeCompare(b.projectName);
        });
      });

      setKeys(loadedKeys);
      setProjects(loadedProjects);
      setAssignmentsByKeyId(nextAssignmentsByKeyId);
      setExpandedKeyIds((current) => current.filter((id) => loadedKeys.some((key) => key.id === id)));
    } catch {
      toast.error('Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVaultContext();
  }, [loadVaultContext]);

  async function handleSave(data: {
    providerId: string;
    apiKey: string;
    label: string;
    notes: string;
    serviceType: string;
    generatedWhere: string;
    expiresAt: string;
  }) {
    try {
      await window.omniview.invoke('keys:store', {
        providerId: data.providerId,
        apiKey: data.apiKey,
        label: data.label,
        notes: data.notes,
        serviceType: data.serviceType,
        generatedWhere: data.generatedWhere,
        expiresAt: data.expiresAt || undefined,
      });
      toast.success('Secret stored securely');
      setShowForm(false);
      await loadVaultContext();
    } catch {
      toast.error('Failed to save secret');
    }
  }

  function handleRotate(id: number) {
    const key = keys.find((item) => item.id === id);
    if (key) {
      setRotateTarget({ id, providerId: key.providerId });
    }
  }

  async function handleRotateSave(data: { apiKey: string }) {
    if (!rotateTarget) return;
    try {
      await window.omniview.invoke('keys:rotate', {
        id: rotateTarget.id,
        newKey: data.apiKey,
      });
      toast.success('Secret rotated');
      setRotateTarget(null);
      await loadVaultContext();
    } catch {
      toast.error('Failed to rotate secret');
    }
  }

  async function handleDelete(id: number) {
    try {
      await window.omniview.invoke('keys:delete', { id });
      toast.success('Secret deleted');
      await loadVaultContext();
    } catch {
      toast.error('Failed to delete secret');
    }
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    const existing = keys.find((key) => key.id === id);
    if (!existing) return;

    const optimisticUpdatedAt = new Date().toISOString();
    setKeys((current) => current.map((key) => (
      key.id === id
        ? { ...key, isActive, updatedAt: optimisticUpdatedAt }
        : key
    )));

    try {
      await window.omniview.invoke('keys:update', { id, isActive });
    } catch {
      setKeys((current) => current.map((key) => (
        key.id === id
          ? { ...key, isActive: existing.isActive, updatedAt: existing.updatedAt }
          : key
      )));
      toast.error('Failed to update secret');
    }
  }

  async function handleVerify(id: number) {
    const existing = keys.find((key) => key.id === id);
    if (!existing) return;

    const verifiedAt = new Date().toISOString();
    setKeys((current) => current.map((key) => (
      key.id === id
        ? { ...key, lastVerifiedAt: verifiedAt }
        : key
    )));

    try {
      await window.omniview.invoke('keys:mark-verified', { id });
      toast.success('Secret marked as verified');
    } catch {
      setKeys((current) => current.map((key) => (
        key.id === id
          ? { ...key, lastVerifiedAt: existing.lastVerifiedAt }
          : key
      )));
      toast.error('Failed to mark secret as verified');
    }
  }

  async function handleReveal(id: number) {
    const target = keys.find((item) => item.id === id);
    if (!target) return;

    setRevealTarget(target);
    setRevealedSecret(null);
    setSecretVisible(false);
    setLoadingSecret(true);

    try {
      const result = await window.omniview.invoke('keys:get-plaintext', { id }) as { secret: string };
      setRevealedSecret(result.secret);
      setSecretVisible(true);
    } catch {
      closeReveal();
      toast.error('Failed to reveal secret');
    } finally {
      setLoadingSecret(false);
    }
  }

  function closeReveal() {
    setRevealTarget(null);
    setRevealedSecret(null);
    setSecretVisible(false);
  }

  async function copySecret() {
    if (!revealedSecret) return;

    try {
      await navigator.clipboard.writeText(revealedSecret);
      toast.success(`Copied to clipboard (auto-clears in ${CLIPBOARD_CLEAR_SECONDS}s)`);
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // Best-effort clear.
        }
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch {
      toast.error('Failed to copy secret');
    }
  }

  function toggleExpanded(id: number) {
    setExpandedKeyIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  const workspaceOptions = useMemo(() => {
    const base = [
      { value: 'all', label: 'All workspaces' },
      { value: 'unassigned', label: 'Unassigned only' },
    ];

    return [
      ...base,
      ...projects
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          value: String(project.id),
          label: project.name,
        })),
    ];
  }, [projects]);

  const filteredKeys = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items: KeyListItem[] = keys.map((key) => ({
      key,
      providerName: PROVIDER_NAMES[key.providerId] ?? key.providerId,
      assignments: assignmentsByKeyId[key.id] ?? [],
    }));

    const visible = items.filter((item) => {
      const assignmentText = item.assignments
        .map((assignment) => `${assignment.projectName} ${assignment.environment} ${assignment.isPrimary ? 'primary' : ''}`)
        .join(' ');

      const matchesQuery = normalized.length === 0 || [
        item.key.keyLabel,
        item.key.providerId,
        item.providerName,
        item.key.notes ?? '',
        item.key.keyPrefix ?? '',
        item.key.serviceType ?? '',
        item.key.generatedWhere ?? '',
        assignmentText,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized);

      if (!matchesQuery) return false;

      if (workspaceFilter === 'all') return true;
      if (workspaceFilter === 'unassigned') return item.assignments.length === 0;

      return item.assignments.some((assignment) => String(assignment.projectId) === workspaceFilter);
    });

    visible.sort((a, b) => {
      if (sortMode === 'alphabetical') {
        return a.key.keyLabel.localeCompare(b.key.keyLabel);
      }

      if (sortMode === 'provider') {
        const providerCompare = a.providerName.localeCompare(b.providerName);
        if (providerCompare !== 0) return providerCompare;
        return a.key.keyLabel.localeCompare(b.key.keyLabel);
      }

      if (sortMode === 'recently-used') {
        return compareDatesDesc(a.key.lastUsedAt, b.key.lastUsedAt)
          || compareDatesDesc(a.key.updatedAt, b.key.updatedAt)
          || a.key.keyLabel.localeCompare(b.key.keyLabel);
      }

      return compareDatesDesc(a.key.updatedAt, b.key.updatedAt)
        || compareDatesDesc(a.key.createdAt, b.key.createdAt)
        || a.key.keyLabel.localeCompare(b.key.keyLabel);
    });

    return visible;
  }, [assignmentsByKeyId, keys, query, sortMode, workspaceFilter]);

  const activeCount = filteredKeys.filter((item) => item.key.isActive).length;
  const assignedCount = filteredKeys.filter((item) => item.assignments.length > 0).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Secrets
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Provider keys stay encrypted locally and are ready to be attached to
            your integrations and workspaces.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add secret
          </span>
        </button>
      </div>

      <div className="glass rounded-[24px] border border-white/8 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search secrets by name, provider, notes, or workspace"
              className="w-full rounded-2xl border border-border bg-secondary/50 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DropdownSelect
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            options={workspaceOptions}
            placeholder="Filter workspace"
            className="w-[220px]"
          />

          <DropdownSelect
            value={sortMode}
            onChange={(value) => setSortMode(value as SortMode)}
            options={[
              { value: 'updated-desc', label: 'Recently updated' },
              { value: 'alphabetical', label: 'Alphabetical' },
              { value: 'provider', label: 'Provider' },
              { value: 'recently-used', label: 'Recently used' },
            ]}
            placeholder="Sort secrets"
            className="w-[190px]"
          />

          <button
            onClick={loadVaultContext}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary/35 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{filteredKeys.length} secret(s)</span>
          <span>|</span>
          <span>{activeCount} active</span>
          <span>|</span>
          <span>{assignedCount} mapped to workspace(s)</span>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <KeyForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-[420px] space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <SecretCardSkeleton key={`skeleton-${index}`} index={index} />
          ))
        ) : (
          filteredKeys.map(({ key, providerName, assignments }) => {
          const isExpanded = expandedKeyIds.includes(key.id);
          const lastUsed = key.lastUsedAt ? `${formatAge(new Date(key.lastUsedAt))} ago` : 'Never';
          const lastVerified = key.lastVerifiedAt ? formatDate(key.lastVerifiedAt) : 'Not yet';
          const workspaceSummary = assignments.length === 0
            ? 'Unassigned'
            : assignments.length === 1
              ? `${assignments[0].projectName} (${assignments[0].environment})`
              : `${assignments[0].projectName} +${assignments.length - 1} more`;

            return (
            <motion.div
              key={key.id}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                opacity: { duration: 0.2 },
                y: { duration: 0.2, ease: 'easeOut' },
                layout: CARD_SPRING,
              }}
              style={{ borderRadius: 22 }}
              className={cn(
                'glass overflow-hidden rounded-[22px] border border-white/8',
                !key.isActive && 'opacity-70',
              )}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(key.id)}
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <SecretIdentityIcon providerId={key.providerId} keyName={key.keyLabel} size={18} />
                    <p className="text-sm font-medium text-foreground">{key.keyLabel}</p>
                    <span className="rounded-full border border-border bg-secondary/35 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {providerName}
                    </span>
                    {!key.isActive && (
                      <span className="rounded-full border border-border bg-secondary/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Inactive
                      </span>
                    )}
                    {key.lastVerifiedAt && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{key.keyPrefix ?? '****'}...****</span>
                    <span>Last used: {lastUsed}</span>
                    <span>{workspaceSummary}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className="hidden text-xs sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0, y: isExpanded ? 1 : 0 }}
                    transition={CARD_SPRING}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="details"
                    initial={{ gridTemplateRows: '0fr', opacity: 0 }}
                    animate={{ gridTemplateRows: '1fr', opacity: 1 }}
                    exit={{ gridTemplateRows: '0fr', opacity: 0 }}
                    transition={{
                      gridTemplateRows: { duration: 0.42, ease: PANEL_EASE },
                      opacity: { duration: 0.22, ease: 'easeOut' },
                    }}
                    className="grid border-t border-white/8"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.32,
                        ease: PANEL_EASE,
                      }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 px-4 py-4">
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.24, delay: 0.03, ease: 'easeOut' }}
                        className="flex flex-wrap gap-2"
                      >
                        <ActionButton
                          title="Mark as manually verified"
                          onClick={() => handleVerify(key.id)}
                          icon={<BadgeCheck className="h-3.5 w-3.5" />}
                        >
                          Verify
                        </ActionButton>
                        <ActionButton
                          title="Reveal secret"
                          onClick={() => handleReveal(key.id)}
                          icon={<Eye className="h-3.5 w-3.5" />}
                        >
                          Reveal
                        </ActionButton>
                        <ActionButton
                          title={key.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(key.id, !key.isActive)}
                          icon={key.isActive ? (
                            <ToggleRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        >
                          {key.isActive ? 'Active' : 'Inactive'}
                        </ActionButton>
                        <ActionButton
                          title="Rotate secret"
                          onClick={() => handleRotate(key.id)}
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                        >
                          Rotate
                        </ActionButton>
                        <ActionButton
                          title="Open secret graph"
                          onClick={() => openGraph({ type: 'secret', id: key.id })}
                          icon={<Workflow className="h-3.5 w-3.5" />}
                        >
                          View graph
                        </ActionButton>
                        <ActionButton
                          title="Delete key"
                          onClick={() => handleDelete(key.id)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          danger
                        >
                          Delete
                        </ActionButton>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.26, delay: 0.05, ease: 'easeOut' }}
                        className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-3"
                      >
                        <DetailItem label="Created" value={formatDate(key.createdAt)} />
                        <DetailItem label="Last modified" value={formatDate(key.updatedAt)} />
                        <DetailItem label="Last verified" value={lastVerified} />
                        <DetailItem label="Expires" value={key.expiresAt ? formatDate(key.expiresAt) : 'Not set'} />
                        <DetailItem label="Service type" value={key.serviceType ?? 'Not set'} />
                        <DetailItem label="Generated where" value={key.generatedWhere ?? 'Not set'} />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.26, delay: 0.07, ease: 'easeOut' }}
                        className="space-y-2"
                      >
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Workspace mappings
                        </p>
                        {assignments.length === 0 ? (
                          <p className="text-xs text-muted-foreground">This secret is not assigned to any workspace yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {assignments.map((assignment) => (
                              <span
                                key={`${assignment.projectId}-${assignment.environment}-${assignment.isPrimary}`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-foreground"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: assignment.color }}
                                />
                                <span>{assignment.projectName}</span>
                                <span className="text-muted-foreground">{assignment.environment}</span>
                                {assignment.isPrimary && (
                                  <span className="text-primary">Primary</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>

                      {key.notes && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.26, delay: 0.09, ease: 'easeOut' }}
                          className="rounded-2xl border border-border bg-secondary/25 p-3"
                        >
                          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
                          <p className="mt-2 text-sm leading-6 text-foreground/85">{key.notes}</p>
                        </motion.div>
                      )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            );
          })
        )}
      </div>

      {!loading && filteredKeys.length === 0 && (
        <div className="glass rounded-[24px] border border-white/8 p-8 text-center text-sm text-muted-foreground">
          No secrets match the current search and filters.
        </div>
      )}

      <AnimatePresence>
        {rotateTarget && (
          <KeyForm
            rotateKeyId={rotateTarget.id}
            rotateProviderId={rotateTarget.providerId}
            onSave={handleRotateSave}
            onCancel={() => setRotateTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="glass w-full max-w-lg rounded-[24px] border border-white/10 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Secret inspector</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {revealTarget.keyLabel} - {PROVIDER_NAMES[revealTarget.providerId] ?? revealTarget.providerId}
                  </p>
                </div>
                <button
                  onClick={closeReveal}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3">
                {loadingSecret && <p className="text-xs text-muted-foreground">Loading secret...</p>}
                {!loadingSecret && revealedSecret && (
                  <code className="block break-all text-xs text-foreground">
                    {secretVisible ? revealedSecret : '*'.repeat(Math.max(revealedSecret.length, 10))}
                  </code>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setSecretVisible((value) => !value)}
                  disabled={!revealedSecret || loadingSecret}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-foreground hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {secretVisible ? 'Hide value' : 'Reveal value'}
                </button>
                <button
                  onClick={copySecret}
                  disabled={!revealedSecret || loadingSecret}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-foreground hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy (auto-clear)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass rounded-[24px] border border-white/8 p-4 text-xs leading-5 text-muted-foreground">
        Secrets are masked by default. When copied from the inspector, clipboard content is automatically cleared after {CLIPBOARD_CLEAR_SECONDS} seconds.
      </div>
    </motion.div>
  );
}

function ActionButton({
  children,
  danger = false,
  icon,
  onClick,
  title,
}: {
  children: React.ReactNode;
  danger?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-foreground transition-colors hover:bg-white/[0.08]',
        danger && 'hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/25 p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function SecretCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, delay: index * 0.03, ease: 'easeOut' }}
      className="glass rounded-[22px] border border-white/8 px-4 py-4"
    >
      <div className="animate-pulse space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-white/[0.06]" />
              <div className="h-4 w-40 rounded-full bg-white/[0.08]" />
              <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="h-3 w-28 rounded-full bg-white/[0.06]" />
              <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
              <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
            </div>
          </div>
          <div className="h-4 w-14 rounded-full bg-white/[0.05]" />
        </div>
      </div>
    </motion.div>
  );
}

function compareDatesDesc(a: string | null, b: string | null): number {
  const aValue = a ? new Date(a).getTime() : 0;
  const bValue = b ? new Date(b).getTime() : 0;
  return bValue - aValue;
}

function formatAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}
