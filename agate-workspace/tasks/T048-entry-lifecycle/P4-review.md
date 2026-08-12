---
phase: P4
task_id: T048-entry-lifecycle
type: review
parent: P4-implementation.md
trace_id: T048-P4-review-20260707
status: approved
created: 2026-07-07
agent: design-review
---

# T048 P4: 前端实现 Review

## Scope

前端组件 + 类型变更 + 交互状态，不涉及后端逻辑。

## 检查清单结果

### 1. 类型变更完整性

| 文件 | 检查项 | 结果 |
|------|--------|------|
| `types/index.ts:14` | `status: 'active' \| 'archived'`（移除 'expired'） | ✅ |
| `types/index.ts:21` | `archivedAt: string \| null` 新增 | ✅ |
| `api/types.ts:15` | EntryListItemResponse + `archived_at` | ✅ |
| `api/types.ts:39` | EntryResponse + `archived_at` | ✅ |
| `client.ts:49,67` | transform 中 status cast 为 `'active' \| 'archived'` | ✅ |
| `client.ts:56,73` | transform 中 `archivedAt: entry.archived_at ?? null` | ✅ |
| `client.ts:141-143` | `updateEntry(slug, data)` data 类型排除 `status` | ✅ |

### 2. BaseBadge archived 变体

| 检查项 | 结果 |
|--------|------|
| Props: `'public' \| 'private' \| 'shared' \| 'archived'` | ✅ `BaseBadge.vue:7` |
| CSS: `.badge-archived` with `--c-badge-archived-bg` | ✅ `BaseBadge.vue:39-42` |
| Dark theme CSS var: `rgba(128,128,128,.15)` | ✅ `variables.css:55` |
| Light theme CSS var: `rgba(128,128,128,.1)` | ✅ `variables.css:111` |

### 3. ExpiresInDialog 交互状态

| 状态 | 预期表现 | 结果 |
|------|----------|------|
| idle | 按钮可点击，文案 "Update" / "Reactivate" | ✅ `:21-23` |
| loading | 按钮 disabled + "...ing"；select 不可操作 | ✅ `:12` select `:disabled="loading"`, `:21` button `:disabled="loading"` |
| error | 红色错误消息；用户可修改 select 后重试 | ✅ `:8` `v-if="error"`, `:48` error ref, `:66` 错误捕获 |
| success | emit `updated` + 自动关闭 dialog | ✅ `:63-64` emit 后 `visible.value = false` |

额外观察：
- watch(visible) 重置 selected/error/loading 状态 ✅（防止前次操作残留）`ExpiresInDialog.vue:50-56`
- Teleport + Transition 动画：与 ShareDialog 模式一致 ✅
- Escape 关闭 + overlay click 关闭 ✅

### 4. EntryDetailView 改造

| 功能 | 实现 | 结果 |
|------|------|------|
| Active entry 过期显示 "Expires Xd [Edit]" | `:65-68` | ✅ |
| 无过期显示 "Never expires [Edit]" | `:69-72` | ✅ |
| Archived "Expired" banner + Reactivate 按钮 | `:136-139` | ✅ |
| Share 按钮对 archived 隐藏 | `:385-390` `showShareButton` | ✅ |
| Archived badge 在 header-right（设计未明确，但不冲突） | `:59-63` | 🟡 与 banner 略有冗余 |
| ExpiresInDialog 集成 | `:307-312` | ✅ |
| `handleExpiresInUpdated` reload entry + toast | `:471-474` | ✅ |
| 移动端：expires 无 `desktop-only` | `:65-73` 确认无 `desktop-only` | ✅ |
| 移动端：banner 无 `desktop-only` | `:136` 确认无 `desktop-only` | ✅ |
| 移动端：Reactivate 按钮可点击 | 无 `desktop-only` | ✅ |

### 5. EntryListView 视觉区分 (Card + Row)

| 组件 | `opacity: 0.6` | `BaseBadge status="archived"` | hover 恢复 |
|------|----------------|-------------------------------|------------|
| EntryCard | ✅ `:206-208` | ✅ `:36` | ✅ `:210-212` `opacity: 0.8` |
| EntryListRow | ✅ `:191-193` | ✅ `:22` | ✅ `:195-197` `opacity: 0.8` |

### 6. 交互状态专项检查

- hover: `.expires-edit-btn:hover` ✅, `.reactivate-btn:hover` ✅, `.expires__submit:hover:not(:disabled)` ✅
- focus: `.expires-select:focus` ✅（outline 替代方案）
- disabled: `.expires__submit:disabled` ✅（opacity + cursor）
- `:focus-visible` 缺失:
  - `.close-btn`: 无 focus 替代方案 🟡
  - `.reactivate-btn`: 无 focus 替代方案 🟡
  - `.expires-edit-btn`: 无 focus 替代方案 🟡
  - `.expires__submit`: 无 focus 替代方案 🟡

### 7. AI Slop 检查

- 紫色/violet 渐变：无 ✅
- 泛化文案：无 ✅
- 全部居中布局：无 ✅
- 卡片雷同：卡片内容区分 badge/archived 状态 ✅

## 发现汇总

### Non-blocker 🟡

1. **`:focus-visible` 缺失**：`close-btn`、`reactivate-btn`、`expires-edit-btn`、`expires__submit` 均未设置 `:focus-visible` 样式。非 P2 明确要求，但根据设计评审清单应加。
   - Fix: 每个按钮加 `&:focus-visible { outline: 2px solid var(--c-accent-secondary); outline-offset: 2px; }`

2. **Archived badge 和 banner 并存**：header-right 的 `status === 'archived'` badge（line 59-63）和下方 banner 同时出现。badge 在 header 中略显冗余（banner 已传达过期状态）。
   - Fix（可选）: 去掉 header-right 的 archived badge，仅保留 banner

### 综合结论

P4 实现完整覆盖 P2 设计的前端部分。类型变更加载完整，ExpiresInDialog 实现了 error/loading/success 三态，移动端适配已处理，视觉区分（opacity + badge）正确。不存在 P2 设计偏离。

**File: `docs/tasks/T048-entry-lifecycle/P4-review.md`**
**Status: approved** — 2 个 minor 建议（`:focus-visible` + badge 冗余），无需 revision
