---
phase: P4
task_id: T083-cjk-search-fix
type: implementation
parent: P2-design.md
trace_id: T083-P4-20260731
status: draft
created: 2026-07-31
agent: implementer
---

# P4 Implementation — T083: 中文搜索与 Tag 过滤修复

## implementation_dir

```
backend/peekview/text_utils.py          (新增)
backend/peekview/database.py            (修改)
backend/peekview/services/entry_service.py (修改)
backend/peekview/main.py                (修改)
backend/pyproject.toml                  (修改)
backend/tests/test_database.py          (修改)
backend/tests/test_fts_content.py       (修改)
backend/tests/test_cjk_search.py        (修改)
```

## 改动摘要

### 1. 新增 `backend/peekview/text_utils.py`

jieba 分词模块，提供三个函数：

- `preload_jieba()`: 幂等预加载 jieba dict，避免首请求 0.4s 延迟
- `tokenize_for_fts(text)`: 写入 FTS 索引文本时使用——jieba 分词 + 连字符→空格 + 过滤空 token，返回空格分隔字符串
- `tokenize_query(query)`: 查询端分词，逻辑同 `tokenize_for_fts`，语义分离

### 2. `backend/peekview/database.py`

#### trigger 降级（方案 A 核心）

- `_run_migrations`: 末尾追加 trigger 迁移——DROP `entries_ai`（INSERT trigger，不再需要）、DROP `entries_au`（旧 UPDATE trigger）、CREATE `entries_au`（DELETE-only UPDATE trigger）。幂等执行。
- `setup_fts5`: 移除 INSERT trigger 创建；UPDATE trigger 改为仅 DELETE（不再 INSERT `NEW.tags`/`NEW.summary`）。DELETE trigger 不变。
- 新增 `FTS_VERSION = 2`、`_get_user_version()`、`_set_user_version()`

#### 查询端分词

- `search_entries`: `query` 先经 `tokenize_query()` 分词，空结果返回 `[]`，非空则转义引号后送 FTS5 MATCH

#### 写入端分词

- `backfill_fts_content`: 版本标记触发重建（`PRAGMA user_version < FTS_VERSION` 时 DELETE ALL + 逐行重建）；summary/tags/content 全部经 `tokenize_for_fts()` 分词
- `rebuild_fts_index`: 两个分支（有 storage / 无 storage）统一为逐行 Python 处理 + `tokenize_for_fts()` 分词

### 3. `backend/peekview/services/entry_service.py`

- `_update_fts_content`: summary → `tokenize_for_fts(entry.summary)`；tags → `tokenize_for_fts(" ".join(entry.tags or []))`；content → `tokenize_for_fts(aggregated)`
- `list_entries` tag 过滤: `Entry.tags.cast(String).like(...)` → `EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)`（精确匹配，修复非 ASCII tag 过滤）
- `list_entries` FTS 查询: `q.strip()` → `tokenize_query(q)` + 转义
- 移除未使用的 `String` import

### 4. `backend/peekview/main.py`

lifespan 中 `init_db` 后、`backfill_fts_content` 前插入 `preload_jieba()`

### 5. `backend/pyproject.toml`

添加 `"jieba>=0.42.1"` 到 dependencies

### 6. 测试更新

#### [DESIGN_GAP] P2 未显式提及需更新 trigger 依赖的测试

P2 设计移除 INSERT trigger，但未显式列出 `test_database.py` 中依赖 trigger 的测试需同步更新。以下测试因 trigger 移除而必须更新（非断言逻辑变更，而是 FTS 填充方式变更）：

- `test_database.py::test_triggers_created`: 移除 `entries_ai` 断言，改为 `assert "entries_ai" not in triggers`
- `test_database.py::test_fts_insert_trigger` → `test_fts_app_layer_write`: 改为测试应用层填充 FTS
- `test_database.py::test_fts_delete_trigger`: 手动填充 FTS（无 INSERT trigger）
- `test_database.py::search tests`: 手动用 `tokenize_for_fts` 填充 FTS
- `test_fts_content.py::test_fts_insert_trigger_content_empty` → `test_fts_app_layer_writes_empty_content`: 断言直接 INSERT 后 FTS 为空（无 trigger 自动填充）

