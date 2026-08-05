---
phase: P1
task_id: T080-admin-user-management
trace_id: T080
type: requirements
parent: P0-brief.md
status: draft
agent: analyst
created: 2026-08-05
---

# T080 P1 — 需求基线：Admin 用户管理

## 1. 需求复述

Admin 登录后缺少完整的用户管理能力，本任务补齐三端缺口：

**后端 API**（`backend/peekview/api/admin.py` + `services/admin_service.py`）：
- 新增 disable/enable 端点（toggle `User.is_active`）
- 新增 promote/demote 端点（toggle `User.is_admin`）
- 现有 list_users / delete_user / reset_password 保留，需补充分页 total 元数据供前端展示

**CLI**（`backend/peekview/cli.py` user 命令组）：
- 新增 `peekview user disable <username>` / `peekview user enable <username>` 子命令
- 现有 promote/demote 补齐 LastAdmin 保护（统一绝对拒绝语义，对齐决策 A 移除 confirm_username 旁路后的 delete_self）

**前端**（`frontend-v3/`）：
- 新增 `/admin` 路由 + AdminView 页面（用户列表 + 分页）
- 列表中每用户可执行：禁用/启用、promote/demote、重置密码、删除
- 路由守卫：未登录跳转登录、已登录非 admin 拒绝访问
- 复用现有组件（BaseButton/BaseBadge/ConfirmDialog/Pagination）

**不在范围内**：
- MCP 不暴露 admin 能力（决策已定）
- backup/restore/export 保留 CLI-only（已存在，不纳入）
- 审计字段（disabled_at/disabled_by/disabled_reason）—— 标记为隐含需求，P2 决策是否纳入 Phase 1
- JWT 黑名单/token 版本号机制 —— 现状软失效（每请求查库验 is_active）已足够，Phase 1 不引入

## 2. 隐含需求识别

### 2.1 数据维度
- **schema 变更（已确认）**：`User.is_active` 和 `User.is_admin` 已存在，auth 层已检查 is_active（登录 + JWT 每请求查库 + API key verify）。disable/enable 只需 toggle 字段。[CONFIRMED] 另需新增审计字段 disabled_at/disabled_by/disabled_reason（见 §4-1），需 migration。
- **promote/demote 审计**：是否也记录 role_changed_at/role_changed_by 由 P2 评估，P1 只确认 disable 审计字段必须纳入。
- **审计字段**：当前无 disabled_at/disabled_by/disabled_reason。[CONFIRMED] Phase 1 纳入（见 §4-1），需 schema 变更 + 迁移。

### 2.2 前端维度
- **新增 /admin 路由**：需路由守卫。[CONFIRMED] 未登录跳登录页，已登录非 admin 跳 /explore（见 §4-3）。
- **用户列表展示**：需分页（现有 list_users 支持 page/per_page，但返回 `list[UserResponse]` 无 total 总数）。前端分页组件需要 total 才能渲染页码。隐含需求：后端 list_users 需返回 total 或改返回 `{items, total}` 结构。
- **禁用状态可见**：列表中需显示 disabled 标记（BaseBadge 无 disabled 变体，需扩展或复用 archived）。
- **操作确认**：删除/禁用/重置密码属破坏性操作，DESIGN.md §6 要求 destructive actions 用 ConfirmDialog（alertdialog role）。

### 2.3 多端维度
- **API + CLI + 前端三端同步**：disable/enable 需三端都实现。promote/demote 后端 API 缺端点（CLI 已有但无 LastAdmin 保护）。
- **CLI promote/demote 补 LastAdmin 保护**：现有 CLI promote/demote（cli.py:1579-1620）直接设 is_admin，最后一个 admin 可被 demote 导致系统无 admin。应与 API 端点统一补保护。
- **MCP 不同步**：决策已定，MCP 不暴露 admin 能力。

