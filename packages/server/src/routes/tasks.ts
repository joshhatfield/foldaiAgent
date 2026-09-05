import { Router } from 'express';
import type { TaskService, TaskStatus } from '../services/task-service.js';
import type { TaskRunner } from '../services/task-runner.js';

interface TaskParams {
  companySlug: string;
  id?: string;
}

const VALID_STATUSES: TaskStatus[] = [
  'planned', 'todo', 'in_progress', 'for_review', 'complete', 'blocked', 'cancelled',
];

function isValidStatus(value: string): value is TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus);
}

export function createTaskRoutes(taskService: TaskService, taskRunner?: TaskRunner): Router {
  const router = Router({ mergeParams: true });

  // List tasks for a company (with optional filters)
  router.get('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as TaskParams;
      const { status, projectId } = req.query;

      const filters: { status?: TaskStatus; projectId?: string } = {};

      if (typeof status === 'string') {
        if (!isValidStatus(status)) {
          res.status(400).json({ error: `Invalid status: ${status}` });
          return;
        }
        filters.status = status;
      }

      if (typeof projectId === 'string') {
        filters.projectId = projectId;
      }

      const tasks = await taskService.list(slug, filters);
      res.json({ tasks });
    } catch {
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  // Create a task
  router.post('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as TaskParams;
      const { projectId, title, description, status } = req.body;

      if (!title || !description) {
        res.status(400).json({ error: 'title and description are required' });
        return;
      }

      if (status && !isValidStatus(status)) {
        res.status(400).json({ error: `Invalid status: ${status}` });
        return;
      }

      const task = await taskService.create(slug, {
        projectId: projectId ?? null,
        title,
        description,
        status,
      });

      res.status(201).json({ task });
    } catch {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Get task by ID
  router.get('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<TaskParams>;
      const task = await taskService.getById(slug, id);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ task });
    } catch {
      res.status(500).json({ error: 'Failed to get task' });
    }
  });

  // Update task (status transitions, assignment, etc.)
  router.put('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<TaskParams>;
      const updates = req.body;

      if (updates.status && !isValidStatus(updates.status)) {
        res.status(400).json({ error: `Invalid status: ${updates.status}` });
        return;
      }

      const task = await taskService.update(slug, id, updates);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ task });
    } catch {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete task
  router.delete('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<TaskParams>;
      const removed = await taskService.remove(slug, id);

      if (!removed) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Manually trigger task execution
  router.post('/:id/run', async (req, res) => {
    if (!taskRunner) {
      res.status(501).json({ error: 'Task runner not available' });
      return;
    }

    try {
      const { companySlug: slug, id } = req.params as Required<TaskParams>;
      const task = await taskService.getById(slug, id);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (task.status !== 'todo') {
        res.status(400).json({ error: `Task must be in "todo" status, currently "${task.status}"` });
        return;
      }

      // Trigger the runner (fire and forget)
      taskRunner.runOnce().catch((err) => {
        console.error('[task-runner] Manual run error:', err);
      });

      res.json({ message: 'Task execution triggered', taskId: id });
    } catch {
      res.status(500).json({ error: 'Failed to trigger task execution' });
    }
  });

  return router;
}