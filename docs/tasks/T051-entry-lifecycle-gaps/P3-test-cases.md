---
phase: P3
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: test-cases
agent: test-designer
parent: P2-design.md
trace_id: T051-P3-20260709
status: draft
created: 2026-07-09
---

# T051 P3 测试用例

## 测试策略

### 工具与框架

| 缺口 | 工具 | 环境 | Mock 方式 |
|------|------|------|-----------|
| A（后台清理） | pytest + pytest-asyncio | backend/.venv | monkeypatch 替换 cleanup_expired；caplog 捕获日志；asyncio mock 控制 sleep |
| B（筛选栏） | vitest + jsdom | frontend-v3/ | vi.mock 模拟 vue-router（useRoute/push/replace）；vi.mock 模拟 entry store；mount + DOM query |
| C（过期警告） | vitest + jsdom | frontend-v3/ | makeEntry 工厂构造不同状态 entry；vi.mock 模拟 auth store；mount + DOM query |
| D（头部布局） | vitest + jsdom | frontend-v3/ | makeEntry 工厂；vi.mock useRelativeTime；mount + DOM query + CSS class 检查 |

### 数据工厂

**后端**：复用 `factories.py` 的 `EntryFactory`，新增 `create_expired_active()` 便捷方法（status=active + expires_at=past）。

**前端**：复用 `entry-lifecycle.test.ts` 的 `makeEntry()` 工厂，扩展支持 `readStats` 字段。

### Mock 原则

1. 后端：不 mock 数据库（用 tmp_path 隔离），只 mock `asyncio.sleep` 加速定时循环测试
2. 前端：mock vue-router 的 push/replace 验证调用参数；mock API client 返回预设数据；不 mock 组件内部逻辑
3. 所有 mock 在 afterEach 自动恢复（vitest 内置；pytest 用 fixture 作用域）

### test_code_dir

```
backend/tests/test_lifespan_cleanup.py          # 缺口 A
frontend-v3/src/__tests__/filter-tabs.test.ts    # 缺口 B
frontend-v3/src/__tests__/expired-warning.test.ts # 缺口 C
frontend-v3/src/__tests__/header-layout.test.ts   # 缺口 D
frontend-v3/src/__tests__/expires-utils.test.ts   # isExpired() 辅助函数
frontend-v3/src/__tests__/searchUrl-logic.test.ts # parseRestoreQuery status 扩展
```

---

## 缺口 A：后台定时清理任务（后端）

### 测试文件：`backend/tests/test_lifespan_cleanup.py`

### A-AC1：lifespan 启动后台清理任务

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-A01 | interval>0 时 lifespan 创建 asyncio.Task | A-AC1 | `cleanup_task is not None`，task 未 done | `PEEKVIEW_CLEANUP__INTERVAL_SECONDS=3600`，mock `asyncio.sleep` 返回 CancelledError 阻止真实循环 |
| TC-A02 | 后台 Task 按间隔调用 cleanup_expired | A-AC1 | cleanup_expired 被调用 ≥1 次 | mock `admin_service.cleanup_expired`，mock `asyncio.sleep` 在首次 sleep 后 raise CancelledError |
| TC-A03 | check_on_start=True 时立即执行一次 | A-AC1 | cleanup_expired 在首次 sleep 之前被调用 | mock cleanup_expired + sleep，验证调用顺序 |
| TC-A04 | check_on_start=False 时不立即执行 | A-AC1 | cleanup_expired 在首次 sleep 之后才被调用 | 同上，验证 sleep 先于 cleanup |

### A-AC2：interval_seconds=0 禁用后台清理

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-A05 | interval=0 时不创建后台 Task | A-AC2 | `cleanup_task is None` | `PEEKVIEW_CLEANUP__INTERVAL_SECONDS=0` |
| TC-A06 | interval=0 时日志记录禁用信息 | A-AC2 | caplog 包含 "Cleanup background task disabled (interval=0)" | caplog 捕获 |

