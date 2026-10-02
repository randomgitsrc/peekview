---
task: "修复 sqlmodel 0.0.47 起将裸 datetime 列推断为 tz-aware（UTCDateTime）导致的 naive-UTC 写入大面积失败：为项目 naive 存储的时间字段显式声明 naive 列类型，恢复 CI Backend Tests 全绿"
task_id: TPV0101
created: 2026-10-02
source_debt: DEBT0019
known_risks:
  - "同类/影响面预判（grep 全库 `replace(tzinfo=None)` / `utcnow()`）：naive 写入点命中 12+ 处，分布 cli.py:1799 / services/admin_service.py(75,158,225,264,428) / services/apikey_service.py(121,152,206) / services/star_service.py(42,92) / database.py:754——确认是面状缺陷，不能只修被报告的那一处（archive_delete_at）"
  - "同类/影响面预判（字段清单，models.py grep 结果）：涉及列 archived_at×4 / archive_delete_at×2 / created_at×16 / deleted_at×2 / disabled_at×2 / expires_at×10 / joined_at×1 / last_read_at×2 / last_used_at×2 / read_at×2 / revoked_at×2 / starred_at×1 / updated_at×9——须逐列判定存储语义（naive vs aware）后再改，禁止一刀切"
  - "同类/影响面预判（存储层）：所有 SQLite 列定义为无 tz 的 DATETIME（database.py:89,102,117,137,164,243,244,251），且 star_service._naive_utc docstring 明写 'matching the archive_delete_at storage'——naive 存储是既定约定，修复须保持（不得改为 aware 存储，否则既有数据读出时区漂移）"
  - "同类/影响面预判（跨版本修法已验证）：显式 `sa_column=Column(DateTime(timezone=False))` 在本地 sqlmodel 0.0.38 与 CI 0.0.47 均绑定 naive 值成功；而 `NaiveDatetime` 标注在 0.0.38 报 'has no matching SQLAlchemy type'——修法必须兼容两版本"
  - "同类/影响面预判（未来实例）：pyproject `sqlmodel>=0.0.14` 无上限，CI 与本地依赖会持续漂移，同类问题还会因上游新版本复发——需防回归手段（锁依赖上限 / CI 版本一致性检查）"
  - "回归面广：缺陷跨 Entry/User/ApiKey/EntryShare/EntryStar 表 + 备份恢复/清理/star 生命周期/CLI/admin 域；CI 现为 38 failed + 502 errors，修复须全量 pytest（最新依赖）全绿，且本地（0.0.38）不得回归"
  - "时序/数据语义：naive UTC 与 aware UTC 混用若处理不当会导致库存值/读出值时区偏移——须保证序列化（API 响应/备份 JSON/CLI 输出）形态不破坏既有契约"
executor_env:
  platform: "opencode"
  has_task_tool: true
  has_local_runtime: true
  network: "restricted（沙箱无外网：git push / CI 直连不可用；CI 结果只能经 gh CLI 读取或以隔离 venv 本地复现）"
env_constraints:
  debug_env: "make debug（:8888，独立数据目录 /tmp/peekview-debug/）；测试用 make test-quick（venv）/ make typecheck；CI 等价后端命令：cd backend && python -m pytest tests/ -v（CI 用全新 pip install -e '.[test]'）"
  local_dep_versions: "本地 venv = sqlmodel 0.0.38 / sqlalchemy 2.0.51 / pytest 9.1.1；CI = sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1 —— 核心差异为 sqlmodel 版本"
  ci_repro: "隔离 venv 复现 CI 版本（项目已验证可行）：python3 -m venv /tmp/ci-repro-venv && pip install -e '.[test]'；本地复现 0.0.47 行为是 P5/P6 的关键验证手段（沙箱无法直连 CI）"
  prod_not_touch: "严禁触碰生产 :8080 / ~/.peekview/（AGENTS.md 铁律）"
---

# P0 简报 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

## 一、问题陈述

CI Backend Tests 自 TPV0099 起长期失败（当前 38 failed + 502 errors），根因为**上游 sqlmodel 0.0.47 的破坏性行为变更**：

