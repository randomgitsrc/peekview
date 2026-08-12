---
phase: P2
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: design
agent: architect
parent: P1-requirements.md
trace_id: T051-P2-20260709
status: draft
created: 2026-07-09
---

# T051 P2 方案设计

## 影响域分析

### 改什么

| 缺口 | 文件 | 改动内容 |
|------|------|---------|
| A | `backend/peekview/main.py` | lifespan() 中启动/取消后台清理 asyncio.Task |
| A | `backend/peekview/services/admin_service.py` | cleanup_expired() 增加日志输出 |
| B | `frontend-v3/src/views/EntryListView.vue` | 筛选栏重设计（All/Mine/Archived + @用户） |
| B | `frontend-v3/src/views/searchUrl.logic.ts` | parseRestoreQuery/mergeQuery 支持 status 参数 |
| B | `frontend-v3/src/components/EntryCard.vue` | 用户名可点击 + 统一 @ + 时间 hover |
| B | `frontend-v3/src/components/EntryListRow.vue` | 同上 |
| C | `frontend-v3/src/views/EntryDetailView.vue` | 过期警告 banner + header 布局 |
| C | `frontend-v3/src/components/EntryCard.vue` | 过期视觉提示 |
| C | `frontend-v3/src/components/EntryListRow.vue` | 过期视觉提示 |
| C | `frontend-v3/src/utils/expires.ts` | 新增 isExpired() 辅助函数 |
| D | `frontend-v3/src/views/EntryDetailView.vue` | header 信息层级重设计 + 移动端 bar |
| D | `frontend-v3/src/styles/layout.css` | mobile-actions 布局调整 |
| D | `frontend-v3/src/styles/variables.css` | 新增 --c-warning-surface / --c-error-surface |
| D | `frontend-v3/src/components/EntryCard.vue` | 时间格式 hover/title |
| D | `frontend-v3/src/components/EntryListRow.vue` | 时间格式 hover/title |

### 不改什么

- 后端 API schema（list_entries 已支持 owner/status，无需变更）
- MCP tools / CLI（无需同步）
- 路由结构（/users/:username 已存在）
- 数据库 schema
- 认证/权限模型

### 风险在哪

1. **后台 task 生命周期**：cleanup_expired() 是同步方法，在 async lifespan 中需 run_in_executor；shutdown 时需优雅取消
2. **URL 状态同步**：筛选 tab 切换需 push（非 replace），restoreFromURL 需解析 status 参数
3. **CSS 变量缺失**：`--c-error-surface` 已被使用但未定义，需补全；需新增 `--c-warning-surface`
4. **移动端空间**：mobile-actions bar 高度固定 56px，增加信息展示需重新规划布局

---

## §1 候选方案

### 缺口 A：后台定时清理任务

**design_trivial: true** — 纯后端逻辑，模式明确（asyncio.Task + lifespan），无需多方案比较。

### 方案 A1（唯一方案）：lifespan 中 asyncio.Task 周期清理

**设计**：

```python
# main.py lifespan()
@asynccontextmanager
async def lifespan(app: FastAPI):
    config: PeekConfig = app.state.config
    logger.info(f"Starting PeekView server v{app.version}")

    init_db(config.db_path)

    # 启动后台清理任务
    cleanup_task: asyncio.Task | None = None
    interval = config.cleanup.interval_seconds

    if interval > 0:
        admin_service = app.state.admin_service
        check_on_start = config.cleanup.check_on_start

        async def cleanup_loop():
            if check_on_start:
                logger.info("Cleanup: running initial check (check_on_start=True)")
                try:
                    result = await asyncio.get_event_loop().run_in_executor(
                        None, admin_service.cleanup_expired
                    )
                    logger.info(
                        "Cleanup: archived=%d, deleted=%d, freed=%.2fMB",
                        result.archived_count, result.deleted_count, result.freed_mb,
                    )
                except Exception:
                    logger.exception("Cleanup: initial check failed")

            while True:
                await asyncio.sleep(interval)
                try:
                    result = await asyncio.get_event_loop().run_in_executor(
                        None, admin_service.cleanup_expired
                    )
                    logger.info(
                        "Cleanup: archived=%d, deleted=%d, freed=%.2fMB",
                        result.archived_count, result.deleted_count, result.freed_mb,
                    )
                except Exception:
                    logger.exception("Cleanup: periodic check failed")

        cleanup_task = asyncio.create_task(cleanup_loop())
        logger.info("Cleanup background task started (interval=%ds)", interval)
    else:
        logger.info("Cleanup background task disabled (interval=0)")

    yield

    # Shutdown: 取消后台任务
    if cleanup_task and not cleanup_task.done():
        cleanup_task.cancel()
        try:
            await asyncio.wait_for(cleanup_task, timeout=30)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass
        logger.info("Cleanup background task cancelled")

    logger.info("Shutting down PeekView server")
```

