import { create } from 'zustand';
import { api } from '../api/client';
import type {
  ChatSession,
  ChatScopeType,
  ChatMessageEntry,
  ChatPart,
} from '../api/client';
import { createWsClient, type WsClient, type OpenCodeEvent } from '../api/ws';

export interface ChatScope {
  type: ChatScopeType;
  id: string;
}

type SetFn = (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void;
type GetFn = () => ChatState;

interface StreamingState {
  /** OpenCode session currently producing output */
  opencodeSessionId: string;
}

interface ChatState {
  // Connection
  connected: boolean;

  // Per-scope state (key = `${scopeType}:${scopeId}`)
  sessionsByScope: Record<string, ChatSession[]>;
  activeByScope: Record<string, string | null>;
  loadingByScope: Record<string, boolean>;

  // Messages keyed by OUR session id; parts keyed by part id for streaming updates
  messages: Record<string, ChatMessageEntry[]>;
  messagesLoaded: Record<string, boolean>;

  // Live streaming state keyed by OPENCODE session id
  streaming: Record<string, StreamingState>;
  pendingPermissions: Record<string, { permissionId: string; title?: string } | null>;

  // Live activity text keyed by OUR session id ("Calling model…", "Running bash…")
  activity: Record<string, string | null>;

  // Last error message (for UI banners)
  error: string | null;

  // Actions
  connectWs(): void;
  disconnectWs(): void;
  loadSessions(scope: ChatScope, companySlug: string): Promise<void>;
  selectSession(scope: ChatScope, sessionId: string): Promise<void>;
  newSession(scope: ChatScope, companySlug: string, employeeId: string, title?: string): Promise<ChatSession | null>;
  loadMessages(companySlug: string, sessionId: string, limit?: number): Promise<void>;
  send(companySlug: string, sessionId: string, text: string): Promise<void>;
  retrySend(companySlug: string, sessionId: string, messageId: string): Promise<void>;
  abort(companySlug: string, sessionId: string): Promise<void>;
  respondPermission(companySlug: string, sessionId: string, response: 'once' | 'always' | 'reject'): Promise<void>;
  renameSession(scope: ChatScope, companySlug: string, sessionId: string, name: string): Promise<void>;
  removeSession(scope: ChatScope, companySlug: string, sessionId: string): Promise<void>;
}

const scopeKey = (scope: ChatScope) => `${scope.type}:${scope.id}`;

let wsClient: WsClient | null = null;

/** Extract a text delta from message.part.updated events */
function handlePartUpdated(
  set: SetFn,
  get: GetFn,
  props: Record<string, unknown>,
): void {
  const part = props['part'] as ChatPart & { id?: string; messageID?: string; sessionID?: string } | undefined;
  const delta = props['delta'] as string | undefined;
  if (!part || !part.sessionID) return;

  const ocSessionId = part.sessionID;
  const ourSessionId = findOurSessionId(get(), ocSessionId);
  if (!ourSessionId) return; // not subscribed / unknown session

  // Track live activity: tool running → "Running X…", otherwise model is working
  const toolPart = part as ChatPart & { type: string; tool?: string; state?: { status?: string } };
  let activityText: string | null = 'Calling model…';
  if (toolPart.type === 'tool') {
    activityText =
      toolPart.state?.status === 'running' ? `Running ${toolPart.tool ?? 'tool'}…` : 'Calling model…';
  }

  set((state) => {
    const list = state.messages[ourSessionId];
    if (!list) return {}; // history not loaded yet — will fetch on open

    const next = [...list];

    // Find or create the owning message entry
    let entryIdx = next.findIndex((m) => m.info.id === part.messageID);
    if (entryIdx === -1) {
      // New assistant message starting mid-stream
      next.push({
        info: {
          id: part.messageID ?? `live-${ocSessionId}-${next.length}`,
          role: 'assistant',
          sessionID: ocSessionId,
        },
        parts: [],
      });
      entryIdx = next.length - 1;
    }

    const entry = next[entryIdx]!;
    const parts = [...entry.parts];

    const partIdx = parts.findIndex((p) => p.id === part.id);
    if (partIdx === -1) {
      parts.push(part);
    } else {
      // Merge delta into existing text/reasoning part
      const existing = parts[partIdx]!;
      if ((existing.type === 'text' || existing.type === 'reasoning') && part.type === existing.type && delta) {
        parts[partIdx] = { ...existing, text: existing.text + delta } as typeof existing;
      } else {
        parts[partIdx] = part;
      }
    }

    next[entryIdx] = { ...entry, parts };
    return {
      messages: { ...state.messages, [ourSessionId]: next },
      activity: { ...state.activity, [ourSessionId]: activityText },
    };
  });
}

/**
 * Reconcile an optimistic user entry once the server echoes it back.
 * Matches by pending id prefix, else by same text within recent entries.
 * Returns the updated list, or null if no pending entry matched.
 */
function confirmPendingUserEntry(
  list: ChatMessageEntry[],
  info: { id?: string; role?: string },
  text?: string,
): ChatMessageEntry[] | null {
  const pendingIdx = list.findIndex((m) => m.pending === true && m.info.role === 'user');
  if (pendingIdx === -1) return null;
  // If the echo carries a real id, adopt it; otherwise keep the pending id
  // but clear the flag so it renders confirmed.
  const pending = list[pendingIdx]!;
  if (text != null) {
    const pendingText = pending.parts.find((p) => p.type === 'text');
    if (pendingText?.type === 'text' && pendingText.text !== text) return null;
  }
  const next = [...list];
  next[pendingIdx] = {
    ...pending,
    pending: false,
    info: { ...pending.info, id: info.id ?? pending.info.id },
  };
  return next;
}

/** Upsert message metadata (role etc.) from message.updated events */
function handleMessageUpdated(
  set: SetFn,
  get: GetFn,
  props: Record<string, unknown>,
): void {
  const info = props['info'] as { id?: string; role?: string; sessionID?: string } | undefined;
  if (!info?.id || !info.sessionID) return;

  const messageId = info.id;
  const messageRole: 'user' | 'assistant' = info.role === 'user' ? 'user' : 'assistant';
  const ocSessionId = info.sessionID;

  const ourSessionId = findOurSessionId(get(), ocSessionId);
  if (!ourSessionId) return;

  set((state) => {
    const list = state.messages[ourSessionId];
    if (!list) return {};

    // A user-role echo may be confirming our optimistic entry — reconcile it
    // instead of appending a duplicate.
    if (messageRole === 'user') {
      const reconciled = confirmPendingUserEntry(list, info);
      if (reconciled) {
        return { messages: { ...state.messages, [ourSessionId]: reconciled } };
      }
    }

    const idx = list.findIndex((m) => m.info.id === messageId);
    if (idx === -1) {
      // Message known by metadata but no parts yet — reserve its place with correct role
      const newEntry: ChatMessageEntry = {
        info: { id: messageId, role: messageRole, sessionID: ocSessionId },
        parts: [],
      };
      return {
        messages: { ...state.messages, [ourSessionId]: [...list, newEntry] },
      };
    }
    // Update role if it was guessed wrong
    const entry = list[idx]!;
    if (entry.info.role !== messageRole) {
      const next = [...list];
      next[idx] = { ...entry, info: { ...entry.info, role: messageRole } };
      return { messages: { ...state.messages, [ourSessionId]: next } };
    }
    return {};
  });
}

function findOurSessionId(state: ChatState, ocSessionId: string): string | null {
  for (const sessions of Object.values(state.sessionsByScope)) {
    const match = sessions.find((s) => s.opencodeSessionId === ocSessionId);
    if (match) return match.id;
  }
  return null;
}

function applyStatusEvent(
  set: SetFn,
  get: GetFn,
  ocSessionId: string,
  status: 'idle' | 'busy' | 'retry',
): void {
  const ourSessionId = findOurSessionId(get(), ocSessionId);

  set((state) => {
    const streaming = { ...state.streaming };
    const activity = { ...state.activity };
    if (status === 'busy') {
      streaming[ocSessionId] = { opencodeSessionId: ocSessionId };
      // First sign of life after send — if no finer-grained activity yet,
      // show the thinking state so the gap before first token isn't dead.
      if (ourSessionId && !activity[ourSessionId]) {
        activity[ourSessionId] = 'Thinking…';
      }
    } else {
      delete streaming[ocSessionId];
      // Agent stopped working — clear the activity row
      if (ourSessionId) activity[ourSessionId] = null;
    }
    return { streaming, activity };
  });
}

function handlePermissionUpdated(
  set: SetFn,
  get: GetFn,
  props: Record<string, unknown>,
): void {
  const ocSessionId = props['sessionID'] as string | undefined;
  const permissionId = props['id'] as string | undefined ?? (props['permission'] as { id?: string })?.id;
  if (!ocSessionId || !permissionId) return;

  const ourSessionId = findOurSessionId(get(), ocSessionId);
  if (!ourSessionId) return;

  set((state) => ({
    pendingPermissions: {
      ...state.pendingPermissions,
      [ourSessionId]: { permissionId },
    },
  }));
}

export const useChatStore = create<ChatState>((set, get) => ({
  connected: false,

  sessionsByScope: {},
  activeByScope: {},
  loadingByScope: {},

  messages: {},
  messagesLoaded: {},

  streaming: {},
  pendingPermissions: {},
  activity: {},
  error: null,

  connectWs: () => {
    if (wsClient) return;
    wsClient = createWsClient({
      onEvent: (event: OpenCodeEvent, _sessionId) => {
        const props = event.properties ?? {};
        switch (event.type) {
          case 'message.updated':
            handleMessageUpdated(set, get, props);
            break;
          case 'message.part.updated':
            handlePartUpdated(set, get, props);
            break;
          case 'session.status': {
            const status = (props as { status?: string }).status;
            const sid = props['sessionID'] as string | undefined;
            if (sid && status) applyStatusEvent(set, get, sid, status as 'idle' | 'busy' | 'retry');
            break;
          }
          case 'session.idle': {
            const sid = props['sessionID'] as string | undefined;
            if (sid) applyStatusEvent(set, get, sid, 'idle');
            break;
          }
          case 'permission.updated':
            handlePermissionUpdated(set, get, props);
            break;
          default:
            break;
        }
      },
      onStatusChange: (connected) => set({ connected }),
    });
  },

  disconnectWs: () => {
    wsClient?.close();
    wsClient = null;
    set({ connected: false });
  },

  loadSessions: async (scope, companySlug) => {
    const key = scopeKey(scope);
    set((s) => ({ loadingByScope: { ...s.loadingByScope, [key]: true } }));
    try {
      const { sessions } =
        scope.type === 'employee'
          ? await api.chat.listSessions(companySlug, scope.id)
          : await api.chat.listTaskSessions(companySlug, scope.id);
      set((s) => ({
        sessionsByScope: { ...s.sessionsByScope, [key]: sessions },
        loadingByScope: { ...s.loadingByScope, [key]: false },
        // Auto-select first session if none selected
        activeByScope:
          s.activeByScope[key] == null && sessions.length > 0
            ? { ...s.activeByScope, [key]: sessions[0]!.id }
            : s.activeByScope,
      }));
    } catch (err) {
      set((s) => ({
        loadingByScope: { ...s.loadingByScope, [key]: false },
        error: err instanceof Error ? err.message : 'Failed to load sessions',
      }));
    }
  },

  selectSession: async (scope, sessionId) => {
    const key = scopeKey(scope);
    set((s) => ({ activeByScope: { ...s.activeByScope, [key]: sessionId } }));
    // If history is already loaded, (re)subscribe immediately — loadMessages
    // only subscribes on the fetch path, so switching back to a loaded
    // session would otherwise leave the client unsubscribed.
    if (get().messagesLoaded[sessionId]) {
      for (const sessions of Object.values(get().sessionsByScope)) {
        const match = sessions.find((s) => s.id === sessionId);
        if (match) {
          wsClient?.subscribe(match.opencodeSessionId);
          break;
        }
      }
    }
  },

  newSession: async (scope, companySlug, employeeId, title) => {
    try {
      const { session } =
        scope.type === 'employee'
          ? await api.chat.createSession(companySlug, employeeId, title)
          : await api.chat.createTaskSession(companySlug, scope.id, title);
      set({ error: null });
      const key = scopeKey(scope);
      set((s) => ({
        sessionsByScope: { ...s.sessionsByScope, [key]: [...(s.sessionsByScope[key] ?? []), session] },
        activeByScope: { ...s.activeByScope, [key]: session.id },
        messagesLoaded: { ...s.messagesLoaded, [session.id]: true },
        messages: { ...s.messages, [session.id]: [] },
      }));

      // Subscribe to the new OpenCode session's events
      wsClient?.subscribe(session.opencodeSessionId);
      return session;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to create chat session',
      });
      return null;
    }
  },

  loadMessages: async (companySlug, sessionId, limit = 100) => {
    // Need the opencode session id
    let ocId: string | undefined;
    for (const sessions of Object.values(get().sessionsByScope)) {
      const match = sessions.find((s) => s.id === sessionId);
      if (match) {
        ocId = match.opencodeSessionId;
        break;
      }
    }
    if (!ocId) return;

    try {
      const { messages: entries } = await api.chat.getMessages(companySlug, sessionId, limit);
      set((s) => ({
        messages: { ...s.messages, [sessionId]: entries ?? [] },
        messagesLoaded: { ...s.messagesLoaded, [sessionId]: true },
      }));
      wsClient?.subscribe(ocId);
    } catch {
      set((s) => ({ messagesLoaded: { ...s.messagesLoaded, [sessionId]: true } }));
    }
  },

  send: async (companySlug, sessionId, text) => {
    // Optimistic append: show the user bubble instantly (<50ms) so the gap
    // before the WS echo + first token never looks dead. The echo reconciles
    // via confirmPendingUserEntry; on POST failure the entry is marked error
    // for the retry path.
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageEntry = {
      info: { id: pendingId, role: 'user', time: { created: Date.now() } },
      parts: [{ type: 'text', id: `${pendingId}-part`, text }],
      pending: true,
    };
    set((s) => ({
      messages: { ...s.messages, [sessionId]: [...(s.messages[sessionId] ?? []), optimistic] },
      activity: { ...s.activity, [sessionId]: 'Thinking…' },
    }));

    try {
      const { session } = await api.chat.send(companySlug, sessionId, text);
      // Backend returns the touched session (updatedAt bumped, possibly
      // auto-titled) — merge it so the sidebar reorders/renames live.
      if (session) {
        set((s) => {
          const next: Record<string, ChatSession[]> = {};
          for (const [k, list] of Object.entries(s.sessionsByScope)) {
            next[k] = list.map((sess) => (sess.id === session.id ? session : sess));
          }
          return { sessionsByScope: next };
        });
      }
    } catch (err) {
      // Mark the optimistic entry failed — ChatMessage renders ErrorFooter w/ retry.
      set((s) => ({
        messages: {
          ...s.messages,
          [sessionId]: (s.messages[sessionId] ?? []).map((m) =>
            m.info.id === pendingId
              ? { ...m, pending: false, info: { ...m.info, error: err instanceof Error ? err.message : 'Send failed' } }
              : m,
          ),
        },
        activity: { ...s.activity, [sessionId]: null },
        error: err instanceof Error ? err.message : 'Failed to send message',
      }));
    }
  },

  retrySend: async (companySlug, sessionId, messageId) => {
    const entry = (get().messages[sessionId] ?? []).find((m) => m.info.id === messageId);
    const textPart = entry?.parts.find((p) => p.type === 'text');
    if (!textPart || textPart.type !== 'text') return;
    // Drop the failed entry and re-send fresh (new optimistic entry).
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: (s.messages[sessionId] ?? []).filter((m) => m.info.id !== messageId),
      },
      error: null,
    }));
    await get().send(companySlug, sessionId, textPart.text);
  },

  abort: async (companySlug, sessionId) => {
    await api.chat.abort(companySlug, sessionId);
  },

  respondPermission: async (companySlug, sessionId, response) => {
    const pending = get().pendingPermissions[sessionId];
    if (!pending) return;
    await api.chat.respondPermission(companySlug, sessionId, pending.permissionId, response);
    set((state) => ({
      pendingPermissions: { ...state.pendingPermissions, [sessionId]: null },
    }));
  },

  renameSession: async (scope, companySlug, sessionId, name) => {
    const { session } = await api.chat.renameSession(companySlug, sessionId, name);
    const key = scopeKey(scope);
    set((state) => ({
      sessionsByScope: {
        ...state.sessionsByScope,
        [key]: (state.sessionsByScope[key] ?? []).map((s) => (s.id === sessionId ? session : s)),
      },
    }));
  },

  removeSession: async (scope, companySlug, sessionId) => {
    await api.chat.removeSession(companySlug, sessionId);
    const key = scopeKey(scope);
    set((state) => {
      const remaining = (state.sessionsByScope[key] ?? []).filter((s) => s.id !== sessionId);
      const wasActive = state.activeByScope[key] === sessionId;
      return {
        sessionsByScope: { ...state.sessionsByScope, [key]: remaining },
        activeByScope:
          wasActive
            ? { ...state.activeByScope, [key]: remaining[0]?.id ?? null }
            : state.activeByScope,
      };
    });
  },
}));