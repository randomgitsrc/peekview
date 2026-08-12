---
phase: P2
task_id: T078-read-tracking-hardening
type: design
parent: P1-requirements.md
trace_id: T078-P2-20260803
status: draft
created: 2026-08-03
agent: architect
---

## 0. 声明字段

```yaml
packages:
  - backend  # 单一包（peekview pip 包），无 MCP/frontend 改动

domains:
  - backend
  - api
  - security
  - database
  - config

ui_affected: false

gate_commands:
  P3: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=short"
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_e2e: null  # ui_affected: false，无 E2E

env_constraints:
  debug_env: "make debug（127.0.0.1:8888，/tmp/peekview-debug/）"
  isolation_check: "conftest.py autouse 隔离（PEEKVIEW_STORAGE__DATA_DIR/DB_PATH → tmp_path）；make debug-verify-isolation 验证生产 :8080 无数据泄露"

minimal_validation:
  assumption: "纯代码逻辑，无外部系统依赖"
  method: "本任务依赖 SQLModel ORM 操作 + SQLite ALTER TABLE 迁移 + JSON 字典序列化（json.dumps/loads）。所有数据转换在 Python 进程内完成，不涉及浏览器行为、外部 API 或安全模型。"
  result: "not_needed"
  note: "唯一的外部输入是 HTTP Referer header，但 source 分类逻辑是纯字符串匹配（域名比较 + 集合查找），无外部系统调用。"
```

## 1. 候选方案 + 权衡 + 选择

### 候选方案 A：聚合表写时更新（同步，单 Session）

**核心思路**：`record_read()` 在现有 Session 内同步更新 `entry_read_stats` 聚合表。每次调用都更新 `total_reads`/`by_action`/`by_channel`/`by_source`，并检查 `reader_fingerprints` 决定是否 `unique_readers += 1`。`get_read_stats()` 改为只读聚合表。

**数据流**：
```
record_read(entry_id, action, channel, source, ...)
  → Session 开始
    → fingerprint 计算 + is_self_read 判定
    → window_key 去重（含 action）
      → existing: count += 1
      → new: INSERT EntryRead
    → 更新 entry_read_stats:
      → total_reads += 1
      → by_action[action] += 1
      → by_channel[channel] += 1
      → by_source[source] += 1
      → if not is_self_read and fingerprint not in reader_fingerprints:
          unique_readers += 1; reader_fingerprints += "," + fingerprint
      → last_read_at = now; updated_at = now
  → Session commit
```

**优点**：
- 聚合表始终与原始表一致（同事务）
- `get_read_stats()` O(1) 查询（单行读取 + JSON 反序列化）
- 无需后台任务或触发器

**风险**：
- 每次 `record_read` 多一次聚合表读写（SQLite 单写者，影响可忽略）
- `reader_fingerprints` 字符串 `in` 检查在 >500 人时变慢（已知风险，可接受）

**工作量**：中等 — 修改 `record_read` + `get_read_stats`，新增聚合表 model，迁移 + 回填逻辑

### 候选方案 B：触发器 + 物化视图（SQLite 触发器自动聚合）

**核心思路**：用 SQLite AFTER INSERT/UPDATE 触发器自动维护 `entry_read_stats`，`record_read` 只写原始表，聚合表由触发器更新。

**数据流**：
```
record_read → INSERT/UPDATE entry_reads
  → SQLite AFTER INSERT/UPDATE trigger
    → UPDATE entry_read_stats SET total_reads = total_reads + NEW.count, ...
```

**优点**：
- `record_read` 代码不变（只写原始表）
- 聚合逻辑在 DB 层，应用层无感知

**风险**：
- SQLite 触发器无法做复杂的 JSON 字典更新（`by_action["read"] += 1` 需要 `json_set` + `json_extract`，语法极其复杂且 SQLite 版本依赖严重）
- `reader_fingerprints` 的 `in` 检查在触发器中无法用 Python 字符串 `in`，需要 `instr()` + 边界处理，极易出错
- 调试困难 — 触发器错误在 SQLite 层，Python 层只能看到 IntegrityError
- 回填逻辑仍需在 Python 层写（触发器无法做一次性回填）
- 与现有 `_run_migrations` 模式不一致（项目用 Python 管理迁移，不用 DB 触发器管数据）

