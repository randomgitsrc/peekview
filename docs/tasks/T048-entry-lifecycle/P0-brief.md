---
phase: P0
task_id: T048
task_name: entry-lifecycle
type: brief
trace_id: T048-P0-20260707
created: 2026-07-07
status: draft
parent: 用户需求 — 过期 entry 归档+可续命+可配置保留期
---

# T048: Entry 生命周期管理（过期→归档→可续命→可配置最终删除）

## 任务简报

### 问题

当前 PeekView 的过期 entry 由 cleanup 定时任务直接物理删除，不可恢复。用户无法：
1. 在 entry 还是 active 时修改过期时间（续命/设永不过期）
2. 恢复已过期的 entry
3. 配置归档 entry 的保留时长

### 方案

两阶段生命周期（S3 Lifecycle 模式）：

```
active → 过期(expires_at 到期) → archived（可恢复） → archived N天后 → 物理删除
```

核心改动：
1. **cleanup 改为归档**：过期 → `status=ARCHIVED, expires_at=NULL`，而非物理删除
2. **PATCH 加 `expires_in`**：owner 可随时修改过期时间；archived entry 传 `expires_in` 自动重新激活
3. **前端过期时间编辑**：active entry 显示 "Expires in Xd [Edit]"；archived entry 显示 "Expired" banner + Reactivate 按钮
4. **列表页展示 archived**：owner 的 Mine tab 中 archived entry 可见（灰色标记）
5. **可配置归档保留期**：`PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS`（默认 90 天，0=永不删除）

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 后端 pytest 全局隔离（conftest autouse）
- 前端 `npx vue-tsc --noEmit` CI 强制
- Playwright CDP 截图验证 UI

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| cleanup 逻辑从物理删除改为归档，是破坏性变更 | 已物理删除的历史 entry 不受影响，但未来过期的行为完全不同 | 测试覆盖：确认归档逻辑正确、archived entry 不可公开访问 |
| archived entry 在列表中的展示需要 UI 设计 | owner 列表中 mixed active+archived 可能视觉混乱 | 最小方案：archived entry 灰色/淡化 + "Archived" badge |
| `EntryStatus` 枚举有 `PUBLISHED` 值当前未用 | 不影响本次，但 PUBLISHED 语义待定义 | 本次不涉及 PUBLISHED，保持现状 |
| 前端 `Entry.status` 类型当前是 `'active' | 'expired'`，与后端三值不匹配 | 需对齐 | 一次性修正 |

## 裁剪倾向

- P3（TDD）保留：cleanup 逻辑变更有回归风险
- P6（验收）保留：UI 交互需 Playwright 实跑
- P7（一致性）保留：前后端+配置+文档多文件改动

## packages

- `backend/peekview/`：config, models, entry_service, admin_service, share_service, api/entries
- `frontend-v3/src/`：types, api/client, stores/entry, views/EntryDetailView, views/EntryListView, components/EntryCard, components/EntryListRow, 新组件 ExpiresInDialog

## domains

- `entry-lifecycle`：过期→归档→恢复→最终删除的完整链路
- `cleanup`：定时清理逻辑从物理删除改为两阶段
- `entry-update`：PATCH 新增 expires_in 字段
- `frontend-entry-edit`：过期时间编辑 UI

## ui_affected

- EntryDetailView：过期时间展示 + Edit 按钮 + Expired banner + Reactivate 按钮
- EntryListView + EntryCard/EntryListRow：archived entry 展示（灰色标记）
- 新组件 ExpiresInDialog

## gate_commands

```bash
cd backend && .venv/bin/python -m pytest tests/ -v --tb=short
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
```