**关键决策**：
- `run_in_executor(None, ...)` 将同步 cleanup_expired() 放线程池执行，不阻塞事件循环
- `asyncio.sleep(interval)` 在 check_on_start 首次执行后等待，语义正确
- shutdown 时 `cancel()` + `wait_for(timeout=30)` 优雅取消
- `interval=0` 时不创建 task，日志记录禁用
- 异常捕获：每次 cleanup 独立 try/except，单次失败不影响后续循环
- 多 worker 限制：代码注释标注（当前单 worker 启动）

**权衡**：
- 优点：实现简单，与现有 lifespan 模式一致，日志可观测
- 风险：多 worker 重复执行（当前不适用，注释标注即可）
- 工作量：~30 行代码

**选择理由**：唯一合理方案，asyncio.Task 是 FastAPI lifespan 中启动后台周期的标准模式。

---

### 缺口 B：筛选栏重设计

### 方案 B1：Tab 栏扩展 + 用户名 Chip

**设计**：

将现有 owner-tabs（All/Mine）扩展为三元 tab（All/Mine/Archived），用户名筛选用 FilterChip 显示。

```
[ All ] [ Mine ] [ Archived ]     点击 @peek → [ All ] [ Mine ] [ Archived ]  [@peek ×]
```

- All/Mine/Archived 是互斥的 status/owner 组合：
  - All → `{}`（无筛选）
  - Mine → `{owner: 'me'}`
  - Archived → `{status: 'archived'}`
- 点击用户名 → 跳转 `/users/{username}`（复用现有路由），或如果已在 /explore 则显示 `@username` chip + `owner=username`
- Chip 显示时，tab 仍可见但当前无选中（chip 是额外维度）
- Mine tab 激活时显示当前用户名（如 `Mine (peek)`）

**URL 同步**：
- `restoreFromURL()` 解析 `status` 参数
- `updateURL()` 改用 `router.push()`（非 replace），支持浏览器后退
- `searchUrl.logic.ts` 的 `parseRestoreQuery` 增加 `status` 字段
- `mergeQuery` 已通用，无需修改

**交互细节**：
- 点击 Archived tab → `?status=archived`（push）
- 点击 All → 清除 status 参数
- 点击 Mine → `?owner=me`（清除 status）
- 点击 @username chip 的 × → 清除 owner，回到 All
- 从 /users/:username 页面点击 tab → 在 /users/:username 上下文中筛选

**权衡**：
- 优点：改动最小，复用现有 owner-tabs + FilterChip 组件
- 缺点：Mine 和 Archived 语义不完全正交（Mine=owner 维度，Archived=status 维度），tab 互斥模型无法表达"我的已归档"组合
- 工作量：~80 行改动

### 方案 B2：双维度筛选（Tab + Dropdown）

**设计**：

Tab 栏只做 owner 维度（All/Mine/@username），status 维度用独立 dropdown 或 pill 切换。

```
[ All ] [ Mine ]  [@peek ×]          Status: [ Active ▾ / Archived ]
```

- Owner tabs 和 status dropdown 是两个独立维度
- 可组合：Mine + Archived = "我的已归档"
- 后端已支持 `?owner=me&status=archived` 组合查询

**权衡**：
- 优点：语义清晰，维度正交，支持组合查询
- 缺点：UI 复杂度增加（多一个控件），当前需求未要求组合查询
- 工作量：~120 行改动

