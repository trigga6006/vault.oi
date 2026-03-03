import { create } from 'zustand';

interface VaultState {
  initialized: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
  checking: boolean;
  setVaultStatus: (status: { initialized: boolean; unlocked: boolean; autoLockMinutes: number }) => void;
  setChecking: (checking: boolean) => void;
  lock: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  initialized: false,
  unlocked: false,
  autoLockMinutes: 15,
  checking: true,
  setVaultStatus: (status) =>
    set({
      initialized: status.initialized,
      unlocked: status.unlocked,
      autoLockMinutes: status.autoLockMinutes,
      checking: false,
    }),
  setChecking: (checking) => set({ checking }),
  lock: () => set({ unlocked: false }),
}));
