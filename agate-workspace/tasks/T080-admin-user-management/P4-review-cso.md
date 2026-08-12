---
phase: P4
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P4-implementation.md
status: needs-revision
agent: cso
created: 2026-08-06
---

# T080 P4 — CSO 安全审计

## 审计范围

| 文件 | 审计焦点 |
|------|---------|
| `backend/peekview/api/auth.py:231-251` | delete_self confirm_username 旁路移除（决策 A）+ admin 计数 is_active（决策 B） |
| `backend/peekview/services/admin_service.py:339-471` | _check_self_operation / _check_last_active_admin helper + disable/enable/promote/demote/delete 方法 |
| `backend/peekview/api/admin.py:1-116` | 4 toggle 端点守卫 + reset-password 返回值 |
| `backend/peekview/cli.py:1602-1739` | user disable/enable/demote/delete 子命令 + LastAdmin 保护 |
| `backend/peekview/models.py:101-111,643-663,769-774` | 审计字段 + UserListResponse + DisableUserRequest schema |
| `backend/peekview/database.py:100-110` | migration 幂等性 |
| `backend/peekview/auth.py:164-217` | get_current_user 软失效 + require_admin |
| `backend/peekview/client.py:403-427` | delete_self 客户端残留 confirm_username |
| `frontend-v3/src/router.ts:81-96` | /admin 路由守卫 requiresAdmin |
| `frontend-v3/src/views/AdminView.vue` | 用户管理 UI |
| `frontend-v3/src/components/PasswordResetDialog.vue` | 密码重置弹窗 |

## STRIDE 矩阵

| 威胁类别 | 检查项 | 结论 |
|---------|--------|------|
| **Spoofing** | 伪造身份绕过 require_admin | PASS — 所有 admin 端点用 `Depends(require_admin)`，非 admin 得 403 |
| **Spoofing** | API key 用户调 delete_self | INFO — `require_auth` 接受 API key，API key 用户可删自己账户（现有行为，非 T080 引入；LastAdmin 保护仍生效） |
| **Tampering** | 篡改 is_active/is_admin 绕过保护 | PASS — 所有状态变更走 service 层 helper，无 mass assignment（DisableUserRequest 只有 reason 字段） |
| **Tampering** | _check_last_active_admin 绕过 | **ISSUE-1** — helper 检查条件与设计不符（见下） |
| **Repudiation** | 操作审计完整性 | PASS — disabled_at/disabled_by/disabled_reason 审计字段记录完整；CLI disabled_by=None 标记非交互操作 |
| **Information Disclosure** | password_hash 泄露 | PASS — UserResponse 不含 password_hash |
| **Information Disclosure** | reset-password 返回明文密码 | INFO — 现有行为（非 T080 引入），admin 提供密码后端返回明文；属设计选择但敏感数据在 HTTP 响应中传输 |
| **Information Disclosure** | 用户存在性枚举 | PASS — admin 端点 require_admin，list_users 已暴露全部用户 ID，toggle 端点 NotFound 不增加信息泄露 |
| **Denial of Service** | admin 端点无 rate limit | INFO — 与现有 stats/cleanup 一致；被窃取 admin token 可批量操作但非 T080 新增风险 |
| **Elevation of Privilege** | 非 admin 提权到 admin | PASS — promote 端点 require_admin，非 admin 无法调 promote |
| **Elevation of Privilege** | 被禁用 admin 重新启用自己 | PASS — 被禁用用户 is_active=False，get_current_user 返回 None，无法认证，无法访问 admin 端点 |

## 严重性分级

### ISSUE-1: _check_last_active_admin 检查条件与设计不符 — MEDIUM

**位置**: `backend/peekview/services/admin_service.py:349`

**描述**: 设计规范（P2-design.md:237）要求 _check_last_active_admin 仅在 `target is_admin=True AND is_active=True` 时触发保护。实现代码只检查 `if user.is_admin:`，遗漏了 `AND is_active` 条件。

```python
# 实现（:349）
if user.is_admin:                    # 缺少 and user.is_active
    count = ...
    if count <= 1:
        raise LastAdminError(...)

# 设计要求
if user.is_admin and user.is_active:  # 两者都为 True 才检查
    count = ...
```

