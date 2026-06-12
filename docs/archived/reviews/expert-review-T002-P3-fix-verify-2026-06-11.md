# T002 P3 修改验证评审

> 评审日期：2026-06-11
> 评审对象：commit `8a51ca65` — fix(T002-P3): 修复 P3 评审阻塞项
> 评审团：技术评审 + 测试评审
> 前置评审：`expert-review-T002-P3-impl-state-2026-06-11.md`

---

## 评审结论

本次提交修复了前序评审 9 个发现中的 6 个，方向正确。**但引入了一个回归**：`check_schema` 在 `database.py` 中不存在（从未提交），导致整个 `test_migration.py` 无法被 pytest 收集——不是 TDD 预期失败，而是 import-level 错误，比预期更严重。另外 `test_independent_commits` 仍然是 TC06 的重复（前序阻塞项未修）。两个阻塞项必须修正后才能进入 P4。

---

## 前序发现闭环

| # | 发现 | 状态 | 验证 |
|---|------|------|------|
| 1 | TC09 缺失 | ⚠️ 部分修 | 方法存在(L199-215)，但逻辑重复 TC06，未测部分失败 |
| 2 | TC07 空结果假阳性 | ✅ 已修 | L153-178 插入测试用户，`assert len(users) >= 1` |
| 3 | `SchemaMismatchError` import 路径 | ✅ 已修 | L19 `from peekview.exceptions import` |
| 4 | ALTER TABLE RENAME 重复 4 次 | ✅ 已修 | L23-48 + L51-70 辅助函数提取 |
| 5 | 测试总数 429 过时 | ✅ 已修 | P3-test-cases.md 改为「确认所有现有测试通过」 |
| 6 | 缺空 SQLite 文件测试 | ✅ 已修 | L106-112 `test_empty_db_no_tables` |
| 7 | TC05 方法名不一致 | ✅ 已修 | `test_no_migrations_when_false` |
| 8 | `_run_migrations` 私有调用 | — 保留 | 非阻塞 |
| 9 | TC09 实现质量 | ❌ 未修 | 仍为 TC06 重复（见发现 14） |

---

## 一、回归：测试文件无法被 pytest 收集

### 发现 14（🔴 高危）：`check_schema` 未在 `database.py` 中声明，导致整个测试文件 import 失败

**位置**：`test_migration.py:18`

**现象**：
```
$ pytest backend/tests/test_migration.py -v
E   ImportError: cannot import name 'check_schema' from 'peekview.database'
```

整个文件 14 个测试方法均无法收集。不是 TDD「测试方法运行失败」，而是 **pytest 无法加载测试模块**。

**机理分析**：`database.py` 自 v0.1.26 以来从未添加 `check_schema` 函数。前序评审中看到的 `check_schema` stub（`raise NotImplementedError`）可能是工作区临时修改，但未随 `8a51ca65` 提交。

TDD 的正确做法是：先在 `database.py` 添加 stub，让测试文件可以 import，然后测试方法运行时因 stub 而失败（fail for the right reason）。当前状态是 fail at import level——这比预期更严重，因为：
1. 所有其他测试文件也会因 `--collect-only` 中断而无法计数
2. IDE 无法识别测试方法，无法单独运行
3. 无法区分「测试代码写错」和「功能代码未实现」

**整改建议**：在 `database.py` 中添加 `check_schema` stub：

```python
def check_schema(engine: Engine) -> None:
    """Compare actual DB columns against SQLModel metadata expectations.

    Raises SchemaMismatchError if any expected columns are missing.
    """
    raise NotImplementedError("check_schema() not yet implemented (P4)")
```

**验证方式**：
- [ ] `python3 -m pytest backend/tests/test_migration.py --collect-only -q` 成功收集 14 个测试
- [ ] `python3 -m pytest backend/tests/ --collect-only -q` 不再报 import error

---

## 二、前序阻塞项未修

### 发现 15（🔴 高危）：`test_independent_commits` 仍为 TC06 重复

**位置**：`test_migration.py:199-215`

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

与 `test_adds_missing_is_admin`（L138-152）对比：

| 步骤 | test_adds_missing_is_admin | test_independent_commits |
|------|---------------------------|--------------------------|
| 创建旧 schema | `_create_users_without_is_admin(engine)` | 相同 |
| 运行迁移 | `_run_migrations(engine)` | 相同 |
| 验证 | `PRAGMA table_info(users)` → assert is_admin | 相同 |
| 额外逻辑 | 无 | 多一个 `engine.dispose()` |

**唯一差异**：`test_independent_commits` 在 `_create_users_without_is_admin` 和 `_run_migrations` 之间插入了 `engine.dispose()`，但这不影响测试逻辑（SQLAlchemy disposed engine 仍可创建新连接）。

**TC09 的设计意图**（P3-test-cases.md:116-123）：
> 1. Mock `_run_migrations` 中第一个 `ALTER TABLE` 抛异常
> 2. 验证后续 `ALTER TABLE` 仍被尝试执行
> 3. 验证每次 DDL 后有 `conn.commit()` 调用

当前代码未实现步骤 1-3 中的任何一步。

**整改建议**：参考前序评审发现 10 的方案 B——构造混合场景（entries 列完整 + users 列缺失），验证「部分 DDL 跳过 + 部分 DDL 执行」：

```python
def test_independent_commits(self, tmp_path: Path):
    """DDL operations are independent — entries complete, users missing is_admin."""
    db_path = tmp_path / "test.db"
    engine = init_db(db_path)

    # entries: all columns present (migration will SKIP)
    # users: is_admin missing (migration will ADD)
    _create_users_without_is_admin(engine)

    _run_migrations(engine)

    with engine.connect() as conn:
        user_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        assert "is_admin" in user_cols

        entry_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(entries)"))}
        assert "is_public" in entry_cols
        assert "owner_id" in entry_cols

    engine.dispose()
```

**验证方式**：
- [ ] `test_independent_commits` 与 `test_adds_missing_is_admin` 有明确不同的验证逻辑

---

## 三、发现 11 遗留

### 发现 16（🟢 低危）：`test_independent_commits` 中无意义 `engine.dispose()` 仍在

**位置**：`test_migration.py:208`

**现象**：`engine.dispose()` 在 `_create_users_without_is_admin` 和 `_run_migrations` 之间，无任何作用。前序评审发现 11 已指出，未修。

**建议**：修发现 15 时一并移除。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 前序发现闭环 | 7/10 | 6/9 已修，1 部分修（TC09），2 未修（重复逻辑、私有调用） |
| 新增回归 | 3/10 | check_schema import 失败导致整个测试文件不可用 |
| TDD 状态 | 5/10 | 无法收集测试 → 比预期更差（应能收集但方法失败） |
| 整体 | **5.0/10** | |

---

## 待办

### 阻塞项
- [ ] **发现 14**：在 `database.py` 中添加 `check_schema` stub（`raise NotImplementedError`），让测试文件可被 pytest 收集
- [ ] **发现 15**：`test_independent_commits` 改为混合场景验证，不再重复 TC06

### 建议项
- [ ] **发现 16**：移除 `test_independent_commits` 中无意义的 `engine.dispose()`
