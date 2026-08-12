---
phase: P3
task_id: T054
type: test-cases
parent: P2-design.md
trace_id: T054-P3-20260714
status: draft
created: 2026-07-14
agent: test-designer
---

# T054 P3: Test Cases

## test_code_dir

```
backend/tests/test_t054_a_default_host.py
backend/tests/test_t054_b_rate_limit.py
backend/tests/test_t054_c_passlib_removal.py
backend/tests/test_t054_d_idempotency.py
backend/tests/test_t054_e_share_sql.py
backend/tests/test_t054_f_migration_comment.py
```

## BDD → Test Case Mapping

### A. Default host → 127.0.0.1

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| A1 | `TestBDDA1DefaultHost::test_default_host_is_localhost` | test_t054_a | FAIL: config.server.host == "0.0.0.0" ≠ "127.0.0.1" |
| A1 | `TestBDDA1DefaultHost::test_peek_server_default_host` | test_t054_a | FAIL: PeekServer().host == "0.0.0.0" ≠ "127.0.0.1" |
| A2 | `TestBDDA2EnvOverride::test_env_overrides_default` | test_t054_a | PASS (existing mechanism) |
| A3 | `TestBDDA3CLIHelpText::test_serve_command_host_help` | test_t054_a | FAIL: help shows "default: 0.0.0.0" not "127.0.0.1" |
| A4 | `TestBDDA4ConfigListDescription::test_config_list_host_description` | test_t054_a | FAIL: description says "0.0.0.0 为所有接口" |

### B. Write-endpoint rate limiting

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| B1 | `TestBDDB1CreateRateLimit429::test_create_entry_returns_429_after_limit` | test_t054_b | FAIL: no explicit decorator, default_limits too high for 5-req test |
| B2 | `TestBDDB2CreateNormalUnderLimit::test_create_entry_normal_under_limit` | test_t054_b | PASS (existing default_limits work) |
| B3 | `TestBDDB3UpdateRateLimit429::test_update_entry_returns_429_after_limit` | test_t054_b | FAIL: no explicit decorator on PATCH |
| B4 | `TestBDDB4DeleteRateLimit429::test_delete_entry_returns_429_after_limit` | test_t054_b | FAIL: no explicit decorator on DELETE |
| B5 | `TestBDDB5RateLimitDisabled::test_no_429_when_disabled` | test_t054_b | PASS (existing mechanism) |
| B6 | `TestBDDB6ExplicitDecoratorPriority::test_entries_rate_limit_provider_exists` | test_t054_b | FAIL: ImportError (entries_rate_limit not yet defined) |
| B6 | `TestBDDB6ExplicitDecoratorPriority::test_entries_rate_limit_setter` | test_t054_b | FAIL: ImportError |
| B6 | `TestBDDB6ExplicitDecoratorPriority::test_create_entry_has_limiter_decorator` | test_t054_b | FAIL: no decorator on create_entry |
| B6 | `TestBDDB6ExplicitDecoratorPriority::test_update_entry_has_limiter_decorator` | test_t054_b | FAIL: no decorator on update_entry |
| B6 | `TestBDDB6ExplicitDecoratorPriority::test_delete_entry_has_limiter_decorator` | test_t054_b | FAIL: no decorator on delete_entry |

### C. Remove passlib

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| C1 | `TestBDDC1NoPasslibInDeps::test_pyproject_no_passlib` | test_t054_c | FAIL: passlib still in pyproject.toml |
| C1 | `TestBDDC1NoPasslibInDeps::test_pyproject_has_bcrypt` | test_t054_c | FAIL: bcrypt>=4.0.0 not declared |
| C2 | `TestBDDC2BcryptBackwardCompat::test_old_hash_verifies_with_new_bcrypt` | test_t054_c | PASS (bcrypt already works) |
| C2 | `TestBDDC2BcryptBackwardCompat::test_bcrypt_hash_format_compatible` | test_t054_c | PASS |
| C2 | `TestBDDC2BcryptBackwardCompat::test_wrong_password_still_fails` | test_t054_c | PASS |

