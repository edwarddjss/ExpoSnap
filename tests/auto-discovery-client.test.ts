/* eslint-disable no-undef */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverServer, getServerURL } from '../src/auto-discovery.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Auto-discovery client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('discoverServer', () => {
    it('should find server on first IP tested', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('192.168.1.100:3333/ping')) {
          return new Response(
            JSON.stringify({
              service: 'exposnap',
              version: '1.1.0',
              port: 3333,
            }),
            {
              ok: true,
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        throw new Error('Network error');
      });

      const discoveryPromise = discoverServer();

      // Fast-forward timers to resolve promises
      await vi.runAllTimersAsync();

      const result = await discoveryPromise;

      expect(result).toEqual({
        ip: '192.168.1.100',
        port: 3333,
        service: 'exposnap',
        version: '1.1.0',
      });
    });

    it('should return null when no server found', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const discoveryPromise = discoverServer();
      await vi.runAllTimersAsync();
      const result = await discoveryPromise;

      expect(result).toBeNull();
    });

    it('should ignore non-exposnap services', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('192.168.1.1:3333/ping')) {
          return new Response(
            JSON.stringify({
              service: 'other-service',
              version: '1.0.0',
            }),
            {
              ok: true,
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        throw new Error('Network error');
      });

      const discoveryPromise = discoverServer();
      await vi.runAllTimersAsync();
      const result = await discoveryPromise;

      expect(result).toBeNull();
    });

    it('should handle custom port', async () => {
      const customPort = 4444;
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes(`192.168.1.100:${customPort}/ping`)) {
          return new Response(
            JSON.stringify({
              service: 'exposnap',
              version: '1.1.0',
              port: customPort,
            }),
            {
              ok: true,
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        throw new Error('Network error');
      });

      const discoveryPromise = discoverServer(customPort);
      await vi.runAllTimersAsync();
      const result = await discoveryPromise;

      expect(result?.port).toBe(customPort);
    });
  });

  describe('getServerURL', () => {
    it('should format server URL correctly', () => {
      const result = {
        ip: '192.168.1.100',
        port: 3333,
        service: 'exposnap',
        version: '1.1.0',
      };

      expect(getServerURL(result)).toBe('http://192.168.1.100:3333');
    });
  });
});
