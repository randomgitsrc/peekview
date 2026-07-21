---
phase: P0
task_id: T060
task_name: archived-visibility-auth-refresh
agent: main
created: 2026-07-21
status: active
---

# P0-brief: Archived 条目可见性策略 + 登录退出内容刷新

## task

修正 archived 条目在 All/Mine/用户页的可见性策略（归档条目应从默认列表排除，仅 Archived tab 可见），并修复登录/退出/auth 过期后列表内容不刷新的问题。

## known_risks

- 后端 `list_entries` 默认查询（无 status 参数）对认证用户返回 own archived 条目混在活跃条目中——改为排除可能影响现有用户习惯（需确认是否为 breaking change）
- 前端 `authState` watcher 仅处理 `?owner=me` URL 特例，登录后不刷新列表——修复需在多处（LoginDialog、auth store、EntryListView）协调
- auth 过期（401 interceptor）路径未调 `filterPrivateEntries()`，是最差刷新场景
- 退出后 `filterPrivateEntries()` 仅做客户端过滤，不重新请求 API，可能残留陈旧数据

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug（:8888, /tmp/peekview-debug/），严禁触碰生产 :8080"
pruning_tendency: "保守——涉及权限模型变更，P3/P6 不可裁剪"

## 问题详述

### 问题 A：Archived 条目在 All/Mine 页面混入活跃条目

**现状**：后端 `entry_service.list_entries` 无 status 参数时，对认证非 admin 用户应用过滤 `(status != ARCHIVED) | (owner_id == current_user_id)`，即 own archived 条目混在活跃条目中返回。前端 All/Mine tab 直接展示这些条目，仅靠 badge 区分。

**用户心智模型冲突**：归档 = 收起来了，但实际 = 还在列表里多了个 badge。Archived tab 才是纯归档视图，但 All/Mine 没排除。

**期望**：All/Mine 默认只看 active 条目，archived 的去 Archived tab 找。

### 问题 B：登录后列表不刷新

**现状**：`EntryListView` 的 `authState` watcher 仅处理 `?owner=me` URL 参数特例。登录后列表仍显示匿名视图（仅公开非归档条目），用户必须手动点 tab 才能看到私有条目。

### 问题 C：退出后列表不重新请求

**现状**：`handleLogout()` 调 `filterPrivateEntries()`（客户端 `entries.filter(e => e.isPublic)`），不重新请求 API。可能残留陈旧数据或缺失本应对匿名可见的条目。

### 问题 D：Auth 过期（401）后无任何刷新

**现状**：axios 401 interceptor 触发 `peekview:auth-expired` 事件 → auth store 设 `user = null`，但无 `filterPrivateEntries()` 调用也无列表重载。用户看到已失效的私有条目。

### 权限一致性要求

- 匿名用户：不可见任何 archived 条目（当前已实现 ✅）
- 认证用户（非 owner）：不可见他人 archived 条目（当前已实现 ✅）
- Owner：All/Mine 默认排除 own archived，Archived tab 可见 own archived（需修改）
- Admin：All 默认排除 archived，Archived tab 可见全部 archived（需确认）
- 登录/退出/auth 过期：列表内容必须与当前权限状态一致（需修改）

## 涉及文件

- `backend/peekview/services/entry_service.py` — list_entries 默认查询逻辑
- `backend/peekview/api/entries.py` — list endpoint status 参数
- `frontend-v3/src/views/EntryListView.vue` — tab 切换 + authState watcher
- `frontend-v3/src/stores/auth.ts` — login/logout 动作
- `frontend-v3/src/stores/entry.ts` — filterPrivateEntries + loadEntries
- `frontend-v3/src/components/LoginDialog.vue` — 登录成功后回调
- `frontend-v3/src/api/client.ts` — 401 interceptor
