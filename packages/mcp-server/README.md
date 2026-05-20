# PeekView MCP Server

Model Context Protocol (MCP) server for [PeekView](https://github.com/randomgitsrc/peekview) with SSE transport.

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Generate tokens on your PeekView server
# On the server running PeekView:
peekview apikey create "MCP Server"     # → gives PEEKVIEW_API_KEY
# Generate MCP_TOKEN (any secure string):
export MCP_TOKEN=$(openssl rand -hex 32)  # or: pwgen -s 32 1

# 2. Configure in .env file
echo "PEEKVIEW_API_KEY=pv_your_key" > .env
echo "PEEKVIEW_PUBLIC_URL=https://peek.example.com" >> .env  # Your public domain
echo "MCP_TOKEN=$MCP_TOKEN" >> .env

# 3. Start services (from project root)
docker-compose up -d

# 4. Configure Claude Code (on your local machine)
# Add MCP server:
claude mcp add peekview http://your-server:33333/sse --transport http --header "Authorization: Bearer $MCP_TOKEN"
```

### NPM (standalone)

```bash
# Install
npm install -g @peekview/mcp-server

# Configure (all four required)
export PEEKVIEW_URL=http://localhost:8080         # PeekView server URL (internal)
export PEEKVIEW_PUBLIC_URL=http://localhost:8080  # Public URL shown to users
export PEEKVIEW_API_KEY=pv_your_api_key           # Get from: peekview apikey create "MCP"
export MCP_TOKEN=mct_your_connection_token        # Any secure string you choose
export MCP_PORT=33333                             # Use high port to avoid conflicts

# Run
peekview-mcp
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PEEKVIEW_URL` | Yes | - | PeekView API URL (server-side only) |
| `PEEKVIEW_PUBLIC_URL` | Yes | - | Public URL for user-facing links (e.g. https://peek.example.com) |
| `PEEKVIEW_API_KEY` | Yes | - | PeekView API Key (server-side only, never exposed to clients) |
| `MCP_TOKEN` | Yes | - | Connection token for AI clients (`openssl rand -hex 32`) |
| `MCP_PORT` | No | **33333** | Server port (use high port to avoid conflicts) |
| `MCP_HOST` | No | 0.0.0.0 | Bind address |
| `MCP_CORS_ORIGINS` | No | `*` | CORS origins (comma-separated) |

> ⚠️ **Port Selection**: Default port 33333 is chosen to avoid conflicts with common development servers (3000, 8080, etc.). If you encounter "port in use" errors, specify a different high port like 33334, 33335, etc.

## Security

- **Two-layer authentication**: MCP_TOKEN for connections, PEEKVIEW_API_KEY for API operations
- **PEEKVIEW_API_KEY never leaves the server**: clients only use MCP_TOKEN
- **CORS configurable**: restrict origins in production — never use `*` in production
  ```bash
  # Development
  MCP_CORS_ORIGINS=*
  
  # Production (restrict to known AI clients)
  MCP_CORS_ORIGINS=https://claude.ai,https://cursor.sh
  ```

## Tools

- `create_entry` - Create new entry with files
- `get_entry` - Get entry details
- `list_entries` - List/search entries
- `delete_entry` - Delete entry (requires confirmation)

## Development

```bash
cd packages/mcp-server
npm install
npm test        # Run all tests
npm run build   # Build to dist/
npm start       # Start server
```

## License

MIT
