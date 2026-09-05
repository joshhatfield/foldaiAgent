import type { FileStore } from '../store/file-store.js';
import type { ManifestEntry } from '../store/manifest.js';
import { createManifest } from '../store/manifest.js';
import { v4 as uuid } from 'uuid';

export type ChatScopeType = 'employee' | 'task';

export interface ChatSession extends ManifestEntry {
  scopeType: ChatScopeType;
  scopeId: string;
  /** The OpenCode-side session ID that owns the actual message history */
  opencodeSessionId: string;
}

export interface CreateChatSessionInput {
  scopeType: ChatScopeType;
  scopeId: string;
  opencodeSessionId: string;
  name?: string;
}

export interface ChatSessionScope {
  type: ChatScopeType;
  id: string;
}

export interface ChatSessionService {
  list(companySlug: string, scope?: ChatSessionScope): Promise<ChatSession[]>;
  getById(companySlug: string, id: string): Promise<ChatSession | undefined>;
  create(companySlug: string, input: CreateChatSessionInput): Promise<ChatSession>;
  update(companySlug: string, id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  remove(companySlug: string, id: string): Promise<boolean>;
  /**
   * Record activity on a session (bumps updatedAt so sidebar ordering
   * reflects last use, not creation). Manifest.update already stamps
   * updatedAt — this is a no-op-shaped touch.
   */
  touch(companySlug: string, id: string): Promise<ChatSession | undefined>;
}

/** Derive a sidebar title from the first user message (OpenChamber-style). */
export function deriveTitle(text: string, maxLen = 40): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine || 'New chat';
  return `${singleLine.slice(0, maxLen).trimEnd()}…`;
}

function sessionsPath(companySlug: string): string {
  return `companies/${companySlug}/chat-sessions.json`;
}

function applyScope(sessions: ChatSession[], scope?: ChatSessionScope): ChatSession[] {
  if (!scope) return sessions;
  return sessions.filter((s) => s.scopeType === scope.type && s.scopeId === scope.id);
}

export function createChatSessionService(store: FileStore): ChatSessionService {
  const getManifest = (companySlug: string) =>
    createManifest<ChatSession>(store, sessionsPath(companySlug));

  const list = async (companySlug: string, scope?: ChatSessionScope): Promise<ChatSession[]> => {
    const sessions = await getManifest(companySlug).list();
    return applyScope(sessions, scope);
  };

  const getById = async (companySlug: string, id: string): Promise<ChatSession | undefined> => {
    return getManifest(companySlug).getById(id);
  };

  const create = async (companySlug: string, input: CreateChatSessionInput): Promise<ChatSession> => {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: uuid(),
      name: input.name ?? 'New chat',
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      opencodeSessionId: input.opencodeSessionId,
      createdAt: now,
      updatedAt: now,
    };
    return getManifest(companySlug).add(session);
  };

  const update = async (
    companySlug: string,
    id: string,
    updates: Partial<ChatSession>,
  ): Promise<ChatSession | undefined> => {
    return getManifest(companySlug).update(id, updates);
  };

  const remove = async (companySlug: string, id: string): Promise<boolean> => {
    return getManifest(companySlug).remove(id);
  };

  const touch = async (companySlug: string, id: string): Promise<ChatSession | undefined> => {
    return getManifest(companySlug).update(id, {});
  };

  return { list, getById, create, update, remove, touch };
}