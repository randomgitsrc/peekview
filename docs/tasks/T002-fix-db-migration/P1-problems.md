---
phase: P1
task_id: T002
task_name: fix-db-migration
type: problems
trace_id: T002-P1-20250611
created: 2026-06-11
status: draft
parent: 用户报告 (生产环境 `peekview user list` 崩溃)
---

# P1：问题定义 — 数据库迁移机制失效

## 问题清单

### Issue 1：生产环境 `peekview user list` 崩溃

**现象**：
```
$ peekview user list
Users (17):
KeyError: 'is_admin'
```

生产环境 `~/.peekview/peekview.db` 的 `users` 表缺少 `is_admin` 列，导致 `select(User)` 查询失败。

**影响范围**：所有访问 `User.is_admin` 的 CLI 命令（`user list`, `user promote`, `user demote`）。

**根因分析**：
- 生产数据库是在 v0.1.25 之前创建的，当时 `users` 表没有 `is_admin` 列
- v0.1.26 引入了 `_run_migrations()` 自动补列机制，每次 `init_db()` 调用时执行
- 迁移代码使用 `ALTER TABLE users ADD COLUMN is_admin`，这需要 SQLite **EXCLUSIVE lock**
- 如果服务正在运行并持有连接，`ALTER TABLE` 可能在 `busy_timeout`（5秒）后超时失败
- 原迁移代码无 error handling：`ALTER TABLE` 失败 → 静默跳过 → 后续 query 崩溃

### Issue 2：迁移执行权责错位（核心架构问题）

**现象**：`init_db()` 在 CLI 命令中也执行迁移，但 CLI 不具备排他锁能力。

**根因**：
- Server 是数据库的唯一长期持有者，具备迁移的排他条件
- CLI 命令（`user list`、`entry create` 等）是临时访问者，随时可能与 Server 竞争锁
- 当前架构将迁移职责同时交给了 Server 和 CLI → 谁先抢到锁谁成功，但 CLI 大概率抢不过 Server
- **根本矛盾**：迁移需要排他锁，但 CLI 无法获取排他锁（Server 持有连接）

### Issue 3：未来新增列同样会失败

**现象**：任何通过 `_run_migrations()` 添加的新列，在 Server 运行时都无法生效。

**影响**：每次数据库 schema 变更，用户都会遇到类似 Issue 1 的故障。这不是一次性的 bug，是系统性缺陷。

---

## 验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| AC1 | 生产环境执行 `peekview service restart` 后，`is_admin` 列被成功添加，`user list` 正常工作 | 手工验证 |
| AC2 | 未来新增列时，Server 启动自动补列，无需用户手动操作 | 单元测试 |
| AC3 | Server 运行时，CLI 命令不会因 schema 过期而崩溃 | 单元/E2E 测试 |
| AC4 | CLI 在 schema 过期时给出明确的升级指引（不是 KeyError traceback） | 集成测试 |
| AC5 | 新创建的数据库（`init_db`）结构完整，无需额外迁移步骤 | 现有测试持续通过 |
| AC6 | `busy_timeout` 导致的迁移失败有明确日志和重试策略 | 单元测试 |
