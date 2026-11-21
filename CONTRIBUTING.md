# Contributing

```bash
git clone https://github.com/edwarddjss/ExpoSnap.git
cd ExpoSnap
npm install
npm test
```

## Layout

| Path         | What it is                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `src/server` | The MCP server (`npx exposnap`): tools, the HTTP bridge the app calls, screenshot and log store |
| `src/client` | The React Native wrapper apps install                                                           |
| `src/shared` | The wire protocol both sides import                                                             |
| `tests`      | Unit tests, and end-to-end tests that run a real MCP client against the real server             |

`src/client/session.ts` holds the app's connection logic with no React Native imports, so the end-to-end tests run it in Node against the real server.

## Trying a change

- `npm run inspect` opens the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against your build.
- To test in an app: `npm run build && npm pack`, then in the app `npm install ../ExpoSnap/exposnap-<version>.tgz`. A packed tarball behaves like the published package; `npm link` does not play well with Metro.

## Before opening a pull request

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

Add a test for a new tool or a fixed bug.
