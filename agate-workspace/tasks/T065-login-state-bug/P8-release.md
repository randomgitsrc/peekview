---
phase: P8
task_id: T065
type: release
parent: P4-implementation.md
trace_id: T065-P8-20260722
status: draft
created: 2026-07-22
  agent: implementer
  bump_type: patch
---

# P8 Release — T065 Login State Bug

## bump_type

**patch** — 纯前端 bugfix，无 API 变更，无行为变更

## 版本号变更确认

| Package | Current | New | Need Bump |
|---------|---------|-----|-----------|
| peekview | 0.9.4 | 0.9.5 | Yes |
| mcp_server | 0.9.3 | 0.9.3 | No |

## CHANGELOG 更新确认

- [x] `[Unreleased]` → `[0.9.5] - 2026-07-22`
- [x] 条目：`Landing 页面登录状态不同步：已登录用户访问 / 时仍显示未登录 UI，需手动刷新才更新 (T065)`
- [x] 分类：修复

## 改动文件

- `frontend-v3/src/views/LandingView.vue`

## 测试证据

- 934 unit tests passed
- 10/10 E2E tests passed
- 6/6 BDD PASS

## 临时资源清单

| 资源 | 位置 | 说明 |
|------|------|------|
| debug backend | http://127.0.0.1:8888, PID 2627662 | P4/P5/P6 阶段启动 |
| 临时数据目录 | /tmp/peekview-debug/ | debug backend 数据 |
| 环境自检截图 | /tmp/env-check/ | P0 环境自检产出 |
| P2 卡片 | /tmp/p2-card.md | 阶段卡片临时文件 |
| P3 卡片 | /tmp/p3-card.md | 阶段卡片临时文件 |
| P4 卡片 | /tmp/p4-card.md | 阶段卡片临时文件 |
| P5 卡片 | /tmp/p5-card.md | 阶段卡片临时文件 |
| P6 卡片 | /tmp/p6-card.md | 阶段卡片临时文件 |
| P8 卡片 | /tmp/p8-card.md | 阶段卡片临时文件 |

## 主 Agent 交接

1. 执行 `make bump-version NEW_VERSION=0.9.5`（只 bump peekview，mcp 不变）
2. 确认 CHANGELOG.md 已包含 0.9.5 条目
3. 重跑 P5 gate：`make test-quick && make test-frontend`
4. `git add CHANGELOG.md && git commit --amend --no-edit`（合并到 bump commit）
5. `git tag v0.9.5`
6. 按 READY 收尾检查清理临时资源（停止 debug backend、删除 /tmp/peekview-debug/ 等）
