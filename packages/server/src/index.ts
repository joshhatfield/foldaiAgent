import express from 'express';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig } from './config.js';
import { createFileStore } from './store/file-store.js';
import { createCompanyService } from './services/company-service.js';
import { createEmployeeService } from './services/employee-service.js';
import { createProjectService } from './services/project-service.js';
import { createTaskService } from './services/task-service.js';
import { createTaskRunner } from './services/task-runner.js';
import { createCabinetService } from './services/cabinet-service.js';
import { createChatSessionService } from './services/chat-session-service.js';
import { createOpenCodeManager } from './opencode/manager.js';
import { createChatSessionApi } from './opencode/sessions.js';
import { createRealtimeHub } from './realtime/hub.js';
import { createCompanyRoutes } from './routes/companies.js';
import { createEmployeeRoutes } from './routes/employees.js';
import { createProjectRoutes } from './routes/projects.js';
import { createTaskRoutes } from './routes/tasks.js';
import { createCabinetRoutes } from './routes/cabinet.js';
import { createChatRoutes } from './routes/chat.js';

const config = loadConfig();
const store = createFileStore(config.dataDir);
const companyService = createCompanyService(store);
const employeeService = createEmployeeService(store);
const projectService = createProjectService(store);
const taskService = createTaskService(store);
const cabinetService = createCabinetService(store);
const chatSessionService = createChatSessionService(store);

// OpenCode serve + SDK client (lazy-started on first chat use)
const opencodeManager = createOpenCodeManager({
  port: config.opencode.port,
  password: config.opencode.password,
});
const chatApi = createChatSessionApi(() => opencodeManager.getClient());

// WebSocket hub for real-time event fan-out
const realtimeHub = createRealtimeHub(chatApi);

const taskRunner = createTaskRunner(
  companyService,
  employeeService,
  projectService,
  taskService,
  cabinetService,
  {
    pollIntervalMs: config.taskRunner.pollIntervalMs,
    sessionTimeoutMs: config.taskRunner.sessionTimeoutMs,
    maxRetries: config.taskRunner.maxRetries,
  },
);

const app = express();

// Middleware
app.use(express.json());

// Models endpoint — lists available OpenCode models
app.get('/api/models', async (_req, res) => {
  try {
    const exec = promisify(execFile);
    const { stdout } = await exec('opencode', ['models'], { timeout: 10_000 });
    const models = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort();
    res.json({ models });
  } catch {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dataDir: config.dataDir,
    taskRunner: taskRunner.isRunning(),
    opencodeServe: opencodeManager.isRunning(),
    wsClients: realtimeHub.clientCount(),
  });
});

// Company routes
app.use('/api/companies', createCompanyRoutes(companyService));

// Employee routes (nested under companies)
app.use('/api/companies/:companySlug/employees', createEmployeeRoutes(employeeService));

// Project routes (nested under companies)
app.use('/api/companies/:companySlug/projects', createProjectRoutes(projectService));

// Task routes (nested under companies)
app.use('/api/companies/:companySlug/tasks', createTaskRoutes(taskService, taskRunner));

// Cabinet routes (nested under companies)
app.use('/api/companies/:companySlug/cabinet', createCabinetRoutes(cabinetService));

// Chat routes (employee/task sessions + session operations)
app.use('/api/companies/:companySlug', createChatRoutes(chatSessionService, chatApi, employeeService, taskService));

// Task output route (looks up cabinet file by task ID)
app.get('/api/companies/:companySlug/tasks/:id/output', async (req, res) => {
  try {
    const { companySlug: slug, id } = req.params as { companySlug: string; id: string };
    const content = await cabinetService.getContentByTaskId(slug, id);

    if (content === undefined) {
      res.status(404).json({ error: 'No output found for this task' });
      return;
    }

    res.json({ content });
  } catch {
    res.status(500).json({ error: 'Failed to get task output' });
  }
});

// Startup recovery: reset any in_progress tasks back to todo
async function recoverStaleTasks() {
  try {
    const companies = await companyService.list();
    for (const company of companies) {
      const staleTasks = await taskService.list(company.slug, { status: 'in_progress' });
      for (const task of staleTasks) {
        await taskService.update(company.slug, task.id, {
          status: 'todo',
          assignedTo: null,
        });
        console.log(`[recovery] Reset stale task "${task.title}" to todo`);
      }
      // Also reset any busy employees back to available
      const employees = await employeeService.list(company.slug);
      for (const emp of employees) {
        if (emp.status === 'busy') {
          await employeeService.update(company.slug, emp.id, { status: 'available' });
          console.log(`[recovery] Reset employee "${emp.name}" to available`);
        }
      }
    }
  } catch (error) {
    console.error('[recovery] Error recovering stale state:', error);
  }
}

// HTTP server (Express + WebSocket upgrade)
const server = http.createServer(app);
realtimeHub.attach(server);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nError: Port ${config.port} is already in use.\n` +
        `Another Fold AI server is probably still running.\n` +
        `Fix:  fuser -k ${config.port}/tcp   (or kill the old process)\n` +
        `Or run on another port:  PORT=3002 npm run dev:server\n`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(config.port, async () => {
  console.log(`Fold AI server running on http://localhost:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
  console.log(`WebSocket endpoint: ws://localhost:${config.port}/api/ws`);

  // Recover from unclean shutdown
  await recoverStaleTasks();

  if (config.taskRunner.enabled) {
    taskRunner.start();
  } else {
    console.log('[task-runner] Disabled (FOLDAI_RUNNER_ENABLED=false)');
  }
});

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  taskRunner.stop();
  await realtimeHub.close();
  await opencodeManager.stop();
  server.close(() => {
    process.exit(0);
  });
  // Force exit if close hangs
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

export { app };