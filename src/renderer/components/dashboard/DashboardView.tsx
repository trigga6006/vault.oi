import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Blocks,
  FolderKanban,
  KeyRound,
  Radio,
} from 'lucide-react';
import { useProxy } from '../../hooks/useProxy';
import { useVault } from '../../hooks/useVault';
import { useUiStore } from '../../store/ui-store';
import { KeyRotationBanner } from '../vault/KeyRotationBanner';
import { ProviderLogo } from '../providers/ProviderLogo';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { HealthBadge } from '../providers/HealthBadge';
import type { ProviderConfigRecord } from '../../../shared/types/models.types';
import type { ProjectRecord } from '../../../shared/types/project.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import type { HealthCheckResult } from '../../../shared/types/provider.types';
import { PROVIDER_NAME_BY_ID } from '../../../shared/constants/provider-catalog';

interface OverviewData {
  keys: ApiKeyMetadata[];
  providers: ProviderConfigRecord[];
  projects: ProjectRecord[];
  healthChecks: Record<string, HealthCheckResult>;
}

const PROVIDER_LABELS: Record<string, string> = {
  ...PROVIDER_NAME_BY_ID,
  app: 'App Secret',
  config: 'Config Value',
};

export function DashboardView() {
  const { setActiveView, theme } = useUiStore();
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

  const worstStaleAgeDays = data.keys
    .filter((key) => key.lastUsedAt != null)
    .reduce((max, key) => {
      const age = (Date.now() - new Date(key.lastUsedAt!).getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(max, age);
    }, 0);

  const staleVignette = computeStaleVignette(worstStaleAgeDays, theme);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="space-y-4"
    >
      <section className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        {/* Workspace overview */}
        <div className="glass-strong flex flex-col justify-center rounded-[24px] border border-border px-5 py-4">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Workspace overview
          </h1>
          <div className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status.running
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span>gateway {status.running ? `:${status.port}` : 'idle'}</span>
            <span className="text-border">·</span>
            <span>{status.requestCount} routed</span>
            <span className="text-border">·</span>
            <span>auto-lock {autoLockMinutes}m</span>
          </div>
        </div>

        {/* Tamagotchi placeholder */}
        <div className="glass flex flex-col items-center justify-center rounded-[24px] border border-border" style={{ minHeight: 200 }}>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-border" />
          <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            security.pet
          </span>
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
          accentColor={staleVignette?.color}
          vignetteOpacity={staleVignette?.opacity}
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
                  leading={<SecretIdentityIcon providerId={key.providerId} keyName={key.keyLabel} size={24} />}
                  title={key.keyLabel}
                  subtitle={`${PROVIDER_LABELS[key.providerId] ?? key.providerId} / ${key.keyPrefix ?? 'hidden'}...****`}
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
  accentColor,
  vignetteOpacity = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  caption: string;
  accentColor?: string;
  vignetteOpacity?: number;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-[20px] border border-border p-4">
      {accentColor && vignetteOpacity > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 20%, ${accentColor} 120%)`,
            opacity: vignetteOpacity,
            borderRadius: 'inherit',
          }}
        />
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <Icon
          className="h-4 w-4 transition-colors duration-700"
          style={{ color: accentColor ?? 'var(--color-muted-foreground)' }}
        />
      </div>
      <div
        className="relative mt-3 text-3xl font-semibold tracking-[-0.04em] transition-colors duration-700"
        style={{ color: accentColor ?? 'var(--color-foreground)' }}
      >
        {value}
      </div>
      <div className="relative mt-1 text-[11px] font-mono text-muted-foreground">{caption}</div>
    </div>
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

// Maps the oldest-key age (days since last use) to a vignette color + opacity.
// Starts faint yellow at 15 days, shifts to orange, reaches full red at 30 days.
// Light mode uses darker/more saturated values to stay visible on white backgrounds.
function computeStaleVignette(ageDays: number, theme: 'dark' | 'light'): { color: string; opacity: number } | null {
  if (ageDays < 15) return null;
  const t = Math.min((ageDays - 15) / 15, 1); // 0 at 15d → 1 at 30d+

  if (theme === 'light') {
    // Darker, more saturated palette for light backgrounds
    const hue = t < 0.5
      ? 75 - (t * 2) * 30   // 75 (gold) → 45 (orange)
      : 45 - ((t - 0.5) * 2) * 22; // 45 (orange) → 23 (red)
    const chroma = t < 0.5
      ? 0.22 + (t * 2) * 0.06
      : 0.28 + ((t - 0.5) * 2) * 0.04;
    const lightness = 0.60 - t * 0.18; // 0.60 → 0.42 (perceptibly dark)
    return {
      color: `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${Math.round(hue)})`,
      opacity: 0.18 + t * 0.47,
    };
  }

  // Dark mode: original values
  const hue = t < 0.5
    ? 88 - (t * 2) * 36
    : 52 - ((t - 0.5) * 2) * 26;
  const chroma = t < 0.5
    ? 0.15 + (t * 2) * 0.05
    : 0.20 + ((t - 0.5) * 2) * 0.05;
  const lightness = 0.82 - t * 0.20;
  return {
    color: `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${Math.round(hue)})`,
    opacity: 0.12 + t * 0.58,
  };
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
