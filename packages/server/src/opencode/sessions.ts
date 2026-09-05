import type { OpencodeClient } from '@opencode-ai/sdk';

export interface CreateSessionOptions {
  title?: string;
  directory?: string;
}

export interface SendPromptOptions {
  agent?: string;
  /** Full model string, e.g. "openrouter/anthropic/claude-opus-4.8" */
  model?: string;
  directory?: string;
}

export interface GetMessagesOptions {
  /** Max messages to return (most recent). Omit for full history. */
  limit?: number;
}

export interface ChatSessionApi {
  createSession(options?: CreateSessionOptions): Promise<{ id: string }>;
  listSessions(): Promise<Array<{ id: string; title?: string }>>;
  getMessages(sessionId: string, options?: GetMessagesOptions): Promise<unknown>;
  sendPrompt(sessionId: string, text: string, options?: SendPromptOptions): Promise<unknown>;
  abort(sessionId: string): Promise<void>;
  respondToPermission(sessionId: string, permissionId: string, response: 'once' | 'always' | 'reject'): Promise<void>;
  subscribeEvents(): Promise<AsyncIterable<{ type: string; properties: Record<string, unknown> }>>;
}

/** Split "provider/rest/of/model" into { providerID, modelID } */
export function splitModel(model: string): { providerID: string; modelID: string } {
  const slash = model.indexOf('/');
  if (slash === -1) return { providerID: model, modelID: '' };
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}

function unwrap<T>(result: { data?: T; error?: unknown }, what: string): T {
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`OpenCode ${what} failed: ${JSON.stringify(result.error).slice(0, 300)}`);
  }
  return result.data as T;
}

export function createChatSessionApi(getClient: () => Promise<OpencodeClient>): ChatSessionApi {
  const createSession = async (options?: CreateSessionOptions): Promise<{ id: string }> => {
    const client = await getClient();
    const result = await client.session.create({
      body: options?.title ? { title: options.title } : undefined,
      query: options?.directory ? { directory: options.directory } : undefined,
    });
    const session = unwrap<{ id: string }>(result, 'session.create');
    return { id: session.id };
  };

  const listSessions = async (): Promise<Array<{ id: string; title?: string }>> => {
    const client = await getClient();
    const result = await client.session.list();
    const sessions = unwrap<Array<{ id: string; title?: string }>>(result, 'session.list');
    return sessions ?? [];
  };

  const getMessages = async (sessionId: string, options?: GetMessagesOptions): Promise<unknown> => {
    const client = await getClient();
    const result = await client.session.messages({
      path: { id: sessionId },
      query: options?.limit != null ? { limit: options.limit } : undefined,
    });
    return unwrap(result, 'session.messages');
  };

  const sendPrompt = async (
    sessionId: string,
    text: string,
    options?: SendPromptOptions,
  ): Promise<unknown> => {
    const client = await getClient();
    const body: Record<string, unknown> = {
      parts: [{ type: 'text', text }],
    };
    if (options?.model) body['model'] = splitModel(options.model);
    if (options?.agent) body['agent'] = options.agent;

    const result = await client.session.prompt({
      path: { id: sessionId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: body as any,
      query: options?.directory ? { directory: options.directory } : undefined,
    });
    return unwrap(result, 'session.prompt');
  };

  const abort = async (sessionId: string): Promise<void> => {
    const client = await getClient();
    const result = await client.session.abort({ path: { id: sessionId } });
    unwrap(result, 'session.abort');
  };

  const respondToPermission = async (
    sessionId: string,
    permissionId: string,
    response: 'once' | 'always' | 'reject',
  ): Promise<void> => {
    const client = await getClient();
    const result = await client.postSessionIdPermissionsPermissionId({
      path: { id: sessionId, permissionID: permissionId },
      body: { response },
    });
    unwrap(result, 'session.permission');
  };

  const subscribeEvents = async (): Promise<
    AsyncIterable<{ type: string; properties: Record<string, unknown> }>
  > => {
    const client = await getClient();
    const events = await client.event.subscribe();
    return events.stream as AsyncIterable<{
      type: string;
      properties: Record<string, unknown>;
    }>;
  };

  return { createSession, listSessions, getMessages, sendPrompt, abort, respondToPermission, subscribeEvents };
}