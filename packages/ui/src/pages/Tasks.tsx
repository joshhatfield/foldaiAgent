import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanyStore } from "../stores/company-store";
import { useTaskStore } from "../stores/task-store";
import { useProjectStore } from "../stores/project-store";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskStatus } from "../api/client";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "for_review", label: "For Review" },
  { status: "complete", label: "Complete" },
];

export function Tasks() {
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { tasks, loading, load, create, update, remove, run } = useTaskStore();
  const { projects, load: loadProjects } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", projectId: "", status: "todo" as TaskStatus });

  useEffect(() => {
    if (selectedSlug) {
      load(selectedSlug);
      loadProjects(selectedSlug);
    }
  }, [selectedSlug, load, loadProjects]);

  if (!selectedSlug) {
    return <EmptyState message="Select a company first" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) return;
    await create(selectedSlug, {
      ...form,
      projectId: form.projectId || null,
    });
    setForm({ title: "", description: "", projectId: "", status: "todo" });
    setShowCreate(false);
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    await update(selectedSlug, taskId, { status: newStatus });
  };

  const handleRun = async (taskId: string) => {
    await update(selectedSlug, taskId, { status: "todo" });
    await run(selectedSlug, taskId);
  };

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button onClick={() => setShowCreate(true)}>New Task</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {COLUMNS.map((col) => (
            <Card key={col.status} className="bg-card/50">
              <CardContent className="p-0">
                <div className="px-3 py-2 border-b font-medium text-sm flex items-center justify-between">
                  {col.label}
                  <span className="text-muted-foreground text-xs">{tasksByStatus(col.status).length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {tasksByStatus(col.status).map((task) => (
                    <Card key={task.id} className="group">
                      <CardContent className="p-3 text-sm">
                        <Link to={`/tasks/${task.id}`} className="font-medium hover:text-primary block mb-1">
                          {task.title}
                        </Link>
                        <div className="text-muted-foreground text-xs mb-2 line-clamp-2">{task.description}</div>
                        <div className="flex items-center justify-between">
                          <StatusBadge status={task.status} />
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {col.status === "todo" && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
                                onClick={() => handleRun(task.id)}>run</Button>
                            )}
                            {col.status === "for_review" && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
                                onClick={() => moveTask(task.id, "complete")}>accept</Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive"
                              onClick={() => remove(selectedSlug, task.id)}>del</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={form.projectId || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v === "__none__" ? "" : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project (company task)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Add user authentication" />
          <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Implement login/register..." />
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => (
                  <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <CardContent>
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}