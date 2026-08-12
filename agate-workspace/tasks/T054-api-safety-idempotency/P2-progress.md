# T054 P2 Progress Log

## 2026-07-14 — Input reading phase

### P0-brief findings
- 6 sub-needs (A-F), all backend except MCP createEntry.ts
- Risk: medium (breaking change for host default + migration needed)
- P0 declares idempotency_key needs migration, view_count update() compat unknown

### P1-requirements findings
- 25 BDD conditions (A1-A4, B1-B6, C1-C2, D1-D10, E1-E2, F1)
- Key design decisions already made:
  - idempotency_key: NULLable + UNIQUE constraint + owner binding (409 on cross-user)
  - Empty string "" treated as invalid (422)
  - max_length=128
  - Key lifecycle tied to entry (delete entry → key cleared)
  - Entries 3 write endpoints all need explicit @limiter.limit()
  - B6: explicit decorator priority > default_limits

### P1-dispatch-context findings
- config.py:152 — host default "0.0.0.0"
- cli.py:141 — help text says "default: 0.0.0.0"
- api/entries.py:131 — create_entry has no @limiter
- share_service.py:68-74 — text() SELECT COUNT; :222-228 — text() UPDATE view_count

### Code analysis completed

**config.py**:
- PeekServer.host default="0.0.0.0" (line 152) — change to "127.0.0.1"
- host description mentions "0.0.0.0" — update

**api/entries.py**:
- create_entry (line 130-181): no @limiter, status_code=201
- update_entry (line 335-385): no @limiter
- delete_entry (line 388-414): no @limiter
- create_entry returns service.create_entry() directly — needs wrapper for 200 vs 201

**entry_service.py**:
- create_entry (line 132-311): IntegrityError caught for slug collision → _retry_with_slug_suffix
- Pattern for IntegrityError handling: try/except with specific handling
- idempotency_key needs: add to Entry model, check before insert, catch IntegrityError for race
- current_user_id already passed — needed for owner-bound idempotency check

**models.py**:
- Entry model (line 181-225): no idempotency_key column
- CreateEntryRequest (line 538-550): needs idempotency_key field
- ConflictError already exists in exceptions.py (line 100-107) — can reuse for 409

**share_service.py**:
- Line 68-74: text("SELECT COUNT(*) FROM entry_shares WHERE...") — change to ORM
- Line 222-228: text("UPDATE entry_shares SET view_count = view_count + 1 WHERE...") — change to update() constructor

**database.py**:
- _run_migrations pattern: check columns with PRAGMA, ALTER TABLE ADD COLUMN
- Migration for idempotency_key: same pattern, add column + unique index
- Entry table column check already uses PRAGMA table_info

**rate_limit.py**:
- limiter = Limiter(key_func=get_remote_address, swallow_errors=True)
- Pattern: provider function (e.g., login_rate_limit) + setter (set_login_rate_limit)
- main.py sets default_limits = [captcha_limit] (60/min)
- Need: entries_rate_limit provider + setter, or reuse rate_limit_per_minute

**auth.py**:
- Uses `import bcrypt as _bcrypt` (line 16) — confirms passlib not used
- hash_password/verify_password use _bcrypt directly

**cli.py**:
- Line 141: help text "default: 0.0.0.0" → "default: 127.0.0.1"
- Line 739: description "(0.0.0.0 为所有接口)" → update

**MCP createEntry.ts**:
- Zod schema: no idempotency_key — add z.string().optional()
- inputSchema: add idempotency_key property
- handler: pass idempotency_key to client.createEntry

**MCP client.ts**:
- createEntry method: CreateEntryRequest type from types.ts
- Need: add idempotency_key to CreateEntryRequest interface

**MCP types.ts**:
- CreateEntryRequest: add idempotency_key?: string

**pyproject.toml**:
- Line 35: "passlib[bcrypt]>=1.7.4" → "bcrypt>=4.0.0"

### Key design decisions identified

1. **idempotency_key race handling**: MUST use UNIQUE constraint + IntegrityError catch (same pattern as slug collision). The "check then insert" has TOCTOU, so rely on DB constraint as the source of truth.

2. **200 vs 201 status code**: create_entry in entry_service currently returns CreateEntryResponse. The API layer (entries.py) sets status_code=201 on the route. When idempotency hits an existing entry, need to return 200. Two approaches:
   - A: entry_service returns a flag indicating idempotency hit, entries.py adjusts status_code
   - B: entry_service raises a special result that entries.py catches and returns 200

3. **Rate limit for entries**: Add `entries_rate_limit` provider function (same pattern as login/captcha), reuse `rate_limit_per_minute` config value. Explicit decorator on all 3 write endpoints.

4. **view_count update()**: Use SQLAlchemy `update()` constructor with `values(view_count=EntryShare.view_count + 1)`. Need to verify SQLModel session.exec() compatibility.

5. **Migration for idempotency_key**: Follow existing pattern in _run_migrations — PRAGMA check + ALTER TABLE ADD COLUMN + CREATE UNIQUE INDEX.

