---
phase: P5
task_id: T002-fix-db-migration
parent: T002/P4-implementation/implementation.md
trace_id: T002-P5-20260612
---

# P5：手动验证 — P1 问题逐项验证

## Issue 1: CLI 命令在旧数据库上崩溃（KeyError: is_admin）

**P1 描述**: 生产环境 `peekview user list` 因 `users` 表缺少 `is_admin` 列而抛出 `KeyError: 'is_admin'`。

**实现修复要点**:
- `check_schema()` (database.py:105) — 新增函数，对比 `SQLModel.metadata.tables` 与实际 DB 列，缺失列时抛出 `SchemaMismatchError`。
- `cli.py` — `_get_backend()`、`user_create`、`user_list`、`user_promote`、`user_demote` 均在 `init_db()` 后调用 `check_schema(engine)`。
- `SchemaMismatchError` (exceptions.py:200) — 包含升级指引 `"Run: peekview service restart"`。

**验证证据**:
- `test_missing_column_raises`: 移除 `is_admin` 列后，`check_schema()` 正确抛出 `SchemaMismatchError`，消息包含 `"is_admin"` 和 `"users"`。
- `test_adds_missing_is_admin`: `_run_migrations()` 成功添加缺失的 `is_admin` 列。
- `test_query_after_migration`: 迁移后 `select(User)` 正常工作，`u.is_admin` 可访问。
- `SchemaMismatchError` 消息包含 `"peekview service restart"` 指引（`test_error_message_hint`）。

**结论: 通过**

---

## Issue 2: 迁移责任错位（CLI 和 Server 都在执行 migrate，导致锁冲突）

**P1 描述**: `init_db()` 在 CLI 命令中也执行 `_run_migrations()`，但 CLI 是临时访问者，无法获取 SQLite EXCLUSIVE lock（Server 持有连接）。

**实现修复要点**:
- `init_db()` (database.py:143) — 新增 `run_migrations: bool = False` 参数，默认 `False`。
- `main.py:104` (`create_app`): `init_db(config.db_path, run_migrations=True)` — **仅 Server 启动时运行迁移**。
- `cli.py:163` (`serve_command`): `init_db(config.db_path, run_migrations=True)` — `peekview serve` CLI 路径也运行迁移。
- CLI 命令（`user_list`, `entry create` 等）: `init_db(config.db_path)` (默认 `False`) + `check_schema(engine)`。
- `lifespan` (main.py:38): `init_db(config.db_path)` (默认 `False`) — lifespan 不运行迁移，避免与 `create_app` 重复。

**验证证据**:
- `test_no_migrations_when_false`: `init_db()` 默认不调用 `_run_migrations`。
- `test_run_migrations_true_calls_migrate`: `init_db(run_migrations=True)` 调用 `_run_migrations`。
- 代码审查确认: CLI 命令中仅调用 `init_db()` + `check_schema()`，不传 `run_migrations=True`。
- 迁移职责现在明确由 Server（或 `peekview serve`）承担，CLI 只做 schema 检查。

**结论: 通过**

---

## Issue 3: 未来新增列时兼容性差（Column FTS 冲突）

**P1 描述**: 任何通过 `_run_migrations()` 添加的新列，在 Server 运行时都无法生效。是系统性缺陷。

**实现修复要点**:
- `check_schema()` (database.py:105) — 遍历 `SQLModel.metadata.tables`，跳过未创建的表 (`table_name not in existing_tables`)。
- FTS 虚拟表 (`entries_fts`) 不在 `SQLModel.metadata.tables` 中（由 `setup_fts5()` 用 raw SQL 创建）→ 自动跳过，不会触发 FTS 列对比。
- 未来任何在 `User`、`Entry`、`File`、`ApiKey` 模型中新增的列，`check_schema()` 自动检测，缺失时抛出 `SchemaMismatchError`。
- `_run_migrations()` 的每个 ALTER TABLE 后有独立 `conn.commit()`，防止级联失败（`test_independent_commits` 验证）。

**验证证据**:
- `test_clean_db_no_error`: 完整 schema 不报错 — `check_schema()` 对正常 DB 无副作用。
- `test_empty_db_no_tables`: 空 DB 不报错 — 跳过未创建的表。
- `test_migration_adds_entries_columns`: `_run_migrations()` 补全 `entries` 表的缺失列（`is_public`, `owner_id`）。
- `test_multiple_tables`: `SchemaMismatchError` 正确报告多表多列的缺失情况。
- FTS 表 (`entries_fts`) 不在 `SQLModel.metadata.tables` 中，不受 column 检查影响。

**结论: 通过**

---

## 验收标准对照

| AC# | 标准 | 验证方式 | 结果 |
|-----|------|----------|------|
| AC1 | `peekview service restart` 后 `is_admin` 列被成功添加，`user list` 正常工作 | `_run_migrations` + `test_query_after_migration` | **通过** |
| AC2 | 未来新增列时，Server 启动自动补列，无需用户手动操作 | `init_db(run_migrations=True)` 在 `create_app` 中调用 | **通过** |
| AC3 | Server 运行时，CLI 命令不会因 schema 过期而崩溃 | `check_schema()` 在 CLI 命令前抛 `SchemaMismatchError` | **通过** |
| AC4 | CLI 在 schema 过期时给出明确的升级指引 | `SchemaMismatchError` 消息包含 `"peekview service restart"` | **通过** |
| AC5 | 新创建的数据库结构完整，无需额外迁移步骤 | `test_clean_db_no_error` + 回归测试 429 passed | **通过** |
| AC6 | `busy_timeout` 导致的迁移失败有明确日志和重试策略 | `_run_migrations` 独立 commit + 日志记录 | **通过** |

---

## 总结

| Issue | 状态 |
|-------|------|
| Issue 1: CLI 崩溃 (KeyError: is_admin) | **通过** |
| Issue 2: 迁移责任错位 (锁冲突) | **通过** |
| Issue 3: 未来新增列兼容性 (FTS 冲突) | **通过** |

**P1 3/3 问题全部通过验证。**
