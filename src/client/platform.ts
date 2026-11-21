import {
  Appearance,
  DevSettings,
  Dimensions,
  Linking,
  NativeModules,
  PixelRatio,
  Platform,
  TurboModuleRegistry,
  type View,
} from 'react-native';
import type { TurboModule } from 'react-native';
import { captureNode } from './capture';
import type { CaptureOptions, DeviceInfo } from '../shared/protocol.js';
import { hostFromUrl } from './host.js';
import type { CaptureResult } from './session.js';

interface SourceCode extends TurboModule {
  getConstants(): { scriptURL: string | null };
}

/** The URL this JavaScript bundle was served from: Metro, on the developer's computer. */
export function bundleUrl(): string | null {
  if (Platform.OS === 'web') {
    return typeof location === 'undefined' ? null : location.href;
  }
  try {
    const url =
      TurboModuleRegistry.get<SourceCode>('SourceCode')?.getConstants()
        .scriptURL;
    if (url) return url;
  } catch {
    // Old architecture without the TurboModule interop: fall through.
  }
  return (
    (NativeModules.SourceCode as { scriptURL?: string } | undefined)
      ?.scriptURL ?? null
  );
}

export function deviceInfo(): DeviceInfo {
  const window = Dimensions.get('window');
  // react-native-web has no Platform.constants.
  const constants = (Platform.constants ?? {}) as Record<string, unknown>;
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    model:
      typeof constants.Model === 'string'
        ? constants.Model
        : typeof constants.interfaceIdiom === 'string'
          ? constants.interfaceIdiom
          : undefined,
    window: {
      width: window.width,
      height: window.height,
      scale: PixelRatio.get(),
      fontScale: PixelRatio.getFontScale(),
    },
    colorScheme: Appearance.getColorScheme() ?? null,
    isDev: typeof __DEV__ === 'undefined' ? undefined : __DEV__,
  };
}

/**
 * Captures `view` at most `maxDimension` pixels on its long edge. A phone
 * screen at full density is ~2500px tall and vision models downscale past
 * ~1568px, so the extra pixels would only slow the upload.
 */
export async function captureView(
  view: View,
  size: { width: number; height: number },
  options: CaptureOptions
): Promise<CaptureResult> {
  const format = options.format ?? 'png';
  const ratio = PixelRatio.get();
  const longEdge = Math.max(size.width, size.height) * ratio;
  const scale =
    longEdge > 0 ? Math.min(1, (options.maxDimension ?? 1568) / longEdge) : 1;
  const width = Math.round(size.width * ratio * scale);
  const height = Math.round(size.height * ratio * scale);
  const base64 = await captureNode(view, {
    format,
    quality: format === 'jpg' ? 0.85 : 1,
    ...(width > 0 && height > 0 ? { width, height } : {}),
  });
  return {
    base64: base64.replace(/^data:image\/\w+;base64,/, ''),
    mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
    width: width || undefined,
    height: height || undefined,
  };
}

interface ExpoGlobal {
  expo?: {
    modules?: { ExponentConstants?: { executionEnvironment?: string } };
  };
}

/**
 * Opens a deep link, or an Expo Router path. A path needs the app's own
 * navigation (the `navigate` prop) unless the app runs in Expo Go, where
 * exp://<metro>/--/<path> reaches the route without knowing the scheme.
 */
export async function openUrl(
  url: string,
  navigate?: (path: string) => void
): Promise<void> {
  if (url.startsWith('/')) {
    if (navigate) return navigate(url);
    if (Platform.OS === 'web' && typeof location !== 'undefined') {
      location.assign(url);
      return;
    }
    const environment = (globalThis as ExpoGlobal).expo?.modules
      ?.ExponentConstants?.executionEnvironment;
    const metro = bundleUrl();
    const host = hostFromUrl(metro);
    const port = metro ? /:(\d+)\//.exec(metro)?.[1] : undefined;
    if (environment === 'storeClient' && host) {
      await Linking.openURL(`exp://${host}${port ? `:${port}` : ''}/--${url}`);
      return;
    }
    throw new Error(
      "Opening a route needs the app's router. Pass navigate to ScreenshotWrapper, e.g. navigate={path => router.push(path)}, or give a full deep link such as myapp://settings."
    );
  }
  await Linking.openURL(url);
}

export function reload(): void {
  if (Platform.OS === 'web' && typeof location !== 'undefined')
    location.reload();
  else DevSettings.reload();
}
