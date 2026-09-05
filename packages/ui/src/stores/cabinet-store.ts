import { create } from 'zustand';
import { api, type CabinetFile, type CabinetFileType } from '../api/client';

interface CabinetState {
  files: CabinetFile[];
  selectedContent: string | null;
  loading: boolean;
  error: string | null;
  load: (slug: string) => Promise<void>;
  create: (slug: string, data: { name: string; content: string; type: CabinetFileType; linkedTaskIds?: string[]; linkedProjectIds?: string[] }) => Promise<CabinetFile>;
  loadContent: (slug: string, id: string) => Promise<void>;
  update: (slug: string, id: string, data: Partial<CabinetFile>) => Promise<void>;
  updateContent: (slug: string, id: string, content: string) => Promise<void>;
  remove: (slug: string, id: string) => Promise<void>;
}

export const useCabinetStore = create<CabinetState>((set) => ({
  files: [],
  selectedContent: null,
  loading: false,
  error: null,

  load: async (slug: string) => {
    set({ loading: true, error: null });
    try {
      const { files } = await api.cabinet.list(slug);
      set({ files, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (slug, data) => {
    const { file } = await api.cabinet.create(slug, data);
    set((s) => ({ files: [...s.files, file] }));
    return file;
  },

  loadContent: async (slug, id) => {
    try {
      const { content } = await api.cabinet.getContent(slug, id);
      set({ selectedContent: content });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  update: async (slug, id, data) => {
    const { file } = await api.cabinet.update(slug, id, data);
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? file : f)),
    }));
  },

  updateContent: async (slug, id, content) => {
    await api.cabinet.updateContent(slug, id, content);
    set({ selectedContent: content });
  },

  remove: async (slug, id) => {
    await api.cabinet.remove(slug, id);
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
  },
}));