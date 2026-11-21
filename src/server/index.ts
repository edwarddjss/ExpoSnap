#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Bridge } from './bridge.js';
import { loadConfig } from './config.js';
import { createHttpServer, lanAddresses, listen } from './http.js';
import { createMcpServer } from './mcp.js';
import { Store } from './store.js';

const HELP = `ExpoSnap: lets your AI assistant see and drive your React Native / Expo app.

Usage
  npx exposnap            Start the MCP server (your editor runs this for you)
  npx exposnap --help     Show this help

Environment
  EXPOSNAP_PORT             Port the app connects to (default 3333, next free one if taken)
  EXPOSNAP_DIR              Where screenshots are kept (default: <system temp>/exposnap)
  EXPOSNAP_MAX_SCREENSHOTS  How many screenshots to keep (default 20)
  EXPOSNAP_MAX_LOGS         How many app log lines to keep (default 1000)
`;

export async function start() {
  const config = loadConfig();
  const store = new Store(config.dir, config.maxScreenshots, config.maxLogs);
  await store.init();
  const bridge = new Bridge();

  const http = createHttpServer(store, bridge, config.version);
  const port = await listen(http, config.port);
  const mcp = createMcpServer(store, bridge, config.version);
  await mcp.connect(new StdioServerTransport());

  // stdout carries the MCP protocol; everything for people goes to stderr.
  const addresses = lanAddresses();
  console.error(
    `[ExpoSnap] ${config.version} listening on port ${port}` +
      (addresses.length
        ? ` (${addresses.map(address => `http://${address}:${port}`).join(', ')})`
        : '') +
      `. Screenshots in ${config.dir}`
  );

  const shutdown = () => {
    bridge.close();
    http.close();
    void mcp.close().finally(() => process.exit(0));
  };
  process.stdin.on('close', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.error(HELP);
} else {
  start().catch(error => {
    console.error(
      '[ExpoSnap] Failed to start:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  });
}
