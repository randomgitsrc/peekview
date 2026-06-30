---
phase: P2
task_id: T037-search-content-expansion
type: design
parent: P1-requirements.md
trace_id: T037-P2-20260630
status: draft
created: 2026-06-30
---

# P2 Design — T037: FTS5 Search Content Expansion

## Declarations

```yaml
packages: [backend/peekview, frontend-v3]
domains: [backend, frontend]
ui_affected: true
ui_interaction_points:
  - SearchInput.vue placeholder 文案变更（BDD-5）
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_lint: "cd backend && python3 -m ruff check peekview/ tests/"
  P5_frontend: "cd frontend-v3 && npx vue-tsc --noEmit"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no -k 'test_fts_content or test_search_content or test_backfill'"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries_fts' && 确认测试 DB 在 tmp_path"
files_to_read:
  - path: backend/peekview/database.py
    why: FTS5 表结构、触发器、rebuild_fts_index — 核心改动文件
  - path: backend/peekview/database.py:193-258
    why: setup_fts5() — 需重写为 contentless 模式
  - path: backend/peekview/database.py:301-365
    why: search_entries() + rebuild_fts_index() — 需扩展
  - path: backend/peekview/services/entry_service.py:82-260
    why: create_entry() — 需在 entry 创建后更新 FTS content
  - path: backend/peekview/services/entry_service.py:442-587
    why: update_entry() — 文件增删后需更新 FTS content
  - path: backend/peekview/services/entry_service.py:288-440
    why: list_entries() — FTS5 搜索逻辑（可能无需改动，FTS 扩展自动生效）
  - path: backend/peekview/storage.py:413-497
    why: StorageManager — 回填时读文件内容
  - path: backend/peekview/language.py:307-329
    why: is_binary_content() — 判断文件是否跳过索引
  - path: backend/peekview/models.py:180-224
    why: Entry model — 理解 entry 结构
  - path: frontend-v3/src/components/SearchInput.vue
    why: placeholder 文案变更
  - path: frontend-v3/src/views/EntryListView.vue:55-60
    why: SearchInput 使用处，placeholder 传入
  - path: backend/tests/test_database.py
    why: 现有 FTS5 测试模式，新测试需遵循
  - path: backend/tests/conftest.py
    why: 测试隔离机制
minimal_validation:
  assumption: "FTS5 contentless 模式 (content='') 不支持 DELETE；contentless_delete=1 选项可启用删除支持"
  method: "Python sqlite3 内存数据库验证：1) content='' 模式 DELETE 失败；2) content='' + contentless_delete=1 模式 DELETE 成功；3) standalone 模式 DELETE 成功"
  result: "confirmed"
  note: "SQLite 3.45.1 支持 contentless_delete=1。三种模式均验证：contentless+contentless_delete=1 为最优方案（索引最小+支持删除+无需存原文）。FTS5 不支持 ALTER TABLE，必须 DROP+CREATE 重建。"
```

## 1. Design Goals

1. FTS5 索引从 `(summary, tags)` 扩展到 `(summary, tags, content)`，content 聚合 entry 下所有文本文件内容
2. 文件增删后 FTS content 自动同步
3. 已有 entry 的文件内容回填到 FTS 索引
4. 二进制文件排除、大文件截断
5. 前端搜索框提示搜索范围包含文件内容
6. 搜索 API 签名不变，搜索范围透明扩大

## 2. Impact Analysis

### 改什么

| 文件 | 改动 | 说明 |
|------|------|------|
| `database.py:setup_fts5()` | 重写 | FTS5 表从 content-sync 模式改为 contentless+contentless_delete 模式，增加 content 列 |
| `database.py:3 个触发器` | 重写 | 触发器改为 contentless 模式的 delete/insert 语法，content 列留空（由应用层填充） |
| `database.py:_run_migrations()` | 新增迁移 | 检测旧 FTS5 表结构，DROP+CREATE 重建 + 回填 |
| `database.py:rebuild_fts_index()` | 扩展 | 回填时聚合文件内容写入 content 列 |
| `database.py:新增 _aggregate_entry_content()` | 新函数 | 读取 entry 所有文本文件内容，截断后拼接 |
| `entry_service.py:create_entry()` | 扩展 | entry 创建+文件写入后，更新 FTS content 列 |
| `entry_service.py:update_entry()` | 扩展 | 文件增删后，更新 FTS content 列 |
| `entry_service.py:新增 _update_fts_content()` | 新方法 | 聚合 entry 文件内容并更新 FTS content |
| `SearchInput.vue` | 改默认 placeholder | `'Search...'` → `'Search summaries & file content...'` |
| `EntryListView.vue` | 改传入 placeholder | `'Search entries...'` → `'Search summaries & file content...'` |

