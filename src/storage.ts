import fs from 'fs/promises';
import { Screenshot } from './types.js';
import { CONFIG } from './config.js';

let screenshots: Screenshot[] = [];

export async function initializeStorage() {
  await fs.mkdir(CONFIG.SCREENSHOTS_DIR, { recursive: true });
  await loadExistingScreenshots();
}

async function loadExistingScreenshots() {
  try {
    const files = await fs.readdir(CONFIG.SCREENSHOTS_DIR);
    for (const file of files) {
      if (
        file.endsWith('.png') ||
        file.endsWith('.jpg') ||
        file.endsWith('.jpeg')
      ) {
        // Simple metadata from filename and file stats
        const stats = await fs.stat(getScreenshotPath(file));
        const id = file.replace(/\.[^/.]+$/, ''); // Remove extension

        const screenshot: Screenshot = {
          id,
          timestamp: stats.mtime.getTime(),
          source: 'expo',
          filename: file,
        };

        screenshots.push(screenshot);
      }
    }

    // Sort by timestamp, newest first
    screenshots.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`[ExpoSnap] Loaded ${screenshots.length} existing screenshots`);
  } catch {
    console.log('[ExpoSnap] No existing screenshots found');
  }
}

export function getAllScreenshots(): Screenshot[] {
  return [...screenshots]; // Return copy to prevent mutation
}

export function getLatestScreenshot(): Screenshot | null {
  return screenshots.length > 0 ? screenshots[0] : null;
}

export function findScreenshot(id: string): Screenshot | null {
  return screenshots.find(s => s.id === id) || null;
}

export async function addScreenshot(screenshot: Screenshot): Promise<void> {
  screenshots.unshift(screenshot); // Add to beginning (newest first)

  // Keep only last 50 screenshots to prevent infinite growth
  if (screenshots.length > 50) {
    const toRemove = screenshots.splice(50);
    // Clean up old files
    for (const old of toRemove) {
      try {
        await fs.unlink(getScreenshotPath(old.filename));
      } catch {
        // File might already be deleted
      }
    }
  }

  console.log(`[ExpoSnap] Added screenshot: ${screenshot.id}`);
}

export function getScreenshotPath(filename: string): string {
  return `${CONFIG.SCREENSHOTS_DIR}/${filename}`;
}
