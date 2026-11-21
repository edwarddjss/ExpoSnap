import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { CaptureButton } from './CaptureButton.js';
import { captureConsole } from './console.js';
import { candidateUrls } from './host.js';
import {
  bundleUrl,
  captureView,
  deviceInfo,
  openUrl,
  reload,
} from './platform.js';
import { Session, type SessionStatus } from './session.js';

export interface ScreenshotWrapperProps {
  children: ReactNode;
  /** Off in production builds by default: nothing connects, logs nothing, renders only the children. */
  enabled?: boolean;
  /** Show the floating camera for manual screenshots. The agent can capture either way. */
  showCameraIcon?: boolean;
  /** Forward console output and uncaught errors so the agent can read them with get_logs. */
  captureLogs?: boolean;
  /** Skip discovery and use this server, e.g. "192.168.1.20:3333" when Metro runs in tunnel mode. */
  serverUrl?: string;
  /** Only try this port (EXPOSNAP_PORT on the server). */
  port?: number;
  /** Lets the agent open routes by path, e.g. navigate={path => router.push(path)} with Expo Router. */
  navigate?: (path: string) => void;
}

function ActiveWrapper({
  children,
  showCameraIcon = true,
  captureLogs = true,
  serverUrl,
  port,
  navigate,
}: Omit<ScreenshotWrapperProps, 'enabled'>) {
  const content = useRef<View>(null);
  const size = useRef({ width: 0, height: 0 });
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [status, setStatus] = useState<SessionStatus>('searching');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const next = new Session({
      candidates: () =>
        candidateUrls({
          bundleUrl: bundleUrl(),
          platform: Platform.OS,
          port,
          serverUrl,
        }),
      capture: async options => {
        if (!content.current) throw new Error('The app has not rendered yet');
        return captureView(content.current, size.current, options);
      },
      device: deviceInfo,
      openUrl: url => openUrl(url, navigateRef.current),
      reload,
      onStatus: setStatus,
      onError: error => console.warn(`[ExpoSnap] ${error.message}`),
    });
    const restoreConsole = captureLogs
      ? captureConsole(entry => next.log(entry))
      : undefined;
    next.start();
    setSession(next);
    return () => {
      restoreConsole?.();
      next.stop();
    };
  }, [captureLogs, port, serverUrl]);

  const onLayout = (event: LayoutChangeEvent) => {
    size.current = event.nativeEvent.layout;
  };

  return (
    <View style={styles.fill}>
      <View
        ref={content}
        collapsable={false}
        style={styles.fill}
        onLayout={onLayout}
      >
        {children}
      </View>
      {showCameraIcon ? (
        <CaptureButton
          status={status}
          onPress={() => {
            if (status === 'connected')
              void session?.captureAndUpload().catch(() => undefined);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Wrap the app's root with this. In development it finds the ExpoSnap server
 * on your computer and lets your AI assistant take screenshots, read logs and
 * navigate; in production it renders `children` and nothing else.
 */
export function ScreenshotWrapper({
  enabled = typeof __DEV__ === 'undefined' ? false : __DEV__,
  ...props
}: ScreenshotWrapperProps) {
  return enabled ? <ActiveWrapper {...props} /> : <>{props.children}</>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
