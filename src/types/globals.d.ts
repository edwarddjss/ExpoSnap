// Global type definitions for React Native environment

declare global {
  interface NodeJS {
    Timeout: number;
  }

  // Browser/React Native globals that ESLint doesn't recognize
  const fetch: typeof globalThis.fetch;
  const FormData: typeof globalThis.FormData;
  const AbortController: typeof globalThis.AbortController;
  const setTimeout: typeof globalThis.setTimeout;
  const clearTimeout: typeof globalThis.clearTimeout;
  const setInterval: typeof globalThis.setInterval;
  const clearInterval: typeof globalThis.clearInterval;
}

export {};
