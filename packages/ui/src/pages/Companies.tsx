import { useEffect, useState } from "react";
import { useCompanyStore } from "../stores/company-store";
import { Modal } from "../components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function Companies() {
  const { companies, selectedSlug, loading, load, create, select } = useCompanyStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const company = await create(name.trim());
    select(company.slug);
    setName("");
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Button onClick={() => setShowCreate(true)}>New Company</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : companies.length === 0 ? (
        <Card className="p-8 text-center">
          <CardContent>
            <p className="text-muted-foreground">No companies yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Create your first company to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.slug)}
              className={`w-full text-left rounded-xl border p-4 transition-colors hover:border-ring ${
                selectedSlug === c.slug
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.slug}</div>
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Company">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}