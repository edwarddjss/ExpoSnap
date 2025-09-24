import path from 'path';
import { fileURLToPath, URL } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

export const CONFIG = {
  SCREENSHOTS_DIR: path.join(__dirname, '..', 'screenshots'),
  HTTP_PORT: parseInt(process.env.EXPOSNAP_PORT || '3333', 10),
  MAX_SCREENSHOTS: parseInt(process.env.EXPOSNAP_MAX_SCREENSHOTS || '10', 10),
  SERVER_NAME: 'exposnap-mcp-server',
  SERVER_VERSION: packageJson.version,
} as const;
