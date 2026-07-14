---
phase: P2
task_id: T054
type: design
parent: P1-requirements.md
trace_id: T054-P2-20260714
status: revised
created: 2026-07-14
agent: architect
---

# T054 P2: 方案设计

## 声明字段

```yaml
packages:
  - backend/peekview
  - packages/mcp-server

domains:
  - api-safety
  - idempotency
  - code-style

ui_affected: false

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_mcp: "cd packages/mcp-server && npm test"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"

env_constraints:
  debug_env: "make debug-start (:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'"

files_to_read:
  - path: backend/peekview/config.py:148-196
    why: PeekServer.host 默认值和 rate_limit 配置，需求 A 改默认值，需求 B 加限流
  - path: backend/peekview/models.py:181-225
    why: Entry 模型定义，需求 D 加 idempotency_key 列
  - path: backend/peekview/models.py:538-550
    why: CreateEntryRequest schema，需求 D 加 idempotency_key 字段
  - path: backend/peekview/services/entry_service.py:132-311
    why: create_entry 逻辑，需求 D 加幂等查重 + IntegrityError catch
  - path: backend/peekview/services/entry_service.py:771-798
    why: _retry_with_slug_suffix 模式，IntegrityError 处理先例
  - path: backend/peekview/api/entries.py:130-181
    why: create_entry 路由，需求 B 加 @limiter + 需求 D 返回 200/201
  - path: backend/peekview/api/entries.py:335-414
    why: update_entry/delete_entry 路由，需求 B 加 @limiter
  - path: backend/peekview/api/rate_limit.py
    why: 限流模块，需求 B 加 entries_rate_limit provider
  - path: backend/peekview/main.py:386-399
    why: rate limit 绑定，需求 B 注册 entries 限流 provider
  - path: backend/peekview/services/share_service.py:68-74
    why: text() SELECT COUNT，需求 E 改 ORM
  - path: backend/peekview/services/share_service.py:222-228
    why: text() UPDATE view_count，需求 E 改 update() 构造器
  - path: backend/peekview/database.py:39-125
    why: _run_migrations 模式，需求 D/F 加 migration
  - path: backend/peekview/cli.py:140-142
    why: --host help 文本，需求 A 同步修改
  - path: backend/peekview/cli.py:739
    why: config list host 描述，需求 A 同步修改
  - path: backend/peekview/auth.py:16
    why: 确认直接 import bcrypt，需求 C 验证
  - path: backend/pyproject.toml:35
    why: passlib 依赖声明，需求 C 替换
  - path: backend/peekview/exceptions.py:100-107
    why: ConflictError 已存在，需求 D 返回 409
  - path: packages/mcp-server/src/types.ts:19-26
    why: CreateEntryRequest 接口，需求 D 加 idempotency_key
  - path: packages/mcp-server/src/tools/createEntry.ts:7-18
    why: Zod schema，需求 D 加 idempotency_key 可选参数
  - path: packages/mcp-server/src/tools/createEntry.ts:43-72
    why: inputSchema，需求 D 加 idempotency_key 属性
  - path: packages/mcp-server/src/tools/createEntry.ts:89-96
    why: handler 调用 client.createEntry，需求 D 传参
  - path: packages/mcp-server/src/client.ts:86-91
    why: createEntry 方法，需求 D 传递 idempotency_key

minimal_validation:
  assumption: "N/A — 纯代码逻辑，无浏览器/外部系统依赖"
  method: "not_needed"
  result: "not_needed"
  note: "所有方案均基于项目内已有模式（IntegrityError catch、@limiter 装饰器、update() 构造器），TDD 覆盖即可"
```

## §0 影响域分析

### 改什么

