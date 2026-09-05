# Plan: Chat OpenChamber Parity — Reusable ChatWindow

> Make the chat window look, feel, and behave like OpenChamber's chat/messages window. Fix 5 reported bugs, then polish to parity, then harden `<ChatWindow>` as the reusable conversation surface used in employee, task, and future scopes. Backend changes allowed where needed to support UX.

## Why This Doc

- Current chat is the key interaction surface but feels compressed and buggy.
- Reported issues: (1) sent-message text wrapped too tight, (2) opening chats does not load them, (3) no agent/subagent mini-status on send, (4) opening doesn't scroll to latest, (5) window compressed / general feel off.
- OpenChamber (`github.com/openchamber/openchamber`, `packages/ui` + `packages/web`) is the UX target: full-height thread, rich header (session title + model/agent + status), roomy sidebar, spacious bubbles, live activity timeline, prominent input.
- This plan extends `plans/chat-ux-polish.md` (bubble colors, clickable cards, basic activity row, streaming cursor) — it does not re-spec those. It also builds on `plans/chat-session-component.md` (SSE → WS → store architecture, which stays).

---

## 1. Goal / Non-Goals

**Goal:** One reusable `<ChatWindow>` that:
- Looks and feels like OpenChamber chat: airy, full-height, clear user/assistant separation, live agent status, tool timeline, smooth streaming + autoscroll.
- Works in N places via `scope` prop: employee (multi-session) today, task (single-session) next, any future scope later.
- Loads reliably: open session → history appears → viewport pinned to latest → send → immediate feedback → stream → idle.

**Non-goals:**
- Multi-run / fusion / session goals / preview pane (OpenChamber power features) — out of scope.
- Full theming system or shadcn migration (`plans/shadcn-ui-migration.md` covers that separately).
- Unifying `opencode run` task-runner with `opencode serve` sessions.

---

## 2. Current State (Root Causes)

Verified in repo:

| # | Symptom | Root cause (file:line) |
|---|---------|------------------------|
| 1 | Sent text wrapped too tight | Double `max-w-[85%]` nesting: `ChatMessage.tsx:53` wrapper div + `message.tsx:30` Bubble. Effective width ≈ 0.85 × 0.85 ≈ 72%. User bubble should be a full-width right-aligned row with an inner bubble capped at ~70%. |
| 2 | Opening chats does not load them | `ChatWindow.tsx:62-67` only calls `loadMessages` when `messages.length === 0` and ignores `messagesLoaded`. `selectSession` (`chat-store.ts:302`) only sets active id — no fetch, no WS subscribe. WS subscribe lives only inside `loadMessages` (`chat-store.ts:348`), so switching sessions can leave the client unsubscribed. Empty-but-loaded sessions refetch every open. |
| 3 | No agent/subagent mini-status on send | `activity` is only `"Calling model…" / "Running {tool}…"` derived from `message.part.updated` (`chat-store.ts:80-85`). No optimistic state on `send()` (`chat-store.ts:354` fire-and-forget, comment says "no optimistic append needed"). Gap between send → first `session.status busy` → first delta looks dead. No step/agent-name/subagent display. Tool progress only visible if user expands `ToolCallCard`. |
| 4 | Opening doesn't scroll to latest | `message-scroller.tsx` anchor wiring is broken: `viewportRef` is created but never attached to the viewport div (scroll listener in `Provider:43-53` never fires, `isAtBottom` stays `true`, jump button never shows). Viewport ref is smuggled via `(ctx as …)._viewport` hack (`:86`). Anchor is only registered on the activity row (`ChatThread.tsx:67`), not on last message. No scroll trigger after `loadMessages` resolves. |
| 5 | Window compressed / feel off | `ChatWindow.tsx:94` sidebar `w-56`, `ChatThread.tsx:52` thread `max-w-3xl`, `ChatWindow.tsx:130` header `h-11` with only dot + name + "streaming…", `message-scroller.tsx:104` `gap-4 p-4`, `ChatInput.tsx:38-39` tight bordered box. No avatars, no timestamps, no date dividers, no model/agent in header, no empty-state illustration. OpenChamber reference: wider sidebar (~260-300px), centered thread ~768px with generous padding, rich header, large rounded input with hint text. |

---

## 3. UX Target (OpenChamber Parity)

Reference: OpenChamber `chat_example.png` / `pwa_chat_example.png`, `packages/ui` chat components, `packages/web` session view.

