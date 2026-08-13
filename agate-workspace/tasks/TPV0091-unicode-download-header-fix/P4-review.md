---
phase: P4
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P4-review-backend.md
trace_id: TPV0091-P4-review-summary-20260813
status: approved
created: 2026-08-13
agent: review-lead
---

# P4 专家组评审汇总 — 中文/日文文件名下载与图片预览 500 修复

角色：专家组组长（review.md）。只汇总，不发表新意见。两个专家评审均已完成并 approved，本文件为统一汇总。

## 专家结论摘要

### 1. backend 域 — `P4-review-backend.md`（agent: review）

**status: approved**，无 BLOCKER / CRITICAL / needs-revision。

- **正确性**：`_build_content_disposition`（files.py:74-80）与 P2-design §2.1 逐行一致（先 `_sanitize_filename` 净化 → `safe.isascii()` 走 ASCII 原格式 → 非 ASCII 走 fallback `_` + `quote(safe, safe="")` + `filename*=UTF-8''`）。实测中文/日文/café/ASCII+空格四类边界，latin-1 可编码、unquote 往返等于原名。
- **回归**：ASCII 分支字节级不变（files.py:76-77 与旧实现逐字节相同，TC-B3 精确断言通过）；`_sanitize_filename`、`get_file_content`、read tracking、ZIP 复用点均无 diff。
- **质量**：helper 紧邻 `_sanitize_filename`（files.py:74），删除 `safe_name` 局部变量无 ruff F841，`quote` import 无未使用，git diff 仅 files.py + client.ts 两文件。
- **安全**：注入字符 `"` `;` `\r` `\n` 在净化步骤先移除，`filename*` 值只含 `%XX`+unreserved，header 注入无入口；ASCII/非 ASCII 两分支净化强度一致。
- **测试**：TC-B1（parametrize 中文/日文）2 passed、TC-B2 café passed、TC-B3 ASCII 守卫 passed，test_security 11 passed 1 skip（skip 为既有）。
- **INFORMATIONAL（非阻断）**：debug :8888 当前跑的是修复前进程，P5/P6 前需 `make debug-quick` 重启；P2 gate_commands 的 `t091-` 前缀需同步为 `tpv0091-`。

### 2. frontend 域 — `P4-review-frontend.md`（agent: design-review）

**status: approved**，无 BLOCKER / CRITICAL。

- **正确性**：client.ts `getFileAsBase64`（:160-171）URL 变更 `/entries/{slug}/files/{fileId}` → `/entries/{slug}/files/{fileId}/content`（:162）与 P2-design §2.2 一字不差；后端路由锚点 files.py:220 `/content` 精确匹配。
- **交互状态**：ImageViewer.vue:120 data URI = `guessMimeType(props.filename)`（mime.ts:9-12 仅按扩展名查表，不读响应 content-type）+ 响应字节 base64，与端点来源无关；download 与 /content 共用 `service.read_file_content`（files.py:195/240），字节必然一致，data URI 零影响论断成立。
- **回归**：同路径不同 responseType（'text' vs 'arraybuffer'）各自独立请求配置无冲突；ImageViewer.spec.ts:10-14 `vi.mock('@/api/client')` 全对象替换，11 条单测零 URL 断言，P2-design §8「前端零测试改动」成立。
- **组件完整性**：ImageViewer 契约（props filename/slug/fileId + `getFileAsBase64(slug, fileId)` 签名）未变；`getFileAsBase64` 唯一调用点 ImageViewer.vue:119。
- **移动端 / a11y**：改动纯传输层（client.ts 一行），模板/DOM/CSS 零触碰；移动端 e2e tpv0091 spec:117-124 已覆盖。
- **非阻断备注**：P2 gate_commands `P5_e2e` spec 名 `t091-` 旧前缀漂移（实际文件为 `tpv0091-unicode-preview-download.spec.ts`），P3-test-cases.md 与 P4-implementation.md 均已标注，P5 执行时主 Agent 同步更新即可；BDD-5 下载事件依赖后端 RFC 5987 header，P6 实测。

## 锚点真实性复核（组长规则 5，只验存在，不重复评审）

| 引用锚点 | 复核结果 |
|---------|---------|
| files.py:9 `from urllib.parse import quote` | ✓ 存在 |
| files.py:63-71 `_sanitize_filename`（:68 注入字符 strip） | ✓ 存在 |
| files.py:74-80 `_build_content_disposition`（isascii/fallback/quote 三段） | ✓ 存在 |
| files.py:179-216 `download_file`（:195 read_file_content、:200-211 read tracking、:216 header 使用 helper） | ✓ 存在 |
| files.py:220 `/content` 路由 | ✓ 存在 |
| entry_service.py:1070 `read_file_content` | ✓ 存在 |
| test_api.py:233/253/267（TC-B1/B2/B3） | ✓ 存在 |
| test_security.py:577（header 注入）、:616（ZIP 注入） | ✓ 存在 |
| client.ts:152-158 getFileContent、:160-171 getFileAsBase64（:162 /content、:163 arraybuffer）、:173 downloadFile | ✓ 存在 |
| ImageViewer.vue:68-73 props、:108-127 loadImage、:109 guessMimeType、:119 调用、:120 data URI | ✓ 存在 |
| mime.ts:9-12 guessMimeType（仅扩展名查表） | ✓ 存在 |
| ImageViewer.spec.ts:10-14 `vi.mock('@/api/client')` 全对象替换 | ✓ 存在 |
| e2e/tpv0091-unicode-preview-download.spec.ts:91（download URL）、:117-124（移动端 390×844） | ✓ 存在 |

## BLOCKER 汇总

**无 BLOCKER**（两个专家均显式声明无 BLOCKER / CRITICAL）。

## 专家组分歧

无分歧。两个专家均 approved；各自列出的非阻断备注（:8888 进程需重启、gate_commands spec 名前缀漂移）相互印证，方向一致，不构成分歧。

## 最终结论

- backend（review）：approved
- frontend（design-review）：approved
- 全票无 BLOCKER、无分歧 → **status: approved**

非阻断事项移交主 Agent：P5 执行 `P5_e2e` 时同步更新 gate 命令 spec 名为 `tpv0091-unicode-preview-download.spec.ts`；P5/P6 前 `make debug-quick` 使新代码生效。

File: `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P4-review.md`
Status: **approved**
