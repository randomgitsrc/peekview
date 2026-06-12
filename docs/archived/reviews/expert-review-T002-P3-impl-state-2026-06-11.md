# T002 数据库迁移机制修复 — P3 实现状态评审

> 评审日期：2026-06-11
> 评审对象：`database.py` + `exceptions.py` + `test_migration.py` + `P3-test-cases.md`（修订后版本）
> 评审团：技术评审 + 测试评审 + 标准化评审
> 前置评审：`expert-review-T002-P3-test-cases-2026-06-11.md`（P3 初版评审，9 个发现）

---

## 评审结论

上次评审 9 个发现中，6 个已修正、1 个部分修正、2 个未修正。`SchemaMismatchError` 已正确落入 `exceptions.py` 并继承 `PeekError`；辅助函数消除了 4 处重复；TC07 假阳性已修。**新发现 2 个阻塞项**：`test_independent_commits` 实为 TC06 的重复（未测部分失败场景）；该测试中无意义的 `engine.dispose()` 误导读者。TDD 失败分布正确（5 fail / 9 pass），P4 可进入实现。

---

## 前序发现闭环

| # | 发现 | 严重度 | 状态 | 验证 |
|---|------|--------|------|------|
| 1 | TC09 缺失 | 🔴 | ✅ 已修 | `test_independent_commits` L202-217 存在 |
| 2 | TC07 空结果假阳性 | 🔴 | ✅ 已修 | L162-169 插入测试用户，L177 `assert len(users) >= 1` |
| 3 | `SchemaMismatchError` import 路径 | 🔴 | ✅ 已修 | L19 `from peekview.exceptions import SchemaMismatchError`；`exceptions.py:200-215` 定义 |
| 4 | ALTER TABLE RENAME 重复 4 次 | 🟡 | ✅ 已修 | L23-48 `_create_users_without_is_admin`，L51-70 `_create_entries_without_owner_id` |
| 5 | 测试总数 429 过时 | 🟡 | ❌ 未修 | `P3-test-cases.md:112` 仍写 "429"，实际 487 |
| 6 | 缺空 SQLite 文件测试 | 🟢 | ✅ 已修 | L106-112 `test_empty_db_no_tables` |
| 7 | TC05 方法名不一致 | 🟢 | ✅ 已修 | 代码 L118 `test_no_migrations_when_false`，文档 L80 一致 |
| 8 | `_run_migrations` 私有调用 | 🟡 | ⚠️ 保留 | L18 仍从 database 导入并直接调用。上轮为建议项，非阻塞 |
| 9 | TC09 实现质量 | — | ❌ 未修 | 见发现 10（本轮升级为阻塞项） |

---

## 一、测试评审

### 发现 10（🔴 高危）：`test_independent_commits` 未测试「部分 DDL 失败」场景

**位置**：`test_migration.py:202-217`

**现象**：
```python
def test_independent_commits(self, tmp_path: Path):
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)
    _create_users_without_is_admin(engine)
    engine.dispose()
    _run_migrations(engine)
    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        assert "is_admin" in columns
    engine.dispose()
```

此测试与 `test_adds_missing_is_admin`（L138-153）逻辑完全相同：创建缺 `is_admin` 的旧 schema → 运行迁移 → 验证列存在。**没有任何模拟 DDL 失败的逻辑**。

**P3-test-cases.md TC09 定义**：
> 1. Mock `_run_migrations` 中第一个 `ALTER TABLE` 抛异常
> 2. 验证后续 `ALTER TABLE` 仍被尝试执行
> 3. 验证每次 DDL 后有 `conn.commit()` 调用

代码未实现 TC09 的步骤 1-3。

**机理分析**：TC09 要验证的是「per-DDL commit 防止级联失败」——即如果 `ALTER TABLE entries ADD COLUMN is_public` 失败，`ALTER TABLE users ADD COLUMN is_admin` 仍应成功执行。当前测试只验证了「全部 DDL 成功」的 happy path，这已被 TC06 覆盖。

**整改建议**：此测试需要真正模拟部分失败。两种方案：

**方案 A**：在 `_run_migrations` 实现中，将每个 DDL 包在 try/except 中并 log warning（P4 实现时决定），然后测试 warning 日志输出。

**方案 B**：构造一个 DB 状态使得第一个 DDL 无事可做（列已存在）但第二个 DDL 需要执行，验证第二个仍被执行：

```python
def test_independent_commits(self, tmp_path: Path):
    """DDL operations are independent — entries columns present, users column missing."""
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)

    # entries has all columns (including is_public, owner_id)
    # but users is missing is_admin
    _create_users_without_is_admin(engine)

    _run_migrations(engine)

    # entries columns unchanged (already present), users.is_admin added
    with engine.connect() as conn:
        user_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        assert "is_admin" in user_cols

        entry_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))}
        assert "is_public" in entry_cols
        assert "owner_id" in entry_cols

    engine.dispose()
```

这比当前版本更有价值：它验证了「entries 迁移跳过（列已存在）+ users 迁移执行」的混合场景，而非重复 happy path。

**验证方式**：
- [ ] `test_independent_commits` 不再与 `test_adds_missing_is_admin` 逻辑相同
- [ ] 测试覆盖「部分 DDL 跳过 + 部分 DDL 执行」场景

---

