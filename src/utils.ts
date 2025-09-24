import { EventEmitter } from 'node:events';
import { setTimeout, clearTimeout } from 'node:timers';
import { createScreenshotRequest } from './screenshot-requests.js';

// Event emitter for screenshot notifications
class ScreenshotNotifier extends EventEmitter {}
const screenshotNotifier = new ScreenshotNotifier();

export function generateScreenshotId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function requestScreenshot(description?: string): Promise<string> {
  const requestId = createScreenshotRequest(description);
  console.log(
    `[ExpoSnap] Screenshot requested${description ? ` - ${description}` : ''} (ID: ${requestId})`
  );
  return requestId;
}

export function notifyNewScreenshot(screenshotPath: string): void {
  console.log(`[ExpoSnap] New screenshot saved: ${screenshotPath}`);
  screenshotNotifier.emit('screenshot', { path: screenshotPath });
}

export async function waitForNewScreenshot(
  timeoutMs: number = 10000
): Promise<{ path: string } | null> {
  return new Promise(resolve => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const onScreenshot = (screenshot: { path: string }) => {
      clearTimeout(timeoutId);
      screenshotNotifier.off('screenshot', onScreenshot);
      resolve(screenshot);
    };

    timeoutId = setTimeout(() => {
      screenshotNotifier.off('screenshot', onScreenshot);
      resolve(null);
    }, timeoutMs);

    screenshotNotifier.on('screenshot', onScreenshot);
  });
}
