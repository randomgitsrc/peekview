---
phase: P3
task_id: TPV0101
type: test-cases
parent: P2-design.md
trace_id: TPV0101-P3-20261002
status: draft
created: 2026-10-02
agent: test-designer
test_code_dir: backend/tests/
new_test_files:
  - backend/tests/test_datetime_naive_compat.py
  - backend/tests/test_dependency_guard.py
bdd_count: 18
---

# P3 测试设计 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 上游输入：`P1-requirements.md`（18 BDD）、`P2-design.md`（§R3 测试补充 / gate_commands）、`P0-brief.md`。
> `change_type: refactor`，但本任务**缺陷真实存在**——P2 §R3 明确新增**有真红灯语义的守卫测试**（修复前 0.0.47 下必红）。故本设计**双口径**：新增守卫测试走 TDD 红灯口径 + 既有测试走回归覆盖口径。

## 0. 测试口径（双重性）

| 口径 | 适用范围 | 说明 |
|------|---------|------|
| **真红灯守卫**（TDD） | `test_datetime_naive_compat.py`、`test_dependency_guard.py` | 缺陷修复前在 0.0.47 下必红；修复后转绿。主 Agent 用 `check-tdd-red.py` 确认真红灯（B 类） |
| **回归覆盖**（refactor） | 既有测试套件 | 无新增功能行为可断言，标注每条回归用例覆盖重构涉及的文件/路径；质量由 P5 双环境全量兜底 |

**测试代码目录：`backend/tests/`**（P2 `gate_commands.project_module: peekview`）。

## 1. 新增守卫测试（真红灯语义）

### 1.1 `backend/tests/test_datetime_naive_compat.py`

覆盖 BDD-1/2/3/6/9/16。核心断言：在 sqlmodel 0.0.47 下，所有 naive UTC 列接受 naive 绑定（分类 a）、aware 绑定（分类 b）、NULL、WHERE 比较（读路径），且回读为**等价 UTC 时刻的 naive 值**；并静态扫描 25 个 datetime 列**每一个**都显式 `timezone=False`。

| 测试类 | 用例 | BDD |
|--------|------|-----|
| `TestBdd01NaiveWritePaths` | `test_bdd_01_naive_write_on_all_affected_columns` | BDD-1 (i) 分类 a |
| `TestBdd01NaiveWritePaths` | `test_bdd_01_aware_write_is_stored_as_naive` | BDD-1 (ii) 分类 b |
| `TestBdd02NullRoundTrip` | `test_bdd_02_null_and_naive_roundtrip` | BDD-2 |
| `TestBdd03NaiveWhereComparison` | `test_bdd_03_naive_where_comparison` | BDD-3 |
| `TestBdd06NaiveStorageSemantics` | `test_bdd_06_readback_matches_stored_utc_instant` | BDD-6 |
| `TestBdd09AwareAssignmentPaths` | `test_bdd_09_default_factory_created_at_is_naive_on_readback` | BDD-9 |
| `TestBdd09AwareAssignmentPaths` | `test_bdd_09_service_assignment_columns_are_naive` | BDD-9 |
| `TestBdd16ExplicitNaiveColumns` | `test_bdd_16_all_datetime_columns_explicit_naive` | BDD-16 |
| `TestBdd16ExplicitNaiveColumns` | `test_bdd_16_column_type_is_plain_datetime_not_decorator` | BDD-16 |
| `TestCleanupHooks` | `test_created_rows_are_scoped_to_isolated_engine` | 清理钩子自检（非红灯） |

**修复前实测红灯证据**（隔离 venv `/tmp/ci-repro-venv`，sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1）：

```
$ /tmp/ci-repro-venv/bin/python -m pytest backend/tests/test_datetime_naive_compat.py -v --tb=short --rootdir=backend
9 failed, 1 passed
失败原因 = sqlalchemy.exc.StatementError: (builtins.ValueError) Datetime values must have timezone information.
           Use datetime.now(timezone.utc), or annotate the field with NaiveDatetime for naive storage.
（裸列被映射为 UTCDateTime(timezone=True)；`__table__.columns` 枚举 25 列全为 tz=True）
```

修复后预期：25 列全部 `DateTime(timezone=False)`，10 用例全绿。

### 1.2 `backend/tests/test_dependency_guard.py`

覆盖 BDD-15。守卫 = **可机械校验的依赖上限**：

| 用例 | 断言 | BDD-15 |
|------|------|--------|
| `test_bdd_15_guard_exists_and_passes_on_fixed_repo` | `pyproject.toml` 的 sqlmodel 约束**存在上限** **且** 已安装版本满足约束 | (i) |
| `test_bdd_15_injected_drift_turns_guard_red` | 注入漂移（`sqlmodel>=0.0.14` 无上限）→ 守卫 evaluator 必须返回失败 | (ii) |
| `test_bdd_15_installed_version_within_declared_bound` | 已安装 sqlmodel 版本落在声明区间内 | (i) |

