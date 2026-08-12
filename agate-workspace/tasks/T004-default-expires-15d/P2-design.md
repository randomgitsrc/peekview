---
phase: P2
task_id: T004-default-expires-15d
parent: T004-P1/P1-problems.md
trace_id: T004-P2-20260612
---

# P2 方案设计：默认 15 天过期策略

## 1. 影响域分析

### 1.1 改什么

| # | 文件 | 改动内容 |
|---|------|----------|
| 1 | `backend/peekview/config.py` | `PeekLimits` 新增 `default_expires_in: str = "15d"` |
| 2 | `backend/peekview/services/file_service.py` | `parse_expires_in` 支持 `"0"`/`"0d"`/`"0h"`/`"0m"` → 返回 `None`；返回类型 `timedelta` → `timedelta \| None` |
| 3 | `backend/peekview/services/entry_service.py` | `create_entry()` 中：`expires_in` 为 `None` 时 fallback 到 `self.config.limits.default_expires_in`；适配 `parse_expires_in` 新返回类型 |
| 4 | `backend/peekview/services/apikey_service.py` | `create_api_key()` 适配 `parse_expires_in` 新返回类型 |
| 5 | `backend/peekview/cli.py` | `SUPPORTED_CONFIG_KEYS` / `_DESC` / `CONFIG_KEYS_HELP` 添加 `limits.default_expires_in` |
| 6 | `backend/peekview/api/config_router.py` | 新增 `GET /api/v1/config/limits` 端点暴露 `limits.default_expires_in` |
| 7 | `packages/mcp-server/src/tools/publishFiles.ts` | `expires_in` 字段 description 注明默认值 15d 和 "0" = 永不过期 |
| 8 | `packages/mcp-server/src/tools/createEntry.ts` | 同上 |
| 9 | `backend/tests/test_file_service.py` | 更新 `parse_expires_in` 相关测试用例（"0" 不再抛错） |

### 1.2 不改什么

| 范围 | 说明 |
|------|------|
| `CreateEntryRequest.expires_in` 默认值 | 保留 `str \| None = None`，不从 schema 层注默认值 |
| `EntryCreate.expires_in` 默认值 | 同上 |
| CLI `--expires-in` Click option | 保留 `default=None`，由 service 层兜底 |
| API 端点 `entries.py` | 不改动，`data.expires_in` 原样透传给 service |
| MCP 调用链 `params.expires_in` | 不注入默认值；后端自动兜底，MCP 只需更新文档说明 |
| 清理任务 (`cleanup`) | 逻辑不变，`expires_at=NULL` 的条目不受影响 |
| 现有 `expires_at=NULL` 条目 | 不迁移、不受影响 |
| `EntryBase.expires_at` | 不改，`datetime \| None = None` 保持不变 |
| 前端列表页 (`EntryListView.vue`) | 当前无创建 UI，不改 |

### 1.3 风险在哪

| 风险 | 说明 | 缓解 |
|------|------|------|
| `parse_expires_in` 返回值语义变化 | `timedelta` → `timedelta \| None`，所有调用方需更新 | 只有 2 处调用方（entry_service + apikey_service），逐个适配 |
| 部署者不想要默认过期 | 默认 "15d" 对只想长期存档的用户是困扰 | 可配 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN="0"` 回退到永不过期；`peekview config set limits.default_expires_in 0` |
| MCP 不注入默认值导致行为与后端配置不同步 | MCP 所在机器可能连不同的后端，各自配置不同 | MCP tool description 声明默认行为，Agent 可自行决定是否显式传 `expires_in` |

---

## 2. 核心设计方案

### 2.1 默认值解析的数据流

```
用户不传 expires_in
  → CreateEntryRequest.expires_in = None
  → entry_service.create_entry(expires_in=None)
  → if expires_in is None: expires_in = self.config.limits.default_expires_in  # "15d"
  → parse_expires_in("15d") → timedelta(days=15)
  → expires_at = now + 15d

用户传 expires_in="0"
  → CreateEntryRequest.expires_in = "0"
  → entry_service.create_entry(expires_in="0")
  → expires_in is not None, no fallback
  → parse_expires_in("0") → None
  → expires_at = None  # 永不过期

用户传 expires_in="7d"
  → 所有路径不变，正常解析
```

### 2.2 config.py — PeekLimits 新增字段

```python
# backend/peekview/config.py, PeekLimits 类
default_expires_in: str = Field(
    default="15d",
    description="Default expiration duration for new entries. Use '0' for never expire.",
)
```

- 环境变量: `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`
- 配置文件: `peekview config set limits.default_expires_in 7d`
- 设为 `"0"` 即恢复全站永不过期行为

### 2.3 file_service.py — parse_expires_in 改造

**当前签名**: `def parse_expires_in(expires_in: str) -> timedelta`

**新签名**: `def parse_expires_in(expires_in: str) -> timedelta | None`

**新逻辑**:
```python
def parse_expires_in(expires_in: str) -> timedelta | None:
    # "0" → never expire (bare, no unit)
    if expires_in == "0":
        return None

    match = re.match(r"^(\d+)([hmd])$", expires_in)
    if not match:
        raise ValueError(...)

    value = int(match.group(1))
    unit = match.group(2)

    # Zero value with unit → never expire
    if value == 0:
        return None

    if unit == "h":
        delta = timedelta(hours=value)
    elif unit == "m":
        delta = timedelta(minutes=value)
    elif unit == "d":
        delta = timedelta(days=value)
    else:
        raise ValueError(...)

    # Bounds check (skip for zero, which was already handled above)
    if delta < _MIN_EXPIRES:
        raise ValueError(...)
    if delta > _MAX_EXPIRES:
        raise ValueError(...)

    return delta
