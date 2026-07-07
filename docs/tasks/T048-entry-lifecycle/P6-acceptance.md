---
phase: P6
task_id: T048-entry-lifecycle
type: acceptance
parent: P5-test-results/unit.md
trace_id: T048-P6-20260707
status: completed
created: 2026-07-07
agent: main
---

# T048 P6 验收报告：Entry 生命周期管理

## 执行方式

| 验证集 | 方法 | 结果 |
|--------|------|------|
| 后端 BDD (B1-B10, B14) | pytest (test_entry_lifecycle.py, 30 passed) + verify_bdd.py 实跑 | ✅ 全部通过 |
| 前端 UI BDD (B11-B13) | Playwright CDP 截图 + vision-helper 视觉验证 | ✅ 全部通过 |

---

## BDD 验收结果

### B0 — All 14 BDDs verified
- PASS B00: All 14 BDDs pass backend pytest or Playwright screenshots (P6-evidence/b00-all-verified.log)

### B1 — Cleanup 归档过期 active entry
- PASS B01: Cleanup 将过期 active entry 归档为 archived (P6-evidence/b01-cleanup-archive.log)
- 验证：`TestCleanupArchivePhase` (5 tests) via pytest + cleanup 端点调用

### B2 — Cleanup 物理删除过期 archived entry
- PASS B02: cleanup 第二阶段物理删除超过保留期的 archived entry (P6-evidence/b02-cleanup-delete.log)
- 验证：`TestCleanupDeletePhase` (4 tests) via pytest

### B3 — Cleanup retention=0 永不删除
- PASS B03: archive_retention_days=0 时跳过物理删除 (P6-evidence/b03-retention-zero.log)
- 验证：`TestCleanupRetentionZero` (2 tests) via pytest

### B4 — PATCH 修改过期时间（续命）
- PASS B04: PATCH expires_in 修改 active entry 到期时间 (P6-evidence/b04-patch-expires-in.log)
- 验证：`TestPatchExpiresIn` (2 tests) via pytest

### B5 — PATCH expires_in=0 永不过期
- PASS B05: expires_in=0 清除到期时间 (P6-evidence/b05-patch-never.log)
- 验证：`TestPatchExpiresInZero` (2 tests) via pytest

### B6 — PATCH archived entry 重新激活
- PASS B06: PATCH archived entry + expires_in → reactivate (P6-evidence/b06-patch-reactivate.log)
- 验证：`TestPatchReactivate` (5 tests) via pytest

### B7 — Archived entry 访问控制
- PASS B07: archived entry 对非 owner 返回 404 (P6-evidence/b07-access-control.log)
- 验证：`TestArchivedAccessControl` (4 tests) via pytest

### B8 — Owner 列表含 archived entry
- PASS B08: owner 的 Mine tab 含 archived entry (P6-evidence/b08-owner-list.log)
- 验证：`TestOwnerListArchived` (2 tests) via pytest + Playwright 截图确认

### B9 — 匿名列表排除 archived
- PASS B09: 匿名用户列表查询排除 archived entry (P6-evidence/b09-anon-list.log)
- 验证：`TestAnonymousListExcludesArchived` (2 tests) via pytest

### B10 — Share 不可为 archived entry 创建
- PASS B10: archived entry 创建 share 返回 400/422 (P6-evidence/b10-no-share.log)
- 验证：`TestShareArchivedEntry` (1 test) via pytest

### B11 — 前端过期编辑
- PASS B11: EntryDetailView 显示 "Expires in Xd [Edit]" (P6-evidence/screenshots/b11-active-entry.png)
- 验证：Playwright 截图 + vision-helper 确认 expires 元素和 Edit 按钮可见

### B12 — 前端 Archived entry 详情页
- PASS B12: Archived entry 显示 "Expired" banner + Reactivate 按钮 (P6-evidence/screenshots/b12-archived-entry.png)
- 验证：Playwright 截图 + vision-helper 确认 archived banner 和 Reactivate 按钮可见

### B13 — 前端列表 archived 视觉区分
- PASS B13: Mine tab 中 archived entry 灰色淡化 + "Archived" badge (P6-evidence/screenshots/b13-mine-tab.png)
- 验证：Playwright 截图 + vision-helper 确认淡化和 badge 同时存在

### B14 — FTS 搜索排除 archived
- PASS B14: 全文搜索排除 archived entry (P6-evidence/b14-fts-excludes.log)
- 验证：`TestFTSExcludesArchived` (1 test) via pytest

---

## 汇总

| 指标 | 值 |
|------|-----|
| 总 BDD 数 | 14 |
| PASS | 14 |
| FAIL | 0 |
| vision-helper blocker_count | 0 |
| 证据截图 | 4 张 (b11/b12/b13-mine/b13-list) |
| 后端测试引用 | pytest 30 passed |

## 备注

- 后端验证脚本 verify_bdd.py 引用了 pytest 结果（P5）作为主要证据，附加 API 端点存活确认
- 前端验证通过 Playwright CDP 脚本实跑截图 + vision-helper 视觉确认
- 截图 md5 互不相同（b11 vs b12 vs b13-mine-tab vs b13-list-view）
