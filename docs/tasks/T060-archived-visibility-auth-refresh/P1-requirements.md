---
phase: P1
task_id: T060-archived-visibility-auth-refresh
type: requirements
parent: P0-brief.md
trace_id: T060-P1-20260721
status: draft
created: 2026-07-21
agent: analyst
---

# P1 Requirements: Archived 条目可见性策略 + 登录退出内容刷新

## 1. 需求复述

修正 4 个相互关联的问题：

- **A. Archived 条目混入 All/Mine**：后端 `list_entries` 无 status 参数时，认证非 admin 用户看到 own archived 条目混在活跃条目中。期望：All/Mine 默认只显示 active 条目，archived 仅在 Archived tab 可见。
- **B. 登录后列表不刷新**：`EntryListView` 的 `authState` watcher 仅处理 `?owner=me` URL 特例，登录后列表仍显示匿名视图。
- **C. 退出后列表不重新请求**：`handleLogout()` 仅做客户端 `filterPrivateEntries()`，不重新请求 API，可能残留陈旧数据。
- **D. Auth 过期后无刷新**：401 interceptor 触发 `peekview:auth-expired` → auth store 设 `user=null`，但无列表重载，用户看到已失效的私有条目。

## 2. 隐含需求识别

### 2.1 后端默认查询行为变更 = API Breaking Change

**为什么必须**：当前 `GET /api/v1/entries`（无 status 参数）对认证用户返回 own archived 条目。改为排除后，依赖此行为的 API 消费者（MCP、CLI、第三方脚本）结果集会缩小。

- **MCP `list_entries`**：不传 status 参数，当前会返回 own archived 条目。默认行为变更后，MCP 自动只返回 active 条目。MCP 工具 schema 无 status 参数，Agent 无法主动查 archived。
- **CLI `peekview list`**：有 `--status` 选项，用户可显式指定。CLI 调用同一 API，默认行为自动跟随。
- **第三方 API 消费者**：无法预知，但 `status` 参数已存在，属于可过滤字段，默认排除 archived 是合理语义。

**结论**：这是有意的行为修正（bug fix 语义），不是 breaking change。但 MCP 需要增加 status 参数以保持查 archived 的能力。

### 2.2 Admin 默认查询也应排除 archived

**为什么必须**：当前 admin 无 status 参数时看到全部条目（含 archived），与 All tab 的用户心智模型一致——All = 活跃条目，Archived = 归档条目。Admin 在 All tab 看到归档条目同样违反心智模型。

### 2.3 退出后列表必须与匿名权限一致

**为什么必须**：`filterPrivateEntries()` 过滤 `e.isPublic === false`，但 public archived 条目不会被移除。如果退出时当前在 Archived tab（status=archived），客户端过滤后仍显示 public archived 条目，但匿名用户不应看到任何 archived 条目。退出后列表内容必须与匿名用户的权限完全一致。

### 2.4 登录后应刷新当前 tab 的列表

**为什么必须**：登录后权限从 anonymous → authenticated，可见条目集扩大（新增 own private + own archived in Archived tab）。当前 watcher 仅处理 `?owner=me` 特例，其他场景（如 All tab 登录）列表不变。需要在 authState 变为 authenticated 时重新加载当前 tab。

### 2.5 Auth 过期后应刷新当前 tab 的列表

**为什么必须**：auth 过期后权限从 authenticated → anonymous，可见条目集缩小。当前仅设 `user=null`，列表不刷新，用户仍看到私有条目。需要在 authState 变为 anonymous 时重新加载当前 tab（或至少调 filterPrivateEntries + 移除 archived）。

### 2.6 MCP list_entries 需增加 status 参数

**为什么必须**：后端默认行为变更后，MCP Agent 无法查看 archived 条目（当前 schema 无 status 参数）。需增加可选 status 参数，与 API/CLI 对齐。

