---
phase: P4
task_id: T075-structured-data-viewer
type: implementation
parent: P3-test-cases-backend.md
trace_id: T075-P4-20260801
status: draft
created: 2026-08-01
agent: implementer
---

# P4 实现记录 — 后端 language.py 修正

## implementation_dir

`backend/peekview/`

## 改动清单

| 文件 | 位置 | 改动 |
|------|------|------|
| `backend/peekview/language.py` | `EXTENSION_MAP` L69 | `.tsv: "csv"` → `.tsv: "tsv"` |
| `backend/peekview/language.py` | `PLAIN_TEXT_LANGS` L255-270 | 新增 `"tsv"`（14 项 → 15 项） |

## 实现说明

- 对应 P2-design §3.1 方案，最小实现，无范围外改动。
- `.tsv` 之前误映射为 `csv`，现修正为独立的 `tsv` 语言 ID，前端 TableView 可据此区分 CSV/TSV 解析器。
- `PLAIN_TEXT_LANGS` 新增 `"tsv"`：Shiki 无 TSV 语法高亮，TSV 走纯文本渲染（与 csv/log 同组），保证 `get_language_list()` 检测到的所有语言都有落点。

## 改动依据（P3 红灯 → 绿灯）

| 测试 | 之前 | 之后 |
|------|------|------|
| `test_bdd_02_tsv_returns_tsv`（.tsv → 'tsv'） | 红（返回 'csv'） | 绿 |
| `test_contains_tsv`（"tsv" in PLAIN_TEXT_LANGS） | 红 | 绿 |
| `test_plain_text_langs_count`（len == 15） | 红（14） | 绿 |

## 验证结果（自查，非 P5 gate）

- `cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no` → **63 passed**
- `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` → **1008 passed, 2 skipped**（无回归）
- `python3 -m ruff check peekview/language.py` → **All checks passed**
- 未修改任何测试文件（P3 测试原样保留）

## 备注

- 全量测试运行会使 `backend/zip-*.zip` 测试夹具字节变化（测试运行再生成 zip 产物，非本任务有意改动）。
- 后端改动面仅 `language.py`，符合 P0-brief env_constraints「后端改动面小：仅 language.py 的扩展名映射」。

## 环境状态

[PROD_NOT_TOUCHED] 本次开发仅读写 `backend/peekview/language.py` 与 pytest tmp_path 隔离环境，未接触生产服务/生产数据库/`~/.peekview/`。
