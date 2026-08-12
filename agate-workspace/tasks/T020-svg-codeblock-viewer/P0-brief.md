---
phase: P0
task_id: T020
task_name: svg-codeblock-viewer
trace_id: T020-P0-20260624
created: 2026-06-24
---

# P0 任务简报 — T020 svg-codeblock-viewer

## task

为 markdown 中 ` ```svg ` 代码块添加一体化查看体验：渲染矢量图 + 图/码 toggle + 复制源码 + 下载 PNG（透明背景）+ 全屏/缩放，对齐现有 mermaid/plantuml 工具栏；同时修复过时的 `mime.spec.ts` 测试（期望 SVG 返回 null，实际返回 image/svg+xml）。

## known_risks

- **XSS 安全**：SVG 可内嵌 `<script>` 和事件处理器（onload/onclick），` ```svg ` 代码块渲染时必须净化。现有 markdown 内联 `<svg>` 走 DOMPurify 增量模式（ADD_TAGS，非白名单），需确认该配置对 svg 子元素的默认处理是否足够，不能因加工具栏引入新攻击面
- **多写法并存不互扰**：` ```svg ` 代码块、内联 `<svg>`、独立 `.svg` 文件三条渲染管线独立，改代码块路径不能影响另外两条
- **复用 mermaid/plantuml UI 壳但渲染逻辑不同**：mermaid/plantuml 是"源码→生成 SVG"，` ```svg ` 是"现成 SVG 内容→直接渲染"，工具栏结构可复用但挂载/渲染流程不同，不能照抄
- **PNG 透明背景**：mermaid/plantuml 现有导出逻辑填白底（`ctx.fillStyle='#ffffff'`），SVG 导出需透明背景，不能共用同一段导出代码或需参数化
- **大 SVG 性能**：架构图/图表类 SVG 可能很大，渲染和 pan-zoom 需考虑性能
- **既有 mime.spec.ts 失败**：当前 1 个测试失败（期望 null 实际 image/svg+xml），是 e8069c6b "add SVG image rendering support" 时测试未跟上，本任务顺手修复

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 后端调试：`make debug`（127.0.0.1:8888，独立数据目录 /tmp/peekview-debug/，PEEKVIEW_DEBUG_MODE=1 自动隔离）
  - 后端测试：`cd backend && .venv/bin/python -m pytest tests/`（用 backend/.venv，editable v0.1.65）
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`（非 npx vitest；vitest v1 不支持 --tb=short）
  - 前端构建：`cd frontend-v3 && npm run build`（自动复制到 static/）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry（AGENTS.md 铁律 8），只通过 debug backend HTTP API
  - **严禁** 直接 sqlite3 操作生产数据库（AGENTS.md 铁律 6）

## pruning_tendency

保守。理由：涉及前端 UI 新功能 + XSS 安全净化 + 多渲染管线并存，P2 设计（UI 壳结构、净化策略、PNG 导出方案）和 P6 验收（Playwright 实跑工具栏交互、净化验证）都不可跳。这是新功能不是微任务，走完整 P1-P8。

## phase_hint

[P1, P2, P3, P4, P5, P6, P7, P8]（全走）

## 范围声明

**本任务做**：
- ` ```svg ` 代码块加工具栏（渲染图 + toggle 源码 + 复制 + 下载 PNG 透明底 + 全屏/缩放）
- 修复 `mime.spec.ts` 过时测试

**本任务不做**：
- 独立 `.svg` 文件 ImageViewer 升级（维持现状：只看图+点击缩放）
- 内联 `<svg>` 加工具栏（维持现状：直接渲染无工具栏）
- `![alt](file.svg)` markdown 图片引用形式（无 URL 重写逻辑，不在范围）
- SVG 编辑功能
- SVG 内嵌动画/交互脚本支持（当静态矢量图看）
