import { useState, useEffect, useCallback, useRef } from 'react';
import { discoverServer, getServerURL } from '../auto-discovery.js';

export type ConnectionStatus =
  | 'discovering'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  url: string | null;
  error: string | null;
}

export function useConnection(initialUrl?: string) {
  const [state, setState] = useState<ConnectionState>(() => ({
    status: initialUrl ? 'disconnected' : 'discovering',
    url: initialUrl ?? null,
    error: null,
  }));

  const stateRef = useRef(state);
  const discoveryInFlight = useRef(false);

  const testConnection = useCallback(async (url: string): Promise<boolean> => {
    if (!url) {
      return false;
    }

    setState(prev => ({ ...prev, status: 'connecting', url, error: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const requestUrl = url.endsWith('/') ? url + 'ping' : url + '/ping';
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.service === 'exposnap') {
          setState(prev => ({ ...prev, status: 'connected', error: null }));
          return true;
        }
      }

      throw new Error('Invalid server response');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const runDiscovery = useCallback(async (): Promise<boolean> => {
    if (discoveryInFlight.current) {
      return false;
    }

    discoveryInFlight.current = true;
    if (stateRef.current.status === 'connecting') {
      discoveryInFlight.current = false;
      return false;
    }

    setState(prev => ({ ...prev, status: 'discovering', error: null }));

    try {
      const result = await discoverServer();

      if (result) {
        if (stateRef.current.status === 'connected') {
          return true;
        }

        const discoveredUrl = getServerURL(result);
        setState(prev => ({ ...prev, url: discoveredUrl }));
        return await testConnection(discoveredUrl);
      }

      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'ExpoSnap server not found on local network.',
      }));
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Discovery failed';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      return false;
    } finally {
      discoveryInFlight.current = false;
    }
  }, [testConnection]);

  const connect = useCallback(
    async (url: string) => {
      const normalizedUrl = url.startsWith('http') ? url : 'http://' + url;
      await testConnection(normalizedUrl);
    },
    [testConnection]
  );

  const disconnect = useCallback(() => {
    setState({
      status: initialUrl ? 'disconnected' : 'discovering',
      url: initialUrl ?? null,
      error: null,
    });
  }, [initialUrl]);

  useEffect(() => {
    if (!initialUrl) {
      runDiscovery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  useEffect(() => {
    if (state.url && state.status === 'disconnected') {
      testConnection(state.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url, state.status]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  return {
    ...state,
    connect,
    disconnect,
    discover: runDiscovery,
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isDiscovering: state.status === 'discovering',
    hasError: state.status === 'error',
  };
}
