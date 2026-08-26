# Plan: Reusable Chat Session Component

> A reusable chat window (like OpenChamber's session UI) with WebSocket streaming, a session sidebar, and shadcn/ui message-scroller rendering. First landing spot: **Employee profile page** (multi-session). Later reused on **Task detail** (single-session).

---

## 1. Goal

Build `<ChatWindow>` — a reusable chat UI with:
- **WebSocket** transport for real-time streaming + events + notifications (backend → frontend)
- **Session sidebar** — list sessions, create new, switch (employee = many sessions, task = one)
- **Message scroller** with auto-scroll + "jump to latest" (shadcn `message-scroller`)
- Message bubbles (user/assistant), markdown rendering, streaming text, tool-call cards, typing indicator
- Input box with send / stop

---

## 2. Architecture

Two transport layers, mirroring OpenChamber:

```
OpenCode (opencode serve)  ──SSE──▶  Fold AI server  ──WebSocket──▶  Browser
   (managed child process)             (ws hub)              (chat store)
```

- **Upstream** = OpenCode's SSE event stream (`GET /event` via `@opencode-ai/sdk` `client.event.subscribe()`)
- **Downstream** = WebSocket (`ws` package) from our Express server to the browser
- Sessions are stored by OpenCode itself; we persist only a thin mapping (our ID ↔ OpenCode session ID) in flat files.

---

## 3. Backend Components (`packages/server/src/`)

### 3.1 `opencode/manager.ts` — OpenCode server lifecycle
- Manage a single `opencode serve` child process (spawn, health-check, restart), like OpenChamber's `lifecycle.js`
- Port/hostname configurable (`FOLDAI_OPENCODE_PORT`, default e.g. 4096)
- Connect via `createOpencodeClient({ baseUrl })`
- Auth: `OPENCODE_SERVER_PASSWORD` basic auth

### 3.2 `opencode/sessions.ts` — session operations (SDK wrapper)
- `createSession({ title, agent, model, directory })` → `client.session.create`
- `listSessions()` → `client.session.list`
- `getMessages(sessionId)` → `client.session.messages`
- `sendPrompt(sessionId, text)` → `client.session.prompt` (with model/agent)
- `abort(sessionId)` → `client.session.abort`
- `respondToPermission(sessionId, permissionId, response)` (approve/deny)

### 3.3 `realtime/hub.ts` — WebSocket hub
- `ws` WebSocketServer attached to the HTTP server (upgrade path `/api/ws`)
- Single global OpenCode SSE subscription (`client.event.subscribe()`)
- Fan-out filtered by `properties.sessionID` to connected clients subscribed to that session
- Client → server messages: `{ type: "subscribe", sessionId }`, `{ type: "unsubscribe" }`
- Server → client frames: `{ type: "event", sessionId, event }` + heartbeat every 15s
- Bounded per-client buffer + backpressure handling (like OpenChamber's protocol)

### 3.4 `services/chat-session-service.ts` — our session metadata
- Flat-file persistence mapping our chat sessions → OpenCode session IDs
- Data: `{ id, scopeType: "employee" | "task", scopeId, opencodeSessionId, title, createdAt, updatedAt }`
- Stored per company: `companies/{slug}/chat-sessions.json`

### 3.5 `routes/chat.ts` — REST endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/companies/:slug/employees/:id/sessions` | List employee sessions |
| `POST` | `/api/companies/:slug/employees/:id/sessions` | Create + get OpenCode session |
| `GET` | `/api/companies/:slug/chat/sessions/:id/messages` | Get messages (history) |
| `POST` | `/api/companies/:slug/chat/sessions/:id/send` | Send prompt (fallback; primary is WS) |
| `POST` | `/api/companies/:slug/chat/sessions/:id/abort` | Abort running session |
| `POST` | `/api/companies/:slug/chat/sessions/:id/permission` | Approve/deny permission |

### 3.6 `index.ts` wiring
- Create `http.Server` from Express app, attach `ws` server to it
- Instantiate manager + hub + chat-session service; mount routes

---

## 4. Frontend Components (`packages/ui/src/`)

### 4.1 `api/ws.ts` — WebSocket client
- Connects to `/api/ws`, auto-reconnect with backoff
- Subscribe/unsubscribe per session, dispatch events to chat store
- Replay buffer handling on reconnect

### 4.2 `stores/chat-store.ts` — Zustand chat state
- `sessions[]`, `activeSessionId`, `messagesBySession`, `streamingSessionId`, `typingSessionId`
- Reduces incoming WS events (`message.part.updated` → append/update message parts; `session.status` → streaming/typing; `permission.updated` → pending permission)
- Immutable updates on the streaming tail only (perf rule from OpenChamber)

### 4.3 shadcn chat primitives (via CLI, hand-adapted)
```bash
npx shadcn@latest add message-scroller message bubble marker
```
- `message-scroller.tsx` — `MessageScroller.Provider/Root/Viewport/Content/Item/Button` (auto-scroll + jump-to-latest)
- `message.tsx` + `bubble.tsx` — user/assistant alignment + bubble variants
- `marker.tsx` — typing indicator (shimmer)
- `scroll-area.tsx` (dependency)

### 4.4 `components/chat/` — reusable chat components
| File | Purpose |
|------|---------|
| `ChatWindow.tsx` | Layout shell: session sidebar + thread + input |
| `ChatSidebar.tsx` | Session list (title, active highlight, new-session button) |
| `ChatThread.tsx` | MessageScroller wrapping message list |
| `ChatMessage.tsx` | Message bubble: role, parts (text/tool/reasoning) |
| `ChatInput.tsx` | Textarea + Send/Stop button |
| `ToolCallCard.tsx` | Tool part rendering (name, status: pending/running/completed/error) |
| `PermissionCard.tsx` | Approve/deny UI for `permission.updated` |
| `MarkdownRenderer.tsx` | `react-markdown` + `remark-gfm` |

### 4.5 Reusable component contract
```tsx
<ChatWindow
  scope={{ type: "employee", id: employeeId }}   // or { type: "task", id: taskId }
  sessions={sessions}          // from chat-store (scoped)
  activeSessionId={id}
  messages={messages}
  isStreaming={bool}
  onSend={sendMessage}
  onStop={abort}
  onNewSession={createSession}
  onSelectSession={selectSession}
/>
```
The store is scoped by `scope.type` + `scope.id`; employee scope = multi-session, task scope = single session.

---

## 5. Data Model

**`chat-sessions.json`** (per company):
```json
{
  "sessions": [
    {
      "id": "chat-1",
      "scopeType": "employee",
      "scopeId": "emp-1",
      "opencodeSessionId": "oc-sess-abc",
      "title": "Architecture discussion",
      "createdAt": "2026-08-27T00:00:00Z",
      "updatedAt": "2026-08-27T00:00:00Z"
    }
  ]
}
```
Messages are NOT stored by us — OpenCode persists them; we fetch via `session.messages` on open and stream deltas live.

---

## 6. Employee Integration (initial landing spot)

1. New route `/employees/:id` → **EmployeeProfile page**
2. Employee list items (Employees page + sidebar) link to profile
3. Profile shows employee info card + `<ChatWindow scope={{ type: "employee", id }}>`
4. New session uses the employee's `agent` + `model` (from their config)

---

## 7. Task Integration (future, designed-for)

- `<ChatWindow scope={{ type: "task", id }}>` on TaskDetail
- Single session per task; `scopeId` links to task; optionally seeds the task description as the first prompt

---

## 8. Dependencies

**Server:** `@opencode-ai/sdk`, `ws` (+ `@types/ws`)

**UI:** `react-markdown`, `remark-gfm`, `@radix-ui/react-scroll-area`

---

## 9. Implementation Phases

### Phase 1 — OpenCode serve + SDK (backend)
- Add `@opencode-ai/sdk`, `ws`
- `opencode/manager.ts` (spawn `opencode serve`, connect client)
- `opencode/sessions.ts` (CRUD + prompt + event subscribe)
- Verify: connect, create session, stream a prompt's deltas to console

### Phase 2 — WebSocket hub + REST
- `realtime/hub.ts` (ws server, SSE fan-out, subscribe protocol)
- `services/chat-session-service.ts` (metadata persistence)
- `routes/chat.ts` (REST endpoints)
- Wire into `index.ts`
- Verify: WS client receives streamed deltas

### Phase 3 — Frontend store + WS client
- `api/ws.ts` (reconnect client)
- `stores/chat-store.ts` (event reducer, scoped sessions)
- Verify: store updates in real-time from a test WS connection

### Phase 4 — Chat UI components
- Add shadcn `message-scroller`, `message`, `bubble`, `marker`, `scroll-area`
- `components/chat/*` (ChatWindow, ChatSidebar, ChatThread, ChatMessage, ChatInput, ToolCallCard, MarkdownRenderer)
- Verify: render a hardcoded thread, then a live stream

### Phase 5 — Employee profile page
- `/employees/:id` route + EmployeeProfile page
- Link employees → profile
- Wire ChatWindow with employee scope (multi-session)
- Verify: full flow — open employee, new session, chat streams, sessions persist

### Phase 6 — Polish + verify
- Permission cards (approve/deny)
- Error/empty states, reconnect UX
- TypeScript + build + headless browser test (stream a real message)

---

## 10. Open Questions / Decisions

1. **OpenCode server mode**: managed `opencode serve` child process + SDK client (chosen — mirrors OpenChamber). Note: coexists with the existing `opencode run` one-shot used by the task runner; may unify later.
2. **Permissions**: for MVP, default `edit`/`bash` allow, surface `permission.updated` as an approve/deny card in the UI (configurable per employee later).
3. **Model/agent per session**: derive from the employee at session creation (stored in metadata), overridable later.
4. **Message history pagination**: fetch full history on open (MVP); add infinite scroll later.
5. **Reconnect**: client re-subscribes and refetches messages on WS reconnect.
