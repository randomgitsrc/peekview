# PeekView API Key 管理 实现计划

> 版本: 1.2（修订：整合二轮评审 P1 修复）
> 日期: 2026-05-17
> 前置: 管理员角色 (impl-plan-admin-role.md) 已完成
> 关联: All/Mine 筛选（本文档包含后端 `?owner=me` 部分）
> 评审: `docs/reviews/apikey-design-review.md`

---

## 背景

PeekView 是 "Agent 创建内容 → 人类浏览" 的系统。当前认证方式有两种：

1. **JWT（前端）**：用户名密码登录 → 浏览器使用 → 7 天过期
2. **全局 API Key（`PEEKVIEW_SERVER__API_KEY` 环境变量）**：CLI/Agent 使用 → 不绑定用户 → 全权限

**问题**：

- 全局 API Key 不绑定用户，用 key 创建的条目 `owner_id=NULL`，无法归属到具体用户
- 无法为不同 Agent 分配不同 key（一个 key 全局共享）
- 无法为 key 设置过期时间
- 无法在前端管理 key（创建/查看/撤销）
- 匿名创建无法控制（内部网络可接受，公开部署有风险）

**目标**：实现用户级 API Key 管理，遵循 GitHub/GitLab 标准模式：

- 前端用户名密码登录 → 创建 API Key → key 绑定用户
- Agent/CLI 用 key 创建的内容归属到 key 绑定的用户
- key 可设过期时间，可随时撤销
- 保留全局 API Key 作为 master key（向后兼容）

---

