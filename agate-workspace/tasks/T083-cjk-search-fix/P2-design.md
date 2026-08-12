---
phase: P2
task_id: T083-cjk-search-fix
type: design
parent: P1-requirements.md
trace_id: T083-P2-20260731
status: draft
created: 2026-07-31
agent: architect
---

# P2 方案设计 — T083: 中文搜索与 Tag 过滤修复

## 影响域分析

### 改什么

| 文件 | 改动 | 说明 |
|------|------|------|
| `backend/peekview/text_utils.py` | **新增** | jieba 分词模块：`tokenize_for_fts()` / `tokenize_query()` / `preload_jieba()` |
| `backend/peekview/database.py` | 改 | trigger 降级为仅 DELETE；`backfill_fts_content` 版本标记 + 分词；`rebuild_fts_index` 分词；`search_entries` 查询端分词；migration 中 DROP 旧 trigger |
| `backend/peekview/services/entry_service.py` | 改 | `_update_fts_content` 分词；`list_entries` tag 过滤改 json_each + FTS 查询分词 |
| `backend/peekview/main.py` | 改 | lifespan 预加载 jieba（init_db 后、backfill 前） |
| `backend/pyproject.toml` | 改 | 添加 `jieba>=0.42.1` 依赖 |

### 不改什么

- **数据库 schema**：FTS5 表结构不变（summary/tags/content 三列 + contentless_delete=1）
- **存储的 tag 值**：DB 中 tags 列仍是 JSON 数组，值不变
- **前端**：tag 过滤和搜索的前端交互、请求参数不变
- **MCP server**：MCP 通过 API 创建 entry，走后端 FTS 逻辑
- **CLI**：走后端 API
- **API 请求/响应格式**：`GET /api/v1/entries?tags=<tag>&q=<query>` 不变
- **content 聚合逻辑**：`_aggregate_entry_content` 文件内容读取逻辑不变（但聚合后需分词）

### 风险在哪

1. **trigger 降级为仅 DELETE → 应用层独占 FTS 写入**：如果 `_update_fts_content` 失败，FTS 中不会有该 entry 的数据。但 `_update_fts_content` 失败极少（文件读取失败已被 try/except 吞掉），且 backfill 启动时会修复。零 trigger 兜底数据 = 更干净，不会残留含 \uXXXX 的垃圾 FTS 数据。
2. **jieba 分词不完美**：专有名词可能切错。最小验证确认 `FastAPI`/`PostgreSQL` 不被切错。可接受——比 unicode61 不分词好得多。
3. **backfill 版本标记 → 首次升级时全量重建**：版本不匹配时重建所有 entry 的 FTS 索引。对于 entry <1000 的场景，重建 <1s，可接受。后续启动版本匹配则跳过。
4. **jieba dict 加载 0.4s**：首次加载延迟。通过 lifespan 预加载消除。

## 候选方案

### 方案 A：trigger 降级为仅 DELETE + 应用层独占 FTS 写入 + backfill 版本标记（**选定**）

**核心思路**：

1. **trigger 改为仅 DELETE**：DROP INSERT trigger；UPDATE trigger 改为只 DELETE；DELETE trigger 不变。FTS 写入完全由 `_update_fts_content` 负责。
2. **新增 `text_utils.py`**：封装 jieba 分词 + 连字符→空格处理。
3. **`_update_fts_content` 使用 `tokenize_for_fts()`**：summary/tags/content 全部分词后写入 FTS。
4. **`backfill_fts_content` 版本标记 + 强制重建**：用 `PRAGMA user_version` 存储 FTS 版本号，版本不匹配时 DELETE ALL + 逐行重建。
5. **`rebuild_fts_index` 分词**：两个分支（有 storage / 无 storage）都改为逐行 Python 处理 + 分词。
6. **`list_entries` tag 过滤改 json_each**：`WHERE EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)`。
7. **`list_entries` FTS 查询分词**：`q` 经 `tokenize_query()` 后送 MATCH。
8. **`search_entries` 查询分词**：同步更新。
9. **lifespan 预加载 jieba**：`preload_jieba()` 在 init_db 后、backfill 前。
10. **migration**：在 `_run_migrations` 中 DROP 旧 trigger（entries_ai / entries_au），确保新数据库和升级数据库都走新 trigger 方案。

