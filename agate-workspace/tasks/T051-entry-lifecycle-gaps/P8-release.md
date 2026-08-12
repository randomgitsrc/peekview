---
phase: P8
task_id: T051
task_name: T051 entry-lifecycle-gaps
type: release
agent: main
parent: P7-consistency.md
trace_id: T051-P8-20260709
status: draft
created: 2026-07-09
---

# T051 P8 发布

## 版本信息

bump_type: minor
当前版本: 0.5.6 → 目标版本: 0.6.0
涉及包: `peekview` (PyPI)

## 发布前检查清单

### 单元测试
- [x] 后端: `cd backend && .venv/bin/python -m pytest tests/ -q`
- [x] 前端 vitest: `cd frontend-v3 && ./node_modules/.bin/vitest run`
- [x] 前端类型检查: `cd frontend-v3 && npx vue-tsc --noEmit`
- [x] Ruff lint: `cd backend && python3 -m ruff check peekview/ tests/`

### Bump 流程
- [ ] `make bump-version NEW_VERSION=0.6.0`
- [ ] CHANGELOG [Unreleased] → v0.6.0
- [ ] bump 后重跑 P5 gate
- [ ] `git commit --amend --no-edit` (CHANGELOG 补入)
- [ ] `git tag v0.6.0`

### 发布流程
- [ ] `make pre-publish-quick`（快速：check-version + check-changelog + test-quick + verify-wheel）
- [ ] `make publish`（PyPI，token 从 ~/.bash_env 读）
- [ ] `git push && git push origin v0.6.0`

## 临时资源清单

以下是在 T051 开发期间启动/创建的资源，P8 gate 通过后需清理：

| 资源 | 类型 | 状态 | 清理方式 |
|------|------|------|----------|
| debug backend (127.0.0.1:8888) | 调试服务 | 运行中 | `make debug-stop` |
| /tmp/peekview-debug/ | 临时测试数据 | 存在 | `make debug-stop` 自动清理 |
| 测试用户 testuser/testuser2 | 测试数据 | debug DB 内 | debug-stop 自动删除 |
| 测试条目 p6-* | 测试数据 | debug DB 内 | debug-stop 自动删除 |
| CDP Chrome :18800 | 调试浏览器 | 运行中 | 独立进程，标记为永久服务 |

> `make debug-stop` 会自动清理所有调试数据。/tmp/peekview-debug/ 的数据与生产完全隔离。
> CDP Chrome 是持久性测试基础设施，非 T051 特有，不清理。
>
> **生产环境无残留**：所有测试数据仅限 debug DB，未触碰 `~/.peekview/peekview.db`。验证通过。
