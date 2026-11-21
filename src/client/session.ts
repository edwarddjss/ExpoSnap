import type {
  CaptureOptions,
  Command,
  DeviceInfo,
  LogEntry,
  PingResponse,
  ScreenshotUpload,
} from '../shared/protocol.js';
import { POLL_WAIT_MS, ROUTES, SERVICE } from '../shared/protocol.js';

export type SessionStatus = 'searching' | 'connected' | 'capturing';

export interface CaptureResult {
  base64: string;
  mimeType: ScreenshotUpload['mimeType'];
  width?: number;
  height?: number;
}

export interface SessionDeps {
  /** Server URLs to try, best guess first. */
  candidates: () => string[];
  capture: (options: CaptureOptions) => Promise<CaptureResult>;
  device: () => DeviceInfo;
  openUrl: (url: string) => Promise<void>;
  reload: () => void;
  onStatus?: (status: SessionStatus, serverUrl: string | null) => void;
  /** A failure other than "the server is not there", reported once per distinct message. */
  onError?: (error: Error) => void;
  fetch?: typeof fetch;
  /** Time between searches while no server answers. */
  retryMs?: number;
}

const MAX_QUEUED_LOGS = 500;

/** fetch rejects with a TypeError (or an AbortError on timeout) when nothing answers. */
const isNetworkError = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof Error &&
    (error.name === 'AbortError' || /^\/(v1|screenshot)/.test(error.message)));

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });

async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const relay = () => controller.abort();
  outer?.addEventListener('abort', relay, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', relay);
  }
}

/**
 * One app's link to the ExpoSnap server: find it, announce the device, then
 * long-poll for commands and answer each. Phones cannot accept connections
 * from the computer, so the app always calls in.
 */
export class Session {
  private readonly fetch: typeof fetch;
  private readonly stopController = new AbortController();
  private serverUrl: string | null = null;
  private logs: LogEntry[] = [];
  private flushing = false;
  private status: SessionStatus = 'searching';

  constructor(private readonly deps: SessionDeps) {
    this.fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get url(): string | null {
    return this.serverUrl;
  }

  start(): void {
    void this.run();
  }

  stop(): void {
    this.stopController.abort();
  }

  private get stopped(): boolean {
    return this.stopController.signal.aborted;
  }

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.deps.onStatus?.(status, this.serverUrl);
  }

  private reported = new Set<string>();

  private report(error: unknown): void {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (this.reported.has(failure.message)) return;
    this.reported.add(failure.message);
    this.deps.onError?.(failure);
  }

  /** Device details are best effort: a platform missing one must not block the connection. */
  private device(): DeviceInfo {
    try {
      return this.deps.device();
    } catch (error) {
      this.report(error);
      return { platform: 'unknown' };
    }
  }

  private async run(): Promise<void> {
    const signal = this.stopController.signal;
    const firstRetry = this.deps.retryMs ?? 5000;
    let retry = firstRetry;
    while (!this.stopped) {
      this.serverUrl = await this.find();
      if (!this.serverUrl) {
        // Back off while nothing answers: the server may simply not be running today.
        await sleep(retry, signal);
        retry = Math.min(retry * 2, Math.max(firstRetry, 30_000));
        continue;
      }
      retry = firstRetry;
      try {
        await this.post(ROUTES.hello, { device: this.device() });
        this.setStatus('connected');
        void this.flushLogs();
        await this.pollLoop();
      } catch (error) {
        // Usually the server went away (editor closed, laptop asleep); anything
        // else is worth a line in the console.
        if (!this.stopped && !isNetworkError(error)) this.report(error);
      }
      if (!this.stopped) {
        this.serverUrl = null;
        this.setStatus('searching');
        await sleep(1000, signal);
      }
    }
  }

  /**
   * Asks the candidates on the first port at once, then the rest; the first
   * real ExpoSnap server wins. Trying the usual port first keeps a browser's
   * console from filling with refused connections to ports nobody uses.
   */
  async find(): Promise<string | null> {
    const candidates = [...new Set(this.deps.candidates())];
    if (!candidates.length) return null;
    const port = (url: string) => /:(\d+)$/.exec(url)?.[1];
    const first = candidates.filter(url => port(url) === port(candidates[0]));
    const rest = candidates.filter(url => !first.includes(url));
    return (await this.probe(first)) ?? (rest.length ? this.probe(rest) : null);
  }

  private async probe(candidates: string[]): Promise<string | null> {
    const probes = candidates.map(async base => {
      const body = await withTimeout(
        1500,
        async signal => {
          const response = await this.fetch(`${base}${ROUTES.ping}`, {
            signal,
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error(String(response.status));
          return (await response.json()) as PingResponse;
        },
        this.stopController.signal
      );
      if (body?.service !== SERVICE) throw new Error('not exposnap');
      return base;
    });
    try {
      return await Promise.any(probes);
    } catch {
      return null;
    }
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      const response = await withTimeout(
        POLL_WAIT_MS + 10_000,
        signal =>
          this.fetch(
            `${this.serverUrl}${ROUTES.commands}?wait=${POLL_WAIT_MS}`,
            { signal }
          ),
        this.stopController.signal
      );
      if (!response.ok) throw new Error(`poll ${response.status}`);
      const { commands } = (await response.json()) as { commands: Command[] };
      for (const command of commands) await this.handle(command);
    }
  }

  private async handle(command: Command): Promise<void> {
    try {
      switch (command.type) {
        case 'capture':
          // The upload itself answers the request, carrying its id.
          await this.captureAndUpload(command.options, command.id);
          return;
        case 'open_url':
          await this.deps.openUrl(command.url);
          break;
        case 'reload':
          await this.post(ROUTES.results, { id: command.id, ok: true });
          this.deps.reload();
          return;
      }
      await this.post(ROUTES.results, { id: command.id, ok: true });
    } catch (error) {
      await this.post(ROUTES.results, {
        id: command.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  }

  /** Captures and uploads; with no request id it is a person tapping the camera. */
  async captureAndUpload(
    options: CaptureOptions = {},
    requestId?: string
  ): Promise<boolean> {
    if (!this.serverUrl) return false;
    const previous = this.status;
    this.setStatus('capturing');
    try {
      const shot = await this.deps.capture(options);
      const body: ScreenshotUpload = {
        ...shot,
        description: options.description,
        requestId,
      };
      await this.post(ROUTES.screenshot, body);
      return true;
    } finally {
      this.setStatus(previous === 'capturing' ? 'connected' : previous);
    }
  }

  log(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > MAX_QUEUED_LOGS)
      this.logs.splice(0, this.logs.length - MAX_QUEUED_LOGS);
    if (this.serverUrl && !this.flushing) {
      // Batch a burst of console calls into one request.
      setTimeout(() => void this.flushLogs(), 250);
      this.flushing = true;
    }
  }

  private async flushLogs(): Promise<void> {
    this.flushing = false;
    if (!this.serverUrl || !this.logs.length) return;
    const entries = this.logs.splice(0);
    try {
      await this.post(ROUTES.logs, { entries });
    } catch {
      // Keep them for the next connection rather than losing a crash's last words.
      this.logs.unshift(...entries.slice(-MAX_QUEUED_LOGS));
    }
  }

  private async post(path: string, body: unknown): Promise<void> {
    if (!this.serverUrl) throw new Error('Not connected');
    const response = await withTimeout(
      30_000,
      signal =>
        this.fetch(`${this.serverUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        }),
      this.stopController.signal
    );
    if (!response.ok) throw new Error(`${path} ${response.status}`);
  }
}
