/* eslint-disable no-undef */
import React, { useState, useRef, ReactNode, useEffect } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { discoverServer, getServerURL } from './auto-discovery.js';

// Simple Camera Icon Component
const CameraIcon = ({
  size = 20,
  color = 'white',
}: {
  size?: number;
  color?: string;
}) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <View
      style={{
        width: size * 0.9,
        height: size * 0.7,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: size * 0.1,
        position: 'relative',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: -size * 0.15,
          left: size * 0.25,
          width: size * 0.4,
          height: size * 0.2,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.05,
          borderTopRightRadius: size * 0.05,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.15,
          left: size * 0.2,
          width: size * 0.5,
          height: size * 0.5,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: size * 0.25,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: size * 0.1,
            left: size * 0.1,
            width: size * 0.3,
            height: size * 0.3,
            borderWidth: 1,
            borderColor: color,
            borderRadius: size * 0.15,
          }}
        />
      </View>
    </View>
  </View>
);

interface ScreenshotWrapperProps {
  children: ReactNode;
  serverUrl?: string;
  buttonStyle?: ViewStyle;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  enableAutoDiscovery?: boolean;
  discoveryTimeout?: number;
}

export function ScreenshotWrapper({
  children,
  serverUrl,
  buttonStyle,
  position = 'bottom-right',
  enableAutoDiscovery = true,
  discoveryTimeout = 3000,
}: ScreenshotWrapperProps) {
  const viewRef = useRef<View>(null);
  const [loading, setLoading] = useState(false);
  const [discoveredUrl, setDiscoveredUrl] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<
    'idle' | 'discovering' | 'found' | 'failed'
  >('idle');

  // Auto-discovery effect
  useEffect(() => {
    if (!enableAutoDiscovery || serverUrl || discoveredUrl) {
      return;
    }

    const runDiscovery = async () => {
      setDiscoveryStatus('discovering');
      try {
        const result = await Promise.race([
          discoverServer(),
          new Promise<null>(resolve =>
            setTimeout(() => resolve(null), discoveryTimeout)
          ),
        ]);

        if (result) {
          const url = getServerURL(result);
          setDiscoveredUrl(url);
          setDiscoveryStatus('found');
        } else {
          setDiscoveryStatus('failed');
        }
      } catch (error) {
        console.error('Discovery failed:', error);
        setDiscoveryStatus('failed');
      }
    };

    runDiscovery();
  }, [enableAutoDiscovery, serverUrl, discoveredUrl, discoveryTimeout]);

  const getActiveServerUrl = (): string | null => {
    return serverUrl || discoveredUrl;
  };

  const takeScreenshot = async () => {
    if (!viewRef.current) return;

    const activeUrl = getActiveServerUrl();
    if (!activeUrl) {
      console.error(
        'No server URL available. Either provide serverUrl prop or enable auto-discovery.'
      );
      return;
    }

    setLoading(true);
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
      } as unknown as Blob);

      await fetch(`${activeUrl}/screenshot`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (error) {
      console.error('Screenshot failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatus = () => {
    if (loading || discoveryStatus === 'discovering') return 'connecting';
    if (!getActiveServerUrl() || discoveryStatus === 'failed')
      return 'disconnected';
    return 'connected';
  };

  const getGlassmorphicStyle = (): ViewStyle => {
    const status = getConnectionStatus();
    let backgroundColor = 'rgba(255, 255, 255, 0.15)';
    let borderColor = 'rgba(255, 255, 255, 0.2)';

    if (status === 'connected') {
      backgroundColor = 'rgba(34, 197, 94, 0.2)';
      borderColor = 'rgba(34, 197, 94, 0.3)';
    } else if (status === 'disconnected') {
      backgroundColor = 'rgba(239, 68, 68, 0.2)';
      borderColor = 'rgba(239, 68, 68, 0.3)';
    } else if (status === 'connecting') {
      backgroundColor = 'rgba(251, 191, 36, 0.2)';
      borderColor = 'rgba(251, 191, 36, 0.3)';
    }

    return {
      backgroundColor,
      borderWidth: 1,
      borderColor,
      backdropFilter: 'blur(10px)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    };
  };

  const getPositionStyle = (): ViewStyle => {
    const base: ViewStyle = {
      position: 'absolute',
      width: 52,
      height: 52,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      ...getGlassmorphicStyle(),
    };

    switch (position) {
      case 'bottom-right':
        return { ...base, bottom: 50, right: 20 };
      case 'bottom-left':
        return { ...base, bottom: 50, left: 20 };
      case 'top-right':
        return { ...base, top: 50, right: 20 };
      case 'top-left':
        return { ...base, top: 50, left: 20 };
      default:
        return { ...base, bottom: 50, right: 20 };
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View ref={viewRef} style={{ flex: 1 }}>
        {children}
      </View>

      <TouchableOpacity
        onPress={takeScreenshot}
        disabled={
          loading || discoveryStatus === 'discovering' || !getActiveServerUrl()
        }
        style={[getPositionStyle(), buttonStyle]}
        activeOpacity={0.7}
      >
        <CameraIcon size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}
