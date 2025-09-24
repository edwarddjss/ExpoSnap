import React, { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useConnection } from './hooks/useConnection';
import { useScreenshotCapture } from './hooks/useScreenshotCapture';
import { useAutoCapture } from './hooks/useAutoCapture';

interface ScreenshotWrapperProps {
  children: React.ReactNode;
}

export function ScreenshotWrapper({ children }: ScreenshotWrapperProps) {
  const viewRef = useRef<View>(null);
  const connection = useConnection();
  const screenshot = useScreenshotCapture(connection.url);

  // Stable capture function
  const captureFunction = useCallback(
    (requestId?: string) =>
      screenshot.captureAndUploadSilent(viewRef, requestId),
    [screenshot]
  );

  // Auto-capture system
  useAutoCapture(
    {
      serverUrl: connection.url || '',
      pollInterval: 3000, // 3 second default polling
      enabled: connection.isConnected,
    },
    captureFunction
  );

  return (
    <View style={{ flex: 1 }} ref={viewRef} collapsable={false}>
      {children}
    </View>
  );
}
