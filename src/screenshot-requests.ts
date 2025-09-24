import { setTimeout, setInterval } from 'node:timers';

export interface ScreenshotRequest {
  id: string;
  timestamp: number;
  description?: string;
  status: 'pending' | 'captured' | 'timeout';
}

let pendingRequests: ScreenshotRequest[] = [];

export function createScreenshotRequest(description?: string): string {
  const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const request: ScreenshotRequest = {
    id,
    timestamp: Date.now(),
    description,
    status: 'pending',
  };

  pendingRequests.push(request);

  // Auto-cleanup after 30 seconds
  setTimeout(() => {
    timeoutScreenshotRequest(id);
  }, 30000);

  return id;
}

export function getScreenshotRequest(id: string): ScreenshotRequest | null {
  return pendingRequests.find(req => req.id === id) || null;
}

export function getLatestPendingRequest(): ScreenshotRequest | null {
  const pending = pendingRequests
    .filter(req => req.status === 'pending')
    .sort((a, b) => b.timestamp - a.timestamp);

  return pending[0] || null;
}

export function completeScreenshotRequest(id: string): void {
  const request = pendingRequests.find(req => req.id === id);
  if (request) {
    request.status = 'captured';
  }
}

export function timeoutScreenshotRequest(id: string): void {
  const request = pendingRequests.find(req => req.id === id);
  if (request && request.status === 'pending') {
    request.status = 'timeout';
  }
}

export function cleanupExpiredRequests(): void {
  const now = Date.now();
  const maxAge = 60000; // 1 minute

  pendingRequests = pendingRequests.filter(req => {
    return now - req.timestamp < maxAge;
  });
}

// Cleanup expired requests every 30 seconds
setInterval(cleanupExpiredRequests, 30000);
