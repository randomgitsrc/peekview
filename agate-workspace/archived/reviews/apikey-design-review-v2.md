# API Key 设计文档 二轮专家评审

> 评审日期: 2026-05-17
> 评审对象: `docs/plans/impl-plan-apikey.md` v1.1
> 前次评审: `docs/reviews/apikey-design-review.md`（P0×3, P1×6, P2×6）

---

## 前次评审修复确认

| 编号 | 问题 | 修复状态 | 验证 |
|------|------|----------|------|
| P0-1 | 全局中间件拦截 pv_ key | ✅ 已修复 | Step 5 明确写了中间件放行逻辑，代码示例正确 |
| P0-2 | 用户级 key 删除权限过宽 | ✅ 已修复 | 认证矩阵明确"同 JWT"，delete_entry 逻辑正确分支 |
| P0-3 | _is_api_key_auth 逻辑冲突 | ✅ 已修复 | `_is_global_api_key_auth` 语义清晰，依赖 current_user 判断 |
| P1-4 | 过期 key 占位 | ✅ 已修复 | `count_active_keys` + 清理端点 + 上限只计活跃 key |
| P1-5 | last_used_at 写频率 | ✅ 已修复 | 5 分钟限流更新 |
| P1-6 | key_prefix 文档 | ✅ 已修复 | 数据模型注释明确"展示用途，不用于查找" |
| P1-7 | name 唯一性 | ✅ 已修复 | `UNIQUE(user_id, name)` 索引 |
| P1-8 | SHA-256 无盐 | ✅ 已修复 | HMAC-SHA256 |
| P1-9 | ApiKeyBase 继承问题 | ✅ 已修复 | 不使用 Base 继承，字段直接定义 |

**结论**: 前次 9 个问题全部修复，修复方案合理。

---

## 新发现的问题

### P1-10: 中间件未启用时，无凭证 + 全局 key 不存在时的请求路径不完整

**问题**: 流程图中写了"④ 其他 → 401"，但这仅当 `PEEKVIEW_SERVER__API_KEY` 已配置时中间件才存在。如果**未配置**全局 API Key，中间件根本不注册，所有请求直接到达 `get_current_user`。

这种情况下：
- 无凭证 + 未配置全局 key → `get_current_user` 返回 None → 匿名访问
- 这是正确行为，但流程图只展示了中间件存在的场景

**影响**: 不是 bug，行为正确。建议在流程图中补充"中间件未启用"的分支说明。

### P1-11: `hmac.new` 应为 `hmac.new` → 实际应为 `hmac.HMAC` 或 `hmac.new`

**问题**: 文档中写 `hmac.new(API_KEY_HMAC_KEY, key.encode(), "sha256").hexdigest()`。Python 的 `hmac` 模块中是 `hmac.new()`，这是正确的。确认无问题。

但 `_hash_api_key` 定义在 `auth.py`，`apikey_service.py` 也需要用它（创建 key 时计算 hash）。需要确保 hash 函数只定义一次，两处共享。

**修复方案**: 在 `auth.py` 中定义 `_hash_api_key`，`apikey_service.py` 通过 import 使用；或者提取到共享位置。

**影响**: 不处理会导致 hash 函数重复定义，维护风险。

### P1-12: `update_entry` 走全局 key 绕过路径时无对应方法

**问题**: `delete_entry` 有 `delete_entry_by_api_key` 绕过方法，但 `update_entry` 没有类似的 `update_entry_by_api_key`。当前 `update_entry` 的 `is_api_key_auth` 路径只是跳过权限检查。

文档第 329 行说"全局 key 走 `delete_entry_by_api_key` 等绕过路径"，但 `update_entry` 实际走的是 `service.update_entry(is_api_key_auth=True)` 跳过 owner 检查。

**修复方案**: 统一表述。全局 key 对 update 的处理：
- 方案 A: 新增 `update_entry_by_api_key` 方法（与 delete 对称）
- 方案 B: 在 `update_entry` 中保留 `is_api_key_auth` 参数跳过权限（现有代码已支持）

推荐 B — 不增加方法，但文档中明确说明 update 不像 delete 那样走独立方法，而是通过参数控制。

**影响**: 文档表述不够精确，可能导致实现时困惑。

### P1-13: 过期 key 验证失败后未清理 — 安全审计角度

**问题**: 过期 key 验证返回 None（认证失败），但 key 记录仍存在。如果攻击者获取了一个过期 key，虽然无法使用，但每次尝试都会触发一次 DB 查询（`WHERE key_hash = ...`）。

这不算真正的安全风险（已过期就是无效的），但从审计角度，可以考虑在验证失败时记录日志（用于监控异常访问模式）。

**修复方案**: 在 `_verify_api_key` 中，过期时记录 warning 日志：

```python
if api_key.expires_at and api_key.expires_at < now:
    logger.warning("Expired API key used: prefix=%s, user_id=%s", api_key.key_prefix, api_key.user_id)
    return None
```

