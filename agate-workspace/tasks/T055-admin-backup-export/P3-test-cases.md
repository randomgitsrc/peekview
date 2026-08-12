---
phase: P3
task_id: T055
type: test-cases
parent: P2-design.md
trace_id: T055-P3-20260717
status: draft
created: 2026-07-17
agent: test-designer
---

# T055: Admin Backup/Export — Test Cases

test_code_dir: backend/tests/

## Test File

`backend/tests/test_admin_backup.py`

## BDD → Test Mapping

| BDD | Test Class | Test Method | Expected Red Light |
|-----|-----------|-------------|-------------------|
| BDD-01 | TestBdd01ConsistentBackup | test_backup_command_exists | "backup" not in admin --help output |
| BDD-01 | TestBdd01ConsistentBackup | test_backup_produces_tarball | admin backup returns exit_code=2 (no such command) |
| BDD-01 | TestBdd01ConsistentBackup | test_backup_tarball_contains_required_files | No tarball produced → assertion on tarfile contents |
| BDD-01 | TestBdd01ConsistentBackup | test_backup_db_is_consistent_snapshot | No tarball → cannot extract/verify DB consistency |
| BDD-02 | TestBdd02CustomOutput | test_backup_custom_output_path | admin backup --output returns exit_code=2 |
| BDD-02 | TestBdd02CustomOutput | test_backup_output_is_tar_gz | No output file → tarfile.is_tarfile fails |
| BDD-02 | TestBdd02CustomOutput | test_backup_overwrites_existing_file | No output file → assertion fails |
| BDD-02 | TestBdd02CustomOutput | test_backup_invalid_output_dir | Error message lacks "path"/"directory" keywords |
| BDD-03 | TestBdd03RemoteReject | test_backup_rejects_remote_mode | Error message lacks "remote" keyword |
| BDD-04 | TestBdd04Integrity | test_backup_metadata_has_checksums | No tarball → cannot extract metadata.json |
| BDD-04 | TestBdd04Integrity | test_backup_checksums_are_correct | No tarball → cannot verify checksums |
| BDD-05 | TestBdd05EmptyBackup | test_backup_empty_instance | admin backup returns exit_code=2 |
| BDD-05 | TestBdd05EmptyBackup | test_backup_empty_metadata_has_version | No tarball → cannot extract metadata |
| BDD-06 | TestBdd06JsonExport | test_export_json_format | admin export returns exit_code=2 |
| BDD-06 | TestBdd06JsonExport | test_export_json_entry_metadata | No JSON output → json.loads fails |
| BDD-06 | TestBdd06JsonExport | test_export_json_file_fields | No JSON output → assertion on file fields |
| BDD-07 | TestBdd07ZipExport | test_export_zip_format | admin export --format zip returns exit_code=2 |
| BDD-07 | TestBdd07ZipExport | test_export_zip_contains_entry_json | No ZIP → cannot verify contents |
| BDD-07 | TestBdd07ZipExport | test_export_zip_files_are_extractable | No ZIP → cannot extract |
| BDD-08 | TestBdd08ExportNonexistent | test_export_nonexistent_entry | "No such command 'export'" → pytest.fail |
| BDD-09 | TestBdd09DefaultFormat | test_export_default_format_is_json | admin export returns exit_code=2 |
| BDD-10 | TestBdd10BasicRestore | test_restore_command_exists | "restore" not in admin --help output |
| BDD-10 | TestBdd10BasicRestore | test_restore_into_empty_target | admin restore returns exit_code=2 |
| BDD-11 | TestBdd11VersionReject | test_restore_rejects_higher_version | admin restore returns exit_code=2, no version message |
| BDD-11 | TestBdd11VersionReject | test_restore_higher_version_no_data_change | Error lacks "version"/"incompat" keywords |
| BDD-11a | TestBdd11aSameVersion | test_restore_allows_same_version | admin restore returns exit_code=2 |
| BDD-11b | TestBdd11bLowerVersion | test_restore_allows_lower_version_with_warning | admin restore returns exit_code=2 |
| BDD-12 | TestBdd12ConflictResolution | test_restore_remaps_entry_ids | admin restore returns exit_code=2 |
| BDD-12 | TestBdd12ConflictResolution | test_restore_resolves_slug_conflicts | admin restore returns exit_code=2 |
| BDD-13 | TestBdd13RemoteReject | test_restore_rejects_remote_mode | Error lacks "remote" keyword |
| BDD-14 | TestBdd14IntegrityCheck | test_restore_validates_checksums | admin restore returns exit_code=2, no checksum message |
| BDD-14 | TestBdd14IntegrityCheck | test_restore_valid_backup_succeeds | admin restore returns exit_code=2 |
| BDD-15 | TestBdd15DryRun | test_restore_dry_run_no_data_change | admin restore --dry-run returns exit_code=2 |
| BDD-15 | TestBdd15DryRun | test_restore_dry_run_shows_preview | admin restore --dry-run returns exit_code=2 |
| BDD-16 | TestBdd16InterruptSafety | test_restore_rollback_on_failure | Error lacks "rollback"/"transaction"/"intact" keywords |
| BDD-17 | TestBdd17DebugIsolation | test_backup_debug_mode_isolation | admin backup returns exit_code=2 |
| BDD-17 | TestBdd17DebugIsolation | test_backup_default_output_in_cwd | admin backup returns exit_code=2 |

## Test Infrastructure

### Fixtures
- `runner`: Click CliRunner instance
- `isolated_env`: Isolated filesystem with monkeypatched env vars (PEEKVIEW_STORAGE__DATA_DIR, PEEKVIEW_STORAGE__DB_PATH, PEEKVIEW_REMOTE__URL, CONFIG_FILE)

### Helpers
- `_create_entry_with_files(runner, slug, summary)`: Create a CLI entry for testing
- `_create_backup_via_cli(runner, output_path)`: Invoke admin backup command
- `_build_backup_tarball(tmp_path, version, include_metadata, corrupt_file)`: Build synthetic backup tarball for restore testing
- `_extract_tarball_path(output, base_path)`: Parse tarball path from CLI output
- `_extract_export_path(output, base_path, extension)`: Parse export file path from CLI output

### Red Light Strategy
All tests use CLI-level invocation via CliRunner. Since the `admin backup`, `admin export`, and `admin restore` subcommands do not exist yet:
- Click returns exit_code=2 with "No such command" error
- Tests assert on expected behavior (exit_code==0, specific output content) → assertion failure
- No import errors or AttributeErrors — all imports are from existing code (cli, models, etc.)
- BDD-16 avoids patching non-existent AdminService.restore method; instead tests CLI behavior directly

### Coverage Summary
- 19 BDD conditions → 37 test methods across 17 test classes
- All 37 tests currently FAIL (true red lights: AssertionError, not ImportError/AttributeError)
- 0 tests pass (no accidental greens)
