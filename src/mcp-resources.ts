import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import fs from 'fs/promises';
import {
  getAllScreenshots,
  findScreenshot,
  getScreenshotPath,
} from './storage.js';

export function setupResourceHandlers(server: Server) {
  // Handle resource listing - show recent screenshots as browsable resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const screenshots = getAllScreenshots();
    return {
      resources: screenshots.slice(0, 20).map(s => ({
        uri: `screenshot://${s.id}`,
        name: `Screenshot - ${new Date(s.timestamp).toLocaleString()}`,
        description:
          s.description ||
          `Expo screenshot from ${new Date(s.timestamp).toLocaleTimeString()}`,
        mimeType: 'image/png',
      })),
    };
  });

  // Handle resource reading - return screenshot content
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const uri = request.params.uri;
    const id = uri.replace('screenshot://', '');

    const screenshot = findScreenshot(id);
    if (!screenshot) {
      throw new Error(`Screenshot not found: ${id}`);
    }

    const imagePath = getScreenshotPath(screenshot.filename);
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString('base64');

    return {
      contents: [
        {
          uri,
          mimeType: 'image/png',
          blob: base64,
        },
      ],
    };
  });
}
