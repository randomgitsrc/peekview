---
phase: P6
task_id: TPV0101
type: acceptance
parent: P5-verification.md
trace_id: TPV0101-P6-20261002
status: draft
created: 2026-10-02
agent: verifier
# ── v2.0 机器汇总 ──
pass: 18
fail: 0
ui_affected: false
regression_pass: true
---

# P6 验收报告 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 口径：`change_type: refactor`（P1 frontmatter）→ **回归验收口径（三段式）**：
> ① 行为不变声明 → ② 全量回归全绿 → ③ 关键路径行为不变断言逐条。
> `ui_affected: false` → 不跑 Playwright / 无截图 / 无 vision。
> 18 条 BDD 全部逐条实跑，证据存 `P6-evidence/`。

## 一、行为不变声明

本次重构（P4：`backend/peekview/models.py` 25 个 datetime 列改为显式 `Column(DateTime(timezone=False))`；`backend/pyproject.toml` 为 sqlmodel 增加可机械校验上限）**仅改变内部实现，不改外部行为**——不改列名、不改 `nullable`/`server_default`/`onupdate`、不改业务服务代码、不改 API 响应 schema、不改迁移 SQL、不迁移既有数据。

判定依据 = **全量回归全绿（BDD-5）+ 关键路径行为不变断言逐条 PASS（BDD-1~BDD-18）**。禁止为凑验收数量新增功能性质 BDD——本报告全部为「关键路径行为不变断言」。

P4 改动面核实（`git show --stat 14ca829a`）：仅 `backend/peekview/models.py` + `backend/pyproject.toml` 两个源码文件；`entry_service.py` 等序列化/业务路径零改动，故外部契约逐字段不变。

## 二、全量回归全绿

- PASS BDD-5: 两版本全量回归全绿（重构后完整测试套件 0 失败；0.0.38 本地 1186 passed / 0 failed，0.0.47 CI 等价 1186 passed / 0 failed，各 3 skipped）(P6-evidence/regression.log, P6-evidence/regression-047.log)

## 三、关键路径验收（行为不变断言逐条）