**影响**: 当目标是已禁用的 admin（is_admin=True, is_active=False）时，保护错误触发。场景：2 个 admin（A 活跃、B 已禁用），管理员尝试 delete/demote B 会被拒绝（因活跃 admin count=1 <= 1），但删除/降级 B 不影响活跃 admin 数量。这是过度限制（over-restriction），非安全漏洞（不是 under-protection），但导致运维问题——已禁用 admin 无法被清理。

**修复方向**: `if user.is_admin and user.is_active:`

**不阻塞发布理由**: 这是 over-protection（保护过严），不会导致 last admin 被删的安全事故。但应在 P5 或后续修复中纠正，因为它阻碍正常的 admin 账户生命周期管理（禁用→删除路径被堵）。

### ISSUE-2: delete_user 未清理 disabled_by 外键引用 — MEDIUM

**位置**: `backend/peekview/services/admin_service.py:448-470`

**描述**: `disabled_by` 是指向 `users.id` 的外键（models.py:110），未设 `ondelete="SET NULL"`。database.py:31 强制 `foreign_keys=ON`。当 admin A 禁用过其他用户（A 的 id 写入那些用户的 disabled_by），随后删除 A 时，外键约束会导致删除失败（IntegrityError）。`delete_user` 方法未在删除前清理 disabled_by 引用，也未 catch IntegrityError。

**影响**: 删除一个曾禁用过其他用户的管理员会因外键约束失败，返回 500 INTERNAL_ERROR。这是生产环境可达的 bug。

**修复方向**:
1. 删除用户前清理：`UPDATE users SET disabled_by=NULL WHERE disabled_by=:uid`
2. 或在 model 上设 `ondelete="SET NULL"`（需 migration，对存量数据无效除非重建）
3. 方案 1 更安全（即时生效，不依赖 migration）

**不阻塞发布理由**: 需特定操作序列（admin 禁用过用户→该 admin 被删除）才触发。但应在 P5 或后续修复中处理。

### ISSUE-3: client.py delete_self 残留 confirm_username 旁路 — LOW

**位置**: `backend/peekview/client.py:403-407`

**描述**: 后端 delete_self 已移除 confirm_username 参数（决策 A），但 Python 客户端 `PeekClient.delete_self()` 仍接受 `confirm_username` 参数并作为 query param 发送。服务端忽略该参数（FastAPI 不声明就不接收），参数变成死代码。同时 client.py:420 检查 `detail.get("code") == "last_admin"`（小写 snake_case），但实际 error_code 是 `"LAST_ADMIN"`（大写），此分支永不匹配。

**影响**: 无安全风险。功能影响：CLI/API 客户端用户传 confirm_username 会被静默忽略（服务端已绝对拒绝 last admin 自删）。409 错误处理走 fallback 路径（`raise PeekError(message)`），功能正常但丢失了 `last_admin:` 前缀标记。

**修复方向**: 移除 client.py delete_self 的 confirm_username 参数 + 修正 code 匹配为 `"LAST_ADMIN"`。或标注为 follow-up cleanup。

### ISSUE-4: delete_self TOCTOU（双 Session 间隙） — LOW

**位置**: `backend/peekview/api/auth.py:239-251`

**描述**: delete_self 在 Session A 中做 admin count 检查（:242-249），关闭 Session A 后调 `admin_service.delete_user()`（:251），后者在 Session B 中再做一次 `_check_last_active_admin` 检查（:450）。两个检查之间有时间窗口。理论上，并发请求可能在 Session A 检查通过后、Session B 检查前插入新 admin（使 count 从 1→2），但 delete_user 的 Session B 检查会重新 count（此时 count=2，允许删除），这不是安全问题。反向竞态（count 在间隙中从 2→1，如另一请求禁用了另一个 admin）也不会导致问题——Session B 检查会拒绝。

**影响**: 无实际安全风险。SQLite WAL + 单进程 + 管理操作低并发，竞态窗口极小。且 delete_user 内部有第二次检查兜底。

**修复方向**: 无需修复，记录为已知低风险。

### ISSUE-5: reset-password 端点返回明文密码 — LOW（现有行为）

**位置**: `backend/peekview/api/admin.py:112-115`

