import { spawn, type ChildProcess } from 'node:child_process';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';

export interface OpenCodeManagerOptions {
  port: number;
  hostname?: string;
  /** Basic-auth password for opencode serve; auto-generated when empty */
  password?: string;
  startupTimeoutMs?: number;
}

export interface OpenCodeManager {
  /** Connect (or reuse an already-running healthy server) and return the SDK client */
  getClient(): Promise<OpencodeClient>;
  getBaseUrl(): string;
  getPassword(): string;
  /** True if WE spawned the opencode serve child (not if we reused an external one) */
  isRunning(): boolean;
  /** Stop only the child we spawned; external servers are left untouched */
  stop(): Promise<void>;
}

const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_REQUEST_TIMEOUT_MS = 3_000;

function basicAuthHeader(password: string): string {
  return `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
}

/** Single health probe with a hard per-request timeout so a hung listener can't block us */
async function probeHealthy(url: string, authHeader: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/doc`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(url: string, authHeader: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeHealthy(url, authHeader)) return true;
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  return false;
}

export function createOpenCodeManager(options: OpenCodeManagerOptions): OpenCodeManager {
  const hostname = options.hostname ?? DEFAULT_HOSTNAME;
  const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
  // Auto-generate a per-instance password when none provided
  const password = options.password || randomBytes(16).toString('hex');
  const authHeader = basicAuthHeader(password);
  const baseUrl = `http://${hostname}:${options.port}`;

  let child: ChildProcess | null = null;
  let clientPromise: Promise<OpencodeClient> | null = null;

  const start = (): Promise<OpencodeClient> => {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      // Reuse an already-running healthy server (user-managed or leftover) instead of spawning.
      // Try our password first; fall back to no-auth (server without OPENCODE_SERVER_PASSWORD).
      if (await probeHealthy(baseUrl, authHeader)) {
        console.log(`[opencode-manager] Reusing existing opencode serve at ${baseUrl}`);
        return createOpencodeClient({ baseUrl, headers: { Authorization: authHeader } });
      }

      console.log(`[opencode-manager] Starting opencode serve on ${baseUrl}...`);
      const proc = spawn(
        'opencode',
        ['serve', '--port', String(options.port), '--hostname', hostname],
        {
          cwd: homedir(),
          env: { ...process.env, OPENCODE_SERVER_PASSWORD: password },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      child = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        console.log(`[opencode-serve] ${data.toString().trim()}`);
      });
      proc.stderr?.on('data', (data: Buffer) => {
        console.error(`[opencode-serve] ${data.toString().trim()}`);
      });
      proc.on('error', (err) => {
        console.error(`[opencode-manager] Failed to spawn opencode serve: ${err.message}`);
      });
      proc.on('exit', (code) => {
        console.log(`[opencode-manager] opencode serve exited (code=${code})`);
        if (child === proc) {
          child = null;
          clientPromise = null;
        }
      });

      const healthy = await waitForHealthy(baseUrl, authHeader, startupTimeoutMs);
      if (!healthy) {
        throw new Error(
          `opencode serve did not become healthy within ${startupTimeoutMs}ms at ${baseUrl}`,
        );
      }

      console.log('[opencode-manager] opencode serve is healthy');
      return createOpencodeClient({ baseUrl, headers: { Authorization: authHeader } });
    })();

    // Don't leave a rejected promise cached if startup fails — allow retry
    clientPromise.catch(() => {
      clientPromise = null;
    });

    return clientPromise;
  };

  const getClient = (): Promise<OpencodeClient> => start();

  const isRunning = (): boolean => child !== null;

  const stop = async (): Promise<void> => {
    const proc = child;
    if (!proc) return; // external/reused server — leave it alone
    child = null;
    clientPromise = null;
    proc.kill('SIGTERM');
    await new Promise<void>((resolveStop) => {
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
        resolveStop();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(timer);
        resolveStop();
      });
    });
  };

  return { getClient, getBaseUrl: () => baseUrl, getPassword: () => password, isRunning, stop };
}