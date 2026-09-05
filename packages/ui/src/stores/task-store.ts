import { create } from 'zustand';
import { api, type Task, type TaskStatus } from '../api/client';

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  load: (slug: string, filters?: { status?: TaskStatus; projectId?: string }) => Promise<void>;
  create: (slug: string, data: { projectId?: string | null; title: string; description: string; status?: TaskStatus }) => Promise<Task>;
  update: (slug: string, id: string, data: Partial<Task>) => Promise<void>;
  remove: (slug: string, id: string) => Promise<void>;
  run: (slug: string, id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  load: async (slug, filters) => {
    set({ loading: true, error: null });
    try {
      const { tasks } = await api.tasks.list(slug, filters);
      set({ tasks, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (slug, data) => {
    const { task } = await api.tasks.create(slug, data);
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  update: async (slug, id, data) => {
    const { task } = await api.tasks.update(slug, id, data);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? task : t)),
    }));
  },

  remove: async (slug, id) => {
    await api.tasks.remove(slug, id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  run: async (slug, id) => {
    await api.tasks.run(slug, id);
  },
}));