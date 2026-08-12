---
phase: P2
task_id: T005-default-expires-15d
parent: T005-P1/P1-problems.md
trace_id: T005-P2-20260612
---

# P2 方案设计：默认 15 天过期策略

## 1. 影响域分析

### 1.1 改什么

| 层 | 文件 | 改动点 |
|----|------|--------|
| Backend-Config | `config.py` | `PeekLimits` 新增 `default_expires_in: str = "15d"` + validator |
| Backend-Service | `file_service.py` | `parse_expires_in` 返回类型 `timedelta \| None`，支持 `"0"`/`"0d"`/`"0h"`/`"0m"` → `None` |
| Backend-Service | `entry_service.py` | 默认 fallback + 空字符串处理 + `CreateEntryResponse` 含 `expires_at` |
| Backend-Model | `models.py` | `CreateEntryResponse` 新增 `expires_at`；`EntryListItem` 新增 `expires_at`；`EntryCreate.expires_in`/`CreateEntryRequest.expires_in` 更新 description |
| Backend-API | `config_router.py` | 新增 `GET /api/v1/config/limits` 端点 |
| Backend-CLI | `cli.py` | `--expires-in` help text + `SUPPORTED_CONFIG_KEYS`/`_DESC`/`CONFIG_KEYS_HELP` 添加 `limits.default_expires_in` |
| Backend-Main | `main.py` | 添加 startup config 校验（P1-10） |
| MCP-Tool | `createEntry.ts` | description 更新；响应文本含 `expires_at` |
| MCP-Tool | `publishFiles.ts` | description 更新；响应文本含 `expires_at` |
| MCP-Client | `client.ts` | `CreateEntryResponse` type 新增 `expires_at`（或复用扩展的 `EntryResponse`） |
| Frontend-Types | `api/types.ts` | `EntryListItemResponse` 新增 `expires_at` |
| Frontend-Types | `types/index.ts` | `Entry` 新增 `expiresAt: string \| null` |
| Frontend-API | `api/client.ts` | `transformListItem`/`transformEntry` 映射 `expires_at` → `expiresAt` |
| Frontend-View | `EntryDetailView.vue` | 展示过期信息 |
| Frontend-View | `EntryListView.vue` | 卡片展示过期倒计时 |

### 1.2 不改什么（边界声明）

| 决策 | 理由 |
|------|------|
| **现有 `expires_at=NULL` 条目不动** | 存量数据不受影响，清理任务不处理 NULL 条目。仅新创建的条目走默认过期逻辑。 |
| **不新增 `peekview update` / `peekview clean` CLI 命令** | P1-8（存量条目管理）推迟到后续任务。当前范围仅影响创建路径。 |
| **`EntryResponse`（GET 单条目）已含 `expires_at`** | 无需改动。`EntryResponse` (models.py:384) 和 `_build_response` (entry_service.py:799) 已包含 `expires_at`。 |
| **`EntryBase` SQLModel 不改** | `expires_at` 字段已存在（models.py:98），默认值从 DB 层移到 service 层控制，不修改 DB schema。 |
| **MCP `publish_files` 不注入默认 `expires_in`** | T004 P2 已决策：后端兜底，MCP 不注入默认值。本次保持此策略。MCP 只改进 description 声明和行为反馈。 |
| **前端不新增创建 UI** | P1 已确认前端目前无创建 UI，但设计预留 `/api/v1/config/limits` 端点供未来消费。 |
| **`parse_expires_in` 上限 365d 不变** | 保持 `_MAX_EXPIRES = timedelta(days=365)`，`default_expires_in=365d` 为有效值。 |