**修复前实测红灯证据**：

```
$ /tmp/ci-repro-venv/bin/python -m pytest backend/tests/test_dependency_guard.py -q --rootdir=backend
1 failed, 2 passed
失败：sqlmodel requirement sqlmodel>=0.0.14 has no upper bound; a future release can silently break the build
```

> BDD-15 (ii) 的**端到端注入实测**（临时编辑 `pyproject.toml` 放宽约束 → 重跑 → 恢复，记录前后 exit code）由 P6 人工执行，P3 以 `test_bdd_15_injected_drift_turns_guard_red` 固化"漂移必红"的判定逻辑。
> 修复后（P4 加 `sqlmodel>=0.0.14,<1.0.0`）预期 3 用例全绿。

## 2. 18 BDD 1:1 映射表

| BDD | 验收条件（摘要） | 承载测试 | 性质 |
|-----|----------------|---------|------|
| BDD-1 | 0.0.47 下所有 naive 列可写（naive + aware 两路径） | `test_datetime_naive_compat.py::TestBdd01NaiveWritePaths`（2 用例） | 新增真红灯 |
| BDD-2 | NULL ↔ naive 往返 | `test_datetime_naive_compat.py::TestBdd02NullRoundTrip` | 新增真红灯 |
| BDD-3 | 读路径 naive WHERE 比较不抛错 | `test_datetime_naive_compat.py::TestBdd03NaiveWhereComparison` | 新增真红灯 |
| BDD-4 | 本地 0.0.38 不回归 | P5 全量 `P5`（0.0.38）；已实测：`test_datetime_naive_compat.py` 在 0.0.38 下 **10 passed**（0.0.47 下 9 failed——正是待修缺陷）；`test_dependency_guard.py` 在 0.0.38 下 1 failed（无上限，与版本无关，修复后转绿） | 回归（P5 承载） |
| BDD-5 | 两版本全量均绿 | `P5`（0.0.38 全量）+ `P5_ci_repro`（0.0.47 全量） | 回归（P5 承载） |
| BDD-6 | naive UTC 存储语义 + 既有数据读出无漂移 | `test_datetime_naive_compat.py::TestBdd06NaiveStorageSemantics`；`test_star_lifecycle.py`（countdown 无偏移） | 新增 + 回归 |
| BDD-7 | API 响应时间形态（naive ISO 无 `+00:00`） | 既有 `test_api.py`、`test_entry_lifecycle.py`、`test_apikey.py`（响应时间断言） | 回归 |
| BDD-8 | 备份导出 JSON + CLI 时间形态 | 既有 `test_admin_backup.py`（备份）、`test_cli.py`（CLI 输出） | 回归 |
| BDD-9 | 全部 aware 赋值路径绑定为 naive UTC | `test_datetime_naive_compat.py::TestBdd09AwareAssignmentPaths`（2 用例） | 新增真红灯 |
| BDD-10 | backup restore（merge + replace）时间往返一致 | 既有 `test_admin_backup.py::test_restore_*`（`test_restore_into_empty_target`/`test_restore_valid_backup_succeeds`/`test_restore_replace_*`） | 回归 |
| BDD-11 | 归档倒计时 + star 生命周期 | 既有 `test_star_lifecycle.py`、`test_star_api.py`、`test_star_visibility.py` | 回归 |
| BDD-12 | admin 清理 + 用户禁用流程 | 既有 `test_admin_stats_cleanup.py`（cleanup 用例）、`test_admin_user_api.py`、`test_t080_admin_user_mgmt.py` | 回归 |
| BDD-13 | CLI 用户禁用 + 时间展示 | 既有 `test_t080_cli_user_disable.py`、`test_cli.py` | 回归 |
| BDD-14 | backfill_archive_delete_at 幂等 | 既有 `test_star_migration.py::test_blocker3_backfill_keeps_user_version_and_is_idempotent` | 回归 |
| BDD-15 | 依赖守卫存在可执行 + 注入漂移变红 | `test_dependency_guard.py`（3 用例） | 新增真红灯 |
| BDD-16 | 25 列静态扫描全为显式 naive | `test_datetime_naive_compat.py::TestBdd16ExplicitNaiveColumns`（2 用例） | 新增真红灯 |
| BDD-17 | API 契约不变（前端/MCP 范围外） | BDD-7 的 API 契约断言间接保证；前端/MCP 显式范围外（不跑前端测试） | 回归/范围外 |
| BDD-18 | 生产数据未污染 | conftest `isolate_config_file`（autouse）+ 全测试写入 `tmp_path`；P6 记录 `[PROD_NOT_TOUCHED]` | 回归/流程 |

