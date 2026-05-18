# Feature Matrix

*Auto-generated on 2026-05-17*

## Frontend

### Views
- ✅ EntryListView (with All/Mine tabs)
- ✅ EntryDetailView
- ✅ ApiKeyListView

### Components
- ✅ CodeViewer
- ✅ ConfirmDialog
- ✅ FileTree
- ✅ LoginDialog
- ✅ MarkdownViewer
- ✅ MermaidDiagram
- ✅ Pagination
- ✅ ThemeToggle

### Capabilities
- ✅ Mermaid Diagrams
- ✅ Theme Support
- ✅ Mobile UI
- ✅ Markdown Rendering
- ✅ Code Highlighting (Shiki)
- ✅ User Authentication (JWT)
- ✅ Entry Visibility (Public/Private)
- ✅ Owner Actions (visibility toggle, delete)
- ✅ All/Mine Entry Filtering
- ✅ API Key Management (create/revoke/copy)

## Backend

### API Modules
- ✅ auth (register/login/logout/me)
- ✅ entries (CRUD + visibility + owner filter)
- ✅ files (download/content)
- ✅ apikeys (create/list/revoke/cleanup)

### Auth Features
- ✅ User registration (first user always allowed + auto-admin)
- ✅ User login (JWT)
- ✅ User logout
- ✅ Get current user (me)
- ✅ Entry visibility (is_public, owner_id)
- ✅ Owner-only operations (toggle visibility, delete)
- ✅ Admin role (promote/demote, cross-user API key revoke)

### API Key Features
- ✅ User-level API keys (pv_ prefix)
- ✅ HMAC-SHA256 key hashing
- ✅ Key expiration support
- ✅ Max 10 active keys per user
- ✅ Global master key (PEEKVIEW_SERVER__API_KEY) — ownerless entries
- ✅ pv_ prefix passthrough in middleware
- ✅ Throttled last_used_at updates

### Database Features
- ✅ Full-Text Search (FTS5)
- ✅ Users table (bcrypt password hashing)
- ✅ API Keys table (HMAC-SHA256 key hashing)
- ✅ Entry visibility (is_public, owner_id)

## CLI Commands

| Command | Status | Notes |
|---------|--------|-------|
| create | ✅ | Local + Remote + --visibility |
| list | ✅ | Local + Remote + --tag |
| get | ✅ | Local + Remote |
| delete | ✅ | Local + Remote |
| serve | ✅ | |
| config | ✅ | |
| service | ✅ | systemd/launchd |
| api | ✅ | endpoints/openapi |
| user create | ✅ | |
| user list | ✅ | |
| user promote | ✅ | |
| user demote | ✅ | |
| login | ✅ | Remote mode |
| apikey create | ✅ | Remote mode |
| apikey list | ✅ | Remote mode |
| apikey revoke | ✅ | Remote mode |
| apikey cleanup | ✅ | Remote mode |

## Remote CLI Mode

- ✅ PeekClient HTTP client
- ✅ Transparent mode switching
- ✅ Config file support
- ✅ Environment variables
- ✅ API Key authentication (global + user-level)
- ✅ JWT user authentication
- ✅ Binary file detection
- ✅ Integration tests

## HTML Rendering

- ✅ HTML files rendered as webpages (Blob URL iframe sandbox)
- ✅ Minimal sandbox: `allow-scripts` only, no `allow-forms` / `allow-popups`
- ✅ Relative path detection with warning bar (DOMParser, static attributes only)
- ✅ Large file handling: < 512KB auto / 512KB~2MB warning / > 2MB manual trigger
- ✅ Multi-file entry: `.html` → iframe, other files → CodeViewer / MarkdownViewer
- ✅ Copy HTML source (tooltip clarifies source code, not rendered text)
- ✅ iframe load/error state with Loading indicator
