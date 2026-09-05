import { create } from 'zustand';
import { api, type Company } from '../api/client';

interface CompanyState {
  companies: Company[];
  selectedSlug: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (name: string) => Promise<Company>;
  select: (slug: string) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  selectedSlug: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const { companies } = await api.companies.list();
      set({ companies, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (name: string) => {
    const { company } = await api.companies.create(name);
    set((s) => ({ companies: [...s.companies, company] }));
    return company;
  },

  select: (slug: string) => {
    set({ selectedSlug: slug });
  },
}));