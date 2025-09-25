export const TOOL_SCHEMAS = [
  {
    name: 'get_latest_screenshot',
    description: 'Get the most recent Expo screenshot without taking a new one',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_screenshots',
    description:
      'List recent Expo screenshots with timestamps and descriptions',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of screenshots to return (default: 10)',
          minimum: 1,
          maximum: 50,
        },
      },
      additionalProperties: false,
    },
  },
] as const;