| 文件 | 改动 | 需求 |
|------|------|------|
| `config.py:152` | host 默认值 `"0.0.0.0"` → `"127.0.0.1"` + description 更新 | A |
| `cli.py:141` | `--host` help 文本 default 值 | A |
| `cli.py:739` | config list host 描述 | A |
| `pyproject.toml:35` | `passlib[bcrypt]>=1.7.4` → `bcrypt>=4.0.0` | C |
| `models.py:181-225` | Entry 模型加 `idempotency_key` 列 + UNIQUE index | D |
| `models.py:538-550` | CreateEntryRequest 加 `idempotency_key` 字段 | D |
| `api/entries.py:130-181` | create_entry 加 `@limiter.limit` + 幂等 200/201 逻辑 | B, D |
| `api/entries.py:335-385` | update_entry 加 `@limiter.limit` | B |
| `api/entries.py:388-414` | delete_entry 加 `@limiter.limit` | B |
| `api/rate_limit.py` | 加 `entries_rate_limit` provider + setter | B |
| `main.py:386-399` | 注册 entries 限流 provider | B |
| `services/entry_service.py:132-311` | create_entry 加幂等查重 + IntegrityError catch | D |
| `services/share_service.py:68-74` | text() SELECT COUNT → ORM select(func.count()) | E |
| `services/share_service.py:222-228` | text() UPDATE → update() 构造器 | E |
| `database.py:39-125` | 加 idempotency_key migration + 顶部注释 | D, F |
| `packages/mcp-server/src/types.ts` | CreateEntryRequest 加 idempotency_key | D |
| `packages/mcp-server/src/tools/createEntry.ts` | Zod schema + inputSchema + handler 加 idempotency_key | D |
| `packages/mcp-server/src/client.ts` | createEntry 传参 idempotency_key | D |

### 不改什么

- `EntryResponse` schema — 不暴露 idempotency_key（内部字段，API 响应无需返回）
- `publishFiles` tool — P1 明确声明不暴露 idempotency_key（ID-NEW-4）
- `get_entry` / `list_entries` — 只读端点不加显式限流（default_limits 已覆盖）
- `share_service.py` 其余 6 处 ORM 查询 — 已经是正确风格
- 前端 — ui_affected: false

### 风险在哪

| 风险 | 可能影响 | 缓解 |
|------|---------|------|
| 默认 host 改 127.0.0.1 | 现有零配置部署升级后只监听 localhost | 已显式配置的不受影响；CHANGELOG 标 breaking change |
| idempotency_key migration | 现有 DB 无此列，需 ALTER TABLE | 复用 _run_migrations 已有模式；NULL + DEFAULT NULL 向后兼容 |
| IntegrityError catch 区分 slug 碰撞 vs idempotency 碰撞 | 两种 UNIQUE 约束都触发 IntegrityError | 在 except 块中查询 idempotency_key 对应的 entry 来区分 |
| view_count update() 构造器 | SQLModel session.exec() 对 update() 返回值兼容性 | 实测确认；原子递增是正确行为 |
| bcrypt 版本兼容 | passlib 间接安装的 bcrypt 版本可能 <4.0 | pyproject.toml 已声明 bcrypt>=4.0；bcrypt 4.x API 向后兼容 3.x 哈希 |

## §1 候选方案

### 方案 A：入口层幂等（推荐）

**核心思路**：在 `entry_service.create_entry` 内部处理幂等逻辑——先尝试插入，IntegrityError 时区分 slug 碰撞（重试后缀）和 idempotency_key 碰撞（查回已有 entry 返回），API 层根据返回值调整 status_code。

**幂等流程**：
```
create_entry(idempotency_key=X, owner_id=Y):
  1. key 不为空 → 校验（空串 → 422，超长 → 422）
  2. key 不为空 → 先查 SELECT WHERE idempotency_key=X
     a. 找到 + owner_id=Y → 返回 (existing_entry, is_idempotent=True)
     b. 找到 + owner_id≠Y → raise ConflictError(409)
  3. 正常创建 entry（含 idempotency_key）
  4. IntegrityError catch:
     a. 查 SELECT WHERE idempotency_key=X
        - 找到 + owner_id=Y → 返回 (existing_entry, is_idempotent=True)  # 竞态窗口
        - 找到 + owner_id≠Y → raise ConflictError(409)
     b. 无 idempotency_key 冲突 → slug 碰撞 → _retry_with_slug_suffix
```

