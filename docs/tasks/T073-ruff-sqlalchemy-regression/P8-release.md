---
phase: P8
task_id: T073
type: release
parent: P7-consistency.md
trace_id: T073-P8-20260726
status: draft
created: 2026-07-26
agent: releaser
---

## bump_type

patch

## 版本号变更

| package | 当前 | 目标 |
|---------|------|------|
| peekview | 0.11.0 | 0.11.1 |
| mcp_server | 0.10.0 | 0.10.0（不 bump） |

## packages

- [backend/peekview]

## CHANGELOG 更新确认

- [x] CHANGELOG.md 已更新：`[Unreleased]` 内容移至 `[0.11.1] - 2026-07-26`
- [x] 包含 T073 修复描述（19 处 SQLAlchemy 语法回归 + E711/E712 ignore）

## P7 一致性确认

- [x] P7-consistency.md 无 BLOCKER
- [x] P7-consistency.md 无 DEVIATION-CRITICAL
- [x] 双向一致性检查完成，19 处修复 + 1 处配置修改全部与 P2 设计一致

## P6 验收确认

- [x] 13 BDD 全 PASS

## 发布检查命令

```bash
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
ruff check --select E711,E712 backend/peekview/
make lint
make typecheck
```

## 临时资源清单

| 资源 | 类型 | 状态 | 清理方式 |
|------|------|------|---------|
| 无 | — | — | 本任务为纯代码修复，无启动临时服务/进程/数据/开发安装 |

## PROD_TOUCHED

[PROD_NOT_TOUCHED] 纯代码修复，未触碰生产环境

## 主 Agent 交接

1. 执行 `make bump-version NEW_VERSION=0.11.1`（只 bump peekview）
2. 验证 VERSIONS.json peekview=0.11.1
3. 重跑 P5 gate：`cd backend && .venv/bin/python -m pytest tests/ -q --tb=no`
4. `git add CHANGELOG.md` + `git commit --amend --no-edit`（将 CHANGELOG 纳入 bump commit）
5. `git tag v0.11.1`
6. READY 收尾检查（参考临时资源清单——无临时资源需清理）
