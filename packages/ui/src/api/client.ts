const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' });
}

// Types
export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  persona: string;
  agent: string;
  skills: string[];
  model: string;
  status: 'available' | 'busy';
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  contextFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'planned' | 'todo' | 'in_progress' | 'for_review' | 'complete' | 'blocked' | 'cancelled';

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo: string | null;
  sessionId: string | null;
  outputFile: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CabinetFileType = 'company' | 'project' | 'task';

export interface CabinetFile {
  id: string;
  name: string;
  path: string;
  type: CabinetFileType;
  linkedTaskIds: string[];
  linkedProjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

// API
export const api = {
  // Models
  models: {
    list: () => get<{ models: string[] }>('/models'),
  },

  // Companies
  companies: {
    list: () => get<{ companies: Company[] }>('/companies'),
    create: (name: string) => post<{ company: Company }>('/companies', { name }),
    get: (slug: string) => get<{ company: Company }>(`/companies/${slug}`),
  },

  // Employees
  employees: {
    list: (slug: string) => get<{ employees: Employee[] }>(`/companies/${slug}/employees`),
    create: (slug: string, data: { name: string; role: string; persona: string; agent: string; skills?: string[]; model: string }) =>
      post<{ employee: Employee }>(`/companies/${slug}/employees`, data),
    get: (slug: string, id: string) => get<{ employee: Employee }>(`/companies/${slug}/employees/${id}`),
    update: (slug: string, id: string, data: Partial<Employee>) =>
      put<{ employee: Employee }>(`/companies/${slug}/employees/${id}`, data),
    remove: (slug: string, id: string) => del<{ success: boolean }>(`/companies/${slug}/employees/${id}`),
  },

  // Projects
  projects: {
    list: (slug: string) => get<{ projects: Project[] }>(`/companies/${slug}/projects`),
    create: (slug: string, data: { name: string; description: string; path: string; contextFiles?: string[] }) =>
      post<{ project: Project }>(`/companies/${slug}/projects`, data),
    get: (slug: string, id: string) => get<{ project: Project }>(`/companies/${slug}/projects/${id}`),
    update: (slug: string, id: string, data: Partial<Project>) =>
      put<{ project: Project }>(`/companies/${slug}/projects/${id}`, data),
    remove: (slug: string, id: string) => del<{ success: boolean }>(`/companies/${slug}/projects/${id}`),
  },

  // Tasks
  tasks: {
    list: (slug: string, filters?: { status?: TaskStatus; projectId?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.projectId) params.set('projectId', filters.projectId);
      const qs = params.toString();
      return get<{ tasks: Task[] }>(`/companies/${slug}/tasks${qs ? `?${qs}` : ''}`);
    },
    create: (slug: string, data: { projectId?: string | null; title: string; description: string; status?: TaskStatus }) =>
      post<{ task: Task }>(`/companies/${slug}/tasks`, data),
    get: (slug: string, id: string) => get<{ task: Task }>(`/companies/${slug}/tasks/${id}`),
    update: (slug: string, id: string, data: Partial<Task>) =>
      put<{ task: Task }>(`/companies/${slug}/tasks/${id}`, data),
    remove: (slug: string, id: string) => del<{ success: boolean }>(`/companies/${slug}/tasks/${id}`),
    run: (slug: string, id: string) => post<{ message: string }>(`/companies/${slug}/tasks/${id}/run`, {}),
    getOutput: (slug: string, id: string) => get<{ content: string }>(`/companies/${slug}/tasks/${id}/output`),
  },

  // Cabinet
  cabinet: {
    list: (slug: string) => get<{ files: CabinetFile[] }>(`/companies/${slug}/cabinet`),
    create: (slug: string, data: { name: string; content: string; type: CabinetFileType; linkedTaskIds?: string[]; linkedProjectIds?: string[] }) =>
      post<{ file: CabinetFile }>(`/companies/${slug}/cabinet`, data),
    get: (slug: string, id: string) => get<{ file: CabinetFile }>(`/companies/${slug}/cabinet/${id}`),
    getContent: (slug: string, id: string) => get<{ content: string }>(`/companies/${slug}/cabinet/${id}/content`),
    update: (slug: string, id: string, data: Partial<CabinetFile>) =>
      put<{ file: CabinetFile }>(`/companies/${slug}/cabinet/${id}`, data),
    updateContent: (slug: string, id: string, content: string) =>
      put<{ success: boolean }>(`/companies/${slug}/cabinet/${id}/content`, { content }),
    remove: (slug: string, id: string) => del<{ success: boolean }>(`/companies/${slug}/cabinet/${id}`),
  },
};