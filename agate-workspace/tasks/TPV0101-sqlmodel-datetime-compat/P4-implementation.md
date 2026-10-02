---
phase: P4
task_id: TPV0101
type: implementation
parent: P2-design.md
trace_id: TPV0101-P4-20261002
status: draft
created: 2026-10-02
agent: implementer
implementation_dir: backend/peekview/
change_type: refactor
domains: [backend]
packages: [peekview]
---

# P4 实现记录 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 上游：P2-design.md（选定方案 1）+ P3-test-cases.md + P3 测试文件（只读，不改）。
> 实现范围：仅 P2 §0.1 的 R1（模型列显式化）+ R2-1（依赖上限）。

## 1. 改动文件清单

| 文件 | 改动 | 关联 |
|------|------|------|
| `backend/peekview/models.py` | 顶部 `from sqlalchemy import ...` 补 `DateTime`；25 个 table datetime 列改为 `sa_column=Column(DateTime(timezone=False), ...)`（§2） | R1 / BDD-1/2/3/9/16 |
| `backend/pyproject.toml` | L28 `"sqlmodel>=0.0.14"` → `"sqlmodel>=0.0.14,<1.0.0"` | R2-1 / BDD-15 |

未触碰：非 table 的响应/请求模型、`database.py` 迁移 SQL、业务服务代码、P3 测试文件。

## 2. R1 — 25 列逐列落地（P2 §2.1 四形态）

ORM 枚举核对（`__table__.columns`，`isinstance(type, DateTime)`）：**25 列，全部 `timezone is False`，无裸 datetime 列、无 TypeDecorator**。

| 表 | 列 | 形态 |
|----|----|------|
| `EntryBase`（`Entry` 继承） | expires_at / archived_at | 可空默认 None + `Column(DateTime(timezone=False), nullable=True)` |
| `EntryBase` | archive_delete_at | 同上（保留 `description`） |
| `UserBase`（`User` 继承） | disabled_at | 可空默认 None |
| `User` | created_at | `default_factory=now_utc` + server_default CURRENT_TIMESTAMP |
| `User` | updated_at | + onupdate CURRENT_TIMESTAMP |
| `Team` | created_at / updated_at | 同上 |
| `TeamMember` | joined_at | server_default（无 onupdate） |
| `ApiKey` | expires_at / last_used_at | 可空默认 None |
| `ApiKey` | created_at / updated_at | server_default / +onupdate |
| `Entry` | created_at / updated_at | server_default / +onupdate |
| `EntryShare` | expires_at / revoked_at | 可空默认 None |
| `EntryShare` | created_at | server_default |
| `EntryRead` | read_at / updated_at | `default_factory=now_utc` + `nullable=False`（无 server_default） |
| `EntryStar` | created_at | server_default |
| `EntryTombstone` | deleted_at | server_default |
| `EntryReadStats` | last_read_at | 可空默认 None |
| `EntryReadStats` | updated_at | `default_factory=now_utc` + `nullable=False`（无 server_default） |
| `File` | created_at | server_default |

所有原 `sa_column_kwargs={"server_default": ..., "onupdate": ...}` 的 kwargs 已一并迁入 `Column(...)`，无 kwargs 丢失（RK-1 缓解）。非 datetime 列的 `sa_column_kwargs`（`status`/`user_id`/`is_public`/`is_active`/`is_admin`/`idempotency_key`/`view_count`）保持原样。

## 3. R2-1 — 依赖上限

`backend/pyproject.toml` 的 sqlmodel 约束加机械可校验上限 `<1.0.0`，使 `test_dependency_guard.py` 的 `_has_upper_bound` 守卫通过；注入漂移（`>=0.0.14`）时守卫失败（P6 将实测）。

## 4. 自查结果（自查≠gate，不代表 P5 已过）

| 环境 | 命令 | 结果 |
|------|------|------|
| 0.0.47（`/tmp/ci-repro-venv`） | `pytest backend/tests/test_datetime_naive_compat.py backend/tests/test_dependency_guard.py -q` | **13 passed**, exit 0 |
| 0.0.38（`backend/.venv`） | 同上 | **13 passed**, exit 0 |
| 0.0.47 全量 | `pytest backend/tests/ -q` | exit 0（全绿） |
| 0.0.38 全量 | `pytest backend/tests/ -q` | exit 0（全绿） |
| lint | `python3 -m ruff check peekview/` | All checks passed |
| platform-assumptions | `check-platform-assumptions.py backend/peekview/models.py backend/pyproject.toml` | 0 命中, exit 0 |

> `ruff check tests/` 报 4 项 I001（`test_datetime_naive_compat.py` / `test_dependency_guard.py` import 排序）——位于 **P3 产出且本任务禁止修改**的测试文件内，`peekview/` 干净。

## 5. 迁移幂等

`database.py` 迁移 / `backfill_archive_delete_at` 未改（P2 §0.2：列存储类型本就是无 tz DATETIME）。0.0.38/0.0.47 全量套件含 backfill 幂等用例，均绿。

## 6. 范围外声明

无 `[DESIGN_GAP]`、无 `[SCOPE+]`、无 `[SCOPE_GAP]`、无 `[CLARIFY]`——实现严格对齐 P2 §0.1/§2.1/§2.2。

## 7. 新增文件核对表

本阶段无新增文件（仅改既有 `models.py` / `pyproject.toml`），不适用骨架/CODE-MAP 机制。
