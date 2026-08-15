# PeekView MCP Server

> MCP bridge for PeekView — lets agents publish and, crucially, **read back** any PeekView link. Streamable HTTP transport, multi-user auth.

PeekView: Agent writes, humans read, agents read too. This server powers the "agent" side — publish content and read it back as clean structured JSON, even across hosts.

## Core Concept: Dual Mode

The toolset depends on deployment topology:

| Mode | Topology | Tools | Use case |
|------|----------|-------|----------|
| `remote` (default) | Agent → MCP Server → PeekView | `create_entry`, `get_entry`, `list_entries`, `delete_entry` | MCP Server cannot read agent-local files; publish agent-generated content |
| `local` | Agent + MCP Server → PeekView | `publish_files`, `get_entry`, `list_entries`, `delete_entry` | MCP Server shares the filesystem with the agent; reads files directly |

`get_entry` works in both modes and accepts **any PeekView link** (see below).

**local-mode path rules (v0.7.1+):**

- `cwd` and the system temp dir (e.g. Linux `/tmp`) are allowed by default
- `$HOME` is not allowed by default; configure `server.allowed_paths` to publish from there
- `server.trust_all_paths=true` skips directory boundaries entirely (dangerous; denylist is best-effort only)

## Tools

### `get_entry` — read any PeekView link (v0.11.0+)

The star of the show. Pass any PeekView link and get clean structured JSON back — no more "I can't read this link" friction:

- **Link forms**: page link `https://host/{slug}` · raw long link `.../api/v1/entries/{slug}/raw` · raw short link `https://host/{slug}/raw` · share link `...?share={token}` · bare slug (config instance)
- **Cross-host**: not limited to the configured instance — read any reachable PeekView host. Public entries are read anonymously; private entries require a share link (no token → clear error)
- **SSRF protection**: protocol allowlist (`https` any host, `http` only localhost) + response structure validation (non-PeekView responses rejected without leaking the body) + 30s timeout + 20 MB response body cap; **cross-host requests never carry the configured instance's credentials**
- **Purification**: base64 images inside text become `[image: name (N KB, base64)]` placeholders (alt text preserved); binary files stay `content=null`
- **Return policy**: single file full content (>200 KB gets a soft warning); multi-file entries return all files when total ≤32 KB, otherwise a manifest + snippets with a `file=` hint; optional `file` param fetches one file in full
- `publish_files` also returns a `Raw URL: {public_url}/api/v1/entries/{slug}/raw` you can hand straight back to `get_entry`

### Other tools

| Tool | Description |
|------|-------------|
| `create_entry` (remote) | Create an entry from content in the LLM context |
| `publish_files` (local) | Publish local files/directories (respects `allowed_paths`) |
| `list_entries` | List/search entries (optional project filter) |
| `delete_entry` | Delete an entry |

## Quick Start

### 1. Configure

```bash
# Internal PeekView API address (used by MCP Server)
peekview-mcp config set peekview.url http://localhost:8080

# Public address (used to build links for humans)
peekview-mcp config set peekview.public_url https://peek.example.com

# Optional
peekview-mcp config set server.port 33334
peekview-mcp config set server.mode local
peekview-mcp config list
```

### 2. Install & serve

```bash
npm install -g @peekview/mcp-server
peekview-mcp service install --user
peekview-mcp service start
```

### 3. Connect a client (Claude Code example)

```bash
peekview apikey create "Claude Code"    # on the PeekView server

claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_xxxxxxxx..."
```

Docker container agents declare a namespace:

```bash
claude mcp add peekview \
  --transport http http://host.docker.internal:33333/mcp \
  --header "Authorization: Bearer pv_xxxxxxxx..." \
  --header "X-Peekview-Namespace: docker-a"
```

## Configuration