### 1.3 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| `parse_expires_in` 返回类型变化 | 所有调用方需适配 | 仅 `entry_service.py` 调用，改动范围可控 |
| `CreateEntryResponse` 新增字段 | MCP Server 需同步更新类型定义 | MCP `EntryResponse` 已含 `expires_at`，`createEntry` 已有此字段（line 43），仅需在响应文本中展示 |
| `EntryListItem` 新增 `expires_at` | 前端列表 API 类型需同步 | 同步更新 `api/types.ts` 和 `types/index.ts` |
| `config_router.py` 新增端点 | 无认证，暴露 limits 信息 | 返回值为公开安全信息（max size、默认过期等），无 secret |
| MCP tool description 动态更新 | MCP Server 与后端版本独立发布 | 不使用动态注入（复杂度高），改用 "server-side" 措辞 |

---

## 2. 逐问题设计方案

### P1-1: 所有创建路径默认不传 → 15 天过期

**数据流**：
```
expires_in=None → service layer → config.limits.default_expires_in → parse_expires_in → timedelta → expires_at
expires_in="7d" → service layer → parse_expires_in → timedelta → expires_at
expires_in="0"  → service layer → parse_expires_in → None → expires_at=None (never)
expires_in=""   → service layer → normalize to None → fallback to default
```

**`entry_service.py` 改动（line 134-138）**：
```python
# Parse expiry
expires_at = None
if expires_in and expires_in.strip():
    delta = parse_expires_in(expires_in)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta
    # delta is None means "never expire"
else:
    # No expires_in specified → use default from config
    default_expires = self.config.limits.default_expires_in
    delta = parse_expires_in(default_expires)
    if delta is not None:
        expires_at = datetime.now(timezone.utc) + delta
```

关键点：
- `expires_in=""` 和 `expires_in=None` 等价，都走默认值（覆盖 P1-9）
- `expires_in="0"` 返回 `delta=None` → `expires_at=None`（永不过期）
- 默认值从 `self.config.limits.default_expires_in` 读取，不硬编码

---

### P1-2: PeekLimits 新增 default_expires_in

**`config.py` — `PeekLimits` 类增加字段**：
```python
default_expires_in: str = Field(
    default="15d",
    description="Default expiration duration for new entries (e.g., '15d', '7d', '1h'). Use '0' for no expiration.",
)
```

**validator**（在 `PeekLimits` 类中）：
```python
@field_validator("default_expires_in", mode="after")
@classmethod
def validate_default_expires_in(cls, v: str) -> str:
    from peekview.services.file_service import parse_expires_in
    import logging
    logger = logging.getLogger("peekview.config")
    try:
        parse_expires_in(v)
    except ValueError as exc:
        logger.warning(
            "Invalid PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=%r: %s. Falling back to '15d'.",
            v, exc,
        )
        return "15d"
    return v
```

环境变量：`PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` 自动生效。

**`cli.py` 改动**：

1. `SUPPORTED_CONFIG_KEYS` (line 528-550)：在 limits 段添加 `"limits.default_expires_in",`
2. `_DESC` (line 724-757)：添加 `("limits", "default_expires_in"): "# 默认过期时长（如 15d、7d、1h，'0' 为永不过期）",`
3. `CONFIG_KEYS_HELP` (line 552-566)：在 limits 行添加 `limits.default_expires_in,`

---

### P1-3: parse_expires_in 支持 "0" 表示永不过期

**`file_service.py` — 改动 `parse_expires_in`**：

返回类型：`timedelta | None`

```python
def parse_expires_in(expires_in: str) -> timedelta | None:
    """..."""
    # Special case: "0" (no unit) means never expire
    if expires_in == "0":
        return None

    match = re.match(r"^(\d+)([hmd])$", expires_in)
    if not match:
        raise ValueError(...)

    value = int(match.group(1))
    unit = match.group(2)

    # "0d"/"0h"/"0m" → never expire
    if value == 0:
        return None

    if unit == "h":
        delta = timedelta(hours=value)
    elif unit == "m":
        delta = timedelta(minutes=value)
    elif unit == "d":
        delta = timedelta(days=value)
    else:
        raise ValueError(f"Unknown time unit: {unit}")

    # Bounds checking (value > 0 guaranteed at this point)
    if delta < _MIN_EXPIRES:
        raise ValueError(...)
    if delta > _MAX_EXPIRES:
        raise ValueError(...)

    return delta
```

