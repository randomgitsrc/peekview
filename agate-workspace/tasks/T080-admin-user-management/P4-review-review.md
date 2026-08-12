---
phase: P4
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P4-implementation.md
status: rejected
agent: review
created: 2026-08-06
---

# T080 P4 — Review (review)

## Status: rejected

2 个 CRITICAL（数据丢失/数据不一致 + 逻辑错误阻塞清理），必须修复后重审。

## 客观查证

- 代码已读取：models.py, database.py, services/admin_service.py, api/admin.py, api/auth.py, cli.py, router.ts, AdminView.vue, PasswordResetDialog.vue
- 实际运行隔离测试验证了两个 CRITICAL（非仅代码推断）
- CHANGELOG 已记录破坏性变更（confirm_username 旁路移除 + admin 计数修正）
- 路由顺序正确（/admin 在 /:slug 前）
- migration 幂等性正确（PRAGMA table_info 先检查）
- CLI LastAdmin 检查条件正确（is_admin AND is_active）

## Pass 1 — CRITICAL

### [CRITICAL] backend/peekview/models.py:110 — disabled_by FK 缺 ondelete，删除被引用 admin 触发 IntegrityError + 部分删除

`disabled_by: int | None = Field(default=None, foreign_key="users.id")` 没有 `ondelete`。
PRAGMA foreign_keys=ON（database.py:31）。当 admin A 禁用用户 B（B.disabled_by=A.id），
随后删除 admin A 时，FK 约束阻止删除，抛 `IntegrityError: FOREIGN KEY constraint failed`。

**已验证**：隔离测试重现 — 删除被 disabled_by 引用的 user 时 SQLite 拒绝删除。

**影响（数据不一致）**：`delete_user`（admin_service.py:448-470）跨 3 个 session：
1. session 1: LastAdmin 检查 + 取 entry slugs
2. entry_service.delete_entry 逐个删除 entries（**已删除**）
3. session 2: 删 ApiKey（**已删除**）→ 删 User 行（**IntegrityError 失败**）

结果：entries 和 API keys 已删除，但 user 行仍在 → 数据不一致。API 层返回 500（非预期 409/400）。

**对比**：`Entry.owner_id`（models.py:95）用 `ondelete="CASCADE"`；`ApiKey.user_id`（models.py:157）未显式设 ondelete 但 delete_user 先手动删 ApiKey 再删 User。`disabled_by` 没有对应的预清理逻辑。

**Fix 方向**：
- 方案 A（推荐）：models.py:110 改为 `sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)`，migration 中对已有数据补 `UPDATE users SET disabled_by=NULL WHERE disabled_by NOT IN (SELECT id FROM users)`（清理已悬空引用）。注意 SQLite ALTER TABLE 无法直接改 FK ondelete，需 rebuild table 或在 migration 中处理。
- 方案 B（最小改动）：delete_user 在删 User 行前，先 `UPDATE users SET disabled_by=NULL WHERE disabled_by=:user_id`，清空引用。不需改 schema/migration。但需在 delete_user 的 session 2 中、delete user 前执行。
- 方案 C：disabled_by 不用 FK 约束（改为普通 INTEGER 列，仅应用层保证一致性）。牺牲数据完整性。

### [CRITICAL] backend/peekview/services/admin_service.py:349 — _check_last_active_admin 缺 is_active 条件，误阻 disabled admin 的 demote/delete

```python
if user.is_admin:  # ← 缺 and user.is_active
    count = ... where User.is_admin.is_(True), User.is_active.is_(True)
    if count <= 1:
        raise LastAdminError(...)
```

P2-design.md:237 明确要求：`若 target is_admin=True AND is_active=True` 才触发保护。
实现只检查 `is_admin`，遗漏 `is_active`。

**已验证**：隔离测试重现 — 2 admin（1 active + 1 disabled），demote disabled admin 时 count=1（仅 active admin），误抛 LastAdminError。

**影响**：admin 无法 demote/delete 已 disabled 的 admin 账户，阻塞清理。实际场景：admin A 禁用 admin B → 想 demote B（收回权限）或 delete B（清理账户）→ 被误拒。

**对比 CLI（正确）**：cli.py:1620 和 cli.py:1654 都用 `if user.is_admin and user.is_active:` — CLI 实现正确，service 层错误。同逻辑两处实现分叉。

**Fix**：admin_service.py:349 改为：
```python
if user.is_admin and user.is_active:
```
一行修复。所有调用方（disable_user/demote_user/delete_user）行为自动修正：
- disable 已 disabled 的 admin → is_active=False，不进保护（正确，重复 disable 无害）
- demote disabled admin → 不进保护（正确，demote 不影响 active admin count）
- delete disabled admin → 不进保护（正确，delete 不影响 active admin count）

## Pass 2 — INFORMATIONAL

### [INFORMATIONAL] backend/peekview/services/admin_service.py:448-470 — delete_user TOCTOU（跨 session）

LastAdmin 检查在 session 1（:450），实际删除在 session 3（:463-470）。中间 entry_service.delete_entry 跨多个 session。并发请求可在检查后、删除前改变 admin count。

**严重性低**：SQLite 写串行化 + LastAdmin 保护是防御性措施（非安全关键）。实际并发场景极罕见（需两个 admin 同时操作且其中一个是最后一个）。现有代码已是此模式（非本任务引入），LastAdmin 检查加在 session 1 内是合理的最小改动。

**Fix 方向（可选）**：session 1 内用 `BEGIN IMMEDIATE` 获取写锁，或把 LastAdmin 检查移到 session 3（删除 session）内。但改动 delete_user 跨 session 结构风险较高，建议 P5 后单独优化。

### [INFORMATIONAL] frontend-v3/src/views/AdminView.vue:92 — pendingOp 未消费，in-flight 保护未生效

`pendingOp` ref（:92）在 doDisable/doEnable/doPromote/doDemote/doDelete 中 set/clear，但模板中 OverflowMenu（:37-41）未绑定 `:disabled`，getMenuItems（:123-142）未检查 pendingOp。用户可在操作 in-flight 时点击另一个菜单项触发新操作。

**影响低**：后端有 LastAdmin/self-op 保护，重复操作幂等（disable 已 disabled 的 user 是 no-op）。但 UX 上可能触发竞态（如快速 disable + delete 同一 user）。

**Fix 方向**：getMenuItems 中按 pendingOp 标记 items disabled，或 OverflowMenu 触发器绑定 `:disabled="!!pendingOp"`。

### [INFORMATIONAL] frontend-v3/src/components/PasswordResetDialog.vue — 缺 Escape 关闭

Dialog 支持 overlay click cancel（:4 @click.self），但无 Escape 键关闭。ConfirmDialog 同样缺失。alertdialog role 习惯上应支持 Escape 关闭。

**Fix 方向**：dialog 容器加 `@keydown.escape="cancel"`。

## 前端专项

- 无 AI Slop（无紫色渐变、无 "Unlock the power" 文案）
- focus 样式：PasswordResetDialog input focus 用 border-color 替代 outline（:156-159），可接受
- 交互态：loading/error/empty 均覆盖（AdminView.vue:7-20）
- BaseBadge disabled/admin variant 正确消费
- Toast aria-live item 级动态（按 variant）— 未直接读 Toast.vue 但 P4 声明已改，CHANGELOG 记录

## 结论

2 个 CRITICAL 必须修复：
1. disabled_by FK ondelete（数据不一致风险）
2. _check_last_active_admin 缺 is_active（逻辑错误，阻塞清理）

修复后重审。3 个 INFORMATIONAL 建议修但不阻断。

[PROD_NOT_TOUCHED]
