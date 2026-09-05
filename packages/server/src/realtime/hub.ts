import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ChatSessionApi } from '../opencode/sessions.js';

export interface OpenCodeEvent {
  type: string;
  properties: Record<string, unknown>;
}

export interface RealtimeHub {
  /** Attach to the HTTP server, handling upgrades on /api/ws */
  attach(server: Server): void;
  clientCount(): number;
  close(): Promise<void>;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const EVENT_PUMP_RETRY_MS = 5_000;

/** Frame sent to clients: raw OpenCode event scoped to the session it belongs to */
interface OutboundFrame {
  type: 'event' | 'heartbeat' | 'connected';
  sessionId?: string | null;
  event?: OpenCodeEvent;
}

function getSessionId(event: OpenCodeEvent): string | null {
  const sid = event.properties?.['sessionID'];
  return typeof sid === 'string' ? sid : null;
}

export function createRealtimeHub(chatApi: ChatSessionApi): RealtimeHub {
  const wss = new WebSocketServer({ noServer: true });
  /** Per-client set of subscribed OpenCode session IDs */
  const subscriptions = new Map<WebSocket, Set<string>>();
  let pumpStarted = false;

  function fanOut(event: OpenCodeEvent): void {
    const sessionId = getSessionId(event);
    const frame: OutboundFrame = { type: 'event', sessionId, event };
    const payload = JSON.stringify(frame);

    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      const subs = subscriptions.get(client);
      if (!subs) continue;
      // Events without a sessionID are global — deliver to all subscribers
      if (sessionId && !subs.has(sessionId)) continue;
      if (client.bufferedAmount > 4 * 1024 * 1024) {
        // Backpressure: client is not keeping up; drop it
        client.terminate();
        continue;
      }
      client.send(payload);
    }
  }

  /**
   * Single upstream SSE subscription shared by all WS clients.
   * Started lazily on first client connect; restarted on stream failure.
   */
  async function ensureEventPump(): Promise<void> {
    if (pumpStarted) return;
    pumpStarted = true;
    try {
      const events = await chatApi.subscribeEvents();
      console.log('[ws-hub] Upstream OpenCode event stream connected');
      (async () => {
        for await (const event of events) {
          fanOut(event as OpenCodeEvent);
        }
        // Stream ended normally (server restart?) — allow re-subscribe
        console.warn('[ws-hub] Upstream event stream ended');
        pumpStarted = false;
        scheduleRetry();
      })().catch((err) => {
        console.error('[ws-hub] Upstream event stream error:', err instanceof Error ? err.message : err);
        pumpStarted = false;
        scheduleRetry();
      });
    } catch (err) {
      pumpStarted = false;
      console.error('[ws-hub] Failed to subscribe to upstream events:', err instanceof Error ? err.message : err);
      scheduleRetry();
    }
  }

  function scheduleRetry(): void {
    if (wss.clients.size === 0) return;
    setTimeout(() => {
      void ensureEventPump();
    }, EVENT_PUMP_RETRY_MS);
  }

  function handleConnection(ws: WebSocket): void {
    subscriptions.set(ws, new Set());

    ws.on('message', (raw) => {
      let msg: { type?: string; sessionId?: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const subs = subscriptions.get(ws);
      if (!subs) return;

      if (msg.type === 'subscribe' && typeof msg.sessionId === 'string') {
        subs.add(msg.sessionId);
        void ensureEventPump();
      } else if (msg.type === 'unsubscribe' && typeof msg.sessionId === 'string') {
        subs.delete(msg.sessionId);
      }
    });

    ws.on('close', () => {
      subscriptions.delete(ws);
    });

    ws.on('error', () => {
      subscriptions.delete(ws);
    });

    const connected: OutboundFrame = { type: 'connected' };
    ws.send(JSON.stringify(connected));
  }

  const attach = (server: Server): void => {
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/api/ws') return; // let other upgrades fall through
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });

    wss.on('connection', handleConnection);

    // Heartbeat: ping everyone, terminate dead sockets
    const heartbeat = setInterval(() => {
      for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        const frame: OutboundFrame = { type: 'heartbeat' };
        client.ping(JSON.stringify(frame));
      }
    }, HEARTBEAT_INTERVAL_MS);

    wss.on('close', () => clearInterval(heartbeat));
  };

  const clientCount = (): number => wss.clients.size;

  const close = async (): Promise<void> => {
    for (const client of wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  };

  return { attach, clientCount, close };
}