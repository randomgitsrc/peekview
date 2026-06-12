---
phase: P4
task_id: T002-fix-db-migration
parent: T002/P3-test-cases.md
trace_id: T002-P4-20260612
---

# P4：实现 — 数据库迁移机制修复

## 改动清单

### 1. `backend/peekview/exceptions.py` (+15)

新增 `SchemaMismatchError` 异常类，继承 `PeekError`：
- `status_code = 500`
- `error_code = "SCHEMA_MISMATCH"`
- `__init__(missing_columns: dict[str, list[str]])` — 构造包含升级指引的错误消息

### 2. `backend/peekview/database.py` (+50, ~15)

**`_run_migrations`**：每个 ALTER TABLE / CREATE INDEX 后添加独立 `conn.commit()`，防止级联失败。

**`check_schema(engine) -> None`**（新增函数）：
- 从 `sqlite_master` 读取现有表名
- 遍历 `SQLModel.metadata.tables`，跳过未创建的表和 FTS 虚拟表
- 对每个存在的表：`PRAGMA table_info` vs 模型列对比
- 如有缺失列 → raise `SchemaMismatchError`

**`init_db`**：新增 `run_migrations: bool = False` 参数，`True` 时调用 `_run_migrations`（Server 启动路径），默认 `False`（CLI 路径）。

### 3. `backend/peekview/cli.py` (~8)

- `import` 新增 `check_schema`
- `serve_command`：`init_db(config.db_path, run_migrations=True)`
- `_get_backend` + `user_create` + `user_list` + `user_promote` + `user_demote`：`init_db` 后调用 `check_schema(engine)`

### 4. `backend/peekview/main.py` (1)

- `create_app`：`init_db(config.db_path, run_migrations=True)`（`lifespan` 保持默认 `False`）

## 验证结果

### 迁移测试（14/14 passed）

```
python3 -m pytest backend/tests/test_migration.py -v
```

| 测试 | 状态 |
|------|------|
| TestCheckSchema::test_clean_db_no_error | PASSED |
| TestCheckSchema::test_missing_column_raises | PASSED |
| TestCheckSchema::test_error_inheritance | PASSED |
| TestCheckSchema::test_error_message_hint | PASSED |
| TestCheckSchema::test_empty_db_no_tables | PASSED |
| TestInitDb::test_no_migrations_when_false | PASSED |
| TestInitDb::test_run_migrations_true_calls_migrate | PASSED |
| TestRunMigrations::test_adds_missing_is_admin | PASSED |
| TestRunMigrations::test_query_after_migration | PASSED |
| TestRunMigrations::test_migration_adds_entries_columns | PASSED |
| TestRunMigrations::test_independent_commits | PASSED |
| TestSchemaMismatchError::test_status_code | PASSED |
| TestSchemaMismatchError::test_error_code | PASSED |
| TestSchemaMismatchError::test_multiple_tables | PASSED |

### 回归测试（429 passed, 1 skipped, 无新增失败）

```
python3 -m pytest backend/tests/ --ignore=backend/tests/test_migration.py --ignore=backend/tests/test_cli_remote.py --ignore=backend/tests/test_apikey.py -q
```

429 passed, 1 skipped（预先存在的 skip），0 failed。无回归。
