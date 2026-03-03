import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Blocks,
  FolderKanban,
  KeyRound,
  LockKeyhole,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useProxy } from '../../hooks/useProxy';
import { useVault } from '../../hooks/useVault';
import { useUiStore } from '../../store/ui-store';
import { KeyRotationBanner } from '../vault/KeyRotationBanner';
import { ProviderLogo } from '../providers/ProviderLogo';
import { HealthBadge } from '../providers/HealthBadge';
import type { ProviderConfigRecord } from '../../../shared/types/models.types';
import type { ProjectRecord } from '../../../shared/types/project.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import type { HealthCheckResult } from '../../../shared/types/provider.types';

interface OverviewData {
  keys: ApiKeyMetadata[];
  providers: ProviderConfigRecord[];
  projects: ProjectRecord[];
  healthChecks: Record<string, HealthCheckResult>;
}

export function DashboardView() {
  const { setActiveView } = useUiStore();
  const { status } = useProxy();
  const { autoLockMinutes } = useVault();
  const [data, setData] = useState<OverviewData>({
    keys: [],
    providers: [],
    projects: [],
    healthChecks: {},
  });

  const loadOverview = useCallback(async () => {
    try {
      const [keys, providers, projects] = await Promise.all([
        window.omniview.invoke('keys:list', undefined) as Promise<ApiKeyMetadata[]>,
        window.omniview.invoke(
          'config:list-providers',
          undefined,
        ) as Promise<ProviderConfigRecord[]>,
        window.omniview.invoke('projects:list', undefined) as Promise<ProjectRecord[]>,
      ]);

      const healthEntries = await Promise.all(
        providers.map(async (provider) => {
          try {
            const health = (await window.omniview.invoke('provider:health-check', {
              providerId: provider.providerId,
            })) as HealthCheckResult;
            return [provider.providerId, health] as const;
          } catch {
            return [
              provider.providerId,
              {
                status: 'unknown',
                latencyMs: 0,
                checkedAt: new Date().toISOString(),
              } as HealthCheckResult,
            ] as const;
          }
        }),
      );

      setData({
        keys,
        providers,
        projects,
        healthChecks: Object.fromEntries(healthEntries),
      });
    } catch (error) {
      console.error('Failed to load overview data:', error);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 45000);
    return () => clearInterval(interval);
  }, [loadOverview]);

  const activeKeys = data.keys.filter((key) => key.isActive);
  const enabledProviders = data.providers.filter((provider) => provider.enabled);
  const healthyProviders = enabledProviders.filter((provider) => {
    const health = data.healthChecks[provider.providerId];
    return health?.status === 'healthy' || health?.status === 'degraded';
  });
  const recentKeys = [...data.keys]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const recentProjects = [...data.projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);
  const staleKeys = data.keys.filter((key) => {
    if (!key.lastUsedAt) return false;
    const age = Date.now() - new Date(key.lastUsedAt).getTime();
    return age > 1000 * 60 * 60 * 24 * 30;
  }).length;

  const checklist = [
    {
      label: 'Store provider secrets',
      done: activeKeys.length > 0,
      hint: activeKeys.length > 0 ? `${activeKeys.length} active` : 'vault.add',
      view: 'vault' as const,
    },
    {
      label: 'Connect integrations',
      done: enabledProviders.length > 0,
      hint: enabledProviders.length > 0 ? `${enabledProviders.length} ready` : 'providers.add',
      view: 'providers' as const,
    },
    {
      label: 'Map workspaces',
      done: data.projects.length > 0,
      hint: data.projects.length > 0 ? `${data.projects.length} mapped` : 'projects.create',
      view: 'projects' as const,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="space-y-4"
    >
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="glass-strong rounded-[24px] border border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill icon={ShieldCheck} label="vault.encrypted" />
                <StatusPill icon={Radio} label={status.running ? 'gateway.running' : 'gateway.idle'} />
                <StatusPill icon={LockKeyhole} label={`autolock.${autoLockMinutes}m`} />
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Workspace overview
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Local secrets, provider routing, and workspace assignments.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionPill label="Open secrets" onClick={() => setActiveView('vault')} />
                <ActionPill
                  label="Manage integrations"
                  onClick={() => setActiveView('providers')}
                />
                <ActionPill
                  label="Open workspaces"
                  onClick={() => setActiveView('projects')}
                />
              </div>
            </div>

            <div className="min-w-[280px] rounded-[20px] border border-border bg-secondary/35 p-4">
              <div className="mb-3 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                session.state
              </div>
              <dl className="space-y-2 text-sm">
                <CompactRow label="gateway" value={status.running ? `:${status.port}` : 'idle'} />
                <CompactRow label="requests" value={status.requestCount.toLocaleString()} />
                <CompactRow label="secrets" value={data.keys.length.toString()} />
                <CompactRow label="integrations" value={healthyProviders.length.toString()} />
              </dl>
            </div>
          </div>
        </div>

        <div className="glass rounded-[24px] border border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Setup queue</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep the core path tight and explicit.
              </p>
            </div>
            <span className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              {checklist.filter((item) => item.done).length}/{checklist.length}
            </span>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveView(item.view)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-secondary/28 px-3 py-3 text-left transition-colors hover:bg-secondary/45"
              >
                <div>
                  <div className="text-sm text-foreground">{item.label}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {item.hint}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.08em] ${
                    item.done
                      ? 'bg-emerald-500/12 text-emerald-300'
                      : 'bg-card text-muted-foreground'
                  }`}
                >
                  {item.done ? 'ready' : 'todo'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <KeyRotationBanner />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={KeyRound}
          label="active.secrets"
          value={activeKeys.length.toString()}
          caption={`${data.keys.length} stored`}
        />
        <MetricCard
          icon={Blocks}
          label="live.integrations"
          value={healthyProviders.length.toString()}
          caption={`${enabledProviders.length} configured`}
        />
        <MetricCard
          icon={FolderKanban}
          label="workspaces"
          value={data.projects.length.toString()}
          caption="env-aware mapping"
        />
        <MetricCard
          icon={Radio}
          label="stale.secrets"
          value={staleKeys.toString()}
          caption="unused > 30d"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <div className="glass rounded-[24px] border border-border p-5">
          <SectionHeader
            title="Recent secrets"
            subtitle="Newest credentials in the vault."
            actionLabel="View"
            onAction={() => setActiveView('vault')}
          />
          <div className="mt-4 space-y-2">
            {recentKeys.length === 0 ? (
              <EmptyState
                title="No secrets stored"
                body="Add your first provider credential."
              />
            ) : (
              recentKeys.map((key) => (
                <ListRow
                  key={key.id}
                  leading={<ProviderLogo providerId={key.providerId} size={24} />}
                  title={key.keyLabel}
                  subtitle={`${key.providerId} / ${key.keyPrefix ?? 'hidden'}...****`}
                  meta={formatRelativeDate(key.createdAt)}
                />
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-[24px] border border-border p-5">
          <SectionHeader
            title="Integration health"
            subtitle="Provider connectivity and readiness."
            actionLabel="Manage"
            onAction={() => setActiveView('providers')}
          />
          <div className="mt-4 space-y-2">
            {enabledProviders.length === 0 ? (
              <EmptyState
                title="No integrations connected"
                body="Add a provider configuration to start routing."
              />
            ) : (
              enabledProviders.slice(0, 5).map((provider) => (
                <div
                  key={provider.providerId}
                  className="flex items-center justify-between rounded-2xl border border-border bg-secondary/28 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <ProviderLogo providerId={provider.providerId} size={24} />
                    <div>
                      <div className="text-sm text-foreground">{provider.displayName}</div>
                      <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                        {provider.baseUrl ?? 'default.endpoint'}
                      </div>
                    </div>
                  </div>
                  <HealthBadge
                    status={data.healthChecks[provider.providerId]?.status ?? 'unknown'}
                    latencyMs={data.healthChecks[provider.providerId]?.latencyMs}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-[24px] border border-border p-5">
          <SectionHeader
            title="Workspace map"
            subtitle="Recent environment-aware workspaces."
            actionLabel="Open"
            onAction={() => setActiveView('projects')}
          />
          <div className="mt-4 space-y-2">
            {recentProjects.length === 0 ? (
              <EmptyState
                title="No workspaces yet"
                body="Create a workspace to map secrets by environment."
              />
            ) : (
              recentProjects.map((project) => (
                <ListRow
                  key={project.id}
                  leading={
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                  }
                  title={project.name}
                  subtitle={project.description ?? 'No description'}
                  meta={formatRelativeDate(project.updatedAt)}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="glass rounded-[20px] border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-mono text-muted-foreground">{caption}</div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/45 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-foreground" />
      {label}
    </div>
  );
}

function ActionPill({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
    >
      {label}
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="rounded-full border border-border bg-secondary/35 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function CompactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card/65 px-3 py-2">
      <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/18 px-4 py-6">
      <div className="text-sm text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}

function ListRow({
  leading,
  title,
  subtitle,
  meta,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/28 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-card">
          {leading}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-foreground">{title}</div>
          <div className="mt-1 truncate text-[11px] font-mono text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="pl-3 text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
        {meta}
      </div>
    </div>
  );
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  return date.toLocaleDateString();
}
