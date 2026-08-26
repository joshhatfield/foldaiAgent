import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export type TaskStatus =
  | 'planned'
  | 'todo'
  | 'in_progress'
  | 'for_review'
  | 'complete'
  | 'blocked'
  | 'cancelled';

export interface Task extends ManifestEntry {
  projectId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo: string | null;
  sessionId: string | null;
  outputFile: string | null;
  retryCount: number;
}

export interface CreateTaskInput {
  projectId?: string | null;
  title: string;
  description: string;
  status?: TaskStatus;
}

export interface TaskFilters {
  status?: TaskStatus;
  projectId?: string;
}

export interface TaskService {
  list(companySlug: string, filters?: TaskFilters): Promise<Task[]>;
  getById(companySlug: string, id: string): Promise<Task | undefined>;
  create(companySlug: string, input: CreateTaskInput): Promise<Task>;
  update(companySlug: string, id: string, updates: Partial<Task>): Promise<Task | undefined>;
  remove(companySlug: string, id: string): Promise<boolean>;
}

function tasksPath(companySlug: string): string {
  return `companies/${companySlug}/tasks.json`;
}

function applyFilters(tasks: Task[], filters?: TaskFilters): Task[] {
  if (!filters) return tasks;

  return tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    return true;
  });
}

export function createTaskService(store: FileStore): TaskService {
  const getManifest = (companySlug: string) =>
    createManifest<Task>(store, tasksPath(companySlug));

  const list = async (companySlug: string, filters?: TaskFilters): Promise<Task[]> => {
    const tasks = await getManifest(companySlug).list();
    return applyFilters(tasks, filters);
  };

  const getById = async (companySlug: string, id: string): Promise<Task | undefined> => {
    return getManifest(companySlug).getById(id);
  };

  const create = async (companySlug: string, input: CreateTaskInput): Promise<Task> => {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuid(),
      projectId: input.projectId ?? null,
      title: input.title,
      description: input.description,
      status: input.status ?? 'planned',
      assignedTo: null,
      sessionId: null,
      outputFile: null,
      retryCount: 0,
      name: input.title,
      createdAt: now,
      updatedAt: now,
    };

    return getManifest(companySlug).add(task);
  };

  const update = async (
    companySlug: string,
    id: string,
    updates: Partial<Task>,
  ): Promise<Task | undefined> => {
    return getManifest(companySlug).update(id, updates);
  };

  const remove = async (companySlug: string, id: string): Promise<boolean> => {
    return getManifest(companySlug).remove(id);
  };

  return { list, getById, create, update, remove };
}