改动要点：
- 在正则匹配前处理纯 `"0"` 字符串 → 返回 `None`
- 在 bounds 检查前处理 `value == 0` 的 `"0d"`/`"0h"`/`"0m"` → 返回 `None`
- 不影响现有有效输入（`"7d"`、`"1h"` 等行为不变）
- 错误信息更新，补充 `'0' = no expiration` 提示

---

### P1-4: 跨组件统一验证方案

**验证层次**：

| 层级 | 测试套件 | 验证内容 |
|------|----------|----------|
| Backend unit | `pytest tests/ -k test_create` | `create_entry` 默认 expires_at = now+15d |
| Backend unit | `pytest tests/ -k test_expires` | `parse_expires_in("0")` = None |
| Backend unit | `pytest tests/ -k test_config` | `default_expires_in` env var 正确读取 |
| MCP unit | `npm run test:unit` | tool description 不含硬编码天数 |
| MCP integration | `npm run test:integration` | `publish_files` 不传 `expires_in` → `expires_at` 非空 |
| Frontend e2e | `npm run test:e2e` | 详情页展示过期信息 |
| E2E full | `make debug && make debug-test` | MCP → Backend → 前端全链路 |

**各组件可独立测试**，不要求原子发布。但建议发布顺序：Backend → MCP → Frontend。

---

### P1-5 (隐含 #1): CreateEntryResponse 含 expires_at

**`models.py` — `CreateEntryResponse`** (line 426-435)：
```python
class CreateEntryResponse(SQLModel):
    id: int
    slug: str
    url: str
    is_public: bool
    owner_id: int | None
    expires_at: datetime | None      # <-- 新增
    created_at: datetime
    files: list[FileResponse]
```

**`entry_service.py` — 构造响应** (line 246-254)：
```python
return CreateEntryResponse(
    id=entry_id,
    slug=entry_slug,
    url=self.config.build_view_url(entry_slug),
    is_public=entry_is_public,
    owner_id=entry_owner_id,
    expires_at=expires_at,           # <-- 新增 (来自 line 135-138 解析结果)
    created_at=entry_created_at,
    files=file_responses,
)
```

**MCP `createEntry.ts` — 响应文本** (line 96-103)：
在现有响应文本后追加过期信息：
```typescript
if (entry.expires_at) {
  const expiresDate = new Date(entry.expires_at);
  responseText += `\nExpires: ${expiresDate.toISOString().slice(0, 10)}`;
} else {
  responseText += `\nExpires: never`;
}
```

**MCP `publishFiles.ts` — 响应文本** (line 480-492)：
同上，在 `Link:` 行后追加过期信息。

**MCP `types.ts` — `EntryResponse`** (line 43)：
已含 `expires_at: string \| null`，无需改动。

---

### P1-6 (隐含 #2): CLI/MCP/API 可发现性

**CLI `--expires-in`** (`cli.py:201`)：
```python
@click.option(
    "--expires-in",
    help=(
        "Expiration duration (e.g., '7d', '1h', '30m'). "
        "Default: configured via limits.default_expires_in (15d). "
        "Use '0' for no expiration."
    ),
)
```

不直接引用数字天数，而是引用配置键名。`show_default` 不适合直接使用（默认值动态来自 config），用 help text 说明。

**API OpenAPI — `expires_in` description** (`models.py:302-305`)：
```python
expires_in: str | None = Field(
    default=None,
    description="Duration like '7d', '1h', '30m'. Default: server-configured (usually 15d). Use '0' for no expiration.",
)
```

同样的 description 也应用到 `CreateEntryRequest.expires_in` (models.py:421)。

**MCP `createEntry.ts` — inputSchema expires_in** (line 66)：
```typescript
expires_in: {
  type: 'string',
  description: 'Expiration duration (e.g., "7d", "1h"). Default: configured on server. Use "0" for no expiration.'
},
```

