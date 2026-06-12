# T002 数据库迁移机制修复 — 方案设计评审

> 评审日期：2026-06-11
> 评审对象：`docs/tasks/T002-fix-db-migration/{P1-problems.md, P1-test-strategy.md, P2-design.md}`
> 评审团：技术评审 + 安全评审 + 标准化评审
> 前置评审：`gstack-review-mcp-version-desync.md`（版本耦合问题根因分析，参考其调用链追踪方法论）

---

## 评审结论

方案设计整体质量高：根因分析透彻（Issue 1/2/3 逐层递进，锁竞争机制讲清楚了），方案对比充分（A/B/C/D 四选一，权衡表完整），推荐方案 A 架构正确。**核心阻塞项 2 个，建议项 2 个，通过后即可进入 P3 实现。**

---

## 一、技术评审

### 发现 1（🔴 高危）：`SchemaMismatchError` 应继承 `PeekError` 而非 `Exception`

**位置**：`P2-design.md:142-143`

**现象**：
```
新增 SchemaMismatchError 异常 — 继承自 Exception
```

**机理分析**：项目异常体系统一继承 `PeekError`（`exceptions.py:10`），提供 `status_code` + `error_code`。所有业务异常（`NotFoundError`、`ValidationError` 等）都遵循此模式。新异常继承 `Exception` 意味着：在 API 层被捕获时不会走 `peek_error_handler`（`main.py:307-318`），不会产生标准 JSON error response；在 CLI 层，Click 只会打印 `Exception.__str__()`，丢失结构化信息。

**影响**：如果未来 schema check 逻辑被移到 API 层（例如 health check 返回 schema 状态），会破坏 API error format 一致性。即使在当前设计的 CLI-only 场景，也破坏异常体系的完整性。

**整改建议**：

```python
# exceptions.py 新增
class SchemaMismatchError(PeekError):
    """Database schema out of date."""
    status_code = 500
    error_code = "SCHEMA_MISMATCH"

    def __init__(self, missing_columns: dict[str, list[str]]):
        self.missing_columns = missing_columns
        # 构建人类可读消息
        parts = [f"  {table}: {', '.join(cols)}" for table, cols in missing_columns.items()]
        message = "Database schema is out of date. Missing columns:\n" + "\n".join(parts) + "\n\nRun: peekview service restart"
        super().__init__(message)
```

然后 `check_schema` 中 `raise SchemaMismatchError(missing)`。

**验证方式**：
- [ ] `grep "SchemaMismatchError" backend/peekview/exceptions.py` 确认定义存在且继承 PeekError
- [ ] 单元测试：`assert issubclass(SchemaMismatchError, PeekError)`

---

### 发现 2（🟡 中危）：`init_db` 签名变更遗漏了 `get_engine()` 函数

**位置**：`database.py:214-235`（`get_engine` 函数）

**现状**：
```python
def get_engine(config_or_path):
    ...
    return init_db(config_or_path)  # 无 run_migrations 参数
```

**机理分析**：`get_engine()` 是对 `init_db` 的包装函数，当前默认调 `init_db(path)`。如果 `init_db` 签名改为 `init_db(db_path, run_migrations=False)`，`get_engine()` 的调用不受影响（默认 False 是正确的 CLI 行为）。但 `get_engine()` 在哪儿被调用需要在设计文档中确认——如果 Server 层经过 `get_engine()` 获取 engine，则迁移永远不会被执行。

**核查**：搜索 `get_engine` 的调用点，确认无 Server 侧依赖。如果 Server 通过 `get_engine()` 间接调用 `init_db`，需给 `get_engine` 也加 `run_migrations` 参数。

**验证方式**：
- [ ] `rg "get_engine\(" backend/peekview/` 列出所有调用点，确认没有 Server 入口路径遗漏

---

### 发现 3（🟡 中危）：`check_schema()` 需跳过虚拟表和未创建的表

**位置**：`P2-design.md:121-127`

