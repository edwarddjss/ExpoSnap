import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session, type SessionStatus } from '../src/client/session.js';
import { PNG, startHarness, waitFor, type Harness } from './helpers.js';

/**
 * The agent (a real MCP client) and the app (the real Session, with React
 * Native's parts replaced by plain functions) talking through the real
 * server. This is the path a person's editor and phone take.
 */
describe('agent and app through the server', () => {
  let h: Harness;
  let session: Session;
  let status: SessionStatus;
  const opened: string[] = [];
  let reloads = 0;
  let captureError: Error | null = null;

  beforeEach(async () => {
    h = await startHarness();
    opened.length = 0;
    reloads = 0;
    status = 'searching';
    captureError = null;
    session = new Session({
      candidates: () => ['http://127.0.0.1:1', h.url],
      capture: async options => {
        if (captureError) throw captureError;
        return {
          base64: PNG.toString('base64'),
          mimeType: options.format === 'jpg' ? 'image/jpeg' : 'image/png',
          width: 1,
          height: 1,
        };
      },
      device: () => ({
        platform: 'ios',
        osVersion: '18.2',
        window: { width: 393, height: 852, scale: 3, fontScale: 1 },
      }),
      openUrl: async url => {
        opened.push(url);
      },
      reload: () => {
        reloads++;
      },
      onStatus: next => {
        status = next;
      },
      retryMs: 50,
    });
    session.start();
    await waitFor(() => status === 'connected');
  });

  afterEach(async () => {
    session.stop();
    await h.close();
  });

  it('lists every tool, resource template and prompt', async () => {
    const tools = (await h.client.listTools()).tools
      .map(tool => tool.name)
      .sort();
    expect(tools).toEqual([
      'get_app_status',
      'get_latest_screenshot',
      'get_logs',
      'get_screenshot',
      'list_screenshots',
      'open_url',
      'reload_app',
      'take_screenshot',
    ]);
    const templates = (
      await h.client.listResourceTemplates()
    ).resourceTemplates.map(t => t.uriTemplate);
    expect(templates).toContain('exposnap://screenshots/{id}');
    expect((await h.client.listPrompts()).prompts.map(p => p.name)).toEqual([
      'review_screen',
    ]);
  });

  it('take_screenshot asks the app, which captures and the image comes back', async () => {
    const result = await h.client.callTool({
      name: 'take_screenshot',
      arguments: { description: 'home', format: 'jpg' },
    });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{
      type: string;
      data?: string;
      mimeType?: string;
      text?: string;
    }>;
    expect(content[0].text).toContain('"home"');
    expect(content[0].text).toContain('requested by the agent');
    expect(content[1]).toMatchObject({
      type: 'image',
      mimeType: 'image/jpeg',
      data: PNG.toString('base64'),
    });
    expect(h.store.listScreenshots()).toHaveLength(1);
  });

  it('a failed capture on the device comes back as a tool error, not a hang', async () => {
    captureError = new Error('view is not mounted');
    const result = await h.client.callTool({
      name: 'take_screenshot',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0].text).toContain(
      'view is not mounted'
    );
  });

  it('a tap on the camera is a manual screenshot the agent can fetch', async () => {
    expect(
      await session.captureAndUpload({ description: 'from the phone' })
    ).toBe(true);
    const latest = await h.client.callTool({
      name: 'get_latest_screenshot',
      arguments: {},
    });
    const content = latest.content as Array<{ type: string; text?: string }>;
    expect(content[0].text).toContain('taken on the device');
    expect(content[1].type).toBe('image');

    const list = await h.client.callTool({
      name: 'list_screenshots',
      arguments: {},
    });
    const { screenshots } = list.structuredContent as {
      screenshots: Array<{ id: string }>;
    };
    const byId = await h.client.callTool({
      name: 'get_screenshot',
      arguments: { id: screenshots[0].id },
    });
    expect((byId.content as Array<{ type: string }>)[1].type).toBe('image');

    const resource = await h.client.readResource({
      uri: `exposnap://screenshots/${screenshots[0].id}`,
    });
    expect(resource.contents[0]).toMatchObject({
      mimeType: 'image/png',
      blob: PNG.toString('base64'),
    });
  });

  it('console output reaches get_logs, filtered by level and text', async () => {
    session.log({
      level: 'log',
      message: 'rendered Home',
      timestamp: Date.now(),
    });
    session.log({
      level: 'warn',
      message: 'VirtualizedList is slow',
      timestamp: Date.now(),
    });
    session.log({
      level: 'error',
      message: 'TypeError: undefined is not a function',
      timestamp: Date.now(),
    });
    await waitFor(() => h.store.logCount === 3);

    const all = await h.client.callTool({ name: 'get_logs', arguments: {} });
    expect((all.structuredContent as { logs: unknown[] }).logs).toHaveLength(3);
    const errors = await h.client.callTool({
      name: 'get_logs',
      arguments: { level: 'error' },
    });
    expect((errors.content as Array<{ text: string }>)[0].text).toContain(
      'TypeError'
    );
    const searched = await h.client.callTool({
      name: 'get_logs',
      arguments: { search: 'virtualized', clear: true },
    });
    expect(
      (searched.structuredContent as { logs: unknown[] }).logs
    ).toHaveLength(1);
    expect(h.store.logCount).toBe(0);
  });

  it('open_url and reload_app reach the app', async () => {
    const open = await h.client.callTool({
      name: 'open_url',
      arguments: { url: '/settings' },
    });
    expect(open.isError).toBeFalsy();
    expect(opened).toEqual(['/settings']);
    const reload = await h.client.callTool({
      name: 'reload_app',
      arguments: {},
    });
    expect(reload.isError).toBeFalsy();
    await waitFor(() => reloads === 1);
  });

  it('get_app_status reports the device', async () => {
    const result = await h.client.callTool({
      name: 'get_app_status',
      arguments: {},
    });
    expect(result.structuredContent).toMatchObject({
      connected: true,
      device: { platform: 'ios', osVersion: '18.2' },
    });
  });
});

