---
phase: P2
task_id: T055
type: design
parent: P1-requirements.md
trace_id: T055-P2-20260716
status: draft
created: 2026-07-16
agent: architect
---

# T055: Admin Backup/Export — Technical Design

## 0. Declarations

```yaml
packages: [backend/peekview/]
domains: [backup, export, restore, cli]
ui_affected: false
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
env_constraints:
  debug_env: "make debug-start"
  isolation_check: "PEEKVIEW_DEBUG_MODE=1 auto-isolates to /tmp/peekview-debug/"
files_to_read:
  - path: backend/peekview/cli.py:1899-2050
    why: _get_admin_service() DI pattern + admin_cmd group registration, new commands follow this pattern
  - path: backend/peekview/services/admin_service.py
    why: Add backup/export/restore methods to existing AdminService class
  - path: backend/peekview/models.py:82-280
    why: Entry/File/User/ApiKey/EntryShare/EntryRead table definitions and FK chains for ID remapping
  - path: backend/peekview/config.py:14-15,103-145,342-343,360-413
    why: CONFIG_FILE path, PeekStorage (data_dir/db_path), DEBUG_DATA_DIR/DEBUG_DB_PATH, PeekConfig.__init__ debug isolation
  - path: backend/peekview/database.py:176-228,253-313,386-434
    why: init_db(), setup_fts5(), rebuild_fts_index() — needed for restore post-processing
  - path: backend/peekview/storage.py:22-33,145-204,300-316,413-494
    why: get_entry_data_dir(), write_file_atomic(), delete_entry_files(), StorageManager class
  - path: backend/peekview/auth.py:27-50
    why: SECRET_KEY_FILE path for backup inclusion
  - path: backend/peekview/api/captcha.py:57-64
    why: .captcha_secret file path for backup inclusion
  - path: backend/peekview/__init__.py:3
    why: __version__ string for metadata.json
minimal_validation:
  result: not_needed
```

## 1. 候选方案

### 候选方案 A: SQLite `.backup()` API + Staged Restore with ID Remap Table

**Approach**: Use Python `sqlite3.Connection.backup()` for consistent DB snapshots. Restore uses a two-pass strategy: (1) load backup DB into a temporary SQLite connection, (2) iterate tables in FK dependency order, remapping IDs via an in-memory `old_id → new_id` dict per table, inserting into the live DB within a single transaction.

**Backup flow**:
1. Open backup destination SQLite file
2. Call `source_conn.backup(dest_conn)` via SQLAlchemy `engine.raw_connection()`
3. WAL checkpoint on source after backup (optional, for cleanliness)
4. Copy `data_dir/default/{entry_id}/` directories via `shutil.copytree`
5. Copy `config.yaml`, `.secret_key`, `.captcha_secret` (if exists)
6. Compute SHA256 of each file written to tar
7. Write `metadata.json` with version + timestamp + file_checksums
8. Package as tar.gz

**Restore flow (merge mode)**:
1. Extract tar.gz to temp dir
2. Validate integrity (SHA256 checksums)
3. Check version compatibility
4. Open backup DB as read-only secondary connection
5. Build ID remap dicts: `user_id_map`, `entry_id_map`, `file_id_map`, `share_id_map`
6. Within a single DB transaction:
   a. Insert users (skip if username conflict → map to existing user ID)
   b. Insert entries (remap owner_id, resolve slug conflicts with `{slug}-{n}`)
   c. Insert files (remap entry_id)
   d. Insert entry_shares (remap entry_id, created_by)
   e. Insert entry_reads (remap entry_id, resolve window_key conflicts by appending suffix)
   f. Insert api_keys (remap user_id, skip if key_hash conflict)
7. Copy file storage directories: `{src_entry_id}/` → `{new_entry_id}/`
8. Rebuild FTS5 index
9. Commit transaction

**Restore flow (replace mode)**:
1. Same steps 1-3
2. Confirm with user (`--replace` flag required + interactive confirmation, or `--yes` to skip prompt)
3. Delete all data from target: files → entry_shares → entry_reads → entries → api_keys → users
4. Copy backup DB file directly over target DB (no ID remap needed)
5. Copy file storage directories directly
6. Copy config/secret files
7. Rebuild FTS5 index

