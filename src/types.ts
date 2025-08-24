// Types for ExpoSnap

export interface Screenshot {
  id: string;
  timestamp: number;
  source: 'expo';
  filename: string;
  description?: string;
}

export interface ScreenshotRequest {
  description?: string;
  timestamp: number;
}

export interface ScreenshotResponse {
  success: boolean;
  message: string;
  path?: string;
  id?: string;
}
