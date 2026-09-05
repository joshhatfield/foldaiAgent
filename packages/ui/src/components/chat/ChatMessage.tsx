import { memo } from "react";
import { Message, Bubble, Marker } from "@/components/ui/message";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallCard } from "./ToolCallCard";
import type { ChatMessageEntry, ChatPart } from "../../api/client";

interface ChatMessageProps {
  entry: ChatMessageEntry;
  /** This message is the live streaming tail — show blinking cursor */
  isStreamingTail?: boolean;
  /** Agent display name (assistant meta line + avatar initial) */
  agentName?: string;
  /** Model id shown in the assistant meta line */
  model?: string;
  /** Retry a failed send */
  onRetry?: (messageId: string) => void;
}

function formatTime(created?: number): string {
  if (!created) return "";
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessagePart({ part, isTail }: { part: ChatPart; isTail: boolean }) {
  switch (part.type) {
    case "text":
      if (!part.text) return null;
      return (
        <>
          <MarkdownRenderer content={part.text} />
          {isTail && <span className="animate-pulse text-foreground">▍</span>}
        </>
      );
    case "reasoning":
      if (!part.text) return null;
      return (
        <div className="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
          <MarkdownRenderer content={part.text} />
        </div>
      );
    case "tool":
      return <ToolCallCard part={part} />;
    default:
      // step-start / step-finish are structural — not rendered
      return null;
  }
}

/** Assistant meta line: agent · model · time */
function MessageMeta({ agentName, model, created }: { agentName?: string; model?: string; created?: number }) {
  const time = formatTime(created);
  if (!agentName && !model && !time) return null;
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
      {agentName && <span className="font-medium">{agentName}</span>}
      {model && <span className="font-mono">· {model}</span>}
      {time && <span>· {time}</span>}
    </div>
  );
}

/** Compact stacked tool timeline beneath assistant text. */
function ToolTimeline({ parts }: { parts: ChatPart[] }) {
  const tools = parts.filter((p) => p.type === "tool");
  if (tools.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {tools.map((part, i) => (
        <ToolCallCard key={part.id ?? `tool-${i}`} part={part} />
      ))}
    </div>
  );
}

/** Failed-send footer with retry. */
function ErrorFooter({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-destructive">
      <span className="truncate">Something went wrong — {message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function UserBubble({ entry, isStreamingTail, lastTextPartId, onRetry }: { entry: ChatMessageEntry; isStreamingTail?: boolean; lastTextPartId: string | null; onRetry?: (messageId: string) => void }) {
  const time = formatTime(entry.info.time?.created);
  const failed = entry.info.error != null;
  const errorText = typeof entry.info.error === "string" ? entry.info.error : "send failed";
  return (
    <Message align="end">
      <div className="flex w-full justify-end">
        <div className="flex max-w-[70%] flex-col items-end gap-1">
          <Bubble variant="default" className="w-fit max-w-full">
            <div className="space-y-2 whitespace-pre-wrap">
              {entry.parts.map((part, i) => (
                <MessagePart
                  key={part.id ?? i}
                  part={part}
                  isTail={isStreamingTail === true && (part.id ?? `idx-${i}`) === lastTextPartId}
                />
              ))}
            </div>
          </Bubble>
          {time && (
            <span className="px-1 text-[11px] text-muted-foreground">{time}</span>
          )}
          {failed && (
            <ErrorFooter message={errorText} onRetry={onRetry ? () => onRetry(entry.info.id) : undefined} />
          )}
        </div>
      </div>
    </Message>
  );
}

function AssistantBubble({ entry, isStreamingTail, lastTextPartId, agentName, model }: { entry: ChatMessageEntry; isStreamingTail?: boolean; lastTextPartId: string | null; agentName?: string; model?: string }) {
  const initial = (agentName ?? "A").trim().charAt(0).toUpperCase() || "A";
  const textParts = entry.parts.filter((p) => p.type === "text" || p.type === "reasoning");
  const hasText = textParts.some((p) => p.type === "text" || p.type === "reasoning") &&
    textParts.some((p) => "text" in p && p.text);
  return (
    <Message align="start">
      <div className="flex w-full justify-start gap-2.5">
        <div
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
        >
          {initial}
        </div>
        <div className="flex min-w-0 max-w-[85%] flex-col gap-1.5">
          <MessageMeta agentName={agentName} model={model} created={entry.info.time?.created} />
          {hasText && (
            <Bubble variant="muted" className="w-fit max-w-full">
              <div className="space-y-2">
                {entry.parts.map((part, i) =>
                  part.type === "text" || part.type === "reasoning" ? (
                    <MessagePart
                      key={part.id ?? i}
                      part={part}
                      isTail={isStreamingTail === true && (part.id ?? `idx-${i}`) === lastTextPartId}
                    />
                  ) : null,
                )}
              </div>
            </Bubble>
          )}
          <ToolTimeline parts={entry.parts} />
        </div>
      </div>
    </Message>
  );
}

export const ChatMessage = memo(function ChatMessage({ entry, isStreamingTail, agentName, model, onRetry }: ChatMessageProps) {
  const isUser = entry.info.role === "user";
  const hasVisibleParts = entry.parts.some((p) => p.type === "text" || p.type === "tool");

  // The cursor goes after the LAST text part of the tail message
  const lastTextPartId = (() => {
    for (let i = entry.parts.length - 1; i >= 0; i--) {
      const p = entry.parts[i]!;
      if (p.type === "text" && p.text) return p.id ?? `idx-${i}`;
    }
    return null;
  })();

  if (isUser) {
    if (!hasVisibleParts) return null;
    return (
      <div className={entry.pending ? "opacity-70" : undefined}>
        <UserBubble entry={entry} isStreamingTail={isStreamingTail} lastTextPartId={lastTextPartId} onRetry={onRetry} />
      </div>
    );
  }

  if (!hasVisibleParts) {
    if (!isStreamingTail) return null;
    return (
      <Message align="start">
        <Bubble variant="muted">
          <Marker />
        </Bubble>
      </Message>
    );
  }

  return (
    <AssistantBubble
      entry={entry}
      isStreamingTail={isStreamingTail}
      lastTextPartId={lastTextPartId}
      agentName={agentName}
      model={model}
    />
  );
});