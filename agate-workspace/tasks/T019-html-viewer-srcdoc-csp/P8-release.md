---
phase: P8
task_id: T019
task_name: html-viewer-srcdoc-csp
type: release
trace_id: T019-P8-2026-06-23
created: 2026-06-23
status: ready
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P7-consistency.md
---

# T019 P8 发布准备

## 版本

- 旧版本: 0.1.64
- 新版本: 0.1.65
- MCP Server 版本: 0.9.2（不变，T019 不涉及 MCP）

## 改动文件清单

| 文件 | 改动类型 |
|------|---------|
| `backend/peekview/api/files.py` | 新增 RENDER_CSP + render_html_file 路由 + _build_sibling_data |
| `backend/peekview/main.py` | CSP 中间件 render 路由特判 + frame-src 修复 |
| `backend/peekview/services/html_render_service.py` | 新增 BS4 sibling 注入服务 |
| `backend/pyproject.toml` | 新增 beautifulsoup4 依赖 + 版本 bump 0.1.65 |
| `backend/tests/test_html_render.py` | 新增 15 个后端测试 |
| `frontend-v3/src/components/HtmlViewer.vue` | blob URL → render URL |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 测试重写 31 个 |
| `frontend-v3/src/views/EntryDetailView.vue` | sibling 逻辑简化 |
| `CHANGELOG.md` | 0.1.65 变更记录 |

## Gate 检查

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 后端单元测试 | `pytest tests/test_html_render.py` | ✅ 15/15 |
| 后端 API 回归 | `pytest tests/test_api.py` | ✅ 17/17 |
| 后端全量测试 | `pytest` (pre-publish-quick) | ✅ 577 passed, 1 skipped |
| 前端单元测试 | `vitest run HtmlViewer.spec.ts` | ✅ 31/31 |
| 前端集成测试 | `vitest run HtmlViewerIntegration.spec.ts` | ✅ 5/5 |
| 前端构建 | `npm run build` | ✅ |
| 版本号 | `python3 -c "from peekview import __version__"` | ✅ 0.1.65 |
| CHANGELOG | 已填写 | ✅ |
| 依赖声明 | `pyproject.toml` beautifulsoup4 | ✅ |

## 发布命令

```bash
make publish
```

## 下一步

人工触发 `make publish` 发布到 PyPI。
