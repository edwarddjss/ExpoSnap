import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CONFIG } from './config.js';
import { setupToolHandlers } from './mcp-tools.js';
import { TOOL_SCHEMAS } from './mcp-schemas.js';

const server = new Server(
  {
    name: CONFIG.SERVER_NAME,
    version: CONFIG.SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Advertise available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_SCHEMAS };
});

export async function startMcpServer() {
  setupToolHandlers(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
