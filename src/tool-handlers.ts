import fs from 'fs/promises';
import {
  getLatestScreenshot,
  getAllScreenshots,
  getScreenshotPath,
} from './storage.js';

export async function handleGetLatestScreenshot() {
  try {
    const screenshot = getLatestScreenshot();

    if (!screenshot) {
      return {
        content: [
          {
            type: 'text',
            text: 'No screenshots available.',
          },
        ],
      };
    }

    const imageData = await fs.readFile(getScreenshotPath(screenshot.filename));
    const base64 = imageData.toString('base64');

    return {
      content: [
        {
          type: 'text',
          text: `Latest screenshot${screenshot.description ? ` - ${screenshot.description}` : ''} (${new Date(screenshot.timestamp).toLocaleString()})`,
        },
        {
          type: 'image',
          data: base64,
          mimeType: 'image/png',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to get latest screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
}

export async function handleListScreenshots(limit: number = 10) {
  try {
    const screenshots = getAllScreenshots().slice(0, limit);

    if (screenshots.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No screenshots available.',
          },
        ],
      };
    }

    const screenshotList = screenshots
      .map((screenshot, index) => {
        const date = new Date(screenshot.timestamp).toLocaleString();
        const description = screenshot.description
          ? ` - ${screenshot.description}`
          : '';
        return `${index + 1}. ${screenshot.filename} (${date})${description}`;
      })
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Recent screenshots (${screenshots.length} total):\n\n${screenshotList}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to list screenshots: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
}