**MCP `publishFiles.ts` — inputSchema expires_in** (line 291)：
```typescript
expires_in: {
  type: 'string',
  description: 'Expiration duration (e.g., "7d", "1h"). Default: configured on server. Use "0" for no expiration.'
},
```

**MCP `createEntry.ts` — tool description** (line 39)：
在 description 末尾追加：
```
- With expiration: {"summary": "Temp report", "files": [...], "expires_in": "7d"}
- No expiration: {"summary": "Permanent", "files": [...], "expires_in": "0"}

Default: If expires_in is omitted, the server's default expiration applies (typically 15d). Check /api/v1/config/limits for current setting.`
```

---

### P1-7 (隐含 #3): MCP tool description 与 backend config 保持同步

**策略**：MCP description 不硬编码天数，使用 "configured on server" 措辞。

> MCP Server 启动时动态读取 `/api/v1/config/limits` → 评估：**推迟**。
>
> 理由：(1) MCP Server 与 Backend 独立发布，backend 配置变更后 MCP 需重启才能感知；(2) MCP Server 可能连接多台 Backend（不同 `default_expires_in`），动态注入增加复杂度；(3) 当前 MCP 无 Backend 健康检查/配置轮询机制。建议后续任务统一处理"配置同步"需求。

当前方案：
- MCP tool description 写 "Default: configured on server" — 不写死具体数字
- 新增 `/api/v1/config/limits` 端点（见 P1-12），MCP 可通过手动查询获知实际值
- Agent 创建条目后，响应文本明确告知 `expires_at`（见 P1-5），Agent 可从响应中得知实际过期时间

---

### P1-8 (隐含 #4): 存量 expires_at=NULL 条目

**推迟**。不在此任务范围。

设计预留：
- 事后可通过 `peekview config set limits.default_expires_in` 调整未来条目的默认值
- 存量条目管理（批量设置过期、查询 NULL 计数）作为后续 Txxx 任务
- 当前行为：`expires_at=NULL` 的条目不被清理任务删除，继续保留

---

### P1-9 (隐含 #5): expires_in="" 空字符串行为

**决策**：等同于 `None` → 使用默认 15d。

**理由**：空字符串在 HTTP JSON 中常见（前端表单未填、Agent 代码未处理 nil），严格拒绝（422）会增加调用方适配成本，且当前语义上 "" 和 None 无区别。

**实现位置**：仅 service 层（`entry_service.py:135`）。

```python
if expires_in and expires_in.strip():
    # 有实际内容 → 解析
    delta = parse_expires_in(expires_in)
else:
    # None / "" / "   " → 使用默认值
    delta = parse_expires_in(self.config.limits.default_expires_in)
