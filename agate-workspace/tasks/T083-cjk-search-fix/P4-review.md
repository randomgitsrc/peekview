---
phase: P4
task_id: T083-cjk-search-fix
type: review
parent: P4-implementation.md
trace_id: T083-P4-20260731
status: approved
created: 2026-07-31
agent: review
---

# P4 Review — T083: 中文搜索与 Tag 过滤修复

## 评审范围

- `backend/peekview/text_utils.py` — jieba 分词模块
- `backend/peekview/database.py` — trigger 降级 + search_entries + rebuild_fts_index + backfill_fts_content
- `backend/peekview/services/entry_service.py` — _update_fts_content + list_entries tag 过滤 + FTS 查询
- `backend/peekview/main.py` — lifespan 预加载 jieba
- `backend/pyproject.toml` — jieba 依赖

## 评审结论

**status: approved**

无 CRITICAL 问题。2 个 INFORMATIONAL 观察（非阻断）。实现与 P2 方案 A 设计一致，测试全绿（1001 passed + 2 skipped，零回归），ruff 通过。

---

## Pass 1 — 数据安全与正确性

### [PASS] SQL 注入

- `database.py:160` `_set_user_version` 使用 `f"PRAGMA user_version = {version}"`，version 来自 `FTS_VERSION = 2` 常量（database.py:151），非用户输入。无注入风险。
- `database.py:381` / `entry_service.py:475` FTS 查询转义 `tokenized.replace('"', '""').replace("'", "''")` —— 继承原有转义模式，tokenize 在转义前执行，安全。
- 所有 INSERT/DELETE 语句使用参数化绑定（`:id`, `:summary`, `:tag` 等），无字符串拼接。

### [PASS] 竞态条件

- `entry_service.py:105-117` `_update_fts_content` 的 DELETE-then-INSERT 模式：该函数在 `create_entry`（L310）和 `update_entry`（L699）的 `session.commit()` 之后调用，使用独立 `Session(self.engine)`。SQLite WAL 模式下写操作串行化，不存在 TOCTOU。entry_id 为唯一主键，DELETE+INSERT 幂等。
- `database.py:526` `backfill_fts_content` 的 DELETE ALL + 重建：启动时同步执行，无并发请求。安全。
- `rebuild_fts_index`（database.py:405-437）使用 `conn`（裸连接）执行 DELETE + INSERT，`Session(engine)` 读取 entries。同一 engine 两个连接：`conn` 写 FTS 表，`session` 读 entries 表。SQLite 连接级别写锁串行化，不会读到不一致状态。

### [PASS] trigger 消费方一致性

- `database.py:137-148` migration DROP `entries_ai` + DROP `entries_au` + CREATE DELETE-only `entries_au`。幂等（IF EXISTS / IF NOT EXISTS）。
- `database.py:302-318` `setup_fts5` 中创建 DELETE + DELETE-only UPDATE trigger，不创建 INSERT trigger。与 migration 一致。
- 应用层独占 FTS 写入：`_update_fts_content`（entry_service.py:68）、`backfill_fts_content`（database.py:501）、`rebuild_fts_index`（database.py:397）三路径全部经 `tokenize_for_fts()` 分词。覆盖完整。

### [PASS] FTS 写入路径覆盖

| 路径 | 位置 | 确认 |
|------|------|------|
| INSERT trigger | database.py:137 DROP | 移除 ✓ |
| UPDATE trigger | database.py:141-146 CREATE DELETE-only | 仅 DELETE ✓ |
| DELETE trigger | database.py:302-308 | 不变 ✓ |
| _update_fts_content | entry_service.py:73,113-115 | tokenize_for_fts ✓ |
| backfill_fts_content | database.py:508,539-540 | tokenize_for_fts ✓ |
| rebuild_fts_index | database.py:403,430-432 | tokenize_for_fts ✓ |

### [PASS] 查询端覆盖

- `search_entries`（database.py:375-377）：`tokenize_query(query)` 分词 + 空结果返回 `[]`。
- `list_entries` FTS（entry_service.py:471-473）：`tokenize_query(q)` 分词。
- `list_entries` tag 过滤（entry_service.py:462-467）：`json_each(entries.tags)` 精确匹配，修复 `\uXXXX` 转义问题。

### [PASS] jieba 预加载时序

- `main.py:212-214`：`preload_jieba()` 在 `init_db`（L200）之后、`backfill_fts_content`（L218）之前。时序正确——backfill 分词时 jieba dict 已加载。

### [PASS] 版本标记

- `FTS_VERSION = 2`（database.py:151）、`_get_user_version`（L154-156）、`_set_user_version`（L159-160）。
- `backfill_fts_content` L522：`if current_version >= FTS_VERSION and content_count >= entry_count` → skip。首次升级时 version=0 < 2 → 触发重建。后续启动 version=2 → skip。正确。

---

## Pass 2 — 代码健康

### [INFORMATIONAL] rebuild_fts_index conn/session 混用

`database.py:405-436`：`with engine.connect() as conn` 和 `with Session(engine) as session` 是两个独立连接。`conn.execute(DELETE/INSERT)` 写 FTS 表，`session.exec(select(Entry))` 读 entries 表。功能正确（entries 读取在 Session 内完成），但混用 conn 和 session 在同一事务域内不够清晰。不影响正确性——SQLite WAL 下 `conn` 的 DELETE 和 INSERT 在 `conn.commit()`（L436）时原子提交，`session` 仅读取 entries 表不参与写。**非阻断**，建议未来统一为单连接或单 session。