**选择理由**：选 **B1**。理由：
1. P1 BDD 未要求 Mine+Archived 组合（B-AC1 只定义三元互斥 tab）
2. B1 改动最小，复用现有组件
3. 后端 API 已支持组合，未来如需暴露只需 UI 调整，无需后端改动
4. B5 隐含需求提到"Mine 和 Archived 可组合"，但 P1 结论是 UI 需明确交互模型需明确——B1 的互斥模型更简单，组合查询可后续迭代

---

### 缺口 C：过期警告

### 方案 C1：独立过期警告 Banner（黄色）+ 列表页 Badge

**设计**：

详情页：在 archived banner 位置上方（或替代位置）新增 expired-warning banner。

```
┌─ expired-warning (amber/yellow) ──────────────────────┐
│ ⚠ 此条目已过期，等待清理  [重新设置过期时间]           │
└───────────────────────────────────────────────────────┘
```

- 条件：`status === 'active' && expiresAt && new Date(expiresAt) < new Date()`
- 样式：`background: var(--c-warning-surface); border-bottom: 1px solid var(--c-warning);`
- 与 archived banner（`background: var(--c-error-surface); border-bottom: 1px solid var(--c-error);`）视觉区分明确
- 操作按钮复用 `showExpiresInDialog`

列表页：EntryCard/EntryListRow 对过期未归档 entry 显示 `expired` badge（琥珀色）。

```vue
<BaseBadge v-if="isExpiredButActive" status="expired" />
```

- BaseBadge 新增 `expired` status，样式：`background: var(--c-badge-expired-bg); color: var(--c-warning);`
- 与 archived badge（灰色）视觉区分

**权衡**：
- 优点：banner 与现有 archived banner 模式一致，实现简单
- 缺点：banner 占用垂直空间
- 工作量：~60 行

### 方案 C2：Header 内嵌过期指示器（无独立 Banner）

**设计**：

不新增独立 banner，在 header 的 expires 区域内改变样式：

- 过期未归档时，expires 文本变为琥珀色 + ⚠ 图标 + 脉冲动画
- 点击打开 expires 编辑对话框

列表页：卡片/行边框变为琥珀色虚线。

**权衡**：
- 优点：不占额外垂直空间
- 缺点：视觉冲击弱，用户可能忽略；与 archived badge 区分不够明显；移动端 header 信息已隐藏，更难发现
- 工作量：~50 行

**选择理由**：选 **C1**。理由：
1. P1 C-AC1 明确要求"过期警告 banner"，C2 不满足
2. C-AC2 要求与 archived banner 有"明显视觉差异"，独立 banner + 不同颜色是最清晰的区分方式
3. 过期是重要状态变化，需要强视觉提示，不应弱化
4. 移动端 header 信息被 `desktop-only` 隐藏，C2 的 header 内嵌方案在移动端完全不可见

---

### 缺口 D：头部布局重设计

### 方案 D1：双行 Header（Meta 行 + 操作行）

**设计**：

将 header-right 拆分为两行：

```
桌面端：
┌──────────────────────────────────────────────────────────────┐
│ [P] Title                              @owner · 2d ago · 5 reads │
│ [tags...]                              Expires in 14d [Edit]     │
│                                        [Wrap][Copy][Download]... │
└──────────────────────────────────────────────────────────────┘

移动端 header（<768px）：
┌──────────────────────────────────────┐
│ [P] Title                            │
│ @owner · Expires in 14d             │
└──────────────────────────────────────┘

移动端底部 bar：
┌──────────────────────────────────────┐
│ @owner · expired │ [Files][Wrap][Copy][⋮] │
└──────────────────────────────────────┘
```

**桌面端 header 结构**：
- 第一行：logo + title + meta 信息（owner、时间、阅读量）
- 第二行：tags + expires 状态 + 操作按钮
- owner 可点击（router-link 到 /users/{username}）
- 时间：相对格式 + title 属性显示绝对时间

**移动端底部 bar**：
- 左侧：关键信息（owner + 过期状态）
- 右侧：操作按钮（现有按钮 + OverflowMenu）
- bar 高度从 56px 调整为 48px（信息紧凑排列）