**API 层状态码**：
- `entry_service.create_entry` 返回 `tuple[CreateEntryResponse, bool]`（response, is_idempotent）
- `entries.py` 的 `create_entry` 路由：is_idempotent=True → 返回 `JSONResponse(status_code=200, content=...)`；否则正常 201

**权衡**：
- ✅ 复用现有 IntegrityError catch 模式（slug 碰撞已有先例）
- ✅ 一次 DB 查询优化（先查 key → 命中则跳过全部创建逻辑，包括文件写入）
- ✅ 竞态安全：UNIQUE 约束是最终防线，IntegrityError catch 是兜底
- ⚠️ 返回类型从 `CreateEntryResponse` 变为 `tuple`，影响调用方（entry_service 内部 `_retry_with_slug_suffix` 也需适配）
- ⚠️ 幂等命中时文件已存在，需确保 `CreateEntryResponse.files` 包含已有文件列表

**工作量**：约 60 行（service 逻辑 ~30 + API 层 ~10 + model/schema ~10 + migration ~10）

### 方案 B：API 层幂等（对比方案）

**核心思路**：在 `entries.py` 路由层处理幂等——先查 key 是否存在，存在则直接构造响应返回 200，不存在则调 `service.create_entry`（不传 key 给 service，key 只在 API 层管理）。

**权衡**：
- ⚠️ 不改变 service 层返回类型——但把幂等逻辑拆到 API 层，service 层仍需知道 idempotency_key（否则 IntegrityError 无法区分）
- ⚠️ API 层需要重复 entry→CreateEntryResponse 的转换逻辑（目前 service 返回的已经是 response 对象）
- ⚠️ 竞态窗口更大：API 层查 key → 未命中 → 调 service → service insert → IntegrityError → 需要 service 层处理 → 逻辑分散
- ❌ 违反"胖 service 瘦 controller"的项目惯例（auth.py 的 register 是例外，因为逻辑简单）

**工作量**：约 70 行（API 层 ~25 + service 层 ~25 + model/schema ~10 + migration ~10）

### 选择理由

方案 A 更优：
1. 幂等逻辑集中在 service 层，与 slug 碰撞处理在同一位置，易于理解和测试
2. 先查 key 的优化可以跳过整个文件写入流程，减少不必要 IO
3. IntegrityError catch 已有先例（slug 碰撞），方案 A 延续此模式
4. 方案 B 把同一件事的逻辑拆到两层，增加竞态处理复杂度

方案 A 的返回类型变化影响可控——`_retry_with_slug_suffix` 内部调用 `create_entry`，传递 `is_idempotent` 标记即可；对外 API 层只多一个条件判断。

## §2 详细设计

### 2.1 需求 A：默认 host 改 127.0.0.1

**改动点**：

1. `config.py:152` — `default="0.0.0.0"` → `default="127.0.0.1"`
2. `config.py:153` — description 更新：移除 "0.0.0.0 for all interfaces" 的暗示，改为 "127.0.0.1 for local only, 0.0.0.0 for all interfaces"
3. `cli.py:141` — help 文本 `default: 0.0.0.0` → `default: 127.0.0.1`
4. `cli.py:739` — `# 绑定地址 (0.0.0.0 为所有接口)` → `# 绑定地址 (127.0.0.1 仅本地，0.0.0.0 所有接口)`

**向后兼容**：已通过 `PEEKVIEW_SERVER__HOST=0.0.0.0` 或 config.yaml 显式配置的部署不受影响。零配置部署（依赖默认值）升级后变为仅 localhost——这是安全加固的预期行为，CHANGELOG 标 breaking change，描述中需明确提及 Docker/容器场景：零配置 Docker 部署升级后容器外无法访问，需显式设置 `PEEKVIEW_SERVER__HOST=0.0.0.0`。

**BDD 覆盖**：A1-A4

### 2.2 需求 B：写入端点加显式限流装饰器

**改动点**：

1. `api/rate_limit.py` — 新增：
   ```python
   _entries_limit_provider: Callable[[], str] = lambda: "60/minute"

   def entries_rate_limit() -> str:
       return _entries_limit_provider()

   def set_entries_rate_limit(limit: str) -> None:
       global _entries_limit_provider
       _entries_limit_provider = lambda: limit
   ```