**影响**: 低优先级，有助于运维监控。

### P2-10: `owner=me` 时 count 查询可能未同步更新

**问题**: `entry_service.list_entries` 中 count 查询也需要应用 `owner=me` 条件。文档中只在 `query` 上添加了 `.where(Entry.owner_id == current_user_id)`，但 count 查询是否独立构建？如果是，需要同步添加条件。

查看现有代码，count 和 data 查询共用 base query，所以 `owner=me` 条件会自动应用到 count。确认无问题，但建议在文档中明确说明。

### P2-11: `allow_anonymous_create=False` 与全局 API Key 的交互

**问题**: 当 `allow_anonymous_create=False` 时，用全局 API Key 创建条目的请求 `current_user=None`。按文档逻辑：

```python
if current_user is None and not request.app.state.config.auth.allow_anonymous_create:
    raise AuthenticationError("Authentication required to create entries")
```

全局 API Key 请求的 `current_user=None`，所以会被拦截。但全局 key 是运维 master key，应该始终能创建条目。

**修复方案**: 匿名创建检查应区分"无凭证的匿名"和"全局 API Key 认证但无用户"：

```python
global_key_auth = _is_global_api_key_auth(request, current_user)
if current_user is None and not global_key_auth and not allow_anonymous_create:
    raise AuthenticationError("Authentication required to create entries")
```

**影响**: 这是一个真正的 bug — `allow_anonymous_create=False` 会误拦截全局 master key 的创建请求。

**升级为 P1**。

### P2-12: `DELETE /api/v1/apikeys/expired` 路由冲突

**问题**: `DELETE /api/v1/apikeys/expired` 和 `DELETE /api/v1/apikeys/{id}` 可能冲突。FastAPI 路由匹配是按注册顺序的，如果 `{id}` 路由先注册，`expired` 会被当作 id 参数匹配。

**修复方案**: 
- 方案 A: 确保 `expired` 路由在 `{id}` 路由之前注册
- 方案 B: 改用 `POST /api/v1/apikeys/cleanup` 
- 推荐：A 更简单，FastAPI 文档也建议固定路径在参数路径之前

**影响**: 实现时如果注册顺序不对，`expired` 会 404 或被当作 key id 解析（但 "expired" 不是 int，会 422）。问题不大但需要注意。

### P2-13: 全局 key 中间件也需放行 `/api/v1/apikeys` 端点

**问题**: 当 `PEEKVIEW_SERVER__API_KEY` 配置时，全局 API Key 中间件会拦截 `/api/v1/apikeys` 端点的请求。用户级 API Key 请求已经通过 `pv_` 前缀放行，但**用 JWT 访问 apikeys 端点**的情况呢？

JWT 请求的 `Authorization: Bearer eyJ...` 通过中间件时：
1. `X-API-Key` 为空 → 不匹配
2. `Authorization: Bearer eyJ...` → `token.split(".")` 有 3 段 → 跳过

所以 JWT 请求能通过中间件。确认无问题。

但如果用户同时发送 `X-API-Key: pv_...` 和 JWT，会走哪个？按 `get_current_user` 逻辑，JWT 优先（步骤 1 先检查 JWT）。确认行为合理。

---

## 二轮评审结论

| 级别 | 数量 | 说明 |
|------|------|------|
| P1 重要 | 2 | 需要修复（#11 全局 key 误拦截，#12 hash 函数共享） |
| P1 文档精确 | 1 | #12 update_entry 表述需明确 |
| P2 建议 | 3 | 实现时注意即可 |

### 必须修复

**P1-11: `allow_anonymous_create=False` 会误拦截全局 master key**

这是新发现的实际 bug。全局 key 请求 `current_user=None`，如果 `allow_anonymous_create=False`，创建条目会被拒绝。但全局 key 是运维 master key，应该始终有权限。

修复：检查时排除全局 key 认证：

```python
global_key_auth = _is_global_api_key_auth(request, current_user)
if current_user is None and not global_key_auth and not allow_anonymous_create:
    raise AuthenticationError("Authentication required to create entries")
```

**P1-12: `_hash_api_key` 需要共享定义**

`auth.py` 和 `apikey_service.py` 都需要 hash 函数，应在 `auth.py` 定义并 export，`apikey_service` import 使用。

### 实现时注意

- `DELETE /apikeys/expired` 路由必须在 `DELETE /apikeys/{id}` 之前注册
- `update_entry` 全局 key 走 `is_api_key_auth` 参数控制，不是独立方法（文档需明确）
- 过期 key 验证失败时建议记录 warning 日志

---

## 总评

v1.1 修复了 v1.0 的全部 3 个致命问题和 6 个重要问题，设计方案已经比较成熟。二轮发现 2 个新的 P1（一个实际 bug，一个代码组织问题）和几个 P2 注意项。修复 P1-11 后可以进入实现阶段。