**MCP status 参数契约**：参数为可选字符串，不传时默认只返回 active 条目（与 API 默认行为一致）。可选值须至少包含 `active` 和 `archived`，具体可选值列表和校验规则由 P2 设计。非法值行为须明确（返回错误或忽略），由 P2 决定。

### 2.7 前端 Archived tab 对匿名用户应隐藏或显示空

**为什么必须**：后端 `status=archived` 对匿名用户返回空列表，前端 Archived tab 对匿名用户仍可见但内容为空。当前行为已如此（后端返回空），无需额外修改，但需确认前端不因空列表报错。

**Archived tab 匿名用户可见性**：Archived tab 对匿名用户保持可见但内容为空。这是当前行为，与 All/Mine tab 对匿名用户可见但无内容的匿名用户处理方式一致。无需隐藏 tab 或添加空状态提示——空列表本身已传达"无归档条目"语义。

### 2.8 数据迁移：无

已有 archived 条目无需迁移——变更仅影响查询默认行为，不改变数据。

## 3. BDD 验收条件

### BDD-A1: All tab 默认排除 archived 条目（认证用户）

```
Given 认证用户拥有 2 个 active 条目和 1 个 archived 条目
When 用户访问 All tab（无 status 参数）
Then 返回的列表仅包含 2 个 active 条目
And archived 条目不出现在列表中
```

### BDD-A1b: 全 archived 用户 All tab 返回空列表

```
Given 认证用户仅拥有 1 个 archived 条目（无 active 条目）
When 用户访问 All tab（无 status 参数）
Then 返回的列表为空
```

### BDD-A2: Mine tab 默认排除 archived 条目

```
Given 认证用户拥有 2 个 active 条目和 1 个 archived 条目
When 用户访问 Mine tab（owner=me, 无 status 参数）
Then 返回的列表仅包含 2 个 active 条目
```

### BDD-A2b: 全 archived 用户 Mine tab 返回空列表

```
Given 认证用户仅拥有 1 个 archived 条目（无 active 条目）
When 用户访问 Mine tab（owner=me, 无 status 参数）
Then 返回的列表为空
```

### BDD-A3: Archived tab 显示 own archived 条目

```
Given 认证用户拥有 1 个 archived 条目
When 用户访问 Archived tab（status=archived）
Then 返回的列表包含该 archived 条目
```

### BDD-A3b: 无 archived 条目时 Archived tab 返回空列表

```
Given 认证用户仅拥有 active 条目（无 archived 条目）
When 用户访问 Archived tab（status=archived）
Then 返回的列表为空
```

### BDD-A4: Admin All tab 默认排除 archived 条目

```
Given admin 用户，系统中有 3 个 active 条目和 2 个 archived 条目（属于不同用户）
When admin 访问 All tab（无 status 参数）
Then 返回的列表仅包含 3 个 active 条目
```

### BDD-A5: Admin Archived tab 可见全部 archived 条目

```
Given admin 用户，系统中有 2 个 archived 条目（属于不同用户）
When admin 访问 Archived tab（status=archived）
Then 返回的列表包含全部 2 个 archived 条目
```

### BDD-A6: 匿名用户不可见任何 archived 条目

```
Given 系统中有 1 个 public archived 条目和 1 个 private archived 条目
When 匿名用户访问 All tab
Then 返回的列表不包含任何 archived 条目
And 匿名用户访问 Archived tab 返回空列表
```

### BDD-A7: 非 owner 认证用户不可见他人 archived 条目

```
Given 用户 A 拥有 1 个 archived 条目，用户 B 已认证
When 用户 B 访问 All tab
Then 用户 B 的列表不包含用户 A 的 archived 条目
```

### BDD-B1: 登录后 All tab 列表刷新

```
Given 匿名用户在 All tab 查看列表（仅含 public active 条目）
When 用户登录成功
Then 列表自动刷新，包含 public active 条目 + own private active 条目
And 不包含 own archived 条目
```

### BDD-B2: 登录后 Mine tab 自动切换（URL 含 ?owner=me）

