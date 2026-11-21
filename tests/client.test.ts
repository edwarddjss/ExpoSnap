import { describe, expect, it, vi } from 'vitest';
import { captureConsole, formatArgs } from '../src/client/console.js';
import { candidateUrls, hostFromUrl } from '../src/client/host.js';
import type { LogEntry } from '../src/shared/protocol.js';

describe('finding the server', () => {
  it("tries Metro's host first, then loopback, on every port in range", () => {
    const urls = candidateUrls({
      bundleUrl: 'http://192.168.1.42:8081/index.bundle?platform=ios&dev=true',
      platform: 'ios',
    });
    expect(urls[0]).toBe('http://192.168.1.42:3333');
    expect(urls).toContain('http://192.168.1.42:3337');
    expect(urls).toContain('http://localhost:3333');
    expect(urls).not.toContain('http://10.0.2.2:3333');
    expect(urls).toHaveLength(15);
  });

  it("adds the Android emulator's alias for the computer", () => {
    expect(
      candidateUrls({ bundleUrl: null, platform: 'android', port: 4000 })
    ).toEqual([
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'http://10.0.2.2:4000',
    ]);
  });

  it('ignores tunnel hosts, which never reach the ExpoSnap port', () => {
    expect(
      hostFromUrl('https://abc-anonymous-8081.exp.direct/index.bundle')
    ).toBeNull();
    expect(hostFromUrl('exp://10.0.0.5:8081')).toBe('10.0.0.5');
  });

  it('uses an explicit serverUrl as given', () => {
    expect(candidateUrls({ serverUrl: '192.168.1.20:3333/' })).toEqual([
      'http://192.168.1.20:3333',
    ]);
  });
});

describe('console capture', () => {
  it('formats errors, objects and cycles readably', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(formatArgs(['count', 3, { a: 1 }])).toBe('count 3 {"a":1}');
    expect(formatArgs([cyclic])).toBe('{"a":1,"self":"[Circular]"}');
    expect(formatArgs([new Error('boom')])).toContain('Error: boom');
  });

  it('mirrors calls to the sink, still prints, and restores cleanly', () => {
    const printed: unknown[][] = [];
    const target = {
      log: (...args: unknown[]) => printed.push(args),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as Console;
    const original = target.log;
    const seen: LogEntry[] = [];
    const restore = captureConsole(entry => seen.push(entry), target);
    target.log('hello', 1);
    expect(seen).toMatchObject([{ level: 'log', message: 'hello 1' }]);
    expect(printed).toEqual([['hello', 1]]);
    restore();
    expect(target.log).toBe(original);
  });

  it('a sink that logs does not loop forever', () => {
    const target = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as Console;
    const seen: LogEntry[] = [];
    captureConsole(entry => {
      seen.push(entry);
      target.warn('sink saw', entry.message);
    }, target);
    target.log('once');
    expect(seen).toHaveLength(1);
  });
});

describe('browser errors', () => {
  it('forwards uncaught errors and rejections when there is no ErrorUtils', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const scope = globalThis as unknown as Record<string, unknown>;
    const saved = {
      add: scope.addEventListener,
      remove: scope.removeEventListener,
    };
    scope.addEventListener = (
      type: string,
      listener: (event: unknown) => void
    ) => listeners.set(type, listener);
    scope.removeEventListener = (type: string) => listeners.delete(type);
    const target = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as Console;
    const seen: LogEntry[] = [];
    const restore = captureConsole(entry => seen.push(entry), target);
    listeners.get('error')?.({ error: new Error('boom') });
    listeners.get('unhandledrejection')?.({ reason: 'nope' });
    expect(seen.map(entry => entry.message)).toEqual([
      expect.stringContaining('Uncaught error: Error: boom'),
      'Unhandled promise rejection: nope',
    ]);
    restore();
    expect(listeners.size).toBe(0);
    scope.addEventListener = saved.add;
    scope.removeEventListener = saved.remove;
  });
});