```

**不在 Pydantic 层处理**：`CreateEntryRequest.expires_in: str | None = Field(default=None)` — Pydantic 将 `""` 保留为字符串，由 service 层做业务语义归一化。这是现有 pattern（`entry_service.py:111` summary 也是 service 层做 `strip()` 检查）。

---

### P1-10 (隐含 #6): 无效 default_expires_in 配置启动时告警

**实现位置**：`config.py` — `PeekLimits.validate_default_expires_in` validator（见 P1-2 方案）。

行为链：
1. `PeekConfig()` 构造 → 加载 env var `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=999999d`
2. `PeekLimits` 构造 → `validate_default_expires_in` validator 触发
3. `parse_expires_in("999999d")` → `ValueError`（>365d）
4. Validator 捕获异常，打 WARNING 日志，返回 `"15d"`
5. 服务以 `default_expires_in="15d"` 启动，不崩溃

**可观测性**：WARNING 日志输出到 stderr + log_file，运维可通过日志发现配置错误。

**不在 `main.py` startup event 重复检查**：validator 已覆盖。

---

### P1-11 (隐含 #7): 前端展示过期信息

**后端类型改动**：

1. **`models.py` — `EntryListItem`** (line 389-402) 新增：
```python
expires_at: datetime | None
```
注意：`_build_response` 返回 `EntryResponse`（已有 `expires_at`），但 `list_entries` 构建 `EntryListItem` 时遗漏了 `expires_at`。

2. **`entry_service.py` — `list_entries`** (line 381-401)：
在构造 `EntryListItem` 时添加 `expires_at=e.expires_at`。

**前端类型改动**：

1. **`api/types.ts` — `EntryListItemResponse`** (line 4-16) 新增：
```typescript
expires_at: string | null
```
（`EntryResponse` 已含 `expires_at`，无需改动）

2. **`types/index.ts` — `Entry`** 新增：
```typescript
expiresAt: string | null
```

3. **`api/client.ts` — `transformEntry`** (line 59-72)：
```typescript
expiresAt: entry.expires_at,
```

4. **`api/client.ts` — `transformListItem`** (line 43-57)：
```typescript
expiresAt: entry.expires_at,
```

**前端展示改动**：

1. **`EntryDetailView.vue`** — header meta 区域（line 31-33 附近）新增过期倒计时：
```html
<span v-if="entryStore.currentEntry?.expiresAt" class="entry-expires">
  Expires {{ formatExpiresIn(entryStore.currentEntry.expiresAt) }}
</span>
<span v-else-if="entryStore.currentEntry" class="entry-expires entry-expires-never">
  Never expires
</span>
```

`formatExpiresIn` 计算逻辑：
```typescript
function formatExpiresIn(dateStr: string): string {
  const expires = new Date(dateStr)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  if (diffMs <= 0) return 'expired'
  const diffDay = Math.ceil(diffMs / 86400000)
  if (diffDay <= 1) return `in ${Math.ceil(diffMs / 3600000)}h`
  if (diffDay <= 30) return `in ${diffDay}d`
  if (diffDay <= 365) return `in ${Math.ceil(diffDay / 30)}mo`
  return `in ${Math.ceil(diffDay / 365)}y`
}
```

2. **`EntryListView.vue`** — 条目卡片 meta 区域（line 79-87 附近）新增过期标签：
```html
<span v-if="entry.expiresAt" class="meta-item meta-expires"
      :class="{ 'meta-expires-soon': isExpiringSoon(entry.expiresAt) }">
  {{ formatExpiresIn(entry.expiresAt) }}
</span>
```

`isExpiringSoon`：距过期 < 3 天时高亮（warning 色）。

**CSS 变量复用**：`meta-expires` 使用 `--text-secondary`，`meta-expires-soon` 使用 `--warning-color`。

---

### P1-12 (隐含 #8): /api/v1/config/limits 端点

**`config_router.py`** 新增：

```python
class PublicLimitsConfig(BaseModel):
    """Public limits config — safe to expose (no secrets)."""

    default_expires_in: str
    max_file_size: int
    max_entry_files: int
    max_entry_size: int
    max_slug_length: int
    max_summary_length: int


@router.get("/limits", response_model=PublicLimitsConfig)
async def get_limits_config(request: Request) -> PublicLimitsConfig:
    """Return public limits configuration for frontend/MCP consumption.

    These values are safe to expose. No authentication required.
    Frontend uses this to pre-fill creation forms.
    MCP can read this to generate accurate tool descriptions.
    """
    limits = request.app.state.config.limits
    return PublicLimitsConfig(
        default_expires_in=limits.default_expires_in,
        max_file_size=limits.max_file_size,
        max_entry_files=limits.max_entry_files,
        max_entry_size=limits.max_entry_size,
        max_slug_length=limits.max_slug_length,
        max_summary_length=limits.max_summary_length,
    )