### 发现 11（🟡 中危）：`test_independent_commits` 中无意义的 `engine.dispose()`

**位置**：`test_migration.py:209`

**现象**：
```python
engine = init_db(db_path)          # L205
_create_users_without_is_admin(engine)  # L207
engine.dispose()                   # L209 ← 无意义
_run_migrations(engine)            # L211 ← dispose 后仍可用
```

**机理分析**：SQLAlchemy `Engine.dispose()` 关闭所有池中连接但不阻止新连接创建。所以 L211 的 `_run_migrations(engine)` 可以正常工作。但 `dispose()` 在此处无任何作用——它不释放资源（测试结束 pytest 会清理 tmp_path），不改变 engine 行为，不模拟任何生产场景。

**影响**：误导读者以为 dispose 后 engine 不可用，或以为 dispose 是测试的必要步骤。

**整改建议**：删除 L209 的 `engine.dispose()`。如果意图是「清除连接池以模拟新进程连接」，应加注释说明。

---

### 发现 12（🟡 中危）：P3-test-cases.md 测试总数仍过时

**位置**：`P3-test-cases.md:112`

**现象**：仍写「确认所有 429 现有测试通过」，实际 `pytest --collect-only` 为 487 个测试（不含 test_migration.py）。

**整改建议**：改为「确认所有现有测试通过」，不硬编码数字。

---

## 二、技术评审

### `database.py` 实现状态

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `check_schema()` stub 存在 | ✅ | L35-40，`raise NotImplementedError`，P4 实现 |
| `init_db` 签名未变 | ✅ TDD | L108 仍为 `init_db(db_path)`，P4 加 `run_migrations` 参数 |
| `_run_migrations` 未改 | ✅ | L43-105 不变，P4 加 per-DDL commit |
| `SchemaMismatchError` 不在 database.py | ✅ | 正确放在 exceptions.py |

### `exceptions.py` 实现状态

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `SchemaMismatchError` 继承 `PeekError` | ✅ | L200 |
| `status_code = 500` | ✅ | L203 |
| `error_code = "SCHEMA_MISMATCH"` | ✅ | L204 |
| `missing_columns` 结构化属性 | ✅ | L206 |
| 错误消息含升级指引 | ✅ | L212-213，含 `peekview service restart` + 非 service 提示 |

### TDD 失败分析

```
5 failed, 9 passed
```

| 失败测试 | 失败原因 | TDD 预期？ |
|----------|----------|-----------|
| `test_clean_db_no_error` | `NotImplementedError` (check_schema stub) | ✅ 是 |
| `test_missing_column_raises` | `NotImplementedError` (check_schema stub) | ✅ 是 |
| `test_empty_db_no_tables` | `NotImplementedError` (check_schema stub) | ✅ 是 |
| `test_no_migrations_when_false` | `_run_migrations` 被调用了（init_db 未参数化） | ✅ 是 |
| `test_run_migrations_true_calls_migrate` | `TypeError` (run_migrations 参数不存在) | ✅ 是 |

所有 5 个失败都是 P4 待实现功能导致的，无意外失败。**9 个通过的测试**验证了：
- `SchemaMismatchError` 继承链、status_code、error_code、多表消息（4 个）
- `_run_migrations` 对旧 schema 的实际迁移效果（3 个：is_admin / query / entries columns）
- `test_independent_commits`（1 个，但见发现 10）
- `test_error_inheritance` + `test_error_message_hint`（已计入上面 4 个）

---

## 三、标准化评审

### 发现 13（🟢 低危）：`test_migration.py` L18 仍导入 `_run_migrations`

**位置**：`test_migration.py:18`

**现象**：
```python
from peekview.database import _run_migrations, check_schema, init_db
```

前序发现 8 标记为「建议项」。当前 4 个测试方法直接调用 `_run_migrations`（L145, L173, L191, L211）。

**分析**：在 TDD 阶段，直接测试 `_run_migrations` 是合理的——它是迁移逻辑的核心单元，需要独立验证。P4 实现后，如果 `init_db(run_migrations=True)` 成为唯一公开入口，可考虑将 `_run_migrations` 测试改为通过 `init_db` 间接调用。但当前阶段可接受。

**结论**：保留为建议项，不阻塞。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 前序发现闭环 | 8/10 | 9 个发现中 6 个完全修正，1 个部分修正（TC09→发现 10），2 个未修（测试总数、私有调用） |
| 测试代码质量 | 7/10 | 辅助函数提取好；TC09 仍为重复逻辑；dispose 误导 |
| TDD 状态 | 9/10 | 5 fail 均为 P4 预期失败，9 pass 验证已有逻辑 |
| 实现一致性 | 9/10 | `SchemaMismatchError` 正确落入 exceptions.py，check_schema stub 位置正确 |
| 整体 | **8.2/10** | |

---

## 待办

### 阻塞项（P4 实现前必须修）
- [ ] **发现 10**：`test_independent_commits` 改为测试「部分 DDL 跳过 + 部分 DDL 执行」混合场景，不再重复 TC06

### 建议项
- [ ] **发现 11**：删除 `test_independent_commits` 中无意义的 `engine.dispose()`
- [ ] **发现 12**：P3-test-cases.md 移除硬编码测试总数 429
- [ ] **发现 13**：P4 完成后评估 `_run_migrations` 测试是否改为通过 `init_db(True)` 间接调用
