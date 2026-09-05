import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

export interface SessionConfig {
  agent: string;
  model: string;
  projectDir: string;
  prompt: string;
  timeoutMs?: number;
}

export interface SessionResult {
  success: boolean;
  output: string;
  exitCode: number | null;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function buildArgs(config: SessionConfig): string[] {
  const args: string[] = ['run'];

  args.push('--agent', config.agent);
  args.push('--model', config.model);
  args.push('--dir', config.projectDir);
  args.push('--format', 'json');
  args.push('--auto');

  // The prompt is the message positional arg
  args.push(config.prompt);

  return args;
}

function spawnSession(config: SessionConfig): { process: ChildProcess; output: Promise<string> } {
  const args = buildArgs(config);
  const child = spawn('opencode', args, {
    cwd: resolve(config.projectDir),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  child.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  const output = new Promise<string>((resolveOutput) => {
    child.on('close', () => {
      const combined = stdout || stderr;
      resolveOutput(combined);
    });

    child.on('error', (err) => {
      resolveOutput(`Process error: ${err.message}\n${stderr}`);
    });
  });

  return { process: child, output };
}

export async function runSession(config: SessionConfig): Promise<SessionResult> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<SessionResult>((resolveResult) => {
    const { process, output } = spawnSession(config);

    const timer = setTimeout(() => {
      process.kill('SIGTERM');
      // Give it a moment, then force kill
      setTimeout(() => {
        try { process.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000);
    }, timeoutMs);

    process.on('close', async (code) => {
      clearTimeout(timer);
      const text = await output;

      resolveResult({
        success: code === 0,
        output: text,
        exitCode: code,
      });
    });

    process.on('error', async (err) => {
      clearTimeout(timer);
      const text = await output;

      resolveResult({
        success: false,
        output: text,
        exitCode: null,
        error: err.message,
      });
    });
  });
}