**CSS 变量新增**：
```css
/* variables.css */
--c-warning-surface: rgba(254,188,46,.1);     1);  /* dark */
--c-warning-surface: rgba(154,103,0,.08);   /* light */
--c-error-surface: rgba(255,123,114,.1);    /* dark */
--c-error-surface: rgba(207,34,46,.08);     /* light */
--c-badge-expired-bg: rgba(254,188,46,.15); /* dark */
--c-badge-expired-bg: rgba(154,103,0,.1);   /* light */
```

**权衡**：
- 优点：信息层级清晰（meta → expires → actions），桌面端两行布局可读性好
- 缺点：header 高度增加（从 ~56px 到 ~72px），内容区域减少
- 工作量：~150 行（含 CSS）

### 方案 D2：单行紧凑 Header + 信息分组

**设计**：

保持单行 header，但用视觉分组（分隔符/背景色块）区分信息层级：

```
桌面端：
┌──────────────────────────────────────────────────────────────────────┐
│ [P] Title │ @owner · 2d ago(hover=绝对) │ 5 reads │ Expires 14d │ [actions] │
└──────────────────────────────────────────────────────────────────────┘
```

- 用 `·` 分隔 meta 信息，用 `│` 分隔大组
- owner 可点击，带 accent 色
- 时间 hover 显示绝对时间
- expires 区域：正常=secondary 色，过期=warning 色 + ⚠
- 操作按钮组用微弱背景色块包裹

移动端底部 bar：
```
┌──────────────────────────────────────┐
│ @owner │ ⚠ Expired │ [Files][Wrap][⋮] │
└──────────────────────────────────────┘
```

- 左侧：owner + 状态指示
- 中间：过期/归档状态（如有）
- 右侧：操作按钮

**权衡**：
- 优点：header 高度不变（56px），内容区域最大化
- 缺点：单行信息密度高，长标题+多信息时可能溢出；移动端底部 bar 信息量有限
- 工作量：~100 行

### 方案 D3：折叠式 Header（Meta 默认隐藏，hover/点击展开）

**设计**：

Header 默认只显示 title + 核心操作，meta 信息折叠在 title 下方，hover 或点击展开：

```
默认：
┌──────────────────────────────────────────────────────┐
│ [P] Title                                   [actions]│
│ @owner · 2d ago                                      │
└──────────────────────────────────────────────────────┘

展开（hover title 区域）：
┌──────────────────────────────────────────────────────┐
│ [P] Title                                   [actions]│
│ @owner · 2d ago · 5 reads · Expires in 14d [Edit]   │
│ [tags...]                                             │
└──────────────────────────────────────────────────────┘
```

**权衡**：
- 优点：默认最紧凑，信息按需展示
- 缺点：关键信息（过期状态）默认不可见，违反 C-AC1 的"过期警告需显眼"要求；交互复杂度高；移动端 hover 不可用
- 工作量：~180 行

**选择理由**：选 **D1**。理由：
1. D-AC2 要求"信息按层级排列，各信息项之间有明确视觉分隔（非全部挤在一行）"——D2 单行方案不满足
2. D3 折叠方案隐藏关键信息，与缺口 C 的过期警告需求冲突
3. D1 双行布局是信息层级最清晰的方案，header 高度增加 ~16px 是可接受的代价
4. 移动端底部 bar 增加信息展示是 D-AC3 的硬性要求，D1 的 bar 设计最完整

---

## §2 实现导航

### files_to_read

