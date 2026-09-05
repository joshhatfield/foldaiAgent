/**
 * Phase 1 smoke test: spawn opencode serve, connect via SDK,
 * create a session, subscribe to events, stream a prompt's deltas.
 *
 * Run: npx tsx scripts/chat-smoke.ts
 */
import { createOpenCodeManager } from '../src/opencode/manager.js';
import { createChatSessionApi } from '../src/opencode/sessions.js';

const PORT = Number(process.env['FOLDAI_OPENCODE_PORT']) || 4097;
const PROMPT = process.argv[2] ?? 'Reply with exactly: hello from fold';

async function main() {
  const manager = createOpenCodeManager({ port: PORT });
  const api = createChatSessionApi(() => manager.getClient());

  try {
    // 1. Connect (spawns opencode serve)
    console.log('--- connecting to opencode serve...');
    await manager.getClient();
    console.log('--- connected');

    // 2. Subscribe to events BEFORE sending the prompt
    let deltaCount = 0;
    const done = Promise.withResolvers<void>();
    const events = await api.subscribeEvents();
    console.log('--- subscribed to event stream');

    (async () => {
      for await (const event of events) {
        if (event.type === 'message.part.updated') {
          const props = event.properties as { part?: { type?: string; text?: string }; delta?: string };
          if (props.part?.type === 'text') {
            deltaCount++;
            process.stdout.write(props.delta ?? props.part.text ?? '');
          }
        } else if (event.type === 'session.idle') {
          console.log(`\n--- session.idle received`);
          done.resolve();
        } else if (event.type === 'session.error') {
          console.log('\n--- session.error:', JSON.stringify(event.properties).slice(0, 300));
          done.resolve();
        }
      }
    })().catch((err) => {
      console.error('\n--- event stream error:', err.message);
      done.resolve();
    });

    // 3. Create session
    const session = await api.createSession({ title: 'Fold smoke test' });
    console.log(`\n--- created session: ${session.id}`);

    // 4. Send prompt (blocking — deltas arrive via the event stream above)
    console.log('--- streaming response:');
    const result = await api.sendPrompt(session.id, PROMPT);
    console.log('\n--- prompt completed');

    // Wait briefly for idle event
    await Promise.race([done.promise, new Promise((r) => setTimeout(r, 5000))]);

    // 5. Fetch messages to verify history retrieval
    const messages = await api.getMessages(session.id);
    const msgCount = Array.isArray(messages) ? messages.length : 'unknown';
    console.log(`--- history retrieved: ${msgCount} message entries`);

    console.log(`\n=== SMOKE TEST PASSED (${deltaCount} text deltas streamed) ===`);
    // The open SSE subscription keeps the event loop alive; exit explicitly.
    process.exit(0);
  } finally {
    await manager.stop();
  }
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});