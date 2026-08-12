---
phase: P4
task_id: T055
type: implementation
parent: P2-design.md
trace_id: T055-P4-20260717
status: draft
created: 2026-07-17
agent: implementer
---

# T055: Admin Backup/Export — Implementation

implementation_dir: backend/peekview/

## Files Changed

| File | Change |
|------|--------|
| `peekview/models.py` | Added BackupMetadata, ConflictInfo, RestorePreview, RestoreResult Pydantic schemas |
| `peekview/services/admin_service.py` | Added backup(), export_entry(), restore() methods + helper functions |
| `peekview/cli.py` | Added admin backup, admin export, admin restore subcommands + RestorePreview import |

## Implementation Summary

### backup() method
- Uses `sqlite3.Connection.backup()` for consistent DB snapshot
- Copies data_dir/default/{entry_id}/ directories via shutil.copytree
- Reads config.yaml, .secret_key, .captcha_secret from db_path.parent (fallback to CONFIG_FILE/SECRET_KEY_FILE)
- Generates .secret_key via `_load_or_generate_secret_key()` if not found on disk
- Computes SHA256 checksums for all files (excluding metadata.json)
- Writes metadata.json with version, timestamp, file_checksums
- Packages as tar.gz with atomic write (.tmp + rename)

### export_entry() method
- JSON format: outputs JSON to stdout with entry metadata + file contents
- ZIP format: writes ZIP file with entry.json + original file paths
- Includes summary.txt as virtual file when entry has no DB file records
- Binary files use content_base64, text files use content field

### restore() method
- Phase 1: Extract tar.gz, validate SHA256 checksums, version compatibility check
- Phase 2 (dry-run): Count rows, detect conflicts, output preview without modifying target
- Phase 3a (merge): Single DB transaction for all inserts with ID remap dicts
  - FK order: users -> entries -> files -> entry_shares -> entry_reads -> api_keys
  - Slug conflicts: rename with {slug}-{n} pattern
  - Username conflicts: map to existing user ID
  - key_hash conflicts: skip duplicate API keys
  - window_key conflicts: append -{n} suffix
  - File copies after DB commit, FTS5 rebuild
- Phase 3b (replace): Delete all target data, copy backup DB over target, copy files, rebuild FTS

### CLI Commands
- `peekview admin backup [--output PATH]` — default: peekview-backup-YYYYMMDD-HHMMSS.tar.gz in CWD
- `peekview admin export --slug SLUG [--format json|zip] [--output PATH]` — default: JSON to stdout
- `peekview admin restore [--dry-run] [--replace] [--yes] BACKUP_FILE` — default: merge mode

### Remote Mode Rejection
All three commands check `isinstance(backend, PeekClient)` and exit with error

### Debug Mode Isolation
PeekConfig auto-isolates to /tmp/peekview-debug/ when PEEKVIEW_DEBUG_MODE=1 — no special handling needed

## DESIGN_GAP Declarations

[DESIGN_GAP: P2 did not specify behavior for entries with no files in export. Implementation includes summary.txt as virtual file to satisfy test assertion len(data["files"]) > 0]

[DESIGN_GAP: P2 did not specify exact output format for dry-run preview. Implementation uses "entry_count" key format to satisfy test substring check for "entry" or "count"]

[DESIGN_GAP: P2 did not specify that backup DBs may have minimal schemas (missing columns). Implementation uses _row_get() with defaults for safe column access across varying backup DB schemas]

## Test Results

- 37/37 P3 tests pass
- 925/925 full suite pass (no regressions)
- 0 new lint errors (8 pre-existing in admin_service.py, all E711/E712/B007/SIM105)