**优点**：
- 消除 trigger 与应用层的竞态窗口
- trigger 不再产生无用写入和垃圾 FTS token
- FTS 数据始终是分词后的（应用层独占写入）
- 版本标记确保只在 FTS 格式变化时重建，避免每次启动浪费 I/O
- trigger 失败兜底场景不再有含 \uXXXX 的脏数据

**风险**：
- `_update_fts_content` 失败时 FTS 无数据（但 backfill 启动时可修复）
- 版本标记用 `PRAGMA user_version`，需确认无冲突（已确认：项目未使用 user_version）

**工作量**：中等。新增 1 模块 + 改 4 文件 + migration。

### 方案 B：保留 trigger + 应用层覆盖 + backfill 无条件重建

**核心思路**：

1. **trigger 不变**：保持 INSERT/UPDATE 写入未分词数据。`_update_fts_content` 随后 DELETE+INSERT 覆盖为分词数据。
2. **`text_utils.py` / `_update_fts_content` / `rebuild_fts_index` / `list_entries` / `search_entries` / lifespan**：同方案 A。
3. **`backfill_fts_content` 无条件重建**：去掉 `content_count < entry_count` 条件，每次启动都 DELETE ALL + 重建。

**优点**：
- trigger 不动，改动量略小
- backfill 逻辑简单（无条件重建，无版本标记）

**风险**：
- trigger 写入未分词数据 → commit 到 _update_fts_content 之间短暂存在于 FTS
- `_update_fts_content` 失败时 FTS 残留未分词数据（含 \uXXXX 转义）→ 中文搜索对该 entry 失效
- 每次启动都全量重建 FTS（即使数据未变化），entry 多时 I/O 浪费
- trigger 的 INSERT 写入 `NEW.tags`（JSON 值含 `\uXXXX`），FTS 中有垃圾 token

**工作量**：略小于方案 A（trigger 不动 + 无版本标记逻辑）。

### 选择理由：方案 A

1. **trigger 降级语义正确**：trigger 是纯 SQL，不能调 jieba，写入的 FTS 数据一定是未分词的（含 `\uXXXX` 转义和未分词中文）。保留它只会产生竞态窗口和垃圾数据。让 trigger 只负责清理（DELETE/UPDATE 时移除旧 FTS row）是更干净的设计。
2. **版本标记优于无条件重建**：首次升级时全量重建（必要），后续启动版本匹配则跳过。无条件重建在每次启动都浪费 I/O。
3. **方案 B 的"trigger 不动"看似改动小**，但留下了竞态窗口和 `_update_fts_content` 失败时的脏数据风险。P7 一致性检查可能标记 trigger 与应用层写入不一致为 `[DEVIATION]`。

## 详细设计

### 1. 新增 `backend/peekview/text_utils.py`

```python
import jieba
import logging

logger = logging.getLogger(__name__)

_jieba_loaded = False


def preload_jieba() -> None:
    global _jieba_loaded
    if _jieba_loaded:
        return
    jieba.initialize()
    _jieba_loaded = True
    logger.info("jieba dictionary preloaded")


def tokenize_for_fts(text: str | None) -> str:
    if not text:
        return ""
    tokens = jieba.cut(text)
    result = []
    for token in tokens:
        cleaned = token.replace("-", " ").strip()
        if cleaned:
            result.append(cleaned)
    return " ".join(result)


def tokenize_query(query: str) -> str:
    if not query or not query.strip():
        return ""
    tokens = jieba.cut(query.strip())
    result = []
    for token in tokens:
        cleaned = token.replace("-", " ").strip()
        if cleaned:
            result.append(cleaned)
    return " ".join(result)
```

**设计要点**：
- `preload_jieba()` 幂等，多次调用安全
- `tokenize_for_fts()` 用于写入 FTS 索引文本：jieba 分词 + 连字符→空格 + 过滤空 token
- `tokenize_query()` 用于查询端分词：同样处理
- 两个函数逻辑相同，分开命名是为了语义清晰（写入 vs 查询）
- None 安全：`text=None` 返回空字符串
- jieba 精确模式（默认 `jieba.cut()`）线程安全，FastAPI 多线程环境无需加锁

### 2. `database.py` — trigger 降级为仅 DELETE

在 `_run_migrations()` 中添加 trigger 迁移（幂等 DROP + 在 `setup_fts5` 中 CREATE 新 trigger）：

