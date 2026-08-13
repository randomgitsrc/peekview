---
phase: P3
task_id: TPV0091-unicode-download-header-fix
type: test-cases
parent: P2-design.md
trace_id: TPV0091-P3-20260813
status: draft
created: 2026-08-13
agent: test-designer
---

# P3 测试用例设计 — 中文/日文文件名下载与图片预览 500 修复

## 概述

- **方案**：候选 C（P2-design.md §2 已定，勿改）——后端 `_build_content_disposition` RFC 5987 + 前端 `getFileAsBase64` URL→`/content`
- **BDD 映射**：8/8 条 BDD 全覆盖（1:1）；BDD-7 复用现有测试不新增（P1-review O1 强制）
- **红灯口径**：P3 时实现未写 → 后端中文/日文用例（500）与 café filename* 用例（无 filename*）为**真红灯**（assertion 失败，B 类）；ASCII/回归守卫用例当前绿属预期（防过度修复回归线）

## test_code_dir

```yaml
test_code_dir:
  backend: backend/tests/test_api.py        # TestFileDownload 类追加 3 个新测试
  frontend: frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts   # 新建（tpv0091- 前缀，P2-review 观察③）
```

> 注意：P2-design.md §3 gate_commands.P5_e2e 仍写 `e2e/t091-unicode-preview-download.spec.ts`（旧命名）——本文件按 P2-review 观察③ + 派发上下文强制改用 `tpv0091-` 前缀，P5 时主 Agent 应同步更新 gate_commands。

## BDD → 测试用例映射（1:1）

| BDD | 内容 | 测试用例 | 层 | 位置 |
|-----|------|---------|-----|------|
| BDD-1 | 中文图片.png 预览正常 | `test_bdd_1_chinese_image_preview_renders`（desktop + mobile） | e2e | tpv0091 spec |
| BDD-2 | 概要図.png 预览正常 | `test_bdd_2_japanese_image_preview_renders`（desktop） | e2e | tpv0091 spec |
| BDD-3 | café/report final/arch 预览不回归 | `test_bdd_3_latin1_space_ascii_images_no_regression`（desktop） | e2e | tpv0091 spec |
| BDD-4 | 非 latin-1 下载 200 + 内容一致 | `test_bdd_4_5_unicode_filename_download`（parametrize 中文/日文） | pytest | test_api.py |
| BDD-5 | Content-Disposition RFC 5987 编码 | `test_bdd_4_5_unicode_filename_download`（unquote==原名，pytest）+ `test_bdd_5_unicode_download_suggested_filename`（浏览器级 suggestedFilename，e2e） | pytest + e2e | 两者 |
| BDD-6 | latin-1/ASCII/空格不回归 | `test_bdd_6_latin1_filename_download_header_valid`（café，新）+ `test_bdd_6_ascii_filename_header_format_unchanged`（显式守卫）+ 现有 `test_download_file`（保持绿） | pytest | test_api.py |
| BDD-7 | 注入净化不回归 | 现有 `test_security.py::TestFilenameSanitization` 保持绿（断言范围 = 200 + 无 \r\n，**不新增**） | pytest（复用） | test_security.py |
| BDD-8 | markdown 内联 5 图不回归 | `test_bdd_8_markdown_inline_images_render`（TPV0089 模式） | e2e | tpv0091 spec |

## 后端用例（pytest，test_api.py TestFileDownload 追加）

### TC-B1 = BDD-4/5（parametrized：`中文图片.png` / `概要図.png`）

- **Given** 通过 API 创建匿名 entry，含 `filename=中文图片.png`（或 `概要図.png`）+ `content_base64`（最小合法 PNG，test_raw_api.py 模式）的二进制文件
- **When** GET `/api/v1/entries/{slug}/files/{id}`（download 端点）
- **Then**
  1. status == 200
  2. `Content-Disposition` 含 `filename*=UTF-8''`（RFC 5987）
  3. 正则 `filename\*=UTF-8''([^;]+)` 提取值 → `urllib.parse.unquote` 后 == 原始文件名
  4. 响应体 == 同文件 GET `/files/{id}/content` 响应体（逐字节，BDD-4 内容正确）
- **当前状态**：download 端点对中文名 500（latin-1 强制编码 UnicodeEncodeError）→ **红灯（断言 200 失败）** ✓

### TC-B2 = BDD-6（latin-1 边界，P2-review 观察②）

- **Given** 同上，`filename=café.png`（é，U+00E9 < 256，latin-1 可编码）
- **When** GET download 端点
- **Then**
  1. status == 200
  2. `Content-Disposition` 含 `filename*=UTF-8''` 且 `unquote` 后 == `café.png`
- **设计意图**：防止 latin-1 名在新实现下误回归——新代码下 café 的 header 从 `filename="café.png"` 变为 `filename="caf_.png"; filename*=UTF-8''caf%C3%A9.png`（P2-review 观察②），必须显式断言新形态
- **当前状态**：200 但 header 无 filename* → **红灯（filename* 断言失败）** ✓

### TC-B3 = BDD-6（ASCII/空格显式守卫）

- **Given** 创建 entry，`path=report final.txt`（纯 ASCII + 空格）
- **When** GET download 端点
- **Then**
  1. status == 200
  2. `Content-Disposition` == `attachment; filename="report final.txt"`（**字节级格式不变**，ASCII 分支零回归）
