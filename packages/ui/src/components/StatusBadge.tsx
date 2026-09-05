import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "../api/client";

const STATUS_VARIANTS: Record<TaskStatus, "secondary" | "default" | "destructive" | "outline"> = {
  planned: "secondary",
  todo: "default",
  in_progress: "default",
  for_review: "default",
  complete: "default",
  blocked: "destructive",
  cancelled: "outline",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  planned: "",
  todo: "bg-blue-600 hover:bg-blue-600 text-white border-blue-600",
  in_progress: "bg-amber-600 hover:bg-amber-600 text-white border-amber-600",
  for_review: "bg-violet-600 hover:bg-violet-600 text-white border-violet-600",
  complete: "bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-600",
  blocked: "",
  cancelled: "",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "Planned",
  todo: "Todo",
  in_progress: "In Progress",
  for_review: "For Review",
  complete: "Complete",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}