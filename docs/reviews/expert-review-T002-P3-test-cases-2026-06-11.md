# T002 数据库迁移机制修复 — P3 测试用例评审

> 评审日期：2026-06-11
> 评审对象：`docs/tasks/T002-fix-db-migration/P3-test-cases.md` + `backend/tests/test_migration.py`
> 评审团：技术评审 + 测试评审 + 标准化评审
> 前置评审：`expert-review-T002-db-migration-2026-06-11.md`（P2 方案设计评审，阻塞项已全部修正）

---

## 评审结论

P3 测试用例设计覆盖了 P2 方案的 6 个 AC，TDD 导入失败符合预期。**但 test_migration.py 有 3 个阻塞项必须在 P4 实现前修正**：TC09 测试缺失、TC07 空结果无法验证迁移效果、`SchemaMismatchError` 导入模块与 P2 设计不一致。测试辅助函数重复 4 处，建议提取。

---

## 一、测试评审

### 发现 1（🔴 高危）：TC09「独立 commit 防止级联失败」未在代码中实现

**位置**：`P3-test-cases.md:116-123` 定义 TC09，但 `test_migration.py` 无对应测试方法

**现象**：测试用例文档列出 9 个测试用例，但 `test_migration.py` 的 `TestRunMigrations` 类只有 3 个方法：
- `test_adds_missing_is_admin`
- `test_query_after_migration`
- `test_migration_adds_entries_columns`

缺少 `test_independent_commits`。

**影响**：P2 设计明确要求「每个 DDL 后有独立 `conn.commit()`」，这是 AC6 的核心验证。如果没有这个测试，P4 实现时可能遗漏 per-DDL commit 逻辑。

**整改建议**：
```python
def test_independent_commits(self, tmp_path: Path):
    """Failed DDL should not block subsequent DDL operations."""
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)

    # Remove both columns to create migration surface
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS entries"))
        conn.execute(text("ALTER TABLE users RENAME TO users_old"))
        conn.execute(
            text(
                "CREATE TABLE users ("
                "  id INTEGER PRIMARY KEY,"
                "  username TEXT NOT NULL,"
                "  password_hash TEXT NOT NULL,"
                "  display_name TEXT,"
                "  is_active BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT"
                ")"
            )
        )
        conn.execute(
            text("INSERT INTO users SELECT id, username, password_hash,"
                 "  display_name, is_active, created_at, updated_at FROM users_old")
        )
        conn.execute(text("DROP TABLE users_old"))
        conn.commit()

    # Mock: first ALTER TABLE succeeds, second raises
    call_count = 0
    original_execute = engine.connect().__enter__().execute

    def failing_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 3:  # second ALTER TABLE
            raise Exception("Simulated DDL failure")
        return MagicMock()

    engine.dispose()  # restart fresh

    # Verify: migration completes without uncaught exception
    _run_migrations(engine)

    # Verify: first column was added (committed before failure)
    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        assert "is_admin" in columns
```

> 注意：上述测试使用 mock 方案较复杂，替代方案是改代码结构——让每个 DDL 包 try/except 并 log warning，然后测试 warning 输出。需在 P4 确认实现方案后调整。

**验证方式**：
- [ ] `grep "test_independent_commits" backend/tests/test_migration.py` 存在

---

### 发现 2（🔴 高危）：`test_query_after_migration` 空结果集导致假阳性

**位置**：`test_migration.py:150-189`

**现象**：
```python
# Line 185-188
with Session(engine) as session:
    users = session.exec(select(User)).all()  # 空列表
    for u in users:
        _ = u.is_admin  # 执行 0 次
```

测试创建了旧 schema（缺 is_admin）、运行迁移、然后查询 User。但 DB 中没有用户（init_db 创建空库，manual column remove 没有数据丢失因为本来就没数据），`select(User).all()` 返回 `[]`，for 循环不执行，测试永远通过。

**机理分析**：AC2 的验收标准是「执行 `peekview service restart` 后，`is_admin` 列被成功添加，**`user list` 正常工作**」。关键场景是**已有用户的生产 DB 升级后**，`select(User)` 能读到 `is_admin` 字段。空结果集无法验证这个场景。

**整改建议**：在创建旧 schema 前插入一条测试数据：