**现象**：设计描述「遍历 `SQLModel.metadata.tables`」对比 `PRAGMA table_info`，但未说明如何处理两类特殊情况：
1. **FTS5 虚拟表**（`entries_fts`）：不在 `SQLModel.metadata.tables` 中，不构成问题。但如果未来有人把 FTS 注册进 metadata，PRAGMA 返回的列与 SQLModel 不一致，会误报。
2. **表在 metadata 但不在 DB**：全新安装时 `create_all` 已创建所有表，此场景不触发。但在 `check_schema` 独立调用时（如 CLI 不执行 `create_all`），`PRAGMA table_info(nonexistent_table)` 返回空结果集，不报错但也不应报告为「所有列缺失」。

**整改建议**：`check_schema` 应先查询 `sqlite_master` 确认表存在，再逐列对比。

```python
def check_schema(engine: Engine) -> None:
    with engine.connect() as conn:
        existing_tables = {
            row[0] for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
        }
    missing = {}
    for table_name, table in SQLModel.metadata.tables.items():
        if table_name not in existing_tables:
            continue  # 表未创建，由 create_all 负责，不在此报错
        # ... PRAGMA table_info 对比逻辑
```

**验证方式**：
- [ ] 单元测试：`check_schema()` 对新创建的空库不报错
- [ ] 单元测试：`check_schema()` 对只有部分表的库正确报告缺失列（不报告缺失表）

---

### 发现 4（🟢 低危）：设计方案中 `line 38` / `line 104` 引用当前行号，不稳定

**位置**：`P2-design.md:153-154`

**现象**：文档写「lifespan() startup（line 38）」「create_app()（line 104）」，这些行号来自当前 `main.py`。但本次修改本身就会改变行号（在 `_run_migrations` 加 commit 等）。

**建议**：改用函数名引用：「`lifespan()` startup handler」「`create_app()` factory function」。

---

### 发现 5（🟢 低危）：`serve_command` → `lifespan` → `create_app` 形成三重 `init_db` 调用链

**位置**：`cli.py:162` + `main.py:38` + `main.py:104`

**现状**：
```
serve_command:162  → init_db(db_path)            # 第1次
    ↓ uvicorn.run(get_app)
create_app:104     → init_db(db_path)             # 第2次
    ↓ lifespan 注册
lifespan:38        → init_db(db_path)             # 第3次（启动时）
```

**机理分析**：`serve_command` 在启动 uvicorn 前调用 `init_db` 是为了确保目录存在、WAL pragma 生效。uvicorn 启动后 `create_app` 再次调用，`lifespan` 事件第三次调用。三重调用在无迁移时纯浪费，在有迁移时第一次成功执行迁移（`run_migrations=True`），后两次被 PRAGMA 检查跳过。**无正确性问题，但架构不够干净。**

**建议**：`serve_command:162` 处如果不需要立即读取 DB（当前代码仅调用 `init_db` 无后续查询），可以移除这次调用，让 Server 启动时 `create_app` 统一处理。如果保留，建议在 P2-design 中记录这个三重调用链并确认 `run_migrations` 只在一处为 True。

---

## 二、安全评审

### 发现 6（🟢 低危）：`check_schema()` 错误消息暴露内部列名

**位置**：`P2-design.md:134-140`

**现象**：错误消息格式包含表名和列名：
```
Missing columns:
  users: is_admin
  entries: is_public, owner_id
```

**分析**：在 CLI 场景下，这是用户自己的本地数据库，暴露列名不构成信息泄露。用户需要这些信息来理解问题。**安全可接受。**

但如果未来将 `check_schema` 引入 health check 或 API 响应（设计未排除此可能性），则需要谨慎：外部攻击者可借此探测数据库结构。

**建议**：在设计文档中标注 `check_schema()` 为「仅 CLI 内部使用」，不在 API/health check 中暴露。

---

### 安全通过项

| 检查项 | 结论 |
|--------|------|
| 迁移不涉及新的网络暴露面 | ✅ 通过 |
| `ALTER TABLE` 不引入 SQL 注入（使用 SQLAlchemy text + 固定列名） | ✅ 通过 |
| `PRAGMA table_info` 只读操作 | ✅ 通过 |
| 不存储/传输凭证 | ✅ 通过 |
| 不影响 JWT / API Key / 认证流程 | ✅ 通过 |

---

## 三、标准化评审

### 发现 7（🟡 中危）：设计文档未引用现有的 `PeekError` / `DatabaseError` 异常体系

**位置**：`P2-design.md:142-143`

