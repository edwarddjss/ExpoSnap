import fs from 'fs/promises';
import { requestScreenshot, waitForNewScreenshot } from './utils.js';

export async function handleScreenshot(description?: string) {
  try {
    await requestScreenshot(description);

    const screenshot = await waitForNewScreenshot(10000);

    if (!screenshot) {
      return {
        content: [
          {
            type: 'text',
            text: 'Screenshot request sent, but no new screenshot received within timeout.',
          },
        ],
      };
    }

    const imageData = await fs.readFile(screenshot.path);
    const base64 = imageData.toString('base64');

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot captured${description ? ` - ${description}` : ''}`,
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
          text: `Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
}
