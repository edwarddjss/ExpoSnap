#!/usr/bin/env node
import { initializeStorage } from './storage.js';
import { startHttpServer } from './http-server.js';
import { startMcpServer } from './mcp-server.js';

async function main() {
  try {
    await initializeStorage();
    const actualPort = await startHttpServer();
    console.log(`[ExpoSnap] Server ready on port ${actualPort}`);
    await startMcpServer();
  } catch (error) {
    console.error('[ExpoSnap] Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
