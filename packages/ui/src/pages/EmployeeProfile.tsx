import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompanyStore } from "../stores/company-store";
import { useEmployeeStore } from "../stores/employee-store";
import { ChatWindow } from "../components/chat/ChatWindow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { employees, load } = useEmployeeStore();

  useEffect(() => {
    if (selectedSlug) load(selectedSlug);
  }, [selectedSlug, load]);

  if (!selectedSlug || !id) return null;

  const employee = employees.find((e) => e.id === id);

  if (!employee) {
    return (
      <Card className="p-8 text-center">
        <CardContent>
          <p className="text-muted-foreground">Employee not found</p>
          <Button variant="link" onClick={() => navigate("/employees")}>Back to employees</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Employee info card */}
      <Card className="shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/employees")}>
                &larr;
              </Button>
              <div>
                <CardTitle>{employee.name}</CardTitle>
                <CardDescription>{employee.role}</CardDescription>
              </div>
            </div>
            <Badge
              variant={employee.status === "available" ? "default" : "secondary"}
              className={employee.status === "available" ? "bg-emerald-600 hover:bg-emerald-600" : ""}
            >
              {employee.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm italic text-muted-foreground">{employee.persona}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Agent: <span className="font-mono text-foreground">{employee.agent}</span></span>
            <span>·</span>
            <span>Model: <span className="font-mono text-foreground">{employee.model}</span></span>
            {employee.skills.length > 0 && (
              <>
                <span>·</span>
                {employee.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat window — multi-session, fills remaining height and scrolls internally */}
      <div className="min-h-0 flex-1">
        <ChatWindow
          scope={{ type: "employee", id: employee.id }}
          companySlug={selectedSlug}
          employeeId={employee.id}
          className="h-full"
        />
      </div>
    </div>
  );
}