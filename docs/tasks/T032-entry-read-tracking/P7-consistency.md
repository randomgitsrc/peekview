---
phase: P7
task_id: T032-entry-read-tracking
type: consistency
parent: P2-design.md
trace_id: T032-P7-20260630
status: draft
created: 2026-06-30
---

# T032 一致性检查：Entry 读取路径埋点

## 检查方法

逐项对照 P2-design.md 的设计规范与实际实现代码，进行双向一致性检查。

---

## 方向 1：设计 → 实现

### 1. 数据模型（P2 §2）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| EntryRead 表名 | `entry_reads` | `__tablename__ = "entry_reads"` (models.py:257) | ✅ |
| entry_id 字段 | `INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE` | `entry_id: int = Field(index=True)` (models.py:267) | ⚠️ [DEVIATION] 缺少 `foreign_key="entries.id"` 和 `ondelete="CASCADE"`。P2 SQL 定义了外键+级联删除，但 SQLModel 字段只设了 `index=True`，未声明外键关系。虽然 SQLite 的 SQLModel create_all 可能从表结构推断外键，但显式声明更安全。当 entry 被删除时，entry_reads 行不会自动级联删除。 |
| action 字段 | `TEXT NOT NULL DEFAULT 'read'` | `action: str = Field(default="read", max_length=20)` (models.py:268) | ✅ |
| channel 字段 | `TEXT NOT NULL DEFAULT 'api'` | `channel: str = Field(default="api", max_length=20)` (models.py:269) | ✅ |
| reader_type 字段 | `TEXT NOT NULL DEFAULT 'anonymous'` | `reader_type: str = Field(default="anonymous", max_length=20)` (models.py:270) | ✅ |
| reader_id 字段 | `INTEGER, NULL` | `reader_id: int \| None = Field(default=None)` (models.py:271) | ✅ |
| is_self_read 字段 | `BOOLEAN NOT NULL DEFAULT 0` | `is_self_read: bool = Field(default=False)` (models.py:272) | ✅ |
| count 字段 | `INTEGER NOT NULL DEFAULT 1` | `count: int = Field(default=1)` (models.py:273) | ✅ |
| window_key 字段 | `TEXT NOT NULL, UNIQUE` | `window_key: str = Field(unique=True, max_length=200)` (models.py:274) | ✅ |
| reader_fingerprint 字段 | P2 §3.3 后续决定冗余存储 | `reader_fingerprint: str = Field(default="", max_length=50)` (models.py:275) | ✅ |
| read_at 字段 | `TEXT NOT NULL DEFAULT (strftime(...))` | `read_at: datetime = Field(default_factory=now_utc)` (models.py:276) | ✅ |
| updated_at 字段 | `TEXT NOT NULL DEFAULT (strftime(...))` | `updated_at: datetime = Field(default_factory=now_utc)` (models.py:277) | ✅ |
| 索引 idx_entry_reads_entry_id | ✅ | Index("idx_entry_reads_entry_id", "entry_id") (models.py:259) | ✅ |
| 索引 idx_entry_reads_entry_channel | ✅ | Index("idx_entry_reads_entry_channel", "entry_id", "channel") (models.py:260) | ✅ |
| 索引 idx_entry_reads_reader | ✅ | Index("idx_entry_reads_reader", "reader_id") (models.py:261) | ✅ |
| 索引 idx_entry_reads_read_at | ✅ | Index("idx_entry_reads_read_at", "read_at") (models.py:262) | ✅ |
| UNIQUE 约束 (window_key) | ✅ | `Field(unique=True)` (models.py:274) | ✅ |

### 2. Pydantic Schemas（P2 §2.3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| ReadStatsResponse | `total_count, unique_readers, by_channel, last_read_at` | models.py:280-284 完全一致 | ✅ |
| ReadEventResponse | `id, action, channel, reader_type, reader_id, is_self_read, count, read_at, updated_at` | models.py:287-296 完全一致 | ✅ |
| ReadEventListResponse | `items, total, page, per_page` | models.py:299-303 完全一致 | ✅ |
| EntryResponse.read_stats | `ReadStatsResponse \| None = None` | models.py:476 完全一致 | ✅ |

