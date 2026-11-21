import { Platform } from 'react-native';
import { candidateUrls } from './host.js';
import { bundleUrl, deviceInfo, openUrl, reload } from './platform.js';
import { Session } from './session.js';

export {
  ScreenshotWrapper,
  ScreenshotWrapper as ExpoSnap,
} from './ScreenshotWrapper.js';
export type { ScreenshotWrapperProps } from './ScreenshotWrapper.js';
export type { SessionStatus } from './session.js';

export interface DiscoveryResult {
  ip: string;
  port: number;
  service: string;
  version: string;
}

/** Kept from 2.x: finds the server once and reports where it is. */
export async function discoverServer(
  port?: number
): Promise<DiscoveryResult | null> {
  const session = new Session({
    candidates: () =>
      candidateUrls({ bundleUrl: bundleUrl(), platform: Platform.OS, port }),
    capture: () => Promise.reject(new Error('unused')),
    device: deviceInfo,
    openUrl: url => openUrl(url),
    reload,
  });
  const url = await session.find();
  session.stop();
  if (!url) return null;
  const parsed = new URL(url);
  const ping = (await (await fetch(`${url}/ping`)).json()) as {
    version?: string;
  };
  return {
    ip: parsed.hostname,
    port: Number(parsed.port),
    service: 'exposnap',
    version: ping.version ?? 'unknown',
  };
}

/** Kept from 2.x. */
export function getServerURL(result: DiscoveryResult): string {
  return `http://${result.ip}:${result.port}`;
}