**Atomicity for merge restore**: Single DB transaction wraps all INSERTs. File copies happen after DB commit. If file copies fail, track which entry IDs were committed and clean up orphaned DB rows + partial file directories on next `cleanup_expired()` or manual intervention. This is a known gap: true atomicity across DB+FS is impossible in SQLite. Mitigated by: (a) file copies are append-only (no existing data destroyed in merge mode), (b) orphan cleanup is safe.

**Atomicity for replace restore**: Write new data to temp paths, then swap: rename backup DB over target, rename backup data dir over target. Use temp dir as staging area. On failure, original files remain intact (rename is atomic on same filesystem).

**Pros**:
- `.backup()` API is the official SQLite recommendation for online consistent backups — handles WAL transparently
- ID remap table approach is straightforward, debuggable, works with any FK chain depth
- Single DB transaction for merge mode gives rollback on DB side
- Python stdlib only (`sqlite3`, `tarfile`, `hashlib`, `shutil`, `json`) — no new dependencies

**Cons**:
- Merge restore file copy after DB commit creates potential orphans on failure (mitigated but not eliminated)
- Replace mode requires careful filesystem staging to be atomic
- Large databases: `.backup()` is streaming (good), but merge restore loads all rows into Python memory for remapping

**Risk**: medium — DB+FS atomicity gap is inherent to SQLite. Mitigated by append-only semantics in merge mode.

### 候选方案 B: File-Level DB Copy + WAL Checkpoint

**Approach**: Instead of `.backup()` API, force a WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) then copy the DB file at filesystem level. Restore in merge mode uses raw SQL `INSERT OR IGNORE` with ID remapping.

**Backup flow**:
1. Execute `PRAGMA wal_checkpoint(TRUNCATE)` to flush WAL into main DB
2. Copy `peekview.db` file via `shutil.copy2`
3. Copy data dir, config, secrets, metadata as in Candidate A
4. Package as tar.gz

**Restore flow**: Same as Candidate A for merge/replace.

**Pros**:
- Simpler code — no secondary SQLite connection needed for backup
- `shutil.copy2` preserves file metadata

**Cons**:
- **WAL checkpoint is blocking** — during `PRAGMA wal_checkpoint(TRUNCATE)`, all writers are blocked. For a busy server, this could cause timeouts
- **Race condition**: between checkpoint and file copy, new writes can enter WAL. The copied DB file is NOT guaranteed to be a consistent snapshot of the checkpoint moment — it includes the checkpoint data plus any writes that occurred between checkpoint and copy completion
- Not the SQLite-recommended approach for online backups

**Risk**: medium-high — race condition means backup may not be fully consistent under concurrent write load. P1 BDD-01 requires "consistency snapshot, not filesystem-level copy".

### 选择理由与权衡: 候选方案 A

