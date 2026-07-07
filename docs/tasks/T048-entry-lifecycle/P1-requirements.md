---
phase: P1
task_id: T048-entry-lifecycle
type: requirements
parent: P0-brief.md
trace_id: T048-P1-20260707
status: draft
created: 2026-07-07
agent: analyst
---

# T048 P1: Entry 生命周期管理 — 需求基线

## 1. 需求复述

将 PeekView 的过期 entry 处理从"直接物理删除"改为两阶段生命周期：

```
active → (expires_at 到期) → archived → (archived N 天后) → 物理删除
```

用户可：
1. 在 active entry 上修改过期时间（续命/设永不过期）
2. 恢复已归档的 entry（重新激活）
3. 配置归档 entry 的保留时长（默认 90 天，0=永不删除）

## 2. 隐含需求识别

### 2.1 数据层

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| D1 | 新增 `archived_at` 字段 | P0 说"过期→status=ARCHIVED, expires_at=NULL"，但计算保留期需要归档时间戳。仅靠 updated_at 不可靠（owner 可能编辑过） |
| D2 | `AdminCleanupResponse` 语义变更 | 当前只有 `deleted_count`/`deleted_slugs`/`freed_mb`。两阶段 cleanup 需区分：第一阶段归档数（archived_count）+ 第二阶段删除数（deleted_count）。API 响应结构必须更新 |
| D3 | cleanup 拆分为两阶段逻辑 | 第一阶段：查 expires_at<=now 且 status=active → 设 status=archived, archived_at=now, expires_at=NULL。第二阶段：查 archived_at<=now-N 且 status=archived → 物理删除 |
| D4 | 已有数据无影响 | 已物理删除的历史 entry 不受影响。当前 status=active 且 expires_at 未到的 entry 也不受影响。无需数据迁移 |
| D5 | FTS5 索引与 archived entry | archived entry 在列表中默认不可见（已排除），但通过 slug 直接访问仍可到达。FTS 搜索也应排除 archived entry，否则搜索结果点击后可能看到已归档内容 |

### 2.2 前端

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| F1 | 前端 `Entry.status` 类型扩展 | 当前 `'active' | 'expired'`，后端实际是 `active | archived | published`。前端 `'expired'` 是根据 `expires_at` 计算的派生状态，不是后端枚举值。归档后 `expires_at=NULL`，`'expired'` 概念需重新定义：应改为 `'active' | 'archived'`，去掉 `'expired'`（过期=archived） |
| F2 | 前端需新增 `updateEntry` API 方法 | 当前 `api/client.ts` 只有 `toggleEntryVisibility`，无通用 PATCH 方法。修改过期时间需要 `PATCH /entries/{slug}` + `expires_in` 参数 |
| F3 | `ExpiresInDialog` 新组件 | P0 明确要求。需支持：输入时长（如 7d/1h/0）、预设选项、对 archived entry 显示"Reactivate"语义 |
| F4 | EntryDetailView 过期展示改造 | 当前只显示 "Expires Xd" 或 "Never expires"。需增加：[Edit] 按钮、archived 状态的 "Expired" banner + Reactivate 按钮 |
| F5 | EntryListView archived entry 展示 | P0 要求 owner 的 Mine tab 中 archived entry 可见（灰色标记）。当前列表查询默认排除 archived，需在 owner 查询时包含 |

### 2.3 多端

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| M1 | MCP 端无需修改 | MCP 的 `createEntry`/`publishFiles` 已有 `expires_in` 参数。MCP 无 update/patch 工具，reactivate 只能通过 Web UI 或 API。这是可接受的——MCP Agent 可通过 `getEntry` 看到 archived 状态，通过 HTTP API PATCH 重新激活 |
| M2 | CLI `cleanup` 命令输出适配 | 当前显示 `deleted_count`，需区分 archived vs deleted |

