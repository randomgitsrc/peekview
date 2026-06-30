---
phase: P0
task_id: T043
task_name: html-inject-ux-polish
type: fix/feature
trace_id: T043-P0-20260630
created: 2026-06-30
status: draft
parent: T037 (HTML 多文件引用部分拆出) + T019 (sibling injection 增强)
---

task: HTML sibling 注入 UX 改善 — 警告文案修正 + CSS 内部引用注入 + SVG-as-img + ../ 路径归一化

## 1. 警告文案修正

**现状**: `HtmlViewer.vue:11` 显示 "此 HTML 含 N 个本地资源引用，PeekView 当前不支持多文件相对路径，这些资源不会加载。"

**实际**: 简单场景下 CSS/JS/IMG 注入已正常工作（实测验证：Todo App 的 styles.css 和 app.js 都成功注入）。

**修正方向**:
- 区分"已成功注入"和"无法注入"的引用
- 前端 `countRelativePaths()` 只做计数，不知道哪些被后端注入了
- 方案 A：前端不显示警告（由后端注入结果决定），简单但信息量少
- 方案 B：前端传递 sibling 信息给警告逻辑，区分可注入 vs 不可注入，但复杂度高
- 方案 C（推荐）：修改文案为中性描述，如 "此 HTML 含 N 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、CSS 内部引用等）。"——不声称"不支持"，也不承诺全部注入

## 2. CSS 内部引用注入

**现状**: `html_render_service.py` 只处理 HTML 标签中的引用（`<link href>`, `<script src>`, `<img src>`），不解析 CSS 内部语法：
- `@import url("theme.css")` — 不替换
- `background-image: url("bg.png")` — 不替换
- `font-face src: url("font.woff2")` — 不替换

**修正方向**: 在 `inject_resources` 中，对已注入的 CSS 内容做二次处理：
- 正则匹配 `@import url("x")` / `@import 'x'` → 替换为对应 sibling 的内联内容
- 正则匹配 `url("x")` (非 http/data/blob) → 替换为 data URI（二进制 sibling）或保留（文本 sibling）
- 递归处理 @import 链（深度限制 3 层防循环）

## 3. SVG-as-img 注入

**现状**: `<img src="diagram.svg">` 中，如果 SVG 是文本文件（is_binary=false），不被识别为二进制资源，`img src` 不做 data URI 替换。

**修正方向**: 对 `<img src>` 匹配时，不仅查 binary_map，也查 text_map 中是否为 SVG（language=xml/svg 或 filename 以 .svg 结尾），转为 `data:image/svg+xml;charset=utf-8,{content}` 内联。

## 4. ../ 路径归一化

**现状**: `normalize_ref("../style.css")` 返回 `../style.css`（不归一化），无法匹配 sibling key `style.css`。

**修正方向**: 在 `normalize_ref` 或 `_sibling_keys` 中用 `posixpath.normpath` 归一化路径：
- `../style.css` + 当前目录 → 可能无法确定最终路径
- 更安全的方案：在 `_sibling_keys` 中同时注册归一化后的 key（如 `../style.css` → `style.css`，假设扁平文件场景）
- 或：对 `normalize_ref` 返回的路径也做 `posixpath.basename()` 匹配作为 fallback

## 改动域

- `frontend-v3/src/components/HtmlViewer.vue` — 警告文案修正
- `backend/peekview/services/html_render_service.py` — CSS 内部引用注入 + SVG-as-img + 路径归一化
- `backend/tests/test_html_render.py` — 补充测试

known_risks:
  - CSS @import 正则替换可能误匹配字符串内容中的 url()（如 CSS 注释、content 属性）
  - ../ 路径归一化假设扁平文件结构，嵌套目录场景可能产生错误匹配
  - SVG 内联可能引入 XSS（SVG 可包含 JS），但 sandbox iframe 已隔离

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 涉及后端注入逻辑修改 + 安全考量，须走 P2 评审 + P3 TDD
