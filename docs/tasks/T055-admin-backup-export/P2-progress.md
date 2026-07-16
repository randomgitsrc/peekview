# P2 Progress Log

## 2026-07-17 Read Input Files

### P0-brief.md findings
- Task: add backup/export/restore CLI commands to admin group
- env: make debug-start (:8888, /tmp/peekview-debug/)
- Packages: backend/peekview/ only
- Risk: medium-high (restore is destructive, ID remapping, FS+DB atomicity)

### P1-requirements.md findings
- 19 BDD conditions (BDD-01 to BDD-17 + BDD-11a/11b)
- 10 implicit requirements (I1-I10)
- 3 decisions made: C1=merge default+--replace, C2=export local only, C3=timestamp filename
- P7 skipped (single backend package, no UI/MCP)

### P2-dispatch-context.md findings
- FK chain: users→entries(CASCADE), users→api_keys, entries→files, entries→entry_shares, users→entry_shares(created_by)
- entry_reads: entry_id has index but NO explicit FK
- AdminService: __init__(engine, storage, config), methods: get_stats, cleanup_expired, list_users, delete_user, reset_password
- CLI admin group at cli.py:1924, _get_admin_service() at cli.py:1899
- CONFIG_FILE = ~/.peekview/config.yaml (config.py:14)
- .secret_key and .captcha_secret in ~/.peekview/ (data_dir root)
- Version: __version__ = "0.6.3" in __init__.py

### Source code analysis

#### cli.py (1890-2050)
- _get_admin_service() returns AdminService (local) or PeekClient (remote)
- admin_cmd group at line 1924, subcommands: stats, cleanup
- Pattern: each command calls _get_admin_service(config, remote_url), checks is_remote, dispatches

#### admin_service.py
- Clean DI pattern: engine, storage, config
- get_stats() and cleanup_expired() are existing patterns
- No backup/export/restore methods yet

#### models.py
- Entry: id, slug(UNIQUE), summary, status, tags(JSON), user_id, is_public, owner_id(FK users.id CASCADE), expires_at, archived_at, idempotency_key
- File: id, entry_id(FK entries.id), path, filename, language, is_binary, size, sha256, line_count
- User: id, username(UNIQUE), password_hash, display_name, is_active, is_admin
- ApiKey: id, user_id(FK users.id), name, key_prefix, key_hash(UNIQUE), expires_at, last_used_at
- EntryShare: id, entry_id(FK entries.id), token_hash(UNIQUE), token_prefix, expires_at, max_views, view_count, created_by(FK users.id)
- EntryRead: id, entry_id(index, NO FK), action, channel, reader_type, reader_id, is_self_read, count, window_key(UNIQUE)

#### config.py
- PeekConfig auto-isolates in debug mode (PEEKVIEW_DEBUG_MODE=1 → /tmp/peekview-debug/)
- data_dir: ~/.peekview/data, db_path: ~/.peekview/peekview.db
- .secret_key at ~/.peekview/.secret_key, .captcha_secret at ~/.peekview/.captcha_secret

#### database.py
- WAL mode, close_engine() does PRAGMA wal_checkpoint(TRUNCATE)
- rebuild_fts_index(engine, storage) exists and works
- setup_fts5() creates FTS5 virtual table + triggers
- init_db() creates engine with all pragmas

#### storage.py
- get_entry_data_dir(config, entry_id) → data_dir / "default" / str(entry_id)
- delete_entry_files() uses shutil.rmtree
- write_file_atomic() uses temp+rename pattern
- StorageManager wraps config-based operations

#### Key files for backup
- ~/.peekview/peekview.db (WAL mode)
- ~/.peekview/data/default/{entry_id}/ (file storage)
- ~/.peekview/config.yaml
- ~/.peekview/.secret_key
- ~/.peekview/.captcha_secret (may not exist)

## 2026-07-17 Design Complete

### Candidate designs evaluated
- **Candidate A**: SQLite `.backup()` API + staged restore with ID remap table
  - Pros: official SQLite online backup, streaming, consistent snapshot, Python stdlib only
  - Cons: merge restore file copy after DB commit creates potential orphans
- **Candidate B**: WAL checkpoint + filesystem copy
  - Pros: simpler code
  - Cons: race condition between checkpoint and copy violates BDD-01 consistency requirement
- **Decision**: Candidate A — `.backup()` API is the correct approach for WAL-mode consistent snapshots

### Key design decisions
1. Backup: `sqlite3.Connection.backup()` via `engine.raw_connection()` for consistent snapshot
2. Restore merge: single DB transaction wrapping all INSERTs, file copies after commit
3. Restore replace: staging dir approach, atomic rename swap
4. ID remap: in-memory dicts per table (user_map, entry_map, file_map, share_map)
5. Slug conflict: `{slug}-{n}` suffix pattern
6. entry_reads: remap entry_id/reader_id, suffix window_key on conflict
7. FTS5: call existing `rebuild_fts_index()` after restore
8. Atomicity: DB transaction rollback for merge; staging+rename for replace
9. No new dependencies — Python stdlib only (sqlite3, tarfile, hashlib, shutil, json)

### BDD coverage: all 19 conditions mapped to design sections
### No SCOPE-PLUS discovered
### minimal_validation: not_needed (pure code logic + Python stdlib)
