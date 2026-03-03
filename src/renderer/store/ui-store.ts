import { create } from 'zustand';

export type NavView =
  | 'overview'
  | 'vault'
  | 'providers'
  | 'projects'
  | 'settings';

interface UiState {
  activeView: NavView;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  setActiveView: (view: NavView) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'overview',
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  theme: 'dark',
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  setTheme: (theme) => set({ theme }),
}));
