---
phase: P6
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: acceptance
agent: verifier
parent: P5-test-results/unit.md
trace_id: T051-P6-20260709
status: draft
created: 2026-07-09
---

# T051 P6 验收结果

## 验收环境

- Debug backend: http://127.0.0.1:8888 (PEEKVIEW_DEBUG_MODE=1)
- 数据库: /tmp/peekview-debug/peekview.db (隔离)
- CDP Chrome: http://127.0.0.1:18800
- 测试用户: testuser (is_admin=true), testuser2 (no entries)
- 测试数据: p6-active, p6-expired-active (active+expired), p6-archived (archived), p6-anonymous (owner_id=null), p6-expired (archived by cleanup)

## 缺口 A：后台定时清理

### A-AC1：lifespan 启动后台清理任务

- PASS A-AC1: 后端测试 `test_interval_gt_zero_creates_task` + `test_interval_gt_zero_task_calls_cleanup` + `test_check_on_start_true_runs_immediately` + `test_check_on_start_false_no_immediate_call` 全部通过，验证了 interval>0 时创建 asyncio.Task、按间隔调用 cleanup_expired()、check_on_start 控制首次执行时机 (P6-evidence/test-lifespan-cleanup.log)

### A-AC2：interval_seconds=0 禁用后台清理

- PASS A-AC2: 后端测试 `test_interval_zero_no_task` + `test_interval_zero_disabled_log` 通过，验证 interval=0 时不创建后台任务且日志记录 "Cleanup background task disabled" (P6-evidence/test-lifespan-cleanup.log)

### A-AC3：shutdown 优雅取消后台任务

- PASS A-AC3: 后端测试 `test_shutdown_cancels_task` + `test_shutdown_cancel_log` 通过，验证 shutdown 时 task 被 cancel() 且日志记录 "Cleanup background task cancelled" (P6-evidence/test-lifespan-cleanup.log)

### A-AC4：cleanup 执行日志

- PASS A-AC4: 后端测试 `test_cleanup_logs_archived_deleted_freed` 通过，验证 cleanup 完成后日志记录归档数量、删除数量和释放空间 (P6-evidence/test-lifespan-cleanup.log)

## 缺口 B：筛选栏

### B-AC1：三元筛选 tab

- PASS B-AC1: /explore 页面显示 All / Mine / Archived 三个 tab，默认选中 All；点击 Mine → URL 更新为 /explore?owner=me；点击 Archived → URL 更新为 /explore?status=archived (P6-evidence/screenshots/B-AC1-explore-tabs.png)

### B-AC2：URL 状态同步

- PASS B-AC2: 点击 Archived tab → URL 更新为 /explore?status=archived（push 非 replace）；浏览器后退 → 回到 /explore?owner=me（前一个筛选状态）；直接访问 /explore?status=archived → Archived tab 自动激活 (P6-evidence/screenshots/B-AC2-url-sync.png)

### B-AC3：用户名可点击跳转

- PASS B-AC3: 列表页 entry 卡片显示 @testuser 链接（href=/users/testuser），点击后跳转到 /users/testuser 页面 (P6-evidence/screenshots/B-AC3-username-click.png)

### B-AC4：用户名格式统一

- PASS B-AC4: 卡片模式和列表行模式均显示 @testuser 格式（统一 @ 前缀），两处均为可点击的 router-link (P6-evidence/screenshots/B-AC4-username-format.png)

### B-AC5：匿名 entry 无用户名显示

- PASS B-AC5: Anonymous entry（owner_id=null）在列表中不显示用户名链接，不渲染 @username，仅显示 "8h ago" 时间信息 (P6-evidence/screenshots/B-AC5-anonymous-entry.png)

### B-AC6：Archived 空状态提示

- PASS B-AC6: 无已归档条目时（testuser2 用户），Archived tab 显示空状态提示 "暂无已归档条目"（非空白页面） (P6-evidence/screenshots/B-AC6-archived-empty-state.png)

## 缺口 C：过期警告

### C-AC1：详情页过期警告 banner

- PASS C-AC1: p6-expired-active（status=active, expires_at<now）详情页显示浅黄色过期警告 banner（bg=rgba(154,103,0,0.08)），文案 "此条目已过期，等待清理"，owner 可点击 "重新设置过期时间" 按钮打开 expires 编辑对话框 (P6-evidence/screenshots/C-AC1-expired-banner.png)

### C-AC2：过期警告与 archived banner 视觉区分

