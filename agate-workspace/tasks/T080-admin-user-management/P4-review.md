---
phase: P4
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P4-implementation.md
status: approved
agent: review-lead
created: 2026-08-06
---

# T080 P4 — Review Lead 汇总

## Status: approved

首轮 3 评审（review=rejected, design-review=needs-revision, cso=needs-revision）共发现 5 个 BLOCKER（2 CRITICAL + 3 MUST-FIX）。implementer 重试 #2 已全部修复，并附带修复 3 个 SHOULD-FIX。组长逐项 grep 确认修复落地，无新意见。

## 输入评审

| 评审角色 | 产出文件 | 首轮 status | BLOCKER 数 |
|---------|---------|------------|-----------|
| review | P4-review-review.md | rejected | 2 CRITICAL |
| design-review | P4-review-design-review.md | needs-revision | 3 MUST-FIX |
| cso | P4-review-cso.md | needs-revision | 2 MEDIUM（与 review 的 2 CRITICAL 同源） |

## BLOCKER 修复确认

### CRITICAL 1 — _check_last_active_admin 缺 is_active 条件

- 来源：review [CRITICAL] + cso ISSUE-1
- 位置：backend/peekview/services/admin_service.py:351
- 首轮问题：`if user.is_admin:` 遗漏 `and user.is_active`，导致 disabled admin 无法 demote/delete（over-protection 阻塞清理）
- 修复声明：改为 `if user.is_admin and user.is_active:`
- 组长确认：grep `is_active` admin_service.py:351 → `if user.is_admin and user.is_active:`（与 cli.py:1620/1654 一致）。count 查询 :353 同步 `User.is_admin.is_(True), User.is_active.is_(True)`。三个调用方（disable:362 / demote:430 / delete:452）行为自动修正。
- 状态：已修复

### CRITICAL 2 — delete_user 未清理 disabled_by FK 引用

- 来源：review [CRITICAL] + cso ISSUE-2
- 位置：backend/peekview/services/admin_service.py:468
- 首轮问题：disabled_by FK 无 ondelete，删除被引用 admin 触发 IntegrityError，跨 session 部分删除导致数据不一致
- 修复声明：delete_user 删 User 行前先 `UPDATE users SET disabled_by=NULL WHERE disabled_by=:user_id`
- 组长确认：grep `disabled_by` admin_service.py:468 → `sa_update(User).where(User.disabled_by == user_id).values(disabled_by=None)`，位于 delete User 前、删 ApiKey 后的同一 session（:464-471）。sa_update/sa_delete 已提升到模块级 import。
- 状态：已修复

### MUST-FIX 3 — AdminView "public" badge 语义错误

- 来源：design-review [MUST-FIX]
- 位置：frontend-v3/src/views/AdminView.vue:34
- 首轮问题：`<BaseBadge v-else status="public" />` 对活跃非 admin 用户显示 "public"，语义错误（public 是 entry 可见性术语，非用户状态），BDD-02 不通过
- 修复声明：移除该行（无 badge = 默认活跃，badge 仅标记异常状态 admin/disabled）
- 组长确认：grep `status="public"` AdminView.vue → 无匹配（exit 1）。badge 仅保留 admin/disabled variant。
- 状态：已修复

### MUST-FIX 4 — pendingOp 未绑定到 OverflowMenu disabled

- 来源：design-review [MUST-FIX]（P2-design.md §7 line 402 明确要求）
- 位置：frontend-v3/src/components/OverflowMenu.vue + AdminView.vue:40
- 首轮问题：pendingOp ref 声明并在 do* 函数中 set/clear，但模板未绑定 disabled，操作 in-flight 时仍可点击触发新操作
- 修复声明：OverflowMenu.vue 新增 disabled prop（trigger button :disabled + :aria-disabled + toggle/open 守卫）；AdminView 绑定 :disabled="!!pendingOp"
- 组长确认：
  - OverflowMenu.vue:93 `disabled?: boolean` prop 声明，:96 默认 false
  - OverflowMenu.vue:6-7 trigger button `:disabled="disabled" :aria-disabled="disabled ? 'true' : undefined"`
  - OverflowMenu.vue:113,118 toggle/open 函数 `if (props.disabled) return` 守卫
  - AdminView.vue:40 `:disabled="!!pendingOp"` 绑定
- 状态：已修复

### MUST-FIX 5 — --space-8 CSS 变量不存在