**工作量**：高 — 触发器 SQL 复杂度远超 Python 代码，且调试成本高

### 选择理由

**选方案 A**。理由：
1. JSON 字典更新在 Python 层简单直观（`json.loads` → 修改 dict → `json.dumps`），在 SQLite 触发器中极度复杂
2. `reader_fingerprints` 的 `in` 检查是 Python 字符串操作，触发器中实现不可靠
3. 项目现有模式是 Python 层管理所有数据逻辑（FTS5 除外，FTS5 是 SQLite 原生功能），方案 A 一致
4. 方案 B 的"优点"（record_read 不变）不成立 — `record_read` 仍需改 `window_key` 加 `action` + 加 `source` 参数
5. 方案 A 的性能风险可忽略（SQLite 单写者，日均几十次 read）

## 2. 影响域分析

### 改什么

| 文件 | 改动 | BDD 覆盖 |
|------|------|----------|
| `read_tracking_service.py` | `window_key` 加 `action`；`record_read` 加 `source` 参数 + 写时更新聚合表；`get_read_stats` 改读聚合表；新增 `_backfill_read_stats` | BDD-01~02, 09~18, 30~34 |
| `models.py` | 新增 `EntryReadStats` model；`EntryRead` 加 `source` 列；`ReadStatsResponse` 加 `by_action`/`by_source`；`AdminStatsResponse` 加 `ReadsStats`；`AdminCleanupResponse` 加 `reads_cleaned`；`RestorePreview` 加 `read_stats_count`；`RestoreResult` 加 `read_stats_imported` | BDD-08~09, 19, 26 |
| `api/_shared.py` | 提取 `_detect_channel(request, slug=None)`；新增 `_classify_source(referer, host)`；`_record_read_async` 提取 Referer + 传 `source` | BDD-03~06, 10~11, 32~34 |
| `api/entries.py` | line 231: `channel="api"` → `channel="share"`；`_detect_channel` 改为从 `_shared` 导入 | BDD-03 |
| `api/files.py` | 三处内联 channel（188/232/432）统一走 `_detect_channel(request, slug)` | BDD-04~06 |
| `services/entry_service.py` | `_cleanup_reads` 只删 `entry_reads`，不删 `entry_read_stats` | BDD-24~25 |
| `services/admin_service.py` | `cleanup_expired` 加 90 天清理 `entry_reads`；`get_stats` 加 `reads` 维度；`_restore_merge` 导入 `entry_read_stats` 行；restore preview 加 `read_stats_count` | BDD-07, 20~23, 26~27, 28~29 |
| `database.py` | `_run_migrations` 加 `entry_reads.source` 列；`init_db` 后调用 `_backfill_read_stats` | BDD-17~19 |
| `config.py` | `PeekCleanup` 加 `reads_retention_days` | BDD-23 |
| `tests/test_read_tracking.py` | 修正测试名；扩展聚合表/`source`/`window_key` 测试 | BDD-01~02, 08~18, 30~31 |
| `tests/test_admin_stats_cleanup.py` | 扩展 90 天清理 + `admin stats` `reads` 维度测试 | BDD-07, 20~23, 26~27 |
| `tests/test_admin_backup.py` | 扩展 `restore merge` 聚合表恢复测试 | BDD-28~29 |

### 不改什么

- `get_read_events()` — 仍从 `entry_reads` 原始表查，只受 90 天清理影响（查到更少记录）
- `get_file_content` 的 `action="read"` — P0 明确不改
- 前端代码 — `ReadStatsResponse` 新增字段是可选的，前端按需展示
- MCP server — 不直接操作 `read tracking`
- CLI — `admin stats` 走 API 自动获得新字段
- `backup()` — 整库 SQLite backup，自动覆盖新表
- `_restore_replace()` — 整库替换，自动覆盖新表
- `EntryRead` 的现有索引 — 不新增/删除索引

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| 写时更新失败 | `record_read` 整体回滚，read 事件丢失 | 同事务保证原子性；`_record_read_async` 已有 `try/except` |
| 回填不幂等 | 重复回填导致聚合表数据翻倍 | 检查 `entry_read_stats` 非空则跳过 |
| `reader_fingerprints` 拼接错误 | `unique_readers` 计数不准 | 空字符串边界处理 + 测试覆盖 |
| 迁移 `source` 列失败 | 旧 DB 无 `source` 列，`record_read` 写入报错 | `_run_migrations` 先加列，`create_all` 保证表存在 |
| `_restore_merge` 遗漏聚合表 | 恢复后 `get_read_stats` 返回全 0 | 显式导入 `entry_read_stats` 行 + BDD-28 验证 |