2. `main.py` — 注册 entries 限流（在现有 rate limit binding 区域）：
   ```python
   from peekview.api.rate_limit import set_entries_rate_limit
   entries_limit = f"{config.server.rate_limit_per_minute}/minute"
   set_entries_rate_limit(entries_limit)
   ```

3. `api/entries.py` — 三个端点加装饰器：
   ```python
   from peekview.api.rate_limit import entries_rate_limit, limiter

   @router.post("", status_code=201)
   @limiter.limit(entries_rate_limit)
   async def create_entry(...):

   @router.patch("/{slug}")
   @limiter.limit(entries_rate_limit)
   async def update_entry(...):

   @router.delete("/{slug}")
   @limiter.limit(entries_rate_limit)
   async def delete_entry(...):
   ```

**设计决策**：
- 复用 `rate_limit_per_minute` 配置值（默认 60/分钟），与 default_limits 值相同，但显式装饰器优先级更高，可独立调整
- 不新增配置项 `rate_limit_entries_per_minute`——P1 BDD-B6 只要求"可独立于 default_limits 配置"，显式装饰器 + 独立 provider 函数已满足（可通过修改 provider 的值来调整，或后续按需加配置项）
- 如果未来需要更严格/宽松的 entries 限流，只需在 `main.py` 中改 `entries_limit` 的计算方式或加新配置项

**BDD 覆盖**：B1-B6

### 2.3 需求 C：移除 passlib 依赖

**改动点**：

1. `pyproject.toml:35` — `"passlib[bcrypt]>=1.7.4"` → `"bcrypt>=4.0.0"`

**验证**：
- 代码已直接 `import bcrypt`（auth.py:16），无 passlib 引用
- bcrypt 4.x 向后兼容 3.x 生成的哈希（BDD-C2）
- 需重新 lock 依赖（`make dev` 重建 venv）

**BDD 覆盖**：C1-C2

### 2.4 需求 D：Create 接口幂等保护

#### 2.4.1 模型层

**Entry 模型**（models.py）：
```python
class Entry(EntryBase, table=True):
    ...
    idempotency_key: str | None = Field(
        default=None,
        max_length=128,
        sa_column_kwargs={"nullable": True, "default": None},
    )
```

注意：不在 `sa_column_kwargs` 中设 `unique=True`，避免 `create_all()` 生成普通 UNIQUE 约束与 migration 的 partial index 重复/冲突。UNIQUE 约束完全由 migration 的 `CREATE UNIQUE INDEX ... WHERE idempotency_key IS NOT NULL` 处理（见 §2.4.4）。

**CreateEntryRequest**（models.py）：
```python
class CreateEntryRequest(SQLModel):
    ...
    idempotency_key: str | None = Field(
        default=None,
        max_length=128,
        description="Idempotency key for safe retries. Same key + same owner returns existing entry (200). Cross-owner key returns 409.",
    )
```

空字符串校验：在 `CreateEntryRequest` 加 Pydantic validator：
```python
@field_validator("idempotency_key")
@classmethod
def validate_idempotency_key(cls, v: str | None) -> str | None:
    if v is not None and v.strip() == "":
        raise ValueError("idempotency_key must not be empty")
    return v
```

这确保 `""` → 422（Pydantic Validation Error），`None` → 不参与幂等。

#### 2.4.2 Service 层

**create_entry 签名变更**：
```python
def create_entry(
    self,
    summary: str,
    slug: str | None = None,
    tags: list[str] | None = None,
    files_data: list[dict[str, Any]] | None = None,
    dirs_data: list[dict[str, str]] | None = None,
    expires_in: str | None = None,
    is_public: bool = True,
    current_user_id: int | None = None,
    idempotency_key: str | None = None,  # 新增
) -> tuple[CreateEntryResponse, bool]:  # (response, is_idempotent)
```

**幂等逻辑**（在现有创建逻辑之前插入）：

```python
if idempotency_key:
    existing = self._find_by_idempotency_key(idempotency_key)
    if existing:
        if existing.owner_id != current_user_id:
            raise ConflictError("idempotency_key already used by another user")
        return existing, True  # is_idempotent=True
```

