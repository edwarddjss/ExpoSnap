 ExpoSnap Auto-Capture Implementation Plan

  Current Architecture Analysis

  Existing Components:

  HTTP Server (src/http-server.ts)

  - ✅ /ping - Auto-discovery endpoint
  - ✅ /discover - Discovery with logging
  - ✅ /screenshot - Upload endpoint (POST)
  - ❌ Missing: Screenshot request endpoints

  MCP Tools (src/mcp-tools.ts)

  - ✅ screenshot - Broken (only logs)
  - ✅ get_latest_screenshot - Works
  - ✅ list_screenshots - Works

  Tool Handlers (src/tool-handlers.ts)

  - ✅ handleScreenshot() - Calls requestScreenshot() (broken)
  - ✅ handleGetLatestScreenshot() - Works
  - ✅ handleListScreenshots() - Works

  Mobile App Components:

  - ✅ ScreenshotWrapper - Simplified (no UI)
  - ✅ useConnection - Auto-discovery works
  - ✅ useScreenshotCapture - Manual capture works
  - ❌ Missing: Auto-capture polling logic

  ---
  Implementation Plan

  Phase 1: Server-Side Screenshot Request System

  1.1 Add Screenshot Request State Management

  File: src/screenshot-requests.ts (new file)
  interface ScreenshotRequest {
    id: string;
    timestamp: number;
    description?: string;
    status: 'pending' | 'captured' | 'timeout';
  }

  let pendingRequests: ScreenshotRequest[] = [];

  export function createScreenshotRequest(description?: string): string
  export function getScreenshotRequest(id: string): ScreenshotRequest | null
  export function completeScreenshotRequest(id: string): void
  export function cleanupExpiredRequests(): void

  1.2 Add HTTP Endpoints

  File: src/http-server.ts
  Add these endpoints:
  // Check for screenshot requests (mobile app polls this)
  app.get('/screenshot-request', (req, res) => {
    const pendingRequest = getLatestPendingRequest();
    res.json({
      requested: !!pendingRequest,
      id: pendingRequest?.id,
      description: pendingRequest?.description
    });
  });

  // Mark screenshot request as completed
  app.post('/screenshot-completed', (req, res) => {
    const { requestId } = req.body;
    completeScreenshotRequest(requestId);
    res.json({ success: true });
  });

  1.3 Fix MCP Tool Handler

  File: src/utils.ts
  Replace broken requestScreenshot():
  export async function requestScreenshot(description?: string): Promise<string> {
    return createScreenshotRequest(description);
  }

  File: src/tool-handlers.ts
  Update handleScreenshot():
  export async function handleScreenshot(description?: string) {
    const requestId = await requestScreenshot(description);
    const screenshot = await waitForNewScreenshot(15000); // 15 second timeout

    if (screenshot) {
      completeScreenshotRequest(requestId);
      // Return screenshot as before
    } else {
      return { content: [{ type: 'text', text: 'Screenshot request timeout - ensure
  app is active' }] };
    }
  }

  ---
  Phase 2: Mobile App Auto-Capture System

  2.1 Create Auto-Capture Hook

  File: src/hooks/useAutoCapture.ts (new file)
  export interface AutoCaptureConfig {
    serverUrl: string;
    pollInterval: number;
    enabled: boolean;
  }

  export function useAutoCapture(
    config: AutoCaptureConfig,
    captureFunction: () => Promise<boolean>
  ) {
    // Smart polling with exponential backoff
    // Handle screenshot requests automatically
    // Return status and control functions
  }

  2.2 Update ScreenshotWrapper

  File: src/ScreenshotWrapper.tsx
  export function ScreenshotWrapper({ children }: ScreenshotWrapperProps) {
    const viewRef = useRef<View>(null);
    const connection = useConnection();
    const screenshot = useScreenshotCapture(connection.url);

    // Auto-capture system
    useAutoCapture(
      {
        serverUrl: connection.url,
        pollInterval: 3000,
        enabled: connection.isConnected
      },
      () => screenshot.captureAndUpload(viewRef)
    );

    return (
      <View style={{ flex: 1 }} ref={viewRef} collapsable={false}>
        {children}
      </View>
    );
  }

  2.3 Enhance Screenshot Capture Hook

  File: src/hooks/useScreenshotCapture.ts
  Add silent capture mode:
  const captureAndUploadSilent = useCallback(async (viewRef, requestId?: string) => {
    // Same logic but no alerts
    // Include requestId in upload
  }, [serverUrl]);

  ---
  Phase 3: Integration and Optimization

  3.1 Smart Polling Strategy

  // Adaptive polling intervals:
  // - 1 second when recently active
  // - 3 seconds normal operation
  // - 5 seconds when idle
  // - 10 seconds on repeated errors

  3.2 Error Handling

  - Network failures → exponential backoff
  - Server unavailable → maintain connection state
  - App backgrounded → pause polling
  - App foregrounded → immediate check

  3.3 Performance Optimizations

  - Cleanup expired requests (server)
  - Debounce rapid polling (mobile)
  - Memory management for request history

  ---
  File Changes Summary

  New Files:

  - src/screenshot-requests.ts - Request state management
  - src/hooks/useAutoCapture.ts - Polling logic

  Modified Files:

  - src/http-server.ts - Add request endpoints
  - src/utils.ts - Fix requestScreenshot()
  - src/tool-handlers.ts - Update handleScreenshot()
  - src/ScreenshotWrapper.tsx - Add auto-capture
  - src/hooks/useScreenshotCapture.ts - Add silent mode

  Dependencies:

  - No new external dependencies required
  - Uses existing React Native APIs
  - Leverages current HTTP server setup

  ---
  Testing Strategy

  Development Testing:

  1. Manual MCP tool call → Should trigger mobile capture
  2. App backgrounded → Polling should pause
  3. Network interruption → Should recover gracefully
  4. Multiple rapid requests → Should handle properly

  Edge Cases:

  - App not active during request
  - Network timeout during capture
  - Server restart mid-request
  - Multiple screenshot tools called quickly

  ---
  Success Criteria

  ✅ Claude says "take screenshot" → Mobile app captures within 5 seconds✅ App 
  backgrounded → No unnecessary network calls✅ Network issues → Graceful degradation
   and recovery✅ Battery efficient → Adaptive polling intervals✅ Zero user 
  interaction → Completely invisible operation

  This implementation maintains the existing architecture while adding the missing
  auto-capture functionality through a clean, efficient polling system.