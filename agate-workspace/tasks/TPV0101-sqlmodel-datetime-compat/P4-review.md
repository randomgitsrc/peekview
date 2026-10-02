---
phase: P4
task_id: TPV0101
type: review
parent: P4-implementation.md
trace_id: TPV0101-P4-review-20261002
status: approved
created: 2026-10-02
agent: review
---

# P4 实现评审 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 评审对象：`backend/peekview/models.py` + `backend/pyproject.toml`（`git diff HEAD`）。
> 上游：P2-design.md §0/§2.1/§2.2、P3-test-cases.md、P1-requirements.md（18 BDD）、P4-implementation.md。
> 角色：review（C8：backend + risk=high）。只审不改；shell 显式超时；未触碰生产 `:8080` / `~/.peekview/`。

## 独立复核环境

| 环境 | 版本 | 用途 |
|------|------|------|
| `/tmp/ci-repro-venv` | sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1 | CI 等价（本任务根因环境） |
| `backend/.venv` | sqlmodel 0.0.38 / sqlalchemy 2.0.51 | 本地不回归 |

## 维度 1 — 正确性（25 列 / 四形态）✅

**独立 ORM 枚举**（`__table__.columns`，`DateTime` 判定）结论：

- `total datetime cols = 25`；`non-naive = []`；`decorated = []`（无 TypeDecorator / 无裸列）。
- 逐列 `(nullable, server_default, onupdate)` 与 P2 §2.1 四形态逐一比对，**全部匹配**：

| 形态 | 列 | 实测 |
|------|----|------|
| 可空（nullable=True，无默认） | Entry.expires_at/archived_at/archive_delete_at、User.disabled_at、ApiKey.expires_at/last_used_at、EntryShare.expires_at/revoked_at、EntryReadStats.last_read_at | 全部 `naive True False False` |
| server_default | User/Team/ApiKey/Entry/EntryShare/EntryStar/File.created_at、TeamMember.joined_at、EntryTombstone.deleted_at | 全部 `naive False True False` |
| server_default + onupdate | User/Team/ApiKey/Entry.updated_at | 全部 `naive False True True` |
| 纯 default_factory（无 server_default） | EntryRead.read_at/updated_at、EntryReadStats.updated_at | 全部 `naive False False False`（易漏列已覆盖） |

- `EntryBase`（expires_at/archived_at/archive_delete_at）在基类声明，`Entry` 未重复定义；ORM 枚举含继承 3 列，计数 25 正确。
- `EntryRead`/`EntryReadStats` 的无 server_default 列（P1 点名易漏）已按 §2.1 正确落为 `nullable=False` 无 server_default。

## 维度 2 — 范围正确 ✅

- `git diff HEAD --name-only`：实现改动仅 `backend/peekview/models.py` + `backend/pyproject.toml`（其余为 task 文档）。
- `git diff HEAD -- backend/peekview/database.py` **为空**——8 处迁移 SQL（L89/102/117/137/164/243/244/251）未动，符合 P2 §0.2。
- AST 对比 HEAD vs 当前：**非 table 响应模型的 datetime 字段逐字相同**（`response datetime fields identical: True`）；table datetime 字段名集合相同（无字段增删改名）。
- `Field(default=None)` 的可空列补 `sa_column=Column(DateTime(timezone=False), nullable=True)`，`default=None` 语义保留；非 datetime 列的 `sa_column_kwargs`（L88/91/92/122/123/320/371）保持原样未误改。
- `archive_delete_at` 的 `description=` 保留（L112）。

## 维度 3 — 语义保持 ✅

- 全部列 `timezone=False`（naive），无 aware 列；`now_utc()` 生产者未改（仍返回 aware，绑定到 naive 列时被去时区）——与 P1 §2.1 分类 (b) 一致，无需逐点改造。
- 无数据迁移：`database.py` 未改，既有 SQLite 无 tz `DATETIME` 存储不变。
- BDD-6 测试断言 `readback == stored` 且 `tzinfo is None`（存储 UTC 时刻等价、无漂移），通过。

## 维度 4 — 依赖守卫（BDD-15）✅

- `backend/pyproject.toml`：`sqlmodel>=0.0.14` → `sqlmodel>=0.0.14,<1.0.0`（唯一改动）。
- 守卫 `_has_upper_bound` 识别 `<`/`<=`/`==`/`~=`；`test_dependency_guard.py` 三用例。
- **独立注入实测**：临时把约束放宽为 `sqlmodel>=0.0.14` → 守卫 **exit 1, FAILED**（`has no upper bound`）；已恢复，`git diff` 确认恢复为 `<1.0.0`。确认漂移可被机械检出为红，非静默放过。

## 维度 5 — 实现质量 / 安全（risk=high）✅

