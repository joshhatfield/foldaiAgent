import { useEffect, useState } from "react";
import { useCompanyStore } from "../stores/company-store";
import { useCabinetStore } from "../stores/cabinet-store";
import { Modal } from "../components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CabinetFileType } from "../api/client";

export function Cabinet() {
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { files, selectedContent, loading, load, create, loadContent, updateContent, remove } = useCabinetStore();
  const [showCreate, setShowCreate] = useState(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [form, setForm] = useState({ name: "", content: "", type: "company" as CabinetFileType });

  useEffect(() => {
    if (selectedSlug) load(selectedSlug);
  }, [selectedSlug, load]);

  if (!selectedSlug) {
    return <EmptyState message="Select a company first" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content) return;
    await create(selectedSlug, form);
    setForm({ name: "", content: "", type: "company" });
    setShowCreate(false);
  };

  const handleView = async (fileId: string) => {
    if (viewingFile === fileId) {
      setViewingFile(null);
      return;
    }
    setViewingFile(fileId);
    await loadContent(selectedSlug, fileId);
  };

  const startEdit = (fileId: string) => {
    setEditingFile(fileId);
    setEditContent(selectedContent ?? "");
  };

  const saveEdit = async () => {
    if (editingFile) {
      await updateContent(selectedSlug, editingFile, editContent);
      setEditingFile(null);
    }
  };

  const typeBadge = (type: CabinetFileType) => {
    const variants: Record<CabinetFileType, "default" | "secondary"> = {
      company: "default",
      project: "secondary",
      task: "default",
    };
    const colors: Record<CabinetFileType, string> = {
      company: "bg-blue-600 hover:bg-blue-600",
      project: "",
      task: "bg-emerald-600 hover:bg-emerald-600",
    };
    return <Badge variant={variants[type]} className={colors[type]}>{type}</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Filing Cabinet</h1>
        <Button onClick={() => setShowCreate(true)}>New File</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : files.length === 0 ? (
        <EmptyState message="No files in cabinet" />
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {typeBadge(file.type)}
                    <span className="font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleView(file.id)}>
                      {viewingFile === file.id ? "hide" : "view"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { handleView(file.id); startEdit(file.id); }}>
                      edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => remove(selectedSlug, file.id)}>
                      delete
                    </Button>
                  </div>
                </div>

                {viewingFile === file.id && (
                  <div className="border-t mt-4 pt-4">
                    {editingFile === file.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-muted border border-border rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring min-h-[200px]"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFile(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="bg-muted rounded-md p-3 text-sm overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                        {selectedContent ?? "Loading..."}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Cabinet File">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Coding Standards" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as CabinetFileType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company Policy</SelectItem>
                <SelectItem value="project">Project File</SelectItem>
                <SelectItem value="task">Task Output</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content (Markdown)</Label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full bg-transparent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[120px] font-mono"
              placeholder="# My Document..."
            />
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

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center">
      <CardContent>
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}