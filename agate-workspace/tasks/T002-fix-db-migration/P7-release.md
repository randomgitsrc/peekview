---
phase: P7
task_id: T002-fix-db-migration
parent: T002/P6-consistency.md
trace_id: T002-P7-20260612
---

# P7：发布记录 — 数据库迁移机制修复

## 版本变更

| 项目 | 旧版本 | 新版本 |
|------|--------|--------|
| backend | v0.1.52 | **v0.1.53** |

## Commit 信息

| Commit | 阶段 | 说明 |
|--------|------|------|
| `38a4d9d3` | P4 | 数据库迁移机制修复实现 — 14/14 绿灯 |
| `71b204e1` | P5 | 验证通过 — failed=0, P1 3/3通过 |
| `55b3a3f4` | P6 | 一致性检查通过 — 5/5一致，无BLOCKER |

## 变更摘要

### 修复：数据库迁移机制（方案A — Server 独占迁移）

**问题**：CLI 与 Server 共享迁移职责导致排他锁冲突，`ALTER TABLE` 在 Server 运行时失败。

**方案**：
- `init_db` 新增 `run_migrations` 参数（默认 `False`），Server 显式传 `True`
- CLI 新增 `check_schema()` 兼容检查，schema 过期时输出清晰升级指引
- 新增 `SchemaMismatchError` 异常（继承 `PeekError`），含 `peekview service restart` 提示
- 每个 DDL 后独立 `conn.commit()`，防御性编程

### 变更文件

| 文件 | 变更类型 |
|------|----------|
| `backend/peekview/database.py` | 新增 `check_schema()` + `run_migrations` 参数 + `_run_migrations` commit 加固 |
| `backend/peekview/exceptions.py` | 新增 `SchemaMismatchError` |
| `backend/peekview/cli.py` | 5 处 `init_db(False)` + `check_schema()`，1 处 `init_db(True)` |
| `backend/peekview/main.py` | `create_app()` 显式传 `run_migrations=True` |
| `backend/peekview/__init__.py` | 版本号 bump |

### 不影响

前端、MCP Server、API 路由、数据模型、存储层。

## 质量门

| 检查项 | 状态 |
|--------|------|
| 版本号 bump (0.1.52 → 0.1.53) | ✅ |
| CHANGELOG 更新 | ✅ |
| lint (ruff) | ⚠️ 204 预存 warning，无新增 |
| 迁移测试 (14) | ✅ 14 passed, 0 failed |
| 回归测试 (429) | ✅ 429 passed, 1 skipped, 0 failed |
| P6 一致性 (5/5) | ✅ 完全一致，无 BLOCKER |

## 发布内容

- **backend/pyproject.toml**: version `"0.1.52"` → `"0.1.53"`
- **CHANGELOG.md**: 新增 `[0.1.53]` 条目，记录数据库迁移机制修复
