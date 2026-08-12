---
phase: P0
task_id: T073
task_name: ruff-sqlalchemy-regression
type: brief
trace_id: T073-P0-20260725
created: 2026-07-25
status: draft
parent: commit 165997b5 (ruff --fix --unsafe-fixes)
---

## task

ruff 自动修复（E711/E712）误改 SQLAlchemy 表达式，导致 43 个测试失败：admin stats 500、share 功能全面失效

## known_risks

- ruff E711/E712 规则不区分 SQLAlchemy 语境，未来 `make lint-fix` 可能再次引入同类回归
- 需确认所有被 ruff 误改的文件，不能只修已发现的两处

## executor_env

```yaml
platform: "opencode"
has_task_tool: true
has_local_runtime: true
network: "full"
```

## env_constraints

- debug_env: `make debug`（127.0.0.1:8888）
- 改动范围：`backend/peekview/services/admin_service.py`、`backend/peekview/services/share_service.py`、可能还有其他被 165997b5 误改的文件
- 不改前端、不改 MCP

## pruning_tendency

保守

## 根因分析

commit `165997b5`（ruff lint cleanup 156→31）执行了 `ruff --fix --unsafe-fixes`，自动修复了 E711/E712 规则：

| 原代码（正确） | ruff 改成（错误） | 正确 SQLAlchemy 写法 |
|---|---|---|
| `Entry.expires_at != None` | `Entry.expires_at is not None` | `Entry.expires_at.isnot(None)` |
| `Entry.is_public == False` | `not Entry.is_public` | `~Entry.is_public` |
| `EntryShare.revoked_at == None` | `EntryShare.revoked_at is None` | `EntryShare.revoked_at.is_(None)` |

Python 的 `is None`/`is not None`/`not` 对 SQLAlchemy Column 返回 Python bool，不是 SQL 表达式，导致：
- admin_service.py: `bool & BinaryExpression` TypeError → 500
- share_service.py: `is None` 返回 Python bool 而非 SQL WHERE → 过滤失效 → max_shares 不生效、auto revoke 不触发、token 验证 404

原代码特意加了 `# noqa: E711` 注释，ruff `--fix` 把 noqa 删掉的同时也把代码改坏了。

## 失败测试分类

- **admin_stats**（6 个）：TypeError 500
- **share**（~27 个）：revoked_at 过滤失效，max_shares/auto_revoke/token_verify 全部失败
- **fts_content**（~10 个）：需确认是否也是同类问题
