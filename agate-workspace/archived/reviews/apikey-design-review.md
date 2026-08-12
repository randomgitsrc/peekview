# API Key 设计文档 专家评审

> 评审日期: 2026-05-17
> 评审对象: `docs/plans/impl-plan-apikey.md` v1.0

---

## 严重问题 (P0 — 必须修复)

### 1. 全局 API Key 中间件会拦截用户级 API Key 请求

**问题**: 当 `PEEKVIEW_SERVER__API_KEY` 已配置时，全局 API Key 中间件（`main.py:104-135`）会**先于** `get_current_user` 执行。中间件逻辑是：不匹配 master key → 返回 401。

用户级 API Key（`pv_...`）显然不等于 master key，所以请求会在中间件层直接被 401 拒绝，**永远到不了 `get_current_user`**。

设计文档声称"无需修改 `main.py` 中间件代码"，这是**错误的**。

**修复方案**: 全局 API Key 中间件必须放行 `pv_` 前缀的 key：

```python
# main.py 中间件增加：
if x_api_key.startswith("pv_"):
    return await call_next(request)  # 放行，交给 get_current_user 处理

auth_header = request.headers.get("Authorization", "")
if auth_header.startswith("Bearer "):
    token = auth_header[7:]
    if token.startswith("pv_"):
        return await call_next(request)  # 放行
```

**影响**: 不修这个，用户级 API Key 在任何配置了 `PEEKVIEW_SERVER__API_KEY` 的部署中完全不可用。这是一个致命缺陷。

---

### 2. 用户级 API Key 的删除权限过于宽泛

**问题**: 当前设计说"API Key 等同于该用户操作"，但 `entry_service.delete_entry_by_api_key` 绕过**所有**所有权检查 — 任何 API Key 可以删除任何条目。

用户级 API Key 绑定了具体用户，它的删除权限应该与该用户的 JWT 权限一致，而不是等同于全局 master key。

**修复方案**: 用户级 API Key 请求现在有 `current_user`，应走正常的 `delete_entry` 权限检查，不再走 `delete_entry_by_api_key` 绕过路径：

```python
# entries.py delete_entry:
api_key_auth = _is_api_key_auth(request)
user_level_key = api_key_auth and current_user is not None  # 用户级 key
global_key = api_key_auth and current_user is None           # 全局 key

if global_key:
    return service.delete_entry_by_api_key(slug)  # 全局 key：绕过权限
else:
    return service.delete_entry(slug, current_user_id=..., is_admin=...)  # 走正常权限
```

同理，`update_entry` 也应走正常权限路径。

**影响**: 不修这个，任何用户的 API Key 都能删除其他用户的条目 — 这是权限提升漏洞。

---

### 3. `_is_api_key_auth` 逻辑冲突

**问题**: `entries.py` 中的 `_is_api_key_auth()` 当前判断方式是"有 `X-API-Key` 或 `Authorization: Bearer <非JWT>`"。用户级 API Key 请求经过 `get_current_user` 后会返回 `current_user`（不是 None），这导致 `_is_api_key_auth=True` + `current_user 有值` 的组合在 `delete_entry` 中的逻辑分支混乱：

```python
# 当前逻辑:
api_key_auth = _is_api_key_auth(request)  # True（因为确实用了 API Key header）
allow_local = not api_key_auth and no_server_auth and current_user is None  # False
service.delete_entry(slug, is_api_key_auth=True, ...)  # → delete_entry_by_api_key 绕过权限!
```

**修复方案**: 需要区分两种 API Key 认证：

| 场景 | `is_api_key_auth` | `current_user` | 行为 |
|------|-------------------|----------------|------|
| 全局 master key | True | None | 绕过权限（`delete_entry_by_api_key`） |
| 用户级 API Key | True | User 对象 | 走正常权限（同 JWT） |
| JWT | False | User 对象 | 走正常权限 |
| 匿名 | False | None | 不可操作 |

或者更简洁：用户级 API Key 直接视为 JWT 等价，`is_api_key_auth=False`，因为已经有 `current_user` 了。

---

## 重要问题 (P1 — 应该修复)

### 4. 过期 API Key 残留未清理

**问题**: 过期 key 只是验证时返回 None，但数据仍然留在 `api_keys` 表中。随着时间推移，过期 key 会不断堆积，每用户的 key 计数上限（10 个）可能被过期 key 占满，导致无法创建新 key。

**修复方案**:
- 方案 A: 创建时检查活跃 key 数量（不含已过期），而非总数
- 方案 B: 提供清理过期 key 的功能（CLI 命令或自动定时清理）
- 推荐：A + B 结合，创建时只计活跃 key，同时可选清理

### 5. `last_used_at` 更新在每次请求中写 DB

**问题**: `_verify_api_key` 在验证成功后 `session.commit()` 更新 `last_used_at`。这意味着**每个** API Key 请求都额外有一次 DB 写操作。对于高频使用的 Agent，这会增加 SQLite 写压力（SQLite 写是串行的）。

**修复方案**:
- 方案 A: 限流更新 — 每隔 N 分钟更新一次（如距上次更新 >5 分钟才写）
- 方案 B: 后台定期批量更新（异步写）
- 推荐：A 更简单可靠

