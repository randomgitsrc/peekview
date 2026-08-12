---
phase: P3
task_id: T083-cjk-search-fix
type: test-cases
parent: P2-design.md
trace_id: T083-P3-20260731
status: draft
created: 2026-07-31
agent: test-designer
---

# P3 测试用例清单 — T083: 中文搜索与 Tag 过滤修复

## test_code_dir

```yaml
test_code_dir: backend/tests/
test_file: backend/tests/test_cjk_search.py
```

## 测试运行命令

```bash
cd backend && .venv/bin/python -m pytest tests/test_cjk_search.py -v --tb=short
```

## BDD → 测试用例映射

### Tag 过滤（Bug 1）

| BDD | 测试函数 | 描述 | 红灯类型 |
|-----|----------|------|----------|
| BDD-1 | `test_bdd_1_chinese_tag_filter` | 中文 tag 通过 json_each 精确匹配 | assertion 失败（当前 LIKE 匹配不到 \uXXXX） |
| BDD-2 | `test_bdd_2_japanese_tag_filter` | 日文 tag 过滤 | assertion 失败（同 BDD-1 根因） |
| BDD-3 | `test_bdd_3_english_tag_filter_regression` | 英文 tag 过滤零回归 | import 失败（text_utils 未创建） |
| BDD-4 | `test_bdd_4_tag_exact_match_no_substring` | 精确匹配，python 不匹配 pythonic | import 失败（text_utils 未创建） |
| BDD-5 | `test_bdd_5_multi_tag_filter` | 多 tag 过滤（AND 语义） | assertion 失败（json_each 未实现） |
| BDD-6 | `test_bdd_6_nonexistent_tag_empty` | 不存在的 tag 返回空 | import 失败（text_utils 未创建） |

### FTS5 中文搜索（Bug 2）

| BDD | 测试函数 | 描述 | 红灯类型 |
|-----|----------|------|----------|
| BDD-7 | `test_bdd_7_chinese_subword_search` | 搜"组件"命中含"组件库"的 entry | import 失败（text_utils 未创建） |
| BDD-8 | `test_bdd_8_chinese_whole_word_search` | 搜"组件库"命中 | import 失败（text_utils 未创建） |
| BDD-9 | `test_bdd_9_english_search_regression` | 英文搜索零回归 | import 失败（text_utils 未创建） |
| BDD-10 | `test_bdd_10_mixed_cjk_ascii_search` | 中英混合 tags 搜 Vue 命中 | import 失败（text_utils 未创建） |
| BDD-11 | `test_bdd_11_no_match_chinese_search` | 无匹配返回空 | import 失败（text_utils 未创建） |

### 连字符复合 tag 搜索（Bug 3）

| BDD | 测试函数 | 描述 | 红灯类型 |
|-----|----------|------|----------|
| BDD-12 | `test_bdd_12_hyphen_tag_subword_search` | google-gemini tag 搜 gemini 命中 | import 失败（text_utils 未创建） |
| BDD-13 | `test_bdd_13_hyphen_tag_whole_word_search` | google-gemini tag 搜 google 命中 | import 失败（text_utils 未创建） |

### 存量数据与启动

| BDD | 测试函数 | 描述 | 红灯类型 |
|-----|----------|------|----------|
| BDD-14 | `test_bdd_14_backfill_rebuilds_fts_for_existing` | backfill 后中文子词搜索命中存量 entry | import 失败（text_utils 未创建） |
| BDD-15 | `test_bdd_15_new_entry_fts_tokenized` | 新建 entry 后立即搜索中文子词命中 | import 失败（text_utils 未创建） |

### 回归与安全性

| BDD | 测试函数 | 描述 | 红灯类型 |
|-----|----------|------|----------|
| BDD-16 | (不在此文件) | 由 P5 gate `make test-quick` 验证现有测试全绿 | N/A |
| BDD-17 | `test_bdd_17_jieba_preload_no_first_request_delay` | preload_jieba 后首次 tokenize_for_fts < 1s | import 失败（text_utils 未创建） |

## 测试 fixture 策略

- **entry_service fixture**：与 test_entry_service.py 相同，使用 `init_db` + `EntryService`（含 FTS5 triggers）
- **init_db 直接调用**：BDD-14 需要 init_db 创建数据库，手动插入未分词 FTS 数据，然后调用 `backfill_fts_content`
- **不使用 conftest engine fixture**：该 fixture 用 `SQLModel.metadata.create_all` 不创建 FTS5 表

## 红灯机制说明

- BDD-1~6：`list_entries(tags=...)` 调用走 json_each 路径（实现后）。BDD-1/2/5 当前代码走 LIKE，tag 含中文时匹配 `\uXXXX` 失败 → assertion 失败（B类红灯）。BDD-3/4/6 import `text_utils` → ModuleNotFoundError（B类红灯：项目内 import 失败）
- BDD-7~17：测试 import `from peekview.text_utils import tokenize_for_fts, tokenize_query, preload_jieba` → `ModuleNotFoundError`（B类红灯：项目内 import 失败）

## 实际执行结果

```
16 tests collected, 16 FAILED, 0 PASSED
BDD-1/2/5: AssertionError (LIKE fails for CJK tags)
BDD-3/4/6~15/17: ModuleNotFoundError: No module named 'peekview.text_utils'
```

所有 16 个测试均为 B 类红灯（assertion 失败或项目内 import 失败），无语法错误，无第三方 import 失败。

## [PROD_NOT_TOUCHED]

本阶段为测试设计，仅读取代码文件和编写测试代码，未触碰生产环境。