## 3. 详细设计

### 3.1 window_key 加 action（BDD-01~02）

```python
# read_tracking_service.py record_read() 内
window_key = f"{eid_part}:{fingerprint}:{channel}:{action}:{window_ts}"
```

旧格式 `eid:fp:channel:ts` → 新格式 `eid:fp:channel:action:ts`。字符串不同，unique 约束不冲突。历史数据不回溯修改。

### 3.2 EntryReadStats 聚合表 model（BDD-12~16）

```python
# models.py
class EntryReadStats(SQLModel, table=True):
    __tablename__ = "entry_read_stats"

    entry_id: int = Field(primary_key=True, foreign_key="entries.id")
    total_reads: int = Field(default=0)
    unique_readers: int = Field(default=0)
    by_action: str = Field(default="{}", sa_column=Column(Text))
    by_channel: str = Field(default="{}", sa_column=Column(Text))
    by_source: str = Field(default="{}", sa_column=Column(Text))
    reader_fingerprints: str = Field(default="")
    last_read_at: datetime | None = Field(default=None)
    updated_at: datetime = Field(default_factory=now_utc)
```

JSON 字段用 `str` 存储（`json.dumps`/`json.loads` 序列化），与现有 `tags` 用 `Column(JSON)` 不同 — 因为 `by_action` 等是动态键字典，SQLite JSON 列在 SQLModel 中用 `Text` + 手动序列化更可控。

### 3.3 record_read 写时更新（BDD-12~15）

> **不变量**：聚合表增量始终等于原始表增量。window_key 命中时 `existing.count += 1` 对应 `stats.total_reads += 1`；新建记录时 `count=1` 对应 `stats.total_reads += 1`。`by_action`/`by_channel`/`by_source` 同理——每次调用 `record_read` 都对应原始表 +1 和聚合表 +1。这个等价关系是写时更新正确性的基础，修改去重逻辑时必须同步调整聚合表更新。

```python
def record_read(self, entry_id, entry_owner_id, action, channel, reader_id, reader_ip, source="direct"):
    # ... fingerprint 计算（不变）
    # ... window_key 加 action

    with Session(self.engine) as session:
        # 1. 原始表去重写入（不变，除 window_key 格式）
        existing = session.exec(select(EntryRead).where(EntryRead.window_key == window_key)).first()
        if existing:
            existing.count += 1
            existing.updated_at = now
            session.add(existing)
        else:
            record = EntryRead(..., source=source, ...)
            session.add(record)

        # 2. 聚合表更新（仅 entry_id is not None）
        if entry_id is not None:
            stats = session.get(EntryReadStats, entry_id)
            if stats is None:
                stats = EntryReadStats(entry_id=entry_id, ...)
                session.add(stats)

            stats.total_reads += 1

            by_action = json.loads(stats.by_action or "{}")
            by_action[action] = by_action.get(action, 0) + 1
            stats.by_action = json.dumps(by_action)

            by_channel = json.loads(stats.by_channel or "{}")
            by_channel[channel] = by_channel.get(channel, 0) + 1
            stats.by_channel = json.dumps(by_channel)

            by_source = json.loads(stats.by_source or "{}")
            by_source[source] = by_source.get(source, 0) + 1
            stats.by_source = json.dumps(by_source)

            if not is_self_read:
                fps = [fp for fp in (stats.reader_fingerprints or "").split(",") if fp]
                if fingerprint not in fps:
                    fps.append(fingerprint)
                    stats.reader_fingerprints = ",".join(fps)
                    stats.unique_readers += 1

            stats.last_read_at = now
            stats.updated_at = now
            session.add(stats)

        session.commit()
```

### 3.4 get_read_stats 改读聚合表（BDD-16, 30）

