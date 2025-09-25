<div align="center">
  <img src="assets/ExpoSnap_MCP_Logo.png" alt="ExpoSnap" width="240"/>
  
  
</div>

## ExpoSnap MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to view and analyze screenshots from React Native/Expo applications. Seamlessly integrates with Claude, Cursor, VS Code, and other MCP-compatible editors for AI-powered mobile UI development.

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



Add to `.cursor/mcp.json`:
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

The wrapper automatically discovers your MCP server and provides a draggable camera icon for manual screenshot capture.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](LICENSE) for details.