import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCompanyStore } from "../stores/company-store";
import { useProjectStore } from "../stores/project-store";
import { useTaskStore } from "../stores/task-store";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);
  const { projects, load } = useProjectStore();
  const { tasks, load: loadTasks } = useTaskStore();

  useEffect(() => {
    if (selectedSlug) {
      load(selectedSlug);
      loadTasks(selectedSlug);
    }
  }, [selectedSlug, load, loadTasks]);

  if (!selectedSlug || !id) return null;

  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <Card className="p-8 text-center">
        <CardContent>
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="link" onClick={() => navigate("/projects")}>Back to projects</Button>
        </CardContent>
      </Card>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/projects")} className="mb-4">
        &larr; Back to projects
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{project.name}</CardTitle>
            <Badge variant="secondary">{projectTasks.length} tasks</Badge>
          </div>
          <CardDescription>{project.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Path: </span>
              <span className="font-mono text-xs">{project.path}</span>
            </div>
            {project.contextFiles.length > 0 && (
              <div className="flex gap-1 flex-wrap pt-1">
                {project.contextFiles.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-3">Tasks</h2>
      {projectTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <CardContent>
            <p className="text-muted-foreground">No tasks in this project yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {projectTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <button
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="font-medium hover:text-primary"
                  >
                    {task.title}
                  </button>
                  <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                </div>
                <StatusBadge status={task.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}