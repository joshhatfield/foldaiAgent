import { Router } from 'express';
import type { CompanyService } from '../services/company-service.js';

interface CompanyParams {
  slug: string;
}

export function createCompanyRoutes(companyService: CompanyService): Router {
  const router = Router();

  // List all companies
  router.get('/', async (_req, res) => {
    try {
      const companies = await companyService.list();
      res.json({ companies });
    } catch {
      res.status(500).json({ error: 'Failed to list companies' });
    }
  });

  // Create a company
  router.post('/', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const company = await companyService.create(name);
      res.status(201).json({ company });
    } catch {
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  // Get company by slug
  router.get('/:slug', async (req, res) => {
    try {
      const { slug } = req.params as CompanyParams;
      const company = await companyService.getBySlug(slug);

      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      res.json({ company });
    } catch {
      res.status(500).json({ error: 'Failed to get company' });
    }
  });

  return router;
}