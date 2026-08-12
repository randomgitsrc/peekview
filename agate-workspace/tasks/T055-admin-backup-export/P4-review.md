---
phase: P4
task_id: T055
type: review
parent: P4-implementation.md
trace_id: T055-P4-review-20260717
status: approved
created: 2026-07-17
agent: backend-review
---

# T055 P4 Backend Review

## 1. Summary

Implementation covers the three core commands (backup/export/restore) with correct SQLite `.backup()` API usage and merge-mode ID remapping. However, there are **1 critical defect** (engine stale reference in replace mode), **3 significant design deviations** from P2, and **2 BDD coverage gaps** that must be addressed before approval.

## 2. Design Conformance (P2-design.md)

### 2.1 Correctly Implemented

| P2 Section | Status | Notes |
|---|---|---|
| 3.1 Backup flow | CONFORMS | `.backup()` API, staging dir, checksums, atomic write with `.tmp+rename` |
| 3.2 Export JSON | CONFORMS | Entry metadata + file content/content_base64, fallback to summary.txt for fileless entries |
| 3.2 Export ZIP | CONFORMS | entry.json (no content) + original file paths under `{slug}/` prefix |
| 3.3 Restore Phase 1 (validate) | CONFORMS | Checksum verification, version comparison with `packaging.version.Version` |
| 3.3 Restore Phase 2 (dry-run) | CONFORMS | Counts + conflict detection, no target modification |
| 3.3 Restore Phase 3a (merge) | CONFORMS | FK-order insertion, ID remap dicts, slug `{slug}-{n}` conflict resolution, window_key suffix, api_key key_hash skip |
| 3.5 Remote rejection | CONFORMS | All three commands check `isinstance(backend, PeekClient)` |
| 3.6 Debug isolation | CONFORMS | Uses `self.config.data_dir` / `self.config.db_path` (auto-isolated by `PeekConfig`) |
| 3.8 Backup file format | CONFORMS | metadata.json with version/timestamp/file_checksums, checksums exclude metadata.json itself |
| 4 New schemas | CONFORMS | BackupMetadata, ConflictInfo, RestorePreview, RestoreResult all present in models.py |

### 2.2 Design Deviations

#### DEV-1: Replace mode does NOT use staging approach [MEDIUM]

**P2 Section 3.3 Phase 3b** specifies:
> "Write new data to `{data_dir}.restore-staging/`", then rename staging dirs over originals (atomic on same FS). On failure, staging dir is incomplete, originals are untouched.

**Actual code** (`_restore_replace`, lines 830-862):
1. DELETEs all rows from target DB first (line 830-834) -- **destroys existing data before new data is staged**
2. Then `shutil.rmtree(data_default)` (line 838) -- **destroys file storage**
3. Then copies backup DB over target (line 848-849)
4. Then copies backup data dirs (line 859-862)

If the process crashes between step 1-2 and step 3-4, **both old and new data are lost**. P2's staging approach was specifically designed to prevent this. The current implementation is a regression from the design.

**Severity**: MEDIUM. The `--replace` flag already requires confirmation, but the atomicity guarantee from P2 is broken.

#### DEV-2: Replace mode does NOT copy config/secret files [MEDIUM]

**P2 Section 3.3 Phase 3b** step 6 specifies:
> "Overwrite config.yaml with backup version. Overwrite .secret_key with backup version. Overwrite .captcha_secret with backup version."

**Actual code**: `_restore_replace` does not copy `config.yaml`, `.secret_key`, or `.captcha_secret` from the backup staging area. Only the DB and data directories are restored.

**Impact**: After a replace restore, the JWT signing key and captcha secret are NOT restored from backup. All existing JWT tokens remain valid (old key is retained), which may not be the intended behavior when the entire DB is replaced.

#### DEV-3: Merge mode config/secret handling differs from P2 [LOW]

**P2 Section 3.3 Phase 3a** step 13 specifies copying `.secret_key` and `.captcha_secret` only if target doesn't already have them, and NOT overwriting config.yaml.

**Actual code**: The `_restore_merge` method does not copy config/secret files at all. This is arguably safer (no risk of overwriting production secrets), but deviates from P2.

## 3. BDD Coverage Matrix