```yaml
files_to_read:
  - path: backend/peekview/main.py:25-43
    why: lifespan() 函数，缺口 A 改动位置
  - path: backend/peekview/config.py:199-218
    why: PeekCleanup 配置（interval_seconds, check_on_start）
  - path: backend/peekview/services/admin_service.py:115-173
    why: cleanup_expired() 方法，需增加日志
  - path: frontend-v3/src/views/EntryListView.vue:34-49
    why: owner-tabs 现有结构，缺口 B 改动位置
  - path: frontend-v3/src/views/EntryListView.vue:268-326
    why: updateURL/setOwner/clearOwnerFilter，需改 push + 支持 status
  - path: frontend-v3/src/views/EntryListView.vue:439-458
    why: restoreFromURL，需解析 status 参数
  - path: frontend-v3/src/views/searchUrl.logic.ts
    why: mergeQuery/parseRestoreQuery，需增加 status 支持
  - path: frontend-v3/src/views/EntryDetailView.vue:5-133
    why: header 结构，缺口 C/D 改动位置
  - path: frontend-v3/src/views/EntryDetailView.vue:136-139
    why: archived banner，缺口 C 参考模式
  - path: frontend-v3/src/views/EntryDetailView.vue:229-258
    why: mobile-actions，缺口 D 改动位置
  - path: frontend-v3/src/components/EntryCard.vue:74-80
    why: metaText，需统一 @ + 可点击 + 时间 hover
  - path: frontend-v3/src/components/EntryListRow.vue:78-83
    why: metaText，需统一 @ + 可点击 + 时间 hover
  - path: frontend-v3/src/components/BaseBadge.vue
    why: 需新增 expired status
  - path: frontend-v3/src/styles/layout.css:89-121
    why: mobile-actions 布局，缺口 D 改动位置
  - path: frontend-v3/src/styles/variables.css
    why: 需新增 --c-warning-surface, --c-error-surface, --c-badge-expired-bg
  - path: frontend-v3/src/utils/expires.ts
    why: 需新增 isExpired() 辅助函数
  - path: frontend-v3/src/composables/useRelativeTime.ts
    why: 已有 relative + full 返回，时间 hover 方案参考
  - path: frontend-v3/src/stores/entry.ts:53-72
    why: loadEntries 已支持 status 参数传递
  - path: frontend-v3/src/types/index.ts:51-58
    why: ListEntriesParams 已有 status 字段
  - path: frontend-v3/src/router.ts:17-22
    why: /users/:username 路由，用户名跳转参考
```

---

## §3 四字段声明

```yaml
packages:
  - peekview  # 后端 lifespan 改动

domains:
  - backend     # lifespan 后台任务
  - frontend    # 筛选栏/过期警告/header 布局

ui_affected: true

ui_interaction_points:
  - "EntryListView: All/Mine/Archived tab 切换 + URL 同步"
  - "EntryListView: @username 点击跳转"
  - "EntryCard/EntryListRow: @username 可点击 + 时间 hover"
  - "EntryDetailView: 过期警告 banner（黄色）+ 重新设置按钮"
  - "EntryDetailView: header 双行布局（meta 行 + 操作行）"
  - "EntryDetailView: 移动端底部 bar 信息展示"
  - "EntryCard/EntryListRow: expired badge（琥珀色）"
```

```yaml
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_frontend: "cd frontend-v3 && ./node_modules/.bin/vitest run"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_lint: "cd backend && python3 -m ruff check peekview/ tests/"
  P5_e2e: "make debug-test"
```

---

## §4 环境约束

```yaml
env_constraints:
  debug_env: "make debug（:8888 隔离数据 /tmp/peekview-debug/）"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 确认数据在 debug DB"
  backend_test: "cd backend && .venv/bin/python -m pytest tests/ -q"
  frontend_test: "cd frontend-v3 && ./node_modules/.bin/vitest run"
  typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
```

---

## §5 最小验证

```yaml
minimal_validation:
  assumption: "N/A — 缺口 A 是纯代码逻辑（asyncio task），缺口 B/C/D 是 UI 设计依赖现有 Vue 组件模式"
  method: "not_needed"
  result: "not_needed"
  note: "所有方案基于已验证的代码模式：asyncio.Task + lifespan（Python 标准库）、Vue router.push/replace（已有先例）、CSS 变量主题系统（已有先例）"
```

---

## §6 完成标准

1. **缺口 A**：lifespan 启动后台清理 task，interval=0 不启动，check_on_start 立即执行，shutdown 优雅取消，cleanup 日志输出归档/删除/释放量
2. **缺口 B**：All/Mine/Archived 三元 tab，URL push 同步 status 参数，@username 可点击跳转，卡片/列表统一 @ 格式，Archived 空状态提示
3. **缺口 C**：详情页过期警告 banner（黄色，与 archived banner 红色区分），列表页 expired badge（琥珀色），cleanup 后警告消失
4. **缺口 D**：详情页 header 双行布局（meta 行 + 操作行），时间 hover 显示绝对时间，移动端底部 bar 含 owner + 过期状态，CSS 变量补全
