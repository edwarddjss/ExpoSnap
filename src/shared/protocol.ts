/**
 * The wire contract between the app wrapper and the server. Both sides import
 * it, so a renamed field is a type error rather than a silent mismatch.
 */
export const DEFAULT_PORT = 3333;
/** The app tries this many ports from DEFAULT_PORT up, because a second editor's server takes the next free one. */
export const PORT_RANGE = 5;
export const PROTOCOL_VERSION = 3;
export const SERVICE = 'exposnap';

/** How long the server holds a command poll open before answering "nothing yet". */
export const POLL_WAIT_MS = 25_000;

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

export interface DeviceInfo {
  platform: string;
  osVersion?: string;
  model?: string;
  window?: { width: number; height: number; scale: number; fontScale: number };
  colorScheme?: string | null;
  isDev?: boolean;
  appName?: string;
}

export interface CaptureOptions {
  format?: 'png' | 'jpg';
  /** Longest edge in pixels. Vision models downscale anything past ~1568px anyway, so larger only costs upload time. */
  maxDimension?: number;
  description?: string;
}

export type Command =
  | { id: string; type: 'capture'; options: CaptureOptions }
  | { id: string; type: 'open_url'; url: string }
  | { id: string; type: 'reload' };

export interface CommandResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface ScreenshotUpload {
  base64: string;
  mimeType: 'image/png' | 'image/jpeg';
  description?: string;
  /** Set when the screenshot answers a take_screenshot request. */
  requestId?: string;
  width?: number;
  height?: number;
}

export interface PingResponse {
  name: string;
  service: typeof SERVICE;
  version: string;
  protocol: number;
  status: 'ready';
  port: number;
}

export const ROUTES = {
  ping: '/ping',
  screenshot: '/screenshot',
  hello: '/v1/hello',
  commands: '/v1/commands',
  results: '/v1/results',
  logs: '/v1/logs',
} as const;