**覆盖率：18/18 BDD 有 1:1 承载**（无遗漏、无一对多降级）。

## 3. 回归口径声明（既有测试覆盖映射）

重构涉及文件：`backend/peekview/models.py`（25 列类型声明）、`backend/pyproject.toml`（依赖约束）、`.github/workflows/ci.yml`（守卫入口）。回归由既有全量套件承载，**不新增功能行为断言**：

| 重构路径 | 回归承载用例 | 覆盖点 |
|---------|------------|--------|
| `models.py` Entry 时间列 | `test_entry_lifecycle.py`、`test_archived_visibility.py`、`test_star_lifecycle.py` | expires_at/archived_at/archive_delete_at 读写与判定 |
| `models.py` User/ApiKey 时间列 | `test_apikey.py`、`test_admin_user_api.py`、`test_auth_me.py` | last_used_at/expires_at/disabled_at |
| `models.py` EntryShare 时间列 | `test_share_create.py`、`test_share_lifecycle.py`、`test_share_revoke.py` | revoked_at/expires_at |
| `models.py` read tracking 时间列 | `test_read_tracking.py`、`test_read_tracking_hardening.py` | read_at/last_read_at/updated_at |
| `models.py` Team/TeamMember/Star/Tombstone/File 时间列 | `test_teams_api.py`、`test_star_api.py`、`test_storage.py` | joined_at/created_at/deleted_at |
| 备份/恢复/清理/CLI/backfill 链 | `test_admin_backup.py`、`test_admin_stats_cleanup.py`、`test_cli.py`、`test_star_migration.py` | BDD-8/10/11/12/13/14 |
| 迁移 SQL 不变 | `test_migration.py`、`test_team_migration.py`、`test_star_migration.py` | 无 schema 变更 |
| `pyproject.toml` 约束 | `test_dependency_guard.py`（新增守卫） | BDD-15 |

> 回归质量兜底：P5 双环境全量（`P5` 0.0.38 + `P5_ci_repro` 0.0.47，均 0 failed）→ P6 `regression.log`。

## 4. 清理钩子（afterEach 队列模式）

- 新增测试**全部**写入 conftest 的隔离 engine/`tmp_path`（`isolate_config_file` autouse 设 `PEEKVIEW_STORAGE__DATA_DIR`/`DB_PATH` 指向 `tmp_path`），不触碰生产 `~/.peekview/` 或 `:8080`。
- `test_datetime_naive_compat.py` 提供 `_cleanup_created_rows` autouse fixture（afterEach 清理队列）：创建即注册，测试结束无条件删除；删除异常静默 rollback（不因异常中止清理）。
- `TestCleanupHooks::test_created_rows_are_scoped_to_isolated_engine` 自检创建→删除的残留归零。
- 依赖守卫测试为只读（读 `pyproject.toml` + 已安装版本），无创建资源。

## 5. 交付前自查

| 项 | 命令 | 结果 |
|----|------|------|
| 平台假设扫描 | `python3 {agate_root}/scripts/check-platform-assumptions.py backend/tests/test_datetime_naive_compat.py backend/tests/test_dependency_guard.py` | **0 命中**（exit 0）；无需运行时拼接系统临时目录字面量（新文件未出现该字面量） |
| 真红灯确认 | `check-tdd-red.py agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat` | `TDD_CHECK: red-light (unexpected test failure)`，**exit 0**（B 类真红灯） |
| 0.0.47 红灯 | `P3` gate 命令（见 P2 gate_commands） | `test_datetime_naive_compat.py` 9 failed / 1 passed |
| 0.0.38 不回归 | `backend/.venv/bin/python -m pytest backend/tests/test_datetime_naive_compat.py` | 10 passed（新增守卫不引入本地回归） |

> 说明：`backend/tests/` 全树扫描存在 7 处**既有** R4 命中（`test_admin_backup.py:864`、`test_cli.py:578/580`、`test_config.py:200`、`test_file_service.py:257/260/271`），均为本任务之前已存在，不属新增测试范围。

## 6. 红灯预期汇总

| 测试文件 | 修复前（0.0.47） | 修复后（0.0.47） | 0.0.38 |
|---------|----------------|----------------|--------|
| `test_datetime_naive_compat.py` | 9 failed（naive bind / WHERE / 列类型扫描） | 预期全绿 | 10 passed（不回归） |
| `test_dependency_guard.py` | 1 failed（无上限） | 预期全绿 | 1 failed（无上限，与版本无关） |

## 7. 修订历史

- 2026-10-02：初版（test-designer，TPV0101 P3）。