### A-AC3：shutdown 优雅取消后台任务

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-A07 | shutdown 时 cancel() 后台 Task | A-AC3 | task.cancelled() 为 True | 进入 lifespan yield 后手动触发 shutdown |
| TC-A08 | cleanup 执行中 shutdown 等待完成 | A-AC3 | wait_for(timeout=30) 被调用，cleanup 完成 | mock cleanup_expired 慢执行（sleep 1s），验证 shutdown 不早于 cleanup 完成 |
| TC-A09 | shutdown 超时后强制取消 | A-AC3 | CancelledError 被捕获，不抛异常 | mock cleanup_expired 执行 >30s，mock wait_for raise TimeoutError |
| TC-A10 | shutdown 日志记录取消信息 | A-AC3 | caplog 包含 "Cleanup background task cancelled" | caplog 捕获 |

### A-AC4：cleanup 执行日志

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-A11 | cleanup 完成后记录归档/删除/释放量 | A-AC4 | caplog 包含 "Cleanup: archived=N, deleted=N, freed=X.XXMB" | mock cleanup_expired 返回 AdminCleanupResponse |
| TC-A12 | cleanup 异常时记录错误日志 | A-AC4 | caplog 包含 "Cleanup: ... failed"，后续循环继续 | mock cleanup_expired raise Exception，验证第二次仍被调用 |
| TC-A13 | check_on_start 首次执行日志 | A-AC4 | caplog 包含 "Cleanup: running initial check (check_on_start=True)" | check_on_start=True |

### 隐含需求覆盖

| 隐含需求 | 测试覆盖 |
|---------|---------|
| A1: run_in_executor 调用同步方法 | TC-A02（验证 cleanup_expired 在 executor 中被调用，不阻塞事件循环） |
| A2: shutdown 优雅取消 | TC-A07/A08/A09 |
| A3: interval=0 禁用 | TC-A05/A06 |
| A4: check_on_start 立即执行 | TC-A03/A04 |
| A5: cleanup 日志 | TC-A11/A12/A13 |
| A6: 多 worker 限制 | 代码注释标注，不测试（当前单 worker） |

---

## 缺口 B：筛选栏重设计（前端）

### 测试文件：`frontend-v3/src/__tests__/filter-tabs.test.ts` + `searchUrl-logic.test.ts`

### B-AC1：三元筛选 tab

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B01 | 页面加载显示 All/Mine/Archived 三个 tab | B-AC1 | DOM 包含 3 个 tab 按钮，文本正确 | mount EntryListView，query `.owner-tab` |
| TC-B02 | 默认选中 All tab | B-AC1 | All tab 有 `active` class | 初始 mount，无 URL 参数 |
| TC-B03 | 点击 Mine → loadEntries({owner:'me'}) | B-AC1 | store.loadEntries 被调用，参数含 owner:'me' | vi.mock entry store，click Mine tab |
| TC-B04 | 点击 Archived → loadEntries({status:'archived'}) | B-AC1 | store.loadEntries 被调用，参数含 status:'archived' | vi.mock entry store，click Archived tab |
| TC-B05 | 点击 All → loadEntries 无筛选参数 | B-AC1 | store.loadEntries 被调用，参数无 owner/status | 从 Mine/Archived 切回 All |

### B-AC2：URL 状态同步

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B06 | 点击 Archived → URL 更新 ?status=archived（push） | B-AC2 | router.push 被调用，query 含 status=archived | vi.mock vue-router |
| TC-B07 | URL 使用 push 非 replace | B-AC2 | 调用 router.push 而非 router.replace | vi.mock 验证方法名 |
| TC-B08 | 浏览器后退 → 回到 All 状态 | B-AC2 | popstate 触发 restoreFromURL，owner/status 清空 | 模拟 route.query 变化 |
| TC-B09 | 刷新页面 → 仍显示 Archived 筛选 | B-AC2 | parseRestoreQuery 从 URL 恢复 status=archived | 初始 route.query 含 status=archived |
| TC-B10 | parseRestoreQuery 解析 status 参数 | B-AC2 | 返回 `{q, owner, status, page}` | 纯函数测试，输入 `?status=archived` |

