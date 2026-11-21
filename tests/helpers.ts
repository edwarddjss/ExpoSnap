import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Bridge } from '../src/server/bridge.js';
import { createHttpServer, listen } from '../src/server/http.js';
import { createMcpServer } from '../src/server/mcp.js';
import { Store } from '../src/server/store.js';

/** A 1x1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export interface Harness {
  store: Store;
  bridge: Bridge;
  http: Server;
  url: string;
  client: Client;
  dir: string;
  close: () => Promise<void>;
}

/** The whole server (HTTP for the app, MCP for the agent) on a free port with a fresh folder. */
export async function startHarness(
  options: { maxScreenshots?: number } = {}
): Promise<Harness> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'exposnap-test-'));
  const store = new Store(dir, options.maxScreenshots ?? 20, 1000);
  await store.init();
  const bridge = new Bridge();
  const http = createHttpServer(store, bridge, '3.0.0-test');
  const port = await listen(http, 0);
  const mcp = createMcpServer(store, bridge, '3.0.0-test');
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await mcp.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientTransport);
  return {
    store,
    bridge,
    http,
    url: `http://127.0.0.1:${port}`,
    client,
    dir,
    close: async () => {
      bridge.close();
      await client.close();
      await mcp.close();
      http.closeAllConnections();
      await new Promise(resolve => http.close(resolve));
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export const waitFor = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
