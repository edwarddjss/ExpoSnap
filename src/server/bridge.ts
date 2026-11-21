import { randomUUID } from 'node:crypto';
import type { Command, DeviceInfo } from '../shared/protocol.js';
import { POLL_WAIT_MS } from '../shared/protocol.js';

/** Distributes Omit over a union so each command keeps its own fields. */
type CommandInput = Command extends infer C
  ? C extends Command
    ? Omit<C, 'id'>
    : never
  : never;

/** A poll older than this means the app is gone (closed, backgrounded, or reloading). */
const ALIVE_MS = POLL_WAIT_MS + 10_000;

export class AppNotConnectedError extends Error {
  constructor(lastSeen: number | null) {
    super(
      lastSeen === null
        ? 'No app is connected to ExpoSnap. Open your app in development with <ScreenshotWrapper> around it; it connects on its own within a few seconds.'
        : `The app stopped talking to ExpoSnap ${Math.round((Date.now() - lastSeen) / 1000)}s ago. It may be closed, in the background, or on another network. Open it and try again.`
    );
    this.name = 'AppNotConnectedError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * The app cannot be reached from the computer (phones block inbound
 * connections and change address), so it calls in: it long-polls for
 * commands and posts each answer back. A request here resolves when the
 * matching answer arrives, whether that is a result or a screenshot.
 */
export class Bridge {
  private queue: Command[] = [];
  private waiter: ((commands: Command[]) => void) | null = null;
  private pending = new Map<string, Pending>();
  private lastSeen: number | null = null;
  device: DeviceInfo | null = null;

  touch(device?: DeviceInfo): void {
    this.lastSeen = Date.now();
    if (device) this.device = device;
  }

  get connected(): boolean {
    return this.lastSeen !== null && Date.now() - this.lastSeen < ALIVE_MS;
  }

  get lastSeenAt(): number | null {
    return this.lastSeen;
  }

  /** Answers a poll: queued commands now, or whatever arrives before `waitMs`. */
  poll(waitMs = POLL_WAIT_MS, signal?: AbortSignal): Promise<Command[]> {
    this.touch();
    if (this.queue.length) return Promise.resolve(this.queue.splice(0));
    // A second poll (an app reload) replaces the first; the old one answers empty.
    this.waiter?.([]);
    return new Promise(resolve => {
      const finish = (commands: Command[]) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (this.waiter === finish) this.waiter = null;
        resolve(commands);
      };
      const onAbort = () => finish([]);
      const timer = setTimeout(() => finish([]), waitMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiter = finish;
    });
  }

  /** Puts back commands whose poll died before they could be delivered. */
  requeue(commands: Command[]): void {
    const live = commands.filter(command => this.pending.has(command.id));
    if (!live.length) return;
    this.queue.unshift(...live);
    this.deliver();
  }

  private deliver(): void {
    if (!this.waiter || !this.queue.length) return;
    const waiter = this.waiter;
    this.waiter = null;
    waiter(this.queue.splice(0));
  }

  request<T>(command: CommandInput, timeoutMs: number): Promise<T> {
    if (!this.connected) throw new AppNotConnectedError(this.lastSeen);
    const full = { ...command, id: randomUUID() } as Command;
    const result = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(full.id);
        this.queue = this.queue.filter(queued => queued.id !== full.id);
        reject(
          new Error(
            `The app did not answer within ${Math.round(timeoutMs / 1000)}s. It may be busy, in the background, or showing a native dialog.`
          )
        );
      }, timeoutMs);
      this.pending.set(full.id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
    });
    this.queue.push(full);
    this.deliver();
    return result;
  }

  settle(
    id: string,
    outcome: { ok: true; value?: unknown } | { ok: false; error: string }
  ): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (outcome.ok) pending.resolve(outcome.value);
    else pending.reject(new Error(outcome.error));
    return true;
  }

  close(): void {
    this.waiter?.([]);
    for (const [id] of this.pending)
      this.settle(id, { ok: false, error: 'ExpoSnap is shutting down' });
  }
}
