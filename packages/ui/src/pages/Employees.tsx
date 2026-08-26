import { useEffect, useState } from "react";
import { useCompanyStore } from "../stores/company-store";
import { useEmployeeStore } from "../stores/employee-store";
import { Modal } from "../components/Modal";
import { ModelSelect } from "../components/ModelSelect";
import { api } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Employees() {
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { employees, loading, load, create, update, remove } = useEmployeeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", role: "", persona: "", agent: "OpenCoder", model: "", skills: "" });

  useEffect(() => {
    if (selectedSlug) load(selectedSlug);
  }, [selectedSlug, load]);

  useEffect(() => {
    api.models.list().then(({ models: m }) => setModels(m)).catch(() => setModels([]));
  }, []);

  if (!selectedSlug) {
    return <EmptyState message="Select a company first" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role || !form.persona || !form.agent || !form.model) return;
    await create(selectedSlug, {
      name: form.name,
      role: form.role,
      persona: form.persona,
      agent: form.agent,
      model: form.model,
      skills: form.skills ? form.skills.split(",").map((s) => s.trim()) : [],
    });
    setForm({ name: "", role: "", persona: "", agent: "OpenCoder", model: "", skills: "" });
    setShowCreate(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    await update(selectedSlug, id, { status: current === "available" ? "busy" : "available" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={() => setShowCreate(true)}>Add Employee</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : employees.length === 0 ? (
        <EmptyState message="No employees yet" />
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => (
            <Card key={emp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">{emp.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={emp.status === "available" ? "default" : "secondary"}
                      className={emp.status === "available" ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                      {emp.status}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(emp.id, emp.status)}>
                      toggle
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => remove(selectedSlug, emp.id)}>
                      remove
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Agent: {emp.agent} | Model: {emp.model}</div>
                  <div className="italic">{emp.persona}</div>
                  {emp.skills.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {emp.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Employee">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Alice (Senior Dev)" />
          <Field label="Role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} placeholder="Senior Engineer" />
          <Field label="Persona" value={form.persona} onChange={(v) => setForm((f) => ({ ...f, persona: v }))} placeholder="Experienced TypeScript developer..." />
          <Field label="Agent" value={form.agent} onChange={(v) => setForm((f) => ({ ...f, agent: v }))} placeholder="OpenCoder" />
          <ModelSelect models={models} value={form.model} onChange={(model) => setForm((f) => ({ ...f, model }))} />
          <Field label="Skills (comma-separated)" value={form.skills} onChange={(v) => setForm((f) => ({ ...f, skills: v }))} placeholder="task-management, code-review" />
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