```python
def test_query_after_migration(self, tmp_path: Path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)

    # Insert a user BEFORE schema manipulation
    from peekview.auth import hash_password
    with Session(engine) as session:
        user = User(
            username="testuser",
            password_hash=hash_password("testpass123"),
            is_admin=False,
        )
        session.add(user)
        session.commit()
        # Verify user exists with is_admin accessible
        fetched = session.exec(select(User).where(User.username == "testuser")).one()
        assert fetched.is_admin is False

    engine.dispose()

    # Recreate engine to clear sessions, then remove column
    engine = init_db(db_path)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users RENAME TO users_old"))
        conn.execute(
            text(
                "CREATE TABLE users ("
                "  id INTEGER PRIMARY KEY,"
                "  username TEXT NOT NULL,"
                "  password_hash TEXT NOT NULL,"
                "  display_name TEXT,"
                "  is_active BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT"
                ")"
            )
        )
        conn.execute(
            text("INSERT INTO users SELECT id, username, password_hash,"
                 "  display_name, is_active, created_at, updated_at FROM users_old")
        )
        conn.execute(text("DROP TABLE users_old"))
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)")
        )
        conn.commit()

    # Migrate
    _run_migrations(engine)

    # MUST work with existing data
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        assert len(users) >= 1, "Expected at least one user after migration"
        for u in users:
            _ = u.is_admin  # must not raise KeyError
            _ = u.username
```

**验证方式**：
- [ ] 运行 `pytest backend/tests/test_migration.py::TestRunMigrations::test_query_after_migration -v`，断言 `len(users) >= 1` 通过

---

### 发现 3（🟡 中危）：`ALTER TABLE RENAME` 模式重复 4 次

**位置**：
- `test_migration.py:37-63` (TC02 — `test_missing_column_raises`)
- `test_migration.py:111-136` (TC06 — `test_adds_missing_is_admin`)
- `test_migration.py:155-179` (TC07 — `test_query_after_migration`)
- `test_migration.py:197-214` (TC08 — `test_migration_adds_entries_columns`)

**现象**：4 个测试方法各自硬编码了 `DROP TABLE / RENAME / CREATE TABLE / INSERT ... SELECT / DROP old` 的 DUMP-RELOAD 模式。每个方法里的 CREATE TABLE 都硬编码了所有列名。

**影响**：
- 如果 User 或 Entry 模型新增列（如 `last_login`），4 处 SQL 都需要更新
- 如果遗漏一处，该测试将产生**假阴性**（因新列缺失而失败）或**假阳性**（删除新列后测试仍通过，但未测试真正的 schema 差异）
- 维护成本随模型复杂度线性增长

**整改建议**：提取辅助函数：

```python
def _create_users_without_is_admin(engine):
    """Create users table without is_admin column (simulate pre-v0.1.26 schema)."""
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users RENAME TO users_old"))
        conn.execute(
            text(
                "CREATE TABLE users ("
                "  id INTEGER PRIMARY KEY,"
                "  username TEXT NOT NULL,"
                "  password_hash TEXT NOT NULL,"
                "  display_name TEXT,"
                "  is_active BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT"
                ")"
            )
        )
        conn.execute(
            text("INSERT INTO users SELECT id, username, password_hash,"
                 "  display_name, is_active, created_at, updated_at FROM users_old")
        )
        conn.execute(text("DROP TABLE users_old"))
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)")
        )
        conn.commit()


def _create_entries_without_owner_id(engine):
    """Create entries table without owner_id column."""
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS entries"))
        conn.execute(
            text(
                "CREATE TABLE entries ("
                "  id INTEGER PRIMARY KEY,"
                "  slug TEXT NOT NULL UNIQUE,"
                "  summary TEXT,"
                "  status TEXT DEFAULT 'active',"
                "  tags TEXT,"
                "  is_public BOOLEAN DEFAULT 1,"
                "  created_at TEXT,"
                "  updated_at TEXT,"
                "  expires_at TEXT"
                ")"
            )
        )
        conn.commit()
```

**验证方式**：
- [ ] 4 个测试方法都改用辅助函数，不再各自硬编码 CREATE TABLE
- [ ] 运行 `pytest backend/tests/test_migration.py -v` 全部通过

---

### 发现 4（🟡 中危）：测试调用私有函数 `_run_migrations` 而非公共 API

**位置**：`test_migration.py:139,182,217`

**现象**：3 个测试方法直接调用 `_run_migrations(engine)`，而不是通过 `init_db(db_path, run_migrations=True)`。

```python
# Line 18 — imports private function
from peekview.database import _run_migrations, check_schema, init_db, SchemaMismatchError

# Line 139 — direct call
_run_migrations(engine)

# Line 182
_run_migrations(engine)

# Line 217
_run_migrations(engine)
```