### 3. ReadTrackingService（P2 §3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| record_read 签名 | `(entry_id, entry_owner_id, action, channel, reader_id, reader_ip)` | read_tracking_service.py:24-31 完全一致 | ✅ |
| reader_fingerprint 计算 | authenticated→`u:{id}`, anonymous→`a:{sha256[:8]}`, no ip→`a:unknown` | read_tracking_service.py:33-38 完全一致 | ✅ |
| is_self_read 计算 | `reader_id is not None and reader_id == entry_owner_id` | read_tracking_service.py:40 完全一致 | ✅ |
| window_key 格式 | `{entry_id}:{fingerprint}:{channel}:{window_ts}` | read_tracking_service.py:43-44 完全一致 | ✅ |
| window_ts 截断 | `strftime("%Y-%m-%dT%H:%M")` | read_tracking_service.py:43 完全一致 | ✅ |
| reader_type 判断 | `authenticated if reader_id else anonymous` | read_tracking_service.py:46 完全一致 | ✅ |
| UPSERT 策略 | select-then-update（P2 允许此方案） | read_tracking_service.py:48-71 select-then-update | ✅ |
| reader_fingerprint 写入 | P2 §3.3 决定冗余存储 | record 创建时 `reader_fingerprint=fingerprint` (read_tracking_service.py:66) | ✅ |
| get_read_stats 签名 | `(entry_id) -> ReadStatsResponse` | read_tracking_service.py:73 完全一致 | ✅ |
| get_read_events 签名 | `(entry_id, page, per_page) -> ReadEventListResponse` | read_tracking_service.py:112-116 完全一致 | ✅ |

### 4. get_read_stats 查询逻辑（P2 §3.3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| total_count | `SUM(count) WHERE is_self_read = false` | `func.sum(EntryRead.count).where(entry_id=?)` **无** is_self_read 过滤 | ⚠️ [DEVIATION] `total_count` 和 `by_channel` 查询未排除 `is_self_read=true` 的记录。P2 §3.3 明确：`total_count: SUM(count) WHERE entry_id = ? AND is_self_read = false`，`by_channel: SUM(count) GROUP BY channel WHERE is_self_read = false`。当前实现把 self-read 计入了 total_count 和 by_channel。仅 `unique_readers` 正确排除了 self-read。这会导致 owner 看到的"读取次数"包含了自己的访问。 |
| unique_readers | `COUNT(DISTINCT reader_fingerprint) WHERE is_self_read=0 AND action='read'` | raw SQL 正确实现 (read_tracking_service.py:82-88) | ✅ |
| by_channel | `SUM(count) GROUP BY channel WHERE is_self_read = false` | 无 is_self_read 过滤 (read_tracking_service.py:92-97) | ⚠️ 同上 |
| last_read_at | `MAX(updated_at) WHERE entry_id = ?` | 无 is_self_read 过滤 (read_tracking_service.py:99-103) | ✅ [OK] last_read_at 不过滤 self_read 是合理的（最后读取时间包含 owner 自身访问有意义） |

### 5. Channel 检测（P2 §4）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| _detect_channel 函数 | X-PeekView-Source: mcp → "mcp"; share= in query → "share"; default "api" | entries.py:37-43 完全一致 | ✅ |
| files.py 中的 channel 检测 | 复用相同逻辑 | files.py:472 内联检测 `X-PeekView-Source` → "mcp"/"api" | ✅ [OK] 简化版，未检测 share（raw 端点不走 share cookie 路径） |

