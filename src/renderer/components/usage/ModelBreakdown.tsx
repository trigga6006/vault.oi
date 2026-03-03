import { motion } from 'framer-motion';
import { ProviderLogo } from '../providers/ProviderLogo';

interface ModelBreakdownProps {
  data: Array<{
    model: string;
    providerId: string;
    costUsd: number;
    tokenCount: number;
    requestCount: number;
  }>;
}

export function ModelBreakdown({ data }: ModelBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-xl p-5">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Model Breakdown
        </h3>
        <p className="text-sm text-muted-foreground">No model data yet</p>
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.01);

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Model Breakdown
      </h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <motion.div
            key={`${item.providerId}-${item.model}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <ProviderLogo providerId={item.providerId} size={14} />
                <span className="text-foreground font-medium truncate mr-2">{item.model}</span>
              </div>
              <span className="text-muted-foreground font-mono">${item.costUsd.toFixed(4)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.costUsd / maxCost) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span>{item.requestCount} requests</span>
              <span>
                {item.tokenCount >= 1000
                  ? `${(item.tokenCount / 1000).toFixed(1)}K tokens`
                  : `${item.tokenCount} tokens`}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
