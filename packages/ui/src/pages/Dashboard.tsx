import { useEffect } from "react";
import { useCompanyStore } from "../stores/company-store";
import { useEmployeeStore } from "../stores/employee-store";
import { useTaskStore } from "../stores/task-store";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Dashboard() {
  const { selectedSlug, load: loadCompanies } = useCompanyStore();
  const { employees, load: loadEmployees } = useEmployeeStore();
  const { tasks, load: loadTasks } = useTaskStore();

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (selectedSlug) {
      loadEmployees(selectedSlug);
      loadTasks(selectedSlug);
    }
  }, [selectedSlug, loadEmployees, loadTasks]);

  const activeTasks = tasks.filter((t) => t.status === "in_progress");
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const reviewTasks = tasks.filter((t) => t.status === "for_review");
  const availableEmployees = employees.filter((e) => e.status === "available");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {!selectedSlug ? (
        <Card className="p-8 text-center">
          <CardContent>
            <p className="text-muted-foreground mb-2">No company selected</p>
            <p className="text-sm text-muted-foreground/60">Go to Companies to create or select one</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Todo" value={todoTasks.length} color="blue" />
            <StatCard label="In Progress" value={activeTasks.length} color="amber" />
            <StatCard label="For Review" value={reviewTasks.length} color="violet" />
            <StatCard label="Available Staff" value={availableEmployees.length} color="emerald" />
          </div>

          {activeTasks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Active Tasks</h2>
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <span className="font-medium">{task.title}</span>
                        <span className="text-muted-foreground text-sm ml-3">
                          {task.description.slice(0, 80)}...
                        </span>
                      </div>
                      <StatusBadge status={task.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {reviewTasks.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Needs Review</h2>
              <div className="space-y-2">
                {reviewTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <span className="font-medium">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const borders: Record<string, string> = {
    blue: "border-l-blue-600",
    amber: "border-l-amber-600",
    violet: "border-l-violet-600",
    emerald: "border-l-emerald-600",
  };
  return (
    <Card className={`border-l-4 ${borders[color] ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}