```
Given 匿名用户访问 URL ?owner=me
When 用户登录成功
Then 自动切换到 Mine tab 并加载 own active 条目
```

### BDD-C1: 退出后列表刷新为匿名视图

```
Given 认证用户在 All tab 查看列表（含 own private 条目）
When 用户退出
Then 列表内容与匿名用户在 All tab 看到的内容一致
And 不包含任何 private 条目
And 不包含任何 archived 条目
```

### BDD-C2: 退出后 Archived tab 刷新为空

```
Given 认证用户在 Archived tab 查看 own archived 条目
When 用户退出
Then 列表内容与匿名用户在 Archived tab 看到的内容一致（空列表）
```

### BDD-D1: Auth 过期后列表刷新为匿名视图

```
Given 认证用户在 All tab 查看列表（含 own private 条目）
When 用户认证过期
Then 列表内容与匿名用户在 All tab 看到的内容一致
And 不包含任何 private 条目
```

### BDD-D2: Auth 过期后 Archived tab 刷新为空

```
Given 认证用户在 Archived tab 查看 own archived 条目
When 用户认证过期
Then 列表内容与匿名用户在 Archived tab 看到的内容一致（空列表）
```

### BDD-M1: MCP list_entries 默认只返回 active 条目

```
Given MCP Agent 调用 list_entries（无 status 参数）
And 认证用户拥有 active 和 archived 条目
Then 返回结果仅包含 active 条目
```

### BDD-M2: MCP list_entries 支持 status 参数过滤

```
Given MCP Agent 调用 list_entries 并指定 status 过滤条件
And 认证用户拥有对应 status 的条目
Then 返回结果仅包含匹配 status 的条目
```

### BDD-M3: MCP list_entries status 参数非法值处理

```
Given MCP Agent 调用 list_entries 并传入非法 status 值
Then 返回错误提示，不返回条目列表
```

## 4. 已确认决定

### Admin 在 All tab 排除 archived（已确认选 A）

Admin All tab 也排除 archived（与普通用户一致，All = active only）。Admin 的特权是"Archived tab 可见全部 archived"而非"All tab 混入 archived"。BDD-A4 和 BDD-A5 已按此决定编写。

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- **P1**：不可裁（核心阶段）
- **P2**：不可裁（涉及后端权限模型变更 + 前端多组件协调，必须设计）
- **P3**：不可裁（P0-brief 明确声明 P3 不可裁，权限模型变更需 TDD）
- **P4**：实现
- **P5**：不可裁（权限模型变更需全量测试验证）
- **P6**：不可裁（P0-brief 明确声明 P6 不可裁，BDD 验收需实跑）
- **P7**：保留（涉及 backend + frontend + MCP 三端改动，需一致性检查）
- **P8**：保留（版本/CHANGELOG 更新）

## 6. 范围声明

```yaml
packages:
  - backend/peekview/services/entry_service.py
  - backend/peekview/api/entries.py
  - frontend-v3/src/views/EntryListView.vue
  - frontend-v3/src/stores/auth.ts
  - frontend-v3/src/stores/entry.ts
  - frontend-v3/src/components/LoginDialog.vue
  - frontend-v3/src/api/client.ts
  - packages/mcp-server/src/tools/listEntries.ts
  - packages/mcp-server/src/client.ts

domains:
  - backend
  - frontend
  - mcp
  - security

risk_level: medium
```

**risk_level 理由**：
- 后端权限模型变更（默认查询行为改变）影响所有 API 消费者
- 前端多组件协调（auth store、entry store、EntryListView、LoginDialog、401 interceptor）
- MCP schema 变更（新增参数）
- 安全不变量必须保持（匿名/非 owner 不可见 archived，404-not-403）

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证登录/退出后列表刷新行为
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800）"
      - "vision-analyzer skill"
    status: available

  - need: debug-backend
    why: 测试需要隔离的 debug 环境（:8888）
    available:
      - "make debug（:8888, /tmp/peekview-debug/）"
    status: available
```
