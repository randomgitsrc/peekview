---
phase: P1
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: requirements
agent: analyst
parent: P0-brief.md
trace_id: T051-P1-20260709
status: draft
created: 2026-07-09
---

# T051 P1 需求基线

## 需求复述

T048（两阶段生命周期）发布后遗留 4 个缺口，均为已有功能的遗漏而非新需求：

- **A**：配置项 `cleanup.interval_seconds`/`check_on_start` 存在但 lifespan() 未启动后台定时清理任务
- **B**：后端 list_entries 已支持 owner/status 筛选，前端无入口；用户名显示不统一且不可点击
- **C**：entry 已过期但 cleanup 未执行时（status=active + expires_at < now），前端无视觉警告
- **D**：详情页/列表页头部信息布局不合理——时间格式单一、信息层级混乱、移动端底部 bar 缺信息展示

## 隐含需求识别

### 缺口 A：后台定时清理

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| A1 | `cleanup_expired()` 是同步方法（`admin_service.py:115`），在 async lifespan 中需 `asyncio.get_event_loop().run_in_executor()` 或等效方式调用，否则阻塞事件循环 | 直接 await 同步函数会阻塞 FastAPI 请求处理 |
| A2 | 后台任务需在 shutdown 时优雅取消（`asyncio.Task.cancel()`），cleanup 执行期间若服务关闭需等待当前轮次完成或超时中断 | 未取消的 task 会在 shutdown 后报 RuntimeError；cleanup 中途打断可能留下半归档数据 |
| A3 | `interval_seconds=0` 表示禁用，需在 lifespan 中检查此值决定是否启动任务 | config 文档已声明 0=disabled，不检查则 0 间隔会无限循环 |
| A4 | `check_on_start=True` 时应在启动时立即执行一次 cleanup，再进入定时循环 | config 语义明确：启动时检查，不等第一个 interval |
| A5 | cleanup 执行耗时可能较长（大量 expired entries），需记录日志（开始/结束/归档数/删除数） | 运维可观测性；无日志则无法判断后台任务是否正常运行 |
| A6 | 多 worker 场景（uvicorn --workers > 1）下每个 worker 都会启动 cleanup task，可能重复执行 | 当前项目用 `make debug` 单 worker 启动，但需在代码注释中标注此限制 |

### 缺口 B：筛选栏

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| B1 | status=archived 筛选需同步到 URL query 参数（如 `?status=archived`），支持浏览器前进后退和链接分享 | 当前 `restoreFromURL()`（`EntryListView.vue:439`）只处理 owner 参数，不处理 status |
| B2 | `updateURL()` 当前用 `router.replace()`，筛选切换应改用 `router.push()` 以支持浏览器后退回到前一个筛选状态 | replace 不产生 history entry，用户按后退键无法回到前一个筛选 |
| B3 | 匿名 entry（`owner_id=null`，`username=null`）在列表中无用户名显示，点击用户名跳转逻辑需跳过 null username | `entry_service.py:497` 返回 `username=None`，前端 `EntryCard.vue:76` 已用 `if (props.entry.username)` 保护，但筛选栏的"点击用户名跳转"需同样处理 |
| B4 | Archived tab 对非 owner 只显示自己的已归档条目（后端权限模型），空状态需提示"无已归档条目"而非空白 | 后端 `list_entries` 对非 admin 用户只返回自己的私有条目，archived 筛选可能返回空列表 |
| B5 | All/Mine/Archived 三元切换中，Mine 和 Archived 可组合（"我的已归档"），需明确交互模型 | 后端支持 `?owner=me&status=archived` 组合查询，前端需决定是否暴露此组合 |
| B6 | 用户名 tab（`@username`）激活时，切换到 All/Mine/Archived 应清除用户名筛选 | 语义上用户名筛选和 status 筛选是正交维度，但 UI 需明确切换行为 |

### 缺口 C：过期警告

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| C1 | 过期警告 banner 需与 archived banner（`EntryDetailView.vue:136-139`，灰色）视觉区分——建议浅黄色/琥珀色 | 两者语义不同：archived=已归档（不可逆），expired-but-active=过期未清理（临时状态），用户需一眼区分 |
| C2 | 过期警告只在 status=active 且 expires_at < now 时显示，cleanup 执行后 entry 变为 archived，警告自动消失 | 这是过渡态，cleanup 执行后自然消除，无需手动关闭 |
| C3 | 列表页（EntryCard/EntryListRow）也需对过期未归档 entry 有视觉提示（如 badge 或样式变化） | 用户在列表页就应识别过期条目，不必进入详情页才发现 |
| C4 | 过期警告 banner 上的操作按钮应与 archived banner 的"Reactivate"一致（打开 expires 编辑对话框） | 已有 `showExpiresInDialog` 机制，复用即可 |