```

- 无需认证（public 信息，无 secret）
- 返回 `default_expires_in` 供 MCP/前端消费
- OpenAPI docs 自动生成（FastAPI 自动发现 router）

---

## 3. 数据流总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        创建入口                                  │
│                                                                 │
│  CLI      MCP create_entry    MCP publish_files    API POST     │
│  ────     ───────────────     ────────────────     ────────     │
│                                                                 │
│              expires_in?                expires_in?             │
│              ├─ "7d" ──→ parse ───→ expires_at = now+7d         │
│              ├─ "0"  ──→ parse ───→ expires_at = None (never)   │
│              ├─ ""   ──→ normalize ──→ fallback ↓               │
│              └─ None ──→ fallback ↓                             │
│                                                                 │
│                    config.limits.default_expires_in ("15d")      │
│                              │                                  │
│                    parse_expires_in("15d")                      │
│                              │                                  │
│                    expires_at = now + 15d                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        响应反馈                                  │
│                                                                 │
│  CreateEntryResponse { expires_at, ... }                       │
│         │                                                       │
│         ├──→ MCP Server ──→ Agent: "Expires: 2026-06-27"       │
│         │                                                       │
│         └──→ (未来前端创建 UI 可用)                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        查看消费                                  │
│                                                                 │
│  GET /entries/:slug → EntryResponse { expires_at, ... }         │
│  GET /entries      → EntryListResponse { items[{ expires_at }] }│
│         │                                                       │
│         └──→ 前端展示: "Expires in 14d" / "Never expires"       │
│                                                                 │
│  GET /api/v1/config/limits → { default_expires_in: "15d", ... } │
│         │                                                       │
│         ├──→ 前端创建 UI (未来): 预填默认过期                     │
│         └──→ MCP Server (未来): 动态注入 tool description        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 改动清单（按文件）

### 4.1 `backend/peekview/config.py`
- `PeekLimits` 类新增 `default_expires_in: str = Field(default="15d", ...)`
- 新增 `@field_validator("default_expires_in", mode="after")`

### 4.2 `backend/peekview/models.py`
- `CreateEntryResponse` 新增 `expires_at: datetime | None`
- `EntryListItem` 新增 `expires_at: datetime | None`
- `EntryCreate.expires_in` description 更新
- `CreateEntryRequest.expires_in` description 更新

### 4.3 `backend/peekview/services/file_service.py`
- `parse_expires_in` 返回类型改为 `timedelta | None`
- 新增 `"0"` → `None`、`"0d"/"0h"/"0m"` → `None` 逻辑
- 错误信息更新

### 4.4 `backend/peekview/services/entry_service.py`
- `create_entry` (line 134-138)：默认 fallback 到 `config.limits.default_expires_in`；空字符串视为 None；处理 `delta is None`
- `CreateEntryResponse` 构造 (line 246-254)：添加 `expires_at`
- `list_entries` (line 381-401)：`EntryListItem` 添加 `expires_at`

### 4.5 `backend/peekview/api/config_router.py`
- 新增 `PublicLimitsConfig` model
- 新增 `GET /api/v1/config/limits` 端点

### 4.6 `backend/peekview/cli.py`
- `SUPPORTED_CONFIG_KEYS` 添加 `"limits.default_expires_in"`
- `_DESC` 添加对应描述
- `CONFIG_KEYS_HELP` 添加 key
- `--expires-in` option help text 更新

### 4.7 `packages/mcp-server/src/tools/createEntry.ts`
- tool description 末尾追加默认过期说明 + 永不过期示例
- `expires_in` inputSchema description 更新为 "configured on server"
- handler 响应文本追加 `expires_at` 信息

### 4.8 `packages/mcp-server/src/tools/publishFiles.ts`
- `expires_in` inputSchema description 更新为 "configured on server"
- handler 响应文本追加 `expires_at` 信息

### 4.9 `packages/mcp-server/src/types.ts`
- 无需改动（`EntryResponse` 已含 `expires_at: string | null`）
- 确认 `CreateEntryRequest` (line 19-26) 已含 `expires_in?: string`

### 4.10 `frontend-v3/src/api/types.ts`
- `EntryListItemResponse` 新增 `expires_at: string | null`

### 4.11 `frontend-v3/src/types/index.ts`
- `Entry` 新增 `expiresAt: string | null`

### 4.12 `frontend-v3/src/api/client.ts`
- `transformEntry` 添加 `expiresAt: entry.expires_at`
- `transformListItem` 添加 `expiresAt: entry.expires_at`

### 4.13 `frontend-v3/src/views/EntryDetailView.vue`
- header meta 区域新增过期倒计时显示
- 新增 `formatExpiresIn` 辅助函数
- 新增对应 CSS

### 4.14 `frontend-v3/src/views/EntryListView.vue`
- 卡片 meta 区域新增过期标签
- 复用 `formatExpiresIn`（可从 utils 导入或复制）
- 新增 `isExpiringSoon` 判断

---

## 5. 验收标准（可判定）

| # | AC | 判定方式 |
|---|-----|----------|
| AC1 | `parse_expires_in("0")` 返回 `None` | pytest |
| AC2 | `parse_expires_in("0d")` 返回 `None` | pytest |
| AC3 | `parse_expires_in("7d")` 行为不变（返回 `timedelta(days=7)`） | pytest |
| AC4 | 不传 `expires_in` → `expires_at` = now + 15d | pytest |
| AC5 | `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d` → 不传时 `expires_at` = now + 30d | pytest |
| AC6 | `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=999999d` → 服务启动不崩溃，WARNING 日志，fallback 到 15d | 检查 log |
| AC7 | `CreateEntryResponse` JSON 含 `expires_at` 字段 | pytest |
| AC8 | `EntryListItem` JSON 含 `expires_at` 字段 | pytest |
| AC9 | `GET /api/v1/config/limits` 返回 200 + `default_expires_in` 字段 | pytest |
| AC10 | `peekview create --help` 的 `--expires-in` 行说明默认行为 | manual |
| AC11 | `peekview config list` 输出含 `limits.default_expires_in` | manual |
| AC12 | MCP `create_entry` tool description 不含 "15d" 硬编码数字 | grep |
| AC13 | MCP `publish_files` tool description 不含 "15d" 硬编码数字 | grep |
| AC14 | MCP `create_entry` 不传 `expires_in` → 响应文本含 `expires_at` | MCP integration test |
| AC15 | 前端详情页展示过期信息（有 `expires_at` 时） | Playwright E2E |
| AC16 | 前端详情页展示 "Never expires"（无 `expires_at` 时） | Playwright E2E |
| AC17 | 前端列表卡片展示过期倒计时 | Playwright E2E |
| AC18 | `expires_in=""` 等同于 `None` → 使用默认值 | pytest |
| AC19 | 现有 `expires_at=NULL` 条目 JSON 正确序列化（`null`） | pytest |

---

## 6. 实现顺序建议

```
Phase A: Backend Core
  ├── 6.4 file_service.py  (parse_expires_in 返回类型变更)
  ├── 6.3 models.py        (response/models 字段)
  ├── 6.1 config.py        (default_expires_in + validator)
  ├── 6.2 entry_service.py (默认 fallback + 空字符串 + response 构造)
  └── 6.5 config_router.py (新端点)

Phase B: Backend CLI
  └── 6.6 cli.py

Phase C: MCP Server
  ├── 6.7 createEntry.ts
  ├── 6.8 publishFiles.ts
  └── 6.9 types.ts (确认无需改动)

Phase D: Frontend
  ├── 6.10 api/types.ts
  ├── 6.11 types/index.ts
  ├── 6.12 api/client.ts
  ├── 6.13 EntryDetailView.vue
  └── 6.14 EntryListView.vue
```

**依赖关系**：
- Phase B 依赖 Phase A（CLI 使用 `PeekLimits.default_expires_in`）
- Phase C 依赖 Phase A（MCP 消费 `CreateEntryResponse.expires_at`）
- Phase D 依赖 Phase A（前端消费 `EntryListItem.expires_at`）
- Phase C 和 Phase D 可并行
