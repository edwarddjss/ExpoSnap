import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/server/store.js';
import { PNG, startHarness, type Harness } from './helpers.js';

describe('HTTP server', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await startHarness({ maxScreenshots: 3 });
  });
  afterEach(async () => {
    await h.close();
  });

  it('answers ping in the shape 2.x wrappers check for', async () => {
    const body = (await (await fetch(`${h.url}/ping`)).json()) as {
      port: number;
    };
    expect(body).toMatchObject({
      service: 'exposnap',
      status: 'ready',
      protocol: 3,
      version: '3.0.0-test',
    });
    expect(body.port).toBe(Number(new URL(h.url).port));
  });

  it('still accepts the multipart upload 2.x wrappers send', async () => {
    const form = new FormData();
    form.append(
      'screenshot',
      new Blob([PNG], { type: 'image/png' }),
      'screenshot.png'
    );
    form.append('description', '  login screen  ');
    const response = await fetch(`${h.url}/screenshot`, {
      method: 'POST',
      body: form,
    });
    expect(response.status).toBe(200);
    const shot = h.store.latestScreenshot();
    expect(shot).toMatchObject({
      description: 'login screen',
      mimeType: 'image/png',
      trigger: 'manual',
    });
    expect(await fs.readFile(h.store.pathOf(shot!))).toEqual(PNG);
  });

  it('refuses an upload with no image', async () => {
    const response = await fetch(`${h.url}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'nothing' }),
    });
    expect(response.status).toBe(400);
  });

  it('keeps only the newest screenshots and deletes the rest from disk', async () => {
    for (let i = 0; i < 5; i++) {
      await fetch(`${h.url}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: PNG.toString('base64'),
          mimeType: 'image/png',
          description: `#${i}`,
        }),
      });
    }
    expect(h.store.listScreenshots().map(shot => shot.description)).toEqual([
      '#4',
      '#3',
      '#2',
    ]);
    const files = await fs.readdir(h.dir);
    expect(files.filter(file => file.endsWith('.png'))).toHaveLength(3);
    expect(files.filter(file => file.endsWith('.json'))).toHaveLength(3);
  });

  it('drops malformed log entries', async () => {
    const response = await fetch(`${h.url}/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [
          { level: 'warn', message: 'ok', timestamp: 1 },
          { level: 'shout', message: 'x' },
          null,
        ],
      }),
    });
    expect(await response.json()).toEqual({ accepted: 1 });
  });

  it('a poll waits for a command and returns it the moment one is queued', async () => {
    h.bridge.touch();
    const poll = fetch(`${h.url}/v1/commands?wait=5000`).then(
      response =>
        response.json() as Promise<{ commands: Array<{ id: string }> }>
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    const request = h.bridge.request({ type: 'reload' }, 2000);
    const { commands } = await poll;
    expect(commands).toMatchObject([{ type: 'reload' }]);
    await fetch(`${h.url}/v1/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commands[0].id, ok: true }),
    });
    await expect(request).resolves.toBeUndefined();
  });

  it('a command times out with a reason if the app never answers', async () => {
    h.bridge.touch();
    await expect(h.bridge.request({ type: 'reload' }, 50)).rejects.toThrow(
      'did not answer'
    );
  });
});

describe('Store', () => {
  it('reloads screenshots and their notes after a restart', async () => {
    const h = await startHarness();
    await h.store.addScreenshot(PNG, {
      mimeType: 'image/png',
      description: 'kept',
      trigger: 'agent',
    });
    await fs.writeFile(path.join(h.dir, 'legacy.jpg'), PNG);
    const reopened = new Store(h.dir, 20, 100);
    await reopened.init();
    const shots = reopened.listScreenshots();
    expect(shots.find(shot => shot.description === 'kept')).toMatchObject({
      trigger: 'agent',
    });
    expect(shots.find(shot => shot.id === 'legacy')).toMatchObject({
      mimeType: 'image/jpeg',
      trigger: 'manual',
    });
    await h.close();
  });
});