### 2.4 边界维度
- **自操作保护**：admin 不能禁用/删除/降级自己（防自锁）。现有 delete_user 防自删（`user_id == current_user_id → ValueError`），disable/promote/demote 也应防自操作。三操作（disable/demote/delete）均需防自操作，BDD-06 覆盖自 disable，BDD-20 覆盖自 demote，BDD-21 覆盖自 delete。
- **LastAdmin 保护**：最后一个活跃 admin 不能被降级/删除/禁用。现有 delete_self 有 LastAdminError（api/auth.py:240-249，含 confirm_username 旁路——本次移除见 §4-2 决策 A），新端点需对齐绝对拒绝语义。[CONFIRMED] 现有 delete_user（admin 删别人）**无** LastAdmin 保护——本次补齐 demote/disable/delete 三者统一保护（见 §4-2），修复此安全漏洞。
- **[CONFIRMED] Admin 计数规则（决策 B）**：LastAdmin 保护的"最后一个 admin"判定基于**活跃 admin 数** = `COUNT(User WHERE is_admin=True AND is_active=True)`。禁用的 admin（is_admin=True 但 is_active=False）不计入活跃 admin 数。因此：2 admin（A、B），A 禁用 B 后 B 不算活跃 admin，系统只剩 1 个活跃 admin（A），此时 A 成为最后一个活跃 admin，不能再对 A 执行 demote/disable/delete。此规则隐含在所有 LastAdmin 相关 BDD（BDD-09/10/11/22/23/24）的 Given/When 中。
- **禁用用户的内容**：禁用用户后其已发布的 public entries 应仍可见（禁用只影响登录/认证，不删内容）。private entries 对其他用户已经是 404，对 admin 仍可见。
- **并发**：两个 admin 同时操作同一用户——SQLite WAL 下最后写入胜出，无需额外处理。
- **空密码/弱密码**：reset_password 现有 CLI 校验 ≥8 字符，API 端点 ResetPasswordRequest 已有 min_length=8 校验（models.py:756），对齐 CLI。

### 2.5 兼容维度
- **现有 list_users 返回结构变更**：若从 `list[UserResponse]` 改为 `{items, total}`，需检查 CLI user list 是否依赖原结构（CLI 直接查库，不走 API，不受影响）。前端是新页面，无兼容问题。
- **CLI promote/demote 补保护**：改变现有行为（之前可 demote 最后一个 admin，之后不可）——这是 bug 修复，非破坏性。
- **[破坏性变更] delete_self 移除 confirm_username 旁路**：现有 `delete_self`（api/auth.py:240-249）允许最后一个 admin 通过提供 `confirm_username`（输入自己的用户名）绕过 LastAdminError 删除自己。本次移除此旁路——最后一个活跃 admin 的 delete_self 一律拒绝（绝对拒绝语义，对齐 demote/disable）。依赖此旁路自删的最后一个 admin 用户将受影响：无法再通过 confirm_username 自删，必须先 promote 另一个用户为 admin 或由其他 admin 删除自己。此变更统一了 LastAdmin 保护语义（demote/disable/delete 三者绝对拒绝，无例外路径）。

## 3. BDD 验收条件

### 用户列表

#### BDD-01: admin 在 /admin 页面看到用户列表（分页）
- Given 已登录 admin 用户，系统中有 25 个用户
- When 访问 /admin 页面
- Then 页面显示用户列表，每页 20 个，第一页显示 20 个用户，分页组件显示总页数 2 且可翻到第 2 页

#### BDD-02: 用户列表显示每个用户的状态标记
- Given 系统中存在 active 用户、disabled 用户、admin 用户各一个
- When admin 访问 /admin 页面
- Then 列表中 active 用户显示 active 标记，disabled 用户显示 disabled 标记，admin 用户显示 admin 标记

### 禁用/启用

#### BDD-03: admin 禁用用户后该用户无法登录
- Given admin 和普通用户 alice（密码 testpass123）均存在且 active
- When admin 在 /admin 页面对 alice 点击禁用按钮并确认
- Then alice 的状态变为 disabled；alice 尝试登录返回认证失败；alice 之前发布的 public entries 仍可被匿名访问

#### BDD-04: admin 禁用用户后该用户活跃 JWT 即时失效
- Given alice 已登录持有有效 JWT，admin 执行禁用 alice
- When alice 用该 JWT 发起任何需认证的请求
- Then 该请求返回 401（JWT 软失效，因 get_current_user 查库发现 is_active=False）

#### BDD-05: admin 启用用户后该用户可登录
- Given alice 处于 disabled 状态
- When admin 在 /admin 页面对 alice 点击启用按钮
- Then alice 状态变为 active；alice 用原密码登录成功并获得新 JWT

