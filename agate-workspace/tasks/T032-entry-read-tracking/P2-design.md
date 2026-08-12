---
phase: P2
task_id: T032-entry-read-tracking
type: design
parent: P1-requirements.md
trace_id: T032-P2-20260630
status: draft
created: 2026-06-30
---

# T032 方案设计：Entry 读取路径埋点

## 声明字段

```yaml
packages:
  - peekview              # 后端：新表、新 service、新 API 端点、entry_service 改动、models 改动
  - "@peekview/mcp-server"  # MCP client：添加 X-PeekView-Source header

domains:
  - backend       # 新表 entry_reads、ReadTrackingService、/reads 端点、异步写入
  - api           # GET /entries/{slug}/reads 新端点；现有端点埋点调用
  - frontend      # EntryDetailView 显示 read_stats
  - mcp           # client.ts 添加 X-PeekView-Source header
  - database      # 新表 + 索引 + migration

ui_affected: true
ui_affected_detail:
  - EntryDetailView  # owner 可见 read_stats（读取次数 + channel 分布 + unique readers）

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_e2e: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_mcp: "make test-mcp-unit"
  P6: "cd backend && .venv/bin/python -m pytest tests/test_read_tracking.py -q --tb=no"

env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entry_reads' # should be 0 or match test expectations"

files_to_read:
  - path: backend/peekview/models.py:409-425
    why: EntryResponse schema — 需新增 read_stats 可选字段
  - path: backend/peekview/services/entry_service.py:262-286
    why: EntryService.get_entry — 需在此触发异步埋点
  - path: backend/peekview/services/entry_service.py:820-849
    why: _build_response — 需扩展以包含 read_stats
  - path: backend/peekview/api/entries.py:149-225
    why: list_entries + get_entry — 两个读取端点的埋点入口
  - path: backend/peekview/api/files.py:336-409
    why: get_entry_raw — 需埋点
  - path: backend/peekview/main.py:100-121
    why: create_app 中 service DI 注册 — 新 ReadTrackingService 需注册
  - path: backend/peekview/database.py:35-102
    why: _run_migrations — 新表索引可能需要 migration
  - path: backend/peekview/auth.py:137-160
    why: get_current_user — 理解 reader 身份解析
  - path: packages/mcp-server/src/client.ts:22-61
    why: PeekViewClient.request() — 需添加 X-PeekView-Source header
  - path: frontend-v3/src/api/client.ts:60-82
    why: transformEntry — 需映射 read_stats
  - path: frontend-v3/src/api/types.ts:20-38
    why: EntryResponse type — 需新增 read_stats 字段
  - path: frontend-v3/src/types/index.ts:1-21
    why: Entry interface — 需新增 readStats
  - path: frontend-v3/src/views/EntryDetailView.vue:46-58
    why: header meta 区域 — read_stats 展示位置

minimal_validation:
  assumption: "asyncio.create_task 在 FastAPI 同步路由 handler 中可以正常调度异步写入"
  method: "FastAPI 同步路由 handler 中 asyncio.create_task 不直接可用（无 running loop），需用 BackgroundTasks 或确保路由为 async。验证：entries.py 当前路由均为 async def，可在 async handler 中直接 create_task"
  result: "confirmed"
  note: "entries.py 所有路由已为 async def，可直接使用 asyncio.create_task；同步 service 方法内的 DB 操作仍在独立 Session 中执行，不受影响"
```

## 1. 影响域分析

### 1.1 改什么

| 组件 | 文件 | 改动 |
|------|------|------|
| **新表** | `models.py` | 新增 `EntryRead` SQLModel 表模型 |
| **新 schema** | `models.py` | 新增 `ReadStatsResponse`, `ReadEventResponse`, `ReadEventListResponse` Pydantic schemas |
| **修改 schema** | `models.py` | `EntryResponse` 新增可选字段 `read_stats: ReadStatsResponse \| None` |
| **新 service** | `services/read_tracking_service.py` | `ReadTrackingService` — 异步记录读取事件 + 查询统计 |
| **修改 service** | `services/entry_service.py` | `get_entry` / `_build_response` 扩展 read_stats |
| **修改 API** | `api/entries.py` | `get_entry` / `list_entries` 触发埋点；新增 `GET /{slug}/reads` 端点 |
| **修改 API** | `api/files.py` | `get_entry_raw` 触发埋点 |
| **修改 DI** | `main.py` | 注册 `ReadTrackingService` 到 `app.state` |
| **修改 migration** | `database.py` | 新表索引 migration |
| **MCP client** | `packages/mcp-server/src/client.ts` | headers 添加 `X-PeekView-Source: mcp` |
| **前端 type** | `frontend-v3/src/api/types.ts` | `EntryResponse` 新增 `read_stats` |
| **前端 type** | `frontend-v3/src/types/index.ts` | `Entry` 新增 `readStats` |
| **前端 API** | `frontend-v3/src/api/client.ts` | `transformEntry` 映射 `read_stats` |
| **前端 view** | `frontend-v3/src/views/EntryDetailView.vue` | header meta 区域展示 read_stats |
| **新测试** | `backend/tests/test_read_tracking.py` | 埋点 + 聚合 + 统计 + API 的完整测试 |
| **MCP 测试** | `packages/mcp-server/tests/` | 验证 header 传递 |

