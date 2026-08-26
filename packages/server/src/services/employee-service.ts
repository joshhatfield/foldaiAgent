import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export type EmployeeStatus = 'available' | 'busy';

export interface Employee extends ManifestEntry {
  role: string;
  persona: string;
  agent: string;
  skills: string[];
  model: string;
  status: EmployeeStatus;
}

export interface EmployeeService {
  list(companySlug: string): Promise<Employee[]>;
  getById(companySlug: string, id: string): Promise<Employee | undefined>;
  create(companySlug: string, input: CreateEmployeeInput): Promise<Employee>;
  update(companySlug: string, id: string, updates: Partial<Employee>): Promise<Employee | undefined>;
  remove(companySlug: string, id: string): Promise<boolean>;
}

export interface CreateEmployeeInput {
  name: string;
  role: string;
  persona: string;
  agent: string;
  skills?: string[];
  model: string;
}

function employeesPath(companySlug: string): string {
  return `companies/${companySlug}/employees.json`;
}

export function createEmployeeService(store: FileStore): EmployeeService {
  const getManifest = (companySlug: string) =>
    createManifest<Employee>(store, employeesPath(companySlug));

  const list = async (companySlug: string): Promise<Employee[]> => {
    return getManifest(companySlug).list();
  };

  const getById = async (companySlug: string, id: string): Promise<Employee | undefined> => {
    return getManifest(companySlug).getById(id);
  };

  const create = async (companySlug: string, input: CreateEmployeeInput): Promise<Employee> => {
    const now = new Date().toISOString();
    const employee: Employee = {
      id: uuid(),
      name: input.name,
      role: input.role,
      persona: input.persona,
      agent: input.agent,
      skills: input.skills ?? [],
      model: input.model,
      status: 'available',
      createdAt: now,
      updatedAt: now,
    };

    return getManifest(companySlug).add(employee);
  };

  const update = async (
    companySlug: string,
    id: string,
    updates: Partial<Employee>,
  ): Promise<Employee | undefined> => {
    return getManifest(companySlug).update(id, updates);
  };

  const remove = async (companySlug: string, id: string): Promise<boolean> => {
    return getManifest(companySlug).remove(id);
  };

  return { list, getById, create, update, remove };
}