- **无 SQL 注入**：改动仅为 SQLAlchemy `Column(DateTime(...))` 列类型声明，无字符串拼接进查询；`server_default`/`onupdate` 仍用 `text("CURRENT_TIMESTAMP")` 常量（既有形态，未引入新输入）。
- **无竞态 / TOCTOU**：纯声明式列映射变更，无 read-check-write、无并发路径改动。
- **无资源泄漏**：无连接/文件/会话生命周期改动。
- **onupdate 语义一致**：原 `sa_column_kwargs={"server_default":..., "onupdate":...}` 的 kwargs 完整迁入 `Column(...)`，ORM 枚举实测 4 张 updated_at 表均保留 `onupdate`（`naive False True True`），RK-1（kwargs 丢失）未发生。

## 维度 6 — 测试真实性 ✅

- 独立复跑 P3 红灯文件于 0.0.47：`test_datetime_naive_compat.py` + `test_dependency_guard.py` = **13 passed**。
- **独立全量复跑**（非 implementer 自报）：
  - 0.0.47：`1186 passed, 3 skipped`，**exit 0，0 failed**（基线 550 failed/errors 归零）。
  - 0.0.38：`1186 passed, 3 skipped`，**exit 0，0 failed**。
- 测试文件属 P3 提交（HEAD `01923d5d` 已入库），P4 未改动 → 非"改测试让它变绿"。实现只改列类型映射并确由根因（显式 naive 列）解除红灯。
- 业务域定向复跑（backup/star_lifecycle/admin_cleanup/star_migration/cli）全绿。
- `ruff check peekview/`：All checks passed（无新增注释，符合铁律 9）。

## 维度 7 — 18 BDD 覆盖 ✅

| BDD | 承载 | 复核结论 |
|-----|------|---------|
| 1 | `TestBdd01NaiveWritePaths`（naive + aware 两路径） | 实现可推出，测试绿 |
| 2 | `TestBdd02NullRoundTrip` | 可空列正确声明 → 可推出 |
| 3 | `TestBdd03NaiveWhereComparison` | naive 列 bind 不抛错 → 可推出 |
| 4 | `P5`(0.0.38) 全量 0 failed | 独立复跑证实 |
| 5 | `P5_ci_repro`(0.0.47) 全量 0 failed | 独立复跑证实 |
| 6 | `TestBdd06NaiveStorageSemantics` | 无漂移，test 绿 |
| 7 | API 响应 naive ISO 契约 | 响应模型 AST 未变 + 全量绿 |
| 8 | 备份 JSON / CLI 形态 | `test_admin_backup.py`/`test_cli.py` 绿 |
| 9 | `TestBdd09AwareAssignmentPaths`（2 用例） | aware 赋值去时区为 naive，test 绿 |
| 10 | backup restore（merge/replace） | `test_admin_backup.py` 绿 |
| 11 | 归档倒计时 + star 生命周期 | `test_star_lifecycle.py` 绿 |
| 12 | admin 清理 + 用户禁用 | `test_admin_stats_cleanup.py`/user API 绿 |
| 13 | CLI 用户禁用 + 时间展示 | `test_cli.py`/`test_t080_cli_user_disable.py` 绿 |
| 14 | backfill 幂等 | `test_star_migration.py` 绿 |
| 15 | 依赖守卫 + 注入漂移变红 | 独立注入实测 exit 1，已恢复 |
| 16 | 25 列静态扫描全显式 naive | 独立枚举 25/25 `timezone=False`，test 绿 |
| 17 | API 契约不变（前端/MCP 范围外） | 响应模型未变 + 契约承载测试绿 |
| 18 | 生产未污染 | conftest autouse 隔离 + 全测试写 tmp_path；评审未触生产 |

18/18 均可从实现推出可验证结论，无遗漏。

## BLOCKER 清单

**无 BLOCKER。**

## 观察项（非阻断，供 P5/P6 记录）

1. P4-implementation 自述"`ruff check tests/` 报 4 项 I001"位于 P3 产出测试文件内——本任务禁改测试，且 ruff 不在 CI 门禁，不阻断；建议 P7 一致性检查时确认是否登记为既有违规。
2. BDD-15 (ii) 的**端到端**注入实测（编辑 pyproject → 重跑 → 恢复，记录前后 exit code）P3 已固化为单测，P6 须补人工实测记录 `[PROD_NOT_TOUCHED]` 旁证。
3. `revoked_at` 在 diff 中视觉上"移动"实为多行 `created_at` 展开所致；对照 HEAD（L326 created_at / L330 revoked_at）确认**字段顺序未变**，列序无影响。

## 最终结论

**status: approved**。R1（25 列显式 naive）正确完整、无遗漏/错配/重复；R2（`<1.0.0` 上限守卫）可执行且注入漂移实测变红；范围严格限定 table 列，响应模型与迁移 SQL 未动；naive 存储语义与序列化契约保持；双环境全量独立复跑均 0 failed；无 BLOCKER。