- **当前状态**：绿（既有行为）——回归守卫，TDD 红灯由 TC-B1/TC-B2 提供

### TC-B4 = BDD-7（复用现有，不新增）

- 现有 `test_security.py:573-613 TestFilenameSanitization::test_filename_header_injection_blocked` 保持绿
- 断言范围锁定 = 200 + 无 `\r`/`\n`（P1-review O1：**不新增引号断言**，标准格式本就含定界引号）
- 净化顺序保证：`_sanitize_filename`（先）→ RFC 5987 编码（后），注入字符被净化无残留

## 前端 e2e 用例（tpv0091-unicode-preview-download.spec.ts 新建）

前置：debug backend :8888 + `make debug-seed`（public entry `unicode-filenames`，8 文件）。选择器均为既有稳定选择器（无新增 testid 需求，P2-design §8）。

### TC-F1 = BDD-1（desktop + mobile）

- **Given** 打开 `{BASE_URL}/unicode-filenames`
- **When** desktop：点击 `.file-tree .file-name`（hasText `中文图片.png`）；mobile：先点 `getByRole('button', { name: 'Toggle file tree' })` 展开树再点击
- **Then** `[data-testid="image-content"]` visible + `[data-testid="image-error"]` 缺席 + `naturalWidth > 0`
- **截图**：`desktop_1280x800_bdd1.png` / `mobile_390x844_bdd1.png`
- **当前状态**：后端 500 → ImageViewer error 态 → image-error 出现 → **红灯** ✓

### TC-F2 = BDD-2（desktop）

- 同 TC-F1，文件 `概要図.png`；截图 `desktop_1280x800_bdd2.png`
- **当前状态**：**红灯** ✓

### TC-F3 = BDD-3（desktop）

- 依次点击 `café.png` / `report final.png` / `arch.png`，每步断言同 TC-F1（三图均正常）
- 截图 `desktop_1280x800_bdd3.png`（最终态 arch.png）
- **当前状态**：三文件 download 现均 200（ASCII/latin-1）→ 绿（回归守卫；真红灯由 BDD-1/2 提供）

### TC-F5 = BDD-5（浏览器级保存名，desktop）

- **Given** `page.request.get({BASE_URL}/api/v1/entries/unicode-filenames/raw)` 解析出 `中文图片.png` 的 file id（不硬编码 seed id，防 seed 变更漂移）
- **When** `Promise.all([page.waitForEvent('download'), page.goto(download URL)])` 触发下载
- **Then** `download.suggestedFilename()` == `中文图片.png`（Chromium 解析 RFC 6266 filename*）
- **当前状态**：download 端点 500 → 无 download 事件 → waitForEvent 超时 → **红灯** ✓
- 注：下载无可见 UI 态，不截图（避免无意义截图；角色文件「操作类 BDD 截图互不相同」要求已由 TC-F1/2/3/8 满足）

### TC-F8 = BDD-8（desktop，TPV0089 模式复用）

- **Given** 打开 `{BASE_URL}/unicode-filenames`（默认 files[0]=README.md 渲染 markdown）
- **When** 等待 `.markdown-body` visible
- **Then** `.markdown-body img` count == 5，且每张 src 匹配 `/files/\d+/content`、`naturalWidth > 0`
- 截图 `desktop_1280x800_bdd8.png`
- **当前状态**：走 /content（未动）→ 绿（回归守卫；该路径不被修复破坏）

## 前端 URL 变更的单测覆盖说明（P2-design §8）

`getFileAsBase64` URL 一行变更**无新增单测**：`ImageViewer.spec.ts` 全部 mock `api.getFileAsBase64` 且不断言请求 URL → 无 URL 断言可红。真实行为由 TC-F1/2/3（预览 UI）+ TC-F8（/content 路径）覆盖。此项与 P2-design §8「前端（P3 不新增单测）」一致。

## 红灯汇总（P3 时点）

| 用例 | 预期状态 | 失败原因（B 类） |
|------|---------|-----------------|
| TC-B1（中文/日文 download） | 🔴 红灯 | `assert resp.status_code == 200` 失败（实际 500，UnicodeEncodeError） |
| TC-B2（café filename*） | 🔴 红灯 | `filename*=UTF-8''` 不存在断言失败 |
| TC-B3（ASCII 格式守卫） | 🟢 绿 | 回归守卫 |
| TC-B4（BDD-7 现有） | 🟢 绿 | 现有用例，实现未改此处 |
| TC-F1/TC-F2（中/日文预览） | 🔴 红灯 | 500 → image-error 出现，断言失败 |
| TC-F5（下载名） | 🔴 红灯 | 500 → 无 download 事件，超时 |
| TC-F3/TC-F8（回归守卫） | 🟢 绿 | 既有行为 |

> 套件整体 exit 非 0（红灯由 TC-B1/TC-B2/TC-F1/F2/F5 提供），符合 check-tdd-red.sh exit 0（真红灯）判定。

## P4 实现后预期（供 P5 对照）

- TC-B1/TC-B2/TC-B3 全绿；`test_security.py` 全绿（BDD-7 净化顺序不回归）
- TC-F1/F2/F3/F5/F8 全绿（需 debug :8888 + seed）
- P4 需注意：`download_file` 现有 `safe_name = _sanitize_filename(...)` 行删除后防 F841（P2-review 观察①，属实现职责）
