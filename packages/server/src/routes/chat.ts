import { Router } from 'express';
import type { ChatSessionService } from '../services/chat-session-service.js';
import { deriveTitle } from '../services/chat-session-service.js';
import type { ChatSessionApi } from '../opencode/sessions.js';
import type { EmployeeService } from '../services/employee-service.js';
import type { TaskService } from '../services/task-service.js';

interface ChatParams {
  companySlug: string;
  employeeId?: string;
  taskId?: string;
  id?: string;
}

const DEFAULT_TITLE = 'New chat';
const MAX_HISTORY_LIMIT = 500;

function parseLimit(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return Math.min(n, MAX_HISTORY_LIMIT);
}

export function createChatRoutes(
  chatSessionService: ChatSessionService,
  chatApi: ChatSessionApi,
  employeeService: EmployeeService,
  taskService?: TaskService,
): Router {
  const router = Router({ mergeParams: true });

  // List sessions for an employee
  router.get('/employees/:employeeId/sessions', async (req, res) => {
    try {
      const { companySlug, employeeId } = req.params as Required<ChatParams>;
      const sessions = await chatSessionService.list(companySlug, {
        type: 'employee',
        id: employeeId,
      });
      res.json({ sessions });
    } catch {
      res.status(500).json({ error: 'Failed to list chat sessions' });
    }
  });

  // List sessions for a task (single-session mode reads sessions[0])
  router.get('/tasks/:taskId/sessions', async (req, res) => {
    try {
      const { companySlug, taskId } = req.params as Required<ChatParams>;
      if (taskService) {
        const task = await taskService.getById(companySlug, taskId);
        if (!task) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
      }
      const sessions = await chatSessionService.list(companySlug, {
        type: 'task',
        id: taskId,
      });
      res.json({ sessions });
    } catch {
      res.status(500).json({ error: 'Failed to list chat sessions' });
    }
  });

  // Create a session for a task
  router.post('/tasks/:taskId/sessions', async (req, res) => {
    try {
      const { companySlug, taskId } = req.params as Required<ChatParams>;
      const { title } = req.body as { title?: string };

      if (taskService) {
        const task = await taskService.getById(companySlug, taskId);
        if (!task) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
      }

      const oc = await chatApi.createSession({
        title: title ?? 'Task discussion',
      });

      const session = await chatSessionService.create(companySlug, {
        scopeType: 'task',
        scopeId: taskId,
        opencodeSessionId: oc.id,
        name: title ?? 'New chat',
      });

      res.status(201).json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create chat session';
      res.status(500).json({ error: message });
    }
  });

  // Create a session for an employee
  router.post('/employees/:employeeId/sessions', async (req, res) => {
    try {
      const { companySlug, employeeId } = req.params as Required<ChatParams>;
      const { title } = req.body as { title?: string };

      const employee = await employeeService.getById(companySlug, employeeId);
      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const oc = await chatApi.createSession({
        title: title ?? `${employee.name} — chat`,
      });

      const session = await chatSessionService.create(companySlug, {
        scopeType: 'employee',
        scopeId: employeeId,
        opencodeSessionId: oc.id,
        name: title ?? 'New chat',
      });

      res.status(201).json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create chat session';
      res.status(500).json({ error: message });
    }
  });

  // Get message history for a session (?limit=N returns most recent N)
  router.get('/chat/sessions/:id/messages', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const session = await chatSessionService.getById(companySlug, id);
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      const limit = parseLimit(req.query['limit']);
      if (req.query['limit'] != null && limit === undefined) {
        res.status(400).json({ error: 'limit must be a positive integer' });
        return;
      }

      const messages = await chatApi.getMessages(
        session.opencodeSessionId,
        limit != null ? { limit } : undefined,
      );
      res.json({ messages });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get messages';
      res.status(500).json({ error: message });
    }
  });

  // Send a prompt to a session
  router.post('/chat/sessions/:id/send', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const { text } = req.body as { text?: string };

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text is required' });
        return;
      }

      const session = await chatSessionService.getById(companySlug, id);
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      // Resolve agent/model from the owning employee (if scoped to one)
      let agent: string | undefined;
      let model: string | undefined;
      if (session.scopeType === 'employee') {
        const employee = await employeeService.getById(companySlug, session.scopeId);
        if (employee) {
          agent = employee.agent;
          model = employee.model;
        }
      }

      await chatApi.sendPrompt(session.opencodeSessionId, text, { agent, model });

      // Sidebar freshness: bump updatedAt on every send, and auto-title
      // untitled sessions from the first user message (OpenChamber-style).
      const updates: { name?: string } =
        session.name === DEFAULT_TITLE ? { name: deriveTitle(text) } : {};
      const updated = await chatSessionService.update(companySlug, id, updates);
      res.json({ ok: true, session: updated ?? session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send prompt';
      res.status(500).json({ error: message });
    }
  });

  // Abort a running session
  router.post('/chat/sessions/:id/abort', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const session = await chatSessionService.getById(companySlug, id);
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      await chatApi.abort(session.opencodeSessionId);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to abort session';
      res.status(500).json({ error: message });
    }
  });

  // Respond to a permission request
  router.post('/chat/sessions/:id/permission', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const { permissionId, response } = req.body as {
        permissionId?: string;
        response?: 'once' | 'always' | 'reject';
      };

      if (!permissionId || !response || !['once', 'always', 'reject'].includes(response)) {
        res.status(400).json({ error: 'permissionId and response (once|always|reject) are required' });
        return;
      }

      const session = await chatSessionService.getById(companySlug, id);
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      await chatApi.respondToPermission(session.opencodeSessionId, permissionId, response);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to respond to permission';
      res.status(500).json({ error: message });
    }
  });

  // Rename a chat session
  router.put('/chat/sessions/:id', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const { name } = req.body as { name?: string };

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const session = await chatSessionService.update(companySlug, id, { name });
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      res.json({ session });
    } catch {
      res.status(500).json({ error: 'Failed to rename chat session' });
    }
  });

  // Delete a chat session (metadata only; OpenCode history remains)
  router.delete('/chat/sessions/:id', async (req, res) => {
    try {
      const { companySlug, id } = req.params as Required<ChatParams>;
      const removed = await chatSessionService.remove(companySlug, id);
      if (!removed) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete chat session' });
    }
  });

  return router;
}