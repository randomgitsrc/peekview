---
phase: P2
task_id: T002
task_name: fix-db-migration
type: design
trace_id: T002-P2-20250611
created: 2026-06-11
status: draft
parent: T002/P1-problems.md
---

# P2：方案设计 — 数据库迁移机制修复

## 一、备选方案对比

### 方案 A：迁移入口唯一化（Server 独占）

**思路**：Server 是唯一发布者，迁移只在 Server 启动时执行。CLI 只做 schema 兼容检查。

```
Server 启动 → init_db(run_migrations=True) → ALTER TABLE 成功（独占窗口）
CLI 命令   → init_db(run_migrations=False) → check_schema() → 兼容/报错
```

**CLI schema 检查流程**：
1. 连接 DB，读取 `PRAGMA table_info` 获取实际列
2. 从 `SQLModel.metadata.tables` 读取期望列
3. 对比差异：如有缺失列 → 输出清晰的升级指引 `peekview service restart`
4. 无缺失 → 正常执行 CLI 命令

**优点**：
- 迁移永远成功（Server 启动时无任何其他连接）
- 权责清晰：Server 管理 DB 生命周期，CLI 是只读消费者
- 未来新增列时，用户只需 `peekview service restart`
- 改动量小，不影响现有 API 和前端

**缺点**：
- 如果用户用 `peekview serve` CLI 启动（而非 systemd service），首次启动时 DB 结构可能落后于代码。但 `peekview serve` 本身就是 Server 启动入口，会执行迁移。

---

### 方案 B：CLI 停服 → 迁移 → 重启

**思路**：CLI 在检测到 schema 过期后，主动停止 Server → 执行迁移 → 重启 Server。

**优点**：
- 用户无需手动操作 `peekview service restart`
- 自动化程度最高

**缺点**：
- 停止/重启 Server 含风险：systemd 用户服务 vs pipx 安装路径差异
- 如果 CLI 本身没有 root/systemd 权限，无法停止服务
- 生产环境意外停服可能影响其他并发请求
- 增加了 CLI 的复杂度和耦合度（需要感知 service 管理）

---

### 方案 C：独立 `peekview migrate` 命令

**思路**：新增 CLI 命令，用户手动 `peekview service stop && peekview migrate && peekview service start`。

**优点**：
- 职责清晰：迁移是一个独立的显式操作
- 实现最简单

**缺点**：
- 多步操作，用户容易遗忘
- 和方案 A 一样需要用户主动操作，但步骤更多
- 对于"Server 运行时 CLI 不崩溃"这个 AC 没有帮助（必须依赖用户正确操作）

---

### 方案 D：保留 CLI 迁移 + 改进 error handling

**思路**：保持当前架构不动，加锁重试、更直接的日志。

**优点**：
- 几乎不改代码

**缺点**：
- 不解决根本问题：CLI 无法获取排他锁
- Server 持有连接时重试多少次都失败
- P1 诊断的 Issue 2（权责错位）完全没有修复

---

## 二、推荐方案：A

| 维度 | 评分 | 理由 |
|------|------|------|
| 可行性 | ✅✅✅ | 完全解决排他锁问题 |
| 实现成本 | ✅✅✅ | 约 3 个文件，<100 行变更 |
| 用户体验 | ✅✅ | 只需 `peekview service restart`（或 `peekview serve` 重启动） |
| 向后兼容 | ✅✅✅ | 不影响现有 API，不影响新库创建 |
| 架构清晰 | ✅✅✅ | 消除迁移权责错位 |
| 风险 | ✅✅✅ | 低，不涉及 service 管理逻辑 |

**唯一代价**：用户需要知道 "schema 过期 → 重启服务"。通过 `check_schema()` 的错误消息即可传达。

---

## 三、详细设计

### 3.1 数据库层 (`database.py`)

#### `init_db` 签名变更

```python
# Before
def init_db(db_path: Path | str) -> Engine:

# After
def init_db(db_path: Path | str, run_migrations: bool = False) -> Engine:
```

`run_migrations=False` 作为默认值，因为 CLI 调用频率远高于 Server 启动。Server 调用处显式传 `True`。

#### 新增 `check_schema(engine) -> None`

```python
def check_schema(engine: Engine) -> None:
    """Compare actual DB columns against SQLModel metadata expectations.
    
    Raises SchemaMismatchError if any expected columns are missing.
    
    Implementation notes:
    - Queries sqlite_master first to get existing table names
    - Skips tables not yet created (handled by create_all)
    - Skips virtual/FTS tables (not in SQLModel.metadata)
    - For each existing table: PRAGMA table_info vs model columns
    """
```

遍历 `SQLModel.metadata.tables`，对每个表：
1. 先查 `SELECT name FROM sqlite_master WHERE type='table'` 确认表存在（跳过未创建的表，由 `create_all` 负责）
2. 读取 `PRAGMA table_info({table})` 获取实际列
3. 与模型定义的列比较
4. 收集缺失列
5. 如有缺失，raise `SchemaMismatchError`，消息格式：

```
Database schema is out of date. Missing columns:
  users: is_admin
  entries: is_public, owner_id

Run: peekview service restart
  (or restart peekview serve if not installed as a service)
```

