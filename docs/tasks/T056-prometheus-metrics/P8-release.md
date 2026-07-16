---
phase: P8
task_id: T056
type: release
parent: P7-consistency.md
trace_id: T056-P8-20260717
status: ready
created: 2026-07-17
agent: releaser
---

# T056 P8: Release Preparation

## bump_type: minor

## Version Bump

- 0.7.0 → 0.8.0

## Files Updated

| File | Change |
|------|--------|
| `backend/pyproject.toml` | version: 0.7.0 → 0.8.0 |
| `backend/peekview/__init__.py` | __version__: 0.7.0 → 0.8.0 |
| `frontend-v3/package.json` | version: 0.7.0 → 0.8.0 |
| `CHANGELOG.md` | Added [0.8.0] section with T056 entries |

## CHANGELOG Entry

```
## [0.8.0] - 2026-07-17

### 新增

- T056: Prometheus /metrics 端点（prometheus-fastapi-instrumentator 集成）
- T056: `PEEKVIEW_METRICS__ENABLED` 配置项（默认 true，设为 false 关闭 /metrics）
- T056: /metrics 端点绕过 API key 认证和速率限制（与 /health 同等处理）
```

## New Dependency

- `prometheus-fastapi-instrumentator>=7.0.0` (runtime)

## Pre-Publish Checklist

- [x] All tests pass (936 passed, 2 skipped)
- [x] Lint clean on changed files
- [x] Version bumped in all 3 locations
- [x] CHANGELOG updated
- [x] No MCP version change needed (independent versioning)

## Release Command

```bash
make publish
```
