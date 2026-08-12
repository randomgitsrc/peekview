---
phase: P8
task_id: T055
type: release
parent: P6-acceptance.md
trace_id: T055-P8-20260717
status: draft
created: 2026-07-17
agent: main
---

# T055 P8 Release

## bump_type: minor

Reason: New feature (admin backup/export/restore CLI commands), backward compatible, no breaking changes to existing API or CLI behavior.

## packages

- backend/peekview/: 0.6.3 → 0.7.0

## Changes

### New features
- `peekview admin backup [--output PATH]` — consistent full backup (DB + files + config + secrets) as tar.gz
- `peekview admin export --slug SLUG [--format json|zip]` — single entry export
- `peekview admin restore <backup-file>` — restore from backup with merge/replace modes
- `--dry-run` flag for restore preview
- `--replace --yes` flags for destructive replace mode

### Implementation details
- SQLite `.backup()` API for WAL-mode consistent snapshots
- SHA256 checksums for backup integrity verification
- ID/slug remapping for merge-mode restore with FK chain handling
- Staging directory approach for replace-mode atomicity
- Symlink detection in backup data for security
- Python 3.10+ compatible tarball extraction

## Files modified
- backend/peekview/services/admin_service.py — backup/export/restore methods
- backend/peekview/cli.py — admin backup/export/restore commands
- backend/peekview/models.py — BackupMetadata, ConflictInfo, RestorePreview, RestoreResult schemas
- backend/tests/test_admin_backup.py — 40 tests covering 19+ BDD conditions

## Temp resources to clean
- Debug server on :8888 (if running) — `make debug-stop`
- /tmp/peekview-debug/ data directory
- Test backup tarballs in backend/ directory (already cleaned)

## CHANGELOG entry

### Added
- Admin backup/export/restore CLI commands (`peekview admin backup`, `peekview admin export`, `peekview admin restore`)
- Consistent SQLite backup via `.backup()` API with SHA256 integrity verification
- Merge-mode restore with automatic ID/slug remapping and FK chain handling
- Replace-mode restore with staging directory atomicity
- `--dry-run` flag for restore preview
- `--replace --yes` flags for destructive full replacement
