import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  handleGetLatestScreenshot,
  handleListScreenshots,
} from './tool-handlers.js';

export function setupToolHandlers(server: Server) {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    switch (request.params.name) {
      case 'get_latest_screenshot':
        return await handleGetLatestScreenshot();

      case 'list_screenshots':
        return await handleListScreenshots(
          request.params.arguments?.limit as number
        );

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  });
}
