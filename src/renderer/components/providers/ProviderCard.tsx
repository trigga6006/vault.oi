import { motion } from 'framer-motion';
import { Settings, Trash2, RefreshCw } from 'lucide-react';
import { HealthBadge } from './HealthBadge';
import { ProviderLogo } from './ProviderLogo';
import type { ProviderConfigRecord } from '../../../shared/types/models.types';
import type { HealthCheckResult } from '../../../shared/types/provider.types';

interface ProviderCardProps {
  config: ProviderConfigRecord;
  health?: HealthCheckResult;
  onConfigure: (providerId: string) => void;
  onRemove: (providerId: string) => void;
  onHealthCheck: (providerId: string) => void;
}

export function ProviderCard({ config, health, onConfigure, onRemove, onHealthCheck }: ProviderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass rounded-[24px] border border-white/8 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProviderLogo providerId={config.providerId} size={40} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{config.displayName}</h3>
            <p className="text-xs text-muted-foreground">{config.providerId}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onHealthCheck(config.providerId)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Check health"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => onConfigure(config.providerId)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Configure"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRemove(config.providerId)}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <HealthBadge
          status={health?.status ?? 'unknown'}
          latencyMs={health?.latencyMs}
        />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {config.enabled ? (
            <span className="text-green-400">Ready</span>
          ) : (
            <span className="text-zinc-500">Disabled</span>
          )}
          <span>Sync: {config.usageFetchInterval}m</span>
        </div>
      </div>

      {config.lastUsageFetch && (
        <p className="text-[10px] text-muted-foreground">
          Last sync: {new Date(config.lastUsageFetch).toLocaleString()}
        </p>
      )}
    </motion.div>
  );
}