### 缺口 D：头部布局

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| D1 | 时间格式需支持混合模式：相对时间为主显示，hover/title 显示绝对时间（ISO 或本地格式） | 当前 `relativeTime`（`EntryDetailView.vue:50-52`）只有相对格式，用户反馈不够直观 |
| D2 | 移动端底部 bar（`mobile-actions`，`layout.css:89-99`）当前只有操作按钮，需增加关键信息展示（owner、过期状态） | 移动端 header 信息被隐藏（`desktop-only` class），底部 bar 是唯一信息入口 |
| D3 | 详情页 header 信息层级需重新规划：owner > 时间 > read-stats > expires > 操作按钮，当前全部平铺在一行 | `EntryDetailView.vue:46-58` 所有 meta 信息在同一行，可读性差 |
| D4 | 列表页卡片/行的 meta 信息也需统一时间格式和用户名格式 | `EntryCard.vue:74-80` 和 `EntryListRow.vue:78-83` 的 metaText 格式需与详情页一致 |

### 跨缺口隐含需求

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| X1 | 所有前端改动需保持暗色/亮色主题兼容 | 项目使用 CSS 变量主题系统，新增样式必须用 `var(--c-*)` |
| X2 | 无需 MCP/CLI 同步——4 个缺口均为后端内部行为（A）或纯前端展示（B/C/D），不涉及 API schema 变更 | MCP tools 已有 expires 参数，CLI 已有 cleanup 命令，无需新增 |

## BDD 验收条件

### 缺口 A：后台定时清理

**A-AC1：lifespan 启动后台清理任务**
```
Given PeekConfig.cleanup.interval_seconds > 0
When  应用启动（lifespan startup）
Then  后台 asyncio.Task 被创建，按 interval_seconds 间隔周期性调用 cleanup_expired()
And   首次执行时机取决于 check_on_start（True=立即执行一次，False=等第一个 interval）
```

**A-AC2：interval_seconds=0 禁用后台清理**
```
Given PeekConfig.cleanup.interval_seconds = 0
When  应用启动
Then  不创建后台清理任务
And   日志记录"Cleanup background task disabled (interval=0)"
```

**A-AC3：shutdown 优雅取消后台任务**
```
Given 后台清理任务正在运行
When  应用关闭（lifespan shutdown）
Then  后台任务被 cancel()
And   若 cleanup_expired() 正在执行，等待其完成（最多 30s 超时）
And   日志记录"Cleanup background task cancelled"
```

**A-AC4：cleanup 执行日志**
```
Given 后台清理任务执行一次 cleanup_expired()
When  cleanup 完成
Then  日志记录归档数量和删除数量（如"Cleanup: archived=3, deleted=1, freed=0.5MB"）
```

### 缺口 B：筛选栏

**B-AC1：三元筛选 tab**
```
Given 已登录用户访问 /explore
When  页面加载
Then  显示 All / Mine / Archived 三个 tab
And   默认选中 All
And   点击 Mine → 调用 loadEntries({owner:'me'})
And   点击 Archived → 调用 loadEntries({status:'archived'})
```

**B-AC2：URL 状态同步**
```
Given 用户在 /explore 页面
When  点击 Archived tab
Then  URL 更新为 /explore?status=archived（push，非 replace）
And   浏览器后退 → 回到 All 状态
And   刷新页面 → 仍显示 Archived 筛选结果
```

**B-AC3：用户名可点击跳转**
```
Given 列表页显示 entry 卡片/行，entry.username 不为 null
When  点击 @username
Then  跳转到 /users/{username}（显示该用户的条目列表）
And   筛选栏显示 @username chip
```

**B-AC4：用户名格式统一**
```
Given 列表页显示 entry
When  entry 有 username
Then  卡片模式和列表模式均显示 @username 格式（当前卡片有@，列表行无@）
And   两处均可点击跳转
```

**B-AC5：匿名 entry 无用户名显示**
```
Given 列表页显示匿名 entry（username=null）
When  渲染卡片/行
Then  不显示用户名部分，不渲染可点击的用户名链接
```

**B-AC6：Archived 空状态提示**
```
Given 用户点击 Archived tab
When  后端返回空列表（无已归档条目）
Then  显示空状态提示"暂无已归档条目"（而非空白页面）
```

### 缺口 C：过期警告

**C-AC1：详情页过期警告 banner**
```
Given entry.status='active' 且 entry.expires_at < now()
When  用户访问该 entry 详情页
Then  在 header 下方显示浅黄色/琥珀色过期警告 banner
And   banner 文案提示"此条目已过期，等待清理"
And   owner 可点击"重新设置过期时间"按钮打开 expires 编辑对话框
```