### 1.2 不改什么

| 组件 | 理由 |
|------|------|
| `EntryShare` 模型和 share 逻辑 | share 功能独立，view_count 是 share-scoped 的，与 read tracking 互不干扰 |
| `Entry` 表结构 | 不在 entries 表加列，读取统计通过 JOIN/聚合查询 |
| `EntryCreate` / `CreateEntryRequest` | 创建路径无需改动 |
| 认证逻辑 (`auth.py`) | 只读取 current_user 信息，不改变认证流程 |
| CSP / 安全头 | `X-PeekView-Source` 是自定义请求头，不在 CSP 管控范围 |
| Rate limiter | 埋点写入是后台异步的，不增加 API 负载 |
| MCP tool handler 逻辑 | 只改 client 层 header，tool handler 不变 |

### 1.3 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| SQLite 单写者 + 高频写入 | 异步写入堆积可能触发 busy_timeout | 1 分钟窗口聚合大幅减少写入次数；async write 用独立 Session 短事务 |
| asyncio.create_task 异常丢失 | 埋点写入失败静默，无日志 | try/except + logger.warning，不阻断主流程 |
| entry_reads 表增长 | 长期运行后数据量膨胀 | 后续可加定期清理（本 task 不做，但 schema 预留 window_key 支持按窗口归档） |
| Share cookie 路径的 channel 识别 | cookie 访问走 `_check_share_cookie`，需正确标记 channel=share | 在 `_check_share_cookie` 调用点埋点，显式传 channel |
| 非 async 路径调用 | 若有同步路径调用 `record_read`，需用 `run_in_executor` 或 `BackgroundTasks` | 当前所有目标路由均为 `async def`，无此问题 |

## 2. 数据模型设计

### 2.1 新表：entry_reads

```sql
CREATE TABLE entry_reads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    action      TEXT NOT NULL DEFAULT 'read',       -- 'read' | 'discover'
    channel     TEXT NOT NULL DEFAULT 'api',        -- 'api' | 'mcp' | 'share' | 'cli'
    reader_type TEXT NOT NULL DEFAULT 'anonymous',  -- 'authenticated' | 'anonymous'
    reader_id   INTEGER,                            -- user.id or NULL
    is_self_read BOOLEAN NOT NULL DEFAULT 0,        -- reader == entry owner?
    count       INTEGER NOT NULL DEFAULT 1,         -- 窗口内聚合计数
    window_key  TEXT NOT NULL,                      -- 聚合窗口标识 "{entry_id}:{reader_fingerprint}:{channel}:{window_timestamp}"
    read_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),  -- 最早读取时间（窗口内）
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),  -- 最后更新时间

    CONSTRAINT uq_entry_reads_window UNIQUE (window_key)
);

CREATE INDEX idx_entry_reads_entry_id ON entry_reads(entry_id);
CREATE INDEX idx_entry_reads_entry_channel ON entry_reads(entry_id, channel);
CREATE INDEX idx_entry_reads_reader ON entry_reads(reader_id);
CREATE INDEX idx_entry_reads_read_at ON entry_reads(read_at);
```

**设计决策**：

1. **窗口聚合**：`window_key` = `{entry_id}:{reader_fingerprint}:{channel}:{window_timestamp}`
   - `reader_fingerprint`：authenticated 用户用 `u:{user_id}`，anonymous 用 `a:{ip_hash[:8]}`（IP 前 8 位 hash，做粗粒度去重，不存完整 IP）
   - `window_timestamp`：`read_at` 截断到分钟（如 `2026-06-30T14:23`）
   - 同一窗口内同一 reader+entry+channel → `UPDATE count=count+1, updated_at=now`（UNIQUE 约束 + UPSERT）
   - 每分钟每 reader 每 entry 只产生一行（最坏：60 reads/min → 1 row）

