export function generateScreenshotId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function notifyNewScreenshot(screenshotPath: string): void {
  console.error(`[ExpoSnap] New screenshot saved: ${screenshotPath}`);
}
