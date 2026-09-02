# PeekView — Backend

> A lightweight code & document sharing service. Publish files, get a beautiful page, read them back as JSON.

## Features

- **Publish & share** — turn files (code, docs, diagrams, HTML) into shareable entries with rendered pages
- **Rich rendering** — Shiki code highlighting (100+ languages), GitHub-flavored Markdown with TOC, Mermaid / PlantUML diagrams, sandboxed HTML iframes (Three.js / Canvas / WebGL), images, multi-file entries with file tree & ZIP download
- **Full-text search** — SQLite FTS5, including CJK support
- **Agent-friendly read-back** — `GET /api/v1/entries/{slug}/raw` returns structured JSON; `?share={token}` reads private shares in one request; `?purify=true` strips base64 images
- **Authentication** — JWT register/login, user-level `pv_` API keys (expiry support), optional global API key
- **Security** — path traversal protection, storage allowlist, XSS filtering, sandboxed iframes, private entries hidden via 404 (no slug enumeration)
- **Admin** — user enable/disable, promote/demote, global read stats

## Install & Quick Start

```bash
pip install peekview
peekview serve                          # local: http://localhost:8080
peekview serve --host 0.0.0.0 --port 8080   # production
```

Create your first entry:

```bash
peekview create file.txt -s "My document"
peekview create src/*.py -s "Project" -t python -t cli   # multi-file + tags
echo "code" | peekview create -s "From stdin" --from-stdin
peekview create file.py -s "Private" --visibility private
```

## CLI Reference

### Entry management

```bash
peekview create <file...> -s "Summary" [-t tag] [--visibility public|private]
peekview get <slug>                     # show details
peekview list [-q "search"] [-t tag]    # list / FTS5 search / tag filter
peekview delete <slug>                  # delete (with confirmation)
```

### User management

```bash
peekview user create <username>         # create user (prompts for password)
peekview user list
peekview user promote <username>        # promote to admin
peekview user demote <username>
peekview user disable <username> / enable <username>
```

### API keys

```bash
peekview apikey create "CI Bot"         # → pv_xxxxxxxx...
peekview apikey create "Temp" --expires 30d
peekview apikey list
peekview apikey revoke <key_id>
peekview apikey cleanup                 # remove expired keys
```

### Service management

```bash
peekview service install --base-url https://example.com   # systemd / launchd
peekview service install --user
peekview service status / start / stop / uninstall
```

## Configuration

Configure via environment variables (prefix `PEEKVIEW_`, `__` for nesting) or `~/.peekview/config.yaml`.

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for local-only) |
| `PEEKVIEW_SERVER__PORT` | `8080` | Port |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | External URL (for reverse proxy) |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key (empty = no auth) |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT validity in days |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow registration |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | Allow anonymous creation |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `10485760` | Max single file size (10 MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | Max items per page |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | Check expired entries on startup |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval (0 = disabled) |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level |
| `PEEKVIEW_REMOTE__URL` | `""` | Remote server URL (CLI remote mode) |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | API key for remote server |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | JWT token for remote user |

Config file example (`~/.peekview/config.yaml`):

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

## API Reference

### Health

```
GET /health → { "status": "ok", "version": "0.22.0" }
```

### Entries

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/entries` | List entries (pagination, search, tag, owner filter) | Optional |
| POST | `/api/v1/entries` | Create entry | Optional* |
| GET | `/api/v1/entries/{slug}` | Get entry details | Optional* |
| PATCH | `/api/v1/entries/{slug}` | Update entry (including visibility) | Owner/Admin |
| DELETE | `/api/v1/entries/{slug}` | Delete entry | Owner/Admin |
| GET | `/api/v1/entries/{slug}/files/{file_id}` | Get file info | - |
| GET | `/api/v1/entries/{slug}/files/{file_id}/content` | Get file content | - |
| GET | `/api/v1/entries/{slug}/download` | Download entry as ZIP | - |
| GET | `/api/v1/entries/{slug}/raw` | Raw structured JSON: text files include `content`, binary files `content=null` + `file_url`. Query params: `?share={token}` (one-shot private share read), `?purify=true` (replace base64 images with placeholders) | Optional* |

\* Private entries require auth. Creation may require auth if `allow_anonymous_create=false`.

List query params: `page`, `per_page`, `q` (FTS5), `tag` (repeatable), `owner=me`.

### Shares

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/entries/{slug}/shares` | Create share link (returns `share_url` with `?share={token}`) | Owner/Admin |
| GET | `/api/v1/entries/{slug}/shares` | List shares | Owner/Admin |
| POST | `/api/v1/entries/{slug}/shares/revoke` | Revoke share | Owner/Admin |

Share tokens grant read-only access to private entries without login. Invalid/revoked tokens return 404 (no existence leak). Works with `GET /api/v1/entries/{slug}/raw?share={token}` for one-shot raw reads.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user (first user auto-admin) |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Current user info (requires JWT) |

### API keys

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/apikeys` | Create API key | JWT |
| GET | `/api/v1/apikeys` | List user's keys | JWT |
| DELETE | `/api/v1/apikeys/{key_id}` | Revoke key | JWT (owner/admin) |
| DELETE | `/api/v1/apikeys/expired` | Cleanup expired keys | JWT |

**Key format**: `pv_` prefix + 32-char token (`secrets.token_urlsafe(24)`), HMAC-SHA256 hashed. Max 10 keys per user. Expiration: never / 7d / 30d / 90d.

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/admin/users` | List all users | Admin |
| PATCH | `/api/v1/admin/users/{user_id}` | Enable/disable, promote/demote | Admin |
| GET | `/api/v1/admin/stats` | Global read/usage stats | Admin |

### Authentication & visibility

- **JWT** — `Authorization: Bearer <jwt>`
- **User API key** — `X-API-Key: pv_...` (bound to user)
- **Global API key** — `X-API-Key: <PEEKVIEW_SERVER__API_KEY>` (service-level, ownerless entries)
- Anonymous users see only public entries; authenticated users also see their own private entries; private entries return 404 to non-owners (no slug enumeration)

## Development

```bash
git clone https://github.com/randomgitsrc/peekview.git
cd peekview
make dev                                # create venv + editable install (isolated)
cd backend && .venv/bin/python -m pytest tests/
make debug-start                        # dev server on :8888 (isolated data)
```

Multi-instance testing: `make debug-extra PORT=8889` (port + data isolation) — see [debug workflow](docs/process/debug-workflow.md).

## License

MIT
