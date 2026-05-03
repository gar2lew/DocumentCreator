import { create } from 'zustand';
import type { User, Project, Template } from '../shared/types';

interface AppState {
  // Auth
  currentUser: User | null;
  authLoading: boolean;
  setCurrentUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  // Projects
  projects: Project[];
  selectedProject: Project | null;
  setProjects: (projects: Project[]) => void;
  setSelectedProject: (project: Project | null) => void;

  // Templates
  templates: Template[];
  selectedTemplate: Template | null;
  setTemplates: (templates: Template[]) => void;
  setSelectedTemplate: (template: Template | null) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  authLoading: true,
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  projects: [],
  selectedProject: null,
  setProjects: (projects) => set({ projects }),
  setSelectedProject: (project) => set({ selectedProject: project }),

  templates: [],
  selectedTemplate: null,
  setTemplates: (templates) => set({ templates }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