2. **为什么用 window_key 而非多列 UNIQUE**：单列 UNIQUE 约束更简洁，UPSERT 语法更简单（`INSERT ... ON CONFLICT(window_key) DO UPDATE`）。多列 UNIQUE（entry_id, reader_fingerprint, channel, window_timestamp）功能等价但列名更多。

3. **reader_fingerprint 不存完整 IP**：隐私考虑。anonymous 读者用 IP hash 前 8 位做粗粒度窗口聚合，不存储可识别信息。authenticated 用户用 `u:{user_id}`。

4. **action 字段**：区分 `read`（单 entry 读取）和 `discover`（list 操作），满足 B11/B14。

5. **is_self_read**：owner 自己读取标记为 true，统计 unique_readers 时排除，满足 B04/B05。

### 2.2 SQLModel 模型

```python
class EntryRead(SQLModel, table=True):
    __tablename__ = "entry_reads"
    __table_args__ = (
        Index("idx_entry_reads_entry_id", "entry_id"),
        Index("idx_entry_reads_entry_channel", "entry_id", "channel"),
        Index("idx_entry_reads_reader", "reader_id"),
        Index("idx_entry_reads_read_at", "read_at"),
        {"sqlite_autoincrement": True},
    )

    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(foreign_key="entries.id", index=True)
    action: str = Field(default="read", max_length=20)
    channel: str = Field(default="api", max_length=20)
    reader_type: str = Field(default="anonymous", max_length=20)
    reader_id: int | None = Field(default=None)
    is_self_read: bool = Field(default=False)
    count: int = Field(default=1)
    window_key: str = Field(unique=True, max_length=200)
    read_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
```

### 2.3 Pydantic Schemas

```python
class ReadStatsResponse(SQLModel):
    total_count: int = 0
    unique_readers: int = 0
    by_channel: dict[str, int] = {}  # {"api": 5, "mcp": 3, "share": 1}
    last_read_at: datetime | None = None

class ReadEventResponse(SQLModel):
    id: int
    action: str
    channel: str
    reader_type: str
    reader_id: int | None
    is_self_read: bool
    count: int
    read_at: datetime
    updated_at: datetime

class ReadEventListResponse(SQLModel):
    items: list[ReadEventResponse]
    total: int
    page: int
    per_page: int
```

### 2.4 EntryResponse 扩展

```python
class EntryResponse(SQLModel):
    # ... 现有字段不变 ...
    read_stats: ReadStatsResponse | None = None  # 新增，仅 owner/admin 可见
```

## 3. ReadTrackingService 设计

### 3.1 接口

```python
class ReadTrackingService:
    def __init__(self, engine: Engine):
        self.engine = engine

    def record_read(
        self,
        entry_id: int,
        entry_owner_id: int | None,
        action: str,            # "read" | "discover"
        channel: str,           # "api" | "mcp" | "share" | "cli"
        reader_id: int | None,
        reader_ip: str | None,  # 用于 anonymous fingerprint
    ) -> None:
        """记录读取事件（UPSERT 窗口聚合）。同步方法，在独立 Session 中执行。"""

    def get_read_stats(self, entry_id: int) -> ReadStatsResponse:
        """获取 entry 的读取统计。"""

    def get_read_events(
        self,
        entry_id: int,
        page: int = 1,
        per_page: int = 20,
    ) -> ReadEventListResponse:
        """获取 entry 的读取事件列表（分页）。"""
```

### 3.2 record_read 核心逻辑

