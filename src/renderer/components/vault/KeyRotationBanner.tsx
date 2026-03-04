import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useUiStore } from '../../store/ui-store';

interface RotationReminder {
  keyId: number;
  providerId: string;
  keyLabel: string;
  ageDays: number;
  policyDays: number;
}

export function KeyRotationBanner() {
  const [reminders, setReminders] = useState<RotationReminder[]>([]);
  const { setActiveView } = useUiStore();

  useEffect(() => {
    const unsub = window.omniview.on(
      'key:rotation-reminder',
      (data: unknown) => {
        setReminders(data as RotationReminder[]);
      },
    );
    return unsub;
  }, []);

  if (reminders.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-[24px] border border-amber-400/40 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Secret rotation recommended
        </p>
        {reminders.map((reminder) => (
          <p key={reminder.keyId} className="text-[11px] text-muted-foreground">
            <span className="text-foreground">{reminder.providerId}</span> - "
            {reminder.keyLabel}" is {reminder.ageDays} days old (policy:{' '}
            {reminder.policyDays} days)
          </p>
        ))}
      </div>
      <button
        onClick={() => setActiveView('vault')}
        className="flex shrink-0 items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
      >
        <RotateCcw className="h-3 w-3" />
        Open secrets
      </button>
    </div>
  );
}