### B-AC3：用户名可点击跳转

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B11 | 点击 @username → 跳转 /users/{username} | B-AC3 | router.push 被调用，path 含 /users/username | mount EntryCard，click @username |
| TC-B12 | @username chip 显示在筛选栏 | B-AC3 | DOM 包含 FilterChip，label 为 @username | route.query 含 owner=username |

### B-AC4：用户名格式统一

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B13 | EntryCard 显示 @username 格式 | B-AC4 | 文本含 @ 前缀 | mount EntryCard，entry.username='alice' |
| TC-B14 | EntryListRow 显示 @username 格式 | B-AC4 | 文本含 @ 前缀 | mount EntryListRow，entry.username='alice' |
| TC-B15 | 两处 @username 均可点击 | B-AC4 | 元素为 router-link 或有 click handler | 检查元素 tag/handler |

### B-AC5：匿名 entry 无用户名显示

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B16 | username=null 时 EntryCard 不显示用户名 | B-AC5 | DOM 无 @username 元素 | entry.username=null |
| TC-B17 | username=null 时 EntryListRow 不显示用户名 | B-AC5 | DOM 无 @username 元素 | entry.username=null |

### B-AC6：Archived 空状态提示

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-B18 | Archived 筛选返回空列表时显示空状态提示 | B-AC6 | DOM 包含"暂无已归档条目"文本 | mock store.entries=[]，status=archived |

### 隐含需求覆盖

| 隐含需求 | 测试覆盖 |
|---------|---------|
| B1: status URL 同步 | TC-B06/B09/B10 |
| B2: push 非 replace | TC-B07 |
| B3: null username 跳过 | TC-B16/B17 |
| B4: Archived 空状态 | TC-B18 |
| B5: Mine+Archived 组合 | B1 方案为互斥 tab，不暴露组合（P1 未要求） |
| B6: 用户名 tab 切换清除 | TC-B05（切 All 清除筛选） |

---

## 缺口 C：过期警告（前端）

### 测试文件：`frontend-v3/src/__tests__/expired-warning.test.ts` + `expires-utils.test.ts`

### C-AC1：详情页过期警告 banner

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-C01 | status=active + expired → 显示黄色 banner | C-AC1 | DOM 包含 `.expired-warning-banner`，背景色为 warning | makeEntry({status:'active', expiresAt: past}) |
| TC-C02 | banner 文案提示"此条目已过期，等待清理" | C-AC1 | banner 文本含过期提示文案 | 同上 |
| TC-C03 | owner 可点击"重新设置过期时间"按钮 | C-AC1 | banner 含按钮，click 触发 showExpiresInDialog | mock authStore.isOwner=true |
| TC-C04 | 非 owner 不显示"重新设置"按钮 | C-AC1 | banner 无操作按钮 | mock authStore.isOwner=false |

### C-AC2：过期警告与 archived banner 视觉区分

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-C05 | archived entry 显示灰色 banner | C-AC2 | `.archived-banner` 存在，背景色为 error-surface | makeEntry({status:'archived'}) |
| TC-C06 | expired-but-active 显示黄色 banner | C-AC2 | `.expired-warning-banner` 存在，背景色为 warning-surface | makeEntry({status:'active', expiresAt: past}) |
| TC-C07 | 两者不同时显示 | C-AC2 | status=archived 时不显示 expired-warning | makeEntry({status:'archived'})，验证无 expired-warning-banner |

### C-AC3：列表页过期视觉提示

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-C08 | EntryCard 过期未归档显示 expired badge | C-AC3 | DOM 包含 BaseBadge status="expired" | makeEntry({status:'active', expiresAt: past})，mount EntryCard |
| TC-C09 | EntryListRow 过期未归档显示 expired badge | C-AC3 | DOM 包含 BaseBadge status="expired" | 同上，mount EntryListRow |
| TC-C10 | expired badge 与 archived badge 视觉不同 | C-AC3 | expired badge 样式含 --c-badge-expired-bg，archived 含 --c-badge-archived-bg | CSS 变量检查 |

