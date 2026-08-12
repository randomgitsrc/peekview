---
phase: P6
task_id: T041-html-sibling-inject-fix
type: acceptance
parent: P4-implementation/implementation.md
trace_id: T041-P6-20260630
status: draft
created: 2026-06-30
---

## BDD 验收结果

- PASS B01: sandbox 含 allow-scripts + allow-forms，不含 allow-same-origin
- PASS B02: script type="module" 保留 type 属性注入
- PASS B03: 旧警告文案已移除，新中性描述已显示
- PASS B04: SVG-as-img 通过 data:image/svg+xml 内联
- PASS B05: ../ 路径归一化，CSS 正确内联
- PASS B06: CSS @import url() 递归替换成功

## 证据

- Playwright 实跑验证：6/6 PASS
- 后端测试：46 passed (test_html_render.py)
- 前端测试：624 passed / 1 skipped