**描述**: `reset_user_password` 端点接收 admin 提供的新密码，哈希存储后返回明文密码 `{"new_password": new_password}`。这是现有行为（非 T080 引入），但敏感数据在 HTTP 响应中传输。如果 admin 通过不安全网络访问 API，明文密码可能被中间人截获。

**影响**: 密码在响应体中明文返回。设计上是为了让 admin 知道设置的密码（可告知用户），但更安全的做法是 admin 只输入密码不返回（或返回临时密码仅一次）。

**修复方向**: Follow-up 改进——返回 `{"success": true}` 而非明文密码。非 T080 范围。

## 各审计重点结论

### 1. 决策 A（移除 confirm_username 旁路）是否彻底

**结论**: 后端彻底移除。`api/auth.py:231-251` 的 delete_self 不再接受 confirm_username 参数，改为绝对拒绝最后一个活跃 admin（`count <= 1 → 409`）。无其他旁路。

**残留**: `client.py:403-407` 仍接受 confirm_username 参数（死代码，服务端忽略），属 ISSUE-3。

### 2. 决策 B（admin 计数 is_active）是否有 TOCTOU

**结论**: 无实际 TOCTOU 风险。`_check_last_active_admin` 和 `delete_self` 都在同一 Session 内执行 count + 后续操作（disable/demote 的 check 和 modify 在同一 `with Session` 块内）。delete_self 跨 Session 但有双重检查兜底（ISSUE-4，LOW）。

### 3. LastAdmin 保护是否可绕过

**结论**: 不可绕过。所有 admin 破坏性操作路径（disable/demote/delete API + CLI demote/disable/delete-local）都有 LastAdmin 检查：
- API disable/demote: `_check_last_active_admin` in service（:360/:428）
- API delete: `_check_last_active_admin` in service（:450）
- delete_self: auth.py:248 count check + delete_user:450 双重检查
- CLI demote: cli.py:1620-1628 count check
- CLI disable: cli.py:1654-1662 count check
- CLI delete-local: 调 `admin_svc.delete_user()` → 走 service :450 检查

**注意**: ISSUE-1 的检查条件偏差是 over-protection（保护过严），不是绕过。

### 4. 禁用用户 JWT 软失效是否可靠

**结论**: 可靠。`get_current_user`（auth.py:177）每请求查库验 `user.is_active`，False 时返回 None → require_auth 返回 401。API key 验证（apikey_service.py:198）同样检查 `user.is_active`。禁用后 JWT 和 API key 即时失效，无需黑名单。

### 5. 输入验证

**结论**: 充分。
- `user_id: int` — FastAPI 自动验证类型，负数/0 走 session.get → None → NotFoundError
- `DisableUserRequest.reason` — max_length=500 约束
- `ResetPasswordRequest.new_password` — min_length=8, max_length=72（bcrypt 限制）
- `list_users` 的 page/per_page — Query(ge=1) / Query(ge=1, le=100) 约束

### 6. 路径安全 / 注入

**结论**: 无风险。所有查询用 SQLModel/SQLAlchemy ORM（参数化），无原始 SQL 拼接。`disabled_reason` 前端不渲染（grep 确认无引用），无 XSS 面。

## 总结

| 级别 | 数量 | 是否阻塞 |
|------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 2 | 否（over-protection + 外键 dangling，均非安全漏洞） |
| LOW | 3 | 否 |

**最高严重级别**: MEDIUM
**各级问题数**: CRITICAL=0, HIGH=0, MEDIUM=2, LOW=3
**是否阻塞发布**: 否

**Status**: needs-revision

**理由**: 无 CRITICAL 或 HIGH 安全漏洞。2 个 MEDIUM 问题（ISSUE-1 _check_last_active_admin 检查条件偏差、ISSUE-2 delete_user 未清理 disabled_by 外键）是非安全漏洞的代码缺陷，但影响 admin 账户生命周期的正常运维。建议在 P5 修复 ISSUE-1 和 ISSUE-2 后再推进 P6 验收，避免 BDD 测试遗漏这些边界场景。ISSUE-3/4/5 可作为 follow-up cleanup。

## [PROD_NOT_TOUCHED]

全程只读代码 + 写产出文件，未启动服务、未写实现代码、未触碰 :8080 / ~/.peekview/。