**Rationale**: Candidate A uses the SQLite `.backup()` API which is specifically designed for online consistent backups. It streams data from the source to destination without blocking writers and produces a transactionally consistent snapshot. Candidate B's checkpoint+copy approach has a race condition that violates BDD-01's consistency requirement. The `.backup()` API is available in Python 3.7+ (confirmed on the project's Python 3.12 runtime) and accessible via SQLAlchemy's `engine.raw_connection()`. The only downside of A (merge restore file copy orphan risk) is inherent to SQLite+FS and present in both candidates.

## 2. Impact Analysis

### What changes

| File | Change |
|------|--------|
| `services/admin_service.py` | Add `backup()`, `export_entry()`, `restore()` methods to AdminService |
| `cli.py` | Add `backup`, `export`, `restore` subcommands to `admin_cmd` group |
| `models.py` | Add `BackupMetadata`, `ExportEntry`, `RestorePreview` Pydantic schemas (non-table models, CLI-internal only) |
| `tests/test_backup_restore.py` | New test file for backup/export/restore logic |

### What does NOT change

| File/Component | Why unchanged |
|----------------|--------------|
| `database.py` | `rebuild_fts_index()` and `init_db()` are called, not modified |
| `storage.py` | Existing `get_entry_data_dir()`, `delete_entry_files()`, `write_file_atomic()` are reused as-is |
| `config.py` | Read-only: `CONFIG_FILE`, `data_dir`, `db_path` are consumed, not modified |
| `auth.py` | `SECRET_KEY_FILE` path is read for backup, not modified |
| `api/` routes | No new API endpoints — CLI-only |
| `frontend-v3/` | No UI changes |
| `packages/mcp-server/` | No MCP changes |
| `main.py` | No changes |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge restore DB+FS atomicity gap | Orphaned file dirs if crash after DB commit | Append-only in merge mode (no data loss); orphan cleanup via `admin cleanup` or manual |
| Replace restore destroys target data | Data loss if wrong backup restored | Requires `--replace` flag + interactive confirmation (bypassed with `--yes`) |
| Large DB merge restore memory | All rows loaded for ID remapping | Streaming approach: read one row from backup DB, remap, insert to target, discard |
| `window_key` UNIQUE conflict in entry_reads | Restore fails on duplicate window_key | Append suffix `-{n}` to window_key on conflict (non-functional key, only used for dedup) |
| `.secret_key` backup enables JWT forgery | Security: possession of backup gives JWT signing key | Backup file should be treated as sensitive; document this in CLI help output |

## 3. Design Details

### 3.1 Backup Command

**CLI interface**:
```
peekview admin backup [--output PATH]
```

**Default output path**: `peekview-backup-{YYYYMMDD}-{HHMMSS}.tar.gz` in current working directory (C3 decision).

**Backup procedure** (in `AdminService.backup()`):

```
1. Validate local mode (reject if remote)
2. Create temp directory for staging
3. DB backup:
   a. Open source engine's raw connection
   b. Create destination SQLite connection to temp_dir/peekview.db
   c. Call source.backup(dest) — streaming, consistent snapshot
   d. Close both connections
4. File storage copy:
   a. If data_dir/default/ exists:
      - Iterate entry_id subdirectories
      - shutil.copytree(data_dir/default/{entry_id}/ → temp_dir/data/default/{entry_id}/)
5. Config files:
   a. Copy config.yaml if exists
   b. Copy .secret_key if exists (I1)
   c. Copy .captcha_secret if exists (I1)
6. Compute checksums:
   a. Walk temp_dir, compute SHA256 of each file
   b. Store in metadata dict with relative paths as keys
7. Write metadata.json:
   {
     "version": "0.6.3",           // from peekview.__version__
     "timestamp": "2026-07-16T12:00:00Z",
     "file_checksums": {
       "peekview.db": "sha256hex",
       "data/default/1/file.py": "sha256hex",
       "config.yaml": "sha256hex",
       ".secret_key": "sha256hex"
     }
   }
8. Package:
   a. Create tar.gz from temp_dir contents
   b. Write to output path (atomic: write to .tmp then rename)
9. Clean up temp dir
```

**WAL consistency guarantee**: `sqlite3.Connection.backup()` copies pages transactionally. Per SQLite docs: "The source database is read during the backup operation, but it is not written. The backup operation does not interfere with read or write operations on the source database." The backup contains a consistent snapshot as of the moment the backup completes.

**BDD coverage**: BDD-01 (consistency), BDD-02 (custom output), BDD-03 (remote reject), BDD-04 (integrity), BDD-05 (empty instance), BDD-17 (debug isolation).

### 3.2 Export Command

**CLI interface**:
```
peekview admin export --slug SLUG [--format json|zip] [--output PATH]
```

**Default format**: JSON (BDD-09). Default output: `{slug}.json` or `{slug}.zip` in CWD.

**JSON format** (`ExportEntry` schema):
```json
{
  "entry": {
    "slug": "my-code",
    "summary": "...",
    "status": "active",
    "tags": ["python"],
    "is_public": true,
    "owner_id": 1,
    "username": "admin",
    "expires_at": null,
    "created_at": "2026-07-16T12:00:00",
    "updated_at": "2026-07-16T12:00:00"
  },
  "files": [
    {
      "filename": "main.py",
      "path": "src/main.py",
      "language": "python",
      "is_binary": false,
      "size": 1024,
      "sha256": "hex...",
      "content": "print('hello')"
    },
    {
      "filename": "image.png",
      "path": "assets/image.png",
      "language": null,
      "is_binary": true,
      "size": 2048,
      "sha256": "hex...",
      "content_base64": "iVBOR..."
    }
  ]
}
```

**ZIP format**:
```
{slug}/
  entry.json          # entry metadata + file list (no content)
  src/main.py         # original file path preserved
  assets/image.png    # original file path preserved
```

**Export procedure** (in `AdminService.export_entry()`):

```
1. Validate local mode (C2 decision: reject if remote)
2. Query entry by slug (join User for username)
3. Query all files for entry
4. For JSON format:
   a. Build ExportEntry dict
   b. For each file: read from disk, add content (text) or content_base64 (binary)
   c. Write JSON to output path
5. For ZIP format:
   a. Create ZipFile
   b. Write entry.json (metadata only, no content)
   c. For each file: read from disk, write to ZIP at {path or filename}
   d. Close ZIP
```

**BDD coverage**: BDD-06 (JSON export), BDD-07 (ZIP export), BDD-08 (missing entry), BDD-09 (default format).

### 3.3 Restore Command

**CLI interface**:
```
peekview admin restore [--dry-run] [--replace] [--yes] BACKUP_FILE
```

**Default mode**: merge (C1 decision). `--replace` enables replace mode.

**Restore procedure** (`AdminService.restore()`):

#### Phase 1: Validate (always runs, even in dry-run)

```
1. Validate local mode (reject if remote)  [BDD-13]
2. Extract tar.gz to temp dir
3. Read metadata.json
4. Validate SHA256 checksums for all files  [BDD-14]
5. Version compatibility check:
   - Parse backup version and current version
   - If backup_version > current_version → error, abort  [BDD-11]
   - If backup_version == current_version → proceed  [BDD-11a]
   - If backup_version < current_version → proceed with warning  [BDD-11b]
6. Open backup DB as read-only connection
7. Count rows in each table for dry-run preview
```

#### Phase 2: Dry-run (if --dry-run)

```
1. Count users/entries/api_keys in backup
2. Detect conflicts:
   a. Username conflicts: backup usernames vs existing usernames
   b. Slug conflicts: backup slugs vs existing slugs
   c. ID conflicts: backup IDs that overlap with existing auto-increment
3. Output preview:
   {
     "entry_count": 5,
     "user_count": 2,
     "api_key_count": 3,
     "conflicts": [
       {"type": "slug", "slug": "existing-entry", "backup_id": 1},
       {"type": "username", "username": "admin"}
     ],
     "version_check": "compatible (backup 0.5.0 < current 0.6.3)"
   }
4. Clean up temp dir, exit without modifying target  [BDD-15]
```

#### Phase 3a: Merge Restore (default)

```
1. Open target engine connection
2. Open backup DB as read-only secondary connection
3. Begin transaction on target connection
4. ID remap dicts: user_map={}, entry_map={}, file_map={}, share_map={}

5. Insert users (in FK dependency order — users first):
   For each user in backup DB:
     a. Check if username exists in target
     b. If exists: user_map[old_id] = existing_user.id (skip insert, map to existing)
     c. If not: INSERT with NULL id (auto-increment), user_map[old_id] = new_id

6. Insert entries:
   For each entry in backup DB:
     a. Remap owner_id: entry.owner_id = user_map.get(entry.owner_id)
     b. Check slug conflict:
        - If slug exists in target → rename to "{slug}-1", "{slug}-2", ... until unique  [BDD-12]
     c. INSERT with NULL id, entry_map[old_id] = new_id

7. Insert files:
   For each file in backup DB:
     a. Remap entry_id: file.entry_id = entry_map[file.entry_id]
     b. INSERT with NULL id, file_map[old_id] = new_id

8. Insert entry_shares:
   For each share in backup DB:
     a. Remap entry_id, created_by
     b. INSERT with NULL id, share_map[old_id] = new_id

9. Insert entry_reads:
   For each read in backup DB:
     a. Remap entry_id
     b. Remap reader_id (if non-NULL, use user_map if applicable)
     c. Resolve window_key conflict: if window_key exists, append "-{n}"
     d. INSERT with NULL id

10. Insert api_keys:
    For each api_key in backup DB:
      a. Remap user_id
      b. Skip if key_hash already exists in target (duplicate API key)
      c. INSERT with NULL id

11. Commit transaction

12. Copy file storage:
    For each entry_id in entry_map:
      a. src_dir = temp_dir/data/default/{old_entry_id}/
      b. dst_dir = config.data_dir/default/{new_entry_id}/
      c. shutil.copytree(src_dir, dst_dir)

13. Copy config/secret files (if target doesn't already have them):
    a. .secret_key → only if target doesn't have one (preserve existing)
    b. .captcha_secret → only if target doesn't have one
    c. config.yaml → do NOT overwrite existing config (merge would be complex and risky)

14. Rebuild FTS5 index  [I4]
15. Clean up temp dir
```

**BDD coverage**: BDD-10 (basic restore), BDD-11/11a/11b (version check), BDD-12 (ID/slug conflict), BDD-13 (remote reject), BDD-14 (integrity), BDD-15 (dry-run), BDD-16 (interrupt safety), BDD-17 (debug isolation).

#### Phase 3b: Replace Restore (--replace)

```
1. Confirm with user (unless --yes):
   "WARNING: Replace mode will DELETE ALL existing data and replace with backup contents."
   "Type 'yes' to confirm: "
2. Stop any running PeekView server (warn user, don't auto-stop)
3. Delete target data:
   a. Delete all rows: entry_reads → entry_shares → files → entries → api_keys → users
   b. Delete data_dir/default/ contents
4. Copy backup DB over target:
   a. WAL checkpoint on target engine
   b. Close target engine
   c. Copy backup peekview.db → config.db_path (atomic: write to .tmp, rename)
5. Copy file storage:
   a. Copy data/default/{entry_id}/ dirs from backup to target data_dir
6. Copy config/secret files:
   a. Overwrite config.yaml with backup version
   b. Overwrite .secret_key with backup version
   c. Overwrite .captcha_secret with backup version (if exists in backup)
7. Re-open engine with init_db()
8. Rebuild FTS5 index
```

### 3.4 Interrupt Safety (BDD-16)

**Merge mode**: DB transaction wraps all INSERTs (steps 5-10). On error:
- `session.rollback()` reverts all DB changes
- File copies (step 12) haven't started yet — no FS cleanup needed
- If error occurs during file copy phase (after commit): orphaned file dirs exist but don't break anything. Document as known limitation.

**Replace mode**: Staging approach:
- Write new data to `{data_dir}.restore-staging/`
- On completion: rename staging dirs over originals (atomic on same FS)
- On failure: staging dir is incomplete, originals are untouched
- Clean up staging dir on next restore attempt or manually

### 3.5 Remote Mode Rejection

All three commands check `_get_admin_service()` return type. If `PeekClient`, print error and exit with code 1. Pattern follows existing `admin stats` remote handling but exits instead of delegating.

### 3.6 Debug Mode Isolation (BDD-17)

`PeekConfig()` with `PEEKVIEW_DEBUG_MODE=1` auto-isolates to `/tmp/peekview-debug/`. All backup/export/restore operations use `self.config.data_dir` and `self.config.db_path`, which are already isolated. No special handling needed — existing config mechanism handles this.

### 3.7 Dry-run Implementation Strategy (I10)

Dry-run extracts backup to temp dir, validates checksums, opens backup DB read-only, and counts/conflicts without touching target DB. Output is a structured dict printed as human-readable text (or JSON with `--json-output` flag, matching existing admin command patterns).

### 3.8 Backup File Format

**tar.gz internal structure**:
```
peekview-backup/
  metadata.json
  peekview.db
  data/
    default/
      1/
        main.py
        README.md
      2/
        script.sh
  config.yaml
  .secret_key
  .captcha_secret     # optional, may not exist
```

**metadata.json schema**:
```json
{
  "version": "0.6.3",
  "timestamp": "2026-07-16T12:00:00Z",
  "file_checksums": {
    "peekview.db": "sha256hex",
    "data/default/1/main.py": "sha256hex",
    "data/default/1/README.md": "sha256hex",
    "config.yaml": "sha256hex",
    ".secret_key": "sha256hex"
  }
}
```

**SHA256 scope**: All files in tar.gz EXCEPT metadata.json itself (BDD-04). metadata.json is written last, after all other files and their checksums are computed.

**Version comparison**: Semantic version comparison using `packaging.version.Version` (already available via SQLAlchemy dependency). Major version mismatch → hard error. Minor/patch difference → warning or proceed.

### 3.9 FTS5 Index Rebuild After Restore

Call `database.rebuild_fts_index(engine, storage)` after all data is inserted (I4). This function already exists and handles the content column population from file storage.

### 3.10 Entry Reads Handling in Merge Mode

`entry_reads` has no FK constraint but has:
- `entry_id` index → must be remapped
- `reader_id` → if non-NULL and refers to a user, must be remapped via `user_map`
- `window_key` UNIQUE → must be resolved on conflict by appending `-{n}` suffix

Since entry_reads are analytics data (not functional), skipping conflicting rows is also acceptable as a fallback. Design choice: attempt insert with suffixed window_key; if that also fails, skip the row and log a warning.

## 4. New Schemas (models.py additions)

```python
class BackupMetadata(SQLModel):
    version: str
    timestamp: str
    file_checksums: dict[str, str]

class ExportEntry(SQLModel):
    entry: dict
    files: list[dict]

class ConflictInfo(SQLModel):
    type: str  # "slug" | "username" | "key_hash" | "window_key"
    value: str
    backup_id: int | None = None

class RestorePreview(SQLModel):
    entry_count: int
    user_count: int
    api_key_count: int
    share_count: int
    read_count: int
    conflicts: list[ConflictInfo]
    version_check: str  # "compatible" | "incompatible" | "downgrade_warning"

class RestoreResult(SQLModel):
    users_imported: int
    entries_imported: int
    files_imported: int
    api_keys_imported: int
    shares_imported: int
    reads_imported: int
    conflicts_resolved: int
    fts_rebuilt: bool
```

These are Pydantic schemas (non-table models), CLI-internal only. No API schema changes.

## 5. BDD Coverage Matrix

| BDD | Design Section | Key Mechanism |
|-----|---------------|---------------|
| BDD-01 | 3.1 | sqlite3.Connection.backup() for consistent snapshot |
| BDD-02 | 3.1 | --output PATH option, atomic write with .tmp+rename |
| BDD-03 | 3.5 | isinstance(backend, PeekClient) check → exit(1) |
| BDD-04 | 3.8 | metadata.json file_checksums excludes self, SHA256 of all other files |
| BDD-05 | 3.1 | Empty data_dir/default/ → empty dirs copied, empty DB backed up |
| BDD-06 | 3.2 | JSON format with content/content_base64 per file |
| BDD-07 | 3.2 | ZIP format with entry.json + original file paths |
| BDD-08 | 3.2 | Query entry by slug → NotFoundError → exit(1) |
| BDD-09 | 3.2 | Default format=JSON |
| BDD-10 | 3.3 Phase 3a | Merge restore: FK order insertion + file copy + FTS rebuild |
| BDD-11 | 3.3 Phase 1 | Version comparison: backup > current → error |
| BDD-11a | 3.3 Phase 1 | Same version → proceed |
| BDD-11b | 3.3 Phase 1 | Lower version → proceed with warning |
| BDD-12 | 3.3 Phase 3a | Slug conflict → "{slug}-{n}" rename; ID remap dicts |
| BDD-13 | 3.5 | isinstance(backend, PeekClient) → exit(1) |
| BDD-14 | 3.3 Phase 1 | SHA256 verification before any data modification |
| BDD-15 | 3.3 Phase 2 | --dry-run: counts + conflicts without modifying target |
| BDD-16 | 3.4 | DB transaction rollback + append-only FS in merge mode |
| BDD-17 | 3.6 | PeekConfig debug_mode auto-isolation, no special handling needed |

## 6. Completion Criteria

Implementation is complete when:
1. `peekview admin backup` produces a valid tar.gz with all required files and correct metadata.json checksums
2. `peekview admin export --slug X` produces valid JSON/ZIP output
3. `peekview admin restore` on an empty target reproduces all backup data with FTS5 working
4. `peekview admin restore --dry-run` outputs preview without modifying target
5. `peekview admin restore` on a non-empty target correctly remaps IDs and resolves slug conflicts
6. All three commands reject remote mode
7. `make lint` passes (ruff)
8. `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` passes
9. Debug mode isolation works (PEEKVIEW_DEBUG_MODE=1)
