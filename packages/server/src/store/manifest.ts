import type { FileStore } from './file-store.js';

export interface ManifestEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntityManifest<T extends ManifestEntry> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  add(entry: T): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createManifest<T extends ManifestEntry>(
  store: FileStore,
  filePath: string,
): EntityManifest<T> {
  const readAll = async (): Promise<T[]> => {
    const exists = await store.exists(filePath);
    if (!exists) return [];
    return store.readJSON<T[]>(filePath);
  };

  const writeAll = async (entries: T[]): Promise<void> => {
    await store.writeJSON(filePath, entries);
  };

  const list = async (): Promise<T[]> => {
    return readAll();
  };

  const getById = async (id: string): Promise<T | undefined> => {
    const entries = await readAll();
    return entries.find((e) => e.id === id);
  };

  const add = async (entry: T): Promise<T> => {
    const entries = await readAll();
    entries.push(entry);
    await writeAll(entries);
    return entry;
  };

  const update = async (id: string, updates: Partial<T>): Promise<T | undefined> => {
    const entries = await readAll();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return undefined;

    const updated = { ...entries[index]!, ...updates, updatedAt: new Date().toISOString() };
    entries[index] = updated;
    await writeAll(entries);
    return updated;
  };

  const remove = async (id: string): Promise<boolean> => {
    const entries = await readAll();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    entries.splice(index, 1);
    await writeAll(entries);
    return true;
  };

  return { list, getById, add, update, remove };
}