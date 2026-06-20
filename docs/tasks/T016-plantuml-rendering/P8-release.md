---
phase: P8
task_id: T016
task_name: plantuml-rendering
type: release
trace_id: T016-P8-2026-06-20
created: 2026-06-20
status: ready
parent: docs/tasks/T016-plantuml-rendering/P2-design.md
---

# P8 发布准备：PlantUML 渲染集成

## 发布版本

peekview v0.1.62（MCP v0.9.2 不变，无 MCP 改动）

## 版本变更

- `backend/peekview/__init__.py`: 0.1.61 → 0.1.62
- `backend/pyproject.toml`: 0.1.61 → 0.1.62
- `frontend-v3/package.json`: 0.1.61 → 0.1.62

## CHANGELOG

已填写 `[0.1.62] - 2026-06-20` 条目，包含：
- 5 项新增（PlantUML 渲染支持、usePlantUML 封装、PlantUmlDiagram 组件、vendored 文件、renderToken 机制）
- 验证记录（单元测试、CSP Playwright、BDD 验收）

## 门槛验证

| 检查项 | 结果 |
|--------|------|
| `make check-version` | ✅ peekview v0.1.62 / mcp v0.9.2 一致 |
| `make check-changelog` | ✅ CHANGELOG 含 v0.1.62 |
| `cd frontend-v3 && npm run build` | ✅ 构建通过 |
| `cd frontend-v3 && npx vitest run` | ✅ 10/10 PlantUML 测试通过 |

## 发布命令

```bash
make pre-publish-quick  # 快速预发布检查
make publish            # 发布到 PyPI
git tag -a v0.1.62 -m "Release v0.1.62: PlantUML rendering support"
git push origin main
git push origin v0.1.62
```

## 结论

READY — 可发布。由用户手动执行 `make publish`。