### C-AC4：cleanup 后警告消失

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-C11 | status 变为 archived 后过期 banner 消失 | C-AC4 | 更新 entry.status='archived' 后，expired-warning-banner 不存在 | 响应式更新 entry |
| TC-C12 | status 变为 archived 后显示 archived banner | C-AC4 | 更新后 .archived-banner 存在 | 同上 |

### 辅助函数测试

| ID | 测试用例 | 预期 |
|----|---------|------|
| TC-C13 | isExpired(entry) — active + past expiresAt → true | `isExpired({status:'active', expiresAt: past}) === true` |
| TC-C14 | isExpired(entry) — active + future expiresAt → false | `isExpired({status:'active', expiresAt: future}) === false` |
| TC-C15 | isExpired(entry) — active + null expiresAt → false | `isExpired({status:'active', expiresAt: null}) === false` |
| TC-C16 | isExpired(entry) — archived + past expiresAt → false | `isExpired({status:'archived', expiresAt: past}) === false` |

### 隐含需求覆盖

| 隐含需求 | 测试覆盖 |
|---------|---------|
| C1: 黄色 vs 灰色视觉区分 | TC-C05/C06/C07 |
| C2: cleanup 后自动消失 | TC-C11/C12 |
| C3: 列表页视觉提示 | TC-C08/C09/C10 |
| C4: 操作按钮复用 showExpiresInDialog | TC-C03 |

---

## 缺口 D：头部布局（前端）

### 测试文件：`frontend-v3/src/__tests__/header-layout.test.ts`

### D-AC1：详情页时间格式混合显示

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-D01 | 桌面端主显示相对时间 | D-AC1 | `.entry-time` 文本为 "2d ago" 格式 | mock useRelativeTime 返回 {relative:'2d ago', full:'2026-07-07 14:30'} |
| TC-D02 | hover/title 显示绝对时间 | D-AC1 | `.entry-time` 的 title 属性含 ISO/本地格式时间 | 同上，检查 element.title |
| TC-D03 | 列表页卡片时间 hover 显示绝对时间 | D-AC1 | EntryCard 时间元素有 title 属性 | mount EntryCard，检查 time 元素 |
| TC-D04 | 列表页行时间 hover 显示绝对时间 | D-AC1 | EntryListRow 时间元素有 title 属性 | mount EntryListRow，检查 time 元素 |

### D-AC2：详情页 header 信息层级

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-D05 | header 包含双行结构（meta 行 + 操作行） | D-AC2 | DOM 包含 `.header-meta-row` 和 `.header-actions-row` | mount EntryDetailView |
| TC-D06 | meta 行包含 owner → 时间 → 阅读量 | D-AC2 | meta 行子元素按顺序为 owner/time/reads | 检查 DOM 子元素顺序 |
| TC-D07 | 操作行包含 expires + 操作按钮 | D-AC2 | actions 行含 expires 区域和按钮组 | 检查 DOM 结构 |
| TC-D08 | owner 可点击（router-link） | D-AC2 | owner 元素为 router-link，to="/users/{username}" | 检查元素 tag/属性 |

### D-AC3：移动端底部 bar 信息展示

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-D09 | 移动端底部 bar 包含 owner 信息 | D-AC3 | `.mobile-actions` 内含 owner 文本 | mount + 检查 mobile-actions DOM |
| TC-D10 | 移动端底部 bar 包含过期状态 | D-AC3 | `.mobile-actions` 内含 expires/expired 指示 | makeEntry({expiresAt: past}) |
| TC-D11 | 移动端操作按钮仍可访问 | D-AC3 | `.mobile-actions` 内含操作按钮 | 检查按钮存在 |
| TC-D12 | 信息与按钮不互相遮挡 | D-AC3 | mobile-actions 布局为 flex，信息左/按钮右 | CSS class 检查 |

### D-AC4：列表页时间格式统一

