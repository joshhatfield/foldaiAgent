import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export interface FileStore {
  readJSON<T>(filePath: string): Promise<T>;
  writeJSON<T>(filePath: string, data: T): Promise<void>;
  readText(filePath: string): Promise<string>;
  writeText(filePath: string, content: string): Promise<void>;
  listDir(dirPath: string): Promise<string[]>;
  exists(filePath: string): Promise<boolean>;
  ensureDir(dirPath: string): Promise<void>;
}

export function createFileStore(baseDir: string): FileStore {
  const resolvePath = (relativePath: string): string =>
    resolve(baseDir, relativePath);

  const ensureDir = async (dirPath: string): Promise<void> => {
    await mkdir(resolvePath(dirPath), { recursive: true });
  };

  const readJSON = async <T>(filePath: string): Promise<T> => {
    const raw = await readFile(resolvePath(filePath), 'utf-8');
    return JSON.parse(raw) as T;
  };

  const writeJSON = async <T>(filePath: string, data: T): Promise<void> => {
    const fullPath = resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    const json = JSON.stringify(data, null, 2);
    await writeFile(fullPath, json, 'utf-8');
  };

  const readText = async (filePath: string): Promise<string> => {
    return readFile(resolvePath(filePath), 'utf-8');
  };

  const writeText = async (filePath: string, content: string): Promise<void> => {
    const fullPath = resolvePath(filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  };

  const listDir = async (dirPath: string): Promise<string[]> => {
    try {
      return await readdir(resolvePath(dirPath));
    } catch {
      return [];
    }
  };

  const exists = async (filePath: string): Promise<boolean> => {
    try {
      await access(resolvePath(filePath));
      return true;
    } catch {
      return false;
    }
  };

  return { readJSON, writeJSON, readText, writeText, listDir, exists, ensureDir };
}