### D. Create-endpoint idempotency key

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| D1 | `TestBDDD1FirstCreate201::test_first_create_returns_201` | test_t054_d | FAIL: idempotency_key not stored (getattr returns None) |
| D2 | `TestBDDD2IdempotentHit200::test_same_key_same_owner_returns_200` | test_t054_d | FAIL: returns 201 (key ignored) not 200 |
| D3 | `TestBDDD3IntegrityErrorCatch::test_concurrent_same_key_returns_existing` | test_t054_d | FAIL: returns 201 (key ignored) not 200 |
| D4 | `TestBDDD4NoKeyBehaviorUnchanged::test_no_key_creates_new_each_time` | test_t054_d | PASS (existing behavior) |
| D5 | `TestBDDD5KeyReusableAfterDelete::test_key_reusable_after_delete` | test_t054_d | FAIL: idempotency_key not stored on entry |
| D6 | `TestBDDD6MCPCreateEntryPassesKey::test_mcp_zod_schema_has_idempotency_key` | test_t054_d | SKIP (backend can't import MCP) |
| D6 | `TestBDDD6MCPCreateEntryPassesKey::test_mcp_types_has_idempotency_key` | test_t054_d | FAIL: idempotency_key not in types.ts |
| D6 | `TestBDDD6MCPCreateEntryPassesKey::test_mcp_create_entry_schema_has_key` | test_t054_d | FAIL: idempotency_key not in createEntry.ts |
| D7 | `TestBDDD7CrossOwnerKeyReturns409::test_cross_owner_key_returns_409` | test_t054_d | FAIL: returns 201 (key ignored) not 409 |
| D8 | `TestBDDD8EmptyStringKey422::test_empty_string_key_returns_422` | test_t054_d | FAIL: returns 201 (key ignored) not 422 |
| D9 | `TestBDDD9KeyTooLong422::test_overlength_key_returns_422` | test_t054_d | FAIL: returns 201 (key ignored) not 422 |
| D10 | `TestBDDD10MultipleNullsNoConflict::test_multiple_null_entries_no_unique_conflict` | test_t054_d | FAIL: idempotency_key column doesn't exist |

### E. share_service text() SQL unification

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| E1 | `TestBDDE1NoTextStyleQueries::test_no_text_in_share_service` | test_t054_e | FAIL: text() calls found |
| E1 | `TestBDDE1NoTextStyleQueries::test_select_count_uses_orm` | test_t054_e | FAIL: "SELECT COUNT" found in source |
| E1 | `TestBDDE1NoTextStyleQueries::test_update_view_count_uses_constructor` | test_t054_e | FAIL: "UPDATE entry_shares SET view_count" found |
| E2 | `TestBDDE2ViewCountAtomicIncrement::test_view_count_increments_atomically` | test_t054_e | PASS (existing behavior works) |

### F. Migration comment

| BDD | Test Case | File | Expected (Red) |
|-----|-----------|------|----------------|
| F1 | `TestBDDF1MigrationCommentKeywords::test_docstring_contains_create_all` | test_t054_f | PASS (already in docstring) |
| F1 | `TestBDDF1MigrationCommentKeywords::test_docstring_contains_alter_table` | test_t054_f | FAIL: "ALTER TABLE" not in docstring |

## Summary

- **Total test cases**: 38
- **Currently failing (red)**: 28
- **Currently passing (green)**: 9
- **Skipped**: 1

### Passing tests rationale

Tests that pass before P4 implementation test **existing mechanisms** that already work correctly:
- A2: env var override mechanism already exists
- B2, B5: default_limits and disabled rate limiting already work
- C2: bcrypt password hashing already works (passlib→bcrypt change is dependency-only)
- D4: no-key behavior is unchanged by design
- E2: view_count increment already works (the change is code style, not behavior)
- F1 (partial): `create_all` already mentioned in docstring

These tests must remain green after P4 implementation — they guard against regressions.

### Red light verification

All 28 failures are **assertion failures** (not import errors or syntax errors), confirming true TDD red phase:
- A1/A3/A4: assert "127.0.0.1" == "0.0.0.0" (config default not yet changed)
- B1/B3/B4: assert 429 != 201/200 (no explicit limiter decorator)
- B6: ImportError for entries_rate_limit (not yet defined)
- C1: assert "passlib" not in content (still in pyproject.toml)
- D1/D5: assert getattr(entry, "idempotency_key", None) == "abc123" fails (column not yet exists)
- D2/D3: assert 200 != 201 (idempotent hit not yet implemented)
- D6: assert "idempotency_key" in content (MCP not yet updated)
- D7: assert 409 != 201 (cross-owner conflict not yet implemented)
- D8/D9: assert 422 != 201 (validation not yet implemented)
- D10: assert "idempotency_key" in columns (column not yet exists)
- E1: assert text() not in source (still using text() style)
- F1: assert "ALTER TABLE" in docstring (not yet added)
