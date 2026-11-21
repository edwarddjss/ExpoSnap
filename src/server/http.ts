import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import type {
  CommandResult,
  DeviceInfo,
  LogEntry,
  PingResponse,
  ScreenshotUpload,
} from '../shared/protocol.js';
import { PROTOCOL_VERSION, ROUTES, SERVICE } from '../shared/protocol.js';
import type { Bridge } from './bridge.js';
import { mimeTypeFor, type Store } from './store.js';

/** A full-resolution PNG from a tablet is a few MB; base64 adds a third. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const LOG_LEVELS = new Set(['debug', 'log', 'info', 'warn', 'error']);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Upload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  try {
    return JSON.parse((await readBody(req)).toString('utf8')) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Body must be JSON');
  }
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(
    status,
    body === undefined ? {} : { 'Content-Type': 'application/json' }
  );
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

/**
 * Wrappers from 2.x post multipart form data (field "screenshot", optional
 * "description" and "requestId"); 3.x posts JSON with the image in base64.
 * Both stay accepted so an app on the old wrapper keeps working when
 * `npx exposnap` fetches the new server.
 */
async function readScreenshot(
  req: IncomingMessage
): Promise<ScreenshotUpload & { data: Buffer }> {
  const type = req.headers['content-type'] ?? '';
  if (type.includes('application/json')) {
    const body = await readJson<ScreenshotUpload>(req);
    if (typeof body.base64 !== 'string' || !body.base64) {
      throw new HttpError(400, 'No image provided');
    }
    return {
      ...body,
      mimeType: body.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      data: Buffer.from(body.base64, 'base64'),
    };
  }
  if (type.includes('multipart/form-data')) {
    const raw = await readBody(req);
    const form = await new Request('http://exposnap.local/', {
      method: 'POST',
      headers: { 'content-type': type },
      body: raw,
    }).formData();
    const file = form.get('screenshot');
    if (!file || typeof file === 'string')
      throw new HttpError(400, 'No image provided');
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;
    };
    return {
      base64: '',
      data: Buffer.from(await file.arrayBuffer()),
      mimeType:
        file.type === 'image/jpeg'
          ? 'image/jpeg'
          : mimeTypeFor(file.name || 'x.png'),
      description: text('description'),
      requestId: text('requestId'),
    };
  }
  throw new HttpError(415, 'Send JSON or multipart/form-data');
}

export function createHttpServer(
  store: Store,
  bridge: Bridge,
  version: string
): http.Server {
  return http.createServer(async (req, res) => {
    // The app on Expo web runs on another origin; everything here is
    // development-only and carries no credentials.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url ?? '/', 'http://exposnap.local');
    const route = `${req.method} ${url.pathname}`;
    try {
      switch (route) {
        case `GET ${ROUTES.ping}`:
        case 'GET /discover': {
          const body: PingResponse = {
            name: 'exposnap-mcp-server',
            service: SERVICE,
            version,
            protocol: PROTOCOL_VERSION,
            status: 'ready',
            port: (req.socket.address() as AddressInfo).port,
          };
          return send(res, 200, body);
        }
        case `POST ${ROUTES.hello}`: {
          bridge.touch((await readJson<{ device?: DeviceInfo }>(req)).device);
          return send(res, 200, { ok: true });
        }
        case `GET ${ROUTES.commands}`: {
          const wait = Number(url.searchParams.get('wait'));
          const gone = new AbortController();
          res.once('close', () => gone.abort());
          const commands = await bridge.poll(
            Number.isFinite(wait) && wait > 0
              ? Math.min(wait, 30_000)
              : undefined,
            gone.signal
          );
          if (res.destroyed || res.writableEnded)
            return bridge.requeue(commands);
          return send(res, 200, { commands });
        }
        case `POST ${ROUTES.results}`: {
          const result = await readJson<CommandResult>(req);
          bridge.touch();
          bridge.settle(
            result.id,
            result.ok
              ? { ok: true }
              : {
                  ok: false,
                  error: result.error ?? 'The app reported a failure',
                }
          );
          return send(res, 200, { ok: true });
        }
        case `POST ${ROUTES.logs}`: {
          const { entries } = await readJson<{ entries?: LogEntry[] }>(req);
          const valid = (Array.isArray(entries) ? entries : [])
            .filter(
              entry =>
                entry &&
                LOG_LEVELS.has(entry.level) &&
                typeof entry.message === 'string'
            )
            .map(entry => ({
              level: entry.level,
              message: entry.message.slice(0, 10_000),
              timestamp: Number(entry.timestamp) || Date.now(),
            }));
          bridge.touch();
          store.addLogs(valid);
          return send(res, 200, { accepted: valid.length });
        }
        case `POST ${ROUTES.screenshot}`: {
          const upload = await readScreenshot(req);
          bridge.touch();
          const shot = await store.addScreenshot(upload.data, {
            mimeType: upload.mimeType,
            description: upload.description,
            width: upload.width,
            height: upload.height,
            trigger: upload.requestId ? 'agent' : 'manual',
          });
          if (upload.requestId)
            bridge.settle(upload.requestId, { ok: true, value: shot });
          return send(res, 200, {
            success: true,
            id: shot.id,
            path: store.pathOf(shot),
          });
        }
        default:
          return send(res, 404, { error: 'Not found' });
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500)
        console.error('[ExpoSnap] Request failed:', route, error);
      if (!res.headersSent)
        send(res, status, {
          error: error instanceof Error ? error.message : 'Failed',
        });
    }
  });
}

/** Listens on the first free port from `port` up, so two editors can each run one. */
export async function listen(
  server: http.Server,
  port: number,
  attempts = 5
): Promise<number> {
  for (let offset = 0; offset < attempts; offset++) {
    const candidate = port === 0 ? 0 : port + offset;
    const bound = await new Promise<number | null>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening);
        if (error.code === 'EADDRINUSE') resolve(null);
        else reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve((server.address() as AddressInfo).port);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(candidate);
    });
    if (bound !== null) return bound;
  }
  throw new Error(
    `Ports ${port} to ${port + attempts - 1} are all in use. Set EXPOSNAP_PORT to a free one.`
  );
}

/** The computer's LAN addresses, for the startup message and the serverUrl hint. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (net): net is os.NetworkInterfaceInfo =>
        !!net && net.family === 'IPv4' && !net.internal
    )
    .map(net => net.address);
}