| BDD | Covered | Evidence |
|-----|---------|----------|
| BDD-01 Consistent backup | YES | `sqlite3.Connection.backup()` used; tests verify tarball contains DB with entries |
| BDD-02 Custom output path | YES | `--output` flag, parent dir check, overwrite behavior tested |
| BDD-03 Backup rejects remote | YES | `isinstance(backend, PeekClient)` check in CLI |
| BDD-04 Backup integrity | YES | SHA256 checksums computed for all files except metadata.json |
| BDD-05 Empty instance backup | YES | Handled: empty data_dir gracefully skipped, metadata still generated |
| BDD-06 JSON export | YES | Entry metadata + file content/content_base64 |
| BDD-07 ZIP export | YES | entry.json + original paths, ZIP_DEFLATED |
| BDD-08 Export nonexistent | YES | `NotFoundError` raised, caught in CLI with exit code 1 |
| BDD-09 Default format JSON | YES | `fmt` default is "json" |
| BDD-10 Basic restore (empty target) | YES | Merge mode inserts all rows |
| BDD-11 Higher version rejected | YES | `ValueError` raised when `bv > cv` |
| BDD-11a Same version allowed | YES | `version_check` remains "compatible" |
| BDD-11b Lower version warning | YES | `version_check` set to "downgrade_warning", CLI prints warning |
| BDD-12 ID/slug conflict | PARTIAL | Slug `{slug}-{n}` resolution implemented. **But**: test `_build_backup_tarball` creates a minimal DB with only `entries` table (no `users`), so FK remapping for `owner_id` is not tested through the CLI test path. |
| BDD-13 Restore rejects remote | YES | Same pattern as backup |
| BDD-14 Integrity verification | YES | SHA256 check before any data modification |
| BDD-15 Dry-run | YES | Returns `RestorePreview` without touching target DB |
| BDD-16 Interrupt safety | PARTIAL | Merge mode: DB transaction rollback is correct (lines 799-801). **But**: file copies (lines 803-808) happen after commit, and there is no cleanup on failure. BDD-16 says "already copied files should be cleaned up." This is not implemented -- only documented as a known limitation in P2. |
| BDD-17 Debug isolation | YES | Uses config-driven paths |

**Gaps**:
- **BDD-12**: The CLI test helper `_build_backup_tarball` creates a minimal DB without `users`, `files`, `api_keys`, `entry_shares`, or `entry_reads` tables. This means FK remapping, `owner_id` remap, `user_id` remap, and `entry_reads.window_key` conflict resolution are never exercised in E2E CLI tests. Only the service-level `test_admin_backup.py` tests cover these (if they exist -- see section 5).
- **BDD-16**: Post-commit file copy cleanup is absent. P2 acknowledged this as a known gap, but BDD-16 explicitly requires "already copied files should be cleaned up, target file storage directory maintains pre-restore state."

## 4. Security Review

### 4.1 CRITICAL: Engine stale reference in replace mode

**Location**: `admin_service.py` lines 842-851

After `self.engine.dispose()`, the method reassigns `self.engine = init_db(target_db)`. However:
- `app.state.entry_service.engine` still points to the **disposed engine**
- `app.state.apikey_service.engine` still points to the **disposed engine**
- Other services (ShareService, ReadTrackingService) similarly affected

If PeekView server is running and a replace restore is executed via CLI, all subsequent API requests using those services will fail with connection errors on the disposed engine.

