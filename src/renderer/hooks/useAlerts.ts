import { useCallback, useState } from 'react';
import type { AlertRuleRecord, AlertEventRecord } from '../../shared/types/models.types';

export function useAlerts() {
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [events, setEvents] = useState<AlertEventRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('alerts:list-rules', undefined);
      setRules(result as any);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async (ruleId?: number, limit?: number) => {
    const result = await window.omniview.invoke('alerts:list-events', { ruleId, limit });
    setEvents(result as any);
  }, []);

  return { rules, events, loading, fetchRules, fetchEvents };
}
