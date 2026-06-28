---
phase: P1
task_id: T025-user-page
type: requirements
parent: P0-brief.md
trace_id: T025-P1-20260628
status: draft
created: 2026-06-28
---

# P1 需求基线 — 用户公开页

## 1. 需求复述

为 PeekView 添加「按用户名查看公开条目」的能力，实现 `/users/:username` 路由，复用 EntryListView 组件加 owner prop 过滤。

**核心行为**：
- 访问 `/users/alice` → 后端 `list_entries(owner='alice')` 返回 alice 的条目列表（权限：anonymous 看 public，已登录看 public+自己的 private，admin 看全部）
- 复用现有 EntryListView，不新建组件
- 显示 banner 提示「@alice 的发布内容」，隐藏 All/Mine tab
- 卡片 `@username` 可点击，跳转到对应用户页；已登录点自己跳 `/explore?owner=me`
- tab URL 同步：`/explore?owner=me` 可分享，tab 切换用 `router.replace`（不污染历史栈）

**关键决策（P0 已确认，P1 直接引用）**：
- 不创建 `/users/me` 路由（避免特殊路由语义污染）
- 不创建 `/mine` 路由（看自己用 `/explore?owner=me`）
- username 大小写不敏感：`owner=ALICE` ↔ `owner=alice` 行为一致
- 后端 `owner=username` 通过 User 表 join 查 `user_id`，在上层叠加权限过滤

## 2. 隐含需求识别

### 2.1 数据层

| # | 隐含需求 | 为什么必须 | 
|---|---------|-----------|
| D1 | `list_entries(owner=username)` 需要解耦「owner 解析」与「权限过滤」两个步骤 | 当前代码中 `owner="me"` 与 `is_admin`/`current_user_id` 分支耦合（lines 325-343）。加 `owner=username` 后若不先解析 username → user_id，再叠加权限过滤，分支会指数增长 |
| D2 | `User.username` UNIQUE 索引是 SQLite BINARY collation（大小写敏感），但 P0 决定大小写不敏感 | `WHERE User.username = 'Alice'` 和 `WHERE User.username = 'alice'` 在 SQLite 默认 BINARY 下是不同的查询。必须在下限时 `.lower()` 统一，避免大小写差异导致查不到 |
| D3 | 大小写不敏感可能导致歧义：「Alice」和「alice」在当前 schema 下是两个合法用户，但 `owner=alice` 和 `owner=Alice` 都只查 `alice`（lowercase 后） | 这是个现有 schema 的固有缺陷，但 P0 已接受大小写不敏感方案，出问题概率极低（正常不会有人注册大小写变体） |
| D4 | 已删除用户的 username 与从未存在的 username 在数据库层面不可区分（User 表记录被物理删除，FK `ondelete=CASCADE` 会删关联 Entry） | P0 要求「删除用户返回 404」而「不存在返回空列表 + 提示」，但实际上两个场景在 DB 层面无法区分。需要统一处理 |
| D5 | 当 username 存在但该用户无公开 entry 时，与 username 不存在时的 UI 表现需要不同 | 前者应显示「No entries from @alice」+ 用户名存在（可区分），后者应显示「User @xxx not found」 |

### 2.2 前端层

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| F1 | **嵌套 router-link（HTML 不允许 `<a>` 包 `<a>`）** | 当前卡片 `<router-link>` 包裹整个 card-body（line 77），在其中给 `@username` 再加 `<router-link>` 会生成非法 HTML。必须用 `@click.stop` + `router.push()` 或重构卡片为按区域可点击 |
| F2 | `owner` prop 与 `currentOwner` 内部状态需要区分优先级 | `/users/:username` 路由传 prop 进来时，`owner` prop 应该覆盖内部 `currentOwner` 状态，且隐藏 All/Mine tab。反之 `/explore` 不传 prop 时，`currentOwner` 内部状态控制 |
| F3 | banner 模式与 tab 模式互斥 | 当 `owner` prop 存在时（用户页），不显示 All/Mine tab。当无 prop 时（explore 页），tab 正常显示。两种状态共享同一个 EntryListView 实例 |
| F4 | `onMounted` 中从 URL query 恢复 owner 的逻辑与 `owner` prop 需要协调 | 当前 mount 时读 `?owner=me` 恢复状态（line 289-293）。当 `owner` prop 存在时，应跳过 URL 恢复（因为 prop 是权威来源） |
| F5 | tab 切换需 `router.replace`（非 push） | P0 已确认。`setOwner()` 需要在改内部状态的同时调 `router.replace({ query: { owner: ... } })`，避免 All/Mine 切换产生大量历史记录 |
| F6 | 已登录用户点自己 username 跳 `/explore?owner=me` | 需要在 `<a>` 或 `@click` 中加入判断：`entry.username === currentUser.username` → 走 `explore?owner=me` 而非 `/users/:username` |
| F7 | 卡片删除/可见性按钮的 `@click.stop` 仍然需要保留 | 当前 card-actions 已经用 `@click.stop` 阻止冒泡（lines 63, 70）。重构用户名区域 clickable 时需要保持 action 按钮的行为不变 |
| F8 | 用户页的 banner 需与现有 header 风格统一 + 移动端响应式 | P0 已知风险之一。banner 需要在 mobile 下也能正常显示「Back to Home」+ 用户名文案 |
| F9 | LoginDialog 需要在用户页（`/users/:username`）也可用 | anonymous 访问用户页时也需要登录入口，现有 LoginDialog 已在 EntryListView 中集成 |

