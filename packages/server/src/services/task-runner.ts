import type { CompanyService } from './company-service.js';
import type { EmployeeService } from './employee-service.js';
import type { ProjectService } from './project-service.js';
import type { TaskService } from './task-service.js';
import type { CabinetService } from './cabinet-service.js';
import type { Task } from './task-service.js';
import type { Employee } from './employee-service.js';
import { runSession, type SessionConfig } from '../opencode/session.js';
import { access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

export interface TaskRunnerConfig {
  pollIntervalMs: number;
  sessionTimeoutMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: TaskRunnerConfig = {
  pollIntervalMs: 30_000,
  sessionTimeoutMs: 10 * 60 * 1000,
  maxRetries: 3,
};

export interface TaskRunner {
  start(): void;
  stop(): void;
  runOnce(): Promise<void>;
  isRunning(): boolean;
}

function buildPrompt(task: Task, employee: Employee, projectName: string | null): string {
  const lines = [
    `You are ${employee.name}, a ${employee.role}.`,
    `Persona: ${employee.persona}`,
    '',
  ];
  if (projectName) {
    lines.push(`Project: ${projectName}`, '');
  }
  lines.push(
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    '',
    'Complete this task. When finished, summarize what you did.',
  );
  return lines.join('\n');
}

export function createTaskRunner(
  companyService: CompanyService,
  employeeService: EmployeeService,
  projectService: ProjectService,
  taskService: TaskService,
  cabinetService: CabinetService,
  config: Partial<TaskRunnerConfig> = {},
): TaskRunner {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const findAvailableEmployee = async (companySlug: string): Promise<Employee | undefined> => {
    const employees = await employeeService.list(companySlug);
    return employees.find((e) => e.status === 'available');
  };

  const processTask = async (companySlug: string, task: Task): Promise<void> => {
    const employee = await findAvailableEmployee(companySlug);
    if (!employee) {
      console.log(`[task-runner] No available employees for company "${companySlug}"`);
      return;
    }

    // Resolve project (optional for standalone company tasks)
    let projectDir: string;
    let projectName: string | null = null;

    if (task.projectId) {
      const project = await projectService.getById(companySlug, task.projectId);
      if (!project) {
        console.log(`[task-runner] Project ${task.projectId} not found, skipping task ${task.id}`);
        return;
      }

      // Validate project directory exists
      try {
        await access(project.path);
      } catch {
        console.log(`[task-runner] Project directory "${project.path}" not accessible, skipping task ${task.id}`);
        await taskService.update(companySlug, task.id, { status: 'blocked' });
        return;
      }

      projectDir = project.path;
      projectName = project.name;
    } else {
      // Standalone company task — use a scratch directory
      projectDir = resolve(tmpdir(), `foldai-task-${task.id.slice(0, 8)}`);
      await mkdir(projectDir, { recursive: true });
    }

    await employeeService.update(companySlug, employee.id, { status: 'busy' });
    await taskService.update(companySlug, task.id, {
      status: 'in_progress',
      assignedTo: employee.id,
    });

    console.log(
      `[task-runner] Starting task "${task.title}" with employee "${employee.name}" (${employee.agent}/${employee.model})`,
    );

    const prompt = buildPrompt(task, employee, projectName);
    const sessionConfig: SessionConfig = {
      agent: employee.agent,
      model: employee.model,
      projectDir,
      prompt,
      timeoutMs: cfg.sessionTimeoutMs,
    };

    const result = await runSession(sessionConfig);

    const outputContent = [
      `# Task Output: ${task.title}`,
      '',
      `**Task ID**: ${task.id}`,
      `**Project**: ${projectName ?? '(company task — no project)'}`,
      `**Employee**: ${employee.name} (${employee.agent})`,
      `**Status**: ${result.success ? 'Completed' : 'Failed'}`,
      `**Exit Code**: ${result.exitCode}`,
      '',
      '## Output',
      '',
      '```',
      result.output || '(no output)',
      '```',
      '',
      result.error ? `**Error**: ${result.error}` : '',
    ].join('\n');

    // Save output via cabinet service (registers in manifest with task link)
    const cabinetFile = await cabinetService.create(companySlug, {
      name: `Task Output: ${task.title}`,
      content: outputContent,
      type: 'task',
      linkedTaskIds: [task.id],
    });

    if (result.success) {
      await taskService.update(companySlug, task.id, {
        status: 'for_review',
        outputFile: cabinetFile.id,
      });
      console.log(`[task-runner] Task "${task.title}" completed successfully`);
    } else {
      const nextRetry = (task.retryCount ?? 0) + 1;
      if (nextRetry >= cfg.maxRetries) {
        await taskService.update(companySlug, task.id, {
          status: 'blocked',
          assignedTo: null,
          outputFile: cabinetFile.id,
          retryCount: nextRetry,
        });
        console.log(
          `[task-runner] Task "${task.title}" failed after ${nextRetry} retries, marked as blocked`,
        );
      } else {
        await taskService.update(companySlug, task.id, {
          status: 'todo',
          assignedTo: null,
          outputFile: cabinetFile.id,
          retryCount: nextRetry,
        });
        console.log(
          `[task-runner] Task "${task.title}" failed (retry ${nextRetry}/${cfg.maxRetries}), reset to todo`,
        );
      }
    }

    await employeeService.update(companySlug, employee.id, { status: 'available' });
  };

  const runOnce = async (): Promise<void> => {
    if (running) return;
    running = true;

    try {
      const companies = await companyService.list();

      for (const company of companies) {
        const todoTasks = await taskService.list(company.slug, { status: 'todo' });

        if (todoTasks.length === 0) continue;

        const task = todoTasks[0]!;
        await processTask(company.slug, task);
        break;
      }
    } catch (error) {
      console.error('[task-runner] Error in poll cycle:', error);
    } finally {
      running = false;
    }
  };

  const start = (): void => {
    if (timer) return;
    console.log(`[task-runner] Started (poll every ${cfg.pollIntervalMs}ms)`);
    timer = setInterval(runOnce, cfg.pollIntervalMs);
    runOnce();
  };

  const stop = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[task-runner] Stopped');
    }
  };

  const isRunning = (): boolean => timer !== null;

  return { start, stop, runOnce, isRunning };
}