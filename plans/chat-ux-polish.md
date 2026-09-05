# Plan: Chat UX Polish

> **Status (2026-09-03):** Superseded by `plans/chat-openchamber-parity.md` (Phases 1–5 complete).
> Items 3 (activity indicator) and 4 (streaming feel) were rebuilt as the 3-layer
> mini-status (optimistic → agent line → tool timeline) + fixed scroller wiring.
> Items 1 (bubbles) and 2 (employee card) remain valid as specified below.

> Four fixes for the chat window: bubble differentiation, clickable employee cards, live activity indicators, and streaming feel.

---

## 1. Bubble Differentiation

**Files:** `packages/ui/src/components/ui/message.tsx`, `packages/ui/src/components/chat/ChatMessage.tsx`

Current state: user = `bg-primary` (white), assistant = `bg-muted`. Both are gray-ish — sides aren't obvious.

Changes:
- **User bubble** (right): solid accent — `bg-blue-600 text-white rounded-br-md`
- **Assistant bubble** (left): distinct surface — `bg-card border border-border rounded-bl-md`
- Color + alignment + border together make left/right unmistakable
- Keep `Message` align prop as-is (`end`/`start`)

---

## 2. Clickable Employee Card

**File:** `packages/ui/src/pages/Employees.tsx`

Current state: only the name text navigates — looks bad, no hover affordance.

Changes:
- Whole `<Card>` becomes a button-like clickable element:
  - `onClick={() => navigate(...)}`
  - `cursor-pointer`
  - Hover: `hover:border-primary/50 hover:bg-accent/50 transition-colors`
- Toggle/remove buttons call `e.stopPropagation()` so they don't trigger navigation
- Name text loses its own click handler (card handles it)

---

## 3. Activity Indicator Under Working Bubbles

**Files:** `packages/ui/src/stores/chat-store.ts`, `packages/ui/src/components/chat/ChatThread.tsx`, `packages/ui/src/components/chat/ChatWindow.tsx`

Show what the agent is doing right now, under the in-progress assistant message.

### Store changes
Add `activity: Record<string, string | null>` keyed by **our** session id:
- `step-start` event → `"Calling model…"`
- tool part with `state.status === "running"` (from `message.part.updated`) → `` `Running ${part.tool}…` ``
- tool part completed → back to `"Calling model…"` (next step may follow)
- `session.idle` / status idle → clear (`null`)
- Clear on session switch too

### UI changes
In `ChatThread`, when `isStreaming`, render an activity row beneath the last message:
```
[spinner] Running bash…
```
Reuses the existing `Marker` styling pattern; new small component `ActivityRow` inside ChatThread file (no separate file needed).

Wire: `ChatWindow` passes `activity[activeSessionId]` down to `ChatThread`.

---

## 4. Streaming Feel

**Files:** `packages/ui/src/components/chat/ChatMessage.tsx`, `packages/ui/src/components/ui/message-scroller.tsx`

The backend already streams deltas incrementally (verified in smoke tests) — the UI just doesn't *feel* like it.

Changes:
- **Streaming cursor**: while a message is the streaming tail, append a blinking cursor `▍` to its last text part. Implementation: pass `isStreamingTail` prop from ChatThread (last assistant entry) into `ChatMessage`; render `<span className="animate-pulse">▍</span>` after the text.
- **Smooth follow**: `message-scroller` auto-scroll uses `behavior: "smooth"` while auto-scrolling (already does); manual jump-to-latest stays smooth. No change needed unless testing shows jank.
- **Verify deltas**: during regression test, log delta arrival timestamps in the browser console to confirm incremental delivery (temporary debug, removed after).

---

## 5. Verification

1. TypeScript check (UI)
2. Vite build
3. Browser regression test (puppeteer):
   - Employee card hover shows color change (computed style check)
   - Card click navigates to profile
   - Send message → activity row appears ("Calling model…" / tool name) → clears on idle
   - Assistant reply renders in distinct left bubble; user in blue right bubble
   - Console shows multiple delta events arriving over time (streaming confirmed)

---

## Files Touched

| File | Change |
|------|--------|
| `components/ui/message.tsx` | Bubble variants (blue user / bordered card assistant) |
| `pages/Employees.tsx` | Whole-card click + hover states |
| `stores/chat-store.ts` | `activity` state + event handling |
| `components/chat/ChatThread.tsx` | ActivityRow + isStreamingTail prop |
| `components/chat/ChatMessage.tsx` | Streaming cursor |
| `components/chat/ChatWindow.tsx` | Wire activity through |

No backend changes.