### 不改什么

| 文件/接口 | 原因 |
|-----------|------|
| `search_entries()` 函数签名 | FTS5 MATCH 自动覆盖所有列，无需改查询 |
| `list_entries()` 的 FTS 查询逻辑 | 同上 |
| API 路由 (`/api/v1/entries`) | `q` 参数透传，FTS 扩展自动生效 |
| MCP server (`list_entries`) | 同上，自动受益 |
| CLI (`peekview list -q`) | 同上 |
| `models.py` (Entry/File) | 无 schema 变更 |
| `storage.py` | 只读取，不修改 |

### 风险在哪

| 风险 | 缓解 |
|------|------|
| FTS5 重建期间搜索不可用 | 迁移在启动时执行，DROP+CREATE+回填在事务外但快速（contentless 模式不存原文，索引构建快） |
| 回填大量文件内容耗时 | 每文件截断到 100KB，分批处理，日志进度 |
| 索引体积增大 | contentless 模式只存倒排索引不存原文，体积增长可控 |
| 触发器不再自动同步 content | content 列由应用层（entry_service）管理，触发器只处理 summary/tags |

## 3. Design Details

### 3.1 FTS5 表结构变更

**当前**：
```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    summary, tags,
    content='entries', content_rowid='id'
)
```

**目标**：
```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    summary, tags, content,
    content='', contentless_delete=1
)
```

**关键决策**：使用 `content=''` (contentless) + `contentless_delete=1` 模式

理由：
- `content='entries'` 同步模式无法支持 content 列（content 数据来源是 files 表+磁盘，不是 entries 表）
- contentless 模式不存储原文，索引体积最小
- `contentless_delete=1` 启用删除支持（SQLite ≥ 3.4.0，当前 3.45.1）
- standalone 模式（无 content=）会存储原文，但 content 列原文已在磁盘文件中，无需重复存储

### 3.2 触发器重设计

**问题**：contentless 模式下，触发器不能使用 `INSERT INTO entries_fts(entries_fts, rowid, ...) VALUES ('delete', ...)` 语法（contentless 表没有 entries_fts 列）。需使用 `DELETE FROM entries_fts WHERE rowid = ?` 语法。

**INSERT 触发器**（entry 创建时）：
```sql
CREATE TRIGGER entries_ai AFTER INSERT ON entries
BEGIN
    INSERT INTO entries_fts(rowid, summary, tags, content)
    VALUES (NEW.id, NEW.summary, NEW.tags, '');
END
```

注意：触发器只填 summary/tags，content 留空字符串。content 由应用层在文件写入后更新。

**DELETE 触发器**（entry 删除时）：
```sql
CREATE TRIGGER entries_ad AFTER DELETE ON entries
BEGIN
    DELETE FROM entries_fts WHERE rowid = OLD.id;
END
```

**UPDATE 触发器**（entry 的 summary/tags 变更时）：
```sql
CREATE TRIGGER entries_au AFTER UPDATE ON entries
BEGIN
    DELETE FROM entries_fts WHERE rowid = OLD.id;
    INSERT INTO entries_fts(rowid, summary, tags, content)
    VALUES (NEW.id, NEW.summary, NEW.tags, '');
END
```

注意：UPDATE 触发器也只处理 summary/tags，content 留空。如果 summary/tags 变更但文件不变，content 需要保留。方案：UPDATE 触发器先删后插 content=''，然后由应用层重新填充 content。

**但这里有个问题**：UPDATE 触发器会把 content 清空。如果只改 summary 不改文件，content 丢失。

**解决方案**：UPDATE 触发器中，先读取旧 content 再写入：

contentless 模式下无法 SELECT content 列（contentless 表不存原文，无法读取）。所以触发器无法保留旧 content。

