import * as React from "react";
import { cn } from "@/lib/utils";

/** Message: alignment wrapper (user = end, assistant = start) */
function Message({
  align = "start",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn("flex w-full", align === "end" ? "justify-end" : "justify-start", className)}
      {...props}
    />
  );
}

/** Bubble: the visual speech bubble around message content.
 * Width is owned by the row (ChatMessage), not the bubble — single source
 * of width truth so user/assistant widths never double-constrain. */
function Bubble({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "muted" }) {
  return (
    <div
      data-slot="bubble"
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
        variant === "default" && "bg-blue-600 text-white rounded-br-md shadow-sm",
        variant === "muted" && "bg-card border border-border text-foreground rounded-bl-md",
        className,
      )}
      {...props}
    />
  );
}

/** Marker: typing/streaming indicator with shimmer */
function Marker({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="marker"
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
      {children && <span>{children}</span>}
    </div>
  );
}

export { Message, Bubble, Marker };