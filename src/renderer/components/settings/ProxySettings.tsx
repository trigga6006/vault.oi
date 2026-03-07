import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Play, Radio, Square } from 'lucide-react';
import { useProxy } from '../../hooks/useProxy';
import { cn } from '../ui/cn';

// ─── Waveform constants ────────────────────────────────────────────────────────
const SAMPLES = 360;
const VW      = 400;
const VH      = 56;
const BASE    = VH * 0.58;
const AMP     = VH * 0.44;

// Normalized QRS-complex shape
const QRS = [
  0, 0.05, 0.18, 0.52, 1.0, 0.84, 0.32,
  -0.14, -0.30, -0.26, -0.13, -0.04, 0.01,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

// ─── GatewayWaveform ──────────────────────────────────────────────────────────

type Phase = 'stopped' | 'running' | 'dying';

function GatewayWaveform({
  isRunning,
  requestCount,
}: {
  isRunning: boolean;
  requestCount: number;
}) {
  const traceRef = useRef<SVGPolylineElement>(null);
  const glowRef  = useRef<SVGPolylineElement>(null);
  const headRef  = useRef<SVGCircleElement>(null);
  const gridRef  = useRef<SVGGElement>(null);

  const stateRef = useRef({
    buf:         new Float32Array(SAMPLES).fill(0),
    wp:          0,
    spikePhase:  0,
    pending:     0,
    prevCount:   requestCount,
    breath:      0,
    phase:       'stopped' as Phase,
    dyingFrames: 0,
    raf:         0,
  });

  // ── Phase transitions on isRunning change ──────────────────────────────────
  const prevRunningRef = useRef(isRunning);
  useEffect(() => {
    const s   = stateRef.current;
    const was = prevRunningRef.current;
    prevRunningRef.current = isRunning;

    if (isRunning && !was) {
      // Gateway started → clean buffer
      s.buf.fill(0);
      s.wp          = 0;
      s.spikePhase  = 0;
      s.breath      = 0;
      s.pending     = 0;
      s.phase       = 'running';
    } else if (!isRunning && was) {
      // Gateway stopped → dying trail (keep buffer!)
      s.phase       = 'dying';
      s.dyingFrames = 0;
    }
  }, [isRunning]);

  // ── Queue spikes on new traffic ────────────────────────────────────────────
  useEffect(() => {
    const s    = stateRef.current;
    const diff = requestCount - s.prevCount;
    if (diff > 0 && s.phase === 'running') {
      s.pending = Math.min(s.pending + diff, 4);
    }
    s.prevCount = requestCount;
  }, [requestCount]);

  // ── Single persistent RAF loop ─────────────────────────────────────────────
  useEffect(() => {
    const s     = stateRef.current;
    const trace = traceRef.current;
    const glow  = glowRef.current;
    const head  = headRef.current;
    const grid  = gridRef.current;
    if (!trace) return;

    // Colours
    const GREEN  = 'oklch(0.60 0.20 155)';
    const RED    = 'oklch(0.58 0.22 25)';
    const DIM    = 'oklch(0.40 0.006 260)';
    const GGREEN = 'oklch(0.74 0.22 155)';
    const GRED   = 'oklch(0.68 0.24 25)';

    function tick() {
      const phase = s.phase;
      let sample  = 0;

      if (phase === 'running') {
        // Fire queued spike
        if (s.pending > 0 && s.spikePhase === 0) {
          s.spikePhase = 1;
          s.pending--;
        }
        if (s.spikePhase > 0) {
          const idx  = s.spikePhase - 1;
          sample     = idx < QRS.length ? QRS[idx] * AMP : 0;
          s.spikePhase = s.spikePhase >= QRS.length ? 0 : s.spikePhase + 1;
        } else {
          // Gentle alive baseline
          s.breath += 0.022;
          sample = Math.sin(s.breath) * 1.1 + (Math.random() - 0.5) * 0.8;
        }
      } else if (phase === 'dying') {
        // Exponential decay — signal collapses over ~3 s
        for (let i = 0; i < SAMPLES; i++) s.buf[i] *= 0.987;
        s.dyingFrames++;
        if (s.dyingFrames > 210) {
          s.buf.fill(0);
          s.phase = 'stopped';
        }
        sample = 0;
      }
      // stopped: sample stays 0

      s.buf[s.wp] = sample;
      s.wp = (s.wp + 1) % SAMPLES;

      // Build SVG points (oldest→newest = left→right)
      const pts: string[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const x = ((i / (SAMPLES - 1)) * VW).toFixed(1);
        const y = (BASE - s.buf[(s.wp + i) % SAMPLES]).toFixed(1);
        pts.push(`${x},${y}`);
      }
      const str = pts.join(' ');

      // Resolved phase (may have just flipped to 'stopped')
      const p  = s.phase;
      const tc = p === 'running' ? GREEN : p === 'dying' ? RED : DIM;
      const gc = p === 'dying'   ? GRED  : GGREEN;

      trace.setAttribute('points', str);
      trace.setAttribute('stroke', tc);
      trace.setAttribute('stroke-width',   p === 'stopped' ? '1'    : '1.5');
      trace.setAttribute('stroke-opacity', p === 'stopped' ? '0.22' : '1');

      if (glow) {
        glow.setAttribute('points', str);
        glow.setAttribute('stroke', gc);
        glow.setAttribute('stroke-opacity', p === 'stopped' ? '0' : '0.16');
      }

      // Scan-head dot
      if (head) {
        if (p === 'running') {
          const ny = (BASE - s.buf[(s.wp - 1 + SAMPLES) % SAMPLES]).toFixed(1);
          head.setAttribute('cy', ny);
          head.setAttribute('r',    '2.5');
          head.setAttribute('fill', GGREEN);
        } else {
          head.setAttribute('r', '0');
        }
      }

      // Grid opacity
      if (grid) grid.setAttribute('opacity', p === 'stopped' ? '0.05' : '0.10');

      s.raf = requestAnimationFrame(tick);
    }

    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, []); // intentionally empty — single persistent loop

  return (
    <div className="relative w-full select-none" style={{ height: VH }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height={VH}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="wf-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor="white" stopOpacity="0.05" />
            <stop offset="10%"  stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="wf-mask">
            <rect x="0" y="0" width={VW} height={VH} fill="url(#wf-fade)" />
          </mask>
          <filter id="wf-glow" x="-5%" y="-100%" width="110%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Monitor grid */}
        <g ref={gridRef} opacity="0.05" stroke="currentColor" strokeWidth="0.5">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`h${f}`} x1="0" y1={VH * f} x2={VW} y2={VH * f} />
          ))}
          {[1, 2, 3, 4, 5].map((i) => (
            <line key={`v${i}`} x1={(VW / 6) * i} y1="0" x2={(VW / 6) * i} y2={VH} />
          ))}
        </g>

        <g mask="url(#wf-mask)">
          {/* Glow — always mounted, opacity controlled imperatively */}
          <polyline
            ref={glowRef}
            points={`0,${BASE}`}
            fill="none"
            stroke={GGREEN}
            strokeWidth="6"
            strokeOpacity="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#wf-glow)"
          />
          {/* Main trace */}
          <polyline
            ref={traceRef}
            points={`0,${BASE}`}
            fill="none"
            stroke={DIM}
            strokeWidth="1"
            strokeOpacity="0.22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Scan head — r controlled imperatively */}
        <circle
          ref={headRef}
          cx={VW}
          cy={BASE}
          r="0"
          fill={GGREEN}
          filter="url(#wf-glow)"
        />
      </svg>
    </div>
  );
}

