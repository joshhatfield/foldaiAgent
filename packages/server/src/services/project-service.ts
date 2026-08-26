import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export interface Project extends ManifestEntry {
  description: string;
  path: string;
  contextFiles: string[];
}

export interface CreateProjectInput {
  name: string;
  description: string;
  path: string;
  contextFiles?: string[];
}

export interface ProjectService {
  list(companySlug: string): Promise<Project[]>;
  getById(companySlug: string, id: string): Promise<Project | undefined>;
  create(companySlug: string, input: CreateProjectInput): Promise<Project>;
  update(companySlug: string, id: string, updates: Partial<Project>): Promise<Project | undefined>;
  remove(companySlug: string, id: string): Promise<boolean>;
}

function projectsPath(companySlug: string): string {
  return `companies/${companySlug}/projects.json`;
}

export function createProjectService(store: FileStore): ProjectService {
  const getManifest = (companySlug: string) =>
    createManifest<Project>(store, projectsPath(companySlug));

  const list = async (companySlug: string): Promise<Project[]> => {
    return getManifest(companySlug).list();
  };

  const getById = async (companySlug: string, id: string): Promise<Project | undefined> => {
    return getManifest(companySlug).getById(id);
  };

  const create = async (companySlug: string, input: CreateProjectInput): Promise<Project> => {
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      name: input.name,
      description: input.description,
      path: input.path,
      contextFiles: input.contextFiles ?? [],
      createdAt: now,
      updatedAt: now,
    };

    return getManifest(companySlug).add(project);
  };

  const update = async (
    companySlug: string,
    id: string,
    updates: Partial<Project>,
  ): Promise<Project | undefined> => {
    return getManifest(companySlug).update(id, updates);
  };

  const remove = async (companySlug: string, id: string): Promise<boolean> => {
    return getManifest(companySlug).remove(id);
  };

  return { list, getById, create, update, remove };
}