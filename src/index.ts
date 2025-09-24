#!/usr/bin/env node

import { initializeStorage } from './storage.js';
import { startHttpServer } from './http-server.js';
import { startMcpServer } from './mcp-server.js';

function showHelp() {
  console.log(`
ExpoSnap - Screenshot management MCP server

Usage:
  npx exposnap            Start the server
  npx exposnap --help     Show this help

Options:
  --help, -h              Show help information

Environment Variables:
  EXPOSNAP_PORT           HTTP server port (default: 3333)
  EXPOSNAP_MAX_SCREENSHOTS Max screenshots to keep (default: 10)
  EXPOSNAP_REQUEST_TIMEOUT Request timeout in ms (default: 30000)
`);
}

async function main() {
  try {
    const args = process.argv.slice(2);

    // Handle help command
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    // Always start both HTTP and MCP servers
    await initializeStorage();
    await startHttpServer();
    await startMcpServer();
  } catch (error) {
    console.error('[ExpoSnap] Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
