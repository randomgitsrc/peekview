# infra-improvements-from-t080-v2.md 评审

> 评审对象：`docs/plans/infra-improvements-from-t080-v2.md`（v2，含新增 F 项）
> 评审者：主 Agent（orchestrator）
> 日期：2026-08-06
> 方式：逐项核实源码 + 运行时验证

## 评审结论

**状态：needs-revision**

v2 继承 v1 的 A/B/C/E/G 五项（均 v1 approved，原样继承，无需重审）。**新增 F 项有一个真实的重跑崩溃 bug**，必须修订后方可实施。

## A/B/C/E/G（继承 v1，已 approved）

不重审。v1 评审记录完整（v1 → needs-revision → 修订 → v1 复审 approved）。v2 对这五项未做任何改动，逐字继承。A/C/E/G 的非阻塞建议（import 模块级、多 PID 注释、双版本限制）均已采纳。

**仅核实验证命令仍有效**：A/B/C/E 验证命令引用的代码路径未变，G 验证用 `python3`（sync_versions.py 仅标准库，不受 hermes venv 影响）——均成立。

## F 项（v2 新增，seed-data 用户/权限维度补充）

### 机理核实（准确）

- `auth.py:87` `is_admin=is_first_user`——alice 首用户 auto-admin，**确认**。v2 修正了"seed 无 admin"的认知错误，正确。
- `auth.py:149` login 检查 `not user.is_active`——disabled 用户无法 login，**确认**。
- `seed-debug.py:68-74` `register()` 现状：login 失败后 register，register 失败 `raise_for_status()`——重跑 disabled 用户会崩，**确认**。
- `admin_service.disable_user()`（第 358-375 行）：不检查 `is_active`，直接设 `is_active=False` + 重写 `disabled_at`——不幂等但不报错，**确认**。v2 说法准确。
- disable 端点 `POST /users/{id}/disable` 接受 `reason` body，**确认**（admin.py:63-72）。

### 方案问题（必须修订）

#### BLOCKER：idempotency_key 重跑冲突

**机理**：`entry_service.py:150-154`：
```python
if idempotency_key:
    existing = self._find_by_idempotency_key(idempotency_key)
    if existing:
        if existing.owner_id != current_user_id:
            raise ConflictError("idempotency_key already used by another user")
        return existing, True
```

`seed-debug.py:140`：`token = tokens.get(owner, alice)`——重跑时 dave=None（disabled 无法 login），fallback 到 alice token。此时调 `create_entry`：
- `idempotency_key="seed-Dave 的私有笔记"` 已存在（首次用 dave token 创建，owner=dave）
- `existing.owner_id`(dave) != `current_user_id`(alice) → **ConflictError（409）**
- `create_entry` 第 121 行 `r.raise_for_status()` 抛异常 → **seed 崩溃**

v2 验证方案第 3 步"重跑 seed 不崩溃"不成立。这是 F 项方案的真实 bug。

**修复方向**（择一）：

1. **`create_entry` 容错 409**（推荐）：`create_entry` 返回 `dict | None`（v2 已声明返回类型），把 `r.raise_for_status()` 改为：409 时返回 None（entry 已存在，跳过），其他错误仍 raise。main 循环已有 `if result is None` 的处理空间（第 148 行后）。
2. **重跑时不 fallback 到 alice**：dave=None 时跳过 dave 的 entry 创建（`if token is None: continue`），因 entry 已存在无需重建。但这要求 main 循环在 token=None 时跳过——与方案 1 互补。

推荐方案 1 + 2 结合：`create_entry` 容错 409（不崩）+ main 循环 dave=None 时跳过 dave entry（不无谓尝试）。

#### 次要：admin-private-config 的 owner=alice 但用 alice token 创建

`admin-private-config` 的 `owner=alice`，首次跑用 alice token 创建（owner=alice），重跑用 alice token——`existing.owner_id`(alice) == `current_user_id`(alice)，不冲突。**无问题**。

但要注意：alice 是 admin，admin 私有 entry 验证的是"admin 私有对其他 admin 可见、对普通用户 404"。seed 只是创建数据，权限边界验证在 E2E/手动测试时做——v2 验证方案第 4 步（bob token 查 admin-private-config → 404）正确。

### F 验证方案问题

- 第 3 步"重跑 seed 不崩溃"——**因上述 BLOCKER 不成立**，修复后需重验。
- 第 1-2 步（首次 seed、验证 dave disabled + entry 存在）——成立。
- 第 4 步（权限边界）——成立，但需 admin-private-config entry 真的创建成功（依赖 BLOCKER 修复）。

### F 项其他确认

- dave 的 entry 必须在 disable 之前创建（v2 设计要点 2）——**正确**，disabled 用户无法 login 获 token。
- disable dave 在 entry 循环之后（v2 设计要点 3）——**正确**。
- `_check_last_active_admin` 不阻止 disable 非 admin 用户（dave 非 admin）——**确认**，disable dave 安全。
- `_check_self_operation` 不阻止 alice disable dave（不同用户）——**确认**。

## 修订建议

F 项必须修订：

1. **`create_entry` 容错 409**：`r.raise_for_status()` → 409 时返回 None（entry 已存在），其他非 2xx 仍 raise。让重跑幂等。
2. **main 循环 token=None 时跳过该 entry**（可选优化，减少无谓 409 请求）：`if token is None: print(f"  SKIP {slug}: owner disabled (rerun)"); continue`。
3. **F 验证第 3 步**：修复后重验"重跑 seed 不崩溃"，期望输出"SKIP dave entries: owner disabled"或"SKIP (409 idempotency)"。

A/B/C/E/G 无需改动，原样保留。

## 总结

v2 的 F 项价值成立（补齐 seed 用户/权限维度，修正 alice=admin 认知），但 `idempotency_key` 重跑冲突是真实 bug，会导致 v2 承诺的"幂等重跑"不成立。修订 `create_entry` 容错 409 后即可实施。