```python
def get_read_stats(self, entry_id: int) -> ReadStatsResponse:
    with Session(self.engine) as session:
        stats = session.get(EntryReadStats, entry_id)
        if stats is None:
            return ReadStatsResponse(total_count=0, unique_readers=0, by_channel={}, by_action={}, by_source={}, last_read_at=None)

        return ReadStatsResponse(
            total_count=stats.total_reads,
            unique_readers=stats.unique_readers,
            by_channel=json.loads(stats.by_channel or "{}"),
            by_action=json.loads(stats.by_action or "{}"),
            by_source=json.loads(stats.by_source or "{}"),
            last_read_at=stats.last_read_at,
        )
```

注意：现有 `unique_count` 查询有 `AND action = 'read'` 条件，但 P1 BDD-30 明确 `unique_readers` 排除 `self_read`（不限 `action`）。聚合表写时更新已排除 `self_read`，且不区分 `action` — 与 P1 语义一致。

### 3.5 ReadStatsResponse 扩展（BDD-08~09）

```python
class ReadStatsResponse(SQLModel):
    total_count: int = 0
    unique_readers: int = 0
    by_channel: dict[str, int] = {}
    by_action: dict[str, int] = {}
    by_source: dict[str, int] = {}
    last_read_at: datetime | None = None
```

### 3.6 _detect_channel 提取 + files.py 统一（BDD-03~06）

`_shared.py` 新增：
```python
def _detect_channel(request: Request, slug: str | None = None) -> str:
    source = request.headers.get("X-PeekView-Source", "").lower()
    if source == "mcp":
        return "mcp"
    if "share=" in str(request.url.query):
        return "share"
    if slug:
        cookie_name = f"peekview_share_{slug}"
        if request.cookies.get(cookie_name):
            return "share"
    return "api"
```

**entries.py 调用点清单**（所有 `_detect_channel` 调用点及传参）：
- line 169（`list_entries`，discover 探针）：`_detect_channel(request)` → `_detect_channel(request)` （无 slug，保持不变，discover 不需要 share cookie 检测）
- line 231（公开 entry 带 `?share=token` 分支）：硬编码 `channel="api"` → `channel="share"`（不走 `_detect_channel`——此分支 query 里有 `share=`，`_detect_channel` 也会返回 "share"，但硬编码更明确且避免函数调用开销）
- line 298（`get_entry`，非 share 分支）：`_detect_channel(request)` → `_detect_channel(request, slug=slug)`（有 slug，走 share cookie 检测）
- line 473（`download_entry_files`）：`_detect_channel(request)` → `_detect_channel(request, slug=slug)`（有 slug，走 share cookie 检测）

`entries.py`:
- 删除本地 `_detect_channel` 定义，改为从 `_shared` 导入
- line 231: `channel="api"` → `channel="share"`（硬编码，不走 `_detect_channel`）
- line 298/473: `_detect_channel(request)` → `_detect_channel(request, slug=slug)`

`files.py` 三处：
- line 188: `channel = "mcp" if ... else "api"` → `channel = _detect_channel(request, slug)`
- line 232: 同上
- line 432: 同上

### 3.7 _classify_source + source 参数（BDD-10~11, 32~34）

`_shared.py` 新增：
```python
_SEARCH_ENGINES = {"google.", "bing.", "duckduckgo.", "baidu.", "yahoo.", "yandex.", "sogou."}
_SOCIAL_PLATFORMS = {"twitter.", "x.com", "facebook.", "linkedin.", "reddit.", "weibo.", "github.com"}

def _classify_source(referer: str | None, request_host: str | None) -> str:
    if not referer:
        return "direct"
    try:
        from urllib.parse import urlparse
        ref_host = urlparse(referer).hostname or ""
        ref_host_lower = ref_host.lower()
    except Exception:
        return "other"

    if request_host and ref_host_lower == request_host.lower():
        return "internal"
    if any(engine in ref_host_lower for engine in _SEARCH_ENGINES):
        return "search"
    if any(social in ref_host_lower for social in _SOCIAL_PLATFORMS):
        return "social"
    return "other"
```

