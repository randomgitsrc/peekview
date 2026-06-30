---
phase: P0
task_id: T041
task_name: html-sandbox-allow-forms
type: bug
trace_id: T041-P0-20260630
created: 2026-06-30
status: draft
parent: T019 (sibling injection 功能性 bug)
---

task: HTML iframe sandbox 缺少 allow-forms，表单交互完全失效

## Bug 描述

`HtmlViewer.vue:64` 设置 `sandbox="allow-scripts"`，缺少 `allow-forms`。在 sandbox iframe 中，表单提交需要 `allow-forms` 权限，否则用户点击提交按钮无任何反应。

**实测验证**：用 Todo App（index.html + styles.css + app.js）创建 entry，CSS/JS 都正确注入，但点击 "Add" 按钮无法添加 todo 项。通过 `frame.evaluate()` + `dispatchEvent` 可以添加（因为不走浏览器表单提交流程），证明是 sandbox 权限问题。

## 安全验证

render 路由的 CSP 已设 `form-action 'none'`，阻止表单导航到任何 URL。因此：
- `allow-forms` + `form-action 'none'` = 表单可以触发 submit 事件（JS 事件处理器可执行），但不能导航
- 这是安全的：`e.preventDefault()` 阻止实际导航，JS 处理逻辑照常执行
- 即使没有 `preventDefault()`，CSP 也会阻止导航

## 修正

```html
<!-- Before -->
<iframe sandbox="allow-scripts" ...>

<!-- After -->
<iframe sandbox="allow-scripts allow-forms" ...>
```

一行改动。CSP `form-action 'none'` 兜底安全。

## 改动域

- `frontend-v3/src/components/HtmlViewer.vue` — sandbox 属性加 `allow-forms`

known_risks:
  - 需确认 `allow-forms` + `allow-scripts` + `form-action 'none'` 组合在所有主流浏览器中行为一致
  - 某些极端场景下 `allow-forms` 可能允许 iframe 内的表单 POST 到同源路径（但 CSP `form-action 'none'` 会阻止）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 大幅裁剪 — 一行改动，P2/P3/P7 可跳过，直接 P4 + P5 验证 + P6 BDD
