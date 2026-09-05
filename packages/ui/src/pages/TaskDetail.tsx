import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompanyStore } from "../stores/company-store";
import { useTaskStore } from "../stores/task-store";
import { StatusBadge } from "../components/StatusBadge";
import { ChatWindow } from "../components/chat/ChatWindow";
import { api, type TaskStatus } from "../api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  planned: "todo",
  todo: "in_progress",
  in_progress: "for_review",
  for_review: "complete",
};

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { tasks, load, update, remove, run } = useTaskStore();
  const [showOutput, setShowOutput] = useState(false);
  const [outputContent, setOutputContent] = useState<string | null>(null);
  const [loadingOutput, setLoadingOutput] = useState(false);

  useEffect(() => {
    if (selectedSlug) load(selectedSlug);
  }, [selectedSlug, load]);

  if (!selectedSlug || !id) return null;

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <Card className="p-8 text-center">
        <CardContent>
          <p className="text-muted-foreground">Task not found</p>
          <Button variant="link" onClick={() => navigate("/tasks")}>Back to tasks</Button>
        </CardContent>
      </Card>
    );
  }

  const advance = async () => {
    const next = NEXT_STATUS[task.status];
    if (next) await update(selectedSlug, task.id, { status: next });
  };

  const handleRun = async () => {
    await update(selectedSlug, task.id, { status: "todo" });
    await run(selectedSlug, task.id);
  };

  const viewOutput = async () => {
    if (showOutput) {
      setShowOutput(false);
      return;
    }
    setShowOutput(true);
    setLoadingOutput(true);
    try {
      const { content } = await api.tasks.getOutput(selectedSlug, task.id);
      setOutputContent(content);
    } catch {
      setOutputContent("Failed to load output.");
    } finally {
      setLoadingOutput(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Button variant="ghost" onClick={() => navigate("/tasks")} className="w-fit shrink-0">
        &larr; Back to tasks
      </Button>

      <Card className="shrink-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <div>{task.description}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Project: </span>
                <span className="font-mono">{task.projectId ?? "None (company task)"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned: </span>
                <span>{task.assignedTo ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Retries: </span>
                <span>{task.retryCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Output: </span>
                <span>{task.outputFile ? "Available" : "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-4">
            {NEXT_STATUS[task.status] && (
              <Button onClick={advance}>
                Move to {NEXT_STATUS[task.status]!.replace("_", " ")}
              </Button>
            )}
            {task.status === "todo" && (
              <Button variant="secondary" onClick={handleRun}>
                Run Now
              </Button>
            )}
            {task.outputFile && (
              <Button variant="outline" onClick={viewOutput}>
                {showOutput ? "Hide Output" : "View Output"}
              </Button>
            )}
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={async () => { await remove(selectedSlug, task.id); navigate("/tasks"); }}
            >
              Delete
            </Button>
          </div>

          {showOutput && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Task Output</h3>
              <pre className="bg-muted rounded-md p-4 text-sm overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                {loadingOutput ? "Loading..." : (outputContent ?? "No output")}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task discussion — single-session chat, no sidebar */}
      <div className="min-h-[320px] flex-1">
        <ChatWindow
          scope={{ type: "task", id: task.id }}
          companySlug={selectedSlug}
          hideSidebar
          className="h-full"
        />
      </div>
    </div>
  );
}