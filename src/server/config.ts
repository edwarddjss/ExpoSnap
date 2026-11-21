import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PORT } from '../shared/protocol.js';

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface Config {
  port: number;
  /** Outside the package: under npx the package lives in a cache that is wiped and shared between versions. */
  dir: string;
  maxScreenshots: number;
  maxLogs: number;
  version: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: int(env.EXPOSNAP_PORT, DEFAULT_PORT),
    dir: env.EXPOSNAP_DIR || path.join(os.tmpdir(), 'exposnap'),
    maxScreenshots: Math.max(1, int(env.EXPOSNAP_MAX_SCREENSHOTS, 20)),
    maxLogs: Math.max(50, int(env.EXPOSNAP_MAX_LOGS, 1000)),
    version: packageJson.version,
  };
}
