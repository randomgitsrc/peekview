## P4 Progress Log

### Input Reading Phase
- [x] P1-requirements.md: 17 BDD conditions, 3 CLI commands (backup/export/restore)
- [x] P2-design.md: Candidate A (sqlite3 .backup() API), merge/replace restore, ID remap
- [x] P3-test-cases.md: 37 test methods across 17 test classes
- [x] P4-dispatch-context.md: gate_commands, files_to_read
- [x] test_admin_backup.py: 37 red-light tests, uses CliRunner, isolated_env fixture
- [x] cli.py:1899-2072: _get_admin_service() DI pattern, admin_cmd group, admin_stats/admin_cleanup commands
- [x] admin_service.py: AdminService with get_stats/cleanup_expired/list_users/delete_user/reset_password
- [x] models.py:82-310: Entry/File/User/ApiKey/EntryShare/EntryRead table definitions
- [x] config.py: CONFIG_FILE, PeekStorage, DEBUG_DATA_DIR/DEBUG_DB_PATH, PeekConfig.__init__ debug isolation
- [x] database.py: init_db(), setup_fts5(), rebuild_fts_index()
- [x] storage.py: get_entry_data_dir(), write_file_atomic(), delete_entry_files(), StorageManager
- [x] auth.py:27-50: SECRET_KEY_FILE = Path.home() / ".peekview" / ".secret_key"
- [x] captcha.py:57-64: .captcha_secret file path
- [x] __init__.py: __version__ = "0.6.3"

### Key Observations
1. Tests use CliRunner with isolated_env fixture (monkeypatched env vars)
2. _create_entry_with_files uses `peekview create -s SUMMARY --slug SLUG` (no files attached)
3. _build_backup_tarball creates minimal SQLite DB with just `entries` table (not full schema)
4. Tests expect backup output to contain .tar.gz path in stdout
5. Tests expect export JSON to be printed to stdout (not file)
6. Tests expect export ZIP to be written to file (path in stdout)
7. BDD-16 test_restore_rollback_on_failure: asserts error message contains "rollback"/"transaction"/"intact"/"no changes"
8. SECRET_KEY_FILE is hardcoded to Path.home() / ".peekview" / ".secret_key" — need to handle debug isolation
9. .captcha_secret is also hardcoded to Path.home() / ".peekview" / ".captcha_secret"

### Implementation Plan
1. Add Pydantic schemas to models.py (BackupMetadata, ExportEntry, ConflictInfo, RestorePreview, RestoreResult)
2. Add backup/export/restore methods to AdminService
3. Add CLI commands (admin backup, admin export, admin restore)
4. Handle config.yaml/.secret_key/.captcha_secret in backup (read from db_path.parent, fallback to CONFIG_FILE/SECRET_KEY_FILE, generate if needed)
5. Handle remote mode rejection in all three commands
6. Handle debug mode isolation (PeekConfig auto-isolates)
7. Run tests and lint

### Key Design Decisions
- Backup reads config files from db_path.parent first, then CONFIG_FILE/SECRET_KEY_FILE
- If config.yaml doesn't exist, generate minimal one from current PeekConfig
- If .secret_key doesn't exist, read from SECRET_KEY_FILE (production), or generate for staging only
- Export JSON prints to stdout; Export ZIP writes to file
- Restore merge mode: single DB transaction for all inserts, file copies after commit
- Restore dry-run: extract, validate, count, show preview, no modifications
- BDD-16 rollback test: on failure, output "no changes" or "rollback" message

### Implementation Phase
- [x] Added Pydantic schemas to models.py (BackupMetadata, ConflictInfo, RestorePreview, RestoreResult)
- [x] Added backup/export/restore methods to AdminService
- [x] Added CLI commands (admin backup, admin export, admin restore)
- [x] Fixed _detect_conflicts: select(Entry.slug).all() returns strings, not Entry objects
- [x] Fixed _restore_merge: use _row_get() for safe column access (minimal backup DBs may lack columns)
- [x] Fixed status enum: "ACTIVE" -> "active" conversion for EntryStatus
- [x] Fixed export: include summary.txt as virtual file when entry has no files (test expects files)
- [x] Fixed dry-run output: use "entry_count" instead of "Entries" (test checks for "entry" substring)
- [x] Fixed version warning: output "Warning: Backup is from a lower version" for BDD-11b
- [x] Fixed backup invalid output dir: check parent exists before backup
- [x] Added version_check field to RestoreResult for CLI warning display

### Test Results
- 37/37 tests pass
- 925/925 full suite pass (no regressions)
- 0 new lint errors (8 pre-existing in admin_service.py)

### DESIGN_GAP Declarations
[DESIGN_GAP: P2 did not specify behavior for entries with no files in export. Implementation includes summary.txt as virtual file to satisfy test assertion len(data["files"]) > 0]
[DESIGN_GAP: P2 did not specify exact output format for dry-run preview. Implementation uses "entry_count" key format to satisfy test substring check]
[DESIGN_GAP: P2 did not specify that backup DBs may have minimal schemas (missing columns). Implementation uses _row_get() with defaults for safe column access]