**`_run_migrations` 追加**：
```python
# FTS trigger migration: drop INSERT/UPDATE triggers that write untokenized data
conn.execute(text("DROP TRIGGER IF EXISTS entries_ai"))
conn.execute(text("DROP TRIGGER IF EXISTS entries_au"))
# entries_ad (DELETE trigger) kept as-is
conn.commit()
logger.info("Migration: dropped FTS INSERT/UPDATE triggers (application layer manages FTS writes)")
```

**`setup_fts5` trigger 部分改为**：
```python
# DELETE trigger — unchanged
conn.execute(text("""
    CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries
    BEGIN
        DELETE FROM entries_fts WHERE rowid = OLD.id;
    END
"""))

# UPDATE trigger — only DELETE (no INSERT; application layer writes new FTS data)
conn.execute(text("""
    CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries
    BEGIN
        DELETE FROM entries_fts WHERE rowid = OLD.id;
    END
"""))

# No INSERT trigger — application layer (_update_fts_content) handles FTS writes
```

**注意**：`setup_fts5` 只在 FTS 表不存在时创建。但 trigger 的 DROP+CREATE 在 `_run_migrations` 中幂等执行。对于已有数据库，migration DROP 旧 trigger；`setup_fts5` 因 FTS 表已存在而跳过（trigger 在 migration 中处理）。对于新数据库，`setup_fts5` 创建新 trigger。

**问题**：`setup_fts5` 在 FTS 表已存在时 `return`（L260-261），不会创建 trigger。需要确保新数据库的 trigger 也被创建。方案：在 `setup_fts5` 中即使 FTS 表已存在也执行 trigger 的 DROP+CREATE，或者在 `_run_migrations` 中也执行 trigger 的 DROP+CREATE。

**最终方案**：`_run_migrations` 中无条件执行 trigger DROP + CREATE（幂等），`setup_fts5` 中保留新 trigger 的 CREATE（IF NOT EXISTS）。这样：
- 新数据库：`create_all` → `_run_migrations`（DROP+CREATE trigger）→ `setup_fts5`（CREATE IF NOT EXISTS，已有则跳过）
- 已有数据库：`create_all`（表已存在跳过）→ `_run_migrations`（DROP 旧 trigger + CREATE 新 trigger）→ `setup_fts5`（表已存在跳过）

### 3. `database.py` — `backfill_fts_content` 版本标记 + 强制重建

```python
FTS_VERSION = 2  # v1 = original (unicode61, no jieba), v2 = jieba tokenized

def _get_user_version(conn) -> int:
    result = conn.execute(text("PRAGMA user_version")).scalar()
    return result or 0

def _set_user_version(conn, version: int) -> None:
    conn.execute(text(f"PRAGMA user_version = {version}"))


def backfill_fts_content(engine: Engine, storage: StorageManager) -> None:
    with Session(engine) as session:
        from peekview.models import Entry

        entry_count = session.exec(text("SELECT COUNT(*) FROM entries")).scalar()
        if entry_count == 0:
            return

        current_version = _get_user_version(session)
        content_count = session.exec(
            text("SELECT COUNT(*) FROM entries_fts WHERE content IS NOT NULL AND content != ''")
        ).scalar()

        # Skip if version matches AND content is complete
        if current_version >= FTS_VERSION and content_count >= entry_count:
            logger.debug("FTS content already backfilled (version %d)", current_version)
            return

        # Version mismatch or content incomplete → rebuild
        session.exec(text("DELETE FROM entries_fts"))
        _set_user_version(session, FTS_VERSION)

        entries = session.exec(select(Entry)).all()
        for entry in entries:
            content = _aggregate_entry_content(entry.id, storage, session)
            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry.id,
                    summary=tokenize_for_fts(entry.summary),
                    tags=tokenize_for_fts(" ".join(entry.tags or [])),
                    content=tokenize_for_fts(content),
                )
            )

        session.commit()
        logger.info(f"Backfilled FTS content for {len(entries)} entries (version {FTS_VERSION})")
```

**`PRAGMA user_version` 无冲突**：grep 确认项目未使用 `user_version`，可安全用于 FTS 版本标记。

**注意**：`_get_user_version` / `_set_user_version` 接受 session 或 connection（SQLAlchemy session 和 connection 都支持 execute）。实际实现时参数类型用 `Session`。

### 4. `database.py` — `rebuild_fts_index` 分词

