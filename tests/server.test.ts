import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test constants
const TEST_SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Mock app setup for testing
let app: express.Application;

describe('ExpoSnap HTTP Server', () => {
  beforeAll(async () => {
    // Create test screenshots directory
    await fs.mkdir(TEST_SCREENSHOTS_DIR, { recursive: true });

    // Setup test app
    app = express();
    const upload = multer({ dest: TEST_SCREENSHOTS_DIR });
    app.use(express.json());

    // CORS
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

    // Ping endpoint
    app.get('/ping', (req, res) => {
      res.json({
        service: 'exposnap',
        version: '1.1.0',
        status: 'ready',
        port: 3333,
      });
    });

    // Screenshot endpoint
    app.post('/screenshot', upload.single('screenshot'), async (req, res) => {
      try {
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: 'No image provided' });
        }

        const id = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = path.extname(file.originalname) || '.png';
        const newFilename = `${id}${ext}`;
        const newPath = path.join(TEST_SCREENSHOTS_DIR, newFilename);

        await fs.rename(file.path, newPath);
        res.json({ success: true, path: newPath });
      } catch (error) {
        res.status(500).json({ error: 'Failed to save screenshot' });
      }
    });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(TEST_SCREENSHOTS_DIR);
      await Promise.all(
        files.map(file => fs.unlink(path.join(TEST_SCREENSHOTS_DIR, file)))
      );
      await fs.rmdir(TEST_SCREENSHOTS_DIR);
    } catch (error) {
      // Directory might not exist or already be empty
    }
  });

  describe('GET /ping', () => {
    it('should respond with server info', async () => {
      const response = await request(app).get('/ping').expect(200);

      expect(response.body).toEqual({
        service: 'exposnap',
        version: '1.1.0',
        status: 'ready',
        port: 3333,
      });
    });
  });

  describe('POST /screenshot', () => {
    it('should reject requests without file', async () => {
      const response = await request(app).post('/screenshot');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No image provided');
    });

    it('should accept valid image upload', async () => {
      // Create a mock image file
      const testImagePath = path.join(__dirname, 'test-image.png');
      await fs.writeFile(testImagePath, Buffer.from('fake-png-data'));

      try {
        const response = await request(app)
          .post('/screenshot')
          .attach('screenshot', testImagePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.path).toBeDefined();
        expect(typeof response.body.path).toBe('string');
      } finally {
        await fs.unlink(testImagePath).catch(() => {});
      }
    });

    it('should save files correctly', async () => {
      const testImagePath = path.join(__dirname, 'test-image.png');
      await fs.writeFile(testImagePath, Buffer.from('fake-png-data'));

      try {
        const response = await request(app)
          .post('/screenshot')
          .attach('screenshot', testImagePath);

        const { path: savedPath } = response.body;

        // Check that the image file exists at the returned path
        const imageExists = await fs
          .access(savedPath)
          .then(() => true)
          .catch(() => false);
        expect(imageExists).toBe(true);

        // Verify the content
        const savedContent = await fs.readFile(savedPath);
        expect(savedContent.toString()).toBe('fake-png-data');
      } finally {
        await fs.unlink(testImagePath).catch(() => {});
      }
    });
  });
});
