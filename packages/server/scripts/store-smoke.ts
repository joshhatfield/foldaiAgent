/**
 * Phase 3 smoke test: exercise the frontend chat store logic in Node
 * (zustand store + ws client + REST api) against a running Fold AI server.
 *
 * The browser-only bits (location for WS URL) are shimmed.
 *
 * Run: FOLDAI_OPENCODE_PORT=4602 npx tsx scripts/store-smoke.ts
 * (assumes Fold AI server running on :3001)
 */

// Shim browser globals before importing modules that use them
(globalThis as Record<string, unknown>)['location'] = {
  protocol: 'http:',
  host: 'localhost:3001',
};

import WebSocket from 'ws';
// Patch global WebSocket so api/ws.ts uses the ws package in Node
(globalThis as Record<string, unknown>)['WebSocket'] = WebSocket;

const { useChatStore } = await import('../../ui/src/stores/chat-store.js');
const { api } = await import('../../ui/src/api/client.js');

const API = 'http://localhost:3001';

// Point the client's fetch at absolute URLs (client.ts uses relative /api paths)
const realFetch = globalThis.fetch;
(globalThis as Record<string, unknown>)['fetch'] = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' && input.startsWith('/')
    ? `${API}${input}`
    : input instanceof URL && input.pathname.startsWith('/api')
      ? new URL(input.pathname + input.search, API)
      : input;
  return realFetch(url as RequestInfo, init);
}) as typeof fetch;

async function main() {
  // Seed company + employee via REST
  const slug = `store-smoke-${Date.now().toString(36)}`;
  const res = await fetch(`${API}/api/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: slug }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status}`);
  const empRes = await fetch(`${API}/api/companies/${slug}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'StoreBot', role: 'Tester', persona: 'test',
      agent: 'build', model: 'opencode/big-pickle',
    }),
  });
  const { employee } = (await empRes.json()) as { employee: { id: string } };
  console.log(`--- seeded company ${slug} + employee`);

  const scope = { type: 'employee' as const, id: employee.id };
  const store = useChatStore;

  // 1. Connect WS
  store.getState().connectWs();
  await new Promise((r) => setTimeout(r, 500));
  console.log(`--- ws connected: ${store.getState().connected}`);

  // 2. Load sessions (empty)
  await store.getState().loadSessions(scope, slug);
  console.log(`--- sessions loaded: ${store.getState().sessionsByScope['employee:' + employee.id]?.length ?? 0}`);

  // 3. Create session
  const session = await store.getState().newSession(scope, slug, employee.id, 'Test chat');
  if (!session) throw new Error('newSession returned null');
  console.log(`--- created session ${session.id} -> oc ${session.opencodeSessionId}`);

  // 4. Send message and watch streaming state + deltas accumulate
  const sendPromise = store.getState().send(slug, session.id, 'Reply with exactly: store smoke ok');

  // Poll until idle (streaming cleared) or timeout
  const deadline = Date.now() + 60_000;
  let lastLen = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const msgs = store.getState().messages[session.id] ?? [];
    const totalText = msgs.reduce((acc, m) => acc + m.parts.filter((p) => p.type === 'text').reduce((a, p) => a + ('text' in p ? p.text.length : 0), 0), 0);
    if (totalText !== lastLen) {
      lastLen = totalText;
      console.log(`   ...streaming, text length so far: ${totalText}`);
    }
    const isStreaming = Object.keys(store.getState().streaming).length > 0;
    if (!isStreaming && totalText > 0) break;
  }
  await sendPromise;

  // 5. Verify final state
  const state = store.getState();
  const messages = state.messages[session.id] ?? [];
  const assistantTexts = messages
    .filter((m) => m.info.role === 'assistant')
    .flatMap((m) => m.parts)
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''));

  console.log('--- messages:', messages.length);
  console.log('--- assistant text:', JSON.stringify(assistantTexts.join('|')).slice(0, 120));

  const pass =
    messages.length >= 2 &&
    assistantTexts.some((t) => t.toLowerCase().includes('store smoke ok'));

  console.log(pass ? '\n=== STORE SMOKE TEST PASSED ===' : '\n=== STORE SMOKE TEST FAILED ===');
  store.getState().disconnectWs();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('STORE SMOKE TEST FAILED:', err.message);
  process.exit(1);
});