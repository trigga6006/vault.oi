import { useCallback, useState } from 'react';
import type { RequestLogRecord } from '../../shared/types/models.types';
import type { LogQuery } from '../../shared/types/ipc.types';

export function useRequestLogs() {
  const [logs, setLogs] = useState<RequestLogRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (query: LogQuery) => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('logs:query', query);
      setLogs(result as any);
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, loading, fetchLogs };
}