`_record_read_async` 修改：
```python
async def _record_read_async(app_state, entry_id, entry_owner_id, action, channel, reader_id, reader_ip, request=None):
    source = "direct"
    if request:
        referer = request.headers.get("Referer")
        host = request.base_url.hostname
        source = _classify_source(referer, host)
    try:
        app_state.read_tracking_service.record_read(
            ..., source=source,
        )
    except Exception as e:
        logger.warning("Failed to record read event: %s", e)
```

所有调用 `_record_read_async` 的地方需传 `request` 参数。现有调用点在 `entries.py` 和 `files.py` 中已有 `request` 对象，只需传透。

### 3.8 EntryRead 加 source 列（BDD-19）

**model 层 default vs migration DEFAULT 分离策略**：
- model 层 `source` default 为 `"direct"`（新记录通过 ORM 创建时自动填 "direct"）
- migration SQL 用 `DEFAULT NULL`（历史记录 source 为 NULL，符合 BDD-19）
- 回填时 NULL → unknown，非 NULL 保持原值

```python
# models.py EntryRead — model default 为 "direct"（新记录）
source: str = Field(default="direct", max_length=20)
```

`_run_migrations` 加：
```python
read_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entry_reads)"))}
if "source" not in read_columns:
    conn.execute(text("ALTER TABLE entry_reads ADD COLUMN source VARCHAR(20) DEFAULT NULL"))
    conn.commit()
```

注意：迁移后历史数据 `source` 列值为 `NULL`（DEFAULT NULL 子句）。回填时通过 `COALESCE(source, 'unknown')` 将 NULL 归为 `unknown`（见 §3.9）。新写入的数据 `source='direct'`（来自 model default），与历史数据的 `NULL` 可区分。

### 3.9 迁移回填（BDD-17~18）

新增 `_backfill_read_stats(engine)` 在 `database.py`，`init_db` 后调用：

```python
def _backfill_read_stats(engine: Engine) -> None:
    with Session(engine) as session:
        stats_count = session.exec(text("SELECT COUNT(*) FROM entry_read_stats")).scalar()
        if stats_count > 0:
            return  # 幂等

        reads_count = session.exec(text("SELECT COUNT(*) FROM entry_reads WHERE entry_id IS NOT NULL")).scalar()
        if reads_count == 0:
            return

        entries = session.exec(text("SELECT DISTINCT entry_id FROM entry_reads WHERE entry_id IS NOT NULL")).all()
        for (eid,) in entries:
            rows = session.exec(text(
                "SELECT action, channel, SUM(count) as total FROM entry_reads "
                "WHERE entry_id = :eid GROUP BY action, channel"
            ).bindparams(eid=eid)).all()

            by_action, by_channel = {}, {}
            total_reads = 0
            for action, channel, total in rows:
                by_action[action] = by_action.get(action, 0) + total
                by_channel[channel] = by_channel.get(channel, 0) + total
                total_reads += total

            # by_source: NULL → unknown (COALESCE), 非 NULL 保持原值
            source_rows = session.exec(text(
                "SELECT COALESCE(source, 'unknown') as src, SUM(count) as total FROM entry_reads "
                "WHERE entry_id = :eid GROUP BY src"
            ).bindparams(eid=eid)).all()
            by_source = {}
            for src, total in source_rows:
                by_source[src] = by_source.get(src, 0) + total

            unique_readers = session.exec(text(
                "SELECT COUNT(DISTINCT reader_fingerprint) FROM entry_reads "
                "WHERE entry_id = :eid AND is_self_read = 0"
            ).bindparams(eid=eid)).scalar() or 0

            fingerprints = session.exec(text(
                "SELECT GROUP_CONCAT(DISTINCT reader_fingerprint) FROM entry_reads "
                "WHERE entry_id = :eid AND is_self_read = 0"
            ).bindparams(eid=eid)).scalar() or ""

            last_read = session.exec(text(
                "SELECT MAX(updated_at) FROM entry_reads WHERE entry_id = :eid"
            ).bindparams(eid=eid)).scalar()

            stats = EntryReadStats(
                entry_id=eid,
                total_reads=total_reads,
                unique_readers=unique_readers,
                by_action=json.dumps(by_action),
                by_channel=json.dumps(by_channel),
                by_source=json.dumps(by_source),  # COALESCE(source, 'unknown') 聚合
                reader_fingerprints=fingerprints,
                last_read_at=last_read,
                updated_at=datetime.now(timezone.utc),
            )
            session.add(stats)

        session.commit()
```