**IntegrityError catch 增强**（在现有 `except IntegrityError` 块中）：

```python
except IntegrityError:
    if idempotency_key:
        existing = self._find_by_idempotency_key(idempotency_key)
        if existing:
            if existing.owner_id != current_user_id:
                raise ConflictError("idempotency_key already used by another user")
            return existing, True  # 竞态窗口命中
    return self._retry_with_slug_suffix(...)
```

**事务隔离保证**：IntegrityError 触发时，`with Session(self.engine)` 块的 session 已回滚退出，entry 和 idempotency_key 均未持久化。`_find_by_idempotency_key` 开启独立 session 查询是安全的——因为竞态对方的 insert 已 commit，新 session 能看到已 commit 的 entry；而自身回滚的 entry 不存在，不会误查回。

**slug 碰撞 + idempotency_key 共存场景**：请求带 `idempotency_key=X` + `slug=S`，S 已被另一个 entry 占用，X 不存在：
1. Insert → IntegrityError（slug UNIQUE 约束冲突）
2. Catch → 查 `idempotency_key=X` → 未找到（自身回滚未持久化，X 从未存在）
3. 走 `_retry_with_slug_suffix` → 重试 `slug=S-2`，带 `idempotency_key=X` → 成功插入 → 返回 `(response, False)`

此场景下 IntegrityError 由 slug 冲突触发，非 idempotency_key 冲突。catch 中先查 key 区分两种 UNIQUE 约束来源，语义正确。

**辅助方法 `_find_by_idempotency_key`**：
```python
def _find_by_idempotency_key(self, key: str) -> CreateEntryResponse | None:
    with Session(self.engine) as session:
        entry = session.exec(
            select(Entry).where(Entry.idempotency_key == key)
        ).first()
        if not entry:
            return None
        files = session.exec(select(File).where(File.entry_id == entry.id)).all()
        username = self._resolve_username(session, entry.owner_id)
        return self._build_create_response(entry, list(files), username)
```

**新增辅助方法 `_build_create_response`**（从 `create_entry` line 302-311 的内联构造提取）：
```python
def _build_create_response(
    self, entry: Entry, files: list[File], username: str | None
) -> CreateEntryResponse:
    file_responses = [
        FileResponse(
            id=f.id, path=f.path, filename=f.filename,
            language=f.language, is_binary=f.is_binary,
            size=f.size, line_count=f.line_count,
        )
        for f in files
    ]
    return CreateEntryResponse(
        id=entry.id,
        slug=entry.slug,
        url=self.config.build_view_url(entry.slug),
        is_public=entry.is_public,
        owner_id=entry.owner_id,
        expires_at=entry.expires_at,
        created_at=entry.created_at,
        files=file_responses,
    )
```

`create_entry` 正常路径的 line 302-311 内联构造改为调用 `self._build_create_response(entry, file_records, username)`。

**返回类型处理**：

create_entry 当前返回 `CreateEntryResponse`。改为返回 `tuple[CreateEntryResponse, bool]`（response, is_idempotent）。

**`_retry_with_slug_suffix` 签名变更**：

```python
def _retry_with_slug_suffix(
    self,
    summary: str,
    original_slug: str,
    tags: list[str] | None,
    files_data: list[dict[str, Any]] | None,
    dirs_data: list[dict[str, str]] | None,
    expires_in: str | None,
    is_public: bool = True,
    current_user_id: int | None = None,
    idempotency_key: str | None = None,  # 新增
) -> tuple[CreateEntryResponse, bool]:  # 改为 tuple
```

关键行为：
- `_retry_with_slug_suffix` 内部调用 `self.create_entry(..., idempotency_key=idempotency_key)`，返回 `tuple[CreateEntryResponse, bool]`，直接 return 该 tuple（透传 `create_entry` 的返回值）
- 在 slug 碰撞场景下，重试使用新 slug 但保持原始 idempotency_key。因 IntegrityError 回滚后 idempotency_key 未持久化（session 回滚 = entry 和 key 都未写入 DB），重试时 key 不在 DB 中，`create_entry` 的先查逻辑不会命中幂等，正常插入成功后 `is_idempotent=False`
- slug 碰撞重试成功永远是新创建的 entry，返回 `(response, False)`
- `create_entry` 的 `except IntegrityError` 分支中 `return self._retry_with_slug_suffix(...)` 直接返回 tuple，与正常路径返回类型一致