**现象**：设计说「继承自 `Exception`」，未提及项目已有的 `PeekError` 体系和 `DatabaseError` 子类（`exceptions.py:190-197`）。看起来设计者不熟悉现有异常树。

**影响**：标准化角度，新代码应遵循现有模式。`SchemaMismatchError` 是 `DatabaseError` 的自然子类。

**整改建议**：参考发现 1 的代码修改，继承 `PeekError`（或进一步继承 `DatabaseError`）。

---

### 发现 8（🟢 低危）：CLI 错误消息推荐 `peekview service restart`，未覆盖非 service 场景

**位置**：`P2-design.md:139`

**现象**：
```
Run: peekview service restart
```

**分析**：部分用户通过 `peekview serve` 直接启动（开发/调试场景），并不安装为 systemd service。对这类用户，正确的指引是「重启 `peekview serve` 进程」。

**建议**：
```python
"Run: peekview service restart   (or restart peekview serve if not using service)"
```

或检测运行模式：
```python
if Path("/etc/systemd/system/peekview.service").exists():
    hint = "peekview service restart"
else:
    hint = "restart peekview serve"
```

---

### 标准化通过项

| 检查项 | 结论 |
|--------|------|
| P1/P2 文档 frontmatter 格式一致（phase/task_id/trace_id/status） | ✅ 通过 |
| 设计方案包含备选方案对比（A/B/C/D 四方案） | ✅ 通过 |
| 测试策略标注了测试类型和层级 | ✅ 通过 |
| 验收标准可测试（AC1-AC6 均有明确验证方式） | ✅ 通过 |
| 命名约定：snake_case（`check_schema`, `run_migrations`） | ✅ 通过 |
| 方案选择有评分维度表（可行性/成本/UX/兼容/架构/风险） | ✅ 通过 |
| P1-problems 的根因分析有 SQLite 锁机制引用 | ✅ 通过（`busy_timeout` 5 秒、EXCLUSIVE lock） |

---

## 四、测试策略评审

### 通过项

| 检查项 | 结论 |
|--------|------|
| Issue 1/2/3 与 AC1-AC6 有明确的测试类型映射 | ✅ 通过 |
| 测试金字塔清晰（E2E/集成/单元三层） | ✅ 通过 |
| 关键风险已识别（SQLite 版本差异、时序列测试） | ✅ 通过 |
| 独立临时目录方案可行（`temp_dirs` fixture 已有先例） | ✅ 通过 |

### 补充建议

1. **新增测试文件 `test_migration.py`** 应放在 `backend/tests/` 而非其他位置。
2. **时序列测试**（Server 先启动 → CLI 后访问）建议使用 `pytest-order` 或放在独立文件中 `@pytest.mark.serial`。
3. **check_schema 应测试空库场景**（设计未提及）：见发现 3。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 问题分析 | 9/10 | 根因链清晰（锁竞争→权责错位→系统性缺陷），Issue 1→2→3 逐层递进 |
| 方案设计 | 8/10 | 四选一对比完整，推荐合理；实现细节有 2 处间隙（check_schema 边界、异常继承） |
| 安全性 | 9/10 | 无新增攻击面，`check_schema` 列名暴露仅在 CLI 场景可接受 |
| 测试覆盖 | 8/10 | 类型映射完整，缺少空库场景和 schema 兼容性模糊地带 |
| 标准化 | 7/10 | 文档格式一致，但异常设计未遵循项目约定（PeekError 继承树） |
| 整体 | **8.2/10** | |

---

## 待办

### 阻塞项（P3 实现前必须修）
- [ ] **发现 1**：`SchemaMismatchError` 改为继承 `PeekError`（非 `Exception`）
- [ ] **发现 3**：`check_schema()` 设计补全虚拟表跳过、空表不误报逻辑

### 建议项
- [ ] **发现 2**：确认 `get_engine()` 所有调用点不受 `run_migrations` 参数变更影响
- [ ] **发现 5**：`serve_command` / `lifespan` / `create_app` 三重 `init_db` 链记录到设计文档
- [ ] **发现 8**：错误消息覆盖非 service 启动方式（`peekview serve`）
- [ ] **发现 4**：设计方案用函数名替代行号引用