### 2.3 多端

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| M1 | API 路由 `GET /api/v1/entries` 已透传 `owner` 参数，无需改动 | 当前 `entries.py:108-127` 已经把 `owner: str | None` 传给 `list_entries()`，可直接支持 `owner=alice` |
| M2 | MCP Server 的 `list_entries` tool 理论上可通过 API 传递 `owner`，但 T025 不覆盖 | MCP 端改动不在本次范围，避免范围蔓延 |
| M3 | CLI `peekview list` 命令可复用 `owner` 过滤，但不在 T025 范围 | CLI 端改动不在本次范围 |

### 2.4 边界

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| E1 | `/users/:username` 中 username 可能包含特殊字符（如 `/users/alice%20bob`），但实际用户名只允许 `[a-zA-Z0-9_-]+` | Vue Router 会把 URL 编码的字符解码，但只有合法用户名才能在后端查到，恶意输入会被自然过滤 |
| E2 | 用户页的 owner filter 与分页、搜索、标签过滤组合时行为正确 | 当前 `list_entries` 的逻辑是 owner filter 优先于 visibility filter，再叠加 pagination/FTS/tags。加 username 后需确保组合不出错 |
| E3 | 同名 username 在并发注册时不会被绕过 UNIQUE（DB 层保障） | SQLite UNIQUE 约束已防止，不需要额外处理 |

### 2.5 兼容性

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| C1 | 现有 `owner="me"` 行为和 `/explore` 路由零退化 | 属于回归保护，P0 已列出 |
| C2 | EntryListView 接受新 `owner` prop 后，`/explore` 路由（无 prop）的行为不变 | `/explore` 路由的 route record 不传 `props`，EntryListView 的 `owner` prop 为 `undefined`，走现有 tab 逻辑 |

## 3. BDD 验收条件

### 后端 BDD

**BDD-BE-1: 通过 username 过滤 entry**
```
Given 数据库中有用户 alice（id=1）和 bob（id=2）
  And alice 有 3 个公开 entry，bob 有 5 个公开 entry
When  调用 list_entries(owner="alice")
Then  返回 3 个 entry，全部属于 alice
  And total == 3
```

**BDD-BE-2: 大小写不敏感**
```
Given 用户 alice 有 2 个公开 entry
When  调用 list_entries(owner="ALICE")
Then  行为与 owner="alice" 完全一致（返回 2 个 entry）
```

**BDD-BE-3: 不存在的 username 返回空列表**
```
Given 数据库中没有用户 nonexistent
When  调用 list_entries(owner="nonexistent")
Then  返回 items=[], total=0
  And owner_found == false
```

**BDD-BE-4: username 存在但用户无公开 entry**
```
Given 用户 bob 存在，但他只有私有 entry（无公开）
When  匿名用户调用 list_entries(owner="bob")
Then  返回 items=[], total=0
  And owner_found == true（username 本身存在，只是无可见 entry）
```

**BDD-BE-5: owner="me" 行为不变（回归保护）**
```
Given 已登录用户 alice（id=1）有 2 个公开 entry + 1 个私有 entry
When  alice 调用 list_entries(owner="me", current_user_id=1)
Then  返回 3 个 entry（含私有）
  And owner_found 字段为 None（owner="me" 不触发 username 查找）
```

**BDD-BE-6: admin 查看用户页看到全部（含私有）**
```
Given 用户 alice 有 2 个公开 entry + 1 个私有 entry
When  admin 调用 list_entries(owner="alice", is_admin=True)
Then  返回 3 个 entry（含私有）
```

**BDD-BE-7: 匿名用户查看用户页只看到公开**
```
Given 用户 alice 有 2 个公开 entry + 1 个私有 entry
When  匿名调用 list_entries(owner="alice")
Then  返回 2 个 entry（只有公开的）
```

**BDD-BE-8: FTS 搜索与 owner filter 组合（结果非空）** [SCOPE+ from P2]
```
Given 用户 alice 有 3 个公开 entry
When  调用 list_entries(owner="alice", q="keyword")
  And 关键词匹配其中 2 个 entry
Then  返回 2 个 entry
  And owner_found == true
```

