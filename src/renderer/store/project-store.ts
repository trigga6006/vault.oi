import { create } from 'zustand';
import type { ProjectRecord } from '../../shared/types/project.types';

interface ProjectState {
  projects: ProjectRecord[];
  activeProjectId: number | null;
  setProjects: (projects: ProjectRecord[]) => void;
  setActiveProjectId: (id: number | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
}));
