import React, { useRef, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useConnection } from './hooks/useConnection';
import { useScreenshotCapture } from './hooks/useScreenshotCapture';
import { ConnectionStatus } from './components/CameraIcon';
import { DraggableIcon } from './components/DraggableIcon';

interface ScreenshotWrapperProps {
  children: React.ReactNode;
  showCameraIcon?: boolean;
}

export function ScreenshotWrapper({ 
  children, 
  showCameraIcon = true
}: ScreenshotWrapperProps) {
  const contentRef = useRef<View>(null);
  const connection = useConnection();
  const screenshot = useScreenshotCapture(connection.url);
  const [isCapturing, setIsCapturing] = useState(false);

  // Manual capture function
  const handleCameraPress = useCallback(async () => {
    if (!connection.isConnected || isCapturing) return;
    
    setIsCapturing(true);
    try {
      await screenshot.captureAndUploadSilent(contentRef);
    } finally {
      setIsCapturing(false);
    }
  }, [connection.isConnected, screenshot, isCapturing]);

  // Determine camera icon status
  const getCameraStatus = (): ConnectionStatus => {
    if (isCapturing) return 'connecting';
    if (connection.isConnected) return 'connected';
    return 'disconnected';
  };

  return (
    <View style={styles.container}>
      {/* Content area that will be captured */}
      <View style={styles.contentContainer} ref={contentRef} collapsable={false}>
        {children}
      </View>
      
      {/* Camera icon overlay - outside capture area */}
      {showCameraIcon && (
        <DraggableIcon
          status={getCameraStatus()}
          onPress={handleCameraPress}
          disabled={isCapturing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
});
