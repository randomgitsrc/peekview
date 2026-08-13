---
phase: P4
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P4-implementation.md
trace_id: TPV0091-P4-review-backend-20260813
status: approved
created: 2026-08-13
agent: review
---

# P4 Review (backend) — 中文/日文文件名下载与图片预览 500 修复

角色：偏执 Staff Engineer（review.md）。域：backend。改动：`backend/peekview/api/files.py`。

## 结论摘要

**approved**，无 BLOCKER / CRITICAL / needs-revision 项。实现与 P2-design §2.1 逐行一致，P3 新用例与既有安全用例全绿，ASCII 分支字节级零回归。

## 逐项评审结论

### 1. 正确性 — 与 P2-design §2.1 一致 ✓

`_build_content_disposition`（files.py:74-80）：

| 设计规格（P2 §2.1） | 实现 | 判定 |
|------|------|------|
| `safe = _sanitize_filename(filename)`（先净化） | files.py:75 | ✓ |
| `safe.isascii()` → `attachment; filename="{safe}"` 字节级不变 | files.py:76-77 | ✓ |
| fallback = 非 ASCII → `_` | files.py:78 | ✓ |
| `quote(safe, safe="")` 全 percent-encode | files.py:79 | ✓ |
| `filename*=UTF-8''{encoded}` | files.py:80 | ✓ |

实测边界（`quote(safe, safe="")` 全编码后 latin-1 encode 全部通过，unquote 往返等于原名）：

- `中文图片.png` → `attachment; filename="____.png"; filename*=UTF-8''%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87.png`，unquote 往返 == `中文图片.png` ✓
- `概要図.png`（日文）→ 同上往返正确 ✓
- `café.png` → `attachment; filename="caf_.png"; filename*=UTF-8''caf%C3%A9.png`，与 P3 TC-B2 设计断言一致 ✓
- `report final.txt`（ASCII+空格）→ `attachment; filename="report final.txt"`，与旧格式字节级相同 ✓

`quote` 默认 `encoding="utf-8"`、`safe=""` 使 `/` `\` `'` `%` 全部编码，值只剩 `%XX` + unreserved，全在 RFC 5987 attr-char/value-chars 安全集内（P2 §2.1 决策表「编码范围」行）。latin-1 可编码性已逐例实测。

### 2. 回归风险 — 零回归 ✓

- **ASCII 分支字节级不变**：files.py:76-77 与旧 `f'attachment; filename="{safe_name}"'`（git diff 前实现）逐字节相同。测试 `test_bdd_6_ascii_filename_header_format_unchanged`（test_api.py:285）断言 `== 'attachment; filename="report final.txt"'` 精确匹配，通过。
- **`_sanitize_filename` 未改**：files.py:63-71 无 diff（git diff 确认仅新增 helper + 改 header 调用行）。ZIP 复用点 entries.py:468 `_sanitize_filename(f"{entry.slug}.zip")` 不受影响；`test_zip_download_filename_injection_blocked`（test_security.py:616-644）实测通过。
- **`get_file_content` /content 端点未动**：files.py:220-262 无 diff，BDD-8 markdown 内联与 `_determine_content_type` 保持。
- **read tracking 未动**：download_file 内 `_record_read_async(action="download")`（files.py:200-211）仅删 `safe_name` 行，其余无 diff。
- 全量验证：`TestFileDownload` 5 passed（含 TC-B1 parametrize 2 条 + TC-B2 + TC-B3 + 既有 `test_download_file`）+ `TestFileContentEndpoint` 1 passed；`test_security.py` 11 passed 1 skip（skip 为既有，非本次引入）。

### 3. 代码质量 ✓

- helper 紧邻 `_sanitize_filename`（files.py:74），位置符合 P2-design §4 files_to_read 指引「新 helper 放其旁」。
- 命名 `_build_content_disposition` 表意明确，模块私有下划线约定一致。
- 删除了 `safe_name = _sanitize_filename(...)`（原 :194 区）→ 无 ruff F841；全文件 grep `safe_name` 无残留。
- `from urllib.parse import quote`（files.py:9）位于 stdlib import 分组，无未使用 import（grep 确认 quote 有使用点）。ruff `All checks passed`。
- 无多余改动：git diff 仅 2 个文件（files.py + client.ts 前端域），与 P4-implementation.md 声明一致。

### 4. 安全 ✓

- **注入字符**：`"` `;` `\r` `\n` 在 `_sanitize_filename`（files.py:68）先移除，再进入 fallback 与 `filename*`。净化→编码顺序与 P2-design 决策一致。
- 实测 `file"; injection="true` → `attachment; filename="file injection=true"`（无引号/分号残留）；`文件"; inject="1` → `filename*=...%20inject%3D1`（`=` 也被编码，值内无注入符）。
- `filename*` 值只含 `%XX`+unreserved，header 注入无入口。BDD-7 断言范围（200 + 无 `\r\n`）`test_filename_header_injection_blocked`（test_security.py:577-613）通过。
- 注入检测只跑非 ASCII 名场景时注意：`safe.isascii()` 分支同样先经 `_sanitize_filename`，注入字符已在 68 行移除，ASCII/非 ASCII 两分支净化强度一致。

### 5. 测试对应 — P3 用例全满足 ✓

| P3 用例 | 断言 | 结果 |
|---------|------|------|
| TC-B1 `test_bdd_4_5_unicode_filename_download`（parametrize 中文/日文，test_api.py:232-250） | 200 + `_FILENAME_STAR_RE` 匹配 + unquote==原名 + 响应体==/content | ✓ 2 passed |
| TC-B2 `test_bdd_6_latin1_filename_download_header_valid`（test_api.py:253-264） | 200 + filename* + unquote==café.png | ✓ |
| TC-B3 `test_bdd_6_ascii_filename_header_format_unchanged`（test_api.py:267-285） | 200 + header 字节级 == `attachment; filename="report final.txt"` | ✓ |
| TC-B4 BDD-7 复用 test_security.py（:577-613） | 200 + 无 `\r\n`（未新增断言，符合 P1-review O1） | ✓ |
| TC-F1/F2/F3/F5/F8（e2e） | 走 P5_e2e/P6，不在 backend 域评审范围 | 待 P6 |

P3「P4 后预期」清单 3 项（files.py 含 helper / download_file 使用 helper / test_security 保持绿）全部达成。

## CRITICAL / BLOCKER 清单

无 BLOCKER、无 CRITICAL。

## INFORMATIONAL（非阻断，供 P5/P6 参考）

1. **debug :8888 当前跑的是修复前代码**：live 实测 `unicode-filenames/files/41`、`/43` 仍返回 500（旧代码进程未重启）。P5/P6 前需 `make debug-quick`（重建 static + 重启进程）使新代码生效——非代码缺陷，属部署时序。
2. P4-implementation.md「下游提示」提醒：P2 gate_commands.P5_e2e 的 spec 名 `t091-` 前缀需同步更新为 `tpv0091-`（P3-test-cases.md 已强制改），主 Agent P5 执行时留意。

## 结论

- 正确性、回归、质量、安全、测试对应五维全过。
- 与 P2-design §2.1 逐行一致；ASCII 分支字节级零回归；注入净化顺序正确；P3 新增用例与既有安全用例实测全绿。
- 无 BLOCKER/CRITICAL → **approved**。

File: `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P4-review-backend.md`
Status: **approved**
