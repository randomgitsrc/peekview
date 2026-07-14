## P1 Progress Log

### Input: P0-brief.md read
- 6 sub-needs (A-F): host default, rate limit, passlib→bcrypt, idempotency key, text() SQL, migration comments
- Risk: host default change may break existing deployments; idempotency_key needs migration; view_count update() compatibility
- P6 simplified (no Playwright), P7 can be cut

### Input: P1-dispatch-context.md read
- Confirmed: config.py:152 host="0.0.0.0", cli.py:141 help text says "default: 0.0.0.0"
- create_entry at entries.py:131 has no @limiter
- share_service.py:68-74 text() SELECT COUNT, :222-228 text() UPDATE view_count
- idempotency_key needs: model column, request field, service logic, migration, MCP param

### Input: Code files read
- config.py: PeekServer.host default="0.0.0.0" at line 152
- entries.py: create_entry (POST) at line 130, update_entry (PATCH) at 335, delete_entry (DELETE) at 388 — none have @limiter
- share_service.py: 2 text() usages at lines 68-74 (SELECT COUNT) and 222-228 (UPDATE view_count)
- models.py: Entry model (line 181), CreateEntryRequest (line 538) — no idempotency_key field
- database.py: _run_migrations pattern (PRAGMA table_info + ALTER TABLE)
- entry_service.py: create_entry at line 132, IntegrityError handling at 295 (slug collision retry)
- cli.py: --host help at line 141 says "default: 0.0.0.0"
- createEntry.ts: No idempotency_key parameter in schema

### All write endpoints identified (19 total across 7 routers)
- entries: POST create, PATCH update, DELETE delete
- shares: POST create, POST revoke
- admin: POST cleanup, DELETE user, POST reset-password
- captcha: POST challenge, POST redeem, POST siteverify
- apikeys: POST create, DELETE expired, DELETE by-id
- auth: POST register, POST login, POST logout, DELETE me, POST change-password

### Key findings for implicit requirements
1. **Idempotency key race condition**: Two concurrent requests with same key → need UNIQUE constraint + IntegrityError catch (same pattern as slug collision)
2. **Rate limit scope**: P0 says "create_entry" only, but update_entry and delete_entry are also unprotected writes. Shares create/revoke too.
3. **Host default backward compat**: CLI help text, config list description, systemd service template (ExecStart=peekview serve → now binds 127.0.0.1 not 0.0.0.0)
4. **view_count update()**: SQLModel session.exec() with SQLAlchemy core update() — need to verify return type handling
5. **MCP createEntry.ts**: schema needs idempotency_key optional field, handler needs to pass it through
6. **Entry deletion clears idempotency_key**: CASCADE delete handles this naturally (key column on entries table)

### P1-requirements.md written
- 16 BDD conditions (Given/When/Then) across A-F
- 13 implicit requirements identified (ID-1 to ID-13)
- 2 [NEED_CONFIRM] items: NC-1 (rate limit scope), NC-2 (key reuse after deletion)
- No [CAPABILITY_GAP] — all capabilities available
- Phases: P1-P6,P8 (P7 cut)
- Risk level: medium (breaking change in host default)
