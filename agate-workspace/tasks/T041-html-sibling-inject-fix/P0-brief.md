---
phase: P0
task_id: T041
task_name: html-sibling-inject-fix
type: bug/fix
trace_id: T041-P0-20260630
created: 2026-06-30
status: draft
parent: T019 (sibling injection 功能性 bug + 增强)
---

task: HTML sibling 注入修复与增强 — sandbox + module script + CSS 内部引用 + 警告文案 + SVG + 路径归一化

## 🔴 Bug 1: sandbox 缺 allow-forms，表单交互失效

`HtmlViewer.vue:64` 设置 `sandbox="allow-scripts"`，缺少 `allow-forms`。sandbox iframe 中表单提交需要此权限，否则点击按钮无反应。

**修正**: `sandbox="allow-scripts allow-forms"`。CSP `form-action 'none'` 兜底安全（表单可触发 submit 事件，但不能导航）。

## 🔴 Bug 2: `<script type="module">` 注入完全失效

`html_render_service.py:148-149` 跳过 `type != text/javascript` 的 script，导致：

1. 原始 `<script type="module" src="main.js">` 保留 → 浏览器 404
2. main.js 被当作"未引用 JS"追加为普通 `<script>` → ES import 语法非法 → JS 静默失败

**修正**: 也处理 `type="module"`，保留 module 属性：
```python
if type_attr and type_attr not in ("text/javascript", "module"):
    continue
```
替换时保留 `type` 属性。需确保 `used_text_keys` 正确标记，防止重复追加。

**硬限制**: 内联 module script 中的 `import './dep.js'` 相对路径无法被 BS4 静态替换。如果 HTML 已有 `type="importmap"`，sibling JS 可注册到 import map；否则需在警告中说明。

## 🟡 增强 1: 警告文案修正

`HtmlViewer.vue:11` 写 "PeekView 当前不支持多文件相对路径，这些资源不会加载" — 但简单场景下 CSS/JS 注入已正常工作。

**修正**: 改为中性描述，如 "此 HTML 含 N 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）。"

## 🟡 增强 2: CSS 内部引用注入

当前只处理 HTML 标签引用，不解析 CSS 内部语法：
- `@import url("theme.css")` — 不替换
- `background-image: url("bg.png")` — 不替换

**修正**: 对已注入的 CSS 内容做二次处理，正则替换 `@import` 和 `url()` 引用。递归深度限制 3 层防循环。

## 🟡 增强 3: SVG-as-img 注入

`<img src="diagram.svg">` 中，SVG 是文本文件（is_binary=false），不被识别为二进制资源，img src 不替换。

**修正**: 对 `<img src>` 匹配时，也查 text_map 中是否为 SVG（language=xml/svg 或 .svg 后缀），转为 `data:image/svg+xml;charset=utf-8,{content}`。

## 🟡 增强 4: ../ 路径归一化

`normalize_ref("../style.css")` 返回 `../style.css`，无法匹配 sibling key `style.css`。

**修正**: 在 `_sibling_keys` 中同时注册 `posixpath.basename()` 作为 fallback key（扁平文件场景下 `../style.css` → `style.css`）。

## 改动域

- `frontend-v3/src/components/HtmlViewer.vue` — sandbox + 警告文案
- `backend/peekview/services/html_render_service.py` — module script + CSS 内部引用 + SVG + 路径归一化
- `backend/tests/test_html_render.py` — 补充测试

known_risks:
  - ES module 内联后 `import` 相对路径仍可能失败（硬限制）
  - CSS @import 正则替换可能误匹配字符串内容中的 url()
  - ../ basename fallback 在嵌套目录场景可能产生错误匹配
  - SVG 内联可能引入 XSS（SVG 可含 JS），但 sandbox iframe 已隔离
  - 需确认 `allow-forms` + `allow-scripts` + `form-action 'none'` 在所有主流浏览器行为一致

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 适度裁剪 — sandbox 一行改可快速验证；后端注入逻辑修改须走 P2 评审 + P3 TDD；前端警告文案可随 sandbox 一起改
