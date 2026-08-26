import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface AppConfig {
  port: number;
  dataDir: string;
  taskRunner: {
    enabled: boolean;
    pollIntervalMs: number;
    sessionTimeoutMs: number;
    maxRetries: number;
  };
}

const defaults: AppConfig = {
  port: 3001,
  dataDir: resolve(homedir(), '.config', 'foldai'),
  taskRunner: {
    enabled: true,
    pollIntervalMs: 30_000,
    sessionTimeoutMs: 10 * 60 * 1000,
    maxRetries: 3,
  },
};

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: overrides?.port ?? (Number(process.env['PORT']) || defaults.port),
    dataDir: overrides?.dataDir ?? (process.env['FOLDAI_DATA_DIR'] || defaults.dataDir),
    taskRunner: {
      enabled: overrides?.taskRunner?.enabled ?? (process.env['FOLDAI_RUNNER_ENABLED'] !== 'false'),
      pollIntervalMs:
        overrides?.taskRunner?.pollIntervalMs ??
        (Number(process.env['FOLDAI_RUNNER_INTERVAL']) || defaults.taskRunner.pollIntervalMs),
      sessionTimeoutMs:
        overrides?.taskRunner?.sessionTimeoutMs ??
        (Number(process.env['FOLDAI_RUNNER_TIMEOUT']) || defaults.taskRunner.sessionTimeoutMs),
      maxRetries:
        overrides?.taskRunner?.maxRetries ??
        (Number(process.env['FOLDAI_RUNNER_MAX_RETRIES']) || defaults.taskRunner.maxRetries),
    },
  };
}