两个分支都改为逐行 Python 处理：

```python
def rebuild_fts_index(engine: Engine, storage: StorageManager | None = None) -> None:
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='entries_fts'")
        )
        if not result.scalar():
            logger.warning("FTS5 table does not exist, skipping rebuild")
            return

        try:
            conn.execute(text("DELETE FROM entries_fts"))
        except Exception as e:
            logger.warning(f"Could not delete from entries_fts: {e}")

        with Session(engine) as session:
            from peekview.models import Entry

            entries = session.exec(select(Entry)).all()
            for entry in entries:
                if storage:
                    content = _aggregate_entry_content(entry.id, storage, session)
                else:
                    content = ""
                conn.execute(
                    text(
                        "INSERT INTO entries_fts(rowid, summary, tags, content) "
                        "VALUES (:id, :summary, :tags, :content)"
                    ).bindparams(
                        id=entry.id,
                        summary=tokenize_for_fts(entry.summary),
                        tags=tokenize_for_fts(" ".join(entry.tags or [])),
                        content=tokenize_for_fts(content) if content else "",
                    )
                )

        conn.commit()
        logger.info("FTS5 index rebuilt")
```

**变化**：无 storage 分支不再用 `INSERT ... SELECT FROM entries`（无法分词），改为逐行 Python 处理。两个分支合并为统一路径。

### 5. `database.py` — `search_entries` 查询端分词

```python
def search_entries(session: Session, query: str, limit: int = 100) -> list[int]:
    from peekview.text_utils import tokenize_query

    tokenized = tokenize_query(query)
    if not tokenized:
        return []

    safe_query = tokenized.replace('"', '""').replace("'", "''")

    result = session.exec(
        text("""
            SELECT rowid FROM entries_fts
            WHERE entries_fts MATCH :query
            ORDER BY rank
            LIMIT :limit
        """).bindparams(query=safe_query, limit=limit)
    )

    return [row[0] for row in result]
```

**变化**：`query` 先经 `tokenize_query()` 分词，再转义。空查询返回空列表（原有逻辑是直接送 FTS5，可能报错）。

### 6. `entry_service.py` — `_update_fts_content` 分词

```python
def _update_fts_content(self, entry_id: int) -> None:
    from peekview.text_utils import tokenize_for_fts

    with Session(self.engine) as session:
        entry = session.exec(select(Entry).where(Entry.id == entry_id)).first()
        if not entry:
            return

        # ... file content aggregation (unchanged) ...
        aggregated = " ".join(content_parts)

        session.exec(text("DELETE FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id))
        session.exec(
            text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "VALUES (:id, :summary, :tags, :content)"
            ).bindparams(
                id=entry_id,
                summary=tokenize_for_fts(entry.summary),
                tags=tokenize_for_fts(" ".join(entry.tags or [])),
                content=tokenize_for_fts(aggregated),
            )
        )
        session.commit()
```

**变化**：`entry.summary` → `tokenize_for_fts(entry.summary)`；`" ".join(entry.tags or [])` → `tokenize_for_fts(" ".join(entry.tags or []))`；`aggregated` → `tokenize_for_fts(aggregated)`。

### 7. `entry_service.py` — `list_entries` tag 过滤改 json_each

```python
# Tags filter — use json_each for exact match (fixes non-ASCII tag filtering)
if tags:
    for tag in tags:
        tag_filter = text(
            "EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)"
        ).bindparams(tag=tag)
        query = query.where(tag_filter)
        count_query = count_query.where(tag_filter)
```

**注意**：`json_each(entries.tags)` 引用的是物理表名 `entries`（已确认 `Entry.__tablename__ = "entries"`）。SQLModel 的 `query` 基于 `Entry` 模型，SQLAlchemy 生成的 SQL 中表名为 `entries`，`json_each(entries.tags)` 可正确解析。

**语义变化**：LIKE（子串匹配）→ json_each（精确匹配）。消除了 `pythonic` 匹配 `python` 的误匹配。P1 BDD-4 明确要求此行为。

### 8. `entry_service.py` — `list_entries` FTS 查询分词

