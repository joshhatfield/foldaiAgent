import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatToolPart } from "../../api/client";

const STATUS_ICON = {
  pending: Loader2,
  running: Loader2,
  completed: CheckCircle2,
  error: XCircle,
} as const;

function formatElapsed(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/**
 * Elapsed time since the tool row first rendered live. Tool parts carry no
 * server timestamp, so mount time is the honest local reference — it answers
 * "how long has this been running in my view".
 */
function useLiveElapsed(isLive: boolean): number {
  const startedAt = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  if (isLive && startedAt.current == null) startedAt.current = Date.now();
  if (!isLive) startedAt.current = null;
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isLive]);
  return startedAt.current == null ? 0 : now - startedAt.current;
}

export function ToolCallCard({ part }: { part: ChatToolPart }) {
  const [open, setOpen] = useState(false);
  const status: keyof typeof STATUS_ICON =
    (part.state?.status as keyof typeof STATUS_ICON) ?? "pending";
  const Icon = STATUS_ICON[status] ?? Loader2;
  const isLive = status === "running" || status === "pending";
  const elapsed = useLiveElapsed(isLive);

  return (
    <div className="rounded-lg border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/60"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", status === "running" && "animate-spin")} />
        <span className="font-medium">{part.tool}</span>
        {isLive && (
          <span className="tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
        )}
        <span
          className={cn(
            "ml-auto",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status}
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-3 py-2 font-mono">
          {part.state?.input != null && (
            <div className="mb-1">
              <span className="text-muted-foreground">input:</span>
              <pre className="mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(part.state.input, null, 2)}
              </pre>
            </div>
          )}
          {part.state?.output != null && (
            <div>
              <span className="text-muted-foreground">output:</span>
              <pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {typeof part.state.output === "string"
                  ? part.state.output
                  : JSON.stringify(part.state.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}