## 设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| Key 存储 | `api_keys` 表，存 `key_hash`（HMAC-SHA256） | 不存明文，加盐防 DB 泄露反推 |
| Key 格式 | `pv_` 前缀 + 32 字节 base62（如 `pv_k8Xa2mN9bQ4w...`） | 可辨识来源，防止与 JWT 混淆 |
| Key 哈希 | HMAC-SHA256（固定盐 `peekview-api-key`） | 比裸 SHA-256 多一层防护，零额外成本 |
| Key 绑定 | `user_id FK`，key 等同于该用户 JWT 操作 | 简单直观，权限与 JWT 一致 |
| Key 名称 | 每个用户可创建多个 key，每个有 name 标识（同用户唯一） | 区分用途（如 "CI Bot"、"Claude Agent"） |
| Key 过期 | 可选 `expires_at`，`NULL` = 永不过期 | 灵活：临时 key + 长期 key |
| 全局 API Key | 保留 `PEEKVIEW_SERVER__API_KEY`，优先级最高 | 向后兼容，运维 master key |
| 匿名创建控制 | 新增 `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | 默认 True（内部网络），可设 False（公开部署） |
| Key 前缀 | `pv_` 前缀便于识别 key 类型 | 区别于 JWT 的 `eyJ` 开头 |
| 用户 key 上限 | 每用户最多 10 个**活跃** key（不含已过期） | 防止滥用，过期 key 不占位 |
| 用户级 key 权限 | 等同于 JWT，走正常所有权检查 | 不绕过权限，安全与 JWT 一致 |
| 全局 key 权限 | 绕过所有权检查（保持现有行为） | 运维 master key，不绑定用户 |

### 认证场景矩阵（评审 P0-2/P0-3 修复）

| 场景 | 认证方式 | `current_user` | 权限行为 |
|------|----------|----------------|----------|
| JWT 登录 | `Authorization: Bearer eyJ...` | User 对象 | 正常所有权检查 |
| 用户级 API Key | `X-API-Key: pv_...` | User 对象（绑定用户） | **同 JWT** — 正常所有权检查 |
| 全局 master key | `X-API-Key: <master>` | None | 绕过所有权检查（`delete_entry_by_api_key`） |
| 匿名 | 无凭证 | None | 不可操作（除只读 public） |

**关键原则**: 用户级 API Key 是 JWT 的等价替代 — 同一个用户，同样的权限。只有全局 master key 才绕过权限。

---

## 数据模型

### `api_keys` 表

```sql
CREATE TABLE api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(64) NOT NULL,           -- 用户自定义名称（同用户唯一）
    key_prefix  VARCHAR(8) NOT NULL,            -- 前 8 字符（展示用，如 "pv_k8Xa"），不用于查找
    key_hash    VARCHAR(64) NOT NULL UNIQUE,     -- HMAC-SHA256(plaintext)
    expires_at  DATETIME,                        -- NULL = 永不过期
    last_used_at DATETIME,                       -- 最后使用时间（限流更新）
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE UNIQUE INDEX idx_api_keys_user_name ON api_keys(user_id, name);  -- 同用户名称唯一
```

### SQLModel 定义

```python
class ApiKey(SQLModel, table=True):
    """API Key model — 绑定用户，权限等同于 JWT。"""
    __tablename__ = "api_keys"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="users.id", index=True)
    name: str = Field(..., min_length=1, max_length=64)
    key_prefix: str = Field(..., max_length=8, description="前 8 字符，展示用途，不用于查找")
    key_hash: str = Field(..., max_length=64, unique=True, description="HMAC-SHA256")
    expires_at: datetime | None = Field(default=None, description="NULL = 永不过期")
    last_used_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=now_utc, sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")})
    updated_at: datetime = Field(default_factory=now_utc, sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")})

    # Relationships
    user: User = Relationship(back_populates="api_keys")
```

> 注：不使用 `ApiKeyBase` 继承，避免 `expires_at` 字段覆盖问题（评审 P1-9）。所有字段直接在 `ApiKey` 上定义。

### Pydantic Schemas

```python
class ApiKeyCreate(SQLModel):
    """创建 key 请求"""
    name: str = Field(..., min_length=1, max_length=64)
    expires_in: str | None = Field(default=None, description="如 '30d', '1h', '6m'（复用 parse_expires_in）")

class ApiKeyResponse(SQLModel):
    """key 列表项（不含明文 key 和 key_hash）"""
    id: int
    name: str
    key_prefix: str
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime

class ApiKeyCreateResponse(SQLModel):
    """创建 key 响应（含完整明文 key，仅此一次返回）"""
    id: int
    name: str
    key: str                    # 完整明文 key，仅创建时返回
    key_prefix: str
    expires_at: datetime | None
    created_at: datetime
```

---

## 认证流程变更

### 当前流程

```
请求 → 全局 API Key 中间件 → JWT get_current_user → 业务逻辑
```

### 新流程

```
请求 → 全局 API Key 中间件（放行 pv_ 前缀）  ← 评审 P0-1 修复
     → get_current_user 增强：检测 pv_ key → 查 api_keys 表 → 返回绑定用户
     → 业务逻辑
```

### 全局 API Key 中间件变更（评审 P0-1 修复）

**必须修改 `main.py` 中间件**，放行 `pv_` 前缀的请求：

```python
# main.py 中间件增加（在检查 master key 之前）：
@app.middleware("http")
async def api_key_auth(request: Request, call_next):
    # Skip auth for health check, static files, auth endpoints (不变)
    ...

    # --- 新增：放行用户级 API Key（pv_ 前缀） ---
    x_api_key = request.headers.get("X-API-Key", "")
    if x_api_key.startswith("pv_"):
        return await call_next(request)  # 交给 get_current_user 处理

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if token.startswith("pv_"):
            return await call_next(request)  # 交给 get_current_user 处理
    # --- 新增结束 ---

    # 以下为原有逻辑：检查 master key
    if x_api_key == api_key:
        return await call_next(request)

    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if len(token.split(".")) != 3 and token == api_key:
            return await call_next(request)

    return JSONResponse(status_code=401, ...)
```

### `get_current_user` 增强逻辑

```python
def get_current_user(request: Request) -> User | None:
    auth_header = request.headers.get("Authorization", "")
    x_api_key = request.headers.get("X-API-Key", "")

    # 1. JWT 认证（优先级最高）
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if _looks_like_jwt(token):
            user = _verify_jwt(token, config)
            if user:
                return user

    # 2. 用户级 API Key（pv_ 前缀）
    key_value = x_api_key or (auth_header[7:] if auth_header.startswith("Bearer ") else "")
    if key_value and key_value.startswith("pv_"):
        user = _verify_api_key(key_value, engine)
        if user:
            return user

    return None
```

### API Key 验证流程

```python
API_KEY_HMAC_KEY = b"peekview-api-key"

def _hash_api_key(key: str) -> str:
    """HMAC-SHA256 hash of API key."""
    return hmac.new(API_KEY_HMAC_KEY, key.encode(), "sha256").hexdigest()

def _verify_api_key(key_value: str, engine: Engine) -> User | None:
    """验证用户级 API Key，返回绑定用户。"""
    key_hash = _hash_api_key(key_value)
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        api_key = session.exec(
            select(ApiKey).where(ApiKey.key_hash == key_hash)
        ).first()

        if api_key is None:
            return None

        # 检查过期
        if api_key.expires_at and api_key.expires_at < now:
            logger.warning("Expired API key used: prefix=%s, user_id=%s", api_key.key_prefix, api_key.user_id)
            return None

        # 检查绑定用户是否活跃
        user = session.exec(
            select(User).where(User.id == api_key.user_id)
        ).first()
        if user is None or not user.is_active:
            return None

        # 限流更新 last_used_at（距上次 >5 分钟才写，评审 P1-5）
        if api_key.last_used_at is None or (now - api_key.last_used_at).total_seconds() > 300:
            api_key.last_used_at = now
            session.add(api_key)
            session.commit()

        return user
```

### `_is_api_key_auth` 更新（评审 P0-3 修复）

**关键变更**: 用户级 API Key 请求有 `current_user`，应视为 JWT 等价。

```python
# entries.py — 更新 _is_api_key_auth 和调用逻辑

def _is_global_api_key_auth(request: Request, current_user: User | None) -> bool:
    """检查是否通过全局 master key 认证（无用户绑定）。

    只有全局 key 才返回 True — 它绕过所有权检查。
    用户级 API Key (pv_) 有 current_user，等同 JWT，返回 False。
    """
    if current_user is not None:
        return False  # 有用户 = JWT 或用户级 key，不走绕过路径

    # 无用户：检查是否用了 X-API-Key 或 Bearer (非JWT)
    x_key = request.headers.get("X-API-Key", "")
    if x_key and not x_key.startswith("pv_"):
        return True  # 全局 master key

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if not _looks_like_jwt(token) and not token.startswith("pv_"):
            return True  # 全局 master key (Bearer 格式向后兼容)

    return False
```

### 认证优先级总结

| 优先级 | 方式 | Header | 绑定用户 | 权限 |
|--------|------|--------|----------|------|
| 1 | JWT | `Authorization: Bearer eyJ...` | 是（token sub） | 正常所有权 |
| 2 | 用户 API Key | `X-API-Key: pv_...` 或 `Authorization: Bearer pv_...` | 是（key_hash → user_id） | **同 JWT** |
| 3 | 全局 API Key | `X-API-Key: <master>` | 否（owner_id=NULL） | 绕过所有权 |

---

## entries.py 删除/更新逻辑更新（评审 P0-2/P0-3）

```python
@router.delete("/{slug}")
async def delete_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Delete entry by slug."""
    global_key_auth = _is_global_api_key_auth(request, current_user)
    no_server_auth = not request.app.state.config.server.api_key
    allow_local = not global_key_auth and no_server_auth and current_user is None

    if global_key_auth:
        # 全局 master key：绕过所有权检查
        service.delete_entry_by_api_key(slug)
    else:
        # JWT 或用户级 API Key：走正常权限检查
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False
        service.delete_entry(
            slug,
            current_user_id=current_user_id,
            is_admin=is_admin,
            allow_local=allow_local,
        )
    return {"ok": True}
```

同理，`update_entry` 也走相同逻辑。注意：`update_entry` 没有 `update_entry_by_api_key` 独立方法，而是通过 `is_api_key_auth=True` 参数跳过 owner 检查（现有代码已支持）。

---

## API 端点

### `POST /api/v1/apikeys` — 创建 API Key

- **认证**: 需要 JWT（`require_auth`）
- **请求体**: `{ "name": "CI Bot", "expires_in": "30d" }`
- **响应**: `201 Created` + `ApiKeyCreateResponse`（含完整明文 key）
- **限制**: 每用户最多 10 个**活跃** key（不含已过期，评审 P1-4）
- **名称唯一**: 同用户 name 不可重复（`UNIQUE(user_id, name)`，评审 P1-7）
- **Key 生成**: `pv_` + `secrets.token_urlsafe(24)` → `pv_k8Xa2mN9bQ4wR7tY...`（约 36 字符）

### `GET /api/v1/apikeys` — 列出当前用户的 API Keys

- **认证**: 需要 JWT
- **响应**: `{ "items": [ApiKeyResponse...] }`
- **不含**: key 明文、key_hash

### `DELETE /api/v1/apikeys/{id}` — 撤销 API Key

- **认证**: 需要 JWT
- **权限**: 只能删除自己的 key（admin 可删任何人的）
- **响应**: `200 OK` + `{ "ok": true }`

### `DELETE /api/v1/apikeys/expired` — 清理过期 key

- **认证**: 需要 JWT
- **行为**: 删除当前用户所有已过期的 key
- **响应**: `200 OK` + `{ "deleted": <count> }`

---

## 配置变更

### `PeekAuth` 新增

```python
class PeekAuth(BaseSettings):
    # ... 现有字段 ...
    allow_anonymous_create: bool = Field(
        default=True,
        description="Allow anonymous (unauthenticated) entry creation",
    )
```

**环境变量**: `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE`

**默认 True**：内部网络部署无需改配置。公开部署设 `False` 拒绝匿名创建。

### 匿名创建检查位置

在 `api/entries.py` 的 `create_entry` 中。**注意**：全局 master key 请求的 `current_user=None`，但应允许创建条目，需排除全局 key：

```python
global_key_auth = _is_global_api_key_auth(request, current_user)
if current_user is None and not global_key_auth and not request.app.state.config.auth.allow_anonymous_create:
    raise AuthenticationError("Authentication required to create entries")
```

---

## 后端 All/Mine 筛选（`?owner=me`）

### `list_entries` 新增参数

```python
@router.get("")
async def list_entries(
    # ... 现有参数 ...
    owner: str | None = Query(None, description="Filter: 'me' for own entries"),
    # ...
):
```

### 服务层变更

`entry_service.list_entries` 新增 `owner: str | None = None` 参数：

- `owner="me"` + `current_user_id` → 在可见性基础上追加 `AND owner_id=user_id`
- `owner=None` → 现有行为（public + 自己的 private）
- `owner="me"` + 匿名 → 返回空列表
- `owner="me"` + admin → 仅显示**自己**的条目（不是全部）

**原则**: `owner=me` 只是在可见性基础上加 `AND owner_id=user_id`，不替换原有逻辑。可与其他筛选组合（如 `owner=me&tags=python`）。

```python
# list_entries 中的筛选逻辑
if owner == "me":
    if current_user_id is None:
        return EntryListResponse(items=[], total=0, page=page, per_page=per_page)
    # 在可见性基础上追加 owner 条件
    query = query.where(Entry.owner_id == current_user_id)
elif not is_admin:
    # 原有逻辑：public + own private
    query = query.where(
        or_(Entry.is_public == True, Entry.owner_id == current_user_id)
    )
# is_admin + owner=None → 无可见性过滤（原有行为）
```

---

## CLI 变更

### 新增 `peekview apikey` 命令组

```bash
# 创建 API Key（需要先 login）
peekview apikey create "CI Bot"              # 永不过期
peekview apikey create "Temp" --expires 30d  # 30 天后过期

# 列出当前用户的 API Keys（远程模式：调用 API）
peekview apikey list

# 撤销 API Key
peekview apikey revoke <id>

# 清理过期 key
peekview apikey cleanup
```

**注意**: `apikey` 命令仅在远程模式有效（key 存储在服务端 DB）。本地模式提示用户先配置远程服务器。

### `peekview login` 变更

登录成功后提示用户可以创建 API Key：

```
✓ Logged in as testuser
  Tip: Create an API key for CLI/Agent use:
    peekview apikey create "My Agent"
```

### `peekview config set remote.api_key` 变更

提示用户 API Key 可以通过 `peekview apikey create` 创建。

---

## Frontend 变更

### 新增 API Key 管理页面

路径: `/settings/apikeys`（或嵌入 Settings 页面）

**UI 元素**:
- Key 列表：名称、前缀（`pv_k8Xa...`）、创建时间、过期时间、最后使用时间
- 创建按钮 → 弹窗输入名称 + 过期时间 → 创建成功弹窗**显示完整 key**（仅一次）
- 撤销按钮 → 确认弹窗 → 删除
- 清理过期 key 按钮

**创建成功弹窗 UX**:
- 显示完整 key + 警告文字"请立即保存，此后不再显示"
- "复制到剪贴板"按钮
- "我已安全保存"确认按钮，点击前不能关闭弹窗

**路由守卫**: 仅 `authState === 'authenticated'` 可访问

### Header 变更

用户菜单新增 "API Keys" 入口（在 Logout 上方）。

---

## 数据迁移策略

### 对现有数据的影响

| 现有数据 | 迁移后 | 说明 |
|----------|--------|------|
| `users` 表 | 不变 | 无需迁移 |
| `entries` 表 | 不变 | `owner_id` 已有，API Key 创建的条目正常设 `owner_id` |
| `PEEKVIEW_SERVER__API_KEY` | 保留 | 全局 master key，不受影响 |
| `~/.peekview/config.yaml` remote.api_key | 保留 | 可继续使用全局 key |

### 迁移步骤

1. `SQLModel.metadata.create_all()` 自动创建 `api_keys` 表（新表，无需 ALTER）
2. 无需数据回填（新功能，表初始为空）
3. 现有 API Key 认证流程不受影响（全局 key 优先级独立）

**零风险**：不修改任何现有表结构，仅新增表。

---

## Step-by-Step 实现计划

### Step 1: Backend — 数据模型

**文件**: `backend/peekview/models.py`

- 新增 `ApiKey` 模型（table=True），所有字段直接定义，不使用 Base 继承
- 新增 `ApiKeyCreate`、`ApiKeyResponse`、`ApiKeyCreateResponse` schemas
- `User` 模型添加 `api_keys: list[ApiKey] = Relationship(back_populates="user")` relationship
- 常量: `API_KEY_PREFIX = "pv_"`

### Step 2: Backend — 数据库

**文件**: `backend/peekview/database.py`

- `api_keys` 表由 `SQLModel.metadata.create_all()` 自动创建
- 无需手动 ALTER（新表）
- 确认 `ON DELETE CASCADE` 正确（删除用户时自动删 key）
- 新增索引: `idx_api_keys_user_name UNIQUE(user_id, name)`

### Step 3: Backend — API Key 服务

**文件**: `backend/peekview/services/apikey_service.py`（新建）

- `create_api_key(user_id, name, expires_in)` → 生成 key，存 HMAC-SHA256 hash，返回明文
- `list_api_keys(user_id)` → 返回用户所有 key（不含 hash）
- `count_active_keys(user_id)` → 统计活跃 key 数量（不含已过期）
- `revoke_api_key(key_id, user_id, is_admin)` → 删除 key
- `cleanup_expired_keys(user_id)` → 删除用户所有已过期的 key
- `verify_api_key(key_value)` → HMAC hash 查找 + 过期检查 + 返回绑定用户
- Key 生成: `secrets.token_urlsafe(24)`，前缀 `pv_`
- Hash 计算: `hmac.new(b"peekview-api-key", key.encode(), "sha256").hexdigest()`
- 限流: 每用户最多 10 个活跃 key（不含已过期）
- `last_used_at` 限流更新: 距上次 >5 分钟才写

### Step 4: Backend — 认证增强

**文件**: `backend/peekview/auth.py`

- `get_current_user` 增加 API Key 检测逻辑（`pv_` 前缀）
- 新增 `_verify_api_key(key_value, engine)` 函数
- 新增 `_hash_api_key(key)` 辅助函数（`apikey_service.py` 通过 import 共享，不在两处重复定义）

### Step 5: Backend — 中间件变更（评审 P0-1）

**文件**: `backend/peekview/main.py`

- 全局 API Key 中间件增加 `pv_` 前缀放行逻辑
- `X-API-Key` 以 `pv_` 开头 → 放行
- `Authorization: Bearer pv_...` → 放行
- 其余逻辑不变

### Step 6: Backend — API 路由

**文件**: `backend/peekview/api/apikeys.py`（新建）

- `POST /api/v1/apikeys` — 创建 key
- `GET /api/v1/apikeys` — 列出 key
- `DELETE /api/v1/apikeys/{id}` — 撤销 key
- `DELETE /api/v1/apikeys/expired` — 清理过期 key（**注意**: 此路由必须在 `{id}` 路由之前注册，否则 "expired" 被当作 id 参数）

**文件**: `backend/peekview/main.py`

- 注册 `apikey_router`

### Step 7: Backend — entries.py 权限更新（评审 P0-2/P0-3）

**文件**: `backend/peekview/api/entries.py`

- 新增 `_is_global_api_key_auth(request, current_user)` 替代 `_is_api_key_auth`
- `delete_entry`: 全局 key → `delete_entry_by_api_key`；用户级 key/JWT → 正常权限
- `update_entry`: 同理
- `create_entry`: 匿名创建检查（排除全局 key）+ 用户级 key 绑定 owner_id
- `list_entries`: 新增 `owner: str | None = Query(None)` 参数

### Step 8: Backend — 配置变更

**文件**: `backend/peekview/config.py`

- `PeekAuth` 新增 `allow_anonymous_create: bool = True`
- 环境变量: `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE`

### Step 9: Backend — Entry Service All/Mine

**文件**: `backend/peekview/services/entry_service.py`

- `list_entries` 新增 `owner: str | None = None` 参数
- `owner="me"` 时在可见性基础上追加 `AND owner_id=user_id`
- `entries.py` 传递 owner 参数

### Step 10: Backend — CLI 变更

**文件**: `backend/peekview/cli.py`

- 新增 `peekview apikey` 命令组（create/list/revoke/cleanup）
- 仅远程模式有效
- `login` 成功后提示可创建 API Key

### Step 11: Frontend — 类型与 API

**文件**: `frontend-v3/src/types/index.ts`

- 新增 `ApiKey`、`ApiKeyCreatePayload`、`ApiKeyCreateResult` 类型

**文件**: `frontend-v3/src/api/types.ts`

- 新增 `ApiKeyResponse`、`ApiKeyCreateResponse` API 类型

**文件**: `frontend-v3/src/api/client.ts`

- 新增 `listApiKeys()`、`createApiKey()`、`revokeApiKey()`、`cleanupExpiredKeys()` 方法

### Step 12: Frontend — API Key 管理页面

**文件**: `frontend-v3/src/views/ApiKeyListView.vue`（新建）

- Key 列表：名称、前缀、创建/过期时间、最后使用、撤销按钮
- 创建弹窗：名称输入 + 过期时间选择（永不过期 / 7天 / 30天 / 90天 / 自定义）
- 创建成功弹窗：显示完整 key + 复制按钮 + "我已安全保存"确认

**文件**: `frontend-v3/src/router/index.ts`

- 新增 `/settings/apikeys` 路由（需认证）

### Step 13: Frontend — EntryListView All/Mine 切换

**文件**: `frontend-v3/src/views/EntryListView.vue`

- 已登录用户在列表上方显示 All / Mine 标签页切换
- "Mine" 发送 `?owner=me` 参数
- URL 同步：`/?owner=me`

### Step 14: 测试

**文件**: `backend/tests/test_apikey.py`（新建）

- 创建 key（含名称唯一性验证、过期时间、活跃 key 上限检查）
- 列出 key（不含 hash）
- 撤销 key（仅 owner/admin）
- 用 key 认证创建条目（验证 owner_id 绑定）
- 用 key 认证删除条目（**验证不能删别人的条目** — P0-2 修复验证）
- 过期 key 不可用
- 禁用用户的 key 不可用
- 匿名创建控制（allow_anonymous_create=True/False）
- 全局 key 中间件放行 pv_ 前缀（P0-1 修复验证）
- 清理过期 key
- 同名 key 创建拒绝

**文件**: `backend/tests/test_auth.py`

- 更新：用户级 API Key 认证返回 `current_user`
- 全局 API Key 认证仍返回 `current_user=None`
- 用户级 API Key 权限等同 JWT（不能越权操作）

**文件**: `backend/tests/test_api.py`

- 更新：All/Mine 筛选测试

---

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/peekview/models.py` | 修改 | 新增 ApiKey 模型 + schemas |
| `backend/peekview/database.py` | 修改 | 确认自动建表 + 新索引 |
| `backend/peekview/services/apikey_service.py` | 新建 | API Key CRUD + 验证 + 清理 |
| `backend/peekview/auth.py` | 修改 | get_current_user 增加 API Key 检测 |
| `backend/peekview/main.py` | 修改 | **中间件放行 pv_**（P0-1）+ 注册 router |
| `backend/peekview/api/apikeys.py` | 新建 | API Key 路由 |
| `backend/peekview/api/entries.py` | 修改 | **权限矩阵更新**（P0-2/P0-3）+ 匿名控制 + owner 筛选 |
| `backend/peekview/services/entry_service.py` | 修改 | owner="me" 筛选逻辑 |
| `backend/peekview/config.py` | 修改 | allow_anonymous_create 配置 |
| `backend/peekview/cli.py` | 修改 | apikey 命令组 |
| `backend/peekview/client.py` | 修改 | 远程模式 API Key 支持 |
| `frontend-v3/src/types/index.ts` | 修改 | ApiKey 类型 |
| `frontend-v3/src/api/types.ts` | 修改 | ApiKey API 类型 |
| `frontend-v3/src/api/client.ts` | 修改 | ApiKey API 方法 |
| `frontend-v3/src/views/ApiKeyListView.vue` | 新建 | API Key 管理页面 |
| `frontend-v3/src/router/index.ts` | 修改 | /settings/apikeys 路由 |
| `frontend-v3/src/views/EntryListView.vue` | 修改 | All/Mine 切换 |
| `backend/tests/test_apikey.py` | 新建 | API Key 测试 |

---

## 认证流程图（更新后）

```
                        请求到达
                           │
                ┌──────────┴──────────┐
                │ 全局 API Key 中间件  │
                │ (PEEKVIEW_SERVER__  │
                │  API_KEY)           │
                │                     │
                │ ① pv_ 前缀 → 放行   │ ← P0-1 修复
                │ ② master key → 放行 │
                │ ③ JWT → 放行        │
                │ ④ 其他 → 401        │
                └──────────┬──────────┘
                           │
                   ①②③ 通过到达
                           │
                          ▼
                ┌─────────────────────────┐
                │   get_current_user()    │
                │                         │
                │ 1. Bearer eyJ... → JWT  │
                │    → 返回 User 对象      │
                │                         │
                │ 2. pv_ 前缀 → api_keys  │
                │    → 返回绑定 User 对象   │
                │    （权限等同 JWT）       │
                │                         │
                │ 3. 全局 key 已通过中间件  │
                │    → 返回 None           │
                │                         │
                │ 4. 无凭证 → None         │
                └─────────┬───────────────┘
                          │
                          ▼
                     业务逻辑
              ┌───────┴───────┐
              │               │
        current_user 有值    current_user=None
        (JWT 或用户级 key)   (全局 key 或匿名)
              │               │
        正常所有权检查     全局 key → 绕过权限
        (create 设 owner,  匿名 → 不可操作
         update/delete
         检查 owner_id)
```

---

## 向后兼容保证

1. **`PEEKVIEW_SERVER__API_KEY`** — 完全保留，逻辑不变
2. **`X-API-Key: <master>`** — 继续工作，`current_user=None`
3. **`Authorization: Bearer <master>`** — 继续工作（非 JWT 格式走全局 key）
4. **`owner_id=NULL` 条目** — 全局 key 创建的条目仍是 NULL，admin 管理
5. **`entries.py` 中 `_is_api_key_auth`** — 替换为 `_is_global_api_key_auth`，语义更清晰
6. **CLI `remote.api_key`** — 旧配置继续可用（存全局 key）
7. **`peekview config set remote.api_key`** — 不变
8. **`client.py`** — 现有 header 逻辑不变（JWT 优先 > API Key）

---

## 评审修复追踪

| 评审编号 | 级别 | 问题 | 修复状态 | 修复位置 |
|----------|------|------|----------|----------|
| P0-1 | 致命 | 全局中间件拦截 pv_ key | ✅ 已修复 | Step 5, 中间件放行 |
| P0-2 | 致命 | 用户级 key 删除权限过宽 | ✅ 已修复 | Step 7, 认证矩阵 |
| P0-3 | 致命 | _is_api_key_auth 逻辑冲突 | ✅ 已修复 | Step 7, _is_global_api_key_auth |
| P1-4 | 重要 | 过期 key 占位 | ✅ 已修复 | count_active_keys, 清理端点 |
| P1-5 | 重要 | last_used_at 写频率 | ✅ 已修复 | 5 分钟限流 |
| P1-6 | 重要 | key_prefix 文档 | ✅ 已修复 | 数据模型注释 |
| P1-7 | 重要 | name 唯一性 | ✅ 已修复 | UNIQUE(user_id, name) |
| P1-8 | 重要 | SHA-256 无盐 | ✅ 已修复 | HMAC-SHA256 |
| P1-9 | 重要 | ApiKeyBase 继承问题 | ✅ 已修复 | 不使用 Base 继承 |
| P1-11 | 重要 | allow_anonymous_create 误拦截全局 key | ✅ 已修复 | create_entry 检查排除全局 key |
| P1-12 | 重要 | _hash_api_key 需共享定义 | ✅ 已修复 | auth.py 定义并 export，service import |

---

## 验证流程

1. `cd backend && python -m pytest tests/ -v` — 所有后端测试通过
2. `make debug-build && make debug-start` — 启动调试服务
3. 浏览器登录 → 创建 API Key → 复制 key
4. CLI: `peekview apikey create "Test"` — 验证远程创建
5. CLI: `peekview create test.py -s "With key"` — 用 key 创建条目
6. 浏览器确认条目 `owner_id` 绑定正确
7. **配置全局 API Key → 用用户级 key 请求 → 应成功**（P0-1 验证）
8. **用户 A 的 key 不能删除用户 B 的条目**（P0-2 验证）
9. 设置 `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=false` → 匿名创建返回 401
10. 浏览器 "Mine" 标签 → 仅显示自己的条目
11. API Key 过期 → 认证失败
12. 创建 10 个 key → 第 11 个被拒 → 过期 1 个 → 可再创建
13. `make debug-test` — E2E 测试通过
