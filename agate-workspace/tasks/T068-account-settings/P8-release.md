---
phase: P8
task_id: T068-account-settings
type: release
parent: P7-consistency.md
trace_id: T068-P8-20260723
status: draft
created: 2026-07-23
agent: releaser
---

# P8 Release — T068 Account Settings

## bump_type

minor

## 版本号变更确认

| Package | From | To |
|---------|------|----|
| peekview | 0.10.1 | 0.11.0 |
| mcp_server | 0.9.3 | (unchanged) |

## CHANGELOG 更新确认

- [Unreleased] → [0.11.0] - 2026-07-23
- Added: 4 entries (settings page, PATCH /auth/me, auth guard, apikeys redirect)
- Fixed: 2 entries (apikey creation 500, change-password 401→400)

## 临时资源清单

| 资源 | 位置 | 状态 |
|------|------|------|
| Debug backend | http://127.0.0.1:8888 (PID: 3928180) | 运行中 |
| 临时数据 | /tmp/peekview-debug/ | 存在 |
| 临时截图 | /tmp/t068-p6r2-screenshots/ | 存在 |

## 主 Agent 交接事项

1. 执行 `make bump-version NEW_VERSION=0.11.0`
2. 验证暂存区：VERSIONS.json + CHANGELOG.md + pyproject.toml + __init__.py + package.json 变更
3. 重跑 P5 gate: `make test-quick && make typecheck`
4. `git add CHANGELOG.md && git commit --amend --no-edit`（CHANGELOG 已更新，需 amend 到 bump commit）
5. `git tag v0.11.0`
6. 清理临时资源：`make debug-stop`，删除 `/tmp/t068-p6r2-screenshots/`
7. [PROD_NOT_TOUCHED]
