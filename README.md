# PeekView

> Lightweight code & document formatting service — Agent creates, human views

**Agent (AI) → PeekView formats → Human views in browser**

**One-liner:** `pipx install peekview && peekview serve && peekview create file.py -s "Hello"`

[![Version](https://img.shields.io/badge/version-0.1.65-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is PeekView?

PeekView is a self-hosted service that formats code and documents for human viewing. AI agents (Claude Code, Cursor, Codex, etc.) create entries via CLI, REST API, or MCP protocol — humans view them in a browser with syntax highlighting, file trees, and more.

**Two components:**

| Component | Package | Purpose |
|-----------|---------|---------|
| **PeekView** (Backend+Frontend) | `pipx install peekview` | Web service: serves formatted entries, REST API, CLI |
| **PeekView MCP Server** | `npm install -g @peekview/mcp-server` | AI Agent bridge: lets agents call PeekView via MCP protocol |

---

## Quick Start

### 1. Install and start PeekView

```bash
pipx install peekview
peekview serve                    # Start on http://localhost:8080
```

### 2. Create your first entry

```bash
peekview create file.py -s "My code"              # Returns: http://localhost:8080/my-code
peekview create src/*.py -s "Project" -t python    # Multi-file with file tree
peekview create index.html style.css -s "Demo"     # HTML renders in sandbox
```

### 3. Connect your AI agent (optional)

```bash
npm install -g @peekview/mcp-server

# Configure MCP Server
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp serve &

# Add to Claude Code
claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_your_api_key"
```

---

## PeekView MCP Server

The MCP Server (`@peekview/mcp-server`) lets AI agents interact with PeekView via the MCP protocol (Streamable HTTP transport). It supports two modes:

### Remote Mode (default)

Agent and PeekView on different machines. Agent sends file **content** to PeekView API.

```
Agent (machine A) → HTTP POST → MCP Server (machine B) → HTTP → PeekView (machine C)
```

**Tools:** `create_entry`, `get_entry`, `list_entries`, `delete_entry`

### Local Mode

Agent and MCP Server on the same machine. MCP Server reads files **directly from disk**.

```
Agent + MCP Server (same machine) → reads local files → HTTP → PeekView
```

**Tools:** `publish_files`, `get_entry`, `list_entries`, `delete_entry`

### MCP Server Setup

```bash
npm install -g @peekview/mcp-server

# Configure
peekview-mcp config set peekview.url http://localhost:8080       # PeekView address
peekview-mcp config set peekview.public_url https://peek.example.com  # Public URL for view links
peekview-mcp config set server.mode local     # or "remote" (default)
peekview-mcp config set server.allowed_paths /home/user/projects:/tmp  # Local mode: paths allowed to read

# Start
peekview-mcp serve                              # Foreground
peekview-mcp service install --user             # Systemd user service
peekview-mcp service start

# Add to Claude Code
claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_your_api_key"

# Add to Cursor / other MCP clients
# In MCP config file:
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": {
      "Authorization": "Bearer pv_your_api_key"
    }
  }
}
```

### Local Mode Security

`publish_files` uses a three-layer security model:
1. **Sensitive path denylist** — blocks `.env`, `.ssh`, `.kube`, `.npmrc`, credentials, etc.
2. **Allowed paths** — `server.allowed_paths` config or cwd+tmpdir fallback
3. **`trust_all_paths`** — dangerous option, still protected by denylist (best-effort)

---

## CLI vs MCP: When to Use Which

PeekView offers two ways to create entries — CLI and MCP. They serve different purposes:

| Scenario | Use | Why |
|----------|-----|-----|
| You explicitly want to share files | **CLI** (`peekview create`) | Fast, zero config, files don't go through LLM context |
| Agent decides on its own to publish | **MCP** (`publish_files` / `create_entry`) | No human needed — agent acts autonomously |
| Agent publishes local files | **MCP local mode** (`publish_files`) | MCP reads files directly, agent only passes paths |
| CI/CD pipeline automation | **MCP** | Unattended, runs in headless environments |
| Agent-to-agent content sharing | **MCP** | Agents use PeekView as a shared content hub |

**Key difference:** CLI is for when *you* tell the agent what to do. MCP is for when the *agent* decides on its own. CLI is faster (files go directly to API), MCP is autonomous (no human in the loop).

---

## CLI Usage

```bash
# Create entries
peekview create file.py -s "Summary"
peekview create src/*.py -s "Project" -t python -t cli
echo "content" | peekview create -s "From stdin" --from-stdin
peekview create file.py -s "Private" --visibility private

# View & manage
peekview get my-entry
peekview list
peekview list -q "search terms"
peekview list -t python -t cli
peekview delete my-entry

# Users
peekview user create <username>
peekview user promote <username>

# API Keys
peekview apikey create "CI Bot"
peekview apikey create "Temp" --expires 30d
peekview apikey list
peekview apikey revoke <key_id>

# System service
peekview service install --user
peekview service start
peekview service status

# Remote CLI
peekview login --remote-url <url> --username <user>
```

---

## Features

- **Code highlighting** — Shiki-based, 100+ languages
- **Markdown rendering** — GitHub-flavored, auto TOC
- **Full-text search** — SQLite FTS5
- **Multi-file entries** — File tree with nested directories, ZIP download
- **HTML rendering** — iframe sandbox with CSS/JS/image injection
- **Image preview** — PNG/JPG/GIF/WebP/SVG with zoom
- **REST API** — Full CRUD with API Key auth
- **User auth** — JWT registration/login, private entries, owner controls
- **API Key management** — User-level `pv_` prefix keys, expiration, CLI management
- **Theme** — Dark/light mode, auto system follow
- **Mobile** — Responsive design, bottom toolbar
- **URL-friendly** — Custom slugs, file params, line highlighting
- **Security** — Path traversal protection, API auth, XSS filtering, iframe sandbox

---

## Remote CLI Mode

Operate PeekView from a different machine:

```bash
# Config file (~/.peekview/config.yaml)
remote:
  url: https://peek.example.com
  api_key: pv_your-api-key
  timeout: 60
  verify_ssl: true

# Or environment variables
export PEEKVIEW_REMOTE__URL=https://peek.example.com
export PEEKVIEW_REMOTE__API_KEY=pv_your-api-key
```

**Limitations:** Text files only (binary skipped), no `local_path`, directory scan done client-side.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for local-only) |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | External URL (auto-detect if empty) |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key (empty = no auth) |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (auto-generate if empty) |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval (0 = disabled) |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level |

Full list: see [CLAUDE.md](CLAUDE.md) Configuration section (33 variables).

**Priority:** Environment variables > Config file > Defaults

**Config file:** `~/.peekview/config.yaml`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI + SQLModel + SQLite (WAL + FTS5) |
| Frontend | Vue 3 + Vite + TypeScript + Shiki |
| MCP Server | Node.js/TypeScript + Streamable HTTP transport |
| CLI | Click + Rich |
| Testing | pytest + Vitest + Playwright |

---

## Documentation

- [Deployment Guide](docs/guides/DEPLOYMENT.md) — Install, configure, deploy
- [Agent Deployment Guide](docs/guides/agent-deployment-guide.md) — VPS deployment for AI agents
- [Debug Guide](docs/guides/DEBUGGING.md) — Local development
- [Changelog](CHANGELOG.md) — Version history
- [Project Index](INDEX.md) — Implementation progress & doc inventory

---

## Development

```bash
make dev && cd backend && .venv/bin/python -m pytest tests/
cd frontend-v3 && npm install && npm run dev
cd packages/mcp-server && npm ci && npm run test:unit
```

---

## License

MIT License