```python
def record_read(self, entry_id, entry_owner_id, action, channel, reader_id, reader_ip):
    # 1. 计算 reader_fingerprint
    if reader_id is not None:
        fingerprint = f"u:{reader_id}"
    elif reader_ip:
        fingerprint = f"a:{hashlib.sha256(reader_ip.encode()).hexdigest()[:8]}"
    else:
        fingerprint = "a:unknown"

    # 2. 计算 is_self_read
    is_self_read = (reader_id is not None and reader_id == entry_owner_id)

    # 3. 计算 window_key
    now = datetime.now(timezone.utc)
    window_ts = now.strftime("%Y-%m-%dT%H:%M")  # 截断到分钟
    window_key = f"{entry_id}:{fingerprint}:{channel}:{window_ts}"

    reader_type = "authenticated" if reader_id is not None else "anonymous"

    # 4. UPSERT
    with Session(self.engine) as session:
        existing = session.exec(
            select(EntryRead).where(EntryRead.window_key == window_key)
        ).first()
        if existing:
            existing.count += 1
            existing.updated_at = now
            session.add(existing)
        else:
            record = EntryRead(
                entry_id=entry_id,
                action=action,
                channel=channel,
                reader_type=reader_type,
                reader_id=reader_id,
                is_self_read=is_self_read,
                count=1,
                window_key=window_key,
                read_at=now,
                updated_at=now,
            )
            session.add(record)
        session.commit()
```

**注意**：虽然 `window_key` 有 UNIQUE 约束，这里用 select-then-update 而非 raw SQL UPSERT，原因是 SQLModel 的 `ON CONFLICT DO UPDATE` 需要原始 SQL。select-then-update 在高并发下有 TOCTOU 风险，但：
- SQLite WAL 模式下写是串行的，同一 writer connection 不会并发
- 窗口聚合本身就是 1 分钟粒度，同一 reader+entry+channel 在同一秒内并发 UPSERT 的概率极低
- 若发生 UNIQUE 约束冲突，IntegrityError 会被 catch 并 retry 一次

**更优方案**（若 TOCTOU 成为问题）：用 raw SQL `INSERT INTO entry_reads ... ON CONFLICT(window_key) DO UPDATE SET count=count+1, updated_at=excluded.updated_at`。P4 实现时可选择此方案。

### 3.3 get_read_stats 核心逻辑

```python
def get_read_stats(self, entry_id: int) -> ReadStatsResponse:
    with Session(self.engine) as session:
        # total_count: SUM(count) WHERE entry_id = ? AND is_self_read = false
        # unique_readers: COUNT(DISTINCT reader_id) WHERE reader_id IS NOT NULL AND is_self_read = false
        #                 + COUNT(DISTINCT window_key 分组) WHERE reader_type = 'anonymous' AND is_self_read = false
        #                 （简化：unique_readers = COUNT(DISTINCT reader_fingerprint) WHERE is_self_read = false）
        # by_channel: SUM(count) GROUP BY channel WHERE is_self_read = false
        # last_read_at: MAX(updated_at) WHERE entry_id = ?
```

**unique_readers 计算说明**：从 `window_key` 中提取 `reader_fingerprint` 部分（第 2 段），用 `COUNT(DISTINCT ...)` 去重。需要 raw SQL 子串提取。或者，在表中冗余存储 `reader_fingerprint` 列，简化查询。**决定：冗余存储 `reader_fingerprint` 列**，避免 window_key 解析。

更新模型：

```python
class EntryRead(SQLModel, table=True):
    # ... 原有字段 ...
    reader_fingerprint: str = Field(default="", max_length=50)  # "u:1" or "a:abc12345"
```

`unique_readers` 查询：
```sql
SELECT COUNT(DISTINCT reader_fingerprint) FROM entry_reads
WHERE entry_id = ? AND is_self_read = 0 AND action = 'read'
```

### 3.4 异步写入策略

在 API 路由（async def）中：

```python
import asyncio

async def get_entry(slug, ...):
    # ... 现有业务逻辑 ...
    response = service.get_entry(...)

    # 异步埋点（不阻塞响应）
    asyncio.create_task(_record_read_async(
        app.state.read_tracking_service,
        entry_id=response.id,
        entry_owner_id=response.owner_id,
        action="read",
        channel=_detect_channel(request),
        reader_id=current_user.id if current_user else None,
        reader_ip=request.client.host if request.client else None,
    ))

    return response

async def _record_read_async(service, **kwargs):
    """异步包装，捕获异常避免影响主流程。"""
    try:
        # record_read 是同步 DB 操作，在 asyncio 中会阻塞 event loop
        # 但 SQLite 写入极快（<1ms），且窗口聚合后写入频率极低
        # 若需完全非阻塞，可用 run_in_executor
        service.record_read(**kwargs)
    except Exception as e:
        logger.warning("Failed to record read event: %s", e)
```

**B07 验证策略**：pytest 中测量 `get_entry` 响应时间，对比有/无埋点差异 <5ms。由于 `create_task` 不 await，响应不等待 DB 写入完成。

