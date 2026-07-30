---
phase: P6
task_id: T083-cjk-search-fix
type: acceptance
parent: P1-requirements.md
trace_id: T083-P6-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P6 验收报告 — T083: 中文搜索与 Tag 过滤修复

## 验证方式

- BDD-1~15, BDD-17：通过 pytest 运行 `backend/tests/test_cjk_search.py`（16 个测试，逐条对照 P1 BDD 条件），输出存入 P6-evidence/test-output.log
- BDD-16：引用 P5-test-results/unit.md（`make test-quick` 全量测试 1001 passed + 2 skipped + 0 failed）

## 执行命令

```
cd backend && .venv/bin/python -m pytest tests/test_cjk_search.py -v --tb=short
```

## 执行结果

```
16 passed in 2.26s
EXIT_CODE: 0
```

## BDD 逐条验收

### Tag 过滤（Bug 1）

- PASS BDD-1: 中文 tag 过滤返回正确结果 — tags 为 `["前端", "Vue"]` 的 entry 通过 `tags=["前端"]` 过滤命中 (test-output.log)
- PASS BDD-2: 日文 tag 过滤返回正确结果 — tags 为 `["テスト"]` 的 entry 通过 `tags=["テスト"]` 过滤命中 (test-output.log)
- PASS BDD-3: 英文 tag 过滤零回归 — tags 为 `["python", "auth"]` 的 entry 通过 `tags=["python"]` 过滤命中 (test-output.log)
- PASS BDD-4: tag 精确匹配不误命中子串 — tags 为 `["python"]` 和 `["pythonic"]` 两个 entry，过滤 `tags=["python"]` 只返回前者 (test-output.log)
- PASS BDD-5: 多 tag 过滤返回同时包含所有 tag 的 entry — tags 为 `["前端", "Vue", "组件库"]` 的 entry 通过 `tags=["前端", "Vue"]` 过滤命中，仅含 `["前端"]` 的 entry 不命中 (test-output.log)
- PASS BDD-6: 不存在的 tag 过滤返回空结果 — `tags=["不存在"]` 过滤返回 0 条结果 (test-output.log)

### FTS5 中文搜索（Bug 2）

- PASS BDD-7: 中文子词搜索命中 — summary 含"前端组件库设计"、tags 含"组件库"的 entry，搜 `q=组件` 命中 (test-output.log)
- PASS BDD-8: 中文整词搜索命中 — summary 含"前端组件库"的 entry，搜 `q=组件库` 命中 (test-output.log)
- PASS BDD-9: 英文搜索零回归 — summary 为 "FastAPI tutorial" 的 entry，搜 `q=FastAPI` 命中 (test-output.log)
- PASS BDD-10: 中英文混合搜索命中 — tags 为 `["前端", "Vue", "组件库"]` 的 entry，搜 `q=Vue` 命中 (test-output.log)
- PASS BDD-11: 无匹配中文搜索返回空结果 — summary 为"前端组件库"的 entry，搜 `q=数据库` 返回 0 条 (test-output.log)

### 连字符复合 tag 搜索（Bug 3）

- PASS BDD-12: 连字符 tag 的子词搜索命中 — tags 为 `["google-gemini"]` 的 entry，搜 `q=gemini` 命中 (test-output.log)
- PASS BDD-13: 连字符 tag 整词搜索命中 — tags 为 `["google-gemini"]` 的 entry，搜 `q=google` 命中 (test-output.log)

### 存量数据与启动

- PASS BDD-14: 启动后存量数据 FTS 索引被重建 — 旧 FTS 索引（未分词）经 `backfill_fts_content` 重建后，搜 `q=组件` 能命中存量 entry (test-output.log)
- PASS BDD-15: 新建 entry 的 FTS 索引正确分词 — 创建 tags 为 `["组件库"]`、summary 为"前端组件"的新 entry 后，搜 `q=组件` 立即命中 (test-output.log)

### 回归与安全性

- PASS BDD-16: 现有测试全部通过 — `make test-quick` 全量测试 1001 passed + 2 skipped + 0 failed，零回归 (../P5-test-results/unit.md)
- PASS BDD-17: jieba 预加载不阻塞首请求 — `preload_jieba()` 后首次 `tokenize_for_fts("前端组件库设计")` 耗时 <1s（断言 elapsed < 1.0），且结果含"组件" (test-output.log)

## 待确认清单

[NO_NEED_CONFIRM]

所有 17 条 BDD 均有 pytest 实跑证据支撑，结果与 P1 验收条件完全一致，无偏差。

## 环境隔离

[PROD_NOT_TOUCHED]

- pytest 使用 `backend/.venv` Python，conftest.py autouse 隔离（`PEEKVIEW_STORAGE__DATA_DIR`/`DB_PATH` → tmp_path）
- 未触碰 `~/.peekview/` 或 `:8080`
- 无 UI 截图需求（P2 声明 `ui_affected: false`）

## 证据清单

| 文件 | 说明 |
|------|------|
| P6-evidence/test-output.log | pytest 运行 test_cjk_search.py 的完整输出（16 passed, EXIT_CODE: 0） |
| P5-test-results/unit.md | BDD-16 证据：make test-quick 全量测试结果 |
