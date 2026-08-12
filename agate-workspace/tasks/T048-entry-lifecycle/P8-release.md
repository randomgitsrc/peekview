---
phase: P8
task_id: T048-entry-lifecycle
type: release
parent: P7-consistency.md
trace_id: T048-P8-20260707
status: draft
created: 2026-07-07
agent: main
---

# T048 P8: 发布

## bump_type: minor

**理由**：新增功能（Entry 两阶段生命周期管理），非破坏性变更，向后兼容。不涉及公共 API 行为变更。

## 版本号

- 当前: 0.5.3
- 目标: 0.5.4

## packages

| Package | 当前版本 | Bump | 发布命令 |
|---------|---------|------|---------|
| peekview (PyPI) | 0.5.3 | 0.5.4 | `make publish` |

## 临时资源清单

- 调试服务：`make debug-start` (127.0.0.1:8888, PID 838044) — 需停止
- 测试数据：`/tmp/peekview-debug/` — `make debug-stop` 会清理
- Playwright CDP Chrome 连接 — 无新进程
- 前端静态文件：`make build-frontend` 重建的 `backend/peekview/static/` — 无残留

## CHANGELOG

[Unreleased] → [0.5.4]

## 发布检查

- [ ] `make bump-version NEW_VERSION=0.5.4`
- [ ] `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` (P5 gate)
- [ ] `cd frontend-v3 && npx vue-tsc --noEmit`
- [ ] `cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot`
- [ ] `make publish`
- [ ] git tag v0.5.4
- [ ] READY 收尾检查
