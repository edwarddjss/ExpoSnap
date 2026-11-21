<div align="center">
  <img src="assets/ExpoSnap_MCP_Logo.png" alt="ExpoSnap" width="200"/>

  <h1>ExpoSnap</h1>

  <p><strong>Let your AI assistant see and drive your React Native app, on your real phone.</strong></p>

[![npm](https://img.shields.io/npm/v/exposnap.svg)](https://www.npmjs.com/package/exposnap)
[![downloads](https://img.shields.io/npm/dm/exposnap.svg)](https://www.npmjs.com/package/exposnap)
[![CI](https://github.com/edwarddjss/ExpoSnap/actions/workflows/ci.yml/badge.svg)](https://github.com/edwarddjss/ExpoSnap/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/exposnap.svg)](LICENSE)

</div>

Your assistant changes a screen, then calls `take_screenshot` and looks at the result on the device, reads the app's console errors, opens the next route, and keeps going. No copying screenshots into the chat, no describing what you see.

ExpoSnap is an [MCP](https://modelcontextprotocol.io) server plus a small wrapper for your app. It works with Claude Code, Cursor, VS Code, Windsurf, Claude Desktop and any other MCP client.

## Why ExpoSnap

- **Your real phone.** The capture happens inside your app, so it works on a physical iPhone or Android in Expo Go or a development build, not only in a simulator.
- **Any computer.** Windows and Linux work as well as a Mac. No Xcode, no adb, no simulator tooling.
- **iOS, Android and web** from one wrapper.
- **More than pictures.** Console output and uncaught errors, navigation by route, and reloads.
- **Nothing in production.** The wrapper only does anything in development builds.

## Setup

**1. Add the server to your editor**

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add exposnap -- npx -y exposnap
```

</details>

<details>
<summary><strong>Cursor</strong> (<code>.cursor/mcp.json</code>)</summary>

```json
{
  "mcpServers": {
    "exposnap": { "command": "npx", "args": ["-y", "exposnap"] }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong> (<code>.vscode/mcp.json</code>)</summary>

```json
{
  "servers": {
    "exposnap": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "exposnap"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf, Claude Desktop and others</strong></summary>

Add a stdio server that runs `npx -y exposnap`:

```json
{
  "mcpServers": {
    "exposnap": { "command": "npx", "args": ["-y", "exposnap"] }
  }
}
```

</details>

**2. Install it in your app**

```bash
npx expo install exposnap react-native-view-shot
```

**3. Wrap your app**

With Expo Router, in `app/_layout.tsx`:

```tsx
import { Stack, router } from 'expo-router';
import { ScreenshotWrapper } from 'exposnap';

export default function RootLayout() {
  return (
    <ScreenshotWrapper navigate={path => router.push(path)}>
      <Stack />
    </ScreenshotWrapper>
  );
}
```

Without a router, wrap whatever your root component returns:

```tsx
import { ScreenshotWrapper } from 'exposnap';

export default function App() {
  return (
    <ScreenshotWrapper>
      <YourApp />
    </ScreenshotWrapper>
  );
}
```

Start your app as usual (`npx expo start`). It finds the server on its own: a small camera button appears, and its dot turns green when connected. Then ask your assistant something like _"take a screenshot and fix whatever looks off"_.

## What your assistant can do

| Tool                    | What it does                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `take_screenshot`       | Captures the app as it is right now and returns the image                       |
| `get_logs`              | Reads console output and uncaught errors, filtered by level, text or time       |
| `open_url`              | Opens an Expo Router path (`/settings`) or a deep link (`myapp://profile/42`)   |
| `reload_app`            | Reloads the JavaScript bundle                                                   |
| `get_app_status`        | Whether an app is connected, and its platform, OS, screen size and color scheme |
| `get_latest_screenshot` | The newest screenshot, including ones you took by tapping the camera button     |
| `list_screenshots`      | Recent screenshots with ids and notes                                           |
| `get_screenshot`        | One earlier screenshot by id, for before and after comparisons                  |

It also offers screenshots and logs as MCP resources, sends uncaught app errors to your client as they happen, and includes a `review_screen` prompt that captures the current screen and reviews its layout, spacing, contrast and copy.

The camera button is for you: tap it to send the current screen to your assistant, and drag it anywhere. It never appears in captures.

## How it works

```
 Editor (Claude Code, Cursor...)            Your computer                 Phone / simulator / browser
 ┌──────────────┐   MCP over stdio   ┌─────────────────────┐   HTTP   ┌──────────────────────────┐
 │  AI agent    │ ─────────────────▶ │  npx exposnap       │ ◀─────── │  <ScreenshotWrapper>     │
 │              │ ◀───────────────── │  port 3333          │ ───────▶ │  captures, logs, routes  │
 └──────────────┘   tools, images    └─────────────────────┘ commands └──────────────────────────┘
```

Your app downloaded its JavaScript from Metro on your computer, so it already knows your computer's address, and ExpoSnap runs on that same computer. The app calls the server and waits for commands. Phones refuse incoming connections, so the server never has to reach the phone.

## Configuration

**Wrapper props**

| Prop             | Default    | What it does                                                          |
| ---------------- | ---------- | --------------------------------------------------------------------- |
| `enabled`        | `__DEV__`  | Off in release builds, where the wrapper renders only your app        |
| `showCameraIcon` | `true`     | Shows the floating camera button. The agent can capture either way    |
| `captureLogs`    | `true`     | Forwards console output and uncaught errors to `get_logs`             |
| `navigate`       |            | Lets `open_url` open routes by path, e.g. `path => router.push(path)` |
| `serverUrl`      | discovered | Use this server instead of discovering it, e.g. `"192.168.1.20:3333"` |
| `port`           | 3333-3337  | Only try this port                                                    |

**Server environment variables**

| Variable                   | Default                     |
| -------------------------- | --------------------------- |
| `EXPOSNAP_PORT`            | `3333` (next free if taken) |
| `EXPOSNAP_DIR`             | `<system temp>/exposnap`    |
| `EXPOSNAP_MAX_SCREENSHOTS` | `20`                        |
| `EXPOSNAP_MAX_LOGS`        | `1000`                      |

## Troubleshooting

**The dot stays grey on a physical phone.** The phone and computer must be on the same Wi-Fi. On Windows, allow Node.js through the firewall when asked (or allow inbound TCP 3333 on private networks). On macOS, allow incoming connections for Node if prompted.

**Using `expo start --tunnel`.** A tunnel carries Metro only, so the app cannot reach port 3333 that way. Pass your computer's LAN address: `<ScreenshotWrapper serverUrl="192.168.1.20:3333">`. The server prints its addresses when it starts.

**Android emulator.** Works with no setup: the wrapper also tries `10.0.2.2`, the emulator's address for your computer.

**`open_url` with a path says it needs the router.** Pass `navigate` (see setup). In Expo Go, paths work without it.

## Upgrading from 2.x

- Install `react-native-view-shot` in your app yourself (`npx expo install react-native-view-shot`). It is now a peer dependency, so Expo picks the version that matches your SDK.
- The wrapper now does nothing in release builds. Pass `enabled` to override.
- Screenshots moved from inside the npx cache to your system temp folder (`EXPOSNAP_DIR` to change it).
- Apps still on the 2.x wrapper keep working with the new server.

## Security

ExpoSnap is a development tool. The server listens on your local network without authentication, so anyone on the same network could send it screenshots or read the commands it queues. Use it on networks you trust. Nothing runs in release builds unless you pass `enabled`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome.

## License

MIT