```python
if api_key.last_used_at is None or (now - api_key.last_used_at).total_seconds() > 300:
    api_key.last_used_at = now
    session.commit()
```

### 6. Key 前缀 `key_prefix` 长度可能不足

**问题**: 设计写 `key_prefix VARCHAR(8)`，但 `pv_` 已占 3 字符，实际只留 5 字符给 key 本体。当用户有多个 key 时，前 5 字符可能重复（如 `pv_k8Xa2` vs `pv_k8Xa9` → 前 8 字符都是 `pv_k8Xa2`）。

对于**辨识**目的，8 字符前缀是够的（展示 `pv_k8Xa...`）。但确认字段定义与实际使用一致即可。`token_urlsafe(24)` 产生约 32 字符，前缀取前 8 字符 `pv_` + 5 字符随机，碰撞概率可以接受。

**结论**: 不是 bug，但建议在文档中明确说明 `key_prefix` 是展示用途，不用于查找（查找走 hash）。

### 7. `name` 字段缺少唯一性约束

**问题**: 同一用户可以创建多个同名 key（如两个都叫 "CI Bot"）。虽然不是安全问题，但会导致用户管理混乱。

**修复方案**: 添加联合唯一约束 `(user_id, name)`，或至少在创建时检查同名并返回友好错误。

```sql
CREATE UNIQUE INDEX idx_api_keys_user_name ON api_keys(user_id, name);
```

### 8. SHA-256 哈希缺少盐值

**问题**: `SHA-256(key)` 无盐。如果 DB 泄露，攻击者可以预计算常见 key 的彩虹表。虽然 API Key 是高熵随机值（32 字节），彩虹表攻击几乎不可行，但加盐是零成本的最佳实践。

**修复方案**: 使用 HMAC-SHA256 或简单加固定盐：

```python
import hmac
key_hash = hmac.new(b"peekview-api-key", key.encode(), "sha256").hexdigest()
```

这样即使 DB 泄露 + 攻击者有预计算表，也无法反推。

### 9. `ApiKeyBase` 与 `ApiKey` 模型字段重复

**问题**: `ApiKeyBase` 定义了 `name` 和 `expires_at`，`ApiKey(table=True)` 继承后又重新定义了 `expires_at`（因为需要 `default=None` 覆盖）。SQLModel 继承中字段覆盖容易出错。

**修复方案**: `ApiKeyBase` 只保留 `name`，`expires_at` 只在 `ApiKey` 表模型和 Schema 中定义。

---

## 建议改进 (P2 — 可选)

### 10. API Key 端点路径

当前设计用 `/api/v1/apikeys`，建议改为 `/api/v1/users/me/apikeys` 或至少在文档中说明为什么选择扁平路径。

扁平路径更简单，对于当前规模够用。标记为建议。

### 11. CLI `apikey list` 应显示远程 key

当前 CLI `apikey list` 可能只列本地配置中的 key。需要明确：远程模式下调用 API 列出服务端 key，本地模式无意义（key 存在服务端）。

### 12. 前端创建 key 后的 UX

设计说"创建成功弹窗显示完整 key"。建议：
- 添加"复制到剪贴板"按钮
- 添加"我已保存"确认按钮，点击前不能关闭弹窗
- 关闭后 key 无法再查看

### 13. All/Mine 筛选：`owner=me` 与其他筛选组合

当前设计中 `owner="me"` 似乎会覆盖原有的可见性逻辑。需要明确：
- `owner=me` + `tags=python` → 我的 + 标签 python
- `owner=me` + 匿名 → 返回空还是忽略 owner 参数？
- admin 用 `owner=me` → 看到的是自己的还是全部？

建议：`owner=me` 只是在可见性基础上加 `AND owner_id=user_id`，不替换原有逻辑。

### 14. 缺少 API Key 的 `created_by` 审计信息

当前设计无法追溯"谁创建了哪个 key"。对于 admin 管理场景，可能需要知道某个 key 是用户自己创建还是 admin 代创建的。当前规模可忽略。

### 15. 全局 API Key 中间件也应放行 JWT

当前中间件已经通过 `len(token.split(".")) != 3` 判断 JWT 并放行。但这依赖 JWT 格式特征（3 段 base64），不够健壮。如果未来 JWT 格式变化，可能误拦截。

这属于现有问题，不在本次 API Key 变更范围内，但值得记录。

---

## 评审结论

| 级别 | 数量 | 说明 |
|------|------|------|
| P0 致命 | 3 | 不修复则核心功能不可用或存在安全漏洞 |
| P1 重要 | 6 | 不修复则存在功能缺陷或运维问题 |
| P2 建议 | 6 | 改进体验和健壮性 |

**必须修复的 P0 问题**：

1. **全局 API Key 中间件拦截** — 必须放行 `pv_` 前缀的请求，否则用户级 API Key 在任何有全局 key 的部署中不可用
2. **用户级 API Key 删除权限过宽** — 绑定了用户的 key 不应绕过所有权检查
3. **`_is_api_key_auth` 逻辑冲突** — 需要区分全局 key（无用户）和用户级 key（有用户），或直接将用户级 key 等同于 JWT

**建议**: 修复 P0 后再进入实现阶段。P1 中 #4（过期 key 占位）和 #5（last_used_at 写频率）也建议一并处理。