```

关键点:
- `"0"`（裸零）→ `None`（永不过期）
- `"0d"`, `"0h"`, `"0m"` → `None`（永不过期）
- 零值在 bounds check **之前** return，不会触发 "at least 1 minute" 错误
- 非零值 bounds check 不变

### 2.4 entry_service.py — create_entry 默认兜底

**改动位置**: `create_entry()` 方法，`expires_in: str | None = None` 签名不变

```python
def create_entry(
    self,
    ...
    expires_in: str | None = None,
    ...
) -> CreateEntryResponse:
    # ... (summary/slug 验证不变) ...

    # 默认兜底：未显式指定时使用配置中的默认值
    if expires_in is None:
        expires_in = self.config.limits.default_expires_in

    # 解析过期时间（"0" → parse_expires_in 返回 None → 永不过期）
    expires_at = None
    delta = parse_expires_in(expires_in)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta

    # ... (其余不变) ...
```

注意: `expires_in` 在函数内被 reassign，需确保不影响 `_retry_with_slug_suffix`。检查后确认: `_retry_with_slug_suffix` 接收自己的 `expires_in` 参数，会被自己的默认兜底逻辑覆盖，不受影响。

### 2.5 apikey_service.py — 适配新返回值

`create_api_key()` 中同样调用 `parse_expires_in`，需适配:

```python
# 改动前
if expires_in:
    delta = parse_expires_in(expires_in)
    expires_at = datetime.now(timezone.utc) + delta

# 改动后
if expires_in:
    delta = parse_expires_in(expires_in)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta
```

注意: API Key 的 `expires_in` 不应自动套用 `default_expires_in`（API Key 默认永不过期是合理的），所以只修改返回值适配，不添加默认值注入。

### 2.6 cli.py — 配置键补充

需在三处添加 `limits.default_expires_in`:

1. **`SUPPORTED_CONFIG_KEYS`** (line 543): 在 limits 组添加 `"limits.default_expires_in"`
2. **`CONFIG_KEYS_HELP`** (line 561): 添加 `limits.default_expires_in`
3. **`_DESC` dict** (line 748): 添加 `("limits", "default_expires_in"): "# 新条目的默认过期时长 (例: 15d, 0=永不过期)"`

无需修改 `config_set` 的类型转换逻辑 — `default_expires_in` 不匹配任何现有模式，会原样作为字符串存储，这是正确的。

### 2.7 API config_router.py — 公开 limits 端点

当前 `config_router.py` 只暴露 captcha 配置。新增端点供前端读取默认过期配置:

```python
# GET /api/v1/config/limits
@router.get("/limits", response_model=PublicLimitsConfig)
async def get_limits_config(request: Request) -> PublicLimitsConfig:
    config = request.app.state.config
    return PublicLimitsConfig(
        max_file_size=config.limits.max_file_size,
        max_entry_files=config.limits.max_entry_files,
        max_entry_size=config.limits.max_entry_size,
        max_slug_length=config.limits.max_slug_length,
        max_summary_length=config.limits.max_summary_length,
        max_per_page=config.limits.max_per_page,
        default_expires_in=config.limits.default_expires_in,
    )
```

对应 Pydantic model:
```python
class PublicLimitsConfig(BaseModel):
    max_file_size: int
    max_entry_files: int
    max_entry_size: int
    max_slug_length: int
    max_summary_length: int
    max_per_page: int
    default_expires_in: str
