import { useCallback, useEffect } from 'react';
import { useVaultStore } from '../store/vault-store';
import type { VaultStatus } from '../../shared/types/vault.types';

export function useVault() {
  const { initialized, unlocked, autoLockMinutes, checking, setVaultStatus, lock } =
    useVaultStore();

  const fetchStatus = useCallback(async () => {
    try {
      const status = (await window.omniview.invoke(
        'vault:status',
        undefined,
      )) as VaultStatus;
      setVaultStatus(status);
    } catch {
      setVaultStatus({ initialized: false, unlocked: false, autoLockMinutes: 15 });
    }
  }, [setVaultStatus]);

  const initializeVault = useCallback(
    async (password: string) => {
      const result = (await window.omniview.invoke('vault:initialize', {
        password,
      })) as { success: boolean };
      if (result.success) {
        await fetchStatus();
      }
      return result.success;
    },
    [fetchStatus],
  );

  const unlockVault = useCallback(
    async (password: string) => {
      const result = (await window.omniview.invoke('vault:unlock', {
        password,
      })) as { success: boolean };
      if (result.success) {
        await fetchStatus();
      }
      return result.success;
    },
    [fetchStatus],
  );

  const lockVault = useCallback(async () => {
    await window.omniview.invoke('vault:lock', undefined);
    lock();
  }, [lock]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const result = (await window.omniview.invoke('vault:change-password', {
        currentPassword,
        newPassword,
      })) as { success: boolean };
      return result.success;
    },
    [],
  );

  const setAutoLock = useCallback(
    async (minutes: number) => {
      await window.omniview.invoke('vault:set-auto-lock', { minutes });
      await fetchStatus();
    },
    [fetchStatus],
  );

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Listen for lock events from main process (auto-lock)
  useEffect(() => {
    const unsub = window.omniview.on('vault:locked', () => {
      lock();
    });
    return unsub;
  }, [lock]);

  return {
    initialized,
    unlocked,
    autoLockMinutes,
    checking,
    initializeVault,
    unlockVault,
    lockVault,
    changePassword,
    setAutoLock,
  };
}