### [INFORMATIONAL] FTS 查询异常静默吞掉

`entry_service.py:493`：`except Exception: pass`。这是原有模式（P2 未要求修改），复杂 FTS5 语法错误被吞掉返回空结果。P2 设计文档 L324 已说明此行为可接受。**非阻断**，与设计一致。

### [PASS] N+1 查询

- `_update_fts_content` 单 entry 单次读取文件列表——非 N+1。
- `backfill_fts_content` 逐行处理 entries——O(n)，n=entry 数量。对 <1000 entries 可接受（P2 风险评估 L40）。
- `list_entries` L503-507：批量查询 owner usernames——已优化。

### [PASS] 资源泄漏

- 所有 `Session` / `engine.connect()` 均使用 `with` 上下文管理器，自动释放。
- `_jieba_loaded` 全局标志——单进程内幂等，无资源泄漏。

### [PASS] jieba 线程安全

- `text_utils.py:39` `jieba.cut(text)` 精确模式（默认），P2 minimal_validation assumption_1 确认 10 线程并发结果一致。FastAPI 多线程环境下无需加锁。
- `preload_jieba()` 非线程安全（`_jieba_loaded` 全局标志无锁），但在 `create_app` 同步启动阶段调用，无并发。安全。

### [PASS] 代码风格

- ruff lint 通过（P4-implementation.md L120-122）。
- `String` import 已移除（entry_service.py 无残留引用）。
- 函数命名语义清晰：`tokenize_for_fts`（写入）vs `tokenize_query`（查询）。

---

## 设计一致性

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| text_utils.py 三函数 | text_utils.py:18,31,48 | ✓ |
| trigger 降级为仅 DELETE | database.py:137-148,311-318 | ✓ |
| backfill 版本标记 | database.py:151-160,501-545 | ✓ |
| rebuild_fts_index 逐行分词 | database.py:397-437 | ✓ |
| search_entries 查询分词 | database.py:364-394 | ✓ |
| _update_fts_content 分词 | entry_service.py:68-119 | ✓ |
| list_entries tag→json_each | entry_service.py:460-467 | ✓ |
| list_entries FTS 查询分词 | entry_service.py:470-494 | ✓ |
| lifespan 预加载 jieba | main.py:212-214 | ✓ |
| pyproject.toml jieba 依赖 | pyproject.toml:42 | ✓ |

## [DESIGN_GAP_REVIEWED]

1. **trigger 依赖测试更新**（P4-implementation.md:71-79）：P2 未显式列出需更新的测试。实现按 P2 方案 A 的 trigger 降级决策更新了 `test_database.py` / `test_fts_content.py` 中依赖 INSERT trigger 的测试。FTS 填充方式变更（从 trigger 自动填充→应用层手动填充），断言语义未变。**合理**。
2. **BDD-14 DetachedInstanceError 修复**（P4-implementation.md:81-83）：P3 测试代码存在 SQLAlchemy session 生命周期 bug。修复方式为 session 内捕获 `entry_id`，不影响断言语义。**合理**。

---

## 边界处理

| 边界 | 处理 | 位置 |
|------|------|------|
| text=None | 返回空字符串 | text_utils.py:37-38 |
| text="" | 返回空字符串 | text_utils.py:37-38 |
| query=None | 返回空字符串 | text_utils.py:54 |
| query="  " (空白) | 返回空字符串 | text_utils.py:54 |
| tokenize_query 返回空 | search_entries 返回 [] | database.py:378-379 |
| tokenize_query 返回空 | list_entries 跳过 FTS | entry_service.py:474 |
| entry.tags=None | `" ".join(entry.tags or [])` | entry_service.py:114 |
| FTS 查询异常 | except Exception: pass（原有模式） | entry_service.py:493 |
| entry_count=0 | backfill 直接 return | database.py:514-515 |
| FTS 表不存在 | rebuild 跳过 | database.py:409-411 |

---

## 安全性

- 无新增外部输入直接写库路径。`tokenize_for_fts` / `tokenize_query` 输入为已验证的 summary/tags/content（来自 Entry 模型，非原始用户输入）或 FTS 查询字符串（经转义后送参数化查询）。
- `PRAGMA user_version` 设置使用常量 `FTS_VERSION = 2`，非用户输入。
- 无新增 secrets/keys 暴露。
- jieba 库为纯 Python 分词库，无网络调用，无数据外泄。

---

## [PROD_NOT_TOUCHED]

评审仅读取代码文件，未触碰生产环境。

---

## 总结

实现与 P2 方案 A 设计完全一致，覆盖所有 FTS 写入路径（3 处）和查询路径（3 处）。trigger 降级干净利落——DROP INSERT trigger + UPDATE trigger 改为 DELETE-only，应用层独占 FTS 写入。版本标记确保首次升级全量重建、后续启动跳过。16 个 BDD 红灯全转绿，1001 passed 零回归。无 CRITICAL 问题，2 个 INFORMATIONAL 非阻断观察。
