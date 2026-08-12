---
phase: P3
task_id: T002
task_name: fix-db-migration
type: test-cases
trace_id: T002-P3-20250611
created: 2026-06-11
status: ready
parent: T002/P2-design.md
---

# P3：测试用例 — 数据库迁移机制修复

## 测试用例清单

| ID | 描述 | 测试层级 | 预期结果 | 对应 AC |
|----|------|----------|----------|---------|
| TC01 | 空库 `check_schema` 不报错 | 单元 | 不抛出异常 | AC5 |
| TC02 | 缺失列时 `check_schema` 抛出 `SchemaMismatchError` | 单元 | raise SchemaMismatchError | AC3 |
| TC03 | `SchemaMismatchError` 是 `PeekError` 子类 | 单元 | issubclass 为 True | — |
| TC04 | `SchemaMismatchError` 错误消息包含升级指引 | 单元 | 消息含 "peekview service restart" | AC4 |
| TC05 | `init_db(run_migrations=False)` 不执行迁移 | 单元 | 迁移函数未被调用 | AC3 |
| TC06 | `init_db(run_migrations=True)` 在旧库上补全缺失列 | 集成 | 列被成功添加 | AC2 |
| TC07 | `init_db(run_migrations=True)` 后 `select(User)` 正常工作 | 集成 | 无 KeyError | AC2 |
| TC08 | 现有测试套件全部通过（回归验证） | 回归 | 无新增失败 | AC5 |
| TC09 | 迁移中一个 DDL 失败不影响后续 DDL（独立 commit） | 单元 | 后续 DDL 正常执行 | AC6 |

## TC01：空库 check_schema 不报错

**测试步骤**：
1. 创建临时 SQLite 文件
2. 调用 `init_db(tmp_path)` 创建完整 schema
3. 调用 `check_schema(engine)`
4. 验证不抛出异常

**测试文件**：`backend/tests/test_migration.py::TestCheckSchema::test_clean_db_no_error`

---

## TC02：缺失列时抛出 SchemaMismatchError

**测试步骤**：
1. 创建临时 SQLite 文件，手工 `CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)`（模拟旧库）
2. 调用 `check_schema(engine)`
3. 验证 `SchemaMismatchError` 被抛出
4. 验证 `missing_columns` 字典包含缺失列名

**测试文件**：`backend/tests/test_migration.py::TestCheckSchema::test_missing_column_raises`

---

## TC03：SchemaMismatchError 继承链

**测试步骤**：
1. `import SchemaMismatchError`
2. 验证 `issubclass(SchemaMismatchError, PeekError)` 为 True
3. 验证实例化不报错

**测试文件**：`backend/tests/test_migration.py::TestCheckSchema::test_error_inheritance`

---

## TC04：错误消息升级指引

**测试步骤**：
1. 构造 `SchemaMismatchError({"users": ["is_admin"]})`
2. 验证 `str(err)` 包含 "peekview service restart"

**测试文件**：`backend/tests/test_migration.py::TestCheckSchema::test_error_message_hint`

---

## TC05：init_db(run_migrations=False) 不执行迁移

**测试步骤**：
1. Mock `_run_migrations` 函数
2. 调用 `init_db(tmp_path, run_migrations=False)`
3. 验证 `_run_migrations` 未被调用

**测试文件**：`backend/tests/test_migration.py::TestInitDb::test_no_migrations_when_false`

---

## TC06：迁移补全缺失列

**测试步骤**：
1. 创建临时 SQLite 文件，手工创建不含 `is_admin` 的 users 表
2. 调用 `init_db(tmp_path, run_migrations=True)`
3. 通过 `PRAGMA table_info(users)` 验证 `is_admin` 列已添加

**测试文件**：`backend/tests/test_migration.py::TestRunMigrations::test_adds_missing_is_admin`

---

## TC07：迁移后查询正常

**测试步骤**：
1. 创建含旧 schema 的临时库（缺 `is_admin`）
2. `init_db(tmp_path, run_migrations=True)`
3. `Session(engine).exec(select(User)).all()` 不抛出 KeyError

**测试文件**：`backend/tests/test_migration.py::TestRunMigrations::test_query_after_migration`

---

## TC08：回归测试

**测试步骤**：
1. 运行完整测试套件
2. 确认所有现有测试通过

**验证命令**：`python3 -m pytest backend/tests/ -x --ignore=backend/tests/test_apikey.py --ignore=backend/tests/test_cli_remote.py`

---

## TC09：独立 commit 防止级联失败

**测试步骤**：
1. Mock `_run_migrations` 中第一个 `ALTER TABLE` 抛异常
2. 验证后续 `ALTER TABLE` 仍被尝试执行
3. 验证每次 DDL 后有 `conn.commit()` 调用

**测试文件**：`backend/tests/test_migration.py::TestRunMigrations::test_independent_commits`

---

## v3 门槛验证（真红灯确认）

**测试文件**：`backend/tests/test_migration.py`（14 个测试）

**验证命令**：`python3 -m pytest backend/tests/test_migration.py -v`

**验证结果（2026-06-12）**：
- 可收集：14/14 ✅（无 import error / collection error）
- 真红灯：5 失败（全部因 P4 实现缺失导致）✅
  - 3× `check_schema` → `NotImplementedError`（P4 未实现）
  - `test_no_migrations_when_false` → `AssertionError`（`init_db` 未加 `run_migrations` 参数）
  - `test_run_migrations_true_calls_migrate` → `TypeError`（同上）
- 通过：9/14（`SchemaMismatchError` stub 类测试 + 现有 `_run_migrations` 功能）
- 无 import error / collection error / 语法错误 ✅

**结论**：P3→P4 门槛满足（真红灯）。