**机理分析**：P2 设计将 `init_db(run_migrations=True)` 作为唯一的公开迁移入口。`_run_migrations` 前导下划线表示私有。如果 P4 实现时改变了迁移的内部调用方式（比如在 `init_db` 内部拆分步骤），直接调用 `_run_migrations` 的测试将脱离真实调用路径。

**整改建议**：如果 P4 将 `_run_migrations` 作为 `init_db` 的内部实现细节，则测试应通过 `init_db(run_migrations=True)` 调用迁移。如果测试需要单独验证 `_run_migrations` 的行为（如 TC09 独立 commit），则在 P2 设计中明确标注该函数的可测试性，或将其重命名为公开函数 `run_migrations`。

最低要求：将 `_run_migrations` 提升为包内公开函数（去掉下划线），并在设计文档中记录理由。

**验证方式**：
- [ ] P2-design.md 中注明 `run_migrations` 的可见性决定
- [ ] 测试中要么改用 `init_db(run_migrations=True)`，要么 P2 明确 `_run_migrations` 升为公开 API

---

### 发现 5（🟡 中危）：现有测试数量文档标注错误

**位置**：`P3-test-cases.md:112`

**现象**：
```
确认所有 429 现有测试通过
```
实际 `pytest --collect-only -q` 收集到 **473** 个测试（不含 test_migration.py），差异 44 个。

**整改建议**：改为「确认所有现有测试通过」不标具体数字，或在实施 P4 时以实际 `pytest --collect-only` 输出为准。

---

### 发现 6（🟢 低危）：缺少 `check_schema()` 在原始空 SQLite 文件上的测试

**位置**：`P2-design.md:126-131` 定义了实现约束，但 `test_migration.py` 无对应测试

**设计约束**：
- 先查 `sqlite_master` 确认表存在
- 跳过未创建的表

**缺少的测试场景**：直接对一个没有任何表的原始 SQLite 文件调用 `check_schema(engine)`，验证不抛出异常。

```python
def test_empty_db_no_tables(self, tmp_path: Path):
    """Raw SQLite file with no tables should not raise."""
    from sqlalchemy import create_engine
    db_path = tmp_path / "empty.db"
    engine = create_engine(f"sqlite:///{db_path}")
    check_schema(engine)  # should not raise
```

**影响**：低。`init_db` 总是先 `create_all` 再 `check_schema`，生产路径不会触发。但作为单元测试边界条件，值得覆盖。

---

## 二、技术评审

### 发现 7（🔴 高危）：`SchemaMismatchError` 导入路径与 P2 设计不一致

**位置**：`test_migration.py:18` vs `P2-design.md:152-173`

**现象**：
```python
# test_migration.py:18 — imports from database.py
from peekview.database import _run_migrations, check_schema, init_db, SchemaMismatchError
```
```python
# P2-design.md:157 — 定义在 exceptions.py
# exceptions.py
class SchemaMismatchError(PeekError):
```

测试从 `peekview.database` 导入，设计说定义在 `exceptions.py`。

**影响**：如果 P4 实现者参照设计文档（exceptions.py），但测试从 database.py 导入，P4 完成后测试仍然 `ImportError`。两方必须统一。

**整改建议**：统一将 `SchemaMismatchError` 放在 `exceptions.py`（遵循项目异常体系），测试改为：
```python
from peekview.exceptions import PeekError, SchemaMismatchError
```

或者，如果 `check_schema()` 是 `SchemaMismatchError` 的唯一消费者，在 `database.py` 中 re-export：
```python
# database.py
from peekview.exceptions import SchemaMismatchError
__all__ = ["init_db", "check_schema", "SchemaMismatchError", ...]
```

建议用第一种方案（定义在 exceptions.py），测试从 exceptions 导入。

**验证方式**：
- [ ] `grep -n "SchemaMismatchError" backend/peekview/exceptions.py` 确认定义存在
- [ ] `grep -n "from peekview.database import.*SchemaMismatchError" backend/tests/test_migration.py` 改为从 exceptions 导入
- [ ] 或者 `database.py` 中 `from peekview.exceptions import SchemaMismatchError` 并 export

---

### 发现 8（🟢 低危）：`test_adds_missing_is_admin` 和 `test_migration_adds_entries_columns` 操纵 schema 后未调用 `engine.dispose()`

**位置**：`test_migration.py:106-148`, `test_migration.py:192-226`

**现象**：`test_adds_missing_is_admin` 在末尾调用了 `engine.dispose()`，但 `test_migration_adds_entries_columns` 也在末尾调用了。两者都正确。但 `test_query_after_migration` 调用 `engine.dispose()` 两次（line 174 和 line 190）。这不是 bug，但暗示代码不够一致。