#### 2.4.3 API 层

**create_entry 路由**（entries.py）：

```python
@router.post("", status_code=201)
@limiter.limit(entries_rate_limit)
async def create_entry(...):
    ...
    result, is_idempotent = service.create_entry(
        ...,
        idempotency_key=data.idempotency_key,
    )
    if is_idempotent:
        return JSONResponse(status_code=200, content=result.model_dump(mode="json"))
    return result
```

**注意**：路由默认 `status_code=201`，幂等命中时用 `JSONResponse(status_code=200)` 覆盖。

#### 2.4.4 Database Migration

**_run_migrations 新增**（database.py）：

```python
if "idempotency_key" not in columns:
    conn.execute(text(
        "ALTER TABLE entries ADD COLUMN idempotency_key VARCHAR(128) DEFAULT NULL"
    ))
    conn.commit()
    logger.info("Migration: added idempotency_key column to entries")

# Check for unique index
if "idx_entries_idempotency_key" not in indexes:
    conn.execute(text(
        "CREATE UNIQUE INDEX idx_entries_idempotency_key ON entries(idempotency_key) "
        "WHERE idempotency_key IS NOT NULL"
    ))
    conn.commit()
    logger.info("Migration: added unique index on entries.idempotency_key")
```

**关键**：`WHERE idempotency_key IS NOT NULL` — SQLite 的部分索引（partial index），确保多个 NULL 不触发 UNIQUE 冲突。这是 BDD-D10 的实现保障。

#### 2.4.5 MCP 侧改动

**types.ts** — `CreateEntryRequest` 加字段：
```typescript
export interface CreateEntryRequest {
  ...
  idempotency_key?: string;
}
```

**createEntry.ts** — Zod schema 加字段：
```typescript
const schema = z.object({
  ...
  idempotency_key: z.string().optional(),
});
```

**createEntry.ts** — inputSchema 加属性：
```typescript
idempotency_key: { type: 'string', description: 'Idempotency key for safe retries. Same key returns existing entry.' },
```

**createEntry.ts** — handler 传参：
```typescript
const entry = await client.createEntry({
  ...
  idempotency_key: params.idempotency_key,
}, ctx.userToken);
```

**client.ts** — 无需改动（`createEntry` 方法已透传 `CreateEntryRequest` 的全部字段到 `JSON.stringify(request)`）。

**BDD 覆盖**：D1-D10

### 2.5 需求 E：share_service text() SQL 统一

#### 2.5.1 SELECT COUNT 改 ORM

**当前**（share_service.py:68-74）：
```python
active_count = session.execute(
    text("SELECT COUNT(*) FROM entry_shares WHERE entry_id = :eid AND revoked_at IS NULL"),
    {"eid": entry.id},
).scalar()
```

**改为**：
```python
from sqlalchemy import func

active_count = session.exec(
    select(func.count()).select_from(EntryShare).where(
        EntryShare.entry_id == entry.id,
        EntryShare.revoked_at == None,  # noqa: E711
    )
).one()
```

#### 2.5.2 UPDATE view_count 改 update() 构造器

**当前**（share_service.py:222-228）：
```python
session.execute(
    text("UPDATE entry_shares SET view_count = view_count + 1 WHERE id = :sid AND revoked_at IS NULL"),
    {"sid": share.id},
)
```

**改为**：
```python
from sqlalchemy import update

stmt = (
    update(EntryShare)
    .where(EntryShare.id == share.id, EntryShare.revoked_at == None)  # noqa: E711
    .values(view_count=EntryShare.view_count + 1)
)
session.exec(stmt)
```

