import { motion } from 'framer-motion';
import { Zap, MessageSquare, AlertTriangle, Clock } from 'lucide-react';

interface QuickStatsProps {
  totalRequests: number;
  totalTokens: number;
  errorRate: number;
  avgLatency: number | null;
}

export function QuickStats({ totalRequests, totalTokens, errorRate, avgLatency }: QuickStatsProps) {
  const stats = [
    {
      label: 'Total Requests',
      value: totalRequests.toLocaleString(),
      icon: MessageSquare,
    },
    {
      label: 'Total Tokens',
      value: totalTokens >= 1_000_000
        ? `${(totalTokens / 1_000_000).toFixed(1)}M`
        : totalTokens >= 1_000
        ? `${(totalTokens / 1_000).toFixed(1)}K`
        : totalTokens.toString(),
      icon: Zap,
    },
    {
      label: 'Error Rate',
      value: `${(errorRate * 100).toFixed(1)}%`,
      icon: AlertTriangle,
    },
    {
      label: 'Avg Latency',
      value: avgLatency ? `${avgLatency.toFixed(0)}ms` : 'N/A',
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
            className="glass-subtle rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-sm font-semibold text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
