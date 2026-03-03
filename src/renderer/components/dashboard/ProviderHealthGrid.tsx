import { motion } from 'framer-motion';
import { cn } from '../ui/cn';
import { ProviderLogo } from '../providers/ProviderLogo';

interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-zinc-500',
};

interface ProviderHealthGridProps {
  providers: ProviderHealth[];
}

export function ProviderHealthGrid({ providers }: ProviderHealthGridProps) {
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Provider Health
      </h3>
      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No providers configured. Add one in Settings.
        </p>
      ) : (
        <div className="space-y-2">
          {providers.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2.5">
                <div className={cn('h-2 w-2 rounded-full', statusColors[provider.status])} />
                <ProviderLogo providerId={provider.id} size={18} />
                <span className="text-sm text-foreground">{provider.name}</span>
              </div>
              {provider.latencyMs !== undefined && (
                <span className="text-xs text-muted-foreground font-mono">
                  {provider.latencyMs}ms
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
