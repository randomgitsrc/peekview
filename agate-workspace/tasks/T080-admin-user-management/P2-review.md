---
phase: P2
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P2-design.md
status: approved
agent: plan-design-review
created: 2026-08-06
---

# T080 P2 设计评审（plan-design-review）— 复审 #1

评审对象：`docs/tasks/T080-admin-user-management/P2-design.md`（修订后，候选方案 A）
评审范围：前端设计四维度 + 前端 BDD 覆盖。后端方案不属本角色评审范围。
本轮性质：复审（第 1 次重试）。上一轮 needs-revision（1 BLOCKER + 9 建议），逐条核对修订。

[PROD_NOT_TOUCHED] P2 评审只读代码 + 写产出文件，未启动服务、未写实现代码、未触碰 :8080 / ~/.peekview/。

## 上一轮 10 项修订核对

### 1. [BLOCKER] BDD-12 PasswordResetDialog — ✅ 已修复

P2 §7 新增 `PasswordResetDialog.vue` 完整组件 spec，7 项要求逐条核对：

| 要求 | 设计覆盖 | 状态 |
|------|---------|------|
| 新建组件（不复用 ConfirmDialog） | §7 明确不复用，附理由（ConfirmDialog 无 input/slot，语义不同） | ✅ |
| password input | `<input type="password" v-model="password">` + `<label for="pwd-input">` | ✅ |
| show/hide toggle | `<button @click="showPwd = !showPwd" :aria-label="...">` + `:type="showPwd ? 'text' : 'password'"` | ✅ |
| ≥8 字符校验 | `password.length > 0 && password.length < 8` → 显示 error，对齐 ResetPasswordRequest min_length=8（models.py:756） | ✅ |
| 确认按钮 disabled | `:disabled="password.length < 8"` | ✅ |
| alertdialog role + aria | `role="alertdialog" aria-labelledby="pwd-title" aria-describedby="pwd-desc"` | ✅ |
| focus management | `watch(visible) → password.value=''; await nextTick(); pwdInputRef.value?.focus()`（聚焦 input 非 cancel，主交互是输入） | ✅ |
| 移动端键盘 | `max-height: 90vh; overflow-y: auto` + `margin: auto`，或 100dvh | ✅ |

BDD 覆盖映射表 BDD-12 已更新为 PasswordResetDialog。files_to_read 含 ConfirmDialog.vue 参照条目（alertdialog/focus/overlay/max-width 模式）。BLOCKER 已清除。

### 2. ConfirmDialog 文案 — ✅ 已修复

§7 给出两组文案 spec（删除 + 禁用），各含 title/message/confirmLabel/variant。重置密码改走 PasswordResetDialog，不走 ConfirmDialog。promote/demote/enable 为非破坏性直接执行 + toast。

### 3. 列表 loading/error/empty — ✅ 已修复

§7 AdminView 段补全三态：
- loading → `loading-state` + `role="status" aria-live="polite"`（参照 EntryListView.vue:98）
- error（列表加载失败）→ error-state + 重试按钮（参照 EntryListView.vue:118-120）
- empty → `EmptyState` 组件（参照 EntryListView.vue:122-126）
- 额外澄清：error ref 仅用于列表加载失败；操作失败走 toast，不写 error ref，避免列表 error-state 误显

### 4. 操作 in-flight 禁用 — ✅ 已修复

§7 指定 `pendingOp: Ref<string | null>`，触发器 `:disabled="!!pendingOp"`（全局禁用，防止操作中打开另一菜单），当前操作项 `:disabled="item.actionKey === pendingOp"`。参照 OverflowMenu.vue 触发器 button 支持 disabled。

### 5. 分页边界 — ✅ 已修复

§7 给两种方案：删除后若当前页空 → `page.value = Math.max(1, page.value - 1)` 重新 fetch；或重新计算 `totalPages`，`page > totalPages` 则 `page = totalPages`。参照 EntryListView.vue:152-156。

### 6. OverflowMenu variant 响应式 — ✅ 已修复

§7 明确 `:variant="isMobile ? 'sheet' : 'dropdown'"`，`isMobile` 来自 `useResponsiveLayout()`（useResponsiveLayout.ts:21 viewportWidth<=640）。参照 DESIGN §9。

### 7. 移动端列表布局 — ✅ 已修复

§7 描述移动端单列：每行 `username + BaseBadge 一行 + OverflowMenu 触发器右对齐`，CSS `flex-direction: row; align-items: center; justify-content: space-between`。桌面端双列。分页复用 Pagination 组件，移动端表现同 EntryListView。参照 DESIGN §9。

### 8. beforeEach waitForAuthInit 顺序 — ✅ 已修复

§7 给出完整修订后 beforeEach 代码：`waitForAuthInit` 在前，requiresAdmin 检查在后（复用现有 loading 等待逻辑）。显式声明"实现者不得将 requiresAdmin 检查抽成独立 beforeEach 或放在 waitForAuthInit 之前"。BDD-14/15 映射已注明 waitForAuthInit 顺序。

### 9. toast aria-live — ✅ 已修复

§7 指定 item 级 aria-live：error toast `aria-live="assertive"`，success/warning `aria-live="polite"`。参照 Toast.vue:2 现状（容器级 polite），改为 item 级动态。AdminView 操作错误走 `toast.error` → assertive，成功走 `toast.success` → polite。

**10 项全部已修复。**

## 四维度评分

