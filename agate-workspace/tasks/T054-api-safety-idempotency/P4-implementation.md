---
phase: P4
task_id: T054
type: implementation
parent: P3-test-cases.md
trace_id: T054-P4-20260714
status: draft
created: 2026-07-14
agent: implementer
---

# T054 P4: Implementation

## implementation_dir

```
backend/peekview/
├── config.py                    # A: host default → 127.0.0.1
├── cli.py                       # A: --host help + config list description
├── models.py                    # D: idempotency_key on Entry + CreateEntryRequest + validator
├── database.py                  # D: idempotency_key migration + _setup_indexes; F: docstring
├── api/
│   ├── entries.py               # B: @limiter.shared_limit; D: idempotent 200/201
│   └── rate_limit.py            # B: entries_rate_limit provider + setter
├── services/
│   ├── entry_service.py         # D: idempotency logic + _find_by_idempotency_key + tuple return
│   └── share_service.py         # E: text() → ORM select(func.count()) + update() constructor
└── pyproject.toml               # C: passlib → bcrypt

packages/mcp-server/src/
├── types.ts                     # D: idempotency_key in CreateEntryRequest
└── tools/createEntry.ts         # D: Zod schema + inputSchema + handler pass idempotency_key

backend/tests/
├── test_config.py               # A: updated host default assertion
├── test_entry_service.py        # D: tuple unpacking for create_entry
├── test_fts_content.py          # D: tuple unpacking for create_entry
├── test_user_page.py            # D: tuple unpacking for create_entry
├── test_t054_e_share_sql.py     # D: tuple unpacking for create_entry
└── test_t054_d_idempotency.py   # D: tuple unpacking for create_entry
```

## Changes by Requirement

### A: Default host → 127.0.0.1

| File | Change |
|------|--------|
| `config.py:152` | `default="0.0.0.0"` → `default="127.0.0.1"`, description updated |
| `cli.py:141` | `--host` help: `default: 0.0.0.0` → `default: 127.0.0.1` |
| `cli.py:739` | config list: `0.0.0.0 为所有接口` → `127.0.0.1 仅本地，0.0.0.0 所有接口` |
| `tests/test_config.py:108` | Updated assertion to match new default |

### B: Write-endpoint rate limiting

| File | Change |
|------|--------|
| `api/rate_limit.py` | Added `_entries_limit_provider`, `entries_rate_limit()`, `set_entries_rate_limit()` |
| `main.py:387-399` | Import + call `set_entries_rate_limit(entries_limit)` |
| `api/entries.py` | Added `@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)` on create/update/delete |

[DESIGN_GAP: P2 specified `@limiter.limit()` per-endpoint, but B4 test requires shared rate limit counter across POST/PATCH/DELETE. Used `@limiter.shared_limit(scope="entries_write")` with `override_defaults=False` to combine shared entries limit with default_limits. This ensures: (1) entries write endpoints share a single rate limit counter, (2) default_limits still apply, (3) B1-B4 all pass.]

### C: Remove passlib

| File | Change |
|------|--------|
| `pyproject.toml:35` | `"passlib[bcrypt]>=1.7.4"` → `"bcrypt>=4.0.0"` |

### D: Create-endpoint idempotency key

| File | Change |
|------|--------|
| `models.py` | Entry: added `idempotency_key: str \| None` column (max_length=128, nullable) |
| `models.py` | CreateEntryRequest: added `idempotency_key: str \| None` field + `@field_validator` rejecting empty strings |
| `database.py` | `_run_migrations()`: ALTER TABLE adding idempotency_key column; `_setup_indexes()`: CREATE UNIQUE INDEX partial (WHERE NOT NULL) |
| `services/entry_service.py` | `create_entry`: returns `tuple[CreateEntryResponse, bool]`; idempotency check before creation; IntegrityError catch enhanced |
| `services/entry_service.py` | Added `_find_by_idempotency_key()` helper method |
| `services/entry_service.py` | `_retry_with_slug_suffix`: accepts + passes `idempotency_key`, returns `tuple` |
| `api/entries.py` | `create_entry` route: unpacks tuple, returns 200 (JSONResponse) on idempotent hit, 201 on new create |
| `cli.py` | `create` command: handles tuple return from EntryService vs PeekClient |
| `packages/mcp-server/src/types.ts` | Added `idempotency_key?: string` to CreateEntryRequest |
| `packages/mcp-server/src/tools/createEntry.ts` | Zod schema + inputSchema + handler all include idempotency_key |

[DESIGN_GAP: P2 did not specify how to handle the `_setup_indexes` always-run requirement. The partial unique index for idempotency_key must exist even when `init_db(run_migrations=False)`, because `create_all()` doesn't create partial indexes. Added `_setup_indexes(engine)` called always from `init_db`, similar to `setup_fts5()`.]

### E: share_service text() SQL unification

| File | Change |
|------|--------|
| `services/share_service.py:11` | `from sqlalchemy import text` → `from sqlalchemy import func, update` |
| `services/share_service.py:68-74` | `text("SELECT COUNT(*)...")` → `select(func.count()).select_from(EntryShare).where(...)` |
| `services/share_service.py:222-228` | `text("UPDATE entry_shares SET view_count...")` → `update(EntryShare).where(...).values(view_count=EntryShare.view_count + 1)` |

### F: Migration comment

| File | Change |
|------|--------|
| `database.py:39-52` | `_run_migrations` docstring expanded to mention `create_all()` handles CREATE TABLE, this function only handles ALTER TABLE |

## Test Results

- **T054 tests**: 37 passed, 1 skipped (D6 MCP Zod schema test - expected skip)
- **Full backend test suite**: 888 passed, 2 skipped
- **MCP test suite**: 220 passed
- **Lint**: No new errors introduced by T054 changes

## Existing Test Updates

The `create_entry` return type changed from `CreateEntryResponse` to `tuple[CreateEntryResponse, bool]`. Updated unpacking in:
- `tests/test_entry_service.py` (26 calls → `result, _ = ...`)
- `tests/test_fts_content.py` (19 calls → `result, _ = ...`)
- `tests/test_user_page.py` (19 calls → fire-and-forget, no change needed)
- `tests/test_t054_e_share_sql.py` (1 call → `entry, _ = ...`)
- `tests/test_t054_d_idempotency.py` (3 calls → `r, _ = ...`)
