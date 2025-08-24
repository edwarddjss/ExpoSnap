/* eslint-disable no-undef */
import React, { useState, useRef, ReactNode, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { discoverServer, getServerURL } from './auto-discovery.js';

interface ScreenshotWrapperProps {
  children: ReactNode;
  serverUrl?: string;
  buttonStyle?: ViewStyle;
  buttonTextStyle?: TextStyle;
  buttonText?: string;
  loadingText?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  enableAutoDiscovery?: boolean;
  discoveryTimeout?: number;
}

export function ScreenshotWrapper({
  children,
  serverUrl,
  buttonStyle,
  buttonTextStyle,
  buttonText = '📸',
  loadingText = 'Finding server...',
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

  const getButtonText = (): string => {
    if (loading) return loadingText;

    if (enableAutoDiscovery && !serverUrl) {
      switch (discoveryStatus) {
        case 'discovering':
          return 'Finding...';
        case 'failed':
          return 'No server';
        case 'found':
          return buttonText;
        default:
          return buttonText;
      }
    }

    return buttonText;
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

  const getPositionStyle = (): ViewStyle => {
    const base: ViewStyle = {
      position: 'absolute',
      backgroundColor: '#007AFF',
      padding: 15,
      borderRadius: 25,
      minWidth: 50,
      alignItems: 'center',
      justifyContent: 'center',
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
      >
        <Text style={[{ color: 'white', fontSize: 16 }, buttonTextStyle]}>
          {getButtonText()}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
