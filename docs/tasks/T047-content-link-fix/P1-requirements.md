---
phase: P1
task_id: T047
task_name: content-link-fix
type: requirements
parent: P0-brief.md
trace_id: T047-P1-20260705
status: draft
created: 2026-07-05
agent: analyst
risk_level: medium
---

# T047 需求基线

## 需求复述

修复后端 `/api/v1/entries/{slug}/files/{file_id}/content` 端点对二进制文件返回错误 Content-Type 的问题，并恢复 T046 已验证正确的前端路径重写代码，使 Markdown 中的图片引用在浏览器中实际渲染。

P0 已确定的技术路线（引用 P0-brief.md）：
- 后端：`get_file_content` 端点改走新的 `_determine_content_type(file_record)` 函数，使用与 `_build_sibling_data` 相同的三级 fallback（`_LANGUAGE_TO_MIME` → `mimetypes.guess_type()` → `application/octet-stream`）
- 前端：从 `P4-code-diff.patch` 恢复 path-map.ts / useMarkdown.ts / MarkdownViewer.vue / EntryDetailView.vue 改动
- `_language_to_content_type()` 保留不变，仍用于文本文件行内显示

## 隐含需求识别

### IR-1：后端 Content-Type 修复必须覆盖所有二进制格式

**为什么必须**：P0 只提到 PNG/JPEG/GIF/SVG/WebP，但 `mimetypes.guess_type()` 基于扩展名映射，覆盖范围远超这些。修复方案（三级 fallback）本身已覆盖，但需确认不会引入回归——例如 `.txt` 文件被 `mimetypes.guess_type()` 误判为非文本格式。

**验证点**：文本文件（.py/.js/.md/.txt）仍返回 `text/x-*` 或 `text/plain`，二进制文件返回正确的 `image/*` / `application/*` MIME。

### IR-2：前端恢复需与 T045 合并后的 useMarkdown.ts 兼容

**为什么必须**：P0 已知风险 #3——T046 和 T045 都改了 useMarkdown.ts。当前代码是 T045 合并后的状态（T046 已回退），恢复 T046 的 useMarkdown.ts 改动时需确认不与 T045 代码冲突。patch 是基于 T046 时的代码生成的，不能直接 apply。

**验证点**：恢复后的 useMarkdown.ts 同时包含 T045 的功能和 T046 的路径重写功能，vue-tsc 无错误。

### IR-3：端到端验证必须使用真实尺寸图片

**为什么必须**：T046 教训 L3/L5——1×1 像素 PNG 不能验证"用户在文档中嵌入的截图是否正常显示"。测试数据必须贴近真实场景（至少 100×100 像素，有可辨识内容）。

**验证点**：P6 测试 entry 包含 ≥100×100 像素的 PNG/JPEG 图片，vision-helper 报告图片可见。

### IR-4：P6 验收必须先验证功能再满足 gate 格式

**为什么必须**：T046 教训 L4——gate 是必要条件不是充分条件。P6 花约 2 小时凑格式没花 5 分钟查响应头。T047 必须强制"先验功能再凑格式"顺序。

**验证点**：P6-acceptance.md 中用户视角验证（截图 + vision-helper 分析）出现在格式合规之前。

### IR-5：P2 最小验证必须覆盖 /content 端点 Content-Type

**为什么必须**：T046 教训 L6/L7 + retrospective G2/G3——P2 方案依赖后端 API 返回正确 Content-Type，这是外部行为，必须触发最小验证。T046 未触发导致根因在设计阶段就应被发现却未发现。

**验证点**：P2 产出包含 `minimal_validation` 块，且 `curl -I` 验证 PNG→image/png、JPEG→image/jpeg、SVG→image/svg+xml。

### IR-6：P5 gate_commands 必须包含端到端验证命令

**为什么必须**：T046 教训 L6 + retrospective G3——P5 只跑 pytest/vitest/vue-tsc，无端到端验证。P0 已声明 `gate_commands.P5` 包含 `e2e-smoke.sh`。

