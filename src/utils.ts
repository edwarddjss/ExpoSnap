import { EventEmitter } from 'node:events';
import { setTimeout, clearTimeout } from 'node:timers';

// Event emitter for screenshot notifications
class ScreenshotNotifier extends EventEmitter {}
const screenshotNotifier = new ScreenshotNotifier();

export function generateScreenshotId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Simple screenshot notification system
const pendingCallbacks = new Map<
  string,
  {
    resolve: (screenshot: { path: string } | null) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }
>();

export async function requestScreenshot(description?: string): Promise<void> {
  console.log(
    `[ExpoSnap] Screenshot requested${description ? ` - ${description}` : ''}`
  );
}

export function notifyNewScreenshot(screenshotPath: string): void {
  console.log(`[ExpoSnap] New screenshot saved: ${screenshotPath}`);
  screenshotNotifier.emit('screenshot', { path: screenshotPath });
}

export async function waitForNewScreenshot(
  timeoutMs: number = 10000
): Promise<{ path: string } | null> {
  const callbackId = generateScreenshotId();

  return new Promise(resolve => {
    const timeoutId = setTimeout(() => {
      pendingCallbacks.delete(callbackId);
      resolve(null);
    }, timeoutMs);

    pendingCallbacks.set(callbackId, { resolve, timeoutId });

    const onScreenshot = (screenshot: { path: string }) => {
      const callback = pendingCallbacks.get(callbackId);
      if (callback) {
        clearTimeout(callback.timeoutId);
        pendingCallbacks.delete(callbackId);
        screenshotNotifier.off('screenshot', onScreenshot);
        resolve(screenshot);
      }
    };

    screenshotNotifier.on('screenshot', onScreenshot);
  });
}