> 安全说明：`check_schema()` 仅限 CLI 内部使用，不在 API/health check 中暴露，避免列名信息泄露。

#### 新增 `SchemaMismatchError` 异常（→ `exceptions.py`）

**关键修正**（评审发现 1）：继承 `PeekError` 而非 `Exception`，遵循项目异常体系约定。

```python
# exceptions.py
class SchemaMismatchError(PeekError):
    """Database schema is out of date — missing expected columns."""
    status_code = 500
    error_code = "SCHEMA_MISMATCH"

    def __init__(self, missing_columns: dict[str, list[str]]):
        self.missing_columns = missing_columns
        parts = [f"  {table}: {', '.join(cols)}" for table, cols in missing_columns.items()]
        message = (
            "Database schema is out of date. Missing columns:\n"
            + "\n".join(parts)
            + "\n\nRun: peekview service restart\n"
            + "  (or restart peekview serve if not installed as a service)"
        )
        super().__init__(message)
```

#### `_run_migrations` 保持不变（仅 commit 时机调整）

原有的每个 DDL 后没有独立 commit。虽然 SQLite 的 DDL 可以 auto-commit，但为了防御性编程，在每个 `ALTER TABLE` 后添加 `conn.commit()`。

### 3.2 Server 层 (`main.py`)

两处 `init_db` 调用显式传 `run_migrations=True`：

- `lifespan()` startup handler
- `create_app()` factory function

> 注：`serve_command`（`cli.py:162`）→ `uvicorn.run` → `create_app` → `lifespan` 形成三重 `init_db` 调用链。只有 `serve_command` 和 `create_app` 两处传 `run_migrations=True`（`lifespan` 保持由 `create_app` 处执行迁移）。前两处调用均发生在 Server 启动路径上，且都在服务进程生命周期最早期，不存在锁竞争。
>
> `serve_command` 处的 `init_db` 保留：它确保 data dir 创建 + pragma 设置在主进程即完成，uvicorn worker 复用时无需重复。

### 3.3 CLI 层 (`cli.py`)

**6 个 `init_db` 调用点分类处理**：

| 位置 | 函数 | 处理方式 |
|------|------|----------|
| `_get_entry_service` | 获取 EntryService | `init_db(False)` + `check_schema()` |
| `serve_command` | Server 启动（CLI `peekview serve`） | `init_db(True)`（迁移入口之一） |
| `user_create` | 创建用户 | `init_db(False)` + `check_schema()` |
| `user_list` | 用户列表 | `init_db(False)` + `check_schema()` |
| `user_promote` | 提权 | `init_db(False)` + `check_schema()` |
| `user_demote` | 降权 | `init_db(False)` + `check_schema()` |

> `get_engine()` 调用点核查（评审发现 2）：
> - `apikey_service.py:35` — 仅在 `app.state.engine` 为 None 时作为 fallback，而 `create_app` 启动时已设置 `app.state.engine` = 执行过迁移的 engine，所以 fallback 路径的 `init_db(False)` 不会导致迁移遗漏。
> - `entry_service.py:65` — 同上。
> - `api/files.py:67,108` — 同上。
> - `auth.py` — Service 类初始化时调用，未传入 `config.db_path`，走默认路径 `PeekConfig().db_path`。在实际使用中 `app.state.engine` 已存在，不会走到 fallback。
> - **结论**：`get_engine()` 保持 `run_migrations=False`（默认值），所有 Server 侧调用均由 `app.state.engine` 覆盖，无遗漏风险。

### 3.4 用户体验

**正常场景**（新安装）：
```bash
$ pipx install peekview
$ peekview serve       # Server 启动 → 迁移执行 → 表结构完整
$ peekview user list   # check_schema → 通过 → 正常输出
```

**旧 DB 升级场景**（生产环境当前状态）：
```bash
$ peekview user list
Error: Database schema is out of date. Missing columns:
  users: is_admin

Run: peekview service restart

$ peekview service restart   # Server 重启 → 迁移执行 → is_admin 添加成功
$ peekview user list          # ✅ 正常
```

**未来新增列场景**（v0.2.x）：
```bash
$ peekview serve              # 启动时 ALTER TABLE ADD COLUMN new_field → 成功
$ peekview user list          # check_schema → 通过 → 正常
```

---

## 四、影响范围

| 文件 | 变更类型 | 行数（估） |
|------|----------|-----------|
| `backend/peekview/database.py` | 新增函数 + 参数变更 | +50, ~10 |
| `backend/peekview/cli.py` | 调用点参数 + check_schema | ~15 |
| `backend/peekview/main.py` | 调用点参数 | 2 行 |

**不影响**：前端、MCP Server、API 路由、数据模型、存储层。

---

## 五、测试覆盖计划

详见 P3 阶段，预计新增：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `test_database.py` | `check_schema()` 单元测试；`init_db(run_migrations=) `行为验证 |
| `test_cli.py` | `user_list` / `user_create` 在 schema 过期时的错误消息 |
| `test_migration.py` | 新建：Server 生命周期 + CLI 交互集成测试 |
