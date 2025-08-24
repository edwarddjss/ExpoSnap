export const TOOL_SCHEMAS = [
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current Expo app screen',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description:
            'Optional description of what to capture (e.g., "login screen", "user profile")',
        },
      },
      additionalProperties: false,
    },
  },
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
