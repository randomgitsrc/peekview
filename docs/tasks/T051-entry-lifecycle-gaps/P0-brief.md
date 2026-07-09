---
phase: P0
task_id: T051
task_name: T048 生命周期遗留缺口修复
type: brief
trace_id: T051-P0-20260709
created: 2026-07-09
status: draft
<<<<<<< HEAD
parent: T048 发布后发现的 3 个缺口
=======
parent: T048 发布后发现的 3 个缺口 + 用户反馈
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)
---

# T051: T048 生命周期遗留缺口修复

## 任务简报

<<<<<<< HEAD
T048（两阶段生命周期）发布后，用户发现了 3 个实现缺口。每个缺口都是 T048 已有功能的遗漏，不是新需求。
=======
T048（两阶段生命周期）发布后，用户发现多个缺口。各缺口都是 T048/T049 已有功能的遗漏，不是新需求。
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)

### 缺口 A：后台定时清理任务不存在

**现象**：配置项 `cleanup.interval_seconds=3600` 和 `cleanup.check_on_start=true` 存在于 config 和 CLI，但 **lifespan() 中没有启动任何后台定时任务**——cleanup 只靠手动 API 或 CLI 触发。

**现状代码**：
- `backend/peekview/config.py`：定义 `PeekCleanup.interval_seconds` ✅
- `backend/peekview/cli.py`：注册为 SUPPORTED_CONFIG_KEYS ✅
- `backend/peekview/services/admin_service.py`：`cleanup_expired()` 两阶段逻辑 ✅
- `backend/peekview/main.py`：`lifespan()` **没有** asyncio.create_task 启动周期性 cleanup ❌

**修复**：在 `lifespan()` 中启动后台任务，按 `interval_seconds` 间隔调用 `admin_service.cleanup_expired()`，`check_on_start=true` 时启动时立即执行一次。

<<<<<<< HEAD
### 缺口 B：列表页无 archived 筛选入口

**现象**：后端 `list_entries` API 已支持 `?status=archived` 参数，但前端 EntryListView 没有任何 tab/按钮/开关让用户切换到 archived 视图。

**现状代码**：
- `backend/peekview/services/entry_service.py`：`list_entries(status=)` 已支持 ✅
- `frontend-v3/src/views/EntryListView.vue`：有 owner-tabs（All/Me），**无 status-tabs（Active/Archived）** ❌

**修复**：EntryListView 增加 "Active" / "Archived" tab（或 dropdown），切换时传 `?status=archived` 到 list API。
=======
### 缺口 B：列表页筛选/导航系统不完整

**现象**：
1. 后端 `list_entries` 已支持 `owner`（me / \<username\>）和 `status`（active / archived）参数，**前端没有入口使用它们**
2. 用户名显示不统一：卡片模式 `@peek`，列表模式 `peek`
3. 用户名不可点击——之前可点击跳转到该用户条目列表，现在没了
4. 没有 archived 筛选入口

**现状代码**：
- `backend/peekview/services/entry_service.py`：`list_entries(owner=, status=)` 已支持 ✅
- `frontend-v3/src/views/EntryListView.vue`：只有 owner-tabs（All / Mine），无 status-tabs 或 user-link ❌

**修复**：重新设计筛选栏，包含：

```
[ All ] [ Mine ] [ Archived ]     点击 @peek → [ @peek ]
                    ↑               ↑
              status=archived   owner=<username>
```

- **Tab 行**：All | Mine | Archived（三元切换）
- **点击用户名**：导航到该用户的条目列表（显示 `@用户名` tab）
- **用户名格式统一**：卡片和列表都带 `@`，均可点击
- **当前用户标识**：Mine tab 激活时显示 `@我（当前用户名）`
- **退出手势**：点击 `@用户名` tab 上的 × 回到 All
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)

### 缺口 C：过期未归档状态无视觉区分

**现象**：条目已过期（`expires_at < now`）但 cleanup 未执行，状态仍是 `active`。前端只显示 "Expires expired" 文字，没有任何 banner/badge/颜色变化提示用户"这个条目已过期，即将归档"。

**现状代码**：
- `frontend-v3/src/views/EntryDetailView.vue`：只在 `status === 'archived'` 时显示 banner，过期但仍 `active` 时不显示 ❌

**修复**：详情页在 `status === 'active' && expires_at < now` 时显示过期警告 banner（浅黄色，与 archived 的红色区分）。

## packages

- `backend/peekview/main.py` — lifespan 添加后台定时任务
<<<<<<< HEAD
- `frontend-v3/src/views/EntryListView.vue` — 添加 status tab
- `frontend-v3/src/views/EntryDetailView.vue` — 添加过期警告 banner
- `frontend-v3/src/stores/entry.ts` — fetchEntries 支持 status 参数
=======
- `frontend-v3/src/views/EntryListView.vue` — 重新设计筛选栏
- `frontend-v3/src/views/EntryDetailView.vue` — 添加过期警告 banner
- `frontend-v3/src/stores/entry.ts` — fetchEntries 支持 owner/status 参数
- `frontend-v3/src/components/EntryCard.vue` — 用户名点击跳转 + 统一 `@` 格式
- `frontend-v3/src/components/EntryListRow.vue` — 用户名点击跳转 + 统一 `@` 格式
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)

## domains

- `cleanup-background-task`：lifespan 后台周期性清理
<<<<<<< HEAD
- `archived-list-filter`：前端列表页 archived 筛选
=======
- `list-filter-redesign`：前端筛选栏重新设计（All/Mine/Archived + 用户链接）
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)
- `expired-visual-warning`：过期未归档视觉提示

## ui_affected

<<<<<<< HEAD
- EntryListView：新增 Active/Archived tab
- EntryDetailView：新增过期警告 banner
=======
- EntryListView：筛选栏改为 All / Mine / Archived / @user 动态 tab
- EntryCard：用户名加 `@` 并可点击跳转
- EntryListRow：用户名加 `@` 并可点击跳转
- EntryDetailView：过期警告 banner
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)

## 已知风险

1. background task 需要考虑 cleanup 执行耗时——如果在 cleanup 执行期间服务关闭，下次启动时 `check_on_start` 会兜底执行
<<<<<<< HEAD
2. archived tab 对非 owner 不可见（backend 已限制），前端需要处理空状态
3. expired warning banner 需要与 archived banner 视觉可区分
=======
2. archived tab 对非 owner 不可见（backend 已限制），前端需要处理空状态与提示"只有自己的 archived 条目可见"
3. expired warning banner 需要与 archived banner 视觉可区分（黄 vs 红）
4. 点击用户名跳转需要处理匿名条目（owner_id=null）的情况
5. 用户 tab 的 URL 状态应与筛选同步，支持分享和浏览器前进后退
>>>>>>> 1edb9bdd (wf(T051-P0): 立项 T048 生命周期缺口修复)

## gate_commands

```bash
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
```