**原子性确认**：`EntryShare.view_count + 1` 使用 SQLAlchemy column expression，生成 SQL `SET view_count = entry_shares.view_count + 1`，是数据库层面的原子操作。

**BDD 覆盖**：E1-E2

### 2.6 需求 F：migration 注释文档化

**_run_migrations 顶部加注释**（database.py:39-45）：

```python
def _run_migrations(engine: Engine) -> None:
    """Run database migrations for schema evolution.

    Adds new columns to existing tables without breaking existing data.
    Must be called AFTER SQLModel.metadata.create_all() so that
    referenced tables (e.g., users) already exist.

    Note: SQLModel.metadata.create_all() handles CREATE TABLE (including
    entry_shares, entry_reads). This function only handles ALTER TABLE
    migrations for schema evolution on existing databases.
    """
```

**BDD 覆盖**：F1

## §3 BDD 覆盖映射

| BDD | 需求 | 方案节 | 实现位置 |
|-----|------|--------|---------|
| A1 | host 默认 127.0.0.1 | §2.1 | config.py |
| A2 | env var 覆盖 | §2.1 | config.py（已有机制，无需改动） |
| A3 | CLI --host help | §2.1 | cli.py:141 |
| A4 | config list 描述 | §2.1 | cli.py:739 |
| B1 | create 限流 429 | §2.2 | entries.py + rate_limit.py |
| B2 | create 限流正常 | §2.2 | 同上 |
| B3 | update 限流 429 | §2.2 | entries.py + rate_limit.py |
| B4 | delete 限流 429 | §2.2 | entries.py + rate_limit.py |
| B5 | 限流禁用 | §2.2 | 已有机制（limiter.enabled） |
| B6 | 显式装饰器优先级 | §2.2 | rate_limit.py entries_rate_limit |
| C1 | pyproject 无 passlib | §2.3 | pyproject.toml |
| C2 | bcrypt 向后兼容 | §2.3 | bcrypt 4.x 兼容性 |
| D1 | 幂等首次创建 201 | §2.4 | entry_service.py + entries.py |
| D2 | 幂等命中 200 | §2.4 | entry_service.py + entries.py |
| D3 | IntegrityError 幂等 catch | §2.4 | entry_service.py |
| D4 | 无 key 行为不变 | §2.4 | idempotency_key=None 分支跳过 |
| D5 | 删除后 key 可重用 | §2.4 | entry 删除 → key 随 entry 清除 |
| D6 | MCP createEntry 传 key | §2.4.5 | createEntry.ts |
| D7 | 跨用户 key → 409 | §2.4.2 | _find_by_idempotency_key + owner 检查 |
| D8 | 空字符串 → 422 | §2.4.1 | field_validator |
| D9 | 超长 key → 422 | §2.4.1 | max_length=128 |
| D10 | 多 NULL 不冲突 | §2.4.4 | partial index WHERE NOT NULL |
| E1 | 无 text() 查询 | §2.5 | share_service.py |
| E2 | view_count 原子递增 | §2.5.2 | update() 构造器 |
| F1 | migration 注释含关键词 | §2.6 | database.py |

全部 25 条 BDD 已覆盖。

**P1 勘误**：BDD-B3 中 `PUT /api/v1/entries/{slug}` 为笔误，实际端点为 `PATCH /api/v1/entries/{slug}`。本方案 §2.2 已按 PATCH 实现，P1 文档需勘误 PUT→PATCH。

## §4 完成标准

1. `python3 -m ruff check peekview/ tests/` 零错误
2. `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` 全绿
3. `cd packages/mcp-server && npm test` 全绿
4. 新建 entry 不带 idempotency_key → 行为与改动前完全一致（HTTP 201）
5. 新建 entry 带相同 idempotency_key + 同 owner → 返回已有 entry（HTTP 200）
6. 新建 entry 带相同 idempotency_key + 不同 owner → 返回 409
7. idempotency_key="" → 422
8. 默认 host 为 127.0.0.1，已显式配置不受影响
9. entries 三个写入端点有显式 @limiter.limit 装饰器
10. share_service.py 无 text() 调用
11. _run_migrations 顶部注释含 create_all 和 ALTER TABLE
