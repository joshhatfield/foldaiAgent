/**
 * Phase 2 smoke test: full stack — REST creates employee + chat session,
 * WebSocket receives streamed deltas while a prompt runs.
 *
 * Run: FOLDAI_OPENCODE_PORT=4601 npx tsx scripts/ws-smoke.ts
 * (assumes the Fold AI server is already running on :3001)
 */
import WebSocket from 'ws';

const API = 'http://localhost:3001';
const PROMPT = process.argv[2] ?? 'Reply with exactly: ws smoke ok';

interface ChatSession {
  id: string;
  opencodeSessionId: string;
  name: string;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error}`);
  return data;
}

async function main() {
  // 1. Create company + employee
  const slug = `ws-smoke-${Date.now().toString(36)}`;
  await api('POST', '/api/companies', { name: slug });
  const { employee } = await api<{ employee: { id: string } }>(
    'POST',
    `/api/companies/${slug}/employees`,
    {
      name: 'SmokeBot',
      role: 'Tester',
      persona: 'test agent',
      agent: 'build',
      model: 'opencode/big-pickle',
    },
  );
  console.log(`--- company "${slug}" + employee created`);

  // 2. Create chat session (this lazily starts opencode serve — may take a few seconds)
  console.log('--- creating chat session (starts opencode serve on first use)...');
  const { session } = await api<{ session: ChatSession }>(
    'POST',
    `/api/companies/${slug}/employees/${employee.id}/sessions`,
    {},
  );
  console.log(`--- chat session ${session.id} -> opencode ${session.opencodeSessionId}`);

  // 3. Connect WS and subscribe
  const ws = new WebSocket(`ws://localhost:3001/api/ws`);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  console.log('--- websocket connected');

  let deltaCount = 0;
  let sawIdle = false;
  const done = Promise.withResolvers<void>();

  ws.on('message', (raw) => {
    const frame = JSON.parse(raw.toString()) as {
      type: string;
      sessionId?: string | null;
      event?: { type: string; properties: Record<string, unknown> };
    };
    if (frame.type !== 'event' || !frame.event) return;

    const event = frame.event;
    if (event.type === 'message.part.updated') {
      const props = event.properties as { part?: { type?: string }; delta?: string; sessionID?: string };
      if (props.part?.type === 'text' && props.sessionID === session.opencodeSessionId) {
        deltaCount++;
        process.stdout.write(props.delta ?? '');
      }
    } else if (event.type === 'session.idle') {
      const sid = (event.properties as { sessionID?: string }).sessionID;
      if (sid === session.opencodeSessionId) {
        sawIdle = true;
        done.resolve();
      }
    }
  });

  ws.send(JSON.stringify({ type: 'subscribe', sessionId: session.opencodeSessionId }));
  console.log('--- subscribed to session events');

  // 4. Send prompt via REST
  await new Promise((r) => setTimeout(r, 300));
  await api('POST', `/api/companies/${slug}/chat/sessions/${session.id}/send`, { text: PROMPT });
  console.log('\n--- prompt sent, waiting for stream...');

  // 5. Wait for idle (or timeout)
  await Promise.race([done.promise, new Promise((r) => setTimeout(r, 60_000))]);

  // 6. Fetch history via REST
  const { messages } = await api<{ messages: unknown[] }>(
    'GET',
    `/api/companies/${slug}/chat/sessions/${session.id}/messages`,
  );
  console.log(`\n--- history: ${Array.isArray(messages) ? messages.length : '?'} entries`);

  ws.close();

  const pass = deltaCount > 0 && Array.isArray(messages);
  console.log(
    pass
      ? `\n=== WS SMOKE TEST PASSED (${deltaCount} deltas${sawIdle ? ', idle received' : ''}) ===`
      : `\n=== WS SMOKE TEST FAILED (deltas=${deltaCount}) ===`,
  );
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('WS SMOKE TEST FAILED:', err.message);
  process.exit(1);
});