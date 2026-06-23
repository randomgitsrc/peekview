---
phase: P5
task_id: T019
task_name: html-viewer-srcdoc-csp
type: test-results
trace_id: T019-P5-2026-06-23
created: 2026-06-23
status: pass
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P1-requirements.md
---

# T019 P5 技术验证结果

## 验证环境

- Backend: Python 3.12.3, pytest 9.0.3, ruff 0.15.18
- Frontend: vitest 1.6.1, vue-tsc, vite build
- Chrome: 149.0.7827.156 (Windows, CDP 18800, D3D11 GPU)

## Gate 结果汇总

| Gate | 命令 | 结果 | 说明 |
|------|------|------|------|
| 后端 html_render | `python3 -m pytest tests/test_html_render.py -v` | ✅ 15/15 passed (1.50s) | render 路由 + CSP + sibling 注入 |
| 后端 API 回归 | `python3 -m pytest tests/test_api.py -v` | ✅ 17/17 passed (1.30s) | 无回归 |
| 后端 lint (T019 文件) | `ruff check html_render_service.py files.py` | ✅ All checks passed | 修复 F401 (unused import base64) |
| 前端 HtmlViewer | `vitest run HtmlViewer.spec.ts` | ✅ 31/31 passed (1.45s) | render URL + sandbox + CSP + size 逻辑 |
| 前端集成测试 | `vitest run HtmlViewerIntegration.spec.ts` | ✅ 5/5 passed | |
| 前端全量 vitest | `vitest run` | ⚠️ 85/86 passed | 1 失败 = 既有 mime.spec.ts SVG，非 T019 回归 |
| 前端构建 | `npm run build` | ✅ built in 11.70s | vue-tsc 类型检查通过，chunk size 警告既有 |

## 后端测试详情 (15/15)

### TestRenderRouteBasics (4)
- test_render_returns_html ✅
- test_render_csp_allows_unsafe_inline ✅
- test_render_no_xframe_deny ✅ (中间件特判生效)
- test_render_cache_control_nostore ✅

### TestRenderAccessControl (3)
- test_render_public_anonymous_ok ✅
- test_render_nonexistent_file_404 ✅
- test_render_non_html_file_404 ✅

### TestRenderCSPDetails (4)
- test_csp_connect_src_allows_https ✅
- test_csp_worker_src_allows_blob ✅
- test_csp_img_src_allows_https ✅
- test_csp_frame_ancestors_self ✅

### TestRenderSiblingInject (4)
- test_render_no_inject_returns_raw_html ✅
- test_render_inject_css ✅ (link→style 替换)
- test_render_inject_js ✅ (script src→inline)
- test_render_inject_invalid_id_ignored ✅

## 前端测试详情 (31/31 + 5/5)

### HtmlViewer.spec.ts (31)
- render URL 拼接（slug/fileId/siblingFileIds）
- sandbox="allow-scripts" 属性
- 大文件保护（>2MB 手动渲染）
- 相对路径警告
- loading 时序
- sibling file IDs 变化触发重新加载

### HtmlViewerIntegration.spec.ts (5)
- HtmlViewer 与 EntryDetailView 集成
- sibling file IDs 提取逻辑

## 既有失败（非 T019 回归）

- `mime.spec.ts > guessMimeType > returns null for svg` — 既有问题，T019 之前就存在
- 记录于 T016/T017/T018 的 P5 文件中，同一失败

## P5 期间的修复

- **F401 lint 修复**：`html_render_service.py` 移除未使用的 `import base64`（base64 在 `files.py` 的 `_build_sibling_data` 内部 import 使用）

## 结论

P5 gate 通过。所有 T019 引入的测试全绿，无回归。唯一失败是既有 mime.spec.ts 问题。

可进入 P6（Playwright 实跑 8 条 BDD 验收）。
