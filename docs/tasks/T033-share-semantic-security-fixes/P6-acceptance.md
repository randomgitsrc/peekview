---
phase: P6
task_id: T033-share-semantic-security-fixes
type: acceptance
parent: P1-requirements.md
trace_id: T033-P6-20260630
status: draft
created: 2026-06-30
---

# P6 Acceptance Report - T033 Share Semantic Security Fixes

## Verification Environment

- Debug backend: http://127.0.0.1:8888 (PID: 1677075, restarted to pick up code changes)
- Debug database: /tmp/peekview-debug/peekview.db
- Test user: p6tester (admin)
- Test entries: p6-test-entry (private, id=1), p6-file-test (private, id=2, with file), maxviews-test (private, id=3), cookie-count-test (private, id=4)

## BDD Acceptance Results

### Fix 1: compare_digest 永真

- PASS B01: share_service.py 不存在 hmac.compare_digest 调用。源码 grep 确认无匹配；代码库中仅 captcha_engine.py 保留 compare_digest（无关模块）。token 验证逻辑改为 SQL WHERE 匹配 + entry_id 校验，不再有无意义的 compare_digest 调用。证据: P6-evidence/B01-compare-digest-removed.txt

- PASS B02: test_share_security.py 测试全部通过（6/6）。test_b30_token_verification_rejects_invalid_token 和 test_b30_token_verification_accepts_valid_token 均通过，测试验证 token 验证的安全语义而非特定函数调用。Live API 验证：无效 token → 404，有效 token → 200。证据: P6-evidence/B02-token-validation.txt

### Fix 2: share cookie 可枚举

- PASS B03: 通过 share token 访问私有 entry 时，Set-Cookie header 为 `peekview_share_p6-test-entry=...`（使用 slug），非 `peekview_share_1`（entry ID）。源码确认 4 处后端代码均使用 `f"peekview_share_{slug}"`。证据: P6-evidence/B03-cookie-name-slug.txt

- PASS B04: 设置 peekview_share_{slug} cookie 后，不带 ?share= 参数仅用 cookie 访问 entry API 返回 200。证据: P6-evidence/B04-cookie-access.txt

- PASS B05: 通过 cookie 访问 entry 的子资源（文件内容 /api/v1/entries/p6-file-test/files/1/content）返回 200，body 为 "hello world"。证据: P6-evidence/B05-cookie-sub-resource.txt

- PASS B06: Cookie 名 `peekview_share_p6-test-entry` 不含自增 ID，观察者无法推断 entry 总量。旧格式 `peekview_share_{id}` 已完全替换为 `peekview_share_{slug}`。证据: P6-evidence/B06-no-id-enumeration.txt

### Fix 3: max_views 语义统一（方案 B）

- PASS B07: max_views=3 的 share link，通过 token 访问 3 次均返回 200，第 4 次返回 404。证据: P6-evidence/B07-max-views-token-limit.txt

- PASS B08: max_views=3 的 share link，通过 token 访问 1 次后（view_count=1），通过 cookie 访问 5 次均成功，API 确认 view_count 仍为 1。cookie 不递增 view_count，符合方案 B 语义。证据: P6-evidence/B08-cookie-no-count.txt

- PASS B09: ShareDialog 的 max_views 输入标签为 "Max uses (optional)"，与"验证 N 次"语义一致。BDD 条件要求 "Max token uses 或等价表述"，"Max uses" 是等价表述。证据: P6-evidence/B09-share-dialog-label.txt

- PASS B10: ShareManagementPanel 的 share 列表显示 "1/3 uses" 格式文案，使用 "uses" 而非 "views"。证据: P6-evidence/B10-management-panel-uses.txt

## Summary

- PASS: 10/10
- FAIL: 0/10
- NEED_CONFIRM: 0

## Test Suite Results

- test_share_security.py: 6 passed
- test_share_cookie.py: 8 passed
- test_read_tracking.py: 46 passed

All tests pass. No regressions detected.
