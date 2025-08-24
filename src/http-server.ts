import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';
import { getScreenshotPath } from './storage.js';
import { generateScreenshotId, notifyNewScreenshot } from './utils.js';

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
    res.json({
      service: 'exposnap',
      version: '1.1.0',
      status: 'ready',
      port: CONFIG.HTTP_PORT,
    });
  });

  return app;
}

const app = createHttpServer();

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

    // Notify that new screenshot is available
    notifyNewScreenshot(newPath);

    res.json({ success: true, path: newPath });
  }
);

export function startHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(CONFIG.HTTP_PORT, (err?: Error) => {
      if (err) {
        console.error(`[ExpoSnap] Failed to start HTTP server:`, err);
        reject(err);
        return;
      }
      console.log(`[ExpoSnap] HTTP server running on port ${CONFIG.HTTP_PORT}`);
      resolve();
    });

    server.on('error', (err: Error) => {
      if ('code' in err && (err as { code: string }).code === 'EADDRINUSE') {
        console.error(
          `[ExpoSnap] Port ${CONFIG.HTTP_PORT} is already in use. Set EXPOSNAP_PORT environment variable to use a different port.`
        );
      } else {
        console.error(`[ExpoSnap] HTTP server error:`, err);
      }
      reject(err);
    });
  });
}