| ID | 测试用例 | BDD 映射 | 预期 | Mock/Setup |
|----|---------|----------|------|------------|
| TC-D13 | EntryCard 时间格式与详情页一致 | D-AC4 | 相对时间 + title 绝对时间 | mount EntryCard，检查 time 元素 |
| TC-D14 | EntryListRow 时间格式与详情页一致 | D-AC4 | 相对时间 + title 绝对时间 | mount EntryListRow，检查 time 元素 |

### 隐含需求覆盖

| 隐含需求 | 测试覆盖 |
|---------|---------|
| D1: 相对+绝对混合模式 | TC-D01/D02/D03/D04 |
| D2: 移动端 bar 增加信息 | TC-D09/D10/D11/D12 |
| D3: header 信息层级重规划 | TC-D05/D06/D07/D08 |
| D4: 列表页时间格式统一 | TC-D13/D14 |

---

## BDD 条件 → 测试用例映射总表

| BDD 条件 | 测试用例 | 数量 |
|---------|---------|------|
| A-AC1 | TC-A01~A04 | 4 |
| A-AC2 | TC-A05~A06 | 2 |
| A-AC3 | TC-A07~A10 | 4 |
| A-AC4 | TC-A11~A13 | 3 |
| B-AC1 | TC-B01~B05 | 5 |
| B-AC2 | TC-B06~B10 | 5 |
| B-AC3 | TC-B11~B12 | 2 |
| B-AC4 | TC-B13~B15 | 3 |
| B-AC5 | TC-B16~B17 | 2 |
| B-AC6 | TC-B18 | 1 |
| C-AC1 | TC-C01~C04 | 4 |
| C-AC2 | TC-C05~C07 | 3 |
| C-AC3 | TC-C08~C10 | 3 |
| C-AC4 | TC-C11~C12 | 2 |
| C-辅助 | TC-C13~C16 | 4 |
| D-AC1 | TC-D01~D04 | 4 |
| D-AC2 | TC-D05~D08 | 4 |
| D-AC3 | TC-D09~D12 | 4 |
| D-AC4 | TC-D13~D14 | 2 |
| **合计** | | **56** |

---

## P6 Playwright/E2E 用例（ui_affected=true）

P2 声明 `ui_affected: true`，7 个交互点需 Playwright 验证。以下为 P6 验收时的 E2E 用例规划，P3/P4 阶段不写 E2E 代码。

| 交互点 | E2E 用例 | 截图 viewport |
|--------|---------|--------------|
| EntryListView: All/Mine/Archived tab 切换 | 点击各 tab，验证列表内容变化 + URL 更新 | desktop |
| EntryListView: @username 点击跳转 | 点击卡片 @username，验证跳转 /users/{username} | desktop |
| EntryCard/EntryListRow: @username 可点击 + 时间 hover | hover 时间显示 tooltip，click @username 跳转 | desktop |
| EntryDetailView: 过期警告 banner（黄色） | 访问过期未归档 entry，验证黄色 banner + 按钮 | desktop + mobile |
| EntryDetailView: header 双行布局 | 验证 meta 行 + 操作行分离 | desktop + mobile |
| EntryDetailView: 移动端底部 bar | 验证 owner + 过期状态 + 操作按钮 | mobile (390x844) |
| EntryCard/EntryListRow: expired badge | 列表页过期 entry 显示琥珀色 badge | desktop |

---

## TDD 红灯预期

所有测试用例在 P3 阶段应为红灯（失败），原因：

| 缺口 | 红灯原因 |
|------|---------|
| A | lifespan() 尚未创建 cleanup_task；cleanup_expired 无日志输出 |
| B | EntryListView 无 Archived tab；parseRestoreQuery 不解析 status；EntryCard/Row 无 @ 前缀/可点击 |
| C | isExpired() 函数不存在；EntryDetailView 无 expired-warning-banner；BaseBadge 无 expired status |
| D | EntryDetailView header 无双行结构；时间元素无 title 属性；mobile-actions 无 owner/expires 信息 |
