# PeekView — Backend API Documentation

> A lightweight code & document formatting display service.

## Quick Start

### Install

```bash
pip install peekview
```

### Start Server

```bash
peekview serve                          # Local development
peekview serve --host 0.0.0.0 --port 8080  # Production
```

## CLI Commands

### Entry Management

```bash
peekview create file.txt -s "My document"                    # Create from file
peekview create src/*.py -s "Project" -t python -t cli       # Multi-file + tags
echo "code" | peekview create -s "From stdin" --from-stdin   # From pipe
peekview create file.py -s "Private" --visibility private     # Private entry

peekview get my-entry                 # Show details
peekview list                         # List entries
peekview list -q "python"             # FTS5 search
peekview list -t python -t cli        # Tag filter
peekview delete my-entry              # Delete (with confirmation)
```

### User Management

```bash
peekview user create <username>       # Create user (prompts for password)
peekview user list                    # List users
peekview user promote <username>      # Promote to admin
peekview user demote <username>       # Demote from admin
```

### Remote Authentication

```bash
peekview login --remote-url <url> --username <user>  # Login to remote server
```

### API Key Management

```bash
peekview apikey create "CI Bot"       # Create API key
peekview apikey create "Temp" --expires 30d  # With expiration
peekview apikey list                  # List keys
peekview apikey revoke <key_id>       # Revoke key
peekview apikey cleanup               # Remove expired keys
```

### Service Management

```bash
peekview service install --base-url https://example.com  # Systemd/launchd
peekview service install --user
peekview service status / start / stop / uninstall
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | Server bind address (`127.0.0.1` for local-only) |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | External URL (for reverse proxy) |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key for service-level auth |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `http://localhost:5173` | CORS allowed origins |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT token validity in days |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | Allow anonymous entry creation |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | Max items per page |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | Check expired entries on startup |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval (0 = disabled) |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level (DEBUG/INFO/WARNING/ERROR) |
| `PEEKVIEW_REMOTE__URL` | `""` | Remote server URL for CLI remote mode |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | API key for remote server |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | JWT token for remote user auth |

### Config File

`~/.peekview/config.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 8080
  base_url: https://peek.example.com
storage:
  data_dir: /var/peekview/data
  db_path: /var/peekview/peekview.db
auth:
  secret_key: ""
  token_expire_days: 7
  allow_registration: true
  allow_anonymous_create: true
limits:
  max_file_size: 10485760
  max_entry_files: 50
  max_per_page: 50
remote:
  url: ""
  api_key: ""
  token: ""
```

## API Endpoints

### Health Check

```
GET /health → { "status": "ok", "version": "0.1.42" }  # version auto-synced from __init__.py
```

### Entry API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/entries` | List entries (pagination, search, tag filter, owner filter) | Optional |
| POST | `/api/v1/entries` | Create entry | Optional* |
| GET | `/api/v1/entries/{slug}` | Get entry details | Optional* |
| PATCH | `/api/v1/entries/{slug}` | Update entry (including visibility toggle) | Owner/Admin |
| DELETE | `/api/v1/entries/{slug}` | Delete entry | Owner/Admin |
| GET | `/api/v1/entries/{slug}/files/{file_id}` | Get file info | - |
| GET | `/api/v1/entries/{slug}/files/{file_id}/content` | Get file content | - |
| GET | `/api/v1/entries/{slug}/download` | Download entry as ZIP pack | - |

\* Private entries require authentication. Entry creation may require auth if `allow_anonymous_create=false`.

**Query Parameters for GET /api/v1/entries:**
- `page`, `per_page` — Pagination
- `q` — FTS5 full-text search
- `tag` — Tag filter (repeatable)
- `owner` — Owner filter (`owner=me` for current user's entries)

### Auth API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user (first user always allowed, auto-admin) |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/logout` | Logout (client-side token clear) |
| GET | `/api/v1/auth/me` | Get current user info (requires JWT) |

### API Key Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/apikeys` | Create API key | JWT |
| GET | `/api/v1/apikeys` | List user's API keys | JWT |
| DELETE | `/api/v1/apikeys/{key_id}` | Revoke API key | JWT (owner/admin) |
| DELETE | `/api/v1/apikeys/expired` | Cleanup expired keys | JWT |

**API Key format**: `pv_` prefix + 24-char token, HMAC-SHA256 hashed for storage.
**Max active keys**: 10 per user.
**Expiration options**: Never, 7d, 30d, 90d.

### Authentication Methods

1. **JWT** — `Authorization: Bearer <jwt>` for user-level auth
2. **User-level API Key** — `X-API-Key: pv_...` or `Authorization: Bearer pv_...` (bound to user, JWT-equivalent permissions)
3. **Global API Key** — `X-API-Key: <PEEKVIEW_SERVER__API_KEY>` or `Authorization: Bearer <key>` (service-level, creates ownerless entries)

### Visibility Rules

- Anonymous users see only `is_public=true` entries
- Authenticated users see all public entries + own private entries
- Direct access to private entry returns 404 (unless owner/admin)
- Only owner or admin can toggle visibility or delete an entry
- If `allow_anonymous_create=false`, anonymous entry creation returns 401

## Features

- 🎨 **Code Highlighting** — Shiki with 100+ languages
- 📝 **Markdown Rendering** — GitHub-flavored Markdown with TOC
- 🔍 **Full-Text Search** — SQLite FTS5
- 📂 **Multi-file Support** — File tree per entry (hierarchical paths)
- 🖼️ **HTML Rendering** — iframe sandbox with CSS/JS/image injection
- 🖼️ **Image Viewer** — PNG/JPG/GIF/WebP/SVG support
- 📦 **Pack Download** — ZIP download for multi-file entries
- 🌐 **REST API** — Full CRUD with multiple auth methods
- 🔐 **User Authentication** — JWT register/login/logout
- 🔑 **API Key Management** — User-level pv_ keys with expiration
- 🔒 **Security** — Path traversal protection, allowlist, XSS filtering, iframe sandbox
- 👤 **Entry Visibility** — Public/private with owner controls
- 🤖 **MCP Server** — AI Agent integration via SSE transport ([@peekview/mcp-server](https://www.npmjs.com/package/@peekview/mcp-server))

## Tech Stack

- **Backend**: FastAPI + SQLModel + SQLite (FTS5)
- **Frontend**: Vue 3 + Vite + Shiki + TypeScript
- **CLI**: Click + Rich

## Development

```bash
git clone https://github.com/randomgitsrc/peekview.git
cd peekview/backend
pip install -e ".[test,dev]"
make test      # 393 tests
make dev       # Start dev server
```

## License

MIT License
