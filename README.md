<div align="center">
  <img src="assets/ExpoSnap_MCP_Logo.png" alt="ExpoSnap" width="240"/>
  
  
</div>

## ExpoSnap MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to capture and analyze screenshots from React Native/Expo applications in real-time. Seamlessly integrates with Claude, Cursor, VS Code, and other MCP-compatible editors for AI-powered mobile UI development.

## Setup

**1. Add MCP server to your IDE**

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add exposnap -- npx -y exposnap
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

<div align="center">
  <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=exposnap&config=eyJjb21tYW5kIjoibnB4IC15IGV4cG9zbmFwIn0%3D">
    <img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add to Cursor">
  </a>
</div>

Or manually add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "exposnap": {
      "command": "npx",
      "args": ["-y", "exposnap"]
    }
  }
}
```
</details>

<details>
<summary><strong>VS Code</strong></summary>

Add to `.vscode/mcp.json`:
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
<summary><strong>Claude Desktop</strong></summary>

Settings → Developer → Edit Config:
```json
{
  "mcpServers": {
    "exposnap": {
      "command": "npx",
      "args": ["-y", "exposnap"]
    }
  }
}
```
</details>

**2. Add to your Expo app**

```bash
npm install exposnap
```

**3. Configure your React Native app**

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

The wrapper automatically discovers your MCP server and handles invisible screenshot capture when Claude requests it.

## Usage

Just ask Claude about your screen:

- *"What's on my screen right now?"*
- *"How can I improve this layout?"*  
- *"Take a screenshot"*

Screenshots happen automatically - no buttons or manual steps needed.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](LICENSE) for details.