**关于 event loop 阻塞**：`record_read` 是同步 DB 操作，在 `create_task` 的协程中执行会短暂阻塞 event loop。对于 SQLite WAL 下的单行 UPSERT，延迟通常 <1ms。若后续出现延迟问题，可改用 `loop.run_in_executor(None, service.record_read, ...)` 将 DB 操作移到线程池。P4 实现时先用 `create_task` + 同步调用，若 P5 性能测试不达标再改 `run_in_executor`。

## 4. Channel 检测逻辑

```python
def _detect_channel(request: Request) -> str:
    """从请求特征推断读取来源。"""
    # 1. MCP 主动声明（最高优先级）
    source = request.headers.get("X-PeekView-Source", "").lower()
    if source == "mcp":
        return "mcp"

    # 2. Share 参数/cookie
    if "share=" in request.url.query:
        return "share"
    # _check_share_cookie 路径由调用方显式传 channel="share"

    # 3. 默认 api
    return "api"
```

**说明**：
- MCP client 在 headers 中添加 `X-PeekView-Source: mcp`，后端读取此 header
- Share 访问通过 `?share=` query param 或 share cookie，在埋点调用时显式传 `channel="share"`
- 其他所有访问默认 `channel="api"`
- `cli` channel 暂不使用（CLI 走 HTTP API 时 header 相同，无法区分），预留

## 5. API 变更

### 5.1 现有端点埋点

| 端点 | 埋点位置 | action | channel |
|------|----------|--------|---------|
| `GET /entries/{slug}` | `get_entry` 末尾 | `read` | `_detect_channel(request)` 或 `share` |
| `GET /entries` | `list_entries` 末尾 | `discover` | `_detect_channel(request)` |
| `GET /entries/{slug}/raw` | `get_entry_raw` 末尾 | `read` | `_detect_channel(request)` |

**Share cookie 路径**：`_check_share_cookie` 返回后，`get_entry` 路由中在 `cookie_result` 分支埋点，显式 `channel="share"`。

### 5.2 新端点

```
GET /api/v1/entries/{slug}/reads
```

- **权限**：owner 或 admin
- **查询参数**：`page`, `per_page`
- **响应**：`ReadEventListResponse`
- **用途**：owner 查看详细读取历史（B13）

### 5.3 EntryResponse 扩展

`GET /entries/{slug}` 响应中，当请求者是 owner 或 admin 时，`read_stats` 字段填充数据；否则为 `null`（B09/B10）。

`EntryService.get_entry` 需新增参数 `include_read_stats: bool = False`，由 API 层根据 `current_user_id == entry.owner_id or is_admin` 决定是否传入 `True`。

**实现方式**：在 `_build_response` 中，若 `include_read_stats=True`，调用 `ReadTrackingService.get_read_stats(entry_id)` 填充字段。

## 6. MCP 变更

### 6.1 client.ts 修改

```typescript
// PeekViewClient.request() 方法中，headers 添加：
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${userToken}`,
  'X-PeekView-Source': 'mcp',  // 新增
};
```

**影响范围**：所有通过 `PeekViewClient.request()` 发出的请求都会带此 header，包括：
- `createEntry` → 不影响（写操作不埋点）
- `getEntry` → channel=mcp
- `listEntries` → channel=mcp, action=discover
- `deleteEntry` → 不影响（写操作不埋点）

### 6.2 无需修改 MCP tool handlers

MCP tool handler（`getEntry.ts`, `listEntries.ts`）不感知 header 变更，仅 client 层修改。

## 7. 前端变更

### 7.1 类型扩展

**`frontend-v3/src/api/types.ts`**：
```typescript
export interface ReadStatsResponse {
  total_count: number
  unique_readers: number
  by_channel: Record<string, number>
  last_read_at: string | null
}

// EntryResponse 新增：
export interface EntryResponse {
  // ... 现有字段 ...
  read_stats?: ReadStatsResponse | null
}
```

**`frontend-v3/src/types/index.ts`**：
```typescript
export interface ReadStats {
  totalCount: number
  uniqueReaders: number
  byChannel: Record<string, number>
  lastReadAt: string | null
}

export interface Entry {
  // ... 现有字段 ...
  readStats?: ReadStats | null
}
```

### 7.2 API client 映射

**`frontend-v3/src/api/client.ts`** `transformEntry`：
```typescript
readStats: entry.read_stats
  ? {
      totalCount: entry.read_stats.total_count,
      uniqueReaders: entry.read_stats.unique_readers,
      byChannel: entry.read_stats.by_channel,
      lastReadAt: entry.read_stats.last_read_at,
    }
  : null,
