/** Defined by Metro: true in development bundles, false in release builds. */
declare const __DEV__: boolean;

declare module 'react-native-view-shot/src/RNViewShot.web' {
  const RNViewShotWeb: {
    captureRef(
      element: HTMLElement,
      options: {
        format: string;
        quality: number;
        result: 'base64';
        width?: number;
        height?: number;
      }
    ): Promise<string>;
  };
  export default RNViewShotWeb;
}
