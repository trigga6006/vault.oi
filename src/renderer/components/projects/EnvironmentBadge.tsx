import { cn } from '../ui/cn';
import type { Environment } from '../../../shared/types/project.types';

const ENV_STYLES: Record<Environment, { bg: string; text: string; label: string }> = {
  dev: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'Dev' },
  staging: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', label: 'Staging' },
  prod: { bg: 'bg-emerald-100 dark:bg-green-500/20', text: 'text-emerald-700 dark:text-green-400', label: 'Prod' },
};

interface EnvironmentBadgeProps {
  environment: Environment;
  className?: string;
}

export function EnvironmentBadge({ environment, className }: EnvironmentBadgeProps) {
  const style = ENV_STYLES[environment];
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