#### BDD-06: admin 不能禁用自己
- Given admin 已登录
- When admin 在 /admin 页面对自己执行禁用操作
- Then 操作被拒绝，返回错误提示，admin 自身状态仍为 active

### 角色变更（promote/demote）

#### BDD-07: admin promote 普通用户为 admin
- Given 普通用户 bob 存在且 is_admin=False
- When admin 在 /admin 页面对 bob 执行 promote 操作
- Then bob 的 is_admin 变为 True；bob 重新登录后可访问 /admin 页面

#### BDD-08: admin demote 另一个 admin 为普通用户
- Given 两个 admin 用户（admin1、admin2）均存在
- When admin1 对 admin2 执行 demote 操作
- Then admin2 的 is_admin 变为 False；admin2 再访问 /admin 被拒绝

#### BDD-09: 最后一个活跃 admin 不能被降级
- Given 系统中只有一个活跃 admin 用户（is_admin=True AND is_active=True）
- When 该 admin 对自己执行 demote 操作
- Then 操作被拒绝，返回错误提示，该用户仍为 admin

#### BDD-10: 最后一个活跃 admin 不能被禁用
- Given 系统中只有一个活跃 admin 用户（is_admin=True AND is_active=True）
- When 该 admin 对自己执行禁用操作
- Then 操作被拒绝，返回错误提示，该用户仍为 active

#### BDD-11: 最后一个 admin 不能被删除（绝对拒绝，含自删和 admin 删别人）
- Given 系统中只有一个活跃 admin 用户（is_admin=True AND is_active=True）
- When 该 admin 对自己执行删除操作（delete_self 路径），或另一个 admin 对该最后 admin 执行删除操作（admin delete_user 路径）
- Then 操作被拒绝（抛 LastAdminError），返回错误提示，该 admin 用户仍存在；delete_self 路径下即使提供 confirm_username 也被拒绝（移除 confirm_username 旁路，绝对拒绝）

### 重置密码

#### BDD-12: admin 重置用户密码后用户可用新密码登录
- Given 普通用户 carol 存在
- When admin 在 /admin 页面对 carol 执行重置密码，输入新密码 newpass123
- Then carol 用新密码 newpass123 登录成功；carol 用旧密码登录失败

### 删除用户

#### BDD-13: admin 删除用户后该用户及其所有数据消失
- Given 用户 dave 有 2 个 entries（各含文件）和 1 个 API key
- When admin 在 /admin 页面对 dave 执行删除操作并确认
- Then dave 的用户记录、entries、files、API keys 全部删除；dave 无法登录；/admin 列表中不再显示 dave

### 路由守卫

#### BDD-14: 非 admin 用户访问 /admin 被拒绝
- Given 已登录的普通用户（非 admin）
- When 直接访问 /admin 路径
- Then 被重定向或显示拒绝页面，无法看到用户管理内容

#### BDD-15: 未登录用户访问 /admin 被拒绝
- Given 未登录状态
- When 直接访问 /admin 路径
- Then 被重定向到登录页或首页，无法看到用户管理内容

