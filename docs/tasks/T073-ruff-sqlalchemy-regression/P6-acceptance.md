---
phase: P6
task_id: T073
type: acceptance
parent: P5-test-results/unit.md
trace_id: T073-P6-20260726
status: draft
created: 2026-07-26
agent: verifier
---

## BDD 验收结果

- PASS BDD-1: admin_stats 不再 500 且返回正确统计（test-output.log）
- PASS BDD-2: share 创建时 revoked_at 过滤生效（test-output.log）
- PASS BDD-3: share token 验证跳过已撤销的 share（test-output.log）
- PASS BDD-4: share cookie 验证跳过已撤销的 share（test-output.log）
- PASS BDD-5: revoke 操作只撤销未撤销的 share（test-output.log）
- PASS BDD-6: API key 过期统计正确（test-output.log）
- PASS BDD-7: cleanup_expired 正确识别过期 entry（test-output.log）
- PASS BDD-8: cleanup_expired 正确识别旧归档 entry（test-output.log）
- PASS BDD-9: ruff 不再对 SQLAlchemy Column 比较报 E711/E712（test-output.log）
- PASS BDD-10: make lint-fix 不再破坏 SQLAlchemy Column 比较（test-output.log）
- PASS BDD-11: 全部测试通过（test-output.log）
- PASS BDD-12: entry 列表 API 对匿名用户只返回公开 entry（test-output.log）
- PASS BDD-13: FTS 搜索能找到非二进制文件的内容（test-output.log）

## 验证方法

- BDD-1: `pytest tests/test_admin_stats_cleanup.py::TestAdminStats` — 2 passed
- BDD-2: `pytest tests/test_share_create.py::test_b06_max_shares_limit` — passed
- BDD-3: `pytest tests/test_share_access.py::test_b09_revoked_token_denies_access` — passed
- BDD-4: `pytest tests/test_share_cookie.py::test_b19_revoked_cookie_denies_access` — passed
- BDD-5: `pytest tests/test_share_revoke.py::test_revoke_already_revoked_is_idempotent` — passed
- BDD-6: `pytest tests/test_t073_bdd06_apikey_expired_count.py` — passed
- BDD-7/8: `pytest tests/test_t073_bdd07_08_cleanup_null_columns.py` — 2 passed
- BDD-9/10: `pytest tests/test_t073_bdd09_10_ruff_regression.py` — 2 passed
- BDD-11: `pytest tests/ -q --tb=short` — 971 passed, 0 failed
- BDD-12: `pytest tests/test_t073_bdd12_entry_list_visibility.py` — passed
- BDD-13: `pytest tests/test_fts_content.py` — 21 passed

## [NO_NEED_CONFIRM]
