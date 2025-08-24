import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { handleScreenshot } from './tool-handlers.js';

export function setupToolHandlers(server: Server) {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    switch (request.params.name) {
      case 'screenshot':
        return await handleScreenshot(
          request.params.arguments?.description as string
        );

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  });
}