- 来源：design-review [MUST-FIX]
- 位置：frontend-v3/src/views/AdminView.vue:303,309
- 首轮问题：`padding: var(--space-8)` 引用不存在的 CSS 变量（variables.css space scale 只到 --space-7=48px），padding 塌陷为 0
- 修复声明：改为 `var(--space-7)`（48px，与 EntryListView.vue:625 一致）
- 组长确认：grep `space-7` AdminView.vue:303,309 → `padding: var(--space-7)`；grep `space-8` → 无匹配（exit 1）
- 状态：已修复

## SHOULD-FIX 修复确认（一并修）

### SHOULD-FIX 1 — 按钮 :focus-visible 缺失

- 来源：design-review [SHOULD-FIX]
- 组长确认：PasswordResetDialog.vue:197 `.pwd__btn:focus-visible`；AdminView.vue:327 `.error-state button:focus-visible`
- 状态：已修复

### SHOULD-FIX 2 — disabledAt 未展示

- 来源：design-review [SHOULD-FIX]
- 组长确认：AdminView.vue:34 `<span v-if="!user.isActive && user.disabledAt" class="disabled-time">{{ formatDisabledAt(user.disabledAt) }}</span>`；:149 `formatDisabledAt` 函数；:366 `.disabled-time` 样式
- 状态：已修复

### SHOULD-FIX 3 — Dialog 缺 Escape 关闭

- 来源：review [INFORMATIONAL] + design-review [SHOULD-FIX]
- 组长确认：PasswordResetDialog.vue:10 `@keydown.escape="cancel"`
- 状态：已修复

## 未阻断问题（INFORMATIONAL / NICE-TO-HAVE，不阻塞）

以下问题首轮已识别，不阻断 P4 推进，可作 follow-up：

| 问题 | 来源 | 级别 | 说明 |
|------|------|------|------|
| delete_user TOCTOU 跨 session | review | INFORMATIONAL | SQLite 写串行化 + LastAdmin 双重检查兜底，现有模式非本任务引入，建议 P5 后单独优化 |
| client.py delete_self 残留 confirm_username + code 匹配大小写 | cso ISSUE-3 | LOW | 死代码，服务端忽略参数；409 fallback 功能正常。follow-up cleanup |
| delete_self TOCTOU 双 session 间隙 | cso ISSUE-4 | LOW | SQLite WAL + 单进程 + 低并发，delete_user 内有第二次检查兜底。无需修复 |
| reset-password 返回明文密码 | cso ISSUE-5 | LOW | 现有行为非 T080 引入。follow-up 改进 |
| 移动端 media query 含 no-op 规则 | design-review | NICE-TO-HAVE | 死代码，无害 |
| displayName 未展示 | design-review | NICE-TO-HAVE | P2 spec 建议项，username 即足够 |

## 修复验证证据

implementer 重试 #2 自查结果（组长采信，未独立重跑）：

- 后端 pytest：T080 23/23 passed + 全套 1068 passed / 2 skipped / 1 deselected（无回归）
- 前端 vitest：1217/1217 full suite pass（BDD-14/15 路由守卫全绿）
- 前端 typecheck（vue-tsc --noEmit）：clean
- 后端 lint（ruff check peekview/）：clean

## [DESIGN_GAP] 配对核对

P4-implementation.md 声明 4 个 [DESIGN_GAP] 均已 [DESIGN_GAP_REVIEWED: 已解决]：

1. BDD-06 与 BDD-10/23 测试预期矛盾 → 决策 C：LastAdmin 优先，BDD-06 预期改 409
2. test_admin_cannot_delete_self 与 BDD-23 矛盾 → 决策 C：同上，旧测试预期改 409
3. BDD-24 与 BDD-17/18 矛盾 → 决策 D：CLI disable 加 LastAdmin 检查，BDD-17/18 setup 调整
4. BDD-01 rate limit 环境问题 → 决策 E：测试改用直接插 DB 绕过 register rate limit

均属测试预期对齐，非实现缺陷，不阻塞。

## [SCOPE+]

无。所有改动均在 P2-design.md 范围内。

## 结论

5 个 BLOCKER（2 CRITICAL + 3 MUST-FIX）全部修复并经组长 grep 确认落地。3 个 SHOULD-FIX 一并修复确认。无新增 BLOCKER 意见。6 个非阻断问题（INFORMATIONAL/LOW/NICE-TO-HAVE）记录为 follow-up。

**Status: approved**

[PROD_NOT_TOUCHED]

全程只读代码 + grep 验证 + 写产出文件，未启动服务、未写实现代码、未触碰 :8080 / ~/.peekview/。