**验证点**：P5 gate_commands 包含至少一条 Playwright 端到端命令。

### IR-7：否定证据处理规则

**为什么必须**：T046 教训 L2/L7 + retrospective G5——vision-helper 三次报告图片未渲染被三次反驳。T047 规定：vision-helper 报告异常时，第一反应是追查（检查网络请求/响应头），不是反驳。

**验证点**：P6 验收中若 vision-helper 报告异常，必须先 `curl -I` 检查 Content-Type 再做判断。

### IR-8：后端测试需覆盖 _determine_content_type 新函数

**为什么必须**：新增函数需有对应测试，覆盖三级 fallback 路径：已知 MIME 映射、mimetypes.guess_type 命中、fallback 到 octet-stream。

**验证点**：pytest 包含 `_determine_content_type` 的单元测试。

## BDD 验收条件

### AC-1：后端 PNG 文件 Content-Type 正确

- **Given** 一个 entry 包含 PNG 图片文件（如 `screenshot.png`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `image/png`

### AC-2：后端 JPEG 文件 Content-Type 正确

- **Given** 一个 entry 包含 JPEG 图片文件（如 `photo.jpg`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `image/jpeg`

### AC-3：后端 SVG 文件 Content-Type 正确

- **Given** 一个 entry 包含 SVG 文件（如 `diagram.svg`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `image/svg+xml`

### AC-4：后端未知二进制文件 Content-Type fallback 正确

- **Given** 一个 entry 包含无已知扩展名的二进制文件（如 `data.bin`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `application/octet-stream`

### AC-5：后端文本文件 Content-Type 不受影响

- **Given** 一个 entry 包含 Python 文件（如 `main.py`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `text/x-python`（与修复前一致）

### AC-6：后端 CSS/JS 文件 Content-Type 使用 _LANGUAGE_TO_MIME 映射

- **Given** 一个 entry 包含 CSS 文件（如 `style.css`）
- **When** 请求 `GET /api/v1/entries/{slug}/files/{file_id}/content`
- **Then** 响应头 `Content-Type` 为 `text/css`

### AC-7：前端 path-map.ts 恢复后单元测试全绿

- **Given** path-map.ts 和 path-map.test.ts 从 P4-code-diff.patch 恢复
- **When** 运行 `cd frontend-v3 && ./node_modules/.bin/vitest run`
- **Then** path-map 相关 38 个测试全部通过

### AC-8：前端 useMarkdown.ts 恢复后与 T045 代码兼容

- **Given** useMarkdown.ts 恢复 T046 的路径重写改动
- **When** 运行 `cd frontend-v3 && npx vue-tsc --noEmit`
- **Then** 无类型错误

### AC-9：Markdown 图片端到端渲染

- **Given** 一个 entry 包含 README.md（引用 `![alt](screenshot.png)`）和 screenshot.png（≥100×100 像素）
- **When** 在浏览器中打开该 entry 页面
- **Then** 图片在 Markdown 渲染区域中可见（非破图），`<img>` 元素的 `src` 指向 `/api/v1/entries/{slug}/files/{file_id}/content`

### AC-10：Markdown 链接端到端重写

- **Given** 一个 entry 包含 README.md（引用 `[doc](guide.md)`）和 guide.md
- **When** 在浏览器中打开该 entry 页面并点击链接
- **Then** 文件树切换到 guide.md 文件（不触发页面导航）

### AC-11：同名文件 basename fallback 正确

- **Given** 一个 entry 包含 `src/utils.py` 和 `test/utils.py`，README.md 引用 `[u](utils.py)`
- **When** 在浏览器中打开该 entry 页面
- **Then** 链接解析到与引用位置最近的同名文件（按 path-map.ts 的 priority 规则）

### AC-12：后端 _determine_content_type 单元测试覆盖三级 fallback

- **Given** `_determine_content_type` 函数实现
- **When** 运行 pytest
- **Then** 测试覆盖：已知 MIME 映射命中、mimetypes.guess_type 命中、fallback 到 application/octet-stream 三条路径

