---
phase: P6
task_id: T002-fix-db-migration
parent: T002/P4-implementation/implementation.md
trace_id: T002-P6-20260612
---

# P6：一致性检查 — 数据库迁移机制修复

## 检查结果摘要

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | 方案A（Server独占迁移）完整落实 | ✅ 一致 |
| 2 | check_schema() 仅 CLI 调用，不在 API 暴露 | ✅ 一致 |
| 3 | init_db(run_migrations=) 默认值正确 | ✅ 一致 |
| 4 | SchemaMismatchError 错误消息含升级指引 | ✅ 一致 |
| 5 | CLI 6 个调用点分类处理与设计表一致 | ✅ 一致 |

**结论：5/5 一致，0 偏差，无 [BLOCKER]。**

---

## 逐项对照

### 1. 方案A（Server独占迁移）完整落实

| P2 设计要点 | P4 实现文件:行号 | 判定 |
|-------------|-----------------|------|
| Server → `init_db(run_migrations=True)` → ALTER TABLE | `main.py:104`, `cli.py:163` | ✅ |
| CLI → `init_db(run_migrations=False)` → `check_schema()` → 兼容/报错 | `cli.py:73-74`, `1390`, `1416-1417`, `1442-1443`, `1464-1465` | ✅ |
| `SchemaMismatchError` 继承 `PeekError` | `exceptions.py:200` | ✅ |
| `check_schema(engine)` 跳过未创建表 / FTS 虚拟表 | `database.py:126-131` (using `SQLModel.metadata.tables` + `existing_tables` filter) | ✅ |
| 每个 DDL 后独立 `conn.commit()` | `database.py:49,59,67,78,91,101` | ✅ |

### 2. check_schema() 仅 CLI 调用，不在 API 暴露

| 位置 | `check_schema` 调用 | 判定 |
|------|---------------------|------|
| `cli.py` | ✅ (5 处：`_get_backend`, `user_create`, `user_list`, `user_promote`, `user_demote`) | ✅ |
| `main.py` | ❌ 无导入/调用 | ✅ |
| `api/*.py` | ❌ 无导入/调用 | ✅ |
| `/health` endpoint | ❌ 不包含 schema check | ✅ |

P2 安全约束完全满足：列名信息不会通过 API 泄露。

### 3. init_db(run_migrations=) 默认值正确

| 调用点 | 传参 | run_migrations 语义 | 判定 |
|--------|------|---------------------|------|
| `database.py:143` (定义) | `def init_db(..., run_migrations: bool = False)` | 默认不迁移 | ✅ |
| `main.py:104` (create_app) | `init_db(config.db_path, run_migrations=True)` | Server 入口迁移 | ✅ |
| `main.py:38` (lifespan) | `init_db(config.db_path)` → `False` | 由 create_app 已完成迁移 | ✅ |
| `cli.py:163` (serve_command) | `init_db(config.db_path, run_migrations=True)` | CLI 启 Server 时迁移 | ✅ |
| `cli.py:73` (_get_backend) | `init_db(config.db_path)` → `False` | CLI 只读，后接 check_schema | ✅ |
| `cli.py:1389` (user_create) | `init_db(config.db_path)` → `False` | CLI 只读，后接 check_schema | ✅ |
| `cli.py:1416` (user_list) | `init_db(config.db_path)` → `False` | CLI 只读，后接 check_schema | ✅ |
| `cli.py:1442` (user_promote) | `init_db(config.db_path)` → `False` | CLI 只读，后接 check_schema | ✅ |
| `cli.py:1464` (user_demote) | `init_db(config.db_path)` → `False` | CLI 只读，后接 check_schema | ✅ |
| `database.py:275-280` (get_engine fallback) | `init_db(...)` → `False` | P2 分析：实际不会走到 fallback | ✅ |

### 4. SchemaMismatchError 错误消息含升级指引

| P2 设计要求 | P4 实现 (`exceptions.py:200-215`) | 判定 |
|------------|-----------------------------------|------|
| 继承 `PeekError` | ✅ `class SchemaMismatchError(PeekError)` | ✅ |
| `status_code = 500` | ✅ `status_code = 500` | ✅ |
| `error_code = "SCHEMA_MISMATCH"` | ✅ `error_code = "SCHEMA_MISMATCH"` | ✅ |
| 消息包含 "Database schema is out of date. Missing columns:" | ✅ 逐字一致 | ✅ |
| 消息包含 "Run: peekview service restart" | ✅ 逐字一致 | ✅ |
| 消息包含 fallback hint "(or restart peekview serve...)" | ✅ 逐字一致 | ✅ |
| `__init__` 接收 `missing_columns: dict[str, list[str]]` | ✅ 签名一致 | ✅ |
| 列名格式化 `  table: col1, col2` | ✅ `parts = [f"  {table}: {', '.join(cols)}" ...]` | ✅ |

### 5. CLI 6 个调用点分类处理与设计表一致

| P2 设计表位置 | P4 实现位置 | 实际调用 | 判定 |
|--------------|------------|----------|------|
| `_get_entry_service` | `cli.py:38` (`_get_backend`) | `init_db(False)` + `check_schema(engine)` | ✅ [OK] |
| `serve_command` | `cli.py:163` | `init_db(True)` | ✅ |
| `user_create` | `cli.py:1389-1390` | `init_db(False)` + `check_schema(engine)` | ✅ |
| `user_list` | `cli.py:1416-1417` | `init_db(False)` + `check_schema(engine)` | ✅ |
| `user_promote` | `cli.py:1442-1443` | `init_db(False)` + `check_schema(engine)` | ✅ |
| `user_demote` | `cli.py:1464-1465` | `init_db(False)` + `check_schema(engine)` | ✅ |

> [OK] 偏差说明：P2 设计表用 `_get_entry_service` 指代共享后端获取器，P4 实现命名为 `_get_backend`。函数名变更属于实现改进（更准确反映其可返回 `PeekClient` 或 `EntryService`），行为与设计完全一致（`init_db(False)` + `check_schema()`），不影响架构正确性。

---

## 附加检查

### get_engine() fallback 路径

| P2 分析结论 | P4 实现 | 判定 |
|------------|---------|------|
| `get_engine()` 保持 `run_migrations=False`（默认值） | `database.py:275-280`：3 条调用路径均不加 `run_migrations=True` | ✅ |
| Server 侧均由 `app.state.engine` 覆盖，无遗漏风险 | `main.py:104-105`：`engine = init_db(...)` + `app.state.engine = engine` | ✅ |

### 异常体系一致性

| 检查项 | 结果 |
|--------|------|
| `SchemaMismatchError` 被 `main.py:308` 的 `PeekError` 异常处理器捕获 | ✅ (继承 `PeekError`) |
| `SchemaMismatchError` 在 API 路径上被触发时返回标准错误格式 | ✅ (status_code=500, error_code="SCHEMA_MISMATCH") |

### 测试覆盖

P4 报告 14/14 migration 测试 passed + 429 回归测试 passed，无新增失败。测试覆盖了：
- `check_schema` 空库/缺列/继承/消息提示
- `init_db(run_migrations=True/False)` 行为
- `_run_migrations` 缺列新增/独立提交/多表
- `SchemaMismatchError` 状态码/错误码

覆盖充分，与 P2 设计的 P3 测试计划一致。

---

## 最终判定

**P4 实现与 P2 设计完全一致，无 [BLOCKER] 标记。**