```

### 7.3 UI 展示

**`frontend-v3/src/views/EntryDetailView.vue`** header meta 区域：

在 `entry-expires` 旁添加 read_stats 展示（仅当 `readStats` 存在时显示）：

```html
<span v-if="currentEntry?.readStats" class="entry-read-stats desktop-only">
  {{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}
  <template v-if="Object.keys(currentEntry.readStats.byChannel).length > 1">
    (API {{ currentEntry.readStats.byChannel.api ?? 0 }}, MCP {{ currentEntry.readStats.byChannel.mcp ?? 0 }})
  </template>
</span>
```

**样式**：跟随现有 `entry-time` / `entry-expires` 的样式，小号灰色文字。

**交互**：纯展示，无点击/展开。分析面板留给后续 task。

## 8. BDD 覆盖矩阵

| BDD | 设计覆盖点 | 关键实现 |
|-----|-----------|----------|
| B01 | §3 record_read, §5.1 get_entry 埋点 | channel=api, reader_type from auth |
| B02 | §4 _detect_channel, §6.1 MCP header | X-PeekView-Source: mcp → channel=mcp |
| B03 | §5.1 share cookie 路径埋点 | _check_share_cookie 分支 channel="share" |
| B04 | §3.2 is_self_read 计算 | reader_id != entry_owner_id → false |
| B05 | §3.2 is_self_read 计算 | reader_id == entry_owner_id → true |
| B06 | §3.2 reader_type 判断 | reader_id=None → reader_type="anonymous" |
| B07 | §3.4 asyncio.create_task | 异步写入，不 await |
| B08 | §2.1 窗口聚合 | window_key UNIQUE + count 递增 |
| B09 | §5.3 EntryResponse 扩展 | owner/admin → read_stats 填充 |
| B10 | §5.3 EntryResponse 扩展 | 非 owner → read_stats=null |
| B11 | §5.1 list_entries 埋点 | action="discover" |
| B12 | §5.1 get_entry_raw 埋点 | action="read" |
| B13 | §5.2 新端点 | GET /entries/{slug}/reads |
| B14 | §4 + §6.1 | MCP listEntries → channel=mcp, action=discover |

## 9. 实现计划

### Step 1: 数据模型（models.py）
- 新增 `EntryRead` SQLModel 表
- 新增 `ReadStatsResponse`, `ReadEventResponse`, `ReadEventListResponse` schemas
- `EntryResponse` 新增 `read_stats` 可选字段

### Step 2: ReadTrackingService（services/read_tracking_service.py）
- `record_read()` — UPSERT 窗口聚合
- `get_read_stats()` — 统计查询
- `get_read_events()` — 分页事件列表

### Step 3: DI 注册（main.py）
- `ReadTrackingService` 实例化 → `app.state.read_tracking_service`

### Step 4: API 层埋点（api/entries.py, api/files.py）
- `get_entry` — 异步埋点 + read_stats 填充
- `list_entries` — 异步埋点 discover
- `get_entry_raw` — 异步埋点 read
- 新端点 `GET /{slug}/reads`
- `_detect_channel()` 辅助函数

### Step 5: MCP client header（packages/mcp-server/src/client.ts）
- 添加 `X-PeekView-Source: mcp`

### Step 6: 前端类型 + 映射 + 展示
- types.ts / types/index.ts / client.ts / EntryDetailView.vue

### Step 7: 测试
- `test_read_tracking.py` — 覆盖所有 14 条 BDD
- MCP unit test — 验证 header

## 10. 完成标志

1. `entry_reads` 表创建成功，UNIQUE(window_key) 约束生效
2. 4 个读取路径（get_entry, list_entries, get_entry_raw, share_cookie）均触发埋点
3. 1 分钟窗口内同一 reader+entry+channel 只产生 1 行（count 递增）
4. `asyncio.create_task` 埋点不影响 API 响应时间（<5ms 增加）
5. MCP 请求正确识别 channel=mcp
6. Owner 在 entry 详情页可见 read_stats
7. 非 owner 的 read_stats 为 null
8. `GET /entries/{slug}/reads` 返回分页读取事件列表
9. 14 条 BDD 全部通过
10. `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` 全绿
11. `cd frontend-v3 && npx vue-tsc --noEmit` 通过
12. `make test-mcp-unit` 通过
