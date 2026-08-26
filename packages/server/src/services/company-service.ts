import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export interface Company extends ManifestEntry {
  slug: string;
}

export interface CompanyService {
  list(): Promise<Company[]>;
  getBySlug(slug: string): Promise<Company | undefined>;
  create(name: string): Promise<Company>;
  remove(slug: string): Promise<boolean>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createCompanyService(store: FileStore): CompanyService {
  const manifest = createManifest<Company>(store, 'companies.json');

  const list = async (): Promise<Company[]> => {
    return manifest.list();
  };

  const getBySlug = async (slug: string): Promise<Company | undefined> => {
    const companies = await manifest.list();
    return companies.find((c) => c.slug === slug);
  };

  const create = async (name: string): Promise<Company> => {
    const slug = slugify(name);
    const now = new Date().toISOString();
    const company: Company = {
      id: uuid(),
      name,
      slug,
      createdAt: now,
      updatedAt: now,
    };

    // Ensure company data directory exists
    await store.ensureDir(`companies/${slug}`);

    return manifest.add(company);
  };

  const remove = async (slug: string): Promise<boolean> => {
    const company = await getBySlug(slug);
    if (!company) return false;
    return manifest.remove(company.id);
  };

  return { list, getBySlug, create, remove };
}