```

### 2.8 MCP — tool description 更新

MCP 工具不注入默认过期值（后端自动兜底），但更新 tool description 告知 Agent 默认行为:

**publishFiles.ts** - `expires_in` 字段 description:
```
Expiration duration (e.g., "7d", "1h"). Default: 15d (server-side). Use "0" for no expiration.
```

**createEntry.ts** - 同上:
```
Expiration duration (e.g., "7d", "1h"). Default: 15d (server-side). Use "0" for no expiration.
```

**createEntry.ts** - tool description 末尾补一条说明:
在 `inputSchema` description 中添加:
```
Entries expire after 15 days by default. Set expires_in to "0" for permanent entries.
```

此外，`createEntry.ts` 的 zod schema 和工具 description 示例中移除显式硬编码 "7d" 的例子（保留 "7d" 作为示例值，但说明默认 15d）。

### 2.9 前端 — 当前无变动，预留接口

**现状**: 前端（`frontend-v3`）是纯只读视图，`EntryListView.vue` 和 `HomeView.vue` 均无创建入口 UI。`api/client.ts` 中无 `createEntry` 方法。

**本次设计**: 前端不做 UI 改动。添加 `GET /api/v1/config/limits`（见 2.7）供前端未来消费。

**未来创建 UI 设计指引**（非本任务范围）:
- 从 `/api/v1/config/limits` 读取 `default_expires_in` 作为 expires_in 字段的预填值
- 提供 "永不过期" 复选框，选中时 expires_in=`"0"`
- 提供常用快捷选项: 1h / 1d / 7d / 15d（默认）/ 30d / 永不过期
- UI 文案显示: "Expires in: 15 days (default)"

---

## 3. 数据流汇总

```
                    ┌──────────┐
                    │  Config  │  PeekLimits.default_expires_in = "15d"
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │   CLI   │    │ API POST │    │ MCP Tool │
    │ create  │    │ /entries │    │ publish/ │
    │  不传   │    │ 不传字段  │    │  create  │
    │ exp_in  │    │ exp_in   │    │  不传    │
    └────┬────┘    └────┬─────┘    └────┬─────┘
         │              │              │
         │   None       │   None       │  undefined
         ▼              ▼              ▼
    ┌─────────────────────────────────────────┐
    │         EntryService.create_entry()      │
    │  if expires_in is None:                  │
    │      expires_in = config.default         │  ← 兜底
    │  parse_expires_in(expires_in)            │
    │      "15d" → timedelta(days=15)          │
    │      "0"   → None (never expire)         │
    │      None  → expires_at = None           │
    └─────────────────────────────────────────┘
```

---

## 4. 实现完成的标志

### AC1: config.py
- [ ] `PeekLimits` 新增 `default_expires_in: str = "15d"`
- [ ] 环境变量 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN` 可覆盖
- [ ] `peekview config list` 显示 `limits.default_expires_in: 15d`
- [ ] `peekview config set limits.default_expires_in 30d` 写入配置并提示重启

### AC2: parse_expires_in
- [ ] `parse_expires_in("0")` 返回 `None`（不抛异常）
- [ ] `parse_expires_in("0d")` 返回 `None`
- [ ] `parse_expires_in("0h")` 返回 `None`
- [ ] `parse_expires_in("0m")` 返回 `None`
- [ ] `parse_expires_in("1h")` 行为不变（返回 `timedelta(hours=1)`）
- [ ] 原有测试 `test_expires_in_zero` 和 `test_expires_in_minimum_1_minute` 更新为通过

### AC3: entry_service.create_entry
- [ ] 不传 `expires_in` → `expires_at = now + 15d`
- [ ] 传 `expires_in="7d"` → `expires_at = now + 7d`
- [ ] 传 `expires_in="0"` → `expires_at = None`（永不过期）
- [ ] 传 `expires_in=None` + `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` → `expires_at = now + 30d`
- [ ] `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN="0"` → 不传时 `expires_at = None`

### AC4: apikey_service
- [ ] 传 `expires_in="0"` → `expires_at = None`（永不过期）
- [ ] 不传 `expires_in` → 行为不变（`expires_at = None`）

### AC5: CLI
- [ ] `peekview config list` 显示 `limits.default_expires_in` 及其描述
- [ ] `peekview config set limits.default_expires_in 7d` 成功
- [ ] `--expires-in` 不传时自动使用默认值

### AC6: config_router
- [ ] `GET /api/v1/config/limits` 返回 200，包含 `default_expires_in` 字段
- [ ] 返回值中 `default_expires_in` 与 `config.limits.default_expires_in` 一致

### AC7: MCP
- [ ] `publish_files` tool description 中 `expires_in` 字段说明包含 "Default: 15d"
- [ ] `create_entry` tool description 中 `expires_in` 字段说明包含 "Default: 15d"
- [ ] 不传 `expires_in` 时，后端创建的条目 `expires_at = now + 15d`

### AC8: 向后兼容
- [ ] 已有 `expires_at=NULL` 条目不变
- [ ] 清理任务逻辑不变
- [ ] `parse_expires_in` 原有有效输入行为不变

---

## 5. 测试策略要点

| 测试层 | 关键测试 |
|--------|----------|
| 单元 (`test_file_service.py`) | `parse_expires_in("0")` / `"0d"` / `"0h"` / `"0m"` → `None`；`"1h"` 行为不变 |
| 单元 (`test_entry_service.py`) | 不传 `expires_in` → `expires_at` 为 15 天后；传 `"0"` → `expires_at=None`；config 覆盖默认值 |
| 单元 (`test_config.py`) | `PeekLimits.default_expires_in` 默认 "15d"；环境变量覆盖 |
| 集成 | API POST `/entries` 不传 `expires_in` → 返回的 `expires_at` 非 NULL |
| E2E (MCP) | `publish_files` / `create_entry` 不传 `expires_in` → 后端条目 `expires_at = now + 15d` |
