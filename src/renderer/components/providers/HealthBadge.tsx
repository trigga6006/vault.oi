import { cn } from '../ui/cn';

interface HealthBadgeProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs?: number;
}

const statusConfig = {
  healthy: { label: 'Healthy', color: 'bg-green-500', textColor: 'text-green-400' },
  degraded: { label: 'Degraded', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
  unhealthy: { label: 'Unhealthy', color: 'bg-red-500', textColor: 'text-red-400' },
  unknown: { label: 'Unknown', color: 'bg-zinc-500', textColor: 'text-zinc-400' },
};

export function HealthBadge({ status, latencyMs }: HealthBadgeProps) {
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className={cn('text-xs font-medium', config.textColor)}>
        {config.label}
      </span>
      {latencyMs !== undefined && (
        <span className="text-xs text-muted-foreground font-mono">{latencyMs}ms</span>
      )}
    </div>
  );
}
