import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Play, Radio, Square } from 'lucide-react';
import { useProxy } from '../../hooks/useProxy';
import { cn } from '../ui/cn';

export function ProxySettings() {
  const { status, loading, startProxy, stopProxy } = useProxy();
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
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

          <div className="flex items-center gap-2">
            {!status.running && (
              <input
                type="number"
                min={1024}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-20 rounded-xl border border-border bg-secondary/50 px-2 py-2 text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
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
                <>
                  <Square className="h-3 w-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {status.running && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-4 text-xs"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">
                  {status.requestCount}
                </span>
                routed requests
              </div>
              {uptime && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  up <span className="font-medium text-foreground">{uptime}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              <div className="w-20 text-[11px] text-muted-foreground">
                {env.label}
              </div>
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
    </div>
  );
}

function formatUptime(since: Date): string {
  const seconds = Math.floor((Date.now() - since.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