### AC-13：P6 验收使用真实尺寸图片 + vision-helper 确认

- **Given** 测试 entry 包含 ≥100×100 像素的 PNG 图片
- **When** Playwright 打开页面 + 截图 + vision-helper 分析
- **Then** vision-helper 报告图片可见（非破图/空白）

### AC-14：P6 验收检查网络请求 Content-Type

- **Given** 测试 entry 包含 PNG 图片
- **When** Playwright 打开页面并监控网络请求
- **Then** 图片请求的响应头 Content-Type 为 image/png（非 text/plain）

## 待确认清单

无。P0 已明确技术路线和裁剪倾向，所有隐含需求均可从 T046 失败教训和现有代码推导得出。

## 裁剪说明

P0 声明保守倾向，保留 P1-P8 全阶段。本需求基线确认不裁剪任何阶段：

| 阶段 | 保留 | 理由 |
|------|------|------|
| P1 | ✅ | 本文件 |
| P2 | ✅ | 需设计 `_determine_content_type` 函数 + 前端恢复策略 + minimal_validation |
| P3 | ✅ | path-map.ts 有 38 个测试需恢复，后端新函数需新增测试 |
| P4 | ✅ | 后端修复 + 前端恢复 |
| P5 | ✅ | pytest + vitest + vue-tsc + e2e-smoke.sh |
| P6 | ✅ | UI 交互必须 Playwright 实跑 + vision-helper 验证 |
| P7 | ✅ | 前端+后端双端改动需一致性检查 |
| P8 | ✅ | 版本 bump + CHANGELOG |

## 范围声明

```yaml
packages: [peekview]
domains: [backend, frontend]
ui_affected: true
```

涉及文件（预估）：
- 后端：`backend/peekview/api/files.py`（新增 `_determine_content_type`，修改 `get_file_content`）
- 后端测试：`backend/tests/test_files.py` 或新建测试文件
- 前端：`frontend-v3/src/utils/path-map.ts`（新建）、`frontend-v3/src/utils/path-map.test.ts`（新建）、`frontend-v3/src/composables/useMarkdown.ts`（修改）、`frontend-v3/src/components/MarkdownViewer.vue`（修改）、`frontend-v3/src/views/EntryDetailView.vue`（修改）

MCP 不受影响（P0 已知风险 #4 确认）。

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要 Playwright 截图 + vision-helper 确认图片实际渲染
    available:
      - vision-analyst（agate 内置执行角色）
      - playwright-vision skill（已注入）
      - vision-helper subagent（可调用）
    status: supplementable

  - need: curl-http
    why: P2 最小验证和 P6 验收需 curl -I 检查 Content-Type 响应头
    available:
      - bash curl（本地环境）
    status: available

  - need: playwright-cdp
    why: P5/P6 端到端验证需 Playwright 连接 Chrome CDP
    available:
      - playwright-vision skill（已注入，含 CDP 连接）
    status: supplementable
```

`requires_minimal_validation: true` — 方案依赖后端 API 的 Content-Type 行为（外部系统行为），P2 必须包含 `minimal_validation` 块且 result 为 confirmed。

## T046 教训吸收映射

| T046 教训 | T047 对应措施 |
|-----------|--------------|
| L1 验收验证用户看到的结果 | AC-9/AC-13 强制 vision-helper 确认图片可见 |
| L2 否定证据先追查再反驳 | IR-7 规定异常时先 curl -I 再判断 |
| L3 P2 设计必须验证外部行为 | IR-5 + requires_minimal_validation: true |
| L4 gate 是必要条件不是充分条件 | IR-4 强制先验功能再凑格式 |
| L5 测试数据贴近真实场景 | IR-3 要求 ≥100×100 像素图片 |
| L6 端到端验证必须在 P5/P6 执行 | IR-6 P5 gate_commands 含 e2e 命令 |
| L7 gate_commands.P5 应含端到端命令 | IR-6 + P0 已声明 e2e-smoke.sh |
| L8 卡死时必须产出 | 不在 P1 范围，主 Agent 行为规范 |
