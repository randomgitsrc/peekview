---
phase: P0
task_id: T047
task_name: content-link-fix
type: fix
trace_id: T047-P0-20260705
created: 2026-07-05
status: draft
agent: main
---

task: 修复后端二进制文件 Content-Type + 恢复前端内容链接重写（T046 失败功能修复）

## 问题本质

T046（content-link-resolution）走完 P0-P8 全流程后宣告失败。根因是后端 `/api/v1/entries/{slug}/files/{id}/content` 端点对二进制文件（PNG/JPEG/GIF）统一返回 `Content-Type: text/plain; charset=utf-8`，浏览器不将 `text/plain` 解码为图片。前端路径重写逻辑正确（src 被正确改为 API URL），但后端前提不成立。

T046 的前端代码已回退并保存为 `docs/tasks/T046-content-link-resolution/P4-code-diff.patch`（606 行）。T047 从后端修复开始，再恢复前端代码，端到端验证图片实际渲染。

详见复盘文档：
- `docs/reviews/t046-postmortem-20260705.md`（时间线+校验）
- `docs/reviews/t046-retrospective-20260705.md`（五维分析+改进建议）

## 技术要求

### 后端修复

`get_file_content` 端点（`backend/peekview/api/files.py:232-263`）使用 `_language_to_content_type()` 确定 MIME 类型。该函数只映射文本语言（python→text/x-python, json→application/json 等），二进制文件 fallback 到 `text/plain; charset=utf-8`。

修复方式：`get_file_content` 改用与 `_build_sibling_data`（`files.py:266-285`）相同的三级 fallback，抽取为新函数 `_determine_content_type(file_record)`：
1. 先查 `_LANGUAGE_TO_MIME` map（已有，8 个条目：css/javascript/json/html/xml/yaml/text/markdown）
2. 再 `mimetypes.guess_type(file_record.filename)`（基于扩展名，覆盖 png→image/png 等）
3. 最后 `application/octet-stream`（兜底）

`_language_to_content_type()` 保留不变——它仍用于文本文件的行内显示。新增 `_determine_content_type()` 供 `get_file_content` 使用。

### 前端恢复

从 `P4-code-diff.patch` 恢复前端改动（已确认逻辑正确，38 个单元测试全绿）：
- 新建 `frontend-v3/src/utils/path-map.ts`（PathMapEntry 类型 + buildPathMap/normalizeRef/resolvePath）
- 修改 `frontend-v3/src/composables/useMarkdown.ts`（markdown-it image/link_open rules + post-DOMPurify DOM walk + link click 拦截）
- 修改 `frontend-v3/src/components/MarkdownViewer.vue`（@click 事件委托 + data-peekview-file-id 属性）
- 修改 `frontend-v3/src/views/EntryDetailView.vue`（pathMap props 注入 + 传递）
- 新建 `frontend-v3/src/utils/__tests__/path-map.test.ts`（38 个单元测试覆盖 buildPathMap/normalizeRef/resolvePath）

风险点：T045（code-block-rendering-fix）也改了 `useMarkdown.ts`，当前代码是 T045 合并后的状态。恢复 T046 改动时需确认不与 T045 代码冲突。

### 关键验证（T046 教训）

1. **P2 最小验证**：方案设计后先 `curl -I` 验证修复后的 Content-Type（PNG→image/png, JPEG→image/jpeg, SVG→image/svg+xml, 无扩展名→application/octet-stream）
2. **P5 gate_commands** 必须包含端到端验证命令
3. **P6 验收**：
   - 用真实尺寸图片（≥100×100）创建测试 entry
   - Playwright 打开页面 + vision-helper 分析截图（必须报告图片可见）
   - 检查网络请求中 Content-Type 响应头（curl -I）
   - 所有 BDD 实际运行后才写 P6-acceptance.md
   - 禁止 deferred BDD 标记为 PASS
   - 拒绝"验证 URL 重写不是验证图片显示"的辩护

## 范围

packages: [peekview]
domains: [backend, frontend]
ui_affected: true
gate_commands:
  P5:
    - "cd backend && python3 -m pytest tests/ -q --tb=short"
    - "cd frontend-v3 && ./node_modules/.bin/vitest run"
    - "cd frontend-v3 && npx vue-tsc --noEmit"

## 已知风险

1. **P6 验收重蹈覆辙**：可能再次被 gate 格式带偏。强制遵守"先验功能再凑格式"顺序
2. **useMarkdown.ts 冲突**：T045 和 T046 都改了该文件，恢复时需仔细核对
3. **路径匹配歧义**：同名文件 basename fallback 已在 T046 P1 设计解决，patch 中有对应逻辑
4. **MCP 不受影响**：MCP 直接读文件内容，不依赖 HTTP Content-Type

## 环境约束

debug_env: "cd /home/kity/oclab/peekview && make debug"
executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

## 裁剪倾向

保守——不跳过任何阶段。P3 TDD 保留（patch 已有 38 个测试 + 需为 Content-Type 修复写测试）。P6 验收不可跳（UI 交互必须实跑 Playwright）。P7 一致性检查保留（前端+后端双端改动）。
