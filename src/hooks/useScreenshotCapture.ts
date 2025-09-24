import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export interface ScreenshotCaptureState {
  isCapturing: boolean;
  lastError: string | null;
}

export function useScreenshotCapture(serverUrl: string | null) {
  const [state, setState] = useState<ScreenshotCaptureState>({
    isCapturing: false,
    lastError: null,
  });

  const captureAndUpload = useCallback(
    async (viewRef: React.RefObject<View | null>) => {
      if (!viewRef.current || !serverUrl) {
        setState(prev => ({
          ...prev,
          lastError: 'No view reference or server URL',
        }));
        return false;
      }

      setState(prev => ({ ...prev, isCapturing: true, lastError: null }));

      try {
        const uri = await captureRef(viewRef.current, {
          format: 'png',
          quality: 1,
        });

        const formData = new FormData();
        formData.append('screenshot', {
          uri,
          type: 'image/png',
          name: 'screenshot.png',
        } as Blob & { uri: string; type: string; name: string });

        const response = await fetch(`${serverUrl}/screenshot`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          Alert.alert('Success', 'Screenshot uploaded successfully!');
          setState(prev => ({ ...prev, isCapturing: false }));
          return true;
        } else {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Screenshot capture failed';
        setState(prev => ({
          ...prev,
          isCapturing: false,
          lastError: errorMessage,
        }));
        Alert.alert('Error', errorMessage);
        return false;
      }
    },
    [serverUrl]
  );

  const captureAndUploadSilent = useCallback(
    async (viewRef: React.RefObject<View | null>, requestId?: string) => {
      if (!viewRef.current || !serverUrl) {
        setState(prev => ({
          ...prev,
          lastError: 'No view reference or server URL',
        }));
        return false;
      }

      setState(prev => ({ ...prev, isCapturing: true, lastError: null }));

      try {
        const uri = await captureRef(viewRef.current, {
          format: 'png',
          quality: 1,
        });

        const formData = new FormData();
        formData.append('screenshot', {
          uri,
          type: 'image/png',
          name: 'screenshot.png',
        } as Blob & { uri: string; type: string; name: string });

        // Include request ID if provided
        if (requestId) {
          formData.append('requestId', requestId);
        }

        const response = await fetch(`${serverUrl}/screenshot`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          // Silent mode - no alerts
          setState(prev => ({ ...prev, isCapturing: false }));
          return true;
        } else {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Screenshot capture failed';
        setState(prev => ({
          ...prev,
          isCapturing: false,
          lastError: errorMessage,
        }));
        // Silent mode - no alerts, just log error state
        return false;
      }
    },
    [serverUrl]
  );

  return {
    ...state,
    captureAndUpload,
    captureAndUploadSilent,
  };
}
