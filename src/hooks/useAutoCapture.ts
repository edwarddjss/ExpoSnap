import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export interface AutoCaptureConfig {
  serverUrl: string;
  pollInterval: number;
  enabled: boolean;
}

export interface AutoCaptureState {
  isPolling: boolean;
  lastError: string | null;
  lastRequestId: string | null;
  requestsHandled: number;
}

export function useAutoCapture(
  config: AutoCaptureConfig,
  captureFunction: (requestId?: string) => Promise<boolean>
) {
  const [state, setState] = useState<AutoCaptureState>({
    isPolling: false,
    lastError: null,
    lastRequestId: null,
    requestsHandled: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentPollInterval = useRef(config.pollInterval);

  // Adaptive polling intervals based on activity
  const updatePollInterval = useCallback((newInterval: number) => {
    currentPollInterval.current = newInterval;
  }, []);

  // Check for screenshot requests
  const checkForRequests = useCallback(async () => {
    if (!config.serverUrl || !config.enabled) return;

    try {
      const response = await fetch(`${config.serverUrl}/screenshot-request`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.requested && data.id) {
        setState(prev => ({
          ...prev,
          lastRequestId: data.id,
          lastError: null,
        }));

        // Trigger screenshot capture
        const success = await captureFunction(data.id);

        if (success) {
          // Notify server that request is completed
          await fetch(`${config.serverUrl}/screenshot-completed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: data.id }),
          });

          setState(prev => ({
            ...prev,
            requestsHandled: prev.requestsHandled + 1,
            lastError: null,
          }));

          // Increase polling frequency temporarily after successful capture
          updatePollInterval(1000); // 1 second for 30 seconds
          setTimeout(() => updatePollInterval(config.pollInterval), 30000);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        lastError: errorMessage,
      }));

      // Slow down polling on errors (exponential backoff)
      const newInterval = Math.min(currentPollInterval.current * 1.5, 10000);
      updatePollInterval(newInterval);

      // Reset to normal after 60 seconds
      setTimeout(() => updatePollInterval(config.pollInterval), 60000);
    }
  }, [
    config.serverUrl,
    config.enabled,
    captureFunction,
    updatePollInterval,
    config.pollInterval,
  ]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - immediate check and normal polling
        checkForRequests();
        updatePollInterval(config.pollInterval);
      } else if (nextAppState === 'background') {
        // App went to background - pause polling
        setState(prev => ({ ...prev, isPolling: false }));
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [checkForRequests, config.pollInterval, updatePollInterval]);

  // Main polling effect
  useEffect(() => {
    if (!config.enabled || !config.serverUrl) {
      setState(prev => ({ ...prev, isPolling: false }));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Only start polling if app is active
    if (AppState.currentState === 'active') {
      setState(prev => ({ ...prev, isPolling: true }));

      // Initial check
      checkForRequests();

      // Set up interval
      intervalRef.current = setInterval(() => {
        checkForRequests();
      }, currentPollInterval.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setState(prev => ({ ...prev, isPolling: false }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.serverUrl]);

  // Update polling interval when config changes
  useEffect(() => {
    currentPollInterval.current = config.pollInterval;

    // Restart interval with new timing if currently polling
    if (intervalRef.current && state.isPolling) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        checkForRequests();
      }, currentPollInterval.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.pollInterval, state.isPolling]);

  // Manual trigger function
  const triggerCheck = useCallback(() => {
    checkForRequests();
  }, [checkForRequests]);

  return {
    ...state,
    triggerCheck,
    currentPollInterval: currentPollInterval.current,
  };
}
