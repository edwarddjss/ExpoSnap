import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createHttpServer } from '../src/http-server.js';
import { initializeStorage } from '../src/storage.js';
import type { Express } from 'express';
import type { Server } from 'http';

describe('Auto-discovery', () => {
  let app: Express;
  let server: Server;

  beforeEach(async () => {
    await initializeStorage();
    app = createHttpServer();
    server = app.listen(0); // Random available port
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Ping endpoint', () => {
    it('should respond to ping with server info', async () => {
      const response = await request(app).get('/ping').expect(200);

      expect(response.body).toEqual({
        name: 'exposnap-mcp-server',
        service: 'exposnap',
        version: '1.0.1',
        status: 'ready',
        port: expect.any(Number),
      });
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should respond quickly (under 1 second)', async () => {
      const start = Date.now();
      await request(app).get('/ping');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle CORS for cross-origin requests', async () => {
      const response = await request(app)
        .get('/ping')
        .set('Origin', 'http://localhost:19000'); // Expo dev server

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Discovery timeout', () => {
    it('should handle request timeout gracefully', async () => {
      // Test with a non-existent endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100);

      try {
        await fetch('http://localhost:99999/ping', {
          signal: controller.signal,
        });
      } catch (error: any) {
        expect(['AbortError', 'TypeError'].includes(error.name)).toBe(true);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  });
});
