import { Router } from 'express';
import type { CabinetService, CabinetFileType } from '../services/cabinet-service.js';

interface CabinetParams {
  companySlug: string;
  id?: string;
}

const VALID_TYPES: CabinetFileType[] = ['company', 'project', 'task'];

function isValidType(value: string): value is CabinetFileType {
  return VALID_TYPES.includes(value as CabinetFileType);
}

export function createCabinetRoutes(cabinetService: CabinetService): Router {
  const router = Router({ mergeParams: true });

  // List cabinet files
  router.get('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as CabinetParams;
      const files = await cabinetService.list(slug);
      res.json({ files });
    } catch {
      res.status(500).json({ error: 'Failed to list cabinet files' });
    }
  });

  // Create a cabinet file
  router.post('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as CabinetParams;
      const { name, content, type, linkedTaskIds, linkedProjectIds } = req.body;

      if (!name || !content || !type) {
        res.status(400).json({ error: 'name, content, and type are required' });
        return;
      }

      if (!isValidType(type)) {
        res.status(400).json({ error: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}` });
        return;
      }

      const file = await cabinetService.create(slug, {
        name,
        content,
        type,
        linkedTaskIds: linkedTaskIds ?? [],
        linkedProjectIds: linkedProjectIds ?? [],
      });

      res.status(201).json({ file });
    } catch {
      res.status(500).json({ error: 'Failed to create cabinet file' });
    }
  });

  // Get cabinet file metadata
  router.get('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<CabinetParams>;
      const file = await cabinetService.getById(slug, id);

      if (!file) {
        res.status(404).json({ error: 'Cabinet file not found' });
        return;
      }

      res.json({ file });
    } catch {
      res.status(500).json({ error: 'Failed to get cabinet file' });
    }
  });

  // Get cabinet file content
  router.get('/:id/content', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<CabinetParams>;
      const content = await cabinetService.getContent(slug, id);

      if (content === undefined) {
        res.status(404).json({ error: 'Cabinet file not found' });
        return;
      }

      res.json({ content });
    } catch {
      res.status(500).json({ error: 'Failed to get cabinet file content' });
    }
  });

  // Update cabinet file metadata
  router.put('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<CabinetParams>;
      const updates = req.body;

      const file = await cabinetService.update(slug, id, updates);

      if (!file) {
        res.status(404).json({ error: 'Cabinet file not found' });
        return;
      }

      res.json({ file });
    } catch {
      res.status(500).json({ error: 'Failed to update cabinet file' });
    }
  });

  // Update cabinet file content
  router.put('/:id/content', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<CabinetParams>;
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const updated = await cabinetService.updateContent(slug, id, content);

      if (!updated) {
        res.status(404).json({ error: 'Cabinet file not found' });
        return;
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update cabinet file content' });
    }
  });

  // Delete cabinet file
  router.delete('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<CabinetParams>;
      const removed = await cabinetService.remove(slug, id);

      if (!removed) {
        res.status(404).json({ error: 'Cabinet file not found' });
        return;
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete cabinet file' });
    }
  });

  return router;
}