调用位置：`init_db()` 在 `run_migrations` 之后、`return engine` 之前。但 `init_db` 是纯 DB 层函数，不应依赖 `EntryReadStats` model。更好：在 `main.py` 的 `create_app()` 中，`init_db` 之后调用 `read_tracking_service._backfill()` 或在 `database.py` 中用 raw SQL 实现（不依赖 model）。

**决策**：回填逻辑放在 `read_tracking_service.py` 作为 `ReadTrackingService` 的方法 `backfill_stats()`，在 `main.py:create_app()` 中 `init_db` 之后调用。这样可以用 SQLModel ORM，且与 `ReadTrackingService` 的职责一致。

**调用位置**（`main.py:create_app()` 中）：在 `read_tracking_service` 创建之后（约 line 221 后）调用 `read_tracking_service.backfill_stats()`。与 `backfill_fts_content(engine, storage)`（line 218）平级，位于 service 初始化区域之后、路由注册之前。

### 3.10 90 天清理（BDD-20~23）

`admin_service.py` `cleanup_expired()` 末尾添加：
```python
reads_retention = self.config.cleanup.reads_retention_days
reads_cleaned = 0
if reads_retention > 0:
    cutoff = now_naive - timedelta(days=reads_retention)
    with Session(self.engine) as session:
        result = session.exec(
            text("DELETE FROM entry_reads WHERE read_at < :cutoff").bindparams(cutoff=cutoff)
        )
        reads_cleaned = result.rowcount or 0
        session.commit()
```

`AdminCleanupResponse` 加 `reads_cleaned: int = 0`。

清理顺序：先 archive/delete entries（可能通过 `_cleanup_reads` 删 entry_reads），再清理过期 entry_reads。聚合表不受影响。

### 3.11 删 entry 保留聚合统计（BDD-24~25）

`entry_service.py` `_cleanup_reads` 修改：
```python
def _cleanup_reads(self, entry_id: int) -> None:
    from peekview.models import EntryRead
    with Session(self.engine) as session:
        for r in session.exec(select(EntryRead).where(EntryRead.entry_id == entry_id)).all():
            session.delete(r)
        session.commit()
    # 不删 entry_read_stats — 保留聚合行
```

实际上当前代码就只删 `EntryRead`，不删 `EntryReadStats`（因为表还不存在）。所以这个"修改"实际是"确保新表创建后 `_cleanup_reads` 不删它"。由于 `_cleanup_reads` 只 `select(EntryRead)`，自然不会碰 `EntryReadStats`。**无需改动**，只需确保不增加删除 `EntryReadStats` 的代码。

### 3.12 Admin stats 加 reads 维度（BDD-07, 26~27）

`models.py` 新增：
```python
class ReadsStats(SQLModel):
    total: int = 0
    today: int = 0
    by_action: dict[str, int] = {}
    by_channel: dict[str, int] = {}
    by_source: dict[str, int] = {}

class AdminStatsResponse(SQLModel):
    users: int
    entries: EntryStats
    api_keys: ApiKeyStats
    storage: StorageStats
    reads: ReadsStats | None = None  # 新增，可选
```

`admin_service.py` `get_stats()` 加：
```python
# 聚合表统计
with Session(self.engine) as session:
    stats_rows = session.exec(select(EntryReadStats)).all()

    total_reads = sum(s.total_reads for s in stats_rows)
    by_action_agg, by_channel_agg, by_source_agg = {}, {}, {}
    for s in stats_rows:
        for k, v in json.loads(s.by_action or "{}").items():
            by_action_agg[k] = by_action_agg.get(k, 0) + v
        for k, v in json.loads(s.by_channel or "{}").items():
            by_channel_agg[k] = by_channel_agg.get(k, 0) + v
        for k, v in json.loads(s.by_source or "{}").items():
            by_source_agg[k] = by_source_agg.get(k, 0) + v

    # discover 从原始表查（entry_id IS NULL）
    discover_rows = session.exec(
        select(EntryRead.action, EntryRead.channel, func.sum(EntryRead.count))
        .where(EntryRead.entry_id.is_(None))
        .group_by(EntryRead.action, EntryRead.channel)
    ).all()
    discover_total = 0
    for action, channel, count in discover_rows:
        by_action_agg[action] = by_action_agg.get(action, 0) + count
        by_channel_agg[channel] = by_channel_agg.get(channel, 0) + count
        discover_total += count
    total_reads += discover_total

    # today: 今天 00:00 UTC 以后的原始表记录
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    today_count = session.exec(
        select(func.coalesce(func.sum(EntryRead.count), 0)).where(EntryRead.read_at >= today_start)
    ).one()

    reads = ReadsStats(
        total=total_reads,
        today=today_count,
        by_action=by_action_agg,
        by_channel=by_channel_agg,
        by_source=by_source_agg,
    )
```