**BDD-BE-9: FTS 搜索与 owner filter 组合（结果为空）** [SCOPE+ from P2]
```
Given 用户 alice 有 3 个公开 entry
When  调用 list_entries(owner="alice", q="NoSuchKeyword")
  And 关键词不匹配任何 entry
Then  返回 items=[], total=0
  And owner_found == true（用户存在但 FTS 无命中）
```

### 前端 BDD

**BDD-FE-1: 用户页加载 + banner 显示**
```
Given backend 有用户 alice，有 3 个公开 entry
When  浏览 /users/alice
Then  页面显示 banner "@alice 的发布内容"
  And banner 中包含 "Back to Home" 链接（指向 /explore）
  And 不显示 All/Mine tab
  And 显示 alice 的 3 个 entry 卡片
```

**BDD-FE-2: 不存在的 username 显示空状态**
```
Given backend 无用户 nonexistent
When  浏览 /users/nonexistent
Then  页面显示 "User @nonexistent not found" 提示
  And 不显示 entry 列表
  And 不显示 All/Mine tab
```

**BDD-FE-3: 卡片 username 可点击跳转**
```
Given 浏览 /explore，列表中有一个 entry 属于 alice
When  点击卡片中的 "@alice" 链接
Then  页面跳转到 /users/alice
  And 卡片本身的点击（跳 entry detail）功能仍正常
```

**BDD-FE-4: 已登录用户点自己 username 跳 /explore?owner=me**
```
Given 用户 alice 已登录
  And 浏览 /explore，列表中有自己的 entry
When  点击卡片中的 "@alice" 链接
Then  页面跳转到 /explore?owner=me（不是 /users/alice）
```

**BDD-FE-5: tab 切换 URL 同步（不污染历史栈）**
```
Given 用户已登录，浏览 /explore
When  切换 All 页
Then  URL 变为 /explore（无 query）
When  切换到 Mine tab
Then  URL 变为 /explore?owner=me
When  点浏览器后退
Then  回到 /explore（一次后退就回去，不是多次）
```

**BDD-FE-6: 通过 URL 直接访问 tab 状态**
```
Given 已登录用户
When  直接访问 /explore?owner=me
Then  Mine tab 高亮
  And 显示用户自己的 entry
```

**BDD-FE-7: 通过 URL filter 用户（`?owner=alice`）**
```
Given 用户已登录，访问 /explore?owner=alice
Then  显示 alice 的 entry（按用户筛选，权限逻辑同 list_entries）
  And 不显示 banner（这不是用户专页，是临时筛选）
  And All/Mine tab 都处于非激活状态
  And 页面显示轻量 dismissible chip "@alice ×"（指示当前筛选条件）
When  点击 chip 的 "×"
Then  清除 owner filter，URL 回到 /explore，显示全部 entry
```

> 用户已裁决（PAUSED-resolution.md Q2）：`/explore?owner=alice` 走纯 filter + 轻量 chip，
> 不做 banner。`/users/alice`（用户专页）才显示 banner。

**BDD-FE-8: 构建+类型检查通过**
```
When  运行 npx vue-tsc --noEmit
Then  0 error
When  运行 npm run build
Then  成功
```

**BDD-FE-9: 嵌套 router-link 不存在（HTML 合法性）**
```
Given 浏览任何包含 entry 列表的页面
When  检查 DOM（或 Playwright 序列化 HTML）
Then  不存在 <a> 标签嵌套 <a> 标签的情况
```

## 4. 待确认清单

| # | 问题 | 背景 | 影响 | 裁决 |
|---|------|------|------|------|
| Q1 | ~~P0 要求「删除用户返回 404」与不存在返回「空列表 + 提示」~~ | P0 known_risks 与实现层矛盾 | — | ✅ 已裁决：统一空列表 + `owner_found=false`，前端显示 "User not found"。不见 PAUSED-resolution.md |
| Q2 | ~~`/explore?owner=alice` 的 UI 行为~~ | P0 验收条件不够精确 | — | ✅ 已裁决：纯 filter + 轻量 dismissible chip `@alice ×`，不做 banner。`/users/alice` 才显示 banner。见 PAUSED-resolution.md |
| Q3 | ~~username 大小写歧义~~ | P0 决策大小写不敏感 | — | ✅ 已裁决：注册时 `.lower()` 入库，查询时 `func.lower()` 匹配。不 migration 现有数据。见 PAUSED-resolution.md |

## 5. 裁剪说明

**P0 pruning_tendency: 保守**，理由：涉及后端 User join 查询、嵌套 router-link HTML 禁止、大小写敏感性等 5+ 个隐含点。

**phases: [P1, P2, P3, P4, P5, P6, P7]**

