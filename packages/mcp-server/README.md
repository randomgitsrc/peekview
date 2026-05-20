# PeekView MCP Server

Model Context Protocol (MCP) server for [PeekView](https://github.com/randomgitsrc/peekview) with SSE transport and multi-user authentication.

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Create API Keys for each user on your PeekView server
peekview apikey create "Claude Code - Alice"   # → pv_alice_key...
peekview apikey create "Claude Code - Bob"     # → pv_bob_key...

# 2. Configure .env file (only PEEKVIEW_PUBLIC_URL needed now)
echo "PEEKVIEW_PUBLIC_URL=https://peek.example.com" > .env

# 3. Start services (from project root)
docker-compose up -d

# 4. Configure Claude Code (on each user's machine)
claude mcp add peekview --transport sse https://peek.example.com:33333/sse \
  --header "Authorization: Bearer pv_alice_key..."
```

### NPM (standalone)

```bash
# Install
npm install -g @peekview/mcp-server

# Configure (only two required env vars now)
export PEEKVIEW_URL=http://localhost:8080         # PeekView server URL (internal)
export PEEKVIEW_PUBLIC_URL=http://localhost:8080  # Public URL shown to users

# Run
peekview-mcp
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PEEKVIEW_URL` | Yes | - | PeekView API URL (server-side only) |
| `PEEKVIEW_PUBLIC_URL` | Yes | - | Public URL for user-facing links (e.g. https://peek.example.com) |
| `MCP_PORT` | No | **33333** | Server port (use high port to avoid conflicts) |
| `MCP_HOST` | No | 0.0.0.0 | Bind address |
| `MCP_CORS_ORIGINS` | No | `*` | CORS origins (comma-separated) |
| `LOG_LEVEL` | No | info | Log level (debug/info/warn/error) |

> **v0.2.0 Breaking Change:** `MCP_TOKEN` and `PEEKVIEW_API_KEY` are removed. Each user brings their own `pv_` API Key via the `Authorization` header.

## Authentication

Each Claude Code client authenticates with their own PeekView API Key:

```
Claude Code (Alice)                Claude Code (Bob)
    │                                   │
    │ Bearer: pv_alice_key              │ Bearer: pv_bob_key
    ▼                                   ▼
┌──────────────────────────────────────────┐
│          MCP Server                      │
│  Validates pv_ prefix + calls /auth/me  │
│  Passthrough: forwards key to PeekView  │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│          PeekView (Auth Center)          │
│  pv_alice_key → Alice's entries         │
│  pv_bob_key   → Bob's entries           │
└──────────────────────────────────────────┘
```

**Two-layer auth:**
- **Connection auth:** Only `pv_` prefix API Keys accepted (JWT rejected at SSE connect)
- **Business auth:** PeekView validates each API Key on every tool call

**Security notes:**
- API Key never stored on MCP Server beyond session lifetime
- Entries belong to the API Key's owner (automatic from PeekView)
- JWT tokens (`eyJ` prefix) are rejected — use long-lived `pv_` API Keys instead

## Tools

- `create_entry` - Create new entry with files (owned by API Key user)
- `get_entry` - Get entry details (public + own private entries)
- `list_entries` - List/search entries (public + own private entries)
- `delete_entry` - Delete entry (only own entries, requires confirmation)

## Migration from v0.1.x

1. Give current version a `v0.1.x` tag for reference
2. Remove `MCP_TOKEN` and `PEEKVIEW_API_KEY` from environment
3. Create API Keys for each user: `peekview apikey create "Claude Code"`
4. Update Claude Code config:
   ```bash
   claude mcp remove peekview
   claude mcp add peekview --transport sse https://peek.example.com:33333/sse \
     --header "Authorization: Bearer pv_your_key..."
   ```
5. Verify: `curl https://peek.example.com:33333/health` → `{"status":"ok"}`

## Development

```bash
cd packages/mcp-server
npm install
npm test        # Run all tests (42 tests)
npm run build   # Build to dist/
npm start       # Start server
```

## License

MIT