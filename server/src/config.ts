import { resolve } from 'node:path';

/** The server folder. Same depth from `src/` (ts-jest, dev) and `dist/` (production build). */
export const SERVER_ROOT = resolve(__dirname, '..');

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  port: number;
  /** Absolute path of the graph JSON file. */
  dataFile: string;
  /** Exact origins allowed by CORS. Empty means cross-origin requests are not allowed. */
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: "${env.PORT}"`);
  }
  return {
    port,
    dataFile: resolve(SERVER_ROOT, env.DATA_FILE || 'data/train-ticket.json'),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
