---
phase: P3
task_id: T007
parent: P2-design.md
trace_id: T007-P3-20260614
---

# P3 测试用例清单 — T007 Entry Raw API

测试代码：`backend/tests/test_raw_api.py`

| # | 对应 BDD | 测试名 |
|---|---------|--------|
| 1 | AC1 | test_raw_public_single_file_markdown |
| 2 | AC1 | test_raw_returns_utf8_content_correctly |
| 3 | AC2 | test_raw_multi_file_returns_all_files |
| 4 | AC3 | test_raw_private_entry_unauthenticated_returns_401 |
| 5 | AC4 | test_raw_private_entry_with_api_key_returns_content |
| 6 | AC5 | test_raw_binary_file_returns_file_url_not_content |
| 7 | AC6 | test_raw_nonexistent_entry_returns_404 |
| 8 | AC1 | test_raw_response_schema_has_required_fields |
| 9 | AC1 | test_raw_content_no_script_injection |
| 10 | AC7 | test_raw_url_in_response_matches_request |