**最终方案**：UPDATE 触发器清空 content 后，由 `entry_service.update_entry()` 在 commit 后重新填充 content。这确保了：
- summary/tags 变更 → 触发器更新 summary/tags，content 被清空
- 应用层在 update_entry 结束前重新填充 content
- 文件增删 → 应用层重新填充 content

**时序**：
1. `update_entry()` 修改 entry 字段 → 触发器触发 → FTS summary/tags 更新，content 清空
2. `update_entry()` 处理文件增删
3. `update_entry()` commit 后调用 `_update_fts_content(entry_id)` → 重新填充 content

### 3.3 应用层 FTS content 管理

新增 `EntryService._update_fts_content(entry_id: int)` 方法：

```python
def _update_fts_content(self, entry_id: int) -> None:
    """Aggregate text file content for an entry and update FTS content column."""
    with Session(self.engine) as session:
        files = session.exec(
            select(File).where(File.entry_id == entry_id, File.is_binary == False)
        ).all()

        content_parts = []
        for f in files:
            try:
                disk_path = self.storage.get_disk_path(entry_id, f.filename, f.path)
                if disk_path.exists():
                    raw = disk_path.read_bytes()
                    text = raw.decode('utf-8', errors='replace')[:FTS_CONTENT_TRUNCATE]
                    content_parts.append(text)
            except Exception:
                continue

        aggregated = ' '.join(content_parts)

        # Update FTS: delete old row, reinsert with content
        session.exec(text(
            "DELETE FROM entries_fts WHERE rowid = :id"
        ).bindparams(id=entry_id))

        entry = session.exec(select(Entry).where(Entry.id == entry_id)).first()
        if entry:
            session.exec(text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "VALUES (:id, :summary, :tags, :content)"
            ).bindparams(id=entry_id, summary=entry.summary, tags=' '.join(entry.tags or []), content=aggregated))

        session.commit()
```

**截断阈值**：`FTS_CONTENT_TRUNCATE = 100_000`（每文件 100KB ≈ 100K 字符）

**调用点**：
1. `create_entry()` — entry 创建 + 文件写入 + commit 后
2. `update_entry()` — 文件增删 + commit 后
3. `update_entry()` — summary/tags 变更 + commit 后（因为触发器清空了 content）

### 3.4 迁移策略

在 `_run_migrations()` 中新增迁移步骤：

```python
# Check if FTS5 table has 'content' column
fts_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(entries_fts)"))}
if 'content' not in fts_columns:
    # Migration: rebuild FTS5 with content column
    conn.execute(text("DROP TABLE IF EXISTS entries_fts"))
    conn.execute(text("DROP TRIGGER IF EXISTS entries_ai"))
    conn.execute(text("DROP TRIGGER IF EXISTS entries_ad"))
    conn.execute(text("DROP TRIGGER IF EXISTS entries_au"))
    # setup_fts5 will be called after migrations
    conn.commit()
    logger.info("Migration: dropped old FTS5 table for content column expansion")
```

然后在 `init_db()` 中，`_run_migrations()` 之后调用 `setup_fts5()`，`setup_fts5()` 检测到 FTS5 表不存在则创建新结构。

**回填**：`setup_fts5()` 创建新 FTS5 表后，调用 `_backfill_fts_content()` 回填已有 entry 的文件内容。

```python
def _backfill_fts_content(engine: Engine, storage: StorageManager | None = None) -> None:
    """Backfill FTS content column for existing entries."""
    with Session(engine) as session:
        entries = session.exec(select(Entry)).all()
        if not entries:
            return

        for entry in entries:
            files = session.exec(
                select(File).where(File.entry_id == entry.id, File.is_binary == False)
            ).all()

            content_parts = []
            if storage:
                for f in files:
                    try:
                        disk_path = storage.get_disk_path(entry.id, f.filename, f.path)
                        if disk_path.exists():
                            raw = disk_path.read_bytes()
                            text = raw.decode('utf-8', errors='replace')[:FTS_CONTENT_TRUNCATE]
                            content_parts.append(text)
                    except Exception:
                        continue

            aggregated = ' '.join(content_parts)
            session.exec(text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "VALUES (:id, :summary, :tags, :content)"
            ).bindparams(
                id=entry.id,
                summary=entry.summary,
                tags=' '.join(entry.tags or []),
                content=aggregated,
            ))

        session.commit()
        logger.info(f"Backfilled FTS content for {len(entries)} entries")
```

