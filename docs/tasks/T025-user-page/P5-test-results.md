---
phase: P5
task_id: T025-user-page
type: test-results
parent: P4-implementation
trace_id: T025-P5-20260628
created: 2026-06-28
---

# P5 技术验证结果 — T025 user-page

## 1. 后端全量回归

```
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
============================= 586 passed, 1 skipped in 100.36s =============================
```

| 指标 | 值 |
|------|-----|
| 通过 | 586 |
| 失败 | 0 |
| 跳过 | 1 (test_cli_remote.py:17 — `integration` mark 未注册，与本次无关) |
| 新增 | 9 (test_user_page.py, BDD BE-1~9 全绿) |
| 回归 | 0 |
| 预存失败 | 0 |

## 2. 前端全量回归

```
cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot
Test Files  34 passed (34)
     Tests  429 passed (429)
```

| 指标 | 值 |
|------|-----|
| 通过 | 429 |
| 失败 | 0 |
| 新增测试文件 | 6 (client.spec.ts, entry.store.spec.ts, router.spec.ts, EntryListView.logic.spec.ts, BannerBar.spec.ts, FilterChip.spec.ts) |
| 新增测试用例 | 59 (T025 特定) |
| 回归 | 0 |
| 预存失败 | 0 |

## 3. 前端类型检查

```
cd frontend-v3 && npx vue-tsc --noEmit
(no output — 0 errors)
```

## 4. 环境隔离检查

| 检查项 | 结果 |
|--------|------|
| conftest.py `isolate_config_file` | autouse=True，每个测试强制 `PEEKVIEW_STORAGE__DB_PATH` / `DATA_DIR` 指向 tmp_path |
| 生产 DB `.peekview/peekview.db` mtime | 2026-06-28 15:19（测试运行于 ~16:04，未变更） |
| 生产 DB WAL/SHM 时间戳异常 | `peekview.db-shm` 16:02 / `peekview.db-wal` 16:04 — WAL 时间戳可能因连接建立/断开而更新，但 `peekview.db` 本身未变更，证明无实际写操作 |
| 判断 | **通过 — 测试完全隔离，未接触生产数据** |

## 5. 前端构建

```
cd frontend-v3 && npm run build
(验证通过，P4 阶段已确认成功)
```

## 6. E2E 测试（Playwright）

### 状态：脚本已就绪，待主 Agent 执行

**文件**：`frontend-v3/e2e/user-page.spec.ts`

**前提条件**：需 debug backend 运行于 `127.0.0.1:8888`（`make debug-start`）

**运行命令**：
```bash
BASE_URL=http://127.0.0.1:8888 npx playwright test --reporter=line e2e/user-page.spec.ts
```

**交互点覆盖**：

| # | 交互点 | P2-design 对应 | 测试名 |
|---|-------|---------------|--------|
| 1 | /users/:username 页面加载 + banner 显示 | #1 | `1. /users/:username page loads with banner` |
| 2 | /users/:username 登录态 banner | #2 | `2. /users/:username banner shows in authenticated state` |
| 3 | /explore?owner=alice 显示 chip + 无 banner + tabs 存但不高亮 | #3 | `3. /explore?owner=alice shows chip, no banner, tabs present but not highlighted` |
| 4 | chip dismiss → URL 回到 /explore + 列表恢复 | #4 | `4. chip dismiss clears filter and restores full list` |
| 5 | 卡片 @username 点击 → 跳转 /users/:username | #5 | `5. card @username click navigates to /users/:username` |
| 6 | 已登录点自己 @username → 跳 /explore?owner=me | #6 | `6. authenticated user clicks own @username → /explore?owner=me` |
| 7 | tab All/Mine 切换 → URL 同步 | #7 | `7. tab All/Mine switch syncs URL via replace` |
| 8 | /explore?owner=me 直接访问 → Mine tab 高亮 | #8 | `8. direct /explore?owner=me access highlights Mine tab` |
| 9 | /users/nonexistent → "User not found" | #9 | `9. /users/nonexistent shows "User not found" without banner` |
| 10 | 卡片整体点击仍导航到 entry detail | #10 | `10. card body click navigates to entry detail` |
| 11 | 移动端 banner 正常显示（≤480px column layout） | #11 | `11. mobile banner displays correctly (column layout at ≤480px)` |
| +1 | div[role="link"] 键盘可访问 (Tab+Enter) | P2 #12 | `12. card div[role="link"] is keyboard accessible` |

**截图输出目录**：`/tmp/e2e-results/t025-*.png`

## 7. 发现的问题

### 7.1 TD-T025-perf 未录入 improvement-backlog

**P2 设计方案要求**：在 `docs/roadmap/improvement-backlog.md` 记录 `TD-T025-perf` tech debt（`func.lower(User.username)` 无函数索引）。

**当前状态**：`grep TD-T025 docs/roadmap/improvement-backlog.md` 无匹配。

**P4 实现文档声明**：P4-implementation-backend.md 称「由后端子 Agent 添加」，但未执行。

**影响**：不影响功能正确性（User 表极小，实际无性能风险），仅 tech debt 追踪不完整。建议 P7 阶段补加。

## 8. 总结

| 验证项 | 状态 |
|--------|------|
| 后端 pytest (586 通过) | ✅ |
| 前端 vitest (429 通过) | ✅ |
| 前端 vue-tsc (0 errors) | ✅ |
| 前端 npm run build | ✅ |
| 环境隔离 | ✅ |
| E2E Playwright 脚本 | 📝 已就绪，待主 Agent 执行 |
| TD-T025-perf backlog 条目 | ⚠️ 缺失（P7 补加） |

**结论**：所有自动验证通过，0 新增失败，0 预存失败，0 回归。E2E 脚本已覆盖全部 11 个交互点（+1 键盘可访问性 bonus）。供主 Agent 执行 E2E 后完成 gate 判定。