#### BDD-14 测试修复

`test_cjk_search.py::test_bdd_14_backfill_rebuilds_fts_for_existing` 存在 `DetachedInstanceError`：`entry.id` 在 session 关闭后被访问。修复方式：在 session 内捕获 `entry_id`，断言使用 `entry_id` 而非 `entry.id`。这是 SQLAlchemy session 生命周期 bug，与 FTS/jieba 实现无关。

## 自查结果

### CJK 搜索测试（16 个红灯）

```
tests/test_cjk_search.py::TestBDD1ChineseTagFilter::test_bdd_1_chinese_tag_filter PASSED
tests/test_cjk_search.py::TestBDD2JapaneseTagFilter::test_bdd_2_japanese_tag_filter PASSED
tests/test_cjk_search.py::TestBDD3EnglishTagRegression::test_bdd_3_english_tag_filter_regression PASSED
tests/test_cjk_search.py::TestBDD4TagExactMatch::test_bdd_4_tag_exact_match_no_substring PASSED
tests/test_cjk_search.py::TestBDD5MultiTagFilter::test_bdd_5_multi_tag_filter PASSED
tests/test_cjk_search.py::TestBDD6NonexistentTag::test_bdd_6_nonexistent_tag_empty PASSED
tests/test_cjk_search.py::TestBDD7ChineseSubwordSearch::test_bdd_7_chinese_subword_search PASSED
tests/test_cjk_search.py::TestBDD8ChineseWholeWordSearch::test_bdd_8_chinese_whole_word_search PASSED
tests/test_cjk_search.py::TestBDD9EnglishSearchRegression::test_bdd_9_english_search_regression PASSED
tests/test_cjk_search.py::TestBDD10MixedSearch::test_bdd_10_mixed_cjk_ascii_search PASSED
tests/test_cjk_search.py::TestBDD11NoMatchChineseSearch::test_bdd_11_no_match_chinese_search PASSED
tests/test_cjk_search.py::TestBDD12HyphenTagSubwordSearch::test_bdd_12_hyphen_tag_subword_search PASSED
tests/test_cjk_search.py::TestBDD13HyphenTagWholeWordSearch::test_bdd_13_hyphen_tag_whole_word_search PASSED
tests/test_cjk_search.py::TestBDD14BackfillRebuildsFTS::test_bdd_14_backfill_rebuilds_fts_for_existing PASSED
tests/test_cjk_search.py::TestBDD15NewEntryFTSTokenized::test_bdd_15_new_entry_fts_tokenized PASSED
tests/test_cjk_search.py::TestBDD17JiebaPreload::test_bdd_17_jieba_preload_no_first_request_delay PASSED
16 passed
```

### 全量测试套件

```
1001 passed, 2 skipped, 10 warnings in 170.42s
```

原始基准：985 passed + 2 skipped → 1001 passed + 2 skipped（+16 新增 CJK 测试，零回归）

### Lint

```
ruff check: All checks passed!
```

## [PROD_NOT_TOUCHED]

所有改动在 venv/测试环境内完成，未触碰生产环境（`~/.peekview/` 或 `:8080`）。

## [DESIGN_GAP_REVIEWED] 待主 Agent 审查

1. **trigger 依赖测试更新**：P2 未显式提及 `test_database.py`/`test_fts_content.py` 中依赖 INSERT trigger 的测试需更新。实现中已按 P2 方案 A 的 trigger 降级决策更新这些测试（FTS 填充方式变更，非断言语义变更）。

2. **BDD-14 DetachedInstanceError 修复**：P3 测试代码存在 SQLAlchemy session 生命周期 bug（`entry.id` 在 session 关闭后被访问）。修复方式为在 session 内捕获 `entry_id`，不影响测试断言语义。