| Key | Env var | Default | Description |
|-----|---------|---------|-------------|
| `peekview.url` | `PEEKVIEW_URL` | — | **Required.** PeekView API address (internal/private network OK) |
| `peekview.public_url` | `PEEKVIEW_PUBLIC_URL` | — | **Required.** Public address for generated links (must be reachable by the user's browser) |
| `server.port` | `MCP_PORT` | `33333` | MCP Server listen port |
| `server.host` | `MCP_HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for local-only) |
| `server.cors_origins` | `MCP_CORS_ORIGINS` | `*` | CORS origins, comma-separated |
| `server.mode` | `MCP_MODE` | `remote` | `remote` (default) or `local` |
| `server.allowed_paths` | `MCP_ALLOWED_PATHS` | — | local-mode allowlist (colon-separated in env, YAML array in file; supports `~` expansion) |
| `server.path_namespaces` | — | — | Docker container path aliases (config file only) |
| `server.trust_all_paths` | `MCP_TRUST_ALL_PATHS` | `false` | Dangerous: skip path allowlist |
| `logging.level` | `MCP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Precedence: **CLI options > env vars > config file** (`~/.peekview/mcp-config.yaml`).

### `peekview.url` vs `peekview.public_url`

```
┌───────────────────────────────────────────────────────────────┐
│                       Network layout                          │
│                                                               │
│  Agent (Claude Code)                                          │
│     │                                                         │
│     │ HTTP                                                     │
│     ▼                                                         │
│  ┌─────────────┐   peekview.url   ┌─────────────┐            │
│  │ MCP Server  │ ───────────────► │  PeekView   │            │
│  │   :33333    │    (internal)    │   :8080     │            │
│  └──────┬──────┘                  └──────┬──────┘            │
│         │                               │ peekview.public_url │
│         │                               ▼                    │
│         │                         Human browser              │
│         └────────── view_url ──────────►  (rendered page)    │
└───────────────────────────────────────────────────────────────┘
```

| Key | Used by | Who needs access | Typical value |
|-----|---------|------------------|---------------|
| `peekview.url` | MCP Server → PeekView API | MCP Server only | `http://localhost:8080` / `http://10.0.0.5:8080` |
| `peekview.public_url` | link generation for humans | user's browser | `https://peek.example.com` |

## Deployment Scenarios

### Scenario 1: Single server (simplest)

MCP Server and PeekView on the same machine — local dev / single-host testing.

```bash
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp config set peekview.public_url http://localhost:8080
```

### Scenario 2: Multi-server + private network (recommended for production)

MCP Server and PeekView on different servers with internal connectivity; PeekView not exposed publicly.

```bash
peekview-mcp config set peekview.url http://10.0.0.5:8080
peekview-mcp config set peekview.public_url https://peek.example.com
```

### Scenario 3: Multi-server + public network only

No internal connectivity — both reachable over the internet.

```bash
peekview-mcp config set peekview.url https://peek.example.com
peekview-mcp config set peekview.public_url https://peek.example.com
```

### Docker

Container agents run with `cwd=/` by default. Configure `allowed_paths` or set `working_dir` (see [Docker section](#docker-容器部署) in the config file docs):

```bash
# Environment variable
MCP_ALLOWED_PATHS=/data:/app
# or config file
peekview-mcp config set server.allowed_paths /data:/app
```

Volume mounts must use the same path inside and outside the container (`namespace` only rewrites agent-passed prefixes, not real paths):

```yaml
volumes:
  - /data/project:/data/project   # ✅ same path
  - /host/path:/container/path     # ❌ different paths break publish_files
```

## Authentication

Each user authenticates with their own PeekView API key; the MCP Server validates and forwards it per request:

```
Agent (Alice) → Bearer pv_alice → MCP Server → validate via /auth/me → PeekView (Alice's entries)
Agent (Bob)   → Bearer pv_bob   → MCP Server → validate via /auth/me → PeekView (Bob's entries)
```

## Troubleshooting

```bash
peekview-mcp config list               # inspect config
MCP_LOG_LEVEL=debug peekview-mcp serve  # foreground + debug logs
journalctl --user -u peekview-mcp -f    # service logs
curl http://localhost:33333/health
```

## Upgrade

```bash
npm install -g @peekview/mcp-server@latest
peekview-mcp service restart
peekview-mcp --version
```

## Uninstall

```bash
peekview-mcp service stop
peekview-mcp service uninstall --user
npm uninstall -g @peekview/mcp-server
rm ~/.peekview/mcp-config.yaml         # optional
```

## Development

```bash
cd packages/mcp-server
npm install
npm run build
npm test                 # unit tests (isolated temp HOME)
npm run test:integration # requires debug backend + API key
npm start
```

## License

MIT
