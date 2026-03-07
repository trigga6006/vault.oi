import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GraphFocusTarget } from '../../shared/types/graph.types';

export type NavView =
  | 'overview'
  | 'vault'
  | 'graph'
  | 'providers'
  | 'projects'
  | 'credentials'
  | 'settings';

export type PetKind = 'uv' | 'void' | 'crystal';

interface UiState {
  activeView: NavView;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  graphFocus: GraphFocusTarget | null;
  petKind: PetKind;
  setActiveView: (view: NavView) => void;
  setGraphFocus: (focus: GraphFocusTarget | null) => void;
  openGraph: (focus: GraphFocusTarget) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPetKind: (kind: PetKind) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeView: 'overview',
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      theme: 'dark',
      graphFocus: null,
      petKind: 'uv',
      setActiveView: (view) => set({ activeView: view }),
      setGraphFocus: (focus) => set({ graphFocus: focus }),
      openGraph: (focus) => set({ activeView: 'graph', graphFocus: focus }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      setTheme: (theme) => set({ theme }),
      setPetKind: (kind) => set({ petKind: kind }),
    }),
    {
      name: 'omniview-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ petKind: state.petKind, theme: state.theme }),
    },
  ),
);