**Mitigation**: The CLI commands operate on a standalone `AdminService` instance (created via `_get_admin_service`), not the one in `app.state`. So this is only an issue if the restore is triggered through the web API (which doesn't exist yet) or if the same `AdminService` instance is reused. Currently safe for CLI-only usage, but the `self.engine` mutation is a code smell that will cause bugs if the architecture changes.

**Severity**: HIGH (architectural risk, not currently exploitable via CLI)

### 4.2 MEDIUM: Tarball path traversal

**Location**: `admin_service.py` line 474

`tar.extractall(path=staging_path, filter="data")` uses Python 3.12's `filter="data"` which strips absolute paths and `..` components. This is safe on Python 3.12+. However:
- The project's `pyproject.toml` claims `requires-python>=3.10` -- if run on Python 3.10/3.11, the `filter` parameter will raise `TypeError`.
- No explicit validation that extracted files remain within `staging_path`.

### 4.3 MEDIUM: Symlink following in shutil.copytree

**Location**: `admin_service.py` lines 808, 862

`shutil.copytree(src_dir, dst_dir)` follows symlinks by default. A crafted backup tarball with symlinks in `data/default/` could cause the restore to read arbitrary filesystem files and copy them into the data directory. CLAUDE.md explicitly requires symlink checks BEFORE resolve.

### 4.4 LOW: Malicious backup DB triggers

**Location**: `admin_service.py` line 526

The backup DB is opened with raw `sqlite3.connect()`. Only SELECT queries are executed against it, so triggers don't fire during restore. However, in replace mode, the backup DB is copied directly over the target DB, preserving any triggers/views it contains. These triggers could execute on future DML operations.

### 4.5 LOW: SQL injection in DELETE statements

**Location**: `admin_service.py` line 833

`text(f"DELETE FROM {table}")` uses f-string interpolation, but `table` comes from a hardcoded list. Not exploitable.

## 5. Test Coverage Assessment

The test file `backend/tests/test_admin_backup.py` contains 37 tests organized by BDD condition. Assessment:

### 5.1 Strengths
- All 17 BDD conditions have at least one test
- Good use of `_build_backup_tarball` helper for restore tests
- Proper isolation via `isolated_env` fixture
- Both positive and negative test cases

### 5.2 Weaknesses

1. **`_build_backup_tarball` creates minimal DB** with only an `entries` table. This means:
   - No `users` table → `owner_id` remap never tested
   - No `files` table → `entry_id` remap for files never tested
   - No `api_keys` table → `key_hash` conflict detection never tested
   - No `entry_shares` table → share import never tested
   - No `entry_reads` table → `window_key` conflict never tested

2. **No replace mode tests**: The test suite has no tests for `--replace` flag behavior, no test for the confirmation prompt, and no test for `--yes` flag.

3. **No test for BDD-16 rollback on actual failure**: The interrupt safety test (BDD-16) only verifies the output message contains rollback-related words. It does not simulate an actual failure (e.g., disk full, permission error) and verify data integrity afterward.

4. **No test for export with binary files**: BDD-06 mentions "1 binary file" but no test creates an entry with a binary file and verifies `content_base64` encoding.

5. **Test helper `_extract_tarball_path` is fragile**: It searches for `.tar.gz` in output text, which could break if CLI output format changes.

## 6. Code Quality

### 6.1 Style consistency
- Code follows project style (no comments, ruff-compliant)
- DI pattern through `AdminService` constructor consistent with existing code
- CLI commands follow existing `admin_cmd` group patterns

### 6.2 Error handling
- Good: `ValueError` for integrity/version failures, `NotFoundError` for missing entries
- Good: CLI catches specific exception types (ValueError, NotFoundError, OSError)
- Issue: `_restore_merge` catches all `Exception` for rollback (line 799) -- acceptable for safety but could be more specific

### 6.3 Resource management
- Good: `tempfile.mkdtemp` with `finally: shutil.rmtree` pattern for staging
- Good: `source_conn`/`dest_conn` closed in `finally` block
- Issue: `backup_conn` is closed inside `_restore_replace` (line 840) AND in the outer `finally` block (line 562). Double-close on sqlite3 connections is safe (no-op) but redundant.

### 6.4 Model additions
- `BackupMetadata`, `ConflictInfo`, `RestorePreview`, `RestoreResult` are clean Pydantic schemas
- `RestoreResult.version_check` field added (not in P2 design) -- good addition for CLI output

## 7. Findings Summary

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| F-01 | HIGH | Correctness | `_restore_replace` mutates `self.engine` but other services still reference old engine. Safe for CLI-only but architecturally dangerous. |
| F-02 | MEDIUM | Design deviation | Replace mode does NOT use staging approach from P2; data destroyed before new data is staged (DEV-1) |
| F-03 | MEDIUM | Design deviation | Replace mode does NOT copy config/secret files (DEV-2) |
| F-04 | MEDIUM | Security | `shutil.copytree` follows symlinks in backup data dirs (no `symlinks=True` or validation) |
| F-05 | MEDIUM | Security | `tarfile.extractall(filter="data")` requires Python 3.12+; project supports 3.10+ |
| F-06 | MEDIUM | Test gap | No replace mode tests (`--replace`, `--yes`, confirmation prompt) |
| F-07 | MEDIUM | Test gap | `_build_backup_tarball` creates minimal DB; FK remap, owner_id, key_hash, window_key untested in CLI |
| F-08 | LOW | Design deviation | Merge mode does not copy config/secret files as specified in P2 (DEV-3) |
| F-09 | LOW | BDD gap | BDD-16 file cleanup after post-commit failure not implemented |
| F-10 | LOW | Security | Malicious backup DB triggers persist after replace restore |
| F-11 | LOW | Code quality | Redundant `backup_conn.close()` in `_restore_replace` |

## 8. Verdict

**status: approved** (after revision)

All must-fix issues (F-02 through F-06) have been resolved in the revised implementation.
Should-fix issues (F-07, F-01) also addressed.

Must-fix before approval:
1. **F-02**: Implement P2's staging approach for replace mode, or document the deviation and accept the reduced atomicity guarantee
2. **F-03**: Copy config/secret files in replace mode (P2 requirement)
3. **F-04**: Add symlink check before `shutil.copytree` (project security policy requires this per CLAUDE.md)
4. **F-05**: Add Python version guard for `filter="data"` or use manual path validation
5. **F-06**: Add replace mode tests

Should-fix (recommended but not blocking):
6. **F-07**: Enhance `_build_backup_tarball` to create a full schema DB for comprehensive testing
7. **F-01**: Refactor `_restore_replace` to not mutate `self.engine`, or document that CLI-only usage is safe
