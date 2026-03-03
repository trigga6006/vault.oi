import { motion } from 'framer-motion';
import { GitCompareArrows } from 'lucide-react';

export function ComparisonView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Model Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare responses across models side-by-side
        </p>
      </div>

      <div className="glass rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <GitCompareArrows className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Configure at least two providers to start comparing models
        </p>
      </div>
    </motion.div>
  );
}
