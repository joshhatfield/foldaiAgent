/**
 * WebSocket client for the Fold AI realtime hub (/api/ws).
 * Auto-reconnects with backoff; re-subscribes to sessions after reconnect.
 */

export interface OpenCodeEvent {
  type: string;
  properties: Record<string, unknown>;
}

export type ServerFrame =
  | { type: 'connected' }
  | { type: 'heartbeat' }
  | { type: 'event'; sessionId: string | null; event: OpenCodeEvent };

export interface WsClient {
  /** Subscribe to events for an OpenCode session ID */
  subscribe(sessionId: string): void;
  unsubscribe(sessionId: string): void;
  isConnected(): boolean;
  close(): void;
}

interface WsClientOptions {
  url?: string;
  onEvent: (event: OpenCodeEvent, sessionId: string | null) => void;
  onStatusChange?: (connected: boolean) => void;
  maxBackoffMs?: number;
}

const DEFAULT_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws`;
const DEFAULT_MAX_BACKOFF_MS = 15_000;

export function createWsClient(options: WsClientOptions): WsClient {
  const url = options.url ?? DEFAULT_URL;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

  let ws: WebSocket | null = null;
  const subscriptions = new Set<string>();
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByUser = false;

  function connect(): void {
    if (closedByUser) return;

    ws = new WebSocket(url);

    ws.onopen = () => {
      retryAttempt = 0;
      options.onStatusChange?.(true);
      // Re-subscribe to everything after (re)connect
      for (const sessionId of subscriptions) {
        send({ type: 'subscribe', sessionId });
      }
    };

    ws.onmessage = (msg) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(msg.data as string) as ServerFrame;
      } catch {
        return;
      }
      if (frame.type === 'event') {
        options.onEvent(frame.event, frame.sessionId);
      }
      // heartbeat / connected frames need no handling here
    };

    ws.onclose = () => {
      options.onStatusChange?.(false);
      if (closedByUser) return;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose always follows onerror
    };
  }

  function scheduleReconnect(): void {
    if (retryTimer || closedByUser) return;
    const delay = Math.min(1000 * 2 ** retryAttempt, maxBackoffMs);
    retryAttempt++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  function send(data: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  connect();

  return {
    subscribe(sessionId: string) {
      subscriptions.add(sessionId);
      send({ type: 'subscribe', sessionId });
    },
    unsubscribe(sessionId: string) {
      subscriptions.delete(sessionId);
      send({ type: 'unsubscribe', sessionId });
    },
    isConnected: () => ws !== null && ws.readyState === WebSocket.OPEN,
    close() {
      closedByUser = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}