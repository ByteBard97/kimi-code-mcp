# kimi-code-mcp

[![npm version](https://img.shields.io/npm/v/kimi-code-mcp.svg)](https://www.npmjs.com/package/kimi-code-mcp)
[![CI](https://github.com/userfrm/kimi-code-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/userfrm/kimi-code-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server wrapping [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli) (kimi-k2.5) — 14 tools for filesystem, shell, web, and agent operations.

## Prerequisites

- Node.js >= 18
- [Kimi CLI](https://github.com/MoonshotAI/kimi-cli) installed and authenticated

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "kimi": {
      "command": "npx",
      "args": ["-y", "kimi-code-mcp@latest"]
    }
  }
}
```

## Usage with VS Code

Install the Kimi Code MCP server in VS Code:

[<img alt="Install in VS Code" src="https://img.shields.io/badge/VS_Code-Install_Server-0078d4?style=flat-square&logo=visualstudiocode&logoColor=white">](https://insiders.vscode.dev/redirect/mcp/install?name=kimi&inputs=%5B%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22kimi-code-mcp%40latest%22%5D%7D)

Or add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "kimi": {
      "command": "npx",
      "args": ["-y", "kimi-code-mcp@latest"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `kimi_read_file` | Read a text file (up to 1000 lines) |
| `kimi_read_media` | Analyze images and videos |
| `kimi_write_file` | Create or overwrite a file |
| `kimi_edit_file` | Find-and-replace edit in a file |
| `kimi_glob` | Find files matching a glob pattern |
| `kimi_grep` | Search for regex patterns in files |
| `kimi_shell` | Execute shell commands |
| `kimi_web_search` | Search the web (up to 20 results) |
| `kimi_fetch_url` | Fetch and extract webpage content |
| `kimi_agent` | Autonomous agent for complex tasks |
| `kimi_think` | Extended reasoning and analysis |
| `kimi_review` | Code review (bugs, security, perf, style) |
| `kimi_research` | Research with 256K context window |
| `kimi_test` | Generate or fix tests with edge cases |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KIMI_CLI_PATH` | Absolute path to kimi binary | `kimi` (from PATH) |
| `MCP_KIMI_DEBUG` | Enable debug logging to stderr | unset |

## Development

```bash
git clone https://github.com/userfrm/kimi-code-mcp.git
cd kimi-code-mcp
npm install
npm run build
npm test
```

## License

MIT
