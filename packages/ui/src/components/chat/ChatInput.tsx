import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  /** Agent display name used in the input placeholder */
  agentName?: string;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, agentName }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || isStreaming) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t p-3 md:p-4">
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder={agentName ? `Reply to ${agentName}…` : "Send a message…"}
          rows={1}
          disabled={disabled}
          aria-label="Chat message"
          className="max-h-48 min-h-[44px] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {isStreaming ? (
          <Button size="icon" variant="destructive" onClick={onStop} title="Stop generating">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={submit}
            disabled={!value.trim() || disabled}
            className={cn(!value.trim() && "opacity-40")}
            title="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}