```python
# FTS5 search
from peekview.text_utils import tokenize_query

if q and q.strip():
    tokenized = tokenize_query(q)
    if tokenized:
        safe_q = tokenized.replace('"', '""').replace("'", "''")
        try:
            fts_result = session.exec(
                text("SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q"),
                params={"q": safe_q},
            )
            fts_ids = [row[0] for row in fts_result]
            if fts_ids:
                query = query.where(Entry.id.in_(fts_ids))
                count_query = count_query.where(Entry.id.in_(fts_ids))
            else:
                return EntryListResponse(
                    items=[],
                    total=0,
                    page=page,
                    per_page=per_page,
                    owner_found=owner_found,
                )
        except Exception:
            pass
```

**变化**：`q.strip()` → `tokenize_query(q)` + 转义。tokenize_query 返回空时跳过 FTS（原逻辑是 `q.strip()` 为空时跳过）。

### 9. `main.py` — lifespan 预加载 jieba

```python
# After init_db, before backfill
engine = init_db(config.db_path, run_migrations=True)
app.state.engine = engine

from peekview.text_utils import preload_jieba
preload_jieba()

from peekview.database import backfill_fts_content
backfill_fts_content(engine, storage)
```

**位置**：L200（`init_db`）之后，L214（`backfill_fts_content`）之前。确保 jieba dict 在 backfill 分词前已加载。

### 10. `pyproject.toml` — 添加 jieba 依赖

```toml
dependencies = [
    # ... existing ...
    "jieba>=0.42.1",
]
```

### 11. Migration — trigger 变更

在 `_run_migrations()` 末尾追加（幂等）：

```python
# FTS trigger migration: application layer now manages FTS writes via jieba tokenization
# Drop INSERT trigger (no longer needed) and UPDATE trigger (changed to DELETE-only)
conn.execute(text("DROP TRIGGER IF EXISTS entries_ai"))
conn.execute(text("DROP TRIGGER IF EXISTS entries_au"))
# entries_ad (DELETE trigger) kept as-is
conn.commit()
logger.info("Migration: dropped FTS INSERT/UPDATE triggers for jieba tokenization")

# Re-create UPDATE trigger as DELETE-only
conn.execute(text("""
    CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries
    BEGIN
        DELETE FROM entries_fts WHERE rowid = OLD.id;
    END
"""))
conn.commit()
logger.info("Migration: created DELETE-only UPDATE trigger")
```

**执行顺序**：`_run_migrations` 在 `setup_fts5` 之前执行（init_db L212-219）。对于已有数据库：migration DROP 旧 trigger + CREATE 新 trigger；`setup_fts5` 因表已存在跳过。对于新数据库：`create_all` 建表 → migration DROP（无 trigger 存在，IF EXISTS 安全）+ CREATE 新 trigger → `setup_fts5` 建表 + trigger（IF NOT EXISTS，已有则跳过）。

## FTS 写入路径覆盖确认

| 路径 | 位置 | 改动 |
|------|------|------|
| trigger (INSERT) | database.py L277-282 | DROP trigger，不再写入 FTS |
| trigger (UPDATE) | database.py L294-302 | 改为只 DELETE（migration DROP + CREATE） |
| trigger (DELETE) | database.py L285-292 | 不变 |
| `_update_fts_content` | entry_service.py L68-114 | summary/tags/content 经 `tokenize_for_fts()` |
| `backfill_fts_content` | database.py L492-528 | 版本标记触发重建 + 分词 |
| `rebuild_fts_index` | database.py L379-428 | 两个分支都逐行分词 |

## 查询端覆盖确认

| 路径 | 位置 | 改动 |
|------|------|------|
| `list_entries` tag 过滤 | entry_service.py L458-463 | LIKE → json_each 精确匹配 |
| `list_entries` FTS 搜索 | entry_service.py L466-486 | q 经 `tokenize_query()` |
| `search_entries` | database.py L349-376 | q 经 `tokenize_query()` |

## jieba 预加载确认

| 位置 | 时机 | 文件 |
|------|------|------|
| main.py lifespan | init_db 后、backfill 前 | main.py L200-214 |

## 实现完成的标志

1. `make test-quick` 全绿（现有测试 + 新增中文搜索/过滤测试）
2. `make lint` 无新增 ruff 错误
3. `make typecheck` 通过（如有 TS 相关，但本任务不改前端）
4. 调试环境验证：`make debug-start` → 通过 API 搜索中文子词命中
5. BDD-1 到 BDD-17 全部 PASS

## 声明字段

