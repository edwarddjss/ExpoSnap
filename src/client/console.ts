import type { LogEntry, LogLevel } from '../shared/protocol.js';

const LEVELS: LogLevel[] = ['debug', 'log', 'info', 'warn', 'error'];
const MAX_MESSAGE = 4000;

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error)
    return value.stack ?? `${value.name}: ${value.message}`;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function')
    return `[Function ${value.name || 'anonymous'}]`;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, inner: unknown) => {
      if (typeof inner === 'object' && inner !== null) {
        if (seen.has(inner)) return '[Circular]';
        seen.add(inner);
      }
      return typeof inner === 'bigint' ? `${inner}n` : inner;
    });
  } catch {
    return String(value);
  }
}

export function formatArgs(args: unknown[]): string {
  const message = args.map(stringify).join(' ');
  return message.length > MAX_MESSAGE
    ? `${message.slice(0, MAX_MESSAGE)}… (${message.length} chars)`
    : message;
}

interface ErrorUtilsShape {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

/**
 * Mirrors console output and uncaught errors to `sink` while still printing
 * them as usual. Returns a function that puts everything back, so a remount
 * or Fast Refresh never wraps console twice.
 */
export function captureConsole(
  sink: (entry: LogEntry) => void,
  target: Console = console
): () => void {
  const originals = new Map<LogLevel, (...args: unknown[]) => void>();
  let inside = false;
  const emit = (level: LogLevel, args: unknown[]) => {
    // A sink that logs must not loop back into itself.
    if (inside) return;
    inside = true;
    try {
      sink({ level, message: formatArgs(args), timestamp: Date.now() });
    } catch {
      // Never let log forwarding break the app's own logging.
    } finally {
      inside = false;
    }
  };

  for (const level of LEVELS) {
    const original = target[level] as (...args: unknown[]) => void;
    if (typeof original !== 'function') continue;
    originals.set(level, original);
    target[level] = (...args: unknown[]) => {
      emit(level, args);
      original.apply(target, args);
    };
  }

  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape })
    .ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler();
  errorUtils?.setGlobalHandler((error, isFatal) => {
    emit('error', [`Uncaught${isFatal ? ' fatal' : ''} error:`, error]);
    previousHandler?.(error, isFatal);
  });

  // In a browser, errors outside React (timers, handlers) reach window, not
  // ErrorUtils, even where Expo's web runtime defines ErrorUtils.
  const scope = globalThis as unknown as {
    addEventListener?: (type: string, listener: (event: never) => void) => void;
    removeEventListener?: (
      type: string,
      listener: (event: never) => void
    ) => void;
  };
  const onError = (event: { error?: unknown; message?: string }) =>
    emit('error', ['Uncaught error:', event.error ?? event.message]);
  const onRejection = (event: { reason?: unknown }) =>
    emit('error', ['Unhandled promise rejection:', event.reason]);
  const listen = typeof scope.addEventListener === 'function';
  if (listen) {
    scope.addEventListener!('error', onError);
    scope.addEventListener!('unhandledrejection', onRejection);
  }

  return () => {
    if (listen) {
      scope.removeEventListener?.('error', onError);
      scope.removeEventListener?.('unhandledrejection', onRejection);
    }
    for (const [level, original] of originals) target[level] = original;
    if (errorUtils && previousHandler)
      errorUtils.setGlobalHandler(previousHandler);
  };
}