### 6. API 端点埋点（P2 §5）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| get_entry 埋点 | asyncio.create_task, action="read", channel=_detect_channel | entries.py:305-308 | ✅ |
| get_entry share token 路径 | channel="share" | entries.py:272-276 | ✅ |
| get_entry share cookie 路径 | channel="share" | entries.py:289-293 | ✅ |
| get_entry 公开/owner 路径 | channel="api"（非 share 场景） | entries.py:251-254 使用硬编码 channel="api" | ✅ [OK] 此分支是 public entry + authenticated user 的快速路径，不走 _detect_channel，硬编码 api 合理 |
| list_entries 埋点 | asyncio.create_task, action="discover" | entries.py:205-216 | ✅ |
| get_entry_raw 埋点 | asyncio.create_task, action="read" | files.py:472-478 | ✅ |
| _record_read_async | try/except + logger.warning | entries.py:46-65; files.py:29-48 | ✅ |
| 新端点 GET /{slug}/reads | owner/admin, 返回 ReadEventListResponse | entries.py:314-333 | ✅ |
| reads 端点权限 | owner 或 admin，非 owner 返回 404 | entries.py:327-329 | ✅ |

### 7. EntryResponse.read_stats 填充（P2 §5.3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| owner/admin → read_stats 填充 | include_read_stats=True | entries.py:301-302 | ✅ |
| 非 owner → read_stats=null | include_read_stats=False（默认） | entry_service.py:825 read_stats=None | ✅ |
| _build_response 调用 ReadTrackingService | P2: 通过 app.state 获取 | entry_service.py:827-828 **每次 new ReadTrackingService(engine)** | ⚠️ [DEVIATION] P2 设计通过 `app.state.read_tracking_service` 获取单例，实现中每次 `_build_response` 调用时 `from peekview.services.read_tracking_service import ReadTrackingService` + `ReadTrackingService(engine=self.engine)` 创建新实例。功能等价（无状态 service），但不符合 DI 模式。每次创建实例无性能问题（仅存 engine 引用），但绕过了 DI 注册。 |

### 8. DI 注册（P2 §3 Step 3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| ReadTrackingService 注册 | app.state.read_tracking_service | main.py:110,118,123 完全一致 | ✅ |

### 9. 数据库 Migration（P2 §1.1）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| entry_reads 表 migration | database.py 新表索引 migration | database.py 中 **无** entry_reads 相关 migration 代码 | ⚠️ [DEVIATION] database.py 的 `_run_migrations` 函数没有 entry_reads 相关的 migration。依赖 SQLModel 的 `create_all()` 自动建表。对于全新安装没问题，但对于从旧版升级的数据库，`create_all()` 会创建不存在的表（含索引），所以功能上可行。但如果未来需要 ALTER entry_reads（如加列），则需补充 migration 路径。当前阶段无影响。 |

### 10. MCP Client（P2 §6）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| X-PeekView-Source: mcp header | client.ts request() 方法 | client.ts:31 `'X-PeekView-Source': 'mcp'` | ✅ |
| 不修改 tool handlers | ✅ | 未修改 | ✅ |
| validateToken 不带 header | P2 未要求 | validateToken 方法 (client.ts:64-83) 不走 `request()` 方法，不带 X-PeekView-Source | ✅ [OK] validateToken 是认证探测，不是数据读取，无需埋点 header |

### 11. 前端类型（P2 §7）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| ReadStatsResponse (api/types.ts) | `total_count, unique_readers, by_channel, last_read_at` | types.ts:20-25 完全一致 | ✅ |
| EntryResponse.read_stats (api/types.ts) | `read_stats?: ReadStatsResponse \| null` | types.ts:45 完全一致 | ✅ |
| ReadStats (types/index.ts) | `totalCount, uniqueReaders, byChannel, lastReadAt` | types/index.ts:2-7 完全一致 | ✅ |
| Entry.readStats (types/index.ts) | `readStats?: ReadStats \| null` | types/index.ts:28 完全一致 | ✅ |

### 12. 前端 API 映射（P2 §7.2）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| transformEntry readStats 映射 | `total_count→totalCount` 等 | client.ts:81-88 完全一致 | ✅ |

### 13. 前端 UI 展示（P2 §7.3）

