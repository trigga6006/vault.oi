import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, FolderKanban, KeyRound, RefreshCw, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownSelect, type DropdownOption } from '../ui/DropdownSelect';
import { cn } from '../ui/cn';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { useUiStore } from '../../store/ui-store';
import type { GraphFocusTarget, GraphMap, GraphNode } from '../../../shared/types/graph.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import type { ProjectRecord } from '../../../shared/types/project.types';

export function GraphView() {
  const { graphFocus, setActiveView, setGraphFocus } = useUiStore();
  const [focusType, setFocusType] = useState<GraphFocusTarget['type']>(graphFocus?.type ?? 'secret');
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [map, setMap] = useState<GraphMap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (graphFocus) {
      setFocusType(graphFocus.type);
    }
  }, [graphFocus]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [loadedKeys, loadedProjects] = await Promise.all([
          window.omniview.invoke('keys:list', undefined) as Promise<ApiKeyMetadata[]>,
          window.omniview.invoke('projects:list', undefined) as Promise<ProjectRecord[]>,
        ]);

        if (cancelled) return;

        setKeys(loadedKeys);
        setProjects(loadedProjects);

        if (!graphFocus) {
          const nextFocus = focusType === 'secret'
            ? loadedKeys[0] ? { type: 'secret' as const, id: loadedKeys[0].id } : null
            : loadedProjects[0] ? { type: 'workspace' as const, id: loadedProjects[0].id } : null;
          setGraphFocus(nextFocus);
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load graph inputs');
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [focusType, graphFocus, setGraphFocus]);

  useEffect(() => {
    if (!graphFocus) {
      setMap(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    window.omniview.invoke('graph:get-map', graphFocus)
      .then((result) => {
        if (!cancelled) {
          setMap(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMap(null);
          toast.error(error instanceof Error ? error.message : 'Failed to load graph');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphFocus]);

  const focusOptions = useMemo<DropdownOption[]>(() => {
    if (focusType === 'secret') {
      return keys.map((key) => ({
        value: String(key.id),
        label: key.keyLabel,
        description: `${key.providerId} | ${key.keyPrefix ?? 'masked'}...`,
        icon: <SecretIdentityIcon providerId={key.providerId} keyName={key.keyLabel} size={16} />,
      }));
    }

    return projects.map((project) => ({
      value: String(project.id),
      label: project.name,
      description: project.gitRepoPath ?? 'Workspace',
      icon: (
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: project.color }}
        />
      ),
    }));
  }, [focusType, keys, projects]);

  const selectedValue = graphFocus && graphFocus.type === focusType ? String(graphFocus.id) : '';
  const nodesByColumn = useMemo(() => {
    if (!map) return new Map<number, GraphNode[]>();

    const next = new Map<number, GraphNode[]>();
    map.nodes.forEach((node) => {
      const existing = next.get(node.column) ?? [];
      existing.push(node);
      next.set(node.column, existing);
    });
    next.forEach((group) => group.sort((a, b) => a.order - b.order));
    return next;
  }, [map]);

  function handleFocusTypeChange(nextType: GraphFocusTarget['type']) {
    setFocusType(nextType);
    if (nextType === 'secret') {
      const nextKey = keys[0];
      setGraphFocus(nextKey ? { type: 'secret', id: nextKey.id } : null);
      return;
    }

    const nextProject = projects[0];
    setGraphFocus(nextProject ? { type: 'workspace', id: nextProject.id } : null);
  }

  function handleEntityChange(value: string) {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    setGraphFocus({ type: focusType, id });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/35 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to overview
          </button>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Secret Graph</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Visualize how secrets connect to workspaces, environments, source paths, and rotation risk using the vault metadata you already collect.
          </p>
        </div>
        <button
          type="button"
          onClick={() => graphFocus && setGraphFocus({ ...graphFocus })}
          disabled={!graphFocus || loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh map
        </button>
      </div>

      <div className="glass rounded-[28px] border border-border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-2xl border border-border bg-secondary/30 p-1">
            <ModeButton
              active={focusType === 'secret'}
              icon={KeyRound}
              label="Secrets"
              onClick={() => handleFocusTypeChange('secret')}
            />
            <ModeButton
              active={focusType === 'workspace'}
              icon={FolderKanban}
              label="Workspaces"
              onClick={() => handleFocusTypeChange('workspace')}
            />
          </div>

          <div className="min-w-[320px] flex-1">
            <DropdownSelect
              value={selectedValue}
              onChange={handleEntityChange}
              options={focusOptions}
              placeholder={focusType === 'secret' ? 'Select a secret' : 'Select a workspace'}
              menuClassName="max-w-[30rem]"
            />
          </div>
        </div>
      </div>

      {!graphFocus && !loading && (
        <div className="glass rounded-[28px] border border-border p-10 text-center text-sm text-muted-foreground">
          Select a secret or workspace to render the graph.
        </div>
      )}

      {loading && (
        <div className="glass rounded-[28px] border border-border p-10">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading graph map...
          </div>
        </div>
      )}

      {map && !loading && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_340px]">
          <section className="glass rounded-[28px] border border-border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{map.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{map.subtitle}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-primary">
                <Workflow className="h-3.5 w-3.5" />
                Phase 1 map
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[24px] border border-border bg-card/70 p-4">
              <div
                className="grid min-w-max gap-4"
                style={{ gridTemplateColumns: `repeat(${map.columns.length}, minmax(240px, 1fr))` }}
              >
                {map.columns.map((column) => (
                  <div key={column.index} className="space-y-3">
                    <div className="rounded-2xl border border-border bg-card px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {column.label}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {(nodesByColumn.get(column.index) ?? []).map((node) => (
                        <GraphNodeCard key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="glass rounded-[28px] border border-border p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick facts
              </p>
              <div className="mt-4 grid gap-3">
                {map.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={cn(
                      'rounded-2xl border px-4 py-3',
                      toneClass(insight.tone),
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{insight.label}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{insight.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-[28px] border border-border p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Scope
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                This first map is built from persisted vault metadata and workspace assignments. It does not claim runtime usage or full repository coverage yet.
              </p>
            </div>

            {map.warnings.length > 0 && (
              <div className="glass rounded-[28px] border border-amber-500/25 bg-amber-500/8 p-5">
                <div className="flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Warnings</p>
                </div>
                <div className="mt-4 space-y-2 text-sm text-amber-50/90">
                  {map.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </motion.div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function GraphNodeCard({
  node,
}: {
  node: GraphNode;
}) {
  return (
    <div
      className={cn(
        'relative rounded-[22px] border px-4 py-3 backdrop-blur-xl transition-transform',
        node.emphasis ? 'shadow-[0_18px_50px_rgba(0,0,0,0.24)]' : 'shadow-[0_10px_24px_rgba(0,0,0,0.14)]',
        toneClass(node.tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{node.label}</p>
          {node.subtitle && (
            <p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">{node.subtitle}</p>
          )}
        </div>
        {node.badge && (
          <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-foreground/90">
            {node.badge}
          </span>
        )}
      </div>
    </div>
  );
}

function toneClass(tone: GraphNode['tone']) {
  if (tone === 'danger') {
    return 'border-destructive/35 bg-destructive/12';
  }
  if (tone === 'warning') {
    return 'border-amber-500/35 bg-amber-500/14';
  }
  if (tone === 'success') {
    return 'border-emerald-500/35 bg-emerald-500/14';
  }
  if (tone === 'info') {
    return 'border-primary/35 bg-primary/12';
  }
  return 'border-border bg-card/82';
}