实际上重看代码，`test_query_after_migration` 确实在 line 173 `engine.dispose()` 后又在 line 174 重新 `init_db`，然后在 line 190 再次 `engine.dispose()`。这没问题，因为 line 173 的 dispose 是分离第一个 engine。

**结论**：无实际问题。但建议所有测试统一在 teardown 用 try/finally 或 pytest fixture 管理 engine 生命周期。

---

## 三、标准化评审

### 发现 9（🟢 低危）：P3 文档引用路径中的 test 文件位置模糊

**位置**：`P3-test-cases.md:36,48,59` 等

**现象**：测试用例文档中引用测试路径为 `backend/tests/test_migration.py::ClassName::method_name`，格式正确。但 `check_schema` 的测试都在 `TestCheckSchema` 类中，而 TC01-TC04 的映射关系需确认：

| TC | 文档声称的测试 | 实际方法 | 匹配 |
|----|---------------|----------|------|
| TC01 | `TestCheckSchema::test_clean_db_no_error` | L26-30 | ✅ |
| TC02 | `TestCheckSchema::test_missing_column_raises` | L32-71 | ✅ |
| TC03 | `TestCheckSchema::test_error_inheritance` | L73-75 | ✅ |
| TC04 | `TestCheckSchema::test_error_message_hint` | L77-80 | ✅ |
| TC05 | `TestInitDb::test_no_migrations_when_false` → 实际名 `test_default_is_no_migrations` | L86-92 | ⚠️ 名称不一致 |
| TC06 | `TestRunMigrations::test_adds_missing_is_admin` | L106-148 | ✅ |
| TC07 | `TestRunMigrations::test_query_after_migration` | L150-189 | ✅ |
| TC08 | 回归测试（运行全量） | — | 无对应代码方法 |
| TC09 | `TestRunMigrations::test_independent_commits` | 缺失 | ❌ |

**修改建议**：TC05 文档方法名改为 `test_default_is_no_migrations`，或代码方法名改为 `test_no_migrations_when_false`。两种都可以，但须一致。

---

## 四、测试通过项

| 检查项 | 结论 |
|--------|------|
| TC01-TC04 覆盖 `check_schema()` 的 happy path / error path / 继承链 / 消息 | ✅ 通过 |
| TC05-TC06 覆盖 `init_db(run_migrations=)` 参数控制 | ✅ 通过 |
| TC07-TC08 覆盖迁移后查询可用性 | ⚠️ TC07 需修，TC08 无代码 |
| `SchemaMismatchError` 的 status_code / error_code / 多表消息 测试 | ✅ 通过（`TestSchemaMismatchError` 3 个方法） |
| TDD 导入失败符合预期（`check_schema` / `SchemaMismatchError` 尚未实现） | ✅ 预期行为 |
| 测试文件使用项目现有 fixtures（`tmp_path`） | ✅ 通过 |

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 测试覆盖 | 6/10 | TC09 缺失，TC07 假阳性，空库/全空表场景未覆盖 |
| 测试代码质量 | 5/10 | ALTER TABLE RENAME 重复 4 次，直接调用私有函数，import 路径不一致 |
| 文档一致性 | 6/10 | TC05 方法名不匹配，测试总数 429→473 过时 |
| 标准化 | 7/10 | 模块/类/方法命名符合 pytest 约定，import 路径需统一 |
| 整体 | **6.0/10** | |

---

## 待办

### 阻塞项（P4 实现前必须修）
- [x] **发现 1**：补全 TC09 `test_independent_commits` 测试方法
- [x] **发现 2**：`test_query_after_migration` 插入测试用户后再验证 `is_admin` 可访问
- [x] **发现 7**：`SchemaMismatchError` 导入路径统一 — 测试已改为 `from peekview.exceptions import`，实际定义待 P4 在 `exceptions.py` 中添加

### 建议项
- [x] **发现 3**：提取 `_create_users_without_is_admin()` / `_create_entries_without_owner_id()` 辅助函数，消除 4 处重复
- [ ] **发现 4**：确定 `_run_migrations` 可见性（保留私有 vs 升为 public），更新测试调用方式
- [x] **发现 5**：P3-test-cases.md 移除硬编码测试总数，或更新为 473
- [x] **发现 6**：补充 `check_schema()` 对空 SQLite 文件（无表）的测试
- [x] **发现 9**：TC05 方法名 `test_default_is_no_migrations` → `test_no_migrations_when_false`（或反过来）
