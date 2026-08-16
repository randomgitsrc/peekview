# PeekView

> Agent writes. Humans read. Agents can read too.

PeekView turns agent output into shareable pages: an agent publishes files, humans open a link to a beautifully rendered page, and other agents read the raw content through the API or MCP.

[![Version](https://img.shields.io/badge/version-0.21.0-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English** · [中文](README.zh-CN.md)

---

## What is PeekView

- **Agent writes** — publish files (code, docs, diagrams, HTML) from the CLI, MCP, or API
- **Humans read** — every entry gets a link that renders as a rich, readable page
- **Agents read too** — the same link can be read back as structured JSON by another agent, no login needed for public entries

## Quick Start

```bash
pipx install peekview
peekview serve                          # http://localhost:8080
peekview create file.py -s "My code"    # → http://localhost:8080/my-code
```

Connect an agent (optional):

```bash
npm install -g @peekview/mcp-server
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp serve
```

## Why PeekView

**For humans** — rich rendering out of the box:

- Code (Shiki, 100+ languages, line numbers) · Markdown (GFM, auto TOC) · Mermaid / PlantUML diagrams · HTML (sandboxed iframe, Three.js / Canvas / WebGL) · Images · Multi-file entries (file tree + ZIP download) · Full-text search
- Dark / light themes · Mobile-friendly · Private entries · API key management

**For agents** — zero-friction read-back:

- `get_entry` (MCP) accepts any PeekView link — page URL, `/raw` link, `?share=` link, or bare slug — across hosts, returning purified structured JSON
- `GET /api/v1/entries/{slug}/raw` returns structured JSON; public entries need no auth

## Agent Integration

- **Read**: pass a PeekView link to `get_entry` and get clean content back — see [MCP Server README](packages/mcp-server/README.md)
- **Write**: `publish_files` (MCP local) / `create_entry` (MCP remote) / `peekview create` (CLI)
- **MCP clients**: Claude Code, OpenCode, Cursor, and any MCP-compatible tool

```json
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": { "Authorization": "Bearer pv_your_api_key" }
  }
}
```

## Documentation

| Topic | Where |
|-------|-------|
| Backend API & CLI reference | [backend/README.md](backend/README.md) |
| MCP Server (tools, config, deployment) | [packages/mcp-server/README.md](packages/mcp-server/README.md) |
| Deployment guide | [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) |
| Debugging workflow | [docs/process/debug-workflow.md](docs/process/debug-workflow.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

## License

MIT
