# T055 P3 Progress

## 2026-07-17 — Read Phase

### Input files read:
- P0-brief.md: debug_env=make debug-start, packages=backend/peekview/, domains=backup/export/restore
- P1-requirements.md: 19 BDD conditions (BDD-01..BDD-17 + BDD-11a/11b)
- P2-design.md: Candidate A selected (SQLite .backup() API + ID remap table restore)
- P3-dispatch-context.md: test_code_dir=backend/tests/, gate_commands confirmed
- conftest.py: autouse isolate_config_file fixture, engine/session/test_config fixtures
- test_cli.py: CliRunner + isolated_fs pattern, monkeypatch env vars
- admin_service.py: AdminService(engine, storage, config), get_stats/cleanup_expired methods
- models.py: Entry/File/User/ApiKey/EntryShare/EntryRead tables + FK chains
- cli.py:1899-2050: _get_admin_service() DI pattern, admin_cmd group, admin_stats/cleanup commands

### Key patterns identified:
1. CLI tests use CliRunner + isolated_fs fixture (monkeypatch env vars + CONFIG_FILE)
2. AdminService instantiated via _get_admin_service() which checks remote URL
3. PeekClient is the remote mode backend — isinstance check rejects for backup/restore
4. conftest autouse isolate_config_file sets PEEKVIEW_STORAGE__DATA_DIR + DB_PATH
5. __version__ from peekview.__init__ for metadata.json
6. SECRET_KEY_FILE = Path.home() / ".peekview" / ".secret_key"

### Strategy for true red lights:
- CLI tests: invoke "admin backup/export/restore" subcommands via CliRunner
  - Subcommands don't exist yet → Click will report "No such command" → non-zero exit
  - BUT: need to ensure admin_cmd group exists (it does), so import succeeds
  - Tests assert on expected behavior (e.g., exit_code == 0, output contains "backup") → FAIL
- Service tests: call methods that don't exist on AdminService → use hasattr check + assertion
  - Test calls getattr(admin_service, "backup", None) and asserts result is not None → FAIL
  - This avoids AttributeError crash and gives clean assertion failure
- For BDD-03/BDD-13 (remote reject): set PEEKVIEW_REMOTE__URL env var, invoke CLI → assert error message

### BDD → Test mapping plan (19 BDDs → ~22 test functions):
- BDD-01: test_backup_produces_tarball_with_required_contents
- BDD-02: test_backup_custom_output_path, test_backup_invalid_output_path
- BDD-03: test_backup_rejects_remote_mode
- BDD-04: test_backup_integrity_checksums
- BDD-05: test_backup_empty_instance
- BDD-06: test_export_json_format
- BDD-07: test_export_zip_format
- BDD-08: test_export_nonexistent_entry
- BDD-09: test_export_default_format_is_json
- BDD-10: test_restore_basic_merge_to_empty_target
- BDD-11: test_restore_rejects_higher_version_backup
- BDD-11a: test_restore_allows_same_version
- BDD-11b: test_restore_allows_lower_version_with_warning
- BDD-12: test_restore_id_and_slug_conflict_resolution
- BDD-13: test_restore_rejects_remote_mode
- BDD-14: test_restore_validates_checksums
- BDD-15: test_restore_dry_run
- BDD-16: test_restore_interrupt_safety_rollback
- BDD-17: test_backup_debug_mode_isolation

## 2026-07-17 — Test Code Written + Verified

### Test file: backend/tests/test_admin_backup.py
- 37 test methods across 17 test classes
- All 19 BDD conditions covered (BDD-01..BDD-17 + BDD-11a/11b)
- All 37 tests FAIL with true red lights (AssertionError)
- 0 accidental greens
- 0 A-class errors (no ImportError/AttributeError)

### Test design decisions:
1. CLI-level testing via CliRunner (not AdminService method calls) — avoids AttributeError on non-existent methods
2. Synthetic backup tarball builder (_build_backup_tarball) for restore tests — creates valid tar.gz with SQLite DB + data + metadata
3. BDD-16 (interrupt safety): tests CLI output for rollback keywords instead of patching non-existent AdminService.restore
4. BDD-08 (nonexistent entry): uses pytest.fail() to distinguish "command not implemented" from "entry not found"
5. BDD-02 invalid output dir: asserts error message mentions path/directory (not just "No such command")

### Gate verification:
- pytest exit code: 1 (failures)
- All failures are AssertionError (true red lights)
- No SyntaxError, ImportError, or AttributeError

### Output files:
1. docs/tasks/T055-admin-backup-export/P3-test-cases.md
2. backend/tests/test_admin_backup.py
