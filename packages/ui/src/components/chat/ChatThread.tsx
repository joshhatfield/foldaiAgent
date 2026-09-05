import { useEffect, useRef } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import {
  MessageScrollerProvider,
  MessageScrollerRoot,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import { ChatMessage } from "./ChatMessage";
import { PermissionCard } from "./PermissionCard";
import type { ChatMessageEntry } from "../../api/client";

interface ChatThreadProps {
  messages: ChatMessageEntry[];
  isStreaming: boolean;
  /** Live activity text, e.g. "Calling model…" or "Running bash…" */
  activity?: string | null;
  pendingPermission?: { permissionId: string } | null;
  onPermissionRespond?: (response: "once" | "always" | "reject") => void;
  /** Active session id — used to pin to latest when its history arrives */
  sessionId: string | null;
  /** True once history has been fetched for this session (even if empty) */
  hasLoaded: boolean;
  /** Agent display name (empty state + assistant meta lines) */
  agentName?: string;
  /** Model id shown in assistant meta lines */
  model?: string;
  /** Retry a failed send */
  onRetry?: (messageId: string) => void;
}

function ActivityRow({ text, agentName }: { text: string; agentName?: string }) {
  return (
    <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>{agentName ? `${agentName} · ${text}` : text}</span>
    </div>
  );
}

export function ChatThread({
  messages,
  isStreaming,
  activity,
  pendingPermission,
  onPermissionRespond,
  sessionId,
  hasLoaded,
  agentName,
  model,
  onRetry,
}: ChatThreadProps) {
  // The streaming tail = last assistant entry (gets the blinking cursor)
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.info.role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <MessageScrollerProvider autoScroll>
      <ThreadBody
        messages={messages}
        isStreaming={isStreaming}
        activity={activity}
        pendingPermission={pendingPermission}
        onPermissionRespond={onPermissionRespond}
        sessionId={sessionId}
        hasLoaded={hasLoaded}
        agentName={agentName}
        model={model}
        onRetry={onRetry}
        lastAssistantIdx={lastAssistantIdx}
      />
    </MessageScrollerProvider>
  );
}

/** Inner body — must live under the Provider to use pinToBottom. */
function ThreadBody({
  messages,
  isStreaming,
  activity,
  pendingPermission,
  onPermissionRespond,
  sessionId,
  hasLoaded,
  agentName,
  model,
  onRetry,
  lastAssistantIdx,
}: ChatThreadProps & { lastAssistantIdx: number }) {
  const { pinToBottom } = useMessageScroller();

  // Pin to the latest message when a session's history first arrives.
  const pinnedSession = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId && hasLoaded && pinnedSession.current !== sessionId) {
      pinnedSession.current = sessionId;
      pinToBottom(true);
    }
    if (!sessionId) pinnedSession.current = null;
  }, [sessionId, hasLoaded, messages.length, pinToBottom]);

  // The follow-tail anchor belongs on the last message so deltas keep the
  // viewport pinned; fall back to the activity row when the thread is empty.
  const anchorIdx = messages.length > 0 ? messages.length - 1 : -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerRoot className="relative min-h-0 flex-1">
        <MessageScrollerViewport className="min-h-0 flex-1">
          <MessageScrollerContent className="mx-auto w-full max-w-[768px] gap-6 px-4 py-6 md:px-6">
            {messages.length === 0 && !isStreaming && hasLoaded && (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Start the conversation</p>
                <p className="text-sm text-muted-foreground">
                  {agentName ? `Send a message to ${agentName} below` : "Send a message below"}
                </p>
              </div>
            )}
            {messages.length === 0 && !isStreaming && !hasLoaded && (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                Loading messages…
              </div>
            )}
            {messages.map((entry, idx) => (
              <MessageScrollerItem key={entry.info.id} scrollAnchor={idx === anchorIdx}>
                <ChatMessage
                  entry={entry}
                  isStreamingTail={isStreaming && idx === lastAssistantIdx}
                  agentName={agentName}
                  model={model}
                  onRetry={onRetry}
                />
              </MessageScrollerItem>
            ))}
            {isStreaming && activity && anchorIdx === -1 && (
              <MessageScrollerItem scrollAnchor>
                <ActivityRow text={activity} agentName={agentName} />
              </MessageScrollerItem>
            )}
            {isStreaming && activity && anchorIdx !== -1 && (
              <ActivityRow text={activity} agentName={agentName} />
            )}
            {isStreaming && !activity && anchorIdx === -1 && (
              <MessageScrollerItem scrollAnchor>
                {/* Streaming tail anchor — keeps viewport pinned while deltas arrive */}
                <div className="h-px" />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScrollerRoot>

      {pendingPermission && onPermissionRespond && (
        <div className="shrink-0 border-t p-3">
          <div className="mx-auto max-w-3xl">
            <PermissionCard onRespond={onPermissionRespond} />
          </div>
        </div>
      )}
    </div>
  );
}