#### BDD-16: 后端 admin 端点对非 admin 返回 403
- Given 已登录的普通用户（非 admin）
- When 调用任意 /api/v1/admin/* 端点
- Then 返回 403 Forbidden

### CLI

#### BDD-17: CLI disable 用户后该用户无法登录
- Given 用户 eve 存在且 active
- When 执行 `peekview user disable eve`
- Then 命令成功输出确认信息；eve 尝试登录失败

#### BDD-18: CLI enable 用户后该用户可登录
- Given 用户 eve 处于 disabled 状态
- When 执行 `peekview user enable eve`
- Then 命令成功输出确认信息；eve 用原密码登录成功

#### BDD-19: CLI demote 补 LastAdmin 保护
- Given 系统中只有一个活跃 admin 用户 admin1（is_admin=True AND is_active=True）
- When 执行 `peekview user demote admin1`
- Then 命令报错拒绝，admin1 仍为 admin

### 自操作保护（补覆盖）

#### BDD-20: admin 不能降级自己（多 admin 场景）
- Given 两个活跃 admin 用户（admin1、admin2），admin1 已登录
- When admin1 在 /admin 页面对自己（admin1）执行 demote 操作
- Then 操作被拒绝（自操作保护），返回错误提示，admin1 仍为 admin

#### BDD-21: admin 不能删除自己
- Given admin 已登录（系统中存在其他活跃 admin，非 LastAdmin 场景）
- When admin 在 /admin 页面对自己执行删除操作（admin delete_user 路径）
- Then 操作被拒绝（自操作保护），返回错误提示，该 admin 用户仍存在

### LastAdmin 保护边界（admin 计数 = is_admin AND is_active）

#### BDD-22: 2 admin 场景下禁用其中一个成功
- Given 两个活跃 admin 用户（adminA、adminB），均 is_admin=True AND is_active=True
- When adminA 对 adminB 执行禁用操作
- Then 操作成功，adminB 的 is_active 变为 False；adminB 仍 is_admin=True 但不计入活跃 admin 数；adminA 仍为活跃 admin

#### BDD-23: 禁用后剩余唯一活跃 admin 不能再被禁用/降级/删除
- Given 承接 BDD-22 后状态：adminA 是唯一活跃 admin（adminB 已禁用，is_active=False），活跃 admin 数=1
- When adminA 对自己执行禁用操作（或 demote 操作，或删除操作）
- Then 操作被拒绝（LastAdmin 保护），返回错误提示，adminA 仍为活跃 admin

### CLI LastAdmin 保护（补 disable）

#### BDD-24: CLI disable 最后一个活跃 admin 被拒绝
- Given 系统中只有一个活跃 admin 用户 admin1（is_admin=True AND is_active=True）
- When 执行 `peekview user disable admin1`
- Then 命令报错拒绝（LastAdmin 保护），admin1 仍为 active

## 4. 待确认清单

[NO_NEED_CONFIRM] 所有待确认项已由主 Agent + 用户确认（2026-08-05），决策如下：

1. **审计字段是否纳入 Phase 1**：[CONFIRMED] **Phase 1 纳入**。disable/enable/promote/demote 需记录审计字段。
   - 决策：新增 `disabled_at` / `disabled_by`（admin user_id）/ `disabled_reason`（可选文本）字段到 User 模型，enable 时清空。
   - 影响：需 schema 变更 + 迁移（database.py migrations）；admin_service 各 toggle 方法需记录审计；前端列表可展示禁用时间/操作者。
   - promote/demote 审计：考虑是否也记录 `role_changed_at`/`role_changed_by`——P2 设计决策，P1 只声明 disable 审计字段必须纳入，promote/demote 审计由 P2 评估。

2. **LastAdmin 保护范围**：[CONFIRMED] **补齐三者**。demote/disable/delete 统一保护最后一个 admin。
   - 决策：demote/disable/delete 三个操作前检查"目标是否为最后一个活跃 admin（is_admin=True AND is_active=True）"，是则拒绝（抛 LastAdminError）。
   - 现有 delete_user（admin 删别人）无保护——本次补齐修复此安全漏洞。
   - CLI 现有 promote/demote 也补 LastAdmin 保护。
   - **[CONFIRMED] 决策 A（破坏性变更）**：移除 `delete_self`（api/auth.py:240-249）的 `confirm_username` 旁路。现有逻辑：最后一个 admin 输入正确 `confirm_username` 可绕过 LastAdminError 删除自己。本次改为绝对拒绝——最后一个活跃 admin 的 delete_self 无论是否提供 confirm_username 一律拒绝。统一 demote/disable/delete 三者绝对拒绝语义。这是破坏性变更：现有依赖此旁路自删的最后一个 admin 用户将无法再通过 confirm_username 自删（见 §2.5 兼容声明）。

3. **Admin 计数规则**：[CONFIRMED] **决策 B**：LastAdmin 保护的 admin 计数 = `is_admin=True AND is_active=True`。禁用的 admin（is_active=False, is_admin=True）不计入活跃 admin 数。所有 LastAdmin 相关 BDD（BDD-09/10/11 及新增 BDD-22/23/24）的 Given/When 隐含此规则。详见 §2.4 定义。

4. **非 admin 访问 /admin 跳转目标**：[CONFIRMED] **跳 /explore**。不暴露 /admin 路由存在，静默拒绝，符合防枚举原则。

5. **list_users 返回结构变更**：[CONFIRMED] **改为 `{items, total, page, per_page}`**。与 entries 列表结构一致，前端分页组件直接消费。CLI 不走 API 不受影响。

6. **reset_password API 密码强度校验**：[CONFIRMED] **强制 ≥8 字符**。对齐 CLI 现有校验，API 端点 ResetPasswordRequest 已有 min_length=8 校验（models.py:756），确认对齐 CLI。

7. **前端 admin 操作入口**：[CONFIRMED] **OverflowMenu**。对齐 DESIGN.md §6 desktop dropdown / mobile bottom sheet，每行一个菜单含禁用/启用/promote/demote/重置密码/删除。

## 5. 裁剪说明

```yaml
phases: [P0, P1, P2, P3, TDD, P4, P5, P6, P7, P8]
```

**本任务不裁剪（P0-P8 全走）**。理由：
- 跨后端 API + CLI + 前端三端改动，属多子系统交互
- 涉及权限模型（is_active/is_admin toggle + LastAdmin 保护 + 自操作保护）
- 涉及级联删除（delete_user 删 entries/files/apikeys）
- 前端新增路由 + 页面 + 守卫，需 Playwright 实跑验收
- 按 agate 规则：≥2 个子系统交互 / 涉及安全 / 跨层影响 → 必须走完整 agate

每个阶段均不可裁剪：
- P1 需求基线：不可裁（核心阶段）
- P2 方案设计：不可裁（多端改动需设计评审）
- P3 TDD：保留（权限保护逻辑需红灯覆盖：LastAdmin / 自操作 / 禁用后 JWT 失效）
- P5 技术验证：保留（pytest 全绿 + 隔离验证）
- P6 验收：不可裁（BDD 逐条实跑 + Playwright 截图）
- P7 一致性检查：保留（三端 + 多文件改动）

## 6. 范围声明

```yaml
domains:
  - backend      # API 端点 + service 层 + auth 链
  - frontend     # /admin 路由 + AdminView + API client + 路由守卫
  - cli          # user disable/enable 子命令 + promote/demote 补保护
  - security     # 权限模型（LastAdmin / 自操作保护 / 禁用软失效 / 403 守卫）

packages:
  - backend/peekview/api/admin.py
  - backend/peekview/services/admin_service.py
  - backend/peekview/models.py          # User 新增 disabled_at/disabled_by/disabled_reason 审计字段 + list_users 返回结构
  - backend/peekview/database.py         # 审计字段 migration
  - backend/peekview/cli.py             # user 命令组（disable/enable + promote/demote 补保护）
  - backend/peekview/exceptions.py      # 可能复用 LastAdminError
  - frontend-v3/src/router.ts           # /admin 路由 + 守卫
  - frontend-v3/src/views/AdminView.vue # 新增
  - frontend-v3/src/api/client.ts       # admin API 方法
  - frontend-v3/src/types/index.ts      # 可能扩展 admin 响应类型
  - frontend-v3/src/stores/auth.ts      # 路由守卫消费 isAdmin（已存在）

risk_level: medium-high
# 理由：
# + 涉及权限模型（is_active/is_admin toggle + LastAdmin 保护）
# + 级联删除（delete_user）
# + 跨三端改动（多子系统交互）
# + 前端新增路由守卫（安全边界）
# - is_active 字段已存在且 auth 层已检查，降低 schema 风险
# - 现有 require_admin 守卫已成熟，新增端点复用
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证 /admin 页面交互（列表渲染、禁用/启用按钮、确认弹窗、分页、路由守卫跳转）
    available:
      - "playwright-cdp skill（已注入，CDP :18800）"
      - "vision-engine skill（截图分析）"
    status: available

  - need: debug-backend
    why: P5/P6 需要在隔离环境（:8888）验证 API 端点行为（禁用后 JWT 失效、LastAdmin 保护、级联删除）
    available:
      - "make debug（127.0.0.1:8888，独立数据目录 /tmp/peekview-debug/）"
    status: available

  - need: cli-testing
    why: P6 验收 CLI disable/enable/promote/demote 子命令
    available:
      - "make debug-start + peekview CLI（debug 配置自动隔离到 /tmp/peekview-debug/）"
    status: available
```

**无 `[CAPABILITY_GAP]`**。所有所需能力在当前环境可用。

`requires_minimal_validation: false`（本任务不依赖浏览器安全模型/外部系统行为的特殊验证，标准 Playwright + API 测试即可覆盖）。