- PASS BDD-1: 最新 sqlmodel 0.0.47 下所有 affected naive 列按 naive 值（分类 a）与 aware 值（分类 b）写入均不抛 `ValueError`，回读为等价 UTC 的 naive 值；`TestBdd01NaiveWritePaths` 2 用例 PASS (P6-evidence/bdd_1_2_3_6_9_16_047.log)
- PASS BDD-2: 0.0.47 下可空 naive 列 NULL ↔ naive 值往返正常（NULL 不抛错、赋值回读相等）；`TestBdd02NullRoundTrip` PASS (P6-evidence/bdd_1_2_3_6_9_16_047.log)
- PASS BDD-3: 0.0.47 下读路径 naive 绑定 WHERE 比较（`expires_at <= aware/naive`）正常返回且选择与 naive UTC 语义一致；`TestBdd03NaiveWhereComparison` PASS (P6-evidence/bdd_1_2_3_6_9_16_047.log)
- PASS BDD-4: 本地 sqlmodel 0.0.38 行为不回归（naive-compat 守卫 10 passed；全量 1186 passed / 0 failed；无 `has no matching SQLAlchemy type` 失败形态，出现次数 0）(P6-evidence/bdd_4_038_naive_compat.log, P6-evidence/bdd_4_038_no_regression_summary.log)
- PASS BDD-6: naive UTC 存储语义保持、既有数据读出无时区漂移（`TestBdd06NaiveStorageSemantics` 断言入库/回读 UTC 时刻相等且 `tzinfo is None`；star 倒计时/归档可见性套件 90 passed）(P6-evidence/bdd_6_storage_semantics.log, P6-evidence/bdd_1_2_3_6_9_16_047.log)
- PASS BDD-7: API 响应时间字段序列化形态契约不变——修复前后端（`entry_service.py` 等）零改动，pre-fix（commit 01923d5d）与 post-fix（0.0.38/0.0.47）逐字段形态相同（`created_at` 等 naive 无 offset、`expires_at` 创建路径的 `Z` 后缀预先存在）；entry/user/api-key/share 相关套件 97 passed (P6-evidence/bdd_7_api_time_contract.log, P6-evidence/bdd_7_11_17_api_shape_contract.log)
- PASS BDD-8: 备份导出 JSON 与 CLI 输出时间形态契约不变；`test_admin_backup.py` + `test_cli.py` 86 passed (P6-evidence/bdd_8_backup_cli_time.log)
- PASS BDD-9: 全部 aware 赋值路径（b1–b19）在 0.0.47 下绑定为 naive UTC 存储——真实 service 探针覆盖 Entry.expires_at/created_at/updated_at、EntryShare.expires_at/created_at、EntryStar.created_at、EntryRead.read_at/updated_at、Team.created_at/updated_at、TeamMember.joined_at 共 11 列，回读 `tzinfo is None`，双版本均 PASS (P6-evidence/bdd_9_service_aware_paths_047.log, P6-evidence/bdd_9_service_aware_paths_038.log)
- PASS BDD-10: 备份恢复（merge + replace）在 0.0.47 下成功且时间值往返一致；`test_admin_backup.py` 40 passed (P6-evidence/bdd_10_restore.log)
- PASS BDD-11: 归档删除倒计时与 star 生命周期正常；`test_star_lifecycle.py` + `test_star_api.py` + `test_star_visibility.py` 25 passed (P6-evidence/bdd_11_star_lifecycle.log)
- PASS BDD-12: admin 清理（archive/delete/reads）与用户禁用/启用流程正常；`test_admin_stats_cleanup.py` + `test_admin_user_api.py` + `test_t080_admin_user_mgmt.py` 50 passed (P6-evidence/bdd_12_admin_cleanup.log)
- PASS BDD-13: CLI 用户禁用与时间展示正常；`test_t080_cli_user_disable.py` + `test_cli.py` 50 passed (P6-evidence/bdd_13_cli.log)
- PASS BDD-14: `backfill_archive_delete_at` 幂等正常（重复执行不变、不触碰 `PRAGMA user_version`）；`test_blocker3_backfill_keeps_user_version_and_is_idempotent` PASS (P6-evidence/bdd_14_backfill.log)
- PASS BDD-15: 依赖守卫存在可执行且注入漂移变红——(i) 守卫 3 用例在 0.0.38/0.0.47 均 PASS；(ii) 实测将 `pyproject.toml` 上限去掉（`sqlmodel>=0.0.14`）→ 守卫 exit 1 失败（`... has no upper bound ...`）→ `git checkout` 恢复 → exit 0 转绿 → `git diff backend/pyproject.toml` 为空（无残留）(P6-evidence/bdd_15_guard_038.log, P6-evidence/bdd_15_guard_047.log, P6-evidence/bdd_15_injection_drift.log, P6-evidence/bdd_15_guard_after_restore.log)
- PASS BDD-16: 全部表模型 datetime 列显式声明时区语义、静态可核验——ORM 枚举 `__table__.columns` 得 25 列 / 11 表，全部 `DateTime`、`timezone=False`、无裸标注 TypeDecorator；`TestBdd16ExplicitNaiveColumns` 2 用例 PASS (P6-evidence/bdd_16_orm_enumeration_047.log, P6-evidence/bdd_1_2_3_6_9_16_047.log)
- PASS BDD-17: 修复不改变 API 序列化形态契约（前端与 MCP 为间接消费方）——pre/post 逐字段形态相同（`CONTRACT_UNCHANGED: True`）；前端/MCP 显式范围外，不跑前端测试 (P6-evidence/bdd_7_11_17_api_shape_contract.log, P6-evidence/bdd_7_api_time_contract.log)
- PASS BDD-18: 生产数据与失败面数据未被测试污染 `[PROD_NOT_TOUCHED]`——生产库 `~/.peekview/peekview.db` mtime 1790904554（与 P5 基线一致）、size 4546560、md5 d68a32c1…；生产 `peekview serve`（pid 1583302，启动于 9月29）未被触碰；全部测试走 conftest `isolate_config_file`（autouse）隔离到 `tmp_path`；post-test 残留检查通过 (P6-evidence/bdd_18_prod_not_touched.log, P6-evidence/post_test_residue_check.log)

**Summary**: 18/18 PASS, 0 FAIL（`regression_pass: true`）。

## 四、post-test 环境残留检查（强制）

见 `P6-evidence/post_test_residue_check.log`：

- 清理钩子：`TestCleanupHooks::test_created_rows_are_scoped_to_isolated_engine` PASSED（afterEach 队列无残留行）。
- 仓库无测试产物（`git status` 仅任务区文件）；`backend/` 内无遗留 `test.db`/`*.db-wal`。
- 无 debug 服务残留（8888/8889/8890 无监听）；BDD-7 对比用临时 worktree 已 `git worktree remove`，`git worktree list` 仅主工作区。
- 注入漂移实验后 `pyproject.toml` 已恢复提交状态（`git diff` 空，`sqlmodel>=0.0.14,<1.0.0`）。
- 双 venv 版本完好：`backend/.venv`=sqlmodel 0.0.38 / sqlalchemy 2.0.51；`/tmp/ci-repro-venv`=sqlmodel 0.0.47 / sqlalchemy 2.0.54。

## 五、诚实记录

- `entry.expires_at`（创建响应路径）序列化带 `Z` 后缀，其余时间字段为 naive 无 offset。核实为**预先存在**行为：该值由 `entry_service.py:383` 直接把 aware 内存值（`datetime.now(timezone.utc)+delta`）传入响应，P4 未改服务代码；pre-fix commit 01923d5d 与 post-fix 双版本形态一致，故 BDD-7/17 的「形态不变」成立。
- BDD-15 (ii) 的注入漂移为**真实端到端实测**（改 pyproject → 重跑守卫 → 恢复），非推理。
