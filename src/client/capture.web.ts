import type { View } from 'react-native';
import RNViewShotWeb from 'react-native-view-shot/src/RNViewShot.web';
import type { NodeCaptureOptions } from './capture';

/**
 * In a browser, react-native-view-shot's captureRef calls findNodeHandle,
 * which react-native-web does not support. Its web module renders a DOM
 * element directly, and with react-native-web a View's ref is that element.
 */
export function captureNode(
  view: View,
  options: NodeCaptureOptions
): Promise<string> {
  return RNViewShotWeb.captureRef(view as unknown as HTMLElement, {
    ...options,
    // A data URL wants the MIME subtype: "jpg" silently falls back to PNG.
    format: options.format === 'jpg' ? 'jpeg' : 'png',
    result: 'base64',
  });
}
