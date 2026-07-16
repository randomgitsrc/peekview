## P1 Progress — analyst agent

### 2026-07-16 — Initial reads

**P0-brief key points:**
- 3 commands: backup, export, restore
- backup: WAL checkpoint → .backup API → copy data dir → copy config.yaml → tar.gz
- export: single entry as JSON (base64 files) or ZIP
- restore: version compat + ID conflict handling
- Known risks: large DB backup time, restore version compat, restore ID conflicts
- P3 kept, P6 simplified, P7 skippable

**P1-dispatch-context key facts:**
- admin_cmd group at cli.py:1925, _get_admin_service() at cli.py:1899
- AdminService: __init__(engine, storage, config), get_stats(), cleanup_expired(), list_users(), delete_user(), reset_password()
- CONFIG_FILE at ~/.peekview/config.yaml (config.py:14)
- load_config_file() / save_config_file() already exist
- DB: SQLite WAL, path via PEEKVIEW_STORAGE__DB_PATH
- Data dir: PEEKVIEW_STORAGE__DATA_DIR

**Next:** Read cli.py (admin section), admin_service.py, config.py for deeper understanding

### 2026-07-16 — Source code analysis

**cli.py (1895-2055):**
- `_get_admin_service()` at line 1899: returns AdminService (local) or PeekClient (remote)
- AdminService constructor: `engine, storage, config`
- admin_cmd group at line 1925 with `stats` and `cleanup` subcommands
- Pattern: `config = PeekConfig()` → `backend = _get_admin_service(config, ...)` → call method
- Remote mode via `--remote-url` or `PEEKVIEW_REMOTE__URL` — backup/restore should be LOCAL ONLY (remote doesn't have filesystem access)

**admin_service.py:**
- AdminService has: `self.engine`, `self.storage` (StorageManager), `self.config` (PeekConfig)
- No backup/export/restore methods yet
- Uses EntryService for cascading deletes — similar pattern likely for restore
- `cleanup_expired()` shows pattern: query entries → modify → commit

**config.py:**
- `CONFIG_FILE = Path.home() / ".peekview" / "config.yaml"` (line 14)
- `load_config_file()` / `save_config_file()` already exist
- PeekConfig has `.data_dir` and `.db_path` shortcuts
- Debug mode: `PEEKVIEW_DEBUG_MODE=1` → isolated to `/tmp/peekview-debug/`
- Config priority: env vars > constructor args > config file > defaults

**Key finding: backup/restore are inherently local operations** — remote PeekClient cannot access filesystem. CLI should refuse remote mode for these commands.

**Next:** Check database.py for SQLite engine creation, and models.py for schema structure

### 2026-07-16 — Deep source code analysis

**database.py:**
- `init_db()` creates engine with WAL mode pragmas
- `close_engine()` does WAL checkpoint (TRUNCATE) before dispose — important: backup should also checkpoint first
- Engine is SQLAlchemy, raw connection accessible via `engine.raw_connection()` for SQLite `.backup()` API
- FTS5 is contentless+contentless_delete mode — backup must include FTS5 virtual table data (SQLite .backup handles this)
- `check_schema()` compares actual DB columns vs SQLModel metadata — useful for restore version check

**models.py:**
- Tables: users, entries, files, api_keys, entry_shares, entry_reads
- Entry has: id (auto-increment), slug (unique), owner_id (FK→users), is_public, expires_at, archived_at, idempotency_key
- File has: id (auto-increment), entry_id (FK→entries), path, filename, language, is_binary, size, sha256, line_count
- EntryShare has: entry_id, token_hash, token_prefix, created_by (FK→users)
- EntryRead has: entry_id, reader_id, window_key (unique)
- Foreign key chains: users→entries→files, users→api_keys, users→entry_shares, entries→entry_reads
- ID reassignment on restore must handle ALL these FK chains

**storage.py:**
- Files stored at `{data_dir}/default/{entry_id}/` — entry_id is the directory name
- StorageManager wraps config-based operations
- `delete_entry_files()` uses `shutil.rmtree()`
- `get_entry_data_dir()` returns `data_dir / "default" / str(entry_id)`

**Key implicit requirements identified:**
1. **WAL checkpoint before backup** — database.py already has `close_engine()` doing TRUNCATE checkpoint; backup should do the same
2. **FTS5 in backup** — SQLite .backup API handles virtual tables, but restore must rebuild FTS5 if schema changes
3. **entry_reads and entry_shares** — P0-brief didn't mention these tables; they must be included in backup
4. **File storage keyed by entry_id** — if IDs are reassigned during restore, file directories must be renamed too
5. **Secret key file** — `~/.peekview/.secret_key` exists (referenced in config.py auth.secret_key description); should be in backup
6. **Version tracking** — need to find where version is stored

**Next:** Check version tracking mechanism

### 2026-07-16 — Version and filesystem layout analysis

**Version tracking:**
- `peekview/__init__.py`: `__version__ = "0.6.3"` — this is the source of truth
- `pyproject.toml` also has `version = "0.6.3"` (kept in sync by bump-version)
- Backup must record this version in metadata for restore compatibility check

**~/.peekview/ directory contents (production):**
- `peekview.db` + `-shm` + `-wal` (SQLite WAL files)
- `data/` (entry file storage)
- `config.yaml` (user configuration)
- `.secret_key` (JWT signing key, auto-generated if absent)
- `.captcha_secret` (captcha JWT signing key)
- `mcp-config.yaml` (MCP server config — NOT part of peekview core backup)

**Critical discovery — secret keys:**
- `.secret_key` is the JWT signing key. If not backed up, restore will auto-generate a new one → ALL existing JWT tokens become invalid → all users must re-login
- `.captcha_secret` similarly — captcha tokens would break
- These are "dotfiles" that P0-brief didn't mention. They MUST be in backup for full recovery.

**Backup contents should be (refined):**
1. `peekview.db` (via SQLite .backup API)
2. `data/` directory (file storage)
3. `config.yaml` (user config)
4. `.secret_key` (JWT signing key)
5. `.captcha_secret` (captcha signing key)
6. `metadata.json` (version, timestamp, etc.) — NEW, needed for restore version check

**Next:** Read WORKFLOW.md for phase rules, then produce P1-requirements.md

### 2026-07-16 — Test infrastructure check

**Existing admin tests:** `test_admin_stats_cleanup.py`, `test_admin_perm.py`, `test_admin_user_api.py`
**Existing CLI tests:** `test_cli.py`, `test_cli_remote.py`
**Shared fixtures:** `conftest.py` + `factories.py` with temp dirs, test DB, async client
**Test pattern:** pytest with isolated tmp_path (auto-isolated by conftest.py)

**No existing backup/export/restore tests** — will need new test files.

### 2026-07-16 — Implicit requirements analysis (5 Whys)

**Why does backup need .secret_key?**
→ Without it, restore generates a new secret → all existing JWT tokens invalid → all users forced to re-login → broken UX for multi-user setups
→ Must include in backup

**Why does restore need ID reassignment?**
→ Backup from instance A has entry IDs 1,2,3. Instance B already has entries 1,2,3. If we just import, FK relationships break and slugs collide.
→ Two strategies: (a) wipe-and-replace (destructive), (b) merge with ID remapping (complex)
→ P0-brief says "restore 时重新分配 ID" — but what about slug collisions? slug is UNIQUE.
→ This is a design decision that affects behavior significantly.

**Why does export need a specific format?**
→ Export is for single-entry portability (sharing, archiving, migration to another instance)
→ JSON format is human-readable; ZIP includes actual files
→ Both need to capture: entry metadata + file contents + file metadata

**Why can't backup/restore work in remote mode?**
→ Remote mode uses PeekClient (HTTP API) — no filesystem access, no SQLite access
→ These are inherently local operations
→ CLI must refuse remote mode for backup/restore

**Implicit requirements identified:**
1. `.secret_key` and `.captcha_secret` must be in backup (P0 missed these)
2. Backup metadata must include version + timestamp for restore compatibility
3. Slug collision handling during restore (not just ID conflicts)
4. Backup must refuse remote mode; export could potentially work remotely (single entry via API)
5. Large backup size handling — should show progress or at least size estimate
6. Restore should have a --dry-run option to preview what would happen
7. Backup should verify integrity after creation (checksum)
8. Restore must handle case where target DB has different schema version
9. FTS5 must be rebuilt after restore (schema might differ)
10. File storage uses entry_id as directory name — ID remapping must rename dirs

**Decisions that affect scope:**
- Should restore be destructive (replace all data) or merge? → P0 says "重新分配 ID" implies merge
- Should export work in remote mode? → Possible but not required by P0
- Should backup include WAL -shm/-wal files? → No, .backup API produces a clean DB

### 2026-07-16 — P1-requirements.md produced

**Self-check results:**
- File exists: 11912 bytes
- BDD conditions: 17 (BDD-01 through BDD-17)
- Given/When/Then statements: 51
- domains/packages/risk_level: declared
- NEED_CONFIRM: 0 (C1-C3 are advisory, not blocking — suggestions provided)
- GAP capabilities: 0 (all available)
- Header: correct (phase=P1, task_id=T055, trace_id=T055-P1-20260716)

**Key deliverables in P1-requirements.md:**
1. Requirements restatement (3 commands)
2. 10 implicit requirements identified (I1-I10) — beyond P0-brief
3. 17 BDD acceptance conditions with Given/When/Then
4. 3 advisory items (C1-C3) with suggestions
5. Phase trimming: P7 skipped, P6 simplified
6. Scope: backend/peekview only, no frontend/MCP
7. Capability requirements: all available (sqlite3, pytest, tarfile)
