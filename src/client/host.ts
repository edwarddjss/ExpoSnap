import { DEFAULT_PORT, PORT_RANGE } from '../shared/protocol.js';

/** Tunnels (expo start --tunnel) expose Metro only, never the ExpoSnap port. */
const TUNNEL = /\.(exp\.direct|ngrok\.io|ngrok-free\.app|ngrok\.app)$/i;

export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(url);
  const host = match?.[1] ?? null;
  return host && !TUNNEL.test(host) ? host : null;
}

/**
 * Where the ExpoSnap server probably is, best guess first. The bundle came
 * from Metro on the developer's computer, and ExpoSnap runs on that same
 * computer, so Metro's host is right on a phone, a simulator and the web
 * alike. Loopback and the Android emulator's alias for the host cover
 * the rest.
 */
export function candidateUrls(input: {
  bundleUrl?: string | null;
  platform?: string;
  port?: number;
  serverUrl?: string;
}): string[] {
  if (input.serverUrl) {
    const url = /^https?:\/\//.test(input.serverUrl)
      ? input.serverUrl
      : `http://${input.serverUrl}`;
    return [url.replace(/\/+$/, '')];
  }
  const hosts = [hostFromUrl(input.bundleUrl), 'localhost', '127.0.0.1'];
  if (input.platform === 'android') hosts.push('10.0.2.2');
  const ports = input.port
    ? [input.port]
    : Array.from({ length: PORT_RANGE }, (_, offset) => DEFAULT_PORT + offset);
  const unique = [...new Set(hosts.filter((host): host is string => !!host))];
  return unique.flatMap(host => ports.map(port => `http://${host}:${port}`));
}