// Fix: declare colour constants for JSX access (mirrors the ones in the loop)
const GGREEN = 'oklch(0.74 0.22 155)';
const DIM    = 'oklch(0.40 0.006 260)';

// ─── ProxySettings ────────────────────────────────────────────────────────────

export function ProxySettings() {
  const { status, loading, startProxy, stopProxy, setLogBodies } = useProxy();
  const [port, setPort] = useState(9876);
  const [copied, setCopied] = useState<string | null>(null);

  const uptime = status.upSince ? formatUptime(new Date(status.upSince)) : null;

  const envExamples = [
    {
      label: 'Anthropic',
      key: 'ANTHROPIC_BASE_URL',
      value: `http://localhost:${status.port ?? port}/anthropic/v1`,
    },
    {
      label: 'OpenAI',
      key: 'OPENAI_BASE_URL',
      value: `http://localhost:${status.port ?? port}/openai/v1`,
    },
    {
      label: 'Google',
      key: 'GEMINI_BASE_URL',
      value: `http://localhost:${status.port ?? port}/google`,
    },
  ];

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-[28px] border border-white/8 p-5 space-y-4">

        {/* ── Header row ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Radio className="h-4 w-4 text-primary" />
              {status.running && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Local Gateway</h3>
              <p className="text-xs text-muted-foreground">
                {status.running
                  ? `Running on port ${status.port}`
                  : 'Route provider traffic through OmniView with automatic secret injection'}
              </p>
            </div>
          </div>

          {/* Right: swaps between port input and live stats */}
          <div className="flex shrink-0 items-center gap-2.5">
            <AnimatePresence mode="wait">
              {status.running ? (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex items-center gap-3 pr-1 text-xs"
                >
                  <div className="text-right leading-tight">
                    <div className="font-mono font-semibold tabular-nums text-foreground">
                      {status.requestCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">routed</div>
                  </div>
                  {uptime && (
                    <>
                      <div className="h-5 w-px bg-border" />
                      <div className="text-right leading-tight">
                        <div className="font-mono font-semibold text-foreground">{uptime}</div>
                        <div className="text-[10px] text-muted-foreground">uptime</div>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.input
                  key="port"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  type="number"
                  min={1024}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-20 rounded-xl border border-border bg-secondary/50 px-2 py-2 text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </AnimatePresence>

            <button
              onClick={status.running ? stopProxy : () => startProxy(port)}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                status.running
                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/92',
                loading && 'cursor-not-allowed opacity-50',
              )}
            >
              {status.running ? (
                <><Square className="h-3 w-3" />Stop</>
              ) : (
                <><Play className="h-3 w-3" />Start</>
              )}
            </button>
          </div>
        </div>

        {/* ── Waveform monitor ──────────────────────────────────────────────── */}
        <GatewayWaveform
          isRunning={status.running}
          requestCount={status.requestCount}
        />
      </div>

      {/* ── Connect your tools ────────────────────────────────────────────── */}
      <div className="glass rounded-[28px] border border-white/8 p-5 space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-foreground">
          Connect your tools
        </h4>
        <p className="text-xs text-muted-foreground">
          Use these environment variables to route traffic through the local gateway.
        </p>
        <div className="space-y-2">
          {envExamples.map((env) => (
            <div
              key={env.key}
              className="flex items-center gap-2 rounded-2xl bg-secondary/30 px-3 py-2.5"
            >
              <div className="w-20 text-[11px] text-muted-foreground">{env.label}</div>
              <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
                <span className="text-foreground">{env.key}</span>={env.value}
              </code>
              <button
                onClick={() => copyToClipboard(`${env.key}=${env.value}`, env.key)}
                className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {copied === env.key ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          The gateway injects secrets from your encrypted vault, so client apps do
          not need to ship raw provider keys.
        </p>
      </div>

      {/* ── Request body logging ───────────────────────────────────────────── */}
      <div className="glass rounded-[28px] border border-white/8 p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-medium text-foreground">Log request &amp; response bodies</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              When enabled, the full text of proxied requests and responses is stored in the local database.
              Disabled by default to avoid storing sensitive prompt content on disk.
            </p>
          </div>
          <button
            onClick={() => setLogBodies(!status.logRequestBodies)}
            className={cn(
              'relative shrink-0 h-6 w-11 rounded-full border transition-colors',
              status.logRequestBodies
                ? 'border-primary bg-primary'
                : 'border-border bg-secondary/50',
            )}
            role="switch"
            aria-checked={status.logRequestBodies}
            title={status.logRequestBodies ? 'Disable body logging' : 'Enable body logging'}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                status.logRequestBodies ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
        {status.logRequestBodies && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
            Body logging is on. Prompt text and API responses will be written to the local SQLite database in plain text.
          </p>
        )}
      </div>
    </div>
  );
}

function formatUptime(since: Date): string {
  const seconds = Math.floor((Date.now() - since.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  return `${hours}h ${mins}m`;
}