**问题**：`_run_migrations()` 和 `setup_fts5()` 在 `init_db()` 中调用，此时没有 `StorageManager` 实例。回填需要读磁盘文件。

**解决方案**：回填不在 `init_db()` 中执行。改为：
1. `init_db()` 中迁移只负责 DROP 旧 FTS5 + CREATE 新 FTS5 + 回填 summary/tags（从 entries 表）
2. 回填 content 在应用启动时由 `main.py` 的 startup event 执行，此时 `StorageManager` 已可用
3. 新增 `database.py:backfill_fts_content(engine, storage)` 公开函数，由 startup event 调用

**启动时序**：
1. `init_db()` → 迁移 DROP 旧 FTS5 → `setup_fts5()` 创建新 FTS5 + 触发器 → 回填 summary/tags
2. `create_app()` startup event → `backfill_fts_content(engine, storage)` → 回填 content

**幂等性**：回填前检查 FTS 中是否已有 content 数据。用一个简单的标记：检查任意 entry 的 content 是否非空。如果已有数据则跳过。

```python
def backfill_fts_content(engine: Engine, storage: StorageManager) -> None:
    """Backfill FTS content column for existing entries (idempotent)."""
    with Session(engine) as session:
        # Check if backfill already done
        sample = session.exec(
            text("SELECT content FROM entries_fts LIMIT 1")
        ).first()
        if sample and sample[0]:
            logger.debug("FTS content already backfilled, skipping")
            return
        # ... backfill logic
```

**注意**：contentless 模式下 `SELECT content FROM entries_fts` 会报错（contentless 表不存原文，无法 SELECT 非 rowid 列）。

**修正**：用应用层标记代替。在 entries 表加一个 `fts_content_version` 列，或用 sqlite_master 的 SQL 文本判断 FTS5 表是否包含 content 列。

**最终方案**：用 `PRAGMA table_info(entries_fts)` 检查是否有 content 列。如果有 content 列且 entries 存在但 FTS 行数为 0，则需要回填。如果 FTS 行数等于 entries 行数，则已回填。

```python
def backfill_fts_content(engine: Engine, storage: StorageManager) -> None:
    with Session(engine) as session:
        entry_count = session.exec(text("SELECT COUNT(*) FROM entries")).scalar()
        fts_count = session.exec(text("SELECT COUNT(*) FROM entries_fts")).scalar()

        if fts_count >= entry_count and entry_count > 0:
            logger.debug("FTS content already backfilled")
            return

        # Need backfill: delete all FTS rows and rebuild with content
        session.exec(text("DELETE FROM entries_fts"))
        # ... rebuild with content
```

### 3.5 rebuild_fts_index() 扩展

`rebuild_fts_index()` 需要扩展为也回填 content。但该函数只接收 `Engine`，没有 `StorageManager`。

**方案**：`rebuild_fts_index()` 增加 `storage: StorageManager | None = None` 参数。如果提供 storage，则回填 content；否则 content 列留空。

```python
def rebuild_fts_index(engine: Engine, storage: StorageManager | None = None) -> None:
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM entries_fts"))

        if storage:
            # Full rebuild with content
            with Session(engine) as session:
                entries = session.exec(select(Entry)).all()
                for entry in entries:
                    content = _aggregate_entry_content(entry.id, storage, session)
                    conn.execute(text(
                        "INSERT INTO entries_fts(rowid, summary, tags, content) "
                        "VALUES (:id, :summary, :tags, :content)"
                    ).bindparams(
                        id=entry.id,
                        summary=entry.summary,
                        tags=' '.join(entry.tags or []),
                        content=content,
                    ))
        else:
            # Fallback: only summary/tags
            conn.execute(text(
                "INSERT INTO entries_fts(rowid, summary, tags, content) "
                "SELECT id, summary, tags, '' FROM entries"
            ))

        conn.commit()
```

### 3.6 前端变更

**SearchInput.vue**：默认 placeholder 从 `'Search...'` 改为 `'Search summaries & file content...'`

**EntryListView.vue**：传入 placeholder 从 `'Search entries...'` 改为 `'Search summaries & file content...'`

由于 EntryListView 已显式传入 placeholder，SearchInput 的默认值变更不会影响 EntryListView。但为了一致性，两处都改。