注意：`reads.total` 包含已删 entry 的历史流量（聚合表行保留）+ discover 流量。`reads.today` 从原始表查（只含 90 天内数据）。`by_source` 包含 `unknown`（历史回填数据）。

**`reads.today` 语义声明**（方案 A）：`today = 今天新建的读取记录的 count 之和`，查询条件用 `EntryRead.read_at >= today_start`。`read_at` 是记录创建时间，window_key 命中时只更新 `updated_at` 不更新 `read_at`（见 `read_tracking_service.py:56-57`）。因此 `today` 只统计今天新建的记录，不包含今天对已有记录的 count 增量。这是可接受的语义——"今天新产生的读取事件"而非"今天的读取次数"。P6 验收按此语义判断。

### 3.13 Restore merge 导入聚合表（BDD-28）

`_restore_merge` 在导入 `entry_reads` 之后，新增导入 `entry_read_stats`。**PK 冲突处理（方案 A：跳过已有）**：导入前检查目标库是否已有该 `entry_id` 的聚合行，有则跳过（与 entry_reads 的 window_key 冲突处理策略一致——冲突时保留目标库数据）。

```python
if _table_exists(backup_conn, "entry_read_stats"):
    # 收集目标库已有的聚合行 entry_id 集合，避免 PK 冲突
    existing_stats_ids = set()
    if _table_exists_raw(session, "entry_read_stats"):
        existing_stats_ids = set(session.exec(select(EntryReadStats.entry_id)).all())

    for row in backup_conn.execute("SELECT * FROM entry_read_stats"):
        entry_id = _row_get(row, "entry_id")
        if entry_id is None:
            continue
        new_entry_id = entry_map.get(entry_id, entry_id)
        if new_entry_id in existing_stats_ids:
            continue  # 跳过已有聚合行的 entry（PK 冲突防护）
        if new_entry_id not in entry_map and entry_id not in entry_map:
            continue  # 跳过没有对应 entry 的聚合行

        new_stats = EntryReadStats(
            entry_id=new_entry_id,
            total_reads=_row_get(row, "total_reads", 0),
            unique_readers=_row_get(row, "unique_readers", 0),
            by_action=_row_get(row, "by_action", "{}"),
            by_channel=_row_get(row, "by_channel", "{}"),
            by_source=_row_get(row, "by_source", "{}"),
            reader_fingerprints=_row_get(row, "reader_fingerprints", ""),
            last_read_at=_parse_db_datetime(_row_get(row, "last_read_at")),
            updated_at=_parse_db_datetime(_row_get(row, "updated_at")),
        )
        session.add(new_stats)
        existing_stats_ids.add(new_entry_id)  # 防止 backup 内重复 entry_id
        read_stats_imported += 1
```

`RestoreResult` 加 `read_stats_imported: int = 0`。
`RestorePreview` 加 `read_stats_count: int = 0`（从 backup_conn 统计）。

### 3.14 config.py 加 reads_retention_days（BDD-23）

```python
class PeekCleanup(BaseSettings):
    # ... 现有字段 ...
    reads_retention_days: int = Field(
        default=90,
        description="Days to retain entry_reads records before deletion (0 = never delete). Aggregated stats in entry_read_stats are preserved.",
    )

    @field_validator("reads_retention_days")
    @classmethod
    def validate_reads_retention(cls, v: int) -> int:
        if v < 0:
            raise ValueError("reads_retention_days must be >= 0")
        return v
```

### 3.15 测试修正（BDD-30）

