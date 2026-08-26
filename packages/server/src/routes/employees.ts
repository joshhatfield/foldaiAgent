import { Router } from 'express';
import type { EmployeeService } from '../services/employee-service.js';

interface EmployeeParams {
  companySlug: string;
  id?: string;
}

export function createEmployeeRoutes(employeeService: EmployeeService): Router {
  const router = Router({ mergeParams: true });

  // List employees for a company
  router.get('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as EmployeeParams;
      const employees = await employeeService.list(slug);
      res.json({ employees });
    } catch {
      res.status(500).json({ error: 'Failed to list employees' });
    }
  });

  // Create an employee
  router.post('/', async (req, res) => {
    try {
      const { companySlug: slug } = req.params as EmployeeParams;
      const { name, role, persona, agent, skills, model } = req.body;

      if (!name || !role || !persona || !agent || !model) {
        res.status(400).json({
          error: 'name, role, persona, agent, and model are required',
        });
        return;
      }

      const employee = await employeeService.create(slug, {
        name,
        role,
        persona,
        agent,
        skills: skills ?? [],
        model,
      });

      res.status(201).json({ employee });
    } catch {
      res.status(500).json({ error: 'Failed to create employee' });
    }
  });

  // Get employee by ID
  router.get('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<EmployeeParams>;
      const employee = await employeeService.getById(slug, id);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ employee });
    } catch {
      res.status(500).json({ error: 'Failed to get employee' });
    }
  });

  // Update employee
  router.put('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<EmployeeParams>;
      const updates = req.body;

      const employee = await employeeService.update(slug, id, updates);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ employee });
    } catch {
      res.status(500).json({ error: 'Failed to update employee' });
    }
  });

  // Delete employee
  router.delete('/:id', async (req, res) => {
    try {
      const { companySlug: slug, id } = req.params as Required<EmployeeParams>;
      const removed = await employeeService.remove(slug, id);

      if (!removed) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete employee' });
    }
  });

  return router;
}