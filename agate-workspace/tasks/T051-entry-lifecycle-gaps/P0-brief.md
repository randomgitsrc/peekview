---
phase: P0
task_id: T051
task_name: T048 生命周期遗留缺口修复 + 头部信息布局
type: brief
trace_id: T051-P0-20260709
created: 2026-07-09
status: draft
parent: T048 发布后发现的多个缺口 + 用户反馈
---

# T051: T048 生命周期遗留缺口修复 + 头部信息布局

## 五字段

```yaml
task: "修复 T048 生命周期 4 个遗留缺口（后台清理/筛选栏/过期警告/头部布局）"
known_risks:
  - "跨越后端（lifespan）+ 前端（3 个 view + 2 个 component + store），改动端多"
  - "header 重设计涉及桌面+移动端双适配，需 P2 多方案比较"
  - "URL 状态同步（筛选 tab ↔ 路由）需考虑浏览器前进后退"
executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full
env_constraints:
  debug_env: "make debug（:8888 隔离数据 /tmp/peekview-debug/），后端测试 cd backend && .venv/bin/python -m pytest tests/，前端测试 cd frontend-v3 && ./node_modules/.bin/vitest run"
pruning_tendency: "保守——4 个缺口中 3 个涉及 UI 重设计，P2/P3/P6 不可裁剪"
phase_hint: [P1, P2, P3, P4, P5, P6, P7, P8]
```

## 任务简报

T048（两阶段生命周期）发布后，用户发现多个缺口。各缺口都是已有功能的遗漏，不是新需求。

### 缺口 A：后台定时清理任务不存在

配置项 `cleanup.interval_seconds=3600` 和 `cleanup.check_on_start=true` 存在于 config 和 CLI，
但 lifespan() 中没有启动任何后台定时任务——cleanup 只靠手动 API 或 CLI 触发。

**修复**：在 lifespan() 中启动后台任务，按 interval_seconds 间隔调用 admin_service.cleanup_expired()。

### 缺口 B：列表页筛选/导航系统不完整

**现状**：
1. 后端 list_entries 已支持 owner（me/\<username\>）和 status（active/archived）参数，前端无入口
2. 用户名显示不统一：卡片 `@peek`，列表 `peek`
3. 用户名不可点击
4. 没有 archived 筛选入口

**修复**：重新设计筛选栏：

```
[ All ] [ Mine ] [ Archived ]     点击 @peek → [ @peek ]
                  ↑                    ↑
            status=archived        owner=<username>
```

- All / Mine / Archived 三元切换
- 点击用户名跳转到该用户条目列表（显示 @用户名 tab）
- 卡片和列表统一 `@` 格式，均可点击
- Mine tab 激活时显示当前用户名

### 缺口 C：过期未归档状态无视觉区分

条目已过期但 cleanup 未执行，状态仍是 active。前端只显示 "Expires expired"，无视觉警告。

**修复**：详情页在 status=active 且 expires_at < now 时显示过期警告 banner（浅黄色）。

### 缺口 D：详情页/列表页头部信息布局不合理

**现状**：
1. 时间用相对格式 `1d ago`，不够直观
2. header 信息过长：`1d ago 5 reads Expires in 14d Edit`，`5 reads` 位置突兀
3. 移动端顶部/底部 bar 信息重复，排版需重新规划
4. 发布时间、阅读量、过期时间、操作按钮混杂在同一行，可读性差

**修复**：需要整体设计——重新规划详情页顶部 bar 和移动端底部 bar 的信息层级与排版。

## packages

- `backend/peekview/main.py` — lifespan 后台定时清理
- `frontend-v3/src/views/EntryDetailView.vue` — header 重新布局 + 过期警告
- `frontend-v3/src/views/EntryListView.vue` — 筛选栏重新设计
- `frontend-v3/src/stores/entry.ts` — fetchEntries 支持 owner/status
- `frontend-v3/src/components/EntryCard.vue` — 用户名点击 + 统一 @ + 时间格式
- `frontend-v3/src/components/EntryListRow.vue` — 同上
- `frontend-v3/src/styles/layout.css` — header/mobile 布局样式

## domains

- `cleanup-background-task`：lifespan 后台周期性清理
- `list-filter-redesign`：筛选栏 All/Mine/Archived + 用户链接
- `detail-header-redesign`：详情页头部信息重新布局
- `mobile-bottom-bar`：移动端底部操作栏设计
- `expired-visual-warning`：过期未归档视觉提示

## ui_affected

- EntryListView：筛选栏重设计 + 时间格式
- EntryCard/EntryListRow：用户名统一 @ + 可点击 + 时间格式
- EntryDetailView：header 布局重设计 + 过期警告

## 已知风险

1. background task 需考虑 cleanup 执行耗时
2. archived tab 对非 owner 不可见，需空状态提示
3. 用户 tab 的 URL 状态应与筛选同步，支持前进后退
4. header 重设计需要同时兼顾桌面和移动端

## gate_commands

```bash
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
```
