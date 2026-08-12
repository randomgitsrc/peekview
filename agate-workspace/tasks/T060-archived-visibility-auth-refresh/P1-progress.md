## P1 Analyst Progress

### Input: P0-brief.md
- 4 problems identified: A (archived mixed in All/Mine), B (login no refresh), C (logout no reload), D (auth-expired no refresh)
- Security invariants: 404-not-403, anonymous can't see archived, non-owner can't see archived
- Pruning tendency: conservative (permission model changes → P3/P6 not prunable)

### Input: entry_service.py (lines 362-535)
- Default query (no status param): authenticated non-admin users get `(status != ARCHIVED) | (owner_id == current_user_id)` — own archived mixed in
- status=archived: admin sees all, non-admin owner sees own only, anonymous gets empty
- status=active: no special logic, just `Entry.status == status`
- **Finding**: The "default includes own archived" is intentional in current code (comment line 390) but contradicts user mental model

### Input: api/entries.py (lines 190-223)
- List endpoint passes status param through to service; no additional filtering
- No default status applied at API level

### Input: EntryListView.vue (lines 36-55, 328-334, 379-384, 444-455)
- Tabs: All (owner=null, status=null), Mine (owner='me', status=null), Archived (owner=null, status='archived')
- authState watcher (line 444-455): ONLY handles `?owner=me` URL param → sets filter to Mine. Does NOT reload on auth change otherwise.
- handleLogout (line 379-384): calls authStore.logout() + filterPrivateEntries() (client-side filter only)
- setFilter calls loadEntries with appropriate params

### Input: auth.ts (full)
- login(): sets user.value, no event dispatch
- logout(): calls api.logout(), sets user=null, no event dispatch
- peekview:auth-expired listener: sets user=null, no other action
- **Finding**: No mechanism to notify EntryListView that auth state changed (no event, no store action)

### Input: entry.ts (full)
- filterPrivateEntries(): client-side `entries.filter(e => e.isPublic)` — doesn't remove archived entries that are public
- **Finding**: filterPrivateEntries after logout won't remove public archived entries if those were showing (though currently archived only shows in Archived tab)
- **Finding**: No loadEntries call after auth change; stale data remains

### Input: LoginDialog.vue (lines 187-215)
- After successful login: just closes dialog, no list reload trigger
- **Finding**: LoginDialog doesn't emit any event or call any store method to trigger list refresh

### Input: client.ts (full)
- 401 interceptor: posts /auth/logout, dispatches 'peekview:auth-expired', rejects promise
- **Finding**: auth-expired event is handled by auth store (sets user=null) but EntryListView doesn't listen to it for list refresh

### Input: MCP listEntries
- MCP client.listEntries() does NOT pass status param → gets default behavior (includes own archived for authenticated users)
- MCP list_entries tool has no status param in schema
- **Implicit need**: If backend default changes to exclude archived, MCP behavior changes too (no status param = active only). Should MCP gain a status param?

### Input: CLI list
- CLI list command has --status option, passes through correctly
- No implicit need for CLI changes if default behavior changes

### P1-requirements.md written
- 14 BDD conditions (A1-A7, B1-B2, C1-C2, D1, M1-M2)
- 1 [NEED_CONFIRM]: Admin All tab archived visibility (建议选 A，已写 BDD 按 A)
- 8 implicit needs identified
- domains: backend, frontend, mcp, security
- risk_level: medium
- phases: P1-P8 (no pruning, per P0-brief conservative tendency)
- capability_requirements: browser-vision (available), debug-backend (available)
