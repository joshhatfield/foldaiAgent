import { useEffect, useState } from "react";
import { useCompanyStore } from "../stores/company-store";
import { useProjectStore } from "../stores/project-store";
import { Modal } from "../components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Projects() {
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { projects, loading, load, create, remove } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", path: "" });

  useEffect(() => {
    if (selectedSlug) load(selectedSlug);
  }, [selectedSlug, load]);

  if (!selectedSlug) {
    return <EmptyState message="Select a company first" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.description || !form.path) return;
    await create(selectedSlug, form);
    setForm({ name: "", description: "", path: "" });
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>Add Project</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <EmptyState message="No projects yet" />
      ) : (
        <div className="space-y-3">
          {projects.map((proj) => (
            <Card key={proj.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{proj.name}</span>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                    onClick={() => remove(selectedSlug, proj.id)}>
                    remove
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>{proj.description}</div>
                  <div className="font-mono text-xs">{proj.path}</div>
                  {proj.contextFiles.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {proj.contextFiles.map((f) => (
                        <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Project">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="My SaaS App" />
          <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="The main product" />
          <Field label="Path" value={form.path} onChange={(v) => setForm((f) => ({ ...f, path: v }))} placeholder="/home/user/projects/my-app" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
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