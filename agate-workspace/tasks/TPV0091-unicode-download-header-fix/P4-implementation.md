---
phase: P4
task_id: TPV0091-unicode-download-header-fix
type: implementation
parent: P2-design.md
trace_id: TPV0091-P4-20260813
status: draft
created: 2026-08-13
agent: implementer
---

# P4 实现 — 中文/日文文件名下载与图片预览 500 修复

## implementation_dir

```yaml
implementation_dir: 代码改动直接落在仓库原文件（无独立实现子目录）：
  - backend/peekview/api/files.py
  - frontend-v3/src/api/client.ts
```

## 改动清单

### 1. `backend/peekview/api/files.py`（候选 C 后端部分，P2-design §2.1）

- **新增 import**：`from urllib.parse import quote`（文件顶部，与 stdlib import 分组一致）
- **新增 helper** `_build_content_disposition(filename)`（紧邻 `_sanitize_filename` 之后）：
  - `safe = _sanitize_filename(filename)`（先净化，注入字符 `"` `;` `\r` `\n` 被移除）
  - `safe.isascii()` → `attachment; filename="{safe}"`（与现有格式**字节级一致**，ASCII 零回归）
  - 非 ASCII → `attachment; filename="{ascii_fallback}"; filename*=UTF-8''{quote(safe, safe="")}`，fallback 为非 ASCII 字符替换为 `_`
- **`download_file`**：删除 `safe_name = _sanitize_filename(...)` 局部变量（防 ruff F841，P2-review 观察①），header 构建改为 `_build_content_disposition(file_record.filename)`
- **未改动**：`_sanitize_filename` 行为、`get_file_content`（/content 端点）、read tracking 逻辑

### 2. `frontend-v3/src/api/client.ts`（候选 C 前端部分，P2-design §2.2）

- **`getFileAsBase64`**（:160-171）：GET URL 由 `/entries/{slug}/files/{fileId}` 改为 `/entries/{slug}/files/{fileId}/content`（预览语义修正：读而非下载；read tracking action download→read，P1 SUGGEST 预声明可接受）
- **未改动**：`getFileContent`、`downloadFile`（死代码保留，YAGNI）、`ImageViewer.vue`

## 自测结果（自查，非 P5 gate）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| P3 新用例 | `cd backend && .venv/bin/python -m pytest tests/test_api.py::TestFileDownload -q --tb=short` | **5 passed**（含 TC-B1 中文/日文 parametrize 2 条 + TC-B2 café + TC-B3 ASCII 守卫 + 既有 download） |
| 净化回归 | `cd backend && .venv/bin/python -m pytest tests/test_security.py -q --tb=short` | **全绿**（1 skip 为既有，非本次改动引入） |
| lint | `python3 -m ruff check peekview/ tests/` | **All checks passed**（`make lint` 中 ruff 不在 PATH 报 127，按 AGENTS.md 用系统 python3 -m ruff，结果同） |
| typecheck | `make typecheck` | **✓ type check passed** |

## SCOPE+/DESIGN_GAP 发现

无 SCOPE+、无 DESIGN_GAP。实现严格按 P2-design §2 锁定规格执行。

## 下游提示

- P5_e2e gate 命令需注意：P3-test-cases.md 指出 P2 gate_commands 中 e2e spec 名仍为旧前缀 `t091-`，P3 已强制改 `tpv0091-` 前缀（P2-review 观察③），主 Agent 在 P5 执行 `P5_e2e` 时应同步更新。
