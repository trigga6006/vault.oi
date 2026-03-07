import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, FolderKanban, KeyRound, Minus, Plus, RefreshCw, RotateCcw, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownSelect, type DropdownOption } from '../ui/DropdownSelect';
import { cn } from '../ui/cn';
import { SecretIdentityIcon } from '../secrets/SecretIdentityIcon';
import { useUiStore } from '../../store/ui-store';
import type { GraphFocusTarget, GraphMap, GraphNode, GraphEdge, GraphTone } from '../../../shared/types/graph.types';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';
import type { ProjectRecord } from '../../../shared/types/project.types';

// -- Layout constants ---------------------------------------------------------
const NODE_W = 260;
const NODE_H = 72;
const COL_GAP = 180;
const ROW_GAP = 32;
const HEADER_H = 42;
const PAD_X = 60;
const PAD_Y = 40;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

// -- Types --------------------------------------------------------------------
interface LayoutNode {
  node: GraphNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutEdge {
  edge: GraphEdge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  d: string;
}

interface LayoutColumn {
  index: number;
  label: string;
  x: number;
  y: number;
}

// -- Layout engine ------------------------------------------------------------
function computeLayout(map: GraphMap) {
  const colGroups = new Map<number, GraphNode[]>();
  for (const n of map.nodes) {
    const g = colGroups.get(n.column) ?? [];
    g.push(n);
    colGroups.set(n.column, g);
  }
  colGroups.forEach((g) => g.sort((a, b) => a.order - b.order));

  const sortedCols = map.columns.slice().sort((a, b) => a.index - b.index);

  // find the tallest column to center shorter ones
  let maxColH = 0;
  for (const col of sortedCols) {
    const count = (colGroups.get(col.index) ?? []).length;
    const h = count * NODE_H + Math.max(0, count - 1) * ROW_GAP;
    if (h > maxColH) maxColH = h;
  }

  const nodeMap = new Map<string, LayoutNode>();
  const layoutCols: LayoutColumn[] = [];

  for (let ci = 0; ci < sortedCols.length; ci++) {
    const col = sortedCols[ci];
    const nodes = colGroups.get(col.index) ?? [];
    const colX = PAD_X + ci * (NODE_W + COL_GAP);
    const colH = nodes.length * NODE_H + Math.max(0, nodes.length - 1) * ROW_GAP;
    const offsetY = PAD_Y + HEADER_H + 16 + (maxColH - colH) / 2;

    layoutCols.push({ index: col.index, label: col.label, x: colX, y: PAD_Y });

    for (let ni = 0; ni < nodes.length; ni++) {
      const n = nodes[ni];
      nodeMap.set(n.id, {
        node: n,
        x: colX,
        y: offsetY + ni * (NODE_H + ROW_GAP),
        w: NODE_W,
        h: NODE_H,
      });
    }
  }

  // edges as bezier curves
  const layoutEdges: LayoutEdge[] = [];
  for (const edge of map.edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const forward = tgt.x >= src.x;
    const sx = forward ? src.x + src.w : src.x;
    const sy = src.y + src.h / 2;
    const tx = forward ? tgt.x : tgt.x + tgt.w;
    const ty = tgt.y + tgt.h / 2;

    const cpOff = Math.min(Math.abs(tx - sx) * 0.45, COL_GAP * 0.55);
    const cp1x = forward ? sx + cpOff : sx - cpOff;
    const cp2x = forward ? tx - cpOff : tx + cpOff;

    const d = `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;
    layoutEdges.push({ edge, sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, d });
  }

  const totalW = PAD_X * 2 + sortedCols.length * NODE_W + Math.max(0, sortedCols.length - 1) * COL_GAP;
  const totalH = PAD_Y * 2 + HEADER_H + 16 + maxColH;

  return { nodes: nodeMap, edges: layoutEdges, columns: layoutCols, width: totalW, height: totalH };
}

// -- Color helpers ------------------------------------------------------------
function toneStroke(tone: GraphTone): string {
  if (tone === 'danger') return '#f87171';
  if (tone === 'warning') return '#fbbf24';
  if (tone === 'success') return '#34d399';
  if (tone === 'info') return '#60a5fa';
  return '#6b7280';
}

function toneGlow(tone: GraphTone): string {
  if (tone === 'danger') return 'rgba(248,113,113,0.15)';
  if (tone === 'warning') return 'rgba(251,191,36,0.12)';
  if (tone === 'success') return 'rgba(52,211,153,0.12)';
  if (tone === 'info') return 'rgba(96,165,250,0.12)';
  return 'rgba(107,114,128,0.08)';
}

function toneBorder(tone: GraphTone): string {
  if (tone === 'danger') return 'rgba(248,113,113,0.45)';
  if (tone === 'warning') return 'rgba(251,191,36,0.4)';
  if (tone === 'success') return 'rgba(52,211,153,0.4)';
  if (tone === 'info') return 'rgba(96,165,250,0.4)';
  return 'rgba(255,255,255,0.08)';
}

function toneClass(tone: GraphTone) {
  if (tone === 'danger') return 'border-destructive/45 bg-card';
  if (tone === 'warning') return 'border-amber-500/45 bg-card';
  if (tone === 'success') return 'border-emerald-500/45 bg-card';
  if (tone === 'info') return 'border-primary/45 bg-card';
  return 'border-border bg-card';
}

// -- Main component -----------------------------------------------------------
export function GraphView() {
  const { graphFocus, setActiveView, setGraphFocus } = useUiStore();
  const [focusType, setFocusType] = useState<GraphFocusTarget['type']>(graphFocus?.type ?? 'secret');
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [map, setMap] = useState<GraphMap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (graphFocus) setFocusType(graphFocus.type);
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
        if (!cancelled) toast.error('Failed to load graph inputs');
      }
    }
    loadOptions();
    return () => { cancelled = true; };
  }, [focusType, graphFocus, setGraphFocus]);

  useEffect(() => {
    if (!graphFocus) { setMap(null); return; }
    let cancelled = false;
    setLoading(true);
    window.omniview.invoke('graph:get-map', graphFocus)
      .then((result) => { if (!cancelled) setMap(result); })
      .catch((error) => {
        if (!cancelled) {
          setMap(null);
          toast.error(error instanceof Error ? error.message : 'Failed to load graph');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
      icon: <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />,
    }));
  }, [focusType, keys, projects]);

  const selectedValue = graphFocus && graphFocus.type === focusType ? String(graphFocus.id) : '';

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
      className="space-y-4"
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
            Interactive dependency tree for secret and workspace relationships.
          </p>
        </div>
        <button
          type="button"
          onClick={() => graphFocus && setGraphFocus({ ...graphFocus })}
          disabled={!graphFocus || loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="glass rounded-[24px] border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-2xl border border-border bg-secondary/30 p-1">
            <ModeButton active={focusType === 'secret'} icon={KeyRound} label="Secrets" onClick={() => handleFocusTypeChange('secret')} />
            <ModeButton active={focusType === 'workspace'} icon={FolderKanban} label="Workspaces" onClick={() => handleFocusTypeChange('workspace')} />
          </div>
          <div className="min-w-[300px] flex-1">
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
        <div className="glass rounded-[24px] border border-border p-8 text-center text-sm text-muted-foreground">
          Select a secret or workspace to render the graph.
        </div>
      )}

      {loading && (
        <div className="glass rounded-[24px] border border-border p-8">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading graph...
          </div>
        </div>
      )}

      {map && !loading && (
        <div className="space-y-3">
          <section className="glass rounded-[24px] border border-border">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{map.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{map.subtitle}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-primary">
                <Workflow className="h-3.5 w-3.5" />
                Dependency tree
              </div>
            </div>
            <TreeCanvas map={map} />
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {map.insights.map((insight) => (
              <div key={insight.id} className={cn('glass rounded-2xl border px-3 py-2.5', toneClass(insight.tone))}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{insight.label}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{insight.value}</p>
              </div>
            ))}
            <div className="glass rounded-2xl border border-border px-3 py-2.5 md:col-span-2 xl:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Scope</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Graph reflects persisted vault metadata and workspace assignments.
              </p>
            </div>
            {map.warnings.length > 0 && (
              <div className="glass rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 md:col-span-2 xl:col-span-4">
                <div className="flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Warnings</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-amber-50/90">
                  {map.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </motion.div>
  );
}

// -- Pan + Zoom Tree Canvas ---------------------------------------------------
function TreeCanvas({ map }: { map: GraphMap }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const didDrag = useRef(false);

  const layout = useMemo(() => computeLayout(map), [map]);

  // fit to container on first render
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scaleX = rect.width / layout.width;
    const scaleY = rect.height / layout.height;
    const fit = Math.min(scaleX, scaleY, 1) * 0.92;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit)));
    setPan({
      x: (rect.width - layout.width * fit) / 2,
      y: (rect.height - layout.height * fit) / 2,
    });
  }, [layout]);

  // wheel zoom — must be non-passive to preventDefault and stop page scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((prev) => {
        const dir = e.deltaY < 0 ? 1 : -1;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + dir * ZOOM_STEP));
        const ratio = next / prev;
        setPan((p) => ({
          x: mx - ratio * (mx - p.x),
          y: my - ratio * (my - p.y),
        }));
        return next;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  // click on blank space clears selection (node clicks stopPropagation so this won't fire for them)
  const handleBackgroundClick = useCallback(() => {
    if (!didDrag.current) {
      setSelected(null);
      setHovered(null);
    }
  }, []);

  function resetView() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scaleX = rect.width / layout.width;
    const scaleY = rect.height / layout.height;
    const fit = Math.min(scaleX, scaleY, 1) * 0.92;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit)));
    setPan({
      x: (rect.width - layout.width * fit) / 2,
      y: (rect.height - layout.height * fit) / 2,
    });
  }

  // build connectivity set — selected takes priority over hovered
  const activeId = selected ?? hovered;
  const connectedIds = useMemo(() => {
    if (!activeId) return null;
    const ids = new Set<string>([activeId]);
    for (const le of layout.edges) {
      if (le.edge.source === activeId || le.edge.target === activeId) {
        ids.add(le.edge.source);
        ids.add(le.edge.target);
        ids.add(le.edge.id);
      }
    }
    return ids;
  }, [activeId, layout.edges]);

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm">
        <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3rem] text-center text-[10px] font-medium text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button type="button" onClick={resetView}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleBackgroundClick}
        className={cn(
          'relative h-[520px] overflow-hidden rounded-b-[24px] bg-stone-100 dark:bg-card/40',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ touchAction: 'none' }}
      >
        {/* Subtle dot grid background */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
          }}
        />

        {/* Transform layer */}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, willChange: 'transform' }}
        >
          {/* SVG edges layer */}
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={layout.width}
            height={layout.height}
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* animated dash for highlighted edges */}
              <style>{`
                @keyframes dash-flow {
                  to { stroke-dashoffset: -20; }
                }
              `}</style>
            </defs>
            {layout.edges.map((le) => {
              const edgeDim = connectedIds && !connectedIds.has(le.edge.id);
              const edgeLit = connectedIds?.has(le.edge.id);
              const stroke = toneStroke(le.edge.tone);
              return (
                <g key={le.edge.id}>
                  {/* glow layer for highlighted edges */}
                  {edgeLit && (
                    <path
                      d={le.d}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={0.2}
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={le.d}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={edgeDim ? 0.12 : 0.55}
                    strokeWidth={edgeLit ? 2 : 1.4}
                    strokeLinecap="round"
                    strokeDasharray={edgeLit ? '6 4' : 'none'}
                    style={edgeLit ? { animation: 'dash-flow 0.8s linear infinite' } : undefined}
                  />
                  {/* endpoints */}
                  <circle cx={le.sourceX} cy={le.sourceY} r={edgeLit ? 3 : 2}
                    fill={stroke} fillOpacity={edgeDim ? 0.2 : 0.85} />
                  <circle cx={le.targetX} cy={le.targetY} r={edgeLit ? 3 : 2}
                    fill={stroke} fillOpacity={edgeDim ? 0.2 : 0.85} />
                  {/* edge label */}
                  {edgeLit && (
                    <text
                      x={(le.sourceX + le.targetX) / 2}
                      y={(le.sourceY + le.targetY) / 2 - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      style={{ fontSize: 12, fontFamily: 'inherit' }}
                    >
                      {le.edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Column headers */}
          {layout.columns.map((col) => (
            <div
              key={col.index}
              className="absolute"
              style={{ left: col.x, top: col.y, width: NODE_W }}
            >
              <div className="rounded-xl border border-border bg-stone-200 dark:bg-card/80 px-3 py-2 text-center backdrop-blur-sm">
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {col.label}
                </span>
              </div>
            </div>
          ))}

          {/* Node cards */}
          {Array.from(layout.nodes.values()).map((ln) => {
            const dim = connectedIds && !connectedIds.has(ln.node.id);
            return (
              <TreeNodeCard
                key={ln.node.id}
                ln={ln}
                dim={!!dim}
                active={selected === ln.node.id}
                onEnter={() => { if (!selected) setHovered(ln.node.id); }}
                onLeave={() => { if (!selected) setHovered((prev) => prev === ln.node.id ? null : prev); }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected((prev) => prev === ln.node.id ? null : ln.node.id);
                  setHovered(null);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Minimap */}
      <Minimap layout={layout} zoom={zoom} pan={pan} containerRef={containerRef} />
    </div>
  );
}

// -- Tree node card -----------------------------------------------------------
function TreeNodeCard({
  ln, dim, active, onEnter, onLeave, onClick,
}: {
  ln: LayoutNode;
  dim: boolean;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { node } = ln;
  const stroke = toneStroke(node.tone);
  const glow = toneGlow(node.tone);
  const border = toneBorder(node.tone);

  return (
    <div
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      className="absolute cursor-pointer transition-opacity duration-200"
      style={{
        left: ln.x,
        top: ln.y,
        width: ln.w,
        height: ln.h,
        opacity: dim ? 0.25 : 1,
      }}
    >
      <div
        className={cn(
          'group relative flex h-full items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition-all duration-200',
          'bg-stone-200 dark:bg-card/90 backdrop-blur-sm',
          (node.emphasis || active) && 'ring-1 ring-primary/30',
        )}
        style={{
          borderColor: border,
          boxShadow: node.emphasis ? `0 0 20px ${glow}, 0 0 40px ${glow}` : `0 0 12px ${glow}`,
        }}
      >
        {/* Left tone accent bar */}
        <div
          className="absolute left-0 top-3 h-[calc(100%-24px)] w-[3px] rounded-full"
          style={{ background: stroke, opacity: 0.7 }}
        />
        <div className="min-w-0 flex-1 pl-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{node.label}</p>
            {node.badge && (
              <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-foreground/90">
                {node.badge}
              </span>
            )}
          </div>
          {node.subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{node.subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Minimap ------------------------------------------------------------------
function Minimap({
  layout, zoom, pan, containerRef,
}: {
  layout: ReturnType<typeof computeLayout>;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const MINI_W = 160;
  const scale = MINI_W / layout.width;
  const miniH = layout.height * scale;

  const containerRect = containerRef.current?.getBoundingClientRect();
  const viewW = containerRect ? containerRect.width / zoom * scale : MINI_W;
  const viewH = containerRect ? containerRect.height / zoom * scale : miniH;
  const viewX = -pan.x / zoom * scale;
  const viewY = -pan.y / zoom * scale;

  return (
    <div
      className="absolute bottom-3 left-3 z-20 overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-sm"
      style={{ width: MINI_W, height: miniH }}
    >
      {/* mini nodes */}
      {Array.from(layout.nodes.values()).map((ln) => (
        <div
          key={ln.node.id}
          className="absolute rounded-sm"
          style={{
            left: ln.x * scale,
            top: ln.y * scale,
            width: Math.max(ln.w * scale, 2),
            height: Math.max(ln.h * scale, 2),
            background: toneStroke(ln.node.tone),
            opacity: ln.node.emphasis ? 0.8 : 0.4,
          }}
        />
      ))}
      {/* mini edges */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {layout.edges.map((le) => (
          <path
            key={le.edge.id}
            d={scalePath(le.d, scale)}
            fill="none"
            stroke={toneStroke(le.edge.tone)}
            strokeOpacity={0.3}
            strokeWidth={0.5}
          />
        ))}
      </svg>
      {/* viewport indicator */}
      <div
        className="absolute border border-primary/60"
        style={{
          left: Math.max(0, viewX),
          top: Math.max(0, viewY),
          width: Math.min(viewW, MINI_W),
          height: Math.min(viewH, miniH),
          background: 'rgba(96,165,250,0.06)',
        }}
      />
    </div>
  );
}

function scalePath(d: string, s: number): string {
  return d.replace(/(-?\d+\.?\d*)/g, (_, n) => String(parseFloat(n) * s));
}

// -- Small helpers ------------------------------------------------------------
function ModeButton({
  active, icon: Icon, label, onClick,
}: {
  active: boolean; icon: React.ElementType; label: string; onClick: () => void;
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
