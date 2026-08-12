# P2 Progress Log

## Input File Reading

### P2-dispatch-context-architect.md
- Key constraints: 404-not-403 immutable, anonymous/non-owner archived invisibility immutable, Admin All tab excludes archived (confirmed A), logout must match anonymous permissions
- Objective info confirms: entry_service.py line 406-411 own archived mixed in, admin line 412-413 no status filter, authState watcher only handles ?owner=me, handleLogout only calls filterPrivateEntries(), 401 interceptor no filterPrivateEntries call, MCP listEntries no status param

### P0-brief.md
- 4 problems: A (archived mixed in All/Mine), B (login no refresh), C (logout no re-fetch), D (auth expiry no refresh)
- debug_env: make debug (:8888, /tmp/peekview-debug/)
- pruning_tendency: conservative (P3/P6 cannot be pruned)

### P1-requirements.md
- 18 BDD conditions: A1-A7,A1b-A3b (archived visibility), B1-B2 (login refresh), C1-C2 (logout refresh), D1-D2 (auth expiry refresh), M1-M3 (MCP)
- 8 implicit requirements identified
- Key: 2.3 logout filterPrivateEntries doesn't remove archived public entries
- Key: 2.6 MCP needs status parameter
- risk_level: medium, domains: backend/frontend/mcp/security

### entry_service.py (lines 362-535)
- list_entries: status param exists but default (None) behavior is the problem
- Line 404-416: else branch (no status) - current_user_id and not is_admin → (status != ARCHIVED) | (owner_id == current_user_id) — this is the bug, own archived mixed in
- Line 412-413: admin gets no status filter at all (sees everything including archived)
- Line 414-416: anonymous correctly excludes archived
- status=archived branch: admin sees all, auth user sees own only, anonymous gets empty

### entries.py (API routes)
- Line 190-223: list_entries endpoint, status Query param already exists
- Passes status through to service.list_entries
- No validation on status values

### EntryListView.vue
- Line 379-384: handleLogout only calls authStore.logout() + entryStore.filterPrivateEntries() + toast
- Line 444-455: authState watcher only handles ?owner=me URL param case
- Line 328-334: setFilter handles owner + status, calls loadEntries with both
- Line 258-260: showTabs only when authenticated && !isBannerMode
- Line 476-482: onMounted calls restoreFromURL + loadEntries

### auth.ts
- Line 48-51: logout() calls api.logout() + sets user=null
- Line 63-67: peekview:auth-expired listener sets user=null only
- No entry store interaction in auth store

### entry.ts
- Line 175-178: filterPrivateEntries only filters e.isPublic — doesn't handle archived
- Line 53-72: loadEntries calls API with params

### LoginDialog.vue
- Line 187-215: submit() calls authStore.login/register, shows toast, closes dialog
- No entry store interaction after login

### client.ts
- Line 19-28: 401 interceptor dispatches peekview:auth-expired event
- Line 107-126: listEntries already passes status param to API

### MCP listEntries.ts
- Line 6-11: schema has query, tags, page, per_page — NO status parameter
- Line 28-34: handler calls client.listEntries without status

### MCP client.ts
- Line 97-112: listEntries method has no status parameter
- URL params: page, per_page, q, tags — no status

## Design Completion

### Key Design Decisions
1. **方案 A（推荐）**：后端默认排除 + 前端统一重载。退出/auth 过期后统一重载 API，不用客户端过滤
2. **authState watcher 统一处理**：登录/退出/auth 过期都通过 watcher 触发重载，handleLogout 简化为先重置 tab 再调 logout
3. **MCP z.enum 校验**：status 参数用 zod enum 校验，非法值不传后端；后端 422 是二道防线
4. **filterPrivateEntries 保留不删**：标记废弃但不破坏，确认无调用者后可删

### minimal_validation
- 客观查证 + 代码阅读已确认假设，无需额外 curl 验证

### P2-design.md written
- 2 候选方案 + 权衡 + 选择理由
- 四字段齐全
- files_to_read 精确到行号
- env_constraints 继承 P0-brief