describe('with no app connected', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
  });

  it('take_screenshot says how to connect instead of waiting', async () => {
    const result = await h.client.callTool({
      name: 'take_screenshot',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0].text).toContain(
      'No app is connected'
    );
  });

  it('get_latest_screenshot explains there is nothing yet', async () => {
    const result = await h.client.callTool({
      name: 'get_latest_screenshot',
      arguments: {},
    });
    expect((result.content as Array<{ text: string }>)[0].text).toContain(
      'No screenshots yet'
    );
  });

  it('rejects arguments outside the schema', async () => {
    const result = await h.client.callTool({
      name: 'list_screenshots',
      arguments: { limit: 500 },
    });
    expect(result.isError).toBe(true);
  });
});

describe('resilience', () => {
  it('connects even when reading device details throws, and reports why', async () => {
    const h = await startHarness();
    const errors: string[] = [];
    let status: SessionStatus = 'searching';
    const session = new Session({
      candidates: () => [h.url],
      capture: async () => ({
        base64: PNG.toString('base64'),
        mimeType: 'image/png',
      }),
      device: () => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'Model')"
        );
      },
      openUrl: async () => undefined,
      reload: () => undefined,
      onStatus: next => {
        status = next;
      },
      onError: error => errors.push(error.message),
      retryMs: 50,
    });
    session.start();
    await waitFor(() => status === 'connected');
    expect(h.bridge.device).toEqual({ platform: 'unknown' });
    expect(errors).toEqual([
      "Cannot read properties of undefined (reading 'Model')",
    ]);
    session.stop();
    await h.close();
  });

  it('finds a server on a later port after the first port refuses', async () => {
    const h = await startHarness();
    const session = new Session({
      candidates: () => ['http://127.0.0.1:1', 'http://localhost:1', h.url],
      capture: async () => ({ base64: '', mimeType: 'image/png' }),
      device: () => ({ platform: 'ios' }),
      openUrl: async () => undefined,
      reload: () => undefined,
    });
    expect(await session.find()).toBe(h.url);
    session.stop();
    await h.close();
  });
});
