---
phase: P5
task_id: T083-cjk-search-fix
type: test-results
parent: P4-implementation.md
trace_id: T083-P5-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P5 技术验证 — T083: 中文搜索与 Tag 过滤修复

## 执行命令

```
make test-quick
```

等价于：`cd backend && .venv/bin/python -m pytest tests/ -v --tb=short`

## 测试结果

```
1001 passed, 2 skipped, 10 warnings in 171.79s (0:02:51)
```

- **passed**: 1001
- **skipped**: 2
- **failed**: 0
- **exit code**: 0

## 环境基线对比

| 指标 | P3 基线 | P5 结果 | 差异 |
|------|---------|---------|------|
| passed | 985 | 1001 | +16（新增 CJK 搜索测试） |
| skipped | 2 | 2 | 0 |
| failed | 0 | 0 | 0 |

零回归。新增 16 个 CJK 搜索/过滤测试全部通过。

## 新增测试清单（16 个）

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
```

## 预存失败

无预存失败。

## Warnings（10 个，均为预存，与本次改动无关）

1. `PytestUnknownMarkWarning: Unknown pytest.mark.integration`（test_cli_remote.py，预存）
2. `DeprecationWarning: tarfile filter`（test_admin_backup.py，预存）
3. `DeprecationWarning: httpx per-request cookies`（test_auth.py ×2，预存）
4. `DeprecationWarning: datetime.utcnow()`（test_entry_lifecycle.py ×2，预存）

## 环境隔离

[PROD_NOT_TOUCHED]

- `make test-quick` 使用 `backend/.venv` Python，conftest.py autouse 隔离（`PEEKVIEW_STORAGE__DATA_DIR`/`DB_PATH` → tmp_path）
- 未触碰 `~/.peekview/` 或 `:8080`
- 未运行 E2E（P2 声明 `ui_affected: false`，`P5_e2e: null`）

## 全量测试

已运行全量测试套件（`make test-quick` 跑全部 `backend/tests/` 下所有测试文件），非仅 T083 相关测试。

## 结论

- exit 0 + failed=0 → **P5 gate 通过**
- 1001 passed + 2 skipped，零回归
- 16 新增 CJK 搜索/过滤测试全绿