### 1. 交互状态覆盖率 — 9/10（上轮 5/10）

已覆盖：loading/error/empty 三态齐全（参照 EntryListView 模式）+ 操作 in-flight 禁用（pendingOp）+ 分页边界回退 + error ref 语义澄清（列表加载失败 vs 操作失败 toast）+ PasswordResetDialog 输入校验 + 确认 disabled 联动。

未扣分项无重大缺口。仅提示：操作成功后列表刷新策略（本地更新对应 user vs 重新 fetch）spec 说"或本地更新对应 user"留了二选一空间，但两者皆合理，不构成 slop 风险。

### 2. AI Slop 风险 — 9/10（上轮 4/10）

已覆盖：PasswordResetDialog 完整 spec（7 项要求 + 不复用 ConfirmDialog 理由）+ ConfirmDialog 文案两组 + OverflowMenu variant 响应式机制 + 操作项状态联动逻辑明确。

BLOCKER（BDD-12）已清除，实现者无"随便搞"空间。

### 3. 移动端考虑 — 9/10（上轮 6/10）

已覆盖：移动端单列布局描述 + OverflowMenu sheet variant + PasswordResetDialog 键盘弹起处理（max-height/overflow-y 或 100dvh）+ 分页复用 Pagination 组件。

### 4. 可访问性 — 9/10（上轮 6/10）

已覆盖：PasswordResetDialog alertdialog role + aria-labelledby/describedby + label 关联 input + aria-invalid/aria-describedby 错误关联 + focus input（非 cancel）+ show/hide aria-label + toast aria-live 分级 + OverflowMenu 焦点恢复声明（复用现有 close() focus trigger）。

一处提示（非阻断）：§7 toast spec 写 `role="status"`，但现状 Toast.vue:8 用 `role="alert"`（所有 toast 统一 alert=assertive）。实现者改 item 级 aria-live 时应同步调整 role（error=alert，非 error=status），否则 role=alert 与 aria-live=polite 冲突。spec 方向正确，实现细节交由 P4，不阻断。

## 前端 BDD 覆盖核对

| BDD | P2 设计覆盖 | 状态 |
|-----|------------|------|
| BDD-01 列表分页 | AdminView + listUsers + Pagination + UserListResponse | ✅ |
| BDD-02 状态标记 | AdminView + BaseBadge(disabled/admin) + UserResponse.disabled_at | ✅ |
| BDD-03 禁用后无法登录 | disable_user + get_current_user 软失效 | ✅ 后端覆盖 |
| BDD-05 启用后可登录 | enable_user + OverflowMenu"启用"项 | ✅ |
| BDD-06 不能禁用自己 | _check_self_operation + toast | ✅ |
| BDD-07 promote | promote_user + OverflowMenu | ✅ |
| BDD-08 demote 另一 admin | demote_user + OverflowMenu | ✅ |
| BDD-12 重置密码 | PasswordResetDialog（新建，完整 spec） | ✅ 已修复 |
| BDD-13 删除级联 | delete_user + ConfirmDialog（文案 spec + destructive alertdialog） | ✅ |
| BDD-14 非admin访问/admin拒绝 | router beforeEach（requiresAdmin 在 waitForAuthInit 后） | ✅ |
| BDD-15 未登录访问/admin拒绝 | router beforeEach（waitForAuthInit 先于 requiresAdmin） | ✅ |
| BDD-20 不能demote自己 | _check_self_operation in demote_user | ✅ |
| BDD-21 不能删除自己 | delete_user 现有自删检查 | ✅ |

路由顺序（BDD-14）：/admin 插在 /settings 后、/users/:username 前，/:slug 在其后——正确，不会被 slug 截获。✅

## 新问题检查

无新问题引入。修订仅在 §7 前端设计节 + files_to_read + ui_interaction_points + BDD 映射表增补，未改动后端方案（候选方案 A、helper、migration、delete_self 改造均未变）。files_to_read 新增 ConfirmDialog.vue 参照条目，合理。

## 结论：approved

### BLOCKER 核对

- [BDD-12] PasswordResetDialog spec 缺失 → **已修复**。新建组件 spec 覆盖 7 项要求（password input + show/hide + ≥8 校验 + 确认 disabled + alertdialog role + aria + focus + 移动端），不复用 ConfirmDialog 理由充分。

### 9 建议核对

全部已纳入修订（见上方逐条核对）。

### 四维度评分汇总

| 维度 | 上轮 | 本轮 |
|------|------|------|
| 交互状态覆盖率 | 5/10 | 9/10 |
| AI Slop 风险 | 4/10 | 9/10 |
| 移动端考虑 | 6/10 | 9/10 |
| 可访问性 | 6/10 | 9/10 |

BLOCKER 数：0
CRITICAL 数：0

### 非阻断提示（供 P4 实现者参考，不影响 approved）

1. Toast.vue 现状 `role="alert"`（:8）与 spec 写的 `role="status"` 不一致——实现 item 级 aria-live 时同步调整 role（error→alert，非 error→status）。
2. 操作成功后列表刷新策略 spec 留"本地更新或重新 fetch"二选一——两者皆合理，P4 可择一实现。

## 评分汇总

| 维度 | 分数 |
|------|------|
| 交互状态覆盖率 | 9/10 |
| AI Slop 风险 | 9/10 |
| 移动端考虑 | 9/10 |
| 可访问性 | 9/10 |

BLOCKER 数：0
CRITICAL 数：0
