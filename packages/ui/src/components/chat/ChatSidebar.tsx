import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, MessageSquare, Pencil, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatSession } from "../../api/client";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDelete?: (sessionId: string) => void;
  onRename?: (sessionId: string, name: string) => void;
  loading?: boolean;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewSession,
  onDelete,
  onRename,
  loading,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filter, setFilter] = useState('');
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the active session visible when selection changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeSessionId]);

  const visibleSessions = filter.trim()
    ? sessions.filter((s) => s.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : sessions;

  const startEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditValue(session.name);
  };

  const commitEdit = () => {
    if (editingId && onRename && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex h-full w-full flex-col border-r bg-sidebar">
      <div className="space-y-2 p-3">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onNewSession}>
          <Plus className="h-4 w-4" />
          New chat
        </Button>
        {sessions.length > 1 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2 pt-0">
          {loading ? (
            <div className="space-y-2 p-1" aria-label="Loading chats">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-md bg-sidebar-accent/60 px-2 py-2.5">
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/20" />
                  <div className="mt-1.5 h-2 w-1/3 rounded bg-muted-foreground/15" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet — start one above</p>
          ) : visibleSessions.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No chats match “{filter.trim()}”</p>
          ) : (
            visibleSessions.map((session) => {
              const isActive = session.id === activeSessionId;

              if (editingId === session.id) {
                return (
                  <div key={session.id} className="flex items-center gap-1 px-1 py-0.5">
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-7 text-xs"
                    />
                    <button type="button" onClick={commitEdit} className="text-muted-foreground hover:text-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={session.id}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{session.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {relativeTime(session.updatedAt)}
                    </span>
                  </span>
                  {onRename && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(session);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && startEdit(session)}
                      className="hidden shrink-0 text-muted-foreground hover:text-foreground group-hover:block"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {onDelete && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && onDelete(session.id)}
                      className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}