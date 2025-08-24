import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  SCREENSHOTS_DIR: path.join(__dirname, '..', 'screenshots'),
  HTTP_PORT: parseInt(process.env.EXPOSNAP_PORT || '0', 10),
  MAX_SCREENSHOTS: parseInt(process.env.EXPOSNAP_MAX_SCREENSHOTS || '10', 10),
  SERVER_NAME: 'exposnap-mcp-server',
  SERVER_VERSION: '1.1.0',
  REQUEST_TIMEOUT_MS: parseInt(
    process.env.EXPOSNAP_REQUEST_TIMEOUT || '30000',
    10
  ),
} as const;