- PASS C-AC2: expired-but-active entry 显示琥珀色 banner（bg=rgba(154,103,0,0.08)），archived entry 显示红色 banner（bg=rgba(207,34,46,0.08)，文案 "This entry has expired" + "Reactivate"），两者背景色和语义有明显视觉差异 (P6-evidence/screenshots/C-AC2-archived-banner.png)

### C-AC3：列表页过期视觉提示

- PASS C-AC3: 列表页 p6-expired-active 条目显示 `badge-expired` 标记（"expired"），p6-archived 条目显示 `badge-archived` 标记（"archived"），两者视觉提示不同 (P6-evidence/screenshots/C-AC3-list-expired-indicator.png)

### C-AC4：cleanup 后警告消失

- PASS C-AC4: p6-expired 被 cleanup 归档后（status=archived），详情页不再显示过期警告 banner，改为显示 archived banner（灰色/红色），验证了 cleanup 执行后警告自然消失 (P6-evidence/screenshots/C-AC4-after-cleanup.png)

## 缺口 D：头部布局

### D-AC1：详情页时间格式混合显示

- PASS D-AC1: 详情页时间主显示为相对时间 "8h ago"，hover/title 属性显示绝对时间 "2026/7/9 11:02:51" (P6-evidence/screenshots/D-AC1-time-format.png)

### D-AC2：详情页 header 信息层级

- PASS D-AC2: 详情页 header 分为 meta 行和 actions 行；meta 行按层级排列：entry-owner-link(@testuser) → entry-time(8h ago) → entry-read-stats(3 reads) → entry-expires(Expires in 15d)；actions 行包含操作按钮（Public/Delete/Raw），各信息项有明确视觉分隔 (P6-evidence/screenshots/D-AC2-header-hierarchy.png)

### D-AC3：移动端底部 bar 信息展示

- PASS D-AC3: 移动端（375x812）底部 bar 包含 mobile-info（@testuser owner 链接）和 mobile-buttons（操作按钮），信息与按钮不互相遮挡（flex 布局左信息右按钮）；过期条目额外显示 "expired" 指示器 (P6-evidence/screenshots/D-AC3-mobile-bar-active.png) (P6-evidence/screenshots/D-AC3-mobile-bar-expired.png)

### D-AC4：列表页时间格式统一

- PASS D-AC4: 列表页所有 entry 时间主显示为相对时间（如 "8h ago"），hover/title 属性显示绝对时间（如 "2026/7/9 11:02:51"），卡片和列表行格式一致 (P6-evidence/screenshots/D-AC4-list-time-format.png)

## 验收汇总

| BDD | 结果 | 证据 |
|-----|------|------|
| A-AC1 | PASS | P6-evidence/test-lifespan-cleanup.log |
| A-AC2 | PASS | P6-evidence/test-lifespan-cleanup.log |
| A-AC3 | PASS | P6-evidence/test-lifespan-cleanup.log |
| A-AC4 | PASS | P6-evidence/test-lifespan-cleanup.log |
| B-AC1 | PASS | P6-evidence/screenshots/B-AC1-explore-tabs.png |
| B-AC2 | PASS | P6-evidence/screenshots/B-AC2-url-sync.png |
| B-AC3 | PASS | P6-evidence/screenshots/B-AC3-username-click.png |
| B-AC4 | PASS | P6-evidence/screenshots/B-AC4-username-format.png |
| B-AC5 | PASS | P6-evidence/screenshots/B-AC5-anonymous-entry.png |
| B-AC6 | PASS | P6-evidence/screenshots/B-AC6-archived-empty-state.png |
| C-AC1 | PASS | P6-evidence/screenshots/C-AC1-expired-banner.png |
| C-AC2 | PASS | P6-evidence/screenshots/C-AC2-archived-banner.png |
| C-AC3 | PASS | P6-evidence/screenshots/C-AC3-list-expired-indicator.png |
| C-AC4 | PASS | P6-evidence/screenshots/C-AC4-after-cleanup.png |
| D-AC1 | PASS | P6-evidence/screenshots/D-AC1-time-format.png |
| D-AC2 | PASS | P6-evidence/screenshots/D-AC2-header-hierarchy.png |
| D-AC3 | PASS | P6-evidence/screenshots/D-AC3-mobile-bar-active.png, P6-evidence/screenshots/D-AC3-mobile-bar-expired.png |
| D-AC4 | PASS | P6-evidence/screenshots/D-AC4-list-time-format.png |

**总计: 18 条 BDD, PASS: 18, FAIL: 0**
