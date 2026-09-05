import { useEffect, useRef } from "react";
import { useChatStore, type ChatScope } from "../../stores/chat-store";
import { useEmployeeStore } from "../../stores/employee-store";
import { ChatSidebar } from "./ChatSidebar";
import { ChatThread } from "./ChatThread";
import { ChatInput } from "./ChatInput";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  scope: ChatScope;
  companySlug: string;
  /** For employee scope: the employee id used to create sessions */
  employeeId?: string;
  className?: string;
  /** Hide the session sidebar (e.g. single-session task mode) */
  hideSidebar?: boolean;
  /** Narrow embed variant (drawer/modal): tighter thread, no sidebar */
  compact?: boolean;
}

/**
 * Reusable chat window.
 * - Employee scope: multi-session (sidebar to switch chats)
 * - Task scope: single session (pass hideSidebar)
 */
export function ChatWindow({ scope, companySlug, employeeId, className, hideSidebar, compact }: ChatWindowProps) {
  const key = `${scope.type}:${scope.id}`;
  const showSidebar = !hideSidebar && !compact;

  const sessions = useChatStore((s) => s.sessionsByScope[key]) ?? [];
  const activeSessionId = useChatStore((s) => s.activeByScope[key]) ?? null;
  const loading = useChatStore((s) => s.loadingByScope[key]) ?? false;
  // Always call hooks unconditionally (React rules of hooks)
  const messagesForActive = useChatStore((s) =>
    activeSessionId ? s.messages[activeSessionId] : undefined,
  );
  const hasLoadedForActive = useChatStore((s) =>
    activeSessionId ? (s.messagesLoaded[activeSessionId] ?? false) : false,
  );
  const streaming = useChatStore((s) => s.streaming);
  const pendingPermissionForActive = useChatStore((s) =>
    activeSessionId ? s.pendingPermissions[activeSessionId] : undefined,
  );
  const connected = useChatStore((s) => s.connected);
  const error = useChatStore((s) => s.error);
  const activityForActive = useChatStore((s) =>
    activeSessionId ? s.activity[activeSessionId] : undefined,
  );
  const messages = messagesForActive;
  const hasLoaded = hasLoadedForActive;
  const pendingPermission = pendingPermissionForActive;
  const activity = activityForActive;

  const loadSessions = useChatStore((s) => s.loadSessions);
  const selectSession = useChatStore((s) => s.selectSession);
  const newSession = useChatStore((s) => s.newSession);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const send = useChatStore((s) => s.send);
  const retrySend = useChatStore((s) => s.retrySend);
  const abort = useChatStore((s) => s.abort);
  const respondPermission = useChatStore((s) => s.respondPermission);
  const removeSession = useChatStore((s) => s.removeSession);
  const renameSession = useChatStore((s) => s.renameSession);

  // Load session list on mount / scope change
  useEffect(() => {
    void loadSessions(scope, companySlug);
  }, [scope.type, scope.id, companySlug, loadSessions]);

  // Load history when the active session changes (or first mounts).
  // Guard on messagesLoaded — not message count — so empty-but-loaded
  // sessions don't refetch, and unloaded sessions always fetch.
  useEffect(() => {
    if (activeSessionId && !hasLoaded) {
      void loadMessages(companySlug, activeSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, hasLoaded]);

  // Reload session list + history when the WS reconnects (catch up on missed events)
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      void loadSessions(scope, companySlug);
      if (activeSessionId) void loadMessages(companySlug, activeSessionId);
    }
    wasConnected.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const isStreaming = activeSession
    ? Object.keys(streaming).includes(activeSession.opencodeSessionId)
    : false;

  // Agent/model for header + thread meta + input placeholder (employee scope).
  const employee = useEmployeeStore((s) =>
    scope.type === "employee" ? s.employees.find((e) => e.id === (employeeId ?? scope.id)) : undefined,
  );
  const agentName = employee?.name;
  const model = employee?.model;

  const handleNewSession = () => {
    if (scope.type === "employee" && employeeId) {
      void newSession(scope, companySlug, employeeId);
    } else if (scope.type === "task") {
      // Task scope: single session — create on demand (employeeId unused).
      void newSession(scope, companySlug, "");
    }
  };

  const showNewSessionCta = showSidebar || (scope.type === "task" && sessions.length === 0);

  return (
    <div className={cn("flex h-full min-h-0 overflow-hidden rounded-xl border bg-card", className)}>
      {showSidebar && (
        <div className="w-64 shrink-0 md:w-72">
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={(id) => void selectSession(scope, id)}
            onNewSession={handleNewSession}
            onDelete={(id) => void removeSession(scope, companySlug, id)}
            onRename={(id, name) => void renameSession(scope, companySlug, id, name)}
            loading={loading}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => useChatStore.setState({ error: null })}
              className="text-destructive/70 hover:text-destructive"
            >
              ✕
            </button>
          </div>
        )}

        {/* Disconnected banner */}
        {!connected && (
          <div className="border-b bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
            Reconnecting to server…
          </div>
        )}

        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              connected ? "bg-emerald-500" : "bg-red-500",
            )}
            title={connected ? "Connected" : "Disconnected"}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {activeSession?.name ?? "Chat"}
            </span>
            {(agentName || model) && (
              <span className="block truncate text-xs text-muted-foreground">
                {[agentName, model].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          {isStreaming && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              streaming…
            </span>
          )}
        </div>

        {/* Thread — height-constrained flex container so the scroller can fill it */}
        <div className="flex min-h-0 flex-1 flex-col">
          {scope.type === "task" && sessions.length === 0 && !loading ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm font-medium">No discussion yet</p>
              <p className="text-sm text-muted-foreground">
                Start a discussion about this task.
              </p>
              {showNewSessionCta && (
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="mt-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Start discussion
                </button>
              )}
            </div>
          ) : (
            <ChatThread
              messages={messages ?? []}
              isStreaming={isStreaming}
              activity={activity ?? null}
              pendingPermission={pendingPermission ?? null}
              sessionId={activeSessionId}
              hasLoaded={hasLoaded}
              agentName={agentName}
              model={model}
              onRetry={
                activeSessionId
                  ? (messageId) => void retrySend(companySlug, activeSessionId, messageId)
                  : undefined
              }
              onPermissionRespond={
                activeSessionId
                  ? (response) => void respondPermission(companySlug, activeSessionId, response)
                  : undefined
              }
            />
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={(text) => {
            if (activeSessionId) void send(companySlug, activeSessionId, text);
          }}
          onStop={() => {
            if (activeSessionId) void abort(companySlug, activeSessionId);
          }}
          isStreaming={isStreaming}
          disabled={!activeSessionId}
          agentName={agentName}
        />
      </div>
    </div>
  );
}