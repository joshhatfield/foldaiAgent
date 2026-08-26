import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export type CabinetFileType = 'company' | 'project' | 'task';

export interface CabinetFile extends ManifestEntry {
  path: string;
  type: CabinetFileType;
  linkedTaskIds: string[];
  linkedProjectIds: string[];
}

export interface CreateCabinetFileInput {
  name: string;
  content: string;
  type: CabinetFileType;
  linkedTaskIds?: string[];
  linkedProjectIds?: string[];
}

export interface CabinetService {
  list(companySlug: string): Promise<CabinetFile[]>;
  getById(companySlug: string, id: string): Promise<CabinetFile | undefined>;
  getContent(companySlug: string, id: string): Promise<string | undefined>;
  findByTaskId(companySlug: string, taskId: string): Promise<CabinetFile | undefined>;
  getContentByTaskId(companySlug: string, taskId: string): Promise<string | undefined>;
  create(companySlug: string, input: CreateCabinetFileInput): Promise<CabinetFile>;
  update(companySlug: string, id: string, updates: Partial<CabinetFile>): Promise<CabinetFile | undefined>;
  updateContent(companySlug: string, id: string, content: string): Promise<boolean>;
  remove(companySlug: string, id: string): Promise<boolean>;
}

function manifestPath(companySlug: string): string {
  return `companies/${companySlug}/cabinet/manifest.json`;
}

function filePath(companySlug: string, fileName: string): string {
  return `companies/${companySlug}/cabinet/files/${fileName}`;
}

export function createCabinetService(store: FileStore): CabinetService {
  const getManifest = (companySlug: string) =>
    createManifest<CabinetFile>(store, manifestPath(companySlug));

  const list = async (companySlug: string): Promise<CabinetFile[]> => {
    return getManifest(companySlug).list();
  };

  const getById = async (companySlug: string, id: string): Promise<CabinetFile | undefined> => {
    return getManifest(companySlug).getById(id);
  };

  const getContent = async (companySlug: string, id: string): Promise<string | undefined> => {
    const file = await getById(companySlug, id);
    if (!file) return undefined;

    try {
      return await store.readText(filePath(companySlug, file.path));
    } catch {
      return undefined;
    }
  };

  const findByTaskId = async (companySlug: string, taskId: string): Promise<CabinetFile | undefined> => {
    const files = await list(companySlug);
    return files.find((f) => f.linkedTaskIds.includes(taskId));
  };

  const getContentByTaskId = async (companySlug: string, taskId: string): Promise<string | undefined> => {
    const file = await findByTaskId(companySlug, taskId);
    if (!file) return undefined;
    return getContent(companySlug, file.id);
  };

  const create = async (companySlug: string, input: CreateCabinetFileInput): Promise<CabinetFile> => {
    const now = new Date().toISOString();
    const id = uuid();
    const fileName = `${id}.md`;

    const cabinetFile: CabinetFile = {
      id,
      name: input.name,
      path: fileName,
      type: input.type,
      linkedTaskIds: input.linkedTaskIds ?? [],
      linkedProjectIds: input.linkedProjectIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    // Write the markdown content
    await store.writeText(filePath(companySlug, fileName), input.content);

    // Add to manifest
    return getManifest(companySlug).add(cabinetFile);
  };

  const update = async (
    companySlug: string,
    id: string,
    updates: Partial<CabinetFile>,
  ): Promise<CabinetFile | undefined> => {
    return getManifest(companySlug).update(id, updates);
  };

  const updateContent = async (companySlug: string, id: string, content: string): Promise<boolean> => {
    const file = await getById(companySlug, id);
    if (!file) return false;

    await store.writeText(filePath(companySlug, file.path), content);
    await getManifest(companySlug).update(id, { updatedAt: new Date().toISOString() });
    return true;
  };

  const remove = async (companySlug: string, id: string): Promise<boolean> => {
    const file = await getById(companySlug, id);
    if (!file) return false;

    // Remove from manifest (the actual .md file stays on disk for now)
    return getManifest(companySlug).remove(id);
  };

  return { list, getById, getContent, findByTaskId, getContentByTaskId, create, update, updateContent, remove };
}