### 2.4 边界

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| B1 | archived entry 的访问控制 | `get_entry` 当前只检查 `is_public`，不检查 `status`。archived entry 应：owner 可访问、admin 可访问、匿名/非 owner 不可访问（返回 404，与私有 entry 一致防止 slug 枚举） |
| B2 | share_service 对 archived entry 的处理 | 当前 `create_share` 检查 `expires_at<=now` 拒绝。改为归档后 `expires_at=NULL`，应改为检查 `status==archived` 拒绝创建 share |
| B3 | archived entry 传 `expires_in` 自动重新激活 | P0 明确要求。PATCH archived entry + expires_in → status=active, expires_at=now+delta, archived_at=NULL |
| B4 | `expires_in="0"` 表示永不过期 | 已有约定（`parse_expires_in("0")` 返回 None → expires_at=NULL）。PATCH 传 `expires_in="0"` 应清除过期时间 |
| B5 | 并发 cleanup + owner reactivate | 若 cleanup 正在归档某 entry，同时 owner 正在 reactivate，需确保不丢失数据。SQLite WAL + 事务已提供行级锁，无需额外处理 |
| B6 | `archive_retention_days=0` 语义 | P0 说"0=永不删除"。需确保第二阶段 cleanup 跳过 retention=0 的情况 |

### 2.5 兼容

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| C1 | API 响应向后兼容 | `EntryResponse.status` 从只返回 `"active"` 变为可能返回 `"archived"`。前端已硬编码 `'active' | 'expired'`，需同步更新。API 本身是字符串无破坏性变更 |
| C2 | `AdminCleanupResponse` 新增字段 | 新增 `archived_count`/`archived_slugs`，保留 `deleted_count`/`deleted_slugs`/`freed_mb`。旧客户端忽略新字段，向后兼容 |
| C3 | `PeekCleanup` 新增 `archive_retention_days` | 新配置项，默认 90。不影响已有配置（未设置时用默认值） |

## 3. BDD 验收条件

### 3.1 Cleanup 归档（第一阶段）

```
Given 一个 active entry 的 expires_at 已过期（<= now）
When  admin 调用 POST /api/v1/admin/cleanup
Then  该 entry 的 status 变为 "archived"
  And  该 entry 的 archived_at 设为当前时间
  And  该 entry 的 expires_at 变为 NULL
  And  响应的 archived_count 为 1
  And  响应的 deleted_count 为 0
```

### 3.2 Cleanup 物理删除（第二阶段）

```
Given 一个 archived entry 的 archived_at 距今 >= archive_retention_days 天
When  admin 调用 POST /api/v1/admin/cleanup
Then  该 entry 被物理删除（DB 记录 + 磁盘文件）
  And  响应的 deleted_count 为 1
  And  响应的 freed_mb > 0
```

### 3.3 Cleanup 保留期=0 永不删除

```
Given 配置 PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS=0
  And 存在一个 archived entry（archived_at 距今 > 90 天）
When  admin 调用 POST /api/v1/admin/cleanup
Then  该 entry 不被物理删除
  And  响应的 deleted_count 为 0
```

### 3.4 PATCH 修改过期时间（续命）

```
Given 一个 active entry 的 expires_at 为 2026-07-10
When  owner 调用 PATCH /api/v1/entries/{slug} body={expires_in: "30d"}
Then  该 entry 的 expires_at 变为 当前时间 + 30 天
  And  该 entry 的 status 仍为 "active"
```

### 3.5 PATCH 设永不过期

```
Given 一个 active entry 的 expires_at 不为 NULL
When  owner 调用 PATCH /api/v1/entries/{slug} body={expires_in: "0"}
Then  该 entry 的 expires_at 变为 NULL
  And  该 entry 的 status 仍为 "active"
```

### 3.6 PATCH archived entry 重新激活

```
Given 一个 archived entry（status="archived", expires_at=NULL, archived_at 不为 NULL）
When  owner 调用 PATCH /api/v1/entries/{slug} body={expires_in: "7d"}
Then  该 entry 的 status 变为 "active"
  And  该 entry 的 expires_at 变为 当前时间 + 7 天
  And  该 entry 的 archived_at 变为 NULL
```

### 3.7 Archived entry 访问控制

```
Given 一个 archived entry（is_public=true, owner_id=1）
When  匿名用户调用 GET /api/v1/entries/{slug}
Then  返回 404

Given 同一个 archived entry
When  owner（user_id=1）调用 GET /api/v1/entries/{slug}
Then  返回 200 + 完整 entry 数据（status="archived"）
```

