import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { VaultProfileState } from '../../shared/types/profile.types';

export function useProfiles() {
  const [state, setState] = useState<VaultProfileState | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.omniview.invoke('profiles:get-state', undefined);
      setState(result);
    } catch {
      toast.error('Failed to load vault profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const createProfile = useCallback(async (name: string) => {
    await window.omniview.invoke('profiles:create', { name });
    await fetchState();
    toast.success('Profile created');
  }, [fetchState]);

  const switchProfile = useCallback(async (profileId: string) => {
    await window.omniview.invoke('profiles:switch', { profileId });
  }, []);

  return {
    state,
    loading,
    createProfile,
    switchProfile,
    refresh: fetchState,
  };
}