| 设计项 | P2 规范 | 实际实现 | 一致性 |
|--------|---------|----------|--------|
| entry-read-stats span | `v-if="currentEntry?.readStats"` | EntryDetailView.vue:53 完全一致 | ✅ |
| 读取次数显示 | `totalCount reads` + 复数 s | EntryDetailView.vue:54 完全一致 | ✅ |
| Channel 分布 | 多 channel 时显示 `(API X, MCP Y)` | EntryDetailView.vue:55-57 完全一致 | ✅ |
| desktop-only class | ✅ | EntryDetailView.vue:53 | ✅ |
| 样式 | 跟随 entry-time 小号灰色 | EntryDetailView.vue:720-723 `.entry-read-stats` 样式 | ✅ |

---

## 方向 2：实现 → 设计

### 实现超出设计但合理的 [EXTENSION]

| 实现点 | 说明 | 评价 |
|--------|------|------|
| files.py 重复定义 `_record_read_async` | entries.py 和 files.py 各有一个 `_record_read_async` 函数，代码完全相同 | [EXTENSION] 可提取为共享模块，但当前不影响功能。两个文件各自定义避免循环导入，可接受。 |
| get_entry share token 路径中公开 entry 快速路径 | entries.py:248-256：当 entry 是 public 且请求者有权限时，直接返回不走 share 流程，channel 硬编码 "api" | [EXTENSION] P2 未设计此快速路径，但合理——public entry 不应标记为 share channel。 |

### 设计中不再适用的要求 [DEVIATION]

| 设计项 | 说明 | 评价 |
|--------|------|------|
| P2 §1.1 "修改 migration database.py" | 实际未在 database.py 添加 migration 代码，依赖 create_all() | [DEVIATION] 非阻塞。create_all() 对新表有效，但未来 schema 变更需要补充 migration。 |
| P2 §5.3 "通过 app.state.read_tracking_service 获取" | entry_service.py._build_response 中每次 new ReadTrackingService | [DEVIATION] 功能等价，但绕过 DI。建议改为接收 tracking_service 参数或从 app.state 获取。 |

---

## 偏差汇总

| # | 偏差 | 涉及 P2 核心设计目标 | 级别 | 影响 |
|---|------|---------------------|------|------|
| D1 | `total_count` 和 `by_channel` 未排除 `is_self_read=true` 的记录 | 是（P2 §3.3 明确规范 `WHERE is_self_read = false`；关联 BDD B09"owner 可见 read_stats"隐含排除自身读取） | [DEVIATION] + [NEED_CONFIRM] | Owner 看到的读取次数包含自身访问，可能与预期不符。需确认：read_stats 展示给 owner 时是否应排除 self-read？P2 设计意图是排除，但此偏差也可能是合理的调整（owner 可能想看包括自己在内的总访问）。 |
| D2 | entry_id 缺少 foreign_key + ondelete CASCADE 声明 | 否（外键约束非核心功能目标） | [DEVIATION] | 当 entry 被删除时，关联的 entry_reads 行不会自动级联删除，可能产生孤儿记录。SQLite 默认启用 foreign_keys pragma 时才会执行 CASCADE，但当前代码未启用。 |
| D3 | _build_response 中每次 new ReadTrackingService 而非使用 DI 单例 | 否（DI 模式是架构约定，非功能目标） | [DEVIATION] | 功能等价，但违反项目 DI 模式。 |
| D4 | database.py 无 entry_reads migration 代码 | 否（当前阶段 create_all 够用） | [DEVIATION] | 未来 schema 变更时需补充 migration。 |

---

## 门槛判定

- **[BLOCKER]**：无
- **[DEVIATION-CRITICAL]**：无
- **[DEVIATION] + [NEED_CONFIRM]**：D1（total_count/by_channel 未排除 self-read）——需确认是否符合意图
- **[DEVIATION]**（不阻塞）：D2, D3, D4

**结论**：P7 通过。D1 需人工确认 read_stats 是否应排除 self-read；D2/D3/D4 为非阻塞偏差，建议后续迭代修复。