### 3.8 列表查询 owner 可见 archived

```
Given owner 有 2 个 active entry 和 1 个 archived entry
When  owner 调用 GET /api/v1/entries?owner=me
Then  返回 3 个 entry（含 archived，archived entry 有视觉区分标记）
```

### 3.9 列表查询默认排除 archived

```
Given 存在 2 个 active entry 和 1 个 archived entry（均为 public）
When  匿名用户调用 GET /api/v1/entries
Then  返回 2 个 entry（不含 archived）
```

### 3.10 Share 不可为 archived entry 创建

```
Given 一个 archived entry
When  owner 调用 POST /api/v1/entries/{slug}/shares
Then  返回 400/422 错误（"Cannot create share for archived entry"）
```

### 3.11 前端 EntryDetailView 过期编辑

```
Given 一个 active entry 的详情页
When  页面加载
Then  显示 "Expires in Xd [Edit]" 链接
  And  点击 [Edit] 弹出 ExpiresInDialog
  And  选择新时长后 entry 过期时间更新
```

### 3.12 前端 Archived entry 详情页

```
Given 一个 archived entry 的详情页（owner 访问）
When  页面加载
Then  显示 "Expired" banner
  And  显示 "Reactivate" 按钮
  And  点击 Reactivate 弹出 ExpiresInDialog
  And  选择时长后 entry 重新激活为 active
```

### 3.13 前端列表 archived 视觉区分

```
Given owner 的 Mine tab 列表含 active 和 archived entry
When  页面加载
Then  archived entry 显示灰色/淡化样式 + "Archived" badge
  And  active entry 样式不变
```

### 3.14 FTS 搜索排除 archived

```
Given 一个 archived entry 的 summary 含关键词 "unique-keyword"
When  用户搜索 "unique-keyword"
Then  搜索结果不含该 archived entry
```

## 4. 待确认清单

无 `[NEED_CONFIRM]` 项。所有隐含需求方向明确，可自走。

[SCOPE_RESOLVED: P2 2.8 确认无新增隐含需求，P1 基线完整]

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

完整 P1-P8，理由：
- **P2 保留**：涉及 schema 变更（archived_at 字段）、cleanup 两阶段逻辑设计、前端新组件交互设计，方案需明确
- **P3 保留**：cleanup 逻辑从物理删除改为归档是核心行为变更，有回归风险
- **P6 保留**：UI 交互需 Playwright 实跑验证；涉及数据 schema 变更
- **P7 保留**：前后端 + 配置 + CLI + share_service 多文件改动
- **P8 保留**：涉及发布

## 6. 范围声明

```yaml
packages:
  - backend/peekview/       # config, models, entry_service, admin_service, share_service, api/entries, api/admin, cli

domains:
  - entry-lifecycle         # 过期→归档→恢复→最终删除完整链路
  - cleanup                 # 定时清理从物理删除改为两阶段
  - entry-update            # PATCH 新增 expires_in 字段
  - frontend-entry-edit     # 过期时间编辑 UI + archived 展示
  - frontend-types          # Entry.status 类型对齐

risk_level: medium-high
# 理由：cleanup 行为变更是破坏性变更（从物理删除→归档），涉及数据安全；
# 但不涉及认证/权限模型变更，且已有 ARCHIVED 枚举值和 status 过滤基础设施

ui_affected:
  - EntryDetailView         # 过期展示 + Edit 按钮 + Expired banner + Reactivate
  - EntryListView           # owner Mine tab 含 archived entry
  - EntryCard/EntryListRow  # archived 视觉区分
  - 新组件 ExpiresInDialog  # 过期时间编辑对话框
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 archived entry UI（灰色标记、Expired banner、Reactivate 按钮、ExpiresInDialog 交互）
    available:
      - vision-analyst（agate 内置执行角色）
      - playwright-cdp skill
      - "@vision-helper subagent"
    status: available

  - need: frontend-typecheck
    why: 前端 Entry.status 类型变更需 vue-tsc 验证
    available:
      - "npx vue-tsc --noEmit"
    status: available
```
