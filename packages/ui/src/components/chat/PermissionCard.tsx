import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermissionCardProps {
  onRespond: (response: "once" | "always" | "reject") => void;
}

export function PermissionCard({ onRespond }: PermissionCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-600/50 bg-amber-950/30 px-4 py-3">
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Permission requested</p>
        <p className="text-xs text-muted-foreground">The agent wants to use a tool that needs your approval.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={() => onRespond("reject")}>
          Deny
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onRespond("once")}>
          Allow once
        </Button>
        <Button size="sm" onClick={() => onRespond("always")}>
          Always
        </Button>
      </div>
    </div>
  );
}