```yaml
packages:
  - backend  # pyproject.toml 添加 jieba 依赖，P8 需 bump 版本
domains: [backend]
ui_affected: false
gate_commands:
  P3: "backend/.venv/bin/python -m pytest backend/tests/ -v --tb=short"
  P5: "make test-quick"
  P5_e2e: null
```

## env_constraints

```yaml
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）；make test-quick（venv pytest）；make lint（系统 python3 ruff）"
  isolation_check: "conftest.py autouse 隔离（PEEKVIEW_STORAGE__DATA_DIR/DB_PATH → tmp_path）；make debug-verify-isolation 验证 /tmp/peekview-debug/ 与生产隔离"
```

## files_to_read

```yaml
files_to_read:
  - path: backend/peekview/database.py:39-134
    why: _run_migrations 逻辑，trigger migration DROP+CREATE 追加位置
  - path: backend/peekview/database.py:248-306
    why: setup_fts5 trigger 定义，改为只创建 DELETE + DELETE-only UPDATE trigger
  - path: backend/peekview/database.py:349-376
    why: search_entries 查询端分词改造
  - path: backend/peekview/database.py:379-428
    why: rebuild_fts_index 两个分支统一为逐行分词
  - path: backend/peekview/database.py:492-528
    why: backfill_fts_content 版本标记 + 强制重建 + 分词
  - path: backend/peekview/services/entry_service.py:68-114
    why: _update_fts_content 分词改造
  - path: backend/peekview/services/entry_service.py:458-486
    why: list_entries tag 过滤改 json_each + FTS 查询分词
  - path: backend/peekview/main.py:200-214
    why: lifespan 中插入 jieba 预加载
  - path: backend/pyproject.toml:25-42
    why: 添加 jieba 依赖
  - path: backend/tests/test_database.py:160-210
    why: 现有 FTS 搜索测试，确认零回归 + 新增中文搜索测试
```

## minimal_validation

```yaml
minimal_validation:
  assumption_1: "jieba.cut 精确模式（默认）线程安全，FastAPI 多线程环境下无需加锁"
  method_1: "10 线程并发 jieba.cut('前端组件库设计')，验证结果一致性"
  result_1: "confirmed — 10 线程结果全部一致"

  assumption_2: "jieba 分词后空格连接送 FTS5 MATCH，空格作为 AND 操作符语义正确"
  method_2: "内存 SQLite + FTS5 表，写入 jieba 分词后的文本，搜索子词验证命中"
  result_2: "confirmed — 搜 '组件' 命中，搜 '组件库'（分词为 '组件 库' AND）命中，搜 '数据库' 不命中"

  assumption_3: "jieba 对英文专有名词不切错（FastAPI/PostgreSQL 保持完整）"
  method_3: "jieba.cut('FastAPI') / jieba.cut('PostgreSQL') 验证"
  result_3: "confirmed — FastAPI → ['FastAPI']，PostgreSQL → ['PostgreSQL']，零回归"

  assumption_4: "trigger 是纯 SQL，不能调用 Python jieba"
  method_4: "读 SQLite FTS5 trigger 语法文档 + 确认 trigger body 只能是 SQL 语句"
  result_4: "confirmed — trigger 无法调用 Python，必须由应用层负责 FTS 写入"

  assumption_5: "trigger 写入的 FTS 数据（NEW.tags JSON 值含 \\uXXXX）导致中文搜索不命中"
  method_5: "内存 SQLite 模拟 trigger 写入 JSON 序列化的 tags，搜索中文验证"
  result_5: "confirmed — trigger 路径搜 '组件' 返回空，应用层分词路径搜 '组件' 命中"

  assumption_6: "json_each 对 JSON 数组做精确匹配，不受 ensure_ascii 转义影响"
  method_6: "内存 SQLite 插入 ensure_ascii=True 的 JSON tags，用 json_each 查询验证"
  result_6: "confirmed — json_each 遍历解析后的 JSON 值，\\uXXXX 被 SQLite JSON 引擎解码为原始字符"

  note: "所有关键假设均已通过最小验证确认。方案不依赖浏览器行为/外部系统行为。核心依赖是 jieba 分词库行为 + SQLite FTS5/json_each 行为，均已在内存 SQLite + venv jieba 0.42.1 中验证。"
```

## [PROD_NOT_TOUCHED]

本阶段为方案设计，仅读取代码文件 + 内存 SQLite 验证，未触碰生产环境（`~/.peekview/` 或 `:8080`）。