### 3.7 截断策略

```python
FTS_CONTENT_TRUNCATE = 100_000  # 100KB per file (~100K characters)
FTS_CONTENT_MAX_PER_ENTRY = 1_000_000  # 1MB per entry aggregate
```

- 每个文本文件截断到前 100,000 字符（覆盖绝大多数源代码文件）
- 每 entry 聚合后上限 1,000,000 字符（防止极端情况索引膨胀）
- 截断在 `_aggregate_entry_content()` 中实现

## 4. BDD Coverage Map

| BDD | 设计覆盖 | 关键实现 |
|-----|----------|----------|
| BDD-1: 文本文件内容可搜 | §3.1 FTS5 content 列 + §3.3 应用层填充 | create_entry 后 _update_fts_content |
| BDD-2: 二进制文件不进索引 | §3.3 `File.is_binary == False` 过滤 | _aggregate_entry_content 跳过 is_binary=True |
| BDD-3: 已有 entry 回填 | §3.4 迁移 + backfill_fts_content | startup event 调用回填 |
| BDD-4: 增删文件后 FTS 同步 | §3.3 _update_fts_content | update_entry commit 后调用 |
| BDD-5: 前端搜索框提示 | §3.6 前端变更 | placeholder 文案 |
| BDD-6: 大文件截断 | §3.7 截断策略 | FTS_CONTENT_TRUNCATE |
| BDD-7: summary/tags 匹配仍有效 | §3.2 触发器保留 summary/tags 同步 | 触发器 + _update_fts_content 保留 summary/tags |
| BDD-8: 空 entry 搜索不受影响 | §3.2 触发器 INSERT content='' | 空 entry content 为空字符串，FTS 仍索引 summary/tags |

## 5. Implementation Plan

### Step 1: database.py — FTS5 表结构 + 触发器 + 迁移

1. 修改 `setup_fts5()`：创建 contentless+contentless_delete FTS5 表，新触发器
2. 新增 `_run_fts_migration()`：检测旧 FTS5 结构，DROP+CREATE
3. 新增 `_aggregate_entry_content(engine, entry_id, storage)` 函数
4. 修改 `rebuild_fts_index()`：增加 storage 参数，回填 content
5. 新增 `backfill_fts_content(engine, storage)` 公开函数
6. 修改 `init_db()`：迁移后调用 setup_fts5

### Step 2: entry_service.py — 应用层 FTS content 管理

1. 新增 `EntryService._update_fts_content(entry_id)` 方法
2. 修改 `create_entry()`：commit 后调用 `_update_fts_content()`
3. 修改 `update_entry()`：commit 后调用 `_update_fts_content()`

### Step 3: main.py — startup event 回填

1. 在 startup event 中调用 `backfill_fts_content(engine, storage)`

### Step 4: 前端变更

1. 修改 `SearchInput.vue` 默认 placeholder
2. 修改 `EntryListView.vue` 传入 placeholder

## 6. Risks and Mitigations

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 迁移期间搜索不可用 | 中 | DROP+CREATE 快速（contentless 不存原文），回填异步 |
| 回填大量 entry 耗时 | 中 | 幂等检查 + 日志进度 + 每文件截断 |
| UPDATE 触发器清空 content | 中 | 应用层在 update_entry 后重新填充 |
| contentless 模式无法 SELECT content | 低 | 不需要读取 content，只需搜索 |
| 索引体积增大 | 低 | contentless 模式只存倒排索引 |

## 7. Completion Criteria

1. FTS5 表包含 summary, tags, content 三列（contentless+contentless_delete 模式）
2. 触发器正确同步 summary/tags，content 由应用层管理
3. create_entry 后 FTS content 自动填充
4. update_entry 文件增删后 FTS content 自动更新
5. 已有 entry 的文件内容在启动时回填
6. 二进制文件不进入 FTS content
7. 大文件截断到 100KB
8. 前端搜索框 placeholder 提示搜索范围
9. 搜索 API 签名不变，MCP/CLI 自动受益
10. 所有 8 条 BDD 验收通过

## 8. [SCOPE+] Discoveries

无新隐含需求。P1 的 IM-1 到 IM-10 均已覆盖。IM-9（搜索结果高亮/上下文）按 P1 裁剪说明不纳入本任务。
