import { Router } from 'express';
import type { ProjectService } from '../services/project-service.js';

interface ProjectParams {
  companySlug: string;
  id?: string;
}

export function createProjectRoutes(projectService: ProjectService): Router {
  const router = Router({ mergeParams: true });

  // List projects for a company
  router.get('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as ProjectParams;
      const projects = await projectService.list(slug);
      res.json({ projects });
    } catch {
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  // Create a project
  router.post('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as ProjectParams;
      const { name, description, path, contextFiles } = req.body;

      if (!name || !description || !path) {
        res.status(400).json({ error: 'name, description, and path are required' });
        return;
      }

      const project = await projectService.create(slug, {
        name,
        description,
        path,
        contextFiles: contextFiles ?? [],
      });

      res.status(201).json({ project });
    } catch {
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Get project by ID
  router.get('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<ProjectParams>;
      const project = await projectService.getById(slug, id);

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ project });
    } catch {
      res.status(500).json({ error: 'Failed to get project' });
    }
  });

  // Update project
  router.put('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<ProjectParams>;
      const updates = req.body;

      const project = await projectService.update(slug, id, updates);

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ project });
    } catch {
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // Delete project
  router.delete('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<ProjectParams>;
      const removed = await projectService.remove(slug, id);

      if (!removed) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  return router;
}