| 阶段 | 状态 | 理由 |
|------|------|------|
| P1 | ✅ 当前 | 需求基线（本文档） |
| P2 | 必做 | 方案需明确：owner prop 流、username→user_id 查询设计、嵌套 router-link 解法、banner 组件设计、`/explore?owner=alice` UI 行为。漏做风险高 |
| P3 | 必做 | 涉及 5-8 个后端测试（7 个 BDD 后端条件）+ 3-5 个前端测试。P0 明确「P3 单元测试必做」 |
| P4 | 必做 | 核心实现阶段 |
| P5 | 必做 | pytest 全绿 + vue-tsc + 环境隔离验证 |
| P6 | 必做 | UI 条件必须 Playwright 实跑（用户页加载、banner、card click、不存在用户、tab URL 同步）。P0 明确「P6 端到端必做」 |
| P7 | 推荐 | 多文件改动（entry_service + router + EntryListView + models），存在「实现与设计偏离」风险 |
| P8 | 跳过 | 功能增量，不独立发布。版本 bump 在发版周期统一处理 |

**跳过 P8 理由**：无独立发布需求，版本 bump + CHANGELOG 在 PeekView 发版周期统一处理。

## 6. 范围声明

```yaml
packages:
  - peekview          # 后端：list_entries 扩展 + EntryListResponse schema 扩展

domains:
  - backend           # entry_service.py + models.py（EntryListResponse 加字段）
  - frontend          # router.ts + EntryListView.vue + 可能的 banner 子组件

ui_affected:
  - EntryListView     # owner prop + banner 模式 + tab URL 同步 + username 可点击
  - Card .username    # 从纯文本变为 clickable link

gate_commands:
  backend_unit: "cd backend && .venv/bin/python -m pytest tests/ -q"
  frontend_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  frontend_build: "cd frontend-v3 && npm run build"
  frontend_unit: "cd frontend-v3 && ./node_modules/.bin/vitest run"
```

### 不在范围

- `/users/me` 路由（P0 明确拒绝）
- `/mine` 路由（P0 明确拒绝）
- 完整用户 Profile 页（头像、bio、粉丝/关注）
- 用户统计（entry 数量、注册时间展示）
- 用户 API key 列表公开化
- username 重命名后的 URL 重定向
- MCP Server `list_entries` 增加 owner 参数
- CLI `peekview list` 增加 owner 参数
- username 存储大小写统一 migration

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: playwright-e2e
    why: P6 验收需要 Playwright 实跑 UI 验证（用户页加载、banner、card click、tab URL 同步）
    available:
      - playwright-vision skill（已注入）
      - make debug-test 命令（AGENTS.md 已声明）
    status: available

  - need: vue-component-testing
    why: P3 前端测试（EntryListView owner prop、banner 显示、username link 行为）
    available:
      - vitest + vue-test-utils（frontend-v3 已有，npm run test）
    status: available

  - need: backend-unit-testing
    why: P3 后端测试（list_entries owner=username 查询、大小写、权限、不存在用户）
    available:
      - pytest + conftest fixtures（backend 已有）
    status: available

  - need: type-check
    why: Vue 3 + TypeScript 类型安全
    available:
      - vue-tsc（CI 强制，AGENTS.md 已声明）
    status: available
```

**无 [CAPABILITY_GAP]**。所有必需能力在环境中已具备。

## 附录 A：entry_service.py list_entries 修改示意（非方案，仅用于说明需求）

```
伪代码逻辑（不改 entry_service.py 原结构）：

def list_entries(self, ..., owner=None):
    owner_found = None  # 额外返回值
    owner_user_id = None

    if owner == "me":
        owner_user_id = current_user_id
        # owner_found 保持 None（不适用）
    elif owner is not None:
        user = session.exec(select(User).where(
            func.lower(User.username) == owner.lower()  # 大小写不敏感
        )).first()
        if user:
            owner_user_id = user.id
            owner_found = True
        else:
            return EntryListResponse(items=[], total=0, page=page, per_page=per_page, owner_found=False)

    # 对查询施加 owner_user_id 过滤
    if owner_user_id is not None:
        query = query.where(Entry.owner_id == owner_user_id)
        count_query = count_query.where(Entry.owner_id == owner_user_id)

    # 然后叠加权限过滤（保留现有逻辑）
    ...
```

## 附录 B：EntryListView prop/tab 三态逻辑

```
EntryListView 状态矩阵：

| owner prop | currentOwner | Tabs 显示 | Banner 显示 | 行为 |
|-----------|-------------|----------|-----------|------|
| undefined | null        | All/Mine | 否        | explore 标准 |
| undefined | "me"        | All/Mine | 否        | explore + Mine |
| "alice"   | —           | 隐藏     | "@alice"  | 用户专页 |
```