`test_read_tracking.py` line 390:
- `test_get_read_stats_total_count_excludes_self_reads` → `test_get_read_stats_total_count_includes_self_reads`
- 断言不变（`total_count == 4`，含 self_read）

## 4. files_to_read

```yaml
files_to_read:
  - path: backend/peekview/services/read_tracking_service.py
    why: 核心改动文件 — record_read 加 action/source/聚合表更新，get_read_stats 改读聚合表，新增 backfill_stats
  - path: backend/peekview/models.py:259-310
    why: EntryRead model 加 source 列，新增 EntryReadStats model，ReadStatsResponse 扩展，AdminStatsResponse 扩展
  - path: backend/peekview/api/_shared.py
    why: _detect_channel 提取到此文件，新增 _classify_source，_record_read_async 加 source 提取
  - path: backend/peekview/api/entries.py:36-42,203-236,270-311
    why: _detect_channel 改为导入，line 231 channel 修复，所有 _record_read_async 调用加 request 参数
  - path: backend/peekview/api/files.py:119-166,168-206,209-250,340-458
    why: 三处 channel 内联改为 _detect_channel(request, slug)，_record_read_async 调用加 request 参数
  - path: backend/peekview/services/entry_service.py:782-788
    why: _cleanup_reads 确认只删 entry_reads 不删 entry_read_stats（实际无需改动，确认即可）
  - path: backend/peekview/services/admin_service.py:129-248,629-853
    why: get_stats 加 reads 维度，cleanup_expired 加 90 天清理，_restore_merge 加 entry_read_stats 导入
  - path: backend/peekview/database.py:39-148,198-249
    why: _run_migrations 加 source 列迁移，init_db 调用回填（或 main.py 调用）
  - path: backend/peekview/config.py:201-222
    why: PeekCleanup 加 reads_retention_days 配置项
  - path: backend/peekview/main.py
    why: create_app 中 init_db 后调用 backfill_stats（需确认调用位置）
  - path: backend/tests/test_read_tracking.py:370-410
    why: 测试名修正 + 聚合表/source/window_key 新测试的参照模式
```

## 5. 实现完成的标志

1. `record_read(action="read")` 和 `record_read(action="download")` 在同一分钟同一人同一 channel 产生 2 条 `entry_reads` 记录（BDD-01）
2. `record_read(action="read")` 连续 3 次同一分钟产生 1 条记录 `count=3`（BDD-02）
3. 公开 entry 带 `?share=token` 访问 channel 记为 "share"（BDD-03）
4. files.py 三处端点通过 share cookie 访问 channel 记为 "share"（BDD-04~06）
5. `get_read_stats()` 返回 `by_action` 和 `by_source` 字段（BDD-08~09）
6. 无 Referer → source="direct"，同域名 Referer → source="internal"（BDD-10~11）
7. `entry_read_stats` 表在 `record_read` 时同步更新 `total_reads`/`by_action`/`by_channel`/`by_source`（BDD-12）
8. `unique_readers` 重复读取者不重复计数，排除 self_read（BDD-13~15）
9. `get_read_stats()` 从聚合表读，不查原始表（BDD-16）
10. 启动时 `entry_read_stats` 为空且 `entry_reads` 有数据 → 回填，source 归 unknown（BDD-17）
11. 启动时 `entry_read_stats` 已有数据 → 不回填（BDD-18）
12. `entry_reads` 表新增 `source` 列（BDD-19）
13. 90 天前的 `entry_reads` 被清理，`entry_read_stats` 不受影响（BDD-20~21）
14. `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS=30` 时 31 天前的记录被清理（BDD-23）
15. 删 entry 时 `entry_reads` 被删，`entry_read_stats` 保留（BDD-24~25）
16. admin stats 包含 `reads.total/today/by_action/by_channel/by_source`（BDD-26）
17. admin stats `reads.total` 包含已删 entry 的历史流量（BDD-27）
18. restore merge 后 `entry_read_stats` 有数据（BDD-28）
19. restore replace 后 `entry_read_stats` 有数据（BDD-29）
20. `total_count` 包含 self_read（BDD-30）
21. discover 事件不创建 `entry_read_stats` 行（BDD-31）
22. 搜索引擎/社交平台/其他 Referer 分别归为 search/social/other（BDD-32~34）

[PROD_NOT_TOUCHED]
