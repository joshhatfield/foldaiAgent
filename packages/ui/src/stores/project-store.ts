import { create } from 'zustand';
import { api, type Project } from '../api/client';

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  load: (slug: string) => Promise<void>;
  create: (slug: string, data: { name: string; description: string; path: string; contextFiles?: string[] }) => Promise<Project>;
  update: (slug: string, id: string, data: Partial<Project>) => Promise<void>;
  remove: (slug: string, id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  load: async (slug: string) => {
    set({ loading: true, error: null });
    try {
      const { projects } = await api.projects.list(slug);
      set({ projects, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (slug, data) => {
    const { project } = await api.projects.create(slug, data);
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  update: async (slug, id, data) => {
    const { project } = await api.projects.update(slug, id, data);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? project : p)),
    }));
  },

  remove: async (slug, id) => {
    await api.projects.remove(slug, id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
}));