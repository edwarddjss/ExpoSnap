import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';
import { addScreenshot, getScreenshotPath } from './storage.js';
import { generateScreenshotId, notifyNewScreenshot } from './utils.js';
import {
  getLatestPendingRequest,
  completeScreenshotRequest,
} from './screenshot-requests.js';

export function createHttpServer() {
  const app = express();

  // CORS middleware for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use(express.json());

  // Auto-discovery ping endpoint
  app.get('/ping', (req: Request, res: Response) => {
    // Get the actual port from the server instance
    const actualPort = req.socket.localPort || CONFIG.HTTP_PORT;

    res.json({
      name: 'exposnap-mcp-server',
      service: 'exposnap',
      version: CONFIG.SERVER_VERSION,
      status: 'ready',
      port: actualPort,
    });
  });

  // Discovery endpoint that also logs the connection
  app.get('/discover', (req: Request, res: Response) => {
    const actualPort = req.socket.localPort || CONFIG.HTTP_PORT;
    console.log(`[ExpoSnap] Discovery request from ${req.ip}`);

    res.json({
      name: 'exposnap-mcp-server',
      service: 'exposnap',
      version: CONFIG.SERVER_VERSION,
      status: 'ready',
      port: actualPort,
      timestamp: Date.now(),
    });
  });

  // Screenshot request polling endpoint for mobile app
  app.get('/screenshot-request', (req: Request, res: Response) => {
    const pendingRequest = getLatestPendingRequest();
    res.json({
      requested: !!pendingRequest,
      id: pendingRequest?.id,
      description: pendingRequest?.description,
    });
  });

  // Screenshot request completion endpoint
  app.post('/screenshot-completed', (req: Request, res: Response) => {
    const { requestId } = req.body;
    if (requestId) {
      completeScreenshotRequest(requestId);
    }
    res.json({ success: true });
  });

  // Configure multer for file uploads
  const upload = multer({
    dest: CONFIG.SCREENSHOTS_DIR,
  });

  app.post(
    '/screenshot',
    upload.single('screenshot'),
    async (req: Request, res: Response) => {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No image provided' });
      }

      // Generate unique filename
      const id = generateScreenshotId();
      const ext = path.extname(file.originalname) || '.png';
      const newFilename = `${id}${ext}`;
      const newPath = getScreenshotPath(newFilename);

      await fs.rename(file.path, newPath);

      const rawDescription =
        typeof req.body?.description === 'string'
          ? req.body.description.trim()
          : '';
      const description =
        rawDescription.length > 0 ? rawDescription : undefined;

      await addScreenshot({
        id,
        timestamp: Date.now(),
        source: 'expo',
        filename: newFilename,
        description,
      });

      // Notify that new screenshot is available
      notifyNewScreenshot(newPath);

      res.json({ success: true, path: newPath, id });
    }
  );

  return app;
}

async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = (server.address() as { port: number })?.port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is in use, try next one
      findAvailablePort(startPort + 1)
        .then(resolve)
        .catch(reject);
    });
  });
}

export async function startHttpServer(): Promise<number> {
  const app = createHttpServer();

  // If port is 0, use dynamic allocation
  // Otherwise start from configured port and auto-increment if needed
  const requestedPort = CONFIG.HTTP_PORT;
  const port = requestedPort === 0 ? 0 : await findAvailablePort(requestedPort);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err?: Error) => {
      if (err) {
        console.error(`[ExpoSnap] Failed to start HTTP server:`, err);
        reject(err);
        return;
      }

      const actualPort =
        (server.address() as { port: number } | null)?.port || port;
      console.log(`[ExpoSnap] HTTP server running on port ${actualPort}`);
      resolve(actualPort);
    });

    server.on('error', (err: Error) => {
      console.error(`[ExpoSnap] HTTP server error:`, err);
      reject(err);
    });
  });
}