- sqlmodel 0.0.47 起，裸 `datetime` 标注的列被映射为 `UTCDateTime(timezone=True)`，其 `process_bind_param` 在绑定 **naive** datetime 时抛 `ValueError: Datetime values must have timezone information`（`sqlmodel/sql/sqltypes.py:34`）
- 仅 `NaiveDatetime` 标注映射为 `DateTime(timezone=False)` 可接受 naive 值
- 项目多处时间字段**设计上按 naive UTC 存储**（SQLite 列全为无 tz `DATETIME`、`_naive_utc` 工具函数、注释均一致），本地 sqlmodel 0.0.38 不校验故全绿，CI 新装 0.0.47 即大面积失败

**非 TPV0100 引入**：TPV0100 后端零改动，失败早于本任务（TPV0099 的 CI run 同样红）。本任务修复该既有缺陷。

## 二、最窄切入点（MVP）

**恢复 CI Backend Tests 在最新依赖下全绿，且本地（0.0.38）不回归**。

- 为项目 naive 存储的时间列显式声明列类型（`Column(DateTime(timezone=False))`，跨版本稳定）
- 判定口径：存储语义为 naive 的列 → 显式 naive；确为 aware 语义的列 → 保持/显式 aware
- **不引入**新的数据迁移、不改存储格式、不改 API 响应契约（除非 P1 证明必要）

## 三、同类/影响面预判结论（粗粒度）

| 维度 | 结论 |
|------|------|
| 同类实例 | naive 写入点 **12+ 处**，跨 6 个文件（cli/admin_service/apikey_service/star_service/database）——**面状**，不是单点 |
| 涉及列 | 14 类时间字段（created_at/updated_at/expires_at/archived_at/archive_delete_at/disabled_at/last_used_at/last_read_at/read_at/revoked_at/starred_at/joined_at/deleted_at/latest_created_at） |
| 上下游消费方 | SQLite 存储（DATETIME 无 tz）、API 响应序列化、备份 JSON、CLI 输出、前端 `transform*`（ISO 字符串） |
| 未来实例 | pyproject `sqlmodel>=0.0.14` 无上限 → 依赖漂移会复发；须加防回归（锁版本 / CI 一致性检查） |

## 四、P0-brief 时效性自检

本 P0 于 **2026-10-02** 立项，紧接 DEBT0019 登记（同日），**无搁置间隔**。对照漂移判据：
1. 目标技术路线（显式 naive 列类型）——成立（已隔离复现验证）
2. executor_env 平台/运行时前提——成立（本地 venv + 隔离复现 venv 均可用）
3. known_risks 前提（naive 存储约定 / 0.0.47 行为）——成立（本轮刚实测确认）

**判定：已核对，无漂移。**

## 五、环境自检结果

| 项 | 结果 |
|----|------|
| 平台 | OpenCode（有 Task 工具、Skill 工具） |
| 后端 pytest | ✅ pytest 9.1.1（`backend/.venv`） |
| 前端 vue-tsc / vitest | ✅ 5.9.3 / 1.6.1 |
| ruff | ✅ 0.15.22 |
| MCP node_modules | ✅ OK |
| 本地 venv 版本 | sqlmodel 0.0.38 / sqlalchemy 2.0.51 / pytest 9.1.1 |
| CI 等价复现 | ✅ 隔离 venv（0.0.47/2.0.54/9.1.1）可重建（TPV0100 复现已验证） |
| git 工作区 | ✅ 干净 |
| debug :8888 | 当前 down（P0 不强制；P5/P6 时经后台 job 起） |
| 生产 :8080 | 未触碰（`[PROD_NOT_TOUCHED]`） |

## 六、裁剪倾向（供后续阶段参考，最终由各阶段 gate 判定）

- **P1/P2/P6 不可裁**（涉及 schema/数据语义/跨子系统）
- **P3 保留**：修复需真红灯证明（0.0.47 下失败 → 修复后通过）
- **P4/P5**：本任务**无 UI 改动**，P6 不需要 Playwright 截图（`ui_affected: false`）；P5 须双环境验证（本地 0.0.38 全绿 + 隔离 0.0.47 全绿）
- **P7 保留**（多文件改动）
- **P8**：版本策略待定（纯修复 → patch？还是随下次功能版本；P1/P2 定）
