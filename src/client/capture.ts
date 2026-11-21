import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export interface NodeCaptureOptions {
  format: 'png' | 'jpg';
  quality: number;
  width?: number;
  height?: number;
}

/** iOS and Android: the native snapshot. Metro uses capture.web.ts in a browser. */
export function captureNode(
  view: View,
  options: NodeCaptureOptions
): Promise<string> {
  return captureRef(view, { ...options, result: 'base64' });
}
