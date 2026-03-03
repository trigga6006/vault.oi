import { motion } from 'framer-motion';
import { Bell, Plus } from 'lucide-react';

export function AlertRuleList() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up spending and performance alerts
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Alert Rule
        </button>
      </div>

      <div className="glass rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Bell className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No alert rules configured. Create one to get notified about cost or performance thresholds.
        </p>
      </div>
    </motion.div>
  );
}
