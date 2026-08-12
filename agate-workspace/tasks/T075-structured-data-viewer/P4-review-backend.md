---
phase: P4
task_id: T075-structured-data-viewer
type: review
parent: P4-implementation-backend.md
trace_id: T075-P4-review-20260801
status: approved
created: 2026-08-01
agent: review
---

# P4 评审 — backend language.py .tsv 映射修正

## 评审范围

- `backend/peekview/language.py`（EXTENSION_MAP L69 + PLAIN_TEXT_LANGS L255-270）
- `backend/tests/test_language.py`（BDD-01~06 + TestPlainTextLanguages）
- 上游：P2-design.md §3.1、P3-test-cases-backend.md、P4-implementation-backend.md

## 客观查证（全部实测，非采信自报）

| 项 | 方法 | 结果 |
|----|------|------|
| L69 `.tsv` 映射 | `git diff backend/peekview/language.py` | `".tsv": "csv"` → `".tsv": "tsv"` ✓ |
| PLAIN_TEXT_LANGS 加 tsv | git diff（L259 新增行） | ✓ 与 P2 §3.1 一致 |
| test_language.py 63 passed | `.venv/bin/python -m pytest tests/test_language.py -q --tb=no` | **63 passed in 0.65s** ✓ |
| 全量无回归 | `.venv/bin/python -m pytest tests/ -q --tb=no` | **1008 passed, 2 skipped** ✓ |
| ruff | `python3 -m ruff check peekview/language.py` | **All checks passed** ✓ |
| 测试文件未改 | `git status` | test_language.py 不在改动列表（P3 原样保留）✓ |
| 大写扩展名边界 | venv python 直接调用 | `data.TSV → 'tsv'`（Path.suffix.lower()）✓ |
| PLAIN_TEXT_LANGS 计数 | 逐项清点 | 15 项（text/log/csv/tsv/ignore/git_attributes/autohotkey/editorconfig/git_config/janet/odin/pip-requirements/sed/vba/vbscript）✓ |

## Pass 1（CRITICAL）— 数据安全与正确性

### 1.1 SQL 注入 / 竞态 / TOCTOU

无。改动为纯常量表映射，无查询、无读-改-写、无并发状态。

### 1.2 新枚举值消费方核对（新 language 值 `'tsv'`）

逐个核对 `detect_language` 的全部后端消费者：

- `entry_service.py:901,931` — 将 language 写入文件元数据，pass-through，无 csv 分支 ✓
- `api/files.py:309` — `detected != "html"` 判断，tsv 不受影响 ✓
- `services/file_service.py:150` — pass-through ✓

**MIME/Content-Type 回归核对**（最易漏的消费方）：

- `files.py:72-94 _language_to_content_type` 的 `_TYPE_MAP`：不含 `csv` 也**不含 `tsv`**。改动前 .tsv 文件 language='csv' → 不在 map → `text/plain; charset=utf-8`；改动后 language='tsv' → 同样不在 map → **同样的 text/plain 回退**。行为不变，无回归 ✓
- `files.py:47-56 _LANGUAGE_TO_MIME`：不含 csv/tsv，`.get('tsv') → None` → 落到 `mimetypes.guess_type` 回退。改动前后行为一致 ✓

**前端 Shiki 消费（跨边界验证，实现细节归 frontend-design-review）**：

- `frontend-v3/src/composables/useShiki.ts` LANG_IMPORT_MAP 含 `csv` 不含 `tsv`；`ensureLanguage('tsv')`（L127-128）→ 无 importer → 返回 `'text'` 纯文本。这与 P2 §3.1 设计意图（TSV 走纯文本，Shiki 无 tsv grammar）完全吻合，且是**有意的行为变更**（改动前 .tsv 误按 csv grammar 高亮）✓
- `useEntryDetailComputed.ts:21` 已新增 `isTsv` 检测（前端改动，归 frontend review）

### 1.3 结论

无 CRITICAL、无 BLOCKER。

## Pass 2（INFORMATIONAL）— 代码健康

### 2.1 [INFO] 存量 entry 的 language 不回填

已发布 entry 的 `File.language` 是发布时的快照。改动前创建的 .tsv entry 在 DB 中存的是 `'csv'`，本次改动不会回填——**新创建的 entry 才拿到 `'tsv'`**。

影响：存量 .tsv entry 仍走 CSV 渲染路径（前端 isCsv），tab 分隔内容会按逗号解析成单列。这是改动前的既有状态，本任务 P0/P1/P2 均未要求数据迁移，且触碰存量 DB 违反铁律（严禁直接操作生产数据库）。是否处理由用户决定，不阻塞本次改动。

### 2.2 [INFO] PLAIN_TEXT_LANGS 无运行时消费者

`grep` 全 backend：`PLAIN_TEXT_LANGS` 仅在 `language.py` 定义 + 测试引用，无 runtime 消费（前端靠 `ensureLanguage` 的 `'text'` 回退兜底）。它是文档化的不变量 + 测试断言目标。加 `tsv` 使该集合与「Shiki 无 grammar → 纯文本」事实保持一致，正确。

### 2.3 [INFO] test_language.py 的 no_grammar_langs 清单不含 tsv

`test_language.py:247-263 test_contains_all_no_grammar_langs` 的 `no_grammar_langs` 集合列了 11 个无 grammar 语言，未列 `tsv`。但 `tsv` 的成员性已被 `test_contains_tsv`（L243-245）单独断言，且集合完整性由 `test_plain_text_langs_count == 15` 兜底，覆盖充分，不构成缺口。

## 合规性核对

- [x] 改动面符合 P0-brief「后端改动面小：仅 language.py 的扩展名映射」+ P2 §3.1
- [x] P3 测试原样保留（实现不碰测试，符合 TDD 约定）
- [x] 实现记录 P4-implementation-backend.md 与实际 git diff 一致（2 处改动，无范围外变更）
- [x] [PROD_NOT_TOUCHED] — 本次评审仅读代码 + pytest tmp_path 隔离，未接触生产服务/生产数据库/`~/.peekview/`

## 判定

**status: approved**

后端改动最小、精确、与设计文档逐字一致；63 + 1008 测试实测全绿；ruff 实测通过；所有消费方（MIME 回退、html-only 判断、前端 Shiki 'text' 回退）核对无回归。2 条 INFO 备注不阻塞：存量 entry language 快照不回填（超出本任务范围，交由用户决策）、PLAIN_TEXT_LANGS 无运行时消费者（文档性质，现状正确）。