**C-AC2：过期警告与 archived banner 视觉区分**
```
Given 两个 entry：一个 status=archived，一个 status=active+expired
When  分别访问详情页
Then  archived entry 显示灰色 banner（"This entry has expired"）
And   expired-but-active entry 显示浅黄色/琥珀色 banner
And   两者的背景色和图标有明显视觉差异
```

**C-AC3：列表页过期视觉提示**
```
Given 列表页包含 status=active 且 expires_at < now() 的 entry
When  渲染卡片/行
Then  该 entry 有视觉提示（如 expired badge 或边框高亮）
And   与 archived entry 的视觉提示不同
```

**C-AC4：cleanup 后警告消失**
```
Given entry 显示过期警告 banner
When  后台 cleanup 执行，entry.status 变为 'archived'
Then  刷新页面后显示 archived banner（灰色），过期警告 banner 不再显示
```

### 缺口 D：头部布局

**D-AC1：详情页时间格式混合显示**
```
Given 详情页显示 entry 的创建时间
When  桌面端渲染
Then  主显示为相对时间（如"2d ago"）
And   hover/title 属性显示绝对时间（如"2026-07-07 14:30 UTC"）
```

**D-AC2：详情页 header 信息层级**
```
Given 详情页 header 渲染
When  桌面端显示
Then  信息按层级排列：owner → 创建时间 → 阅读量 → 过期状态 → 操作按钮
And   各信息项之间有明确视觉分隔（非全部挤在一行）
```

**D-AC3：移动端底部 bar 信息展示**
```
Given 移动端（<1024px）访问详情页
When  底部 bar 渲染
Then  bar 包含关键信息（至少 owner 和过期状态）
And   操作按钮仍可访问
And   信息与按钮不互相遮挡
```

**D-AC4：列表页时间格式统一**
```
Given 列表页显示 entry 卡片/行
When  渲染创建时间
Then  主显示为相对时间，hover/title 显示绝对时间
And   卡片和列表行格式一致
```

## domains

- `backend`：lifespan 后台任务管理、cleanup 调度
- `frontend`：筛选栏重设计、过期警告 banner、header 布局重设计、移动端 bar、时间格式、用户名统一

## packages

- `backend/peekview/main.py` — lifespan 后台清理任务
- `backend/peekview/services/admin_service.py` — cleanup_expired 日志增强
- `frontend-v3/src/views/EntryListView.vue` — 筛选栏 All/Mine/Archived + URL 同步
- `frontend-v3/src/views/EntryDetailView.vue` — header 布局 + 过期警告 + 时间格式
- `frontend-v3/src/stores/entry.ts` — loadEntries 支持 status 参数传递
- `frontend-v3/src/components/EntryCard.vue` — 用户名点击 + 统一 @ + 过期视觉提示 + 时间格式
- `frontend-v3/src/components/EntryListRow.vue` — 同上
- `frontend-v3/src/styles/layout.css` — header/mobile 布局样式
- `frontend-v3/src/utils/expires.ts` — 可能需新增过期状态判断辅助函数

## risk_level

risk_level: medium

理由：跨越后端（lifespan async task 生命周期管理）+ 前端（3 个 view + 2 个 component + store），改动端多但无 schema 变更、无安全改动、无数据迁移。主要风险在 UI 重设计的一致性和后台 task 的生命周期管理。

## phases

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

完整阶段，不裁剪。理由：
- P2 不可裁剪：3 个 UI 重设计（筛选栏/header/移动端 bar）需多方案比较
- P3 保留：后台 task 生命周期管理需测试覆盖（cancel/timeout/interval=0）
- P6 不可裁剪：涉及 ≥2 个改动端（backend + frontend），需整体验收
- P7 保留：跨 8+ 文件改动，需一致性检查
- P8 保留：涉及发布

## capability_requirements

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证筛选栏交互、过期警告 banner、header 布局、移动端适配
    available:
      - "playwright-cdp skill（CDP 连接 Windows Chrome）"
      - "vision-analyzer skill（图片分析）"
    status: available

  - need: async-task-testing
    why: 缺口 A 需验证 asyncio.Task 在 lifespan 中的创建/取消/超时行为
    available:
      - "pytest + pytest-asyncio（后端测试框架已有）"
    status: available

  - need: responsive-design-verification
    why: 缺口 D 需验证桌面端和移动端（<1024px）布局
    available:
      - "playwright-cdp skill（CDP Emulation.setDeviceMetricsOverride）"
    status: available
```
