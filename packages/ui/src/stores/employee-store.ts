import { create } from 'zustand';
import { api, type Employee } from '../api/client';

interface EmployeeState {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  load: (slug: string) => Promise<void>;
  create: (slug: string, data: { name: string; role: string; persona: string; agent: string; skills?: string[]; model: string }) => Promise<Employee>;
  update: (slug: string, id: string, data: Partial<Employee>) => Promise<void>;
  remove: (slug: string, id: string) => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  loading: false,
  error: null,

  load: async (slug: string) => {
    set({ loading: true, error: null });
    try {
      const { employees } = await api.employees.list(slug);
      set({ employees, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (slug, data) => {
    const { employee } = await api.employees.create(slug, data);
    set((s) => ({ employees: [...s.employees, employee] }));
    return employee;
  },

  update: async (slug, id, data) => {
    const { employee } = await api.employees.update(slug, id, data);
    set((s) => ({
      employees: s.employees.map((e) => (e.id === id ? employee : e)),
    }));
  },

  remove: async (slug, id) => {
    await api.employees.remove(slug, id);
    set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }));
  },
}));