### 3.1 Layout shell
- Full-height card: `rounded-xl border bg-card`, `h-full min-h-0`, internal scroll only (page never scrolls).
- Sidebar `w-64 md:w-72`, collapsible on small screens (hide + slide-over, or `hideSidebar` prop for single-session mode).
- Thread column: centered `max-w-[768px] mx-auto w-full`, `px-4 md:px-6 py-6`, message gap `gap-6`.
- Header `h-14`: left = status dot + session title (truncate) + subtitle (agent · model); right = streaming pill / stop button + session actions (rename, new). Keep error + reconnect banners above header (existing pattern).
- Input docked at bottom: large rounded-2xl box, `min-h-[56px]`, placeholder `"Reply to {agent name}…"`, hint `"Enter to send · Shift+Enter for new line"`, send button disabled state, stop button while streaming.

### 3.2 Sidebar (session list)
- "New chat" primary button at top (full-width).
- Search filter input (client-side filter by name) — new, needed once session counts grow.
- Rows: icon + name (truncate) + relative time + active highlight + hover-reveal rename/delete (existing pattern kept, widen hit area to `py-2`).
- Active session auto-scrolled into view on mount/scope change.
- Loading skeleton rows (3 shimmer lines) instead of "Loading…" text; empty state `"No chats yet — start one above"`.

### 3.3 Thread / messages
- **User row:** full-width flex `justify-end`; inner bubble `max-w-[70%]` solid accent (`bg-blue-600 text-white`), `rounded-2xl rounded-br-md`, `px-4 py-2.5`, normal wrapping (`whitespace-pre-wrap break-words`), timestamp below (right-aligned, `text-[11px] text-muted-foreground`, shows on hover on desktop, always on mobile).
- **Assistant row:** avatar (agent initial, `h-7 w-7 rounded-full`) + column: name line (`text-xs text-muted-foreground`: agent name · model · time) + bubble `bg-card border` `rounded-2xl rounded-bl-md` `max-w-[85%]` + tool timeline beneath + activity row while streaming.
- Markdown: keep `MarkdownRenderer` (react-markdown + remark-gfm); code blocks get copy button (new, small).
- Date dividers: `"Today" / "Yesterday" / Mar 4` sticky-ish centered pill when `info.time.created` day changes — new, backend already sends `time` (just render it).
- Empty state: centered illustration (MessageSquare icon in muted circle) + `"Start the conversation"` + `"Send a message to {agent} below"` — replaces `"No messages yet — say hello"`.
- Error state per message: if `info.error`, red-tinted bubble footer `"Something went wrong — retry"` + retry button (re-sends last user text).

### 3.4 Live status (the "mini status" ask)
Three layers, in order of appearance after send:
1. **Optimistic user bubble** (instant, <50ms): appended locally on send with `pending: true` flag, normal bubble + subtle opacity until WS echo confirms. Removes "did my send work?" dead gap.
2. **Agent status line** (until first token): under the pending assistant placeholder — `[spinner] {AgentName} is thinking…` → `[spinner] Calling model…` → `[spinner] Running {tool}…` (existing `activity` strings kept, prefixed with agent name when known). Collapses into tool timeline once tokens arrive.
3. **Tool timeline** (during run): compact stacked rows per tool part — icon by status (pending/running spinner, completed check, error X), tool name, elapsed time, expandable input/output (reuse `ToolCallCard`, default collapsed except running). Subagent steps (`step-start` with agent attribution when backend provides it — see §6.3) render as nested indent `"↳ {subagent} …"`.

### 3.5 Streaming + scroll
- Blinking cursor `▍` on streaming tail (already in `chat-ux-polish.md` §4 — keep).
- Follow-tail autoscroll while pinned; "Jump to latest ↓" pill when scrolled up (fix wiring so it actually appears — §5.4).
- Open session → after history resolves, instant jump to bottom (`behavior: "instant"`), then smooth follow for deltas.
- Respect user scroll-up: pause follow, show pill; resume on click or scroll-to-bottom.

### 3.6 Reusable contract
```tsx
<ChatWindow
  scope={{ type: "employee" | "task", id }}
  companySlug={slug}
  employeeId={employeeId}      // employee scope only (session creation)
  hideSidebar?: boolean        // task single-session mode
  compact?: boolean            // future: narrow embed (drawer/modal)
  className?: string
/>
```
- No caller passes sessions/messages — the store owns them keyed by scope (existing pattern, keep).
- Visual variants via `className` + `compact` only; no per-usage forks of ChatThread/ChatMessage.
- Second landing spot after this plan: TaskDetail `<ChatWindow scope={{type:"task"}} hideSidebar />` (wiring task-scope listing is §6.2).

---

## 4. Backend Changes (Allowed / Needed)

All in `packages/server/src/`.

### 4.1 Auto-titles (supports sidebar feel)
- **File:** `routes/chat.ts` (POST `/chat/sessions/:id/send`), `services/chat-session-service.ts`.
- On first user send, if session `name` is `"New chat"`, derive title from first ~40 chars of text and `update()` it. Return updated session so sidebar renames live. (OpenChamber names sessions from first prompt.)
- Why: sidebar full of "New chat" rows is a big part of "feel is off".

### 4.2 Task-scope listing + pagination (supports reuse + open-load)
- **Files:** `routes/chat.ts`, `services/chat-session-service.ts`.
- Add `GET /employees/:employeeId/sessions` sibling: `GET /tasks/:taskId/sessions` (or generic `GET /chat/sessions?scopeType=&scopeId=`). Store `loadSessions` currently early-returns for non-employee (`chat-store.ts:281`) — this unblocks task mode.
- Add `GET /chat/sessions/:id/messages?limit=100&before=` passthrough (OpenCode SDK supports paging; we just forward). Frontend requests last 100 on open; "Load older" button prepends. Prevents huge-history open jank.
- Bump `updatedAt` on send (in `chat-session-service.update` call after prompt) so sidebar ordering (`relativeTime`) reflects activity, not creation.

### 4.3 Step/agent attribution passthrough (supports mini-status)
- **Files:** `opencode/sessions.ts` (event subscription), `realtime/hub.ts` (fan-out).
- Today the hub forwards raw OpenCode events; `session.status` and `message.part.updated` already flow. Verify `step-start` events carry agent/subagent name fields and forward them untouched (no filtering). If the SDK exposes `session.status` with agent/model, include those in the fanned frame.
- No new event types invented — frontend derives status line from existing `session.status busy` + `part.updated tool running` + `step-start` props. If attribution is absent upstream, frontend falls back to owning employee's agent name (already known from scope).

### 4.4 No changes
- Transport stays `OpenCode SSE → WS hub → store` (`chat-session-component.md` §2). No auth, schema, or persistence-model changes beyond `updatedAt`/title.

---

## 5. Frontend Changes (Per File)

All in `packages/ui/src/`.

### 5.1 `components/ui/message.tsx` — fix double-constrain
- Remove `max-w-[85%]` from `Bubble`; width is the row's job, not the bubble's. Bubble keeps color/shape/typography only.
- Add `text-white` contrast guarantee on `default` variant; keep `muted` as `bg-card border`.
- Why: single source of width truth ends the "wrapped too tight" class of bugs permanently.

### 5.2 `components/chat/ChatMessage.tsx` — rows own width
- User row: `<Message align="end">` + inner `<div className="flex w-full justify-end">` + bubble `max-w-[70%]`. Timestamp under bubble.
- Assistant row: avatar + content column (`max-w-[85%]`), agent/model/time line, bubble, tool timeline, error footer.
- Split into small subcomponents in-file: `UserBubble`, `AssistantBubble`, `MessageMeta`, `ToolTimeline` (maps tool parts → `ToolCallCard`), `ErrorFooter`. Keep `memo`.
- Props add: `agentName?: string`, `model?: string`, `pending?: boolean` (optimistic opacity), `onRetry?: () => void`.

### 5.3 `components/chat/ChatThread.tsx` — status + dividers + states
- Props add: `agentName`, `model`, `hasLoaded` (vs empty), `onLoadOlder`, `hasMore`.
- Render: date dividers (group by day from `info.time.created`), "Load older messages" button at top when `hasMore`, new empty state, optimistic entries render normally (they're just entries with `pending`).
- Activity row: `[spinner] {agentName} · {activity}` (e.g. `"Atlas · Running bash…"`) beneath streaming tail; keep `ActivityRow` in-file.
- `lastAssistantIdx` logic kept; pass `isStreamingTail` + new props down.

### 5.4 `components/ui/message-scroller.tsx` — fix anchor wiring (the real scroll fix)
- Attach the scroll listener ref properly: `Viewport` forwards its div ref into context (replace `_viewport` hack with a real `setViewportRef`). `isAtBottom` then works, jump pill appears.
- `Item` with `scrollAnchor` registers AND auto-marks itself as the follow target; ChatThread puts `scrollAnchor` on the last message item (not only the activity row).
- Add `scrollToBottom(instant?: boolean)`: `behavior: instant ? "instant" : "smooth"`.
- Expose `pinToBottom()` used by ChatWindow after `loadMessages` resolves.
- Keep Provider/Root/Viewport/Content/Item/Button contract (no caller changes beyond new opts).

### 5.5 `components/chat/ChatSidebar.tsx` — OpenChamber feel
- Width handled by parent (`w-64 md:w-72`); sidebar fills it.
- Add search input (filters `sessions` by name, client-side).
- Skeleton rows while `loading`; improved empty state.
- Auto-scroll active row into view (`ref` + `scrollIntoView({block:"nearest"})` on `activeSessionId` change).
- Keep rename/delete hover-reveal; increase row padding to `py-2`.

### 5.6 `components/chat/ChatInput.tsx` — roomier, clearer
- Container `rounded-2xl border bg-card p-3`, textarea `min-h-[44px] max-h-48`, placeholder `"Reply to {agentName}…"` (new `agentName?` prop).
- Hint line under box: `"Enter to send · Shift+Enter for new line"` (`text-[11px] text-muted-foreground`).
- Send button: disabled opacity + `title="Send"`; streaming → destructive Stop (existing). Add `onSend` guard stays (no send while streaming/disabled).

### 5.7 `components/chat/ChatWindow.tsx` — load + scroll orchestration
- Fix open-load: replace `messages.length === 0` guard with `messagesLoaded[activeSessionId]` check; call `loadMessages` whenever active session changes and not loaded. After resolve, `pinToBottom(true)` (instant).
- Subscribe on select: `selectSession` should ensure WS subscribe (move subscribe into `selectSession` if messages already loaded, else `loadMessages` subscribes as today).
- Pass `agentName`/`model` (from employee store or session metadata) into ChatThread/ChatInput.
- Header `h-14` with title + subtitle + streaming pill + stop; sidebar width `w-64 md:w-72 shrink-0`; thread `flex-1 min-h-0`.
- Props add `compact?` → applies narrower thread (`max-w-2xl`) and hides sidebar regardless of `hideSidebar`.

### 5.8 `stores/chat-store.ts` + `api/ws.ts` — optimistic + status
- `send()`: optimistic user entry append (id `pending-{ts}`, `pending: true`) before POST; on WS `message.updated` echo with same text, replace pending (match by id prefix or text+recency); on POST failure, mark entry `error` (retry path) instead of silent fail.
- `activity`: prefix with agent name at render time (store keeps raw `"Running bash…"` strings — no format change).
- `selectSession`: set active + if `messagesLoaded[id]`, `wsClient.subscribe(ocId)` immediately.
- `loadSessions`: remove employee-only early return once §4.2 lands (branch on scope type for endpoint).
- `loadMessages`: accept `{ limit }`, set `hasMore` from response length; add `loadOlder()` prepending.
- Reconnect path (existing `wasConnected` effect) kept.

### 5.9 `api/client.ts` — types only
- `ChatMessageEntry` gains `pending?: boolean`; `ChatMessageInfo.error?: unknown` already exists — use it.
- `chat.getMessages(slug, id, { limit?, before? }?)`, `chat.listSessions` gains task-scope variant. No other client changes.

---

## 6. Implementation Phases

### Phase 1 — Open-load + scroll fixes (bugs §2.2, §2.4)
- Files: `ChatWindow.tsx`, `chat-store.ts` (`selectSession`, `loadMessages`, `messagesLoaded` guard), `message-scroller.tsx` (viewport ref fix, anchor on last item, `pinToBottom`).
- Done when: open any session → history renders → viewport at latest; switch sessions → new history loads + subscribes; scroll up → pill appears → click → smooth return.

### Phase 2 — Bubble width + thread feel (bugs §2.1, §2.5 shell)
- Files: `message.tsx` (drop bubble max-w), `ChatMessage.tsx` (row widths, timestamps, avatar, meta line), `ChatThread.tsx` (spacing `gap-6 py-6`, empty state), `ChatSidebar.tsx` (width, padding, skeletons), `ChatInput.tsx` (size, placeholder, hint), `ChatWindow.tsx` (header `h-14`, layout widths).
- Done when: user bubble ~70% right, assistant ~85% left with avatar/meta, thread airy, sidebar 256-288px, input roomy. Matches §3.1–§3.3.

### Phase 3 — Live mini-status (bug §2.3)
- Files: `chat-store.ts` (optimistic send, pending replace, error mark), `ChatThread.tsx` (agent status line), `ChatMessage.tsx` (`ToolTimeline`, `ErrorFooter`, retry), `ToolCallCard.tsx` (elapsed time display — `Date.now() - part.time.start` while running).
- Done when: send → instant user bubble → `"Agent is thinking…"` → `"Running {tool}…"` → tokens → timeline collapses → idle clears. No dead gap >200ms without visible feedback.

### Phase 4 — Backend support (§4)
- Files: `routes/chat.ts` (auto-title, task-scope list, pagination params, `updatedAt` bump), `services/chat-session-service.ts`, `opencode/sessions.ts` + `realtime/hub.ts` (attribution passthrough verify).
- Done when: first send auto-titles sidebar row; task scope lists; `?limit=` works; `updatedAt` reorders sidebar; step/agent fields reach client (verified via WS frame log).

### Phase 5 — Reuse hardening + verify
- Mount `<ChatWindow scope={{type:"task"}} hideSidebar />` on TaskDetail (or a scratch route if TaskDetail isn't ready) to prove reuse with zero component forks.
- Full verification (§7). Update `chat-ux-polish.md` status line noting supersession by this doc for scroll/load/status items.

---

## 7. Verification

1. `tsc` UI + server; `vite build`.
2. Browser regression (headless or manual), per reported issue:
   - [ ] Sent message bubble ≤70% width, text wraps normally (computed style check).
   - [ ] Open session → messages load (network: `GET messages` fires once per unloaded session); switch sessions → new history appears; WS subscribed (hub log).
   - [ ] Send → optimistic bubble <100ms → status line appears (`thinking` → `Running {tool}`) → streams → clears on idle.
   - [ ] Open session → viewport at latest message (scrollTop ≈ scrollHeight); scroll up → "Jump to latest" pill → click → smooth bottom.
   - [ ] Window fills height, sidebar ~256px+, thread centered ~768px, header shows agent · model, input placeholder names agent.
   - [ ] Empty session → new empty state; failed send → error footer + retry works.
   - [ ] Task scope `<ChatWindow hideSidebar />` renders single session, no sidebar, same thread/input behavior.
3. WS frame spot-check: `session.status busy` → status line; `part.updated tool running` → timeline row; `session.idle` → clear.

---

## 8. Files Touched

| File | Change |
|------|--------|
| `packages/ui/src/components/ui/message.tsx` | Remove bubble `max-w`, keep color/shape |
| `packages/ui/src/components/ui/message-scroller.tsx` | Real viewport ref, anchor on last item, `pinToBottom(instant)` |
| `packages/ui/src/components/chat/ChatMessage.tsx` | Row widths, avatar/meta/timestamp, timeline, error+retry, pending |
| `packages/ui/src/components/chat/ChatThread.tsx` | Dividers, load-older, empty state, agent status line |
| `packages/ui/src/components/chat/ChatSidebar.tsx` | Search, skeletons, active-autoscroll, padding |
| `packages/ui/src/components/chat/ChatInput.tsx` | Size, agent placeholder, hint line |
| `packages/ui/src/components/chat/ChatWindow.tsx` | Load/scroll orchestration, h-14 header, widths, compact |
| `packages/ui/src/components/chat/ToolCallCard.tsx` | Elapsed time |
| `packages/ui/src/stores/chat-store.ts` | Optimistic send, select-subscribe, pagination, task scope |
| `packages/ui/src/api/client.ts` | `pending` flag, paged `getMessages`, task-scope list |
| `packages/ui/src/api/ws.ts` | No protocol change; subscribe timing only |
| `packages/server/src/routes/chat.ts` | Auto-title, task-scope list, pagination, updatedAt bump |
| `packages/server/src/services/chat-session-service.ts` | Title/update support (existing `update` reused) |
| `packages/server/src/opencode/sessions.ts` + `realtime/hub.ts` | Verify/forward step/agent attribution |
| `packages/ui/src/pages/EmployeeProfile.tsx` | Pass-through only if props change (agentName) |
| `plans/chat-ux-polish.md` | Status note (superseded items) — 2-line edit, no rewrite |

No transport, auth, or persistence-model changes.
