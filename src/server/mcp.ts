import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { LogEntry } from '../shared/protocol.js';
import { type Bridge } from './bridge.js';
import { LEVEL_RANK, type Screenshot, type Store } from './store.js';

const CAPTURE_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 10_000;

const describeShot = (shot: Screenshot) =>
  [
    `Screenshot ${shot.id}`,
    shot.description ? `"${shot.description}"` : null,
    shot.trigger === 'manual'
      ? 'taken on the device'
      : 'requested by the agent',
    new Date(shot.timestamp).toLocaleString(),
    shot.width && shot.height ? `${shot.width}x${shot.height}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

const formatLog = (entry: LogEntry) =>
  `${new Date(entry.timestamp).toISOString().slice(11, 23)} ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`;

const failure = (error: unknown): CallToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: error instanceof Error ? error.message : String(error),
    },
  ],
});

const shotSummary = z.object({
  id: z.string(),
  timestamp: z.number(),
  description: z.string().optional(),
  trigger: z.enum(['agent', 'manual']),
  mimeType: z.string(),
  path: z.string(),
});

export function createMcpServer(
  store: Store,
  bridge: Bridge,
  version: string
): McpServer {
  const server = new McpServer(
    { name: 'exposnap', title: 'ExpoSnap', version },
    {
      capabilities: { logging: {} },
      instructions:
        'ExpoSnap sees and drives a running React Native or Expo app on a real phone, simulator or web. ' +
        'After changing UI code, call take_screenshot to check the result on the device instead of guessing. ' +
        'Use get_logs to read console output and errors from the app, open_url to go to a screen, and reload_app after native or config changes.',
    }
  );

  const imageResult = async (
    shot: Screenshot,
    lead?: string
  ): Promise<CallToolResult> => ({
    content: [
      {
        type: 'text',
        text: [lead, describeShot(shot)].filter(Boolean).join('\n'),
      },
      {
        type: 'image',
        data: await store.readImage(shot),
        mimeType: shot.mimeType,
      },
    ],
  });

  server.registerTool(
    'take_screenshot',
    {
      title: 'Take screenshot',
      description:
        'Capture the app as it looks on the device right now and return the image. Use after a UI change to verify it, or to see the current screen before changing it.',
      inputSchema: {
        description: z
          .string()
          .max(200)
          .optional()
          .describe(
            'A note stored with the screenshot, e.g. "settings after the spacing fix"'
          ),
        format: z
          .enum(['png', 'jpg'])
          .default('png')
          .describe('png keeps text crisp; jpg is smaller'),
        maxDimension: z
          .number()
          .int()
          .min(320)
          .max(4096)
          .default(1568)
          .describe(
            'Longest edge in pixels. 1568 matches what vision models read at full detail.'
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ description, format, maxDimension }) => {
      try {
        const shot = await bridge.request<Screenshot>(
          { type: 'capture', options: { description, format, maxDimension } },
          CAPTURE_TIMEOUT_MS
        );
        return imageResult(shot);
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    'get_latest_screenshot',
    {
      title: 'Get latest screenshot',
      description:
        'Return the most recent screenshot without taking a new one, including ones taken by tapping the camera button on the device.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const shot = store.latestScreenshot();
      if (!shot) {
        return {
          content: [
            {
              type: 'text',
              text: 'No screenshots yet. Call take_screenshot, or tap the camera button in the app.',
            },
          ],
        };
      }
      return imageResult(shot);
    }
  );

  server.registerTool(
    'get_screenshot',
    {
      title: 'Get screenshot',
      description:
        'Return one earlier screenshot by its id (from list_screenshots), e.g. to compare before and after.',
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const shot = store.findScreenshot(id);
      return shot
        ? imageResult(shot)
        : failure(
            `No screenshot with id ${id}. list_screenshots shows the ones kept.`
          );
    }
  );

  server.registerTool(
    'list_screenshots',
    {
      title: 'List screenshots',
      description:
        'List kept screenshots, newest first, with ids, times and notes.',
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
      outputSchema: { screenshots: z.array(shotSummary) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      const shots = store.listScreenshots(limit);
      const screenshots = shots.map(shot => ({
        id: shot.id,
        timestamp: shot.timestamp,
        description: shot.description,
        trigger: shot.trigger,
        mimeType: shot.mimeType,
        path: store.pathOf(shot),
      }));
      return {
        structuredContent: { screenshots },
        content: [
          {
            type: 'text',
            text: shots.length
              ? shots
                  .map((shot, i) => `${i + 1}. ${describeShot(shot)}`)
                  .join('\n')
              : 'No screenshots yet.',
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_logs',
    {
      title: 'Get app logs',
      description:
        "Read the app's recent console output (console.log, warn, error) and uncaught errors, oldest first. Filter by level or text.",
      inputSchema: {
        level: z
          .enum(['debug', 'log', 'info', 'warn', 'error'])
          .default('log')
          .describe('Minimum level to include'),
        search: z
          .string()
          .optional()
          .describe('Only lines containing this text (case-insensitive)'),
        sinceSeconds: z
          .number()
          .positive()
          .optional()
          .describe('Only the last N seconds'),
        limit: z.number().int().min(1).max(1000).default(100),
        clear: z
          .boolean()
          .default(false)
          .describe(
            'Empty the buffer after reading, so the next call shows only new output'
          ),
      },
      outputSchema: {
        logs: z.array(
          z.object({
            level: z.string(),
            message: z.string(),
            timestamp: z.number(),
          })
        ),
        total: z.number(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ level, search, sinceSeconds, limit, clear }) => {
      const logs = store.queryLogs({
        minLevel: level,
        search,
        limit,
        since: sinceSeconds ? Date.now() - sinceSeconds * 1000 : undefined,
      });
      const total = store.logCount;
      if (clear) store.clearLogs();
      const empty = bridge.connected
        ? 'No matching log lines.'
        : 'No matching log lines, and no app is connected right now.';
      return {
        structuredContent: { logs, total },
        content: [
          {
            type: 'text',
            text: logs.length ? logs.map(formatLog).join('\n') : empty,
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_app_status',
    {
      title: 'Get app status',
      description:
        'Whether an app is connected, and the device it runs on (platform, OS, screen size, color scheme).',
      outputSchema: {
        connected: z.boolean(),
        lastSeen: z.number().nullable(),
        device: z.record(z.string(), z.unknown()).nullable(),
        screenshots: z.number(),
        logLines: z.number(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const status = {
        connected: bridge.connected,
        lastSeen: bridge.lastSeenAt,
        device: (bridge.device as Record<string, unknown> | null) ?? null,
        screenshots: store.listScreenshots().length,
        logLines: store.logCount,
      };
      return {
        structuredContent: status,
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    }
  );

  server.registerTool(
    'open_url',
    {
      title: 'Open URL or route',
      description:
        'Navigate the app: a deep link (myapp://settings), a web URL, or an Expo Router path such as /settings or /(tabs)/profile.',
      inputSchema: { url: z.string().min(1) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ url }) => {
      try {
        await bridge.request({ type: 'open_url', url }, COMMAND_TIMEOUT_MS);
        return {
          content: [
            {
              type: 'text',
              text: `Opened ${url}. Call take_screenshot to see it.`,
            },
          ],
        };
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    'reload_app',
    {
      title: 'Reload app',
      description:
        'Reload the JavaScript bundle, as pressing r in the Expo CLI does. Logs and navigation state reset.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        await bridge.request({ type: 'reload' }, COMMAND_TIMEOUT_MS);
        return {
          content: [
            {
              type: 'text',
              text: 'Reloading. The app reconnects in a few seconds.',
            },
          ],
        };
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerResource(
    'screenshot',
    new ResourceTemplate('exposnap://screenshots/{id}', {
      list: async () => ({
        resources: store.listScreenshots().map(shot => ({
          uri: `exposnap://screenshots/${shot.id}`,
          name: shot.id,
          title: shot.description ?? new Date(shot.timestamp).toLocaleString(),
          mimeType: shot.mimeType,
        })),
      }),
    }),
    {
      title: 'Screenshots',
      description: 'Screenshots of the app, newest first',
      mimeType: 'image/png',
    },
    async (uri, { id }) => {
      const shot = store.findScreenshot(String(id));
      if (!shot) throw new Error(`No screenshot with id ${id}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: shot.mimeType,
            blob: await store.readImage(shot),
          },
        ],
      };
    }
  );

  server.registerResource(
    'logs',
    'exposnap://logs',
    {
      title: 'App logs',
      description: "The app's recent console output",
      mimeType: 'text/plain',
    },
    async uri => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/plain',
          text: store.queryLogs({ limit: 1000 }).map(formatLog).join('\n'),
        },
      ],
    })
  );

  server.registerPrompt(
    'review_screen',
    {
      title: 'Review this screen',
      description:
        'Capture the current screen and review its layout, spacing, contrast and copy.',
      argsSchema: {
        focus: z
          .string()
          .optional()
          .describe('What to pay attention to, e.g. "the checkout button"'),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              'Call take_screenshot, then review the screen as a senior mobile designer: alignment, spacing rhythm, ' +
              'type hierarchy, contrast, touch target size, truncated or overlapping text, and anything that looks unfinished. ' +
              (focus ? `Pay particular attention to ${focus}. ` : '') +
              'List concrete problems with where they are, then fix them in the code and take another screenshot to confirm.',
          },
        },
      ],
    })
  );

  // A new screenshot changes the resource list; errors from the app are worth
  // surfacing as they happen, not only when the agent thinks to ask.
  store.on('screenshot', () => server.sendResourceListChanged());
  store.on('log', entry => {
    if (LEVEL_RANK[entry.level] < LEVEL_RANK.error || !server.isConnected())
      return;
    server
      .sendLoggingMessage({
        level: 'error',
        logger: 'app',
        data: entry.message,
      })
      .catch(() => undefined);
  });

  return server;
}
