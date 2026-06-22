---
phase: P3
task_id: T019
task_name: html-viewer-srcdoc-csp
type: test_plan
trace_id: T019-P3-backend-2026-06-22
created: 2026-06-22
status: red
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P2-design.md
---

# T019 P3 后端测试计划

## 测试文件
`backend/tests/test_html_render.py`（218 行，15 个测试）

## TDD RED 状态
- 12 failed | 3 passed（3 个通过的是不依赖 render 路由的访问控制测试）
- 失败原因：render 路由未实现，返回 404

## 测试分组
1. **TestRenderRouteBasics**（4）：路由存在性 + Content-Type + CSP + X-Frame-Options + Cache-Control
2. **TestRenderAccessControl**（3）：公开/私有 entry 访问 + 不存在文件 404 + 非 HTML 404
3. **TestRenderCSPDetails**（4）：connect-src https + worker-src blob + img-src https + frame-ancestors self
4. **TestRenderSiblingInject**（4）：无 inject + CSS 注入 + JS 注入 + 无效 ID 忽略
