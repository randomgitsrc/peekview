---
phase: P1
task_id: TPV0101
type: problems
parent: P0-brief.md
trace_id: TPV0101-P1-20261002
status: draft
created: 2026-10-02
agent: analyst
# ── v2.0 机器字段 ──
risk_level: high
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages: [peekview]
domains: [backend]
change_type: refactor
# 跳过风险: 无阶段跳过（phases 全走）；P3 因需真红灯证明依赖行为变更（0.0.47 下先失败后通过）；
#           P6 因涉及 schema/数据语义/多子系统（备份恢复、清理、star 生命周期）不可裁。
capability_requirements:
  - need: local-backend-runtime
    why: P3 真红灯 + P5/P6 双环境 pytest 全部需要可运行的 venv Python 与临时隔离数据目录
    available:
      - "backend/.venv（本地 sqlmodel 0.0.38，make test-quick）"
    status: available
# verification_env（环境声明，非 capability 三态；M6）：无外网属运行环境前提，不是可声明可用性的能力。
# /tmp/ci-repro-venv 不在 available 固定清单内——按 P0 重建步骤现场可得（环境准备）。
verification_env: "隔离复现 venv /tmp/ci-repro-venv（sqlmodel 0.0.47 + sqlalchemy 2.0.54，按 P0 重建步骤现场创建）+ 临时 HOME/临时数据目录；沙箱无外网，CI 结果经 gh CLI 读取或以上述隔离 venv 本地复现"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
# ── v2.0 标记"已解决/已确认"状态 ──
need_confirm_resolved: []
suggest_resolved: []
scope_resolved: []
---

# P1 需求基线 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> **[NO_NEED_CONFIRM]**（无未决待确认项；时间字段语义均通过读代码定夺，见同节）

## 0. P0-brief 时效性质疑

已核对 P0-brief 时效性，**无漂移**：P0 于 2026-10-02 立项（与 DEBT0019 登记同日），P1 同日启动，无搁置间隔。逐条复核三判据——

1. **目标技术路线**（显式 `Column(DateTime(timezone=False))` 为 naive 列声明列类型）：成立。本 P1 期间再次核对 `models.py`：所有表模型 datetime 字段均为裸 `datetime` 标注（无 `sa_column`），0.0.47 下确实全部映射为 `UTCDateTime(tz=True)`；`NaiveDatetime` 在本地 0.0.38 不可用仍是事实。
2. **executor_env 平台/运行时前提**：成立。本地 venv（0.0.38）与隔离复现 venv（0.0.47）均可用；后端 pytest 9.1.1 可跑。
3. **known_risks 前提**（naive 存储约定 / 0.0.47 行为 / 影响面）：成立。本文件「同类扫描」节已把 P0 的粗粒度预判做实：naive 写入点 14 行处理命中 + 恢复路径，**aware 写入/比较命中 22 行**（修正版补扫，其中 19 行为同一 bind 面），表模型 datetime 列 **25 列 / 11 表**。

无 `[P0_STALE]`。

## 1. 需求复述

**问题**：项目多处时间字段按 **naive UTC**（无时区的 UTC 值）写入 SQLite（列定义全为无 tz `DATETIME`）。sqlmodel 自 **0.0.47** 起改变了裸 `datetime` 标注列的推断：将其映射为 `UTCDateTime(timezone=True)`，其 `process_bind_param` 在绑定 naive datetime 值时抛 `ValueError: Datetime values must have timezone information`。本地 venv 停在 sqlmodel 0.0.38（不校验），故本地全绿；CI 每次 `pip install -e '.[test]'` 装到最新 0.0.47，导致 Backend Tests 大面积失败（当前 38 failed + 502 errors，自 TPV0099 起，非 TPV0100 引入）。

**要解决什么**：让项目在**最新 sqlmodel（≥0.0.47）**下恢复正常，同时**不改变**既有 naive UTC 存储语义、不破坏 API/备份/CLI 的时间输出契约、不回退本地（0.0.38）行为。并建立**依赖漂移防回归**手段，避免同类问题随上游版本再次复发。

**算对的标准**：CI Backend Tests 在最新依赖下全绿且本地不回归；时间字段存储语义显式且统一（naive 列显式声明 naive；aware 列显式声明 aware）；时间序列化形态契约不变；依赖版本漂移被拦截。

**不在范围内**：不改存储格式（不迁移既有数据）、不改 API 响应字段结构、不新增业务功能、不做 UI 改动。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| 1 | **存储语义必须显式化**：naive 列显式声明 `timezone=False`，aware 列显式声明 `timezone=True` | 仅靠裸 `datetime` 标注，语义随上游版本漂移；一旦 0.0.47 把 naive 列改成 tz-aware 映射，绑定即崩。显式声明是跨版本稳定的唯一手段 |
| 2 | **读路径的 naive 绑定同样要处理**：不仅 UPDATE/INSERT，SELECT 的 WHERE 比较（`expires_at <= now_naive` 等）也把 naive 值作 bind param | 0.0.47 的 `process_bind_param` 对绑定值统一校验，WHERE 比较参数同样触发；只修写入会留下 SELECT 面失败 |
| 3 | **既有数据的读出语义不能漂移**：既有 DB 里存的是 naive UTC 字符串，读出必须仍按 UTC 解释 | 若改为 aware 存储或 aware 校验读路径，`sqlite3` 返回的 naive 字符串会被误当本地时间/加时区，导致过期判定偏移、倒计时错位 |
| 4 | **序列化契约不变**：API 响应、备份 JSON、CLI 输出的时间形态（naive ISO 字符串 vs 带 offset）需要与既有契约一致 | 前端/客户端/备份恢复依赖这些形态；形态变了会静默破坏消费方 |
| 5 | **备份恢复路径要能往返**：restore 从备份 DB 读 naive 时间串并写回模型 | restore 是把 naive 值重新绑定到模型列，是同类缺陷的独立命中面，必须一并恢复 |
| 6 | **多消费方排查**：CLI（`cli.py` 各时间输出 / 用户禁用）、admin（清理/导出/统计）、apikey（过期判定/last_used_at）、star（归档删除倒计时）、database（backfill） | 缺陷是**面状**的（P0 已知 12+ 写入点），只修被报告的 `archive_delete_at` 会留下同类失败 |
| 7 | **依赖防回归机制**：`pyproject.toml` 当前 `sqlmodel>=0.0.14` 无上限，CI 与本地持续漂移 | 上游新版本还会引入同类破坏性变更；没有拦截手段，同类问题必然复发 |
| 8 | **MCP 包影响排查**：MCP server（`packages/mcp-server/`）是否受同一缺陷影响需显式说明 | MCP 是独立包，若其时间处理受同一模型/契约影响必须纳入范围；确认不受影响则显式记「不处理 + 理由」 |
| 9 | **前端消费方一致性**：前端 `transform*` 把 API 时间串转 ISO 字符串 | 后端序列化形态若变，前端展示可能受影响（本任务不改前端，但需确认契约不变以免回归） |
| 10 | **测试环境隔离**：0.0.47 验证不能碰生产 DB（`~/.peekview/`）与生产服务（:8080） | 铁律：用 `conftest.py` 自动隔离 + 隔离 venv + 临时数据目录 |

### 2.1 时间字段存储语义判定（需求核心）

**判定依据三分类**（修正版；每个字段须落到其中一类）：
- **(a) 写入值本身是 naive**：代码显式 `.replace(tzinfo=None)` / `now_naive` / `_naive_utc`，绑定的就是 naive 值。
- **(b) 写入值是 aware，但经 ORM 落库被去时区为 naive**：代码赋 `datetime.now(timezone.utc)`（或 `default_factory=now_utc`），在裸列映射下 SQLAlchemy bind 去掉时区，落库为 naive（0.0.38/0.0.47 均如此）；在「裸列 → 显式 `DateTime(timezone=False)`」修法下同样被去时区、不抛错——但这是**独立 bind 命中面，必须单独覆盖**。
- **(c) 由 SQL 侧 `CURRENT_TIMESTAMP` 生成**：`server_default`/`onupdate` 服务端产生 naive 字符串。

**结论（不变）：所有表模型（`table=True`）的时间列，存储语义均为 naive UTC**——这是既定约定，修复须保持。响应 schema（非表模型）不涉及列类型，其序列化形态由来源字段决定。

> **口径修正（M1）**：初版把多个**实际赋 aware 值**的字段判成「由 naive duration 计算写入 / app 赋 naive」，判定依据写反。评审 §三 已逐字段列表。下表按三分类逐字段修正，并给出实测代码行。

| 字段 | 出现位置（表） | 标注 | 存储语义 | 判定依据（修正） | 本次处理 |
|------|--------------|------|---------|-----------------|---------|
| `created_at` | User/Team/ApiKey/Entry/EntryShare/EntryStar/File（7 表，另有 TeamMember/EntryTombstone 的 joined_at/deleted_at 单列） | 裸 `datetime` + `server_default=CURRENT_TIMESTAMP` + `default_factory=now_utc` | **naive** | **(b)+(c)**：`default_factory=now_utc` 产 aware（被 bind 去时区）；多数插入由 `CURRENT_TIMESTAMP` 覆盖为 naive | ✅ 显式 naive |
| `updated_at` | User/Team/ApiKey/Entry（`onupdate=CURRENT_TIMESTAMP`）、EntryRead/EntryReadStats（`default_factory=now_utc` 无 server_default） | 裸 `datetime` + `onupdate` / `default_factory` | **naive** | **(b)+(c)**：Entry 经 `entry_service.py:817/857` 赋 aware；EntryRead/EntryReadStats 经 `read_tracking_service.py:60/115` 赋 aware；`onupdate` 侧为 (c) | ✅ 显式 naive |
| `expires_at` | Entry/ApiKey/EntryShare（3 表） | 裸 `datetime` | **naive** | **(b)**：`entry_service.py:238/243/828/833`、`apikey_service.py:66`、`share_service.py:89` 均赋 aware `datetime.now(timezone.utc)+delta`（经 ORM 去时区）；读路径比较为混合——apikey 用 naive `now_naive`（:121/152），entry/share 用 aware `now`（entry_service:1360 / share_service:60/172/209/239/269/296），两类比较均经 bind | ✅ 显式 naive |
| `archived_at` | Entry | 裸 `datetime` | **naive** | **(a)**：`admin_service.py:279/282` 赋 `now_naive`（`replace(tzinfo=None)`） | ✅ 显式 naive |
| `archive_delete_at` | Entry | 裸 `datetime` | **naive** | **(a)**：`database.py:754-755` backfill 用 `launch_naive`；`star_service._naive_utc` docstring 明写 | ✅ 显式 naive |
| `disabled_at` | User | 裸 `datetime` | **naive** | **(a)**：`admin_service.py:428` / `cli.py:1799` 赋 `replace(tzinfo=None)` | ✅ 显式 naive |
| `last_used_at` | ApiKey | 裸 `datetime` | **naive** | **(a)**：`apikey_service.py:206` 赋 `now.replace(tzinfo=None)` | ✅ 显式 naive |
| `last_read_at` | EntryReadStats | 裸 `datetime` | **naive** | **(b)**：`read_tracking_service.py:114` 赋 aware `now`（经 ORM 去时区）；restore `_parse_db_datetime` 读 naive（(a)） | ✅ 显式 naive |
| `read_at` | EntryRead（无 `sa_column_kwargs`） | 裸 `datetime` | **naive** | **(b)**：`read_tracking_service.py:47/74` 赋 aware `now`（经 ORM 去时区） | ✅ 显式 naive |
| `revoked_at` | EntryShare | 裸 `datetime` | **naive** | **(b)**：`share_service.py:182/277` 赋 aware `now`（经 ORM 去时区） | ✅ 显式 naive |
| `joined_at` | TeamMember | 裸 `datetime` + `CURRENT_TIMESTAMP` + `default_factory=now_utc` | **naive** | **(b)+(c)**：`team_service.py:157` 赋 aware `datetime.now(timezone.utc)`；插入侧 `CURRENT_TIMESTAMP` | ✅ 显式 naive |
| `deleted_at` | EntryTombstone | 裸 `datetime` + `CURRENT_TIMESTAMP` + `default_factory=now_utc` | **naive** | **(b)+(c)**：`entry_service.py:1058` 赋 aware `datetime.now(timezone.utc)`；插入侧 `CURRENT_TIMESTAMP` | ✅ 显式 naive |
| `starred_at` | EntryStar 响应映射（来自 `EntryStar.created_at`） | 裸 `datetime`（响应字段，非列） | **naive**（来源列 naive） | `StarItem.starred_at = star.created_at`（来源列见 `created_at` / `star_service.py:144` 赋 aware） | ✅ 随来源列显式 naive |
| `latest_created_at` | EntryStats（响应聚合，来自 `func.max(Entry.created_at)`） | 裸 `datetime`（响应字段，非列） | **naive**（来源列 naive） | `admin_service:180` 聚合（聚合结果自然为 naive） | ✅ 随来源列语义 |
| `disabled_at`/其他响应字段 | UserResponse/ShareResponse/ApiKeyResponse 等 | 裸 `datetime`（响应字段，非列） | 随来源列 | 非列，序列化形态由来源字段决定（BDD-7） | ✅ 随来源列语义 |

> **总有 tz-aware 语义的表列？无。** 经核对，无任何表列按 aware 存储。列迁移 SQL 与 `star_service` docstring 均确认 naive 是既定存储约定。`now_utc()` / `datetime.now(timezone.utc)` 在代码中广泛用于赋列，均属上表 (b) 类——内存对象上是 aware，落库被去时区为 naive。本次显式声明 naive 列后，此类 aware 值绑定到 `DateTime(timezone=False)` 会**去掉时区**（不抛错），但仍需 P2 明确策略并作为独立测试覆盖点（见 BDD-1/BDD-4/BDD-9，§4.1 aware 清单）。
>
> 上表行以 `models.py` 的表列字段为单位（共 25 个 datetime 列 / 11 张 `table=True` 表，见 §4.2），响应模型字段随来源语义、不单列声明。

## 3. BDD 验收条件

### 3.1 最新依赖下受影响字段读写正常

#### BDD-1: 最新 sqlmodel（≥0.0.47）下所有 naive 时间列可正常写入
- Given 在 sqlmodel 0.0.47 + sqlalchemy 2.0.54 环境（隔离 venv）中，对每个受影响表模型按两条路径写入各时间列：(i) **按 naive UTC 值写入**（`replace(tzinfo=None)`，分类 a）；(ii) **按 aware `datetime.now(timezone.utc)` 值写入**（分类 b，如 `entry.updated_at = datetime.now(timezone.utc)` / `entry.expires_at = datetime.now(timezone.utc) + delta`）。覆盖 Entry.archive_delete_at/archived_at/expires_at/updated_at、User.disabled_at、ApiKey.last_used_at/expires_at、EntryShare.revoked_at/expires_at、EntryStar.created_at、EntryTombstone.deleted_at、TeamMember.joined_at、Team.updated_at、EntryRead.read_at/updated_at、EntryReadStats.last_read_at/updated_at
- When 提交事务并回读
- Then 两条路径均不抛 `ValueError: Datetime values must have timezone information`，且回读值与写入的 UTC 时刻等价（naive 路径无时区偏移；aware 路径回读为等价 UTC 时刻的 naive 值，无时区漂移）

#### BDD-2: 最新 sqlmodel 下 naive 时间列的可空值与 NULL 读写正常
- Given 同一 0.0.47 环境，受影响列为 NULL 或从 NULL 赋值为 naive 值
- When 保存并回读
- Then 均为 NULL 时不抛错；赋值为 naive 值时回读等于该值

#### BDD-3: 最新 sqlmodel 下读路径的 naive 绑定比较不抛错
- Given 同一 0.0.47 环境，存在 `expires_at` / `archive_delete_at` / `archived_at` 为 naive 值的记录
- When 执行使用 naive 绑定参数的时间比较查询（如"未过期 key 计数"、`expires_at <= now_naive` 的清理选择、归档倒计时判定）
- Then 查询正常返回，不抛绑定时区异常，且选择结果与 naive UTC 语义一致

### 3.2 跨版本不回归

#### BDD-4: 本地 sqlmodel（0.0.38）行为不回归
- Given 本地 venv（sqlmodel 0.0.38 + sqlalchemy 2.0.51）
- When 运行受影响字段的读写与既有测试
- Then 全部通过，且不出现 `ValueError: ... has no matching SQLAlchemy type`（`NaiveDatetime` 标注在 0.0.38 的已知失败形态）

#### BDD-5: 两版本全量测试均绿
- Given 本地 0.0.38 环境与隔离 0.0.47 环境
- When 分别运行后端完整测试套件（`make test-quick` 与隔离 venv 等价命令）
- Then 两环境均全绿（0 failed），失败面清单（38 failed + 502 errors）归零

### 3.3 存储语义与序列化契约

#### BDD-6: naive UTC 存储语义保持，既有数据读出无时区漂移
- Given 既有数据库中存在 naive UTC 存储的时间值（含迁移新增列 `archived_at`/`archive_delete_at`/`disabled_at`，以及 `_row_get` + `_parse_db_datetime` 读取的备份值）
- When 通过应用读路径读出这些字段
- Then 读出的 UTC 时刻与入库前的 UTC 时刻相等；`build_countdown` 等基于这些值的计算不发生时区偏移（倒计时剩余天数与 naive UTC 差一致）

#### BDD-7: API 响应时间形态契约不变
- Given 一个含 `created_at`/`updated_at`/`expires_at`/`archived_at`/`disabled_at`/`last_used_at` 等字段的 entry/user/api-key 响应
- When 调用对应 API 端点
- Then 每个时间字段的序列化形态（naive ISO 字符串，无 `+00:00` offset）与修复前一致，字段名、可选性、类型不变

#### BDD-8: 备份导出 JSON 与 CLI 输出的时间形态契约不变
- Given 对含时间字段的 entry/user 执行备份导出与 CLI 列表/统计命令
- When 读取导出 JSON 与 CLI 标准输出中的时间字段
- Then 时间形态（`isoformat()` 输出格式，naive 无 offset）与修复前一致，不出现新的时区后缀或格式变化

#### BDD-9: 全部 aware 赋值路径在最新依赖下绑定为 naive UTC 存储
- Given 通过应用的全部 **aware 赋值路径**写入各时间列（`default_factory=now_utc` 产 aware 的 `created_at`/`updated_at`/`joined_at`/`deleted_at`；`entry_service.py:817/828/833/857/1058`、`share_service.py:89/182/277`、`team_service.py:127/157`、`star_service.py:144`、`apikey_service.py:66`、`read_tracking_service.py:47/60/74/114/115/261` 赋 `datetime.now(timezone.utc)`；覆盖 §4.1.2 全部写列命中点 b1–b19）
- When 在 0.0.47 环境提交并回读
- Then 绑定不抛错，且回读值为等价 UTC 时刻的 naive 值（存储层无 tz），API 序列化形态与既有契约一致（配合 BDD-7）；覆盖全部 (b) 类绑定路径，无遗漏

#### BDD-10: 备份恢复（restore）在最新依赖下成功且时间值往返一致
- Given 在 0.0.47 环境，从备份 DB 恢复含 `expires_at`/`last_used_at`/`last_read_at`/`updated_at` 等时间字段的 entry/user/api_key/share/read_stats 记录
- When 执行 restore（merge 与 replace 两条路径）
- Then 恢复成功不抛绑定异常，且恢复后各时间字段的值与备份源值等价（naive UTC 往返一致）

### 3.4 受影响业务域

#### BDD-11: 归档删除倒计时与 star 生命周期正常
- Given 一个已归档且有 `archive_delete_at` 的 entry，处于未星标 / 已星标两种状态
- When 查询 countdown 与执行 star/unstar 生命周期操作
- Then 倒计时状态（running/paused/expired）和剩余天数按 naive UTC 正确计算，star/unstar 不因时间绑定失败

#### BDD-12: admin 清理与用户禁用流程正常
- Given 存在过期 entry、过期 API key、归档到期 entry 与待禁用用户
- When 执行 admin 清理（archive/delete/reads cleanup）与禁用/启用用户
- Then 流程成功，`expires_at`/`archived_at`/`archive_delete_at`/`disabled_at` 按 naive UTC 正确写入与判定

#### BDD-13: CLI 用户禁用与时间展示正常
- Given 通过 CLI 禁用用户 / 列出 entry / 查看统计
- When 在 0.0.47 环境执行
- Then `disabled_at` 以 naive UTC 写入成功，CLI 输出的时间字段形态与修复前一致

#### BDD-14: backfill_archive_delete_at 幂等正常
- Given 存在 `status=archived` 且 `archive_delete_at IS NULL` 的 legacy entry
- When 在 0.0.47 环境执行 backfill（并重复执行）
- Then 成功写入 naive UTC deadline，重复执行不改变已有非 NULL 值（幂等），不触碰 `PRAGMA user_version`

### 3.5 依赖防回归

#### BDD-15: 依赖漂移守卫存在、可执行且注入漂移时变红
- Given 修复后的仓库状态（P4 产出，`pyproject.toml` 对 sqlmodel 声明了可机械校验的约束/锁定，或存在 CI 依赖一致性检查脚本）
- When 运行该守卫（读取 `pyproject.toml` 的 sqlmodel 版本约束，或执行 CI 依赖一致性检查脚本）
- Then (i) 守卫**存在且可执行并返回成功**；(ii) 人为注入一次漂移（临时放宽/移除版本约束，或改动依赖声明使本地/CI 版本不一致）后重跑，守卫**返回失败（变红）**，而非静默放过
- 判定为**实测**（真实运行两次，记录前后退出码/输出），不接受推理

> **设计意图注记（非 BDD Then）**：本条的长期目标是「上游 sqlmodel 再次引入同类破坏性变更时能被拦截」。P1 无法构造「上游发布」事件，故不写为 Then；交由 P2 在「锁上限 vs CI 一致性检查」之间定手段，P4 落地守卫。

#### BDD-16: 全部表模型 datetime 列显式声明时区语义，静态可核验
- Given 修复后的模型定义
- When 静态扫描**全部表模型 datetime 列**（ORM 枚举 `__table__.columns`：11 张 `table=True` 表共 25 个 datetime 列，见 §4.2）
- Then 25 个 datetime 列**每一个**均带**显式**时区声明（naive 列 `timezone=False`；若未来出现 aware 列则 `timezone=True`），不存在裸 `datetime` 标注导致的时区语义不确定；扫描计数为 25，无遗漏（含 `Entry` 继承自 `EntryBase` 的 3 列）

### 3.6 范围外确认

#### BDD-17: 修复不改变 API 序列化形态契约（前端与 MCP 为间接消费方）
- Given 修复前后端 API 时间序列化形态一致（见 BDD-7/BDD-8 的可观测断言：每个时间字段为 naive ISO 字符串、无 `+00:00` offset、字段名/可选性/类型不变）
- When (i) 检查 entry/user/api-key/share 响应中时间字段的序列化字符串；(ii) 以同一 API 响应字符串驱动 MCP 时间消费点（`packages/mcp-server/src/tools/createEntry.ts:118-122`、`publishFiles.ts:550-552` 的 `new Date(expires_at)` 渲染），比较修复前后 MCP 输出的日期文本
- Then 响应时间字段的序列化字符串逐字段相等（形态契约不变）；同一响应字符串下 MCP 渲染的日期文本不变（MCP 经 API 消费、无可观测行为变化）
- **显式范围外**：前端展示（`frontend-v3/`）为**间接依赖**——它只消费 API 字符串（§4.3），其展示正确性由 BDD-7 的 API 契约不变**间接保证**；本任务 `domains: [backend]`，**不跑前端测试、不对前端展示做 PASS/FAIL 判定**。MCP 自有时间列不存在（§4.3），其时间行为同样仅由 API 契约间接保证（上述 (ii) 为可观测断言，不作独立行为判定）。

#### BDD-18: 生产数据与失败面数据未被测试污染
- Given 所有 0.0.47 验证在临时 HOME / 临时数据目录 / 隔离 venv 中进行
- When 修复验证完成
- Then 生产数据库 `~/.peekview/peekview.db` 未被写入或修改，生产服务 :8080 未被触碰

## 4. 同类扫描（强制节）

**扫描动作**：对关键符号 `replace(tzinfo=None)` / `utcnow()` / `_naive_utc` / `now_naive` / `launch_naive` / `DATETIME` 及 `models.py` 全部 `datetime` 标注做全仓 grep（`backend/peekview/**/*.py`）。结论如下。

### 4.1 命中点清单（naive 写入点 + aware 写入点，逐条判定）

**扫描动作（两条）**：
1. **naive 写入点**：grep `replace(tzinfo=None)` / `utcnow()` / `_naive_utc` / `now_naive` / `launch_naive`。
2. **aware 写入点（M1 补扫，初版漏扫）**：grep `datetime.now(timezone.utc)` / `now_utc()`，逐条判是否**绑定到表列**——是则并入下表（与 naive 写入点构成**同一 bind 命中面**）；否（JWT exp / 字符串格式化 / 时间戳）则判「不处理 + 理由」。

> **为何 aware 写入点也属本次问题面**：在「裸列 → 显式 `DateTime(timezone=False)`」修法下，aware 值绑定同样经过 `process_bind_param`（被去时区而非抛错，0.0.38/0.0.47 均如此）。因此它们是**独立测试覆盖点，不能漏**——只覆盖 naive 写入点的红灯测试会漏掉整条 aware 赋值面。

#### 4.1.1 naive 写入点（分类 a）

| # | 位置 | 内容 | 判定 |
|---|------|------|------|
| 1 | `database.py:754-755` | `launch_naive = datetime.now(timezone.utc).replace(tzinfo=None)`；`deadline = launch_naive + timedelta` | ✅ 本次处理（backfill 写 `archive_delete_at`） |
| 2 | `cli.py:1799` | `user.disabled_at = datetime.now(timezone.utc).replace(tzinfo=None)` | ✅ 本次处理 |
| 3 | `services/admin_service.py:75` | `_naive_utc` 辅助函数（`replace(tzinfo=None)`） | ✅ 本次处理（间接写/比较） |
| 4 | `services/admin_service.py:158` | `now_naive = datetime.now(timezone.utc).replace(tzinfo=None)` | ✅ 本次处理（清理选择/比较） |
| 5 | `services/admin_service.py:225` | `now_naive` 使用点（清理统计） | ✅ 本次处理 |
| 6 | `services/admin_service.py:264` | `now_naive` 使用点（归档/删除选择，L271/L279/L282 写 `archived_at`/`archive_delete_at`） | ✅ 本次处理 |
| 7 | `services/admin_service.py:428` | `user.disabled_at = datetime.now(timezone.utc).replace(tzinfo=None)` | ✅ 本次处理 |
| 8 | `services/apikey_service.py:121` | `now_naive = now.replace(tzinfo=None)`（未过期 key 计数比较 L125） | ✅ 本次处理（读路径比较） |
| 9 | `services/apikey_service.py:152` | `now_naive = now.replace(tzinfo=None)`（清理选择 L158） | ✅ 本次处理 |
| 10 | `services/apikey_service.py:206` | `api_key.last_used_at = now.replace(tzinfo=None)` | ✅ 本次处理 |
| 11 | `services/star_service.py:42` | `_naive_utc`（`astimezone(...).replace(tzinfo=None)`） | ✅ 本次处理 |
| 12 | `services/star_service.py:92` | `now = datetime.now(timezone.utc).replace(tzinfo=None)`（倒计时） | ✅ 本次处理 |
| 13 | `services/admin_service.py:967/1009/1106` | restore 用 `_parse_db_datetime` 解析 naive 串后赋 `expires_at`/`last_used_at` | ✅ 本次处理（恢复路径写入点） |
| 14 | `services/admin_service.py:1083-1084` | restore 赋 `last_read_at`/`updated_at`（naive 解析值） | ✅ 本次处理 |
| 15 | `services/read_tracking_service.py:48` | `window_ts = now.strftime(...)`（字符串窗口键，非 datetime 列绑定） | ⚪ 本次不处理——写入 `window_key` 字符串列，不经 datetime 绑定；但与时间语义相关，P2 影响面梳理时确认其比较逻辑（`:248 fromisoformat`）不受影响 |
| 16 | `client.py:88-89` / `admin_service.py:1257` / `read_tracking_service.py:248` | `datetime.fromisoformat(...)` 解析（读入侧） | ⚪ 本次不处理——解析后的值用于内存/响应，不作为 naive 绑定写入目标；但 client 解析出的 naive/aware 取决于 API 返回形态，由 BDD-7 契约兜底 |

#### 4.1.2 aware 写入点（分类 b；M1 补扫，逐条判定）

> 全部命中点均赋/比较 `datetime.now(timezone.utc)`。**写列**命中点并入同一 bind 命中面 → 本次处理；**读路径比较**命中点同样经 `process_bind_param` → 本次处理；**非列绑定**（JWT / 字符串）→ 不处理。

| # | 位置 | 内容（目标列） | 判定 |
|---|------|--------------|------|
| b1 | `services/entry_service.py:238/243` | `expires_at = datetime.now(timezone.utc) + delta`（Entry.expires_at，新建路径） | ✅ 本次处理（aware 写列，bind 命中面） |
| b2 | `services/entry_service.py:817` | `entry.updated_at = datetime.now(timezone.utc)`（Entry.updated_at） | ✅ 本次处理（aware 写列） |
| b3 | `services/entry_service.py:828/833` | `entry.expires_at = datetime.now(timezone.utc) + delta`（Entry.expires_at） | ✅ 本次处理（aware 写列） |
| b4 | `services/entry_service.py:857` | `entry.updated_at = datetime.now(timezone.utc)`（Entry.updated_at） | ✅ 本次处理（aware 写列） |
| b5 | `services/entry_service.py:1058` | `deleted_at=datetime.now(timezone.utc)`（EntryTombstone.deleted_at） | ✅ 本次处理（aware 写列） |
| b6 | `services/entry_service.py:1360` | `now = datetime.now(timezone.utc)`（读路径比较，如过期/归档判定） | ✅ 本次处理（aware 比较，bind 命中面） |
| b7 | `services/share_service.py:89` | `expires_at = now + delta`，`now` 源 `:60` aware（EntryShare.expires_at，新建） | ✅ 本次处理（aware 写列） |
| b8 | `services/share_service.py:182` | `s.revoked_at = now`（EntryShare.revoked_at，批量 revoke） | ✅ 本次处理（aware 写列） |
| b9 | `services/share_service.py:277` | `share.revoked_at = now`（EntryShare.revoked_at，entry 删除时 revoke） | ✅ 本次处理（aware 写列） |
| b10 | `services/share_service.py:60/172/209/239/269/296` | `now = datetime.now(timezone.utc)`（share 读路径比较/有效期判定） | ✅ 本次处理（aware 比较，bind 命中面） |
| b11 | `services/team_service.py:127` | `team.updated_at = datetime.now(timezone.utc)`（Team.updated_at） | ✅ 本次处理（aware 写列） |
| b12 | `services/team_service.py:157` | `TeamMember(..., joined_at=datetime.now(timezone.utc))`（TeamMember.joined_at） | ✅ 本次处理（aware 写列） |
| b13 | `services/star_service.py:144` | `created_at=datetime.now(timezone.utc)`（EntryStar.created_at） | ✅ 本次处理（aware 写列） |
| b14 | `services/apikey_service.py:66` | `expires_at = datetime.now(timezone.utc) + delta`（ApiKey.expires_at） | ✅ 本次处理（aware 写列） |
| b15 | `services/apikey_service.py:118/151/175` | `now = datetime.now(timezone.utc)`（未过期计数 / 清理选择 / 校验比较，读路径） | ✅ 本次处理（aware 比较，bind 命中面） |
| b16 | `services/read_tracking_service.py:47` | `now = datetime.now(timezone.utc)`（本次 record 快照源） | ✅ 本次处理（间接写列，见 b17/b18） |
| b17 | `services/read_tracking_service.py:60/74` | `existing.updated_at = now` / `read_at=now`（EntryRead.read_at/updated_at） | ✅ 本次处理（aware 写列） |
| b18 | `services/read_tracking_service.py:114/115` | `stats.last_read_at = now` / `stats.updated_at = now`（EntryReadStats.last_read_at/updated_at） | ✅ 本次处理（aware 写列） |
| b19 | `services/read_tracking_service.py:261` | `updated_at=datetime.now(timezone.utc)`（restore 重建 EntryReadStats.updated_at） | ✅ 本次处理（aware 写列，恢复路径） |
| b20 | `auth.py:112` | `now = datetime.now(timezone.utc)`（JWT `exp`，非 DB 列） | ⚪ 本次不处理——JWT 声明，不绑定表列，与 ORM bind 无关 |
| b21 | `services/admin_service.py:225` | `today_start = datetime.now(timezone.utc).replace(...)`（统计窗口下界，非列绑定） | ⚪ 本次不处理——仅用于内存过滤/字符串比较，不绑定 datetime 列（注：同文件 L158/264/428 的 naive 化点已入 §4.1.1） |
| b22 | `services/admin_service.py:555/604` | `datetime.now(timezone.utc).strftime(...)`（备份文件名 / 备份元数据时间戳字符串） | ⚪ 本次不处理——生成字符串，不绑定列 |

**两条扫描合并结论**：naive 面（§4.1.1）14 行「本次处理」代码点（#1–#14）+ 2 行「不处理」（#15/#16）；aware 面（§4.1.2）19 行「本次处理」（b1–b19，含写列与读路径比较）+ 3 行「不处理」（b20–b22，非列绑定）。二者在「裸列 → 显式 naive 列」修法下构成**同一 `process_bind_param` 命中面**——**面状缺陷不省略一半**：红灯测试覆盖须同时命中 (a) naive 绑定、(b) aware 绑定、(c) `CURRENT_TIMESTAMP` 三类路径，不得只覆盖 naive 一面。

**扫描覆盖确认**：`database.py` 迁移 SQL 的 `DATETIME` 列（L89/102/117/137/164/243/244/251）= 8 处，均**不需要改 SQL**（列类型本就是无 tz DATETIME，属既定约定），仅需保证模型列映射与之匹配（显式 naive）——故迁移 SQL 本身**本次不处理**，理由是存放格式正确、问题在 ORM 映射层。

### 4.2 字段清单（表模型 datetime 列，共 25 列 / 11 表）

**口径**：ORM 枚举 `__table__.columns`（11 张 `table=True` 表），筛 `DateTime` 类型列 → **25 个 datetime 列**。此前 `model_fields` 口径得 16，因漏计 `Entry` 从 `EntryBase` **继承**的 `expires_at`/`archived_at`/`archive_delete_at`；`grep datetime` 的 56 计入响应模型/非字段行，口径错误。**以 `__table__.columns` 的 25 为准。**

| 表 | datetime 列（数量） |
|----|-------------------|
| User | disabled_at, created_at, updated_at（3） |
| Team | created_at, updated_at（2） |
| TeamMember | joined_at（1） |
| ApiKey | expires_at, last_used_at, created_at, updated_at（4） |
| Entry | expires_at, archived_at, archive_delete_at, created_at, updated_at（5） |
| EntryShare | expires_at, created_at, revoked_at（3） |
| EntryRead | read_at, updated_at（2） |
| EntryStar | created_at（1） |
| EntryTombstone | deleted_at（1） |
| EntryReadStats | last_read_at, updated_at（2） |
| File | created_at（1） |
| **合计** | **25 列 / 11 表** |

逐列判定：**25 列全部本次处理**（表模型列显式声明 naive）。按字段类别汇总（数量为上述列）：

| 字段类别 | 表列数 | 处理判定 |
|---------|-------|---------|
| `created_at` | 7（User/Team/ApiKey/Entry/EntryShare/EntryStar/File） | ✅ 本次处理（表列显式 naive；注意 aware `default_factory` 绑定策略） |
| `updated_at` | 6（User/Team/ApiKey/Entry/EntryRead/EntryReadStats） | ✅ 本次处理（含无 `sa_column_kwargs` 的 `EntryRead`/`EntryReadStats`） |
| `expires_at` | 3（Entry/ApiKey/EntryShare） | ✅ 本次处理 |
| `archived_at` | 1（Entry） | ✅ 本次处理 |
| `archive_delete_at` | 1（Entry） | ✅ 本次处理（DEBT0019 原始报告点） |
| `disabled_at` | 1（User） | ✅ 本次处理 |
| `last_used_at` | 1（ApiKey） | ✅ 本次处理 |
| `last_read_at` | 1（EntryReadStats） | ✅ 本次处理 |
| `read_at` | 1（EntryRead） | ✅ 本次处理（无 `sa_column_kwargs`，易漏） |
| `revoked_at` | 1（EntryShare） | ✅ 本次处理 |
| `joined_at` | 1（TeamMember） | ✅ 本次处理 |
| `deleted_at` | 1（EntryTombstone） | ✅ 本次处理 |
| **表列合计** | **25** | |
| `starred_at`（响应，来源 `EntryStar.created_at`） | —（非列） | ✅ 随来源列（无需单列声明） |
| `latest_created_at`（响应聚合，`max(Entry.created_at)`） | —（非列） | ✅ 随来源列（无需单列声明） |

### 4.3 其他扫描面

| 扫描对象 | 命中 | 判定 |
|---------|------|------|
| 裸 `datetime` 标注的表列 | `models.py` 全部同名字段 | ✅ 本次处理（BDD-16 静态可核验：25 列 / 11 表全覆盖） |
| MCP 包时间处理 | `packages/mcp-server/` 无直接 datetime 列绑定，走 HTTP API | ✅ 本次不处理——MCP 经 API 消费，无自有 ORM 时间列；受 BDD-7 契约保护（若 P2 发现 MCP 有独立时间解析则 [SCOPE+] 回补） |
| 前端 `transform*` 时间处理 | `frontend-v3/src/**` | ⚪ 本次不处理——前端只消费 API 字符串，不在同一问题面；由 BDD-7/BDD-17 契约兜底 |
| `pyproject.toml` 依赖上限 | `sqlmodel>=0.0.14` 无上限 | ✅ 本次处理（BDD-15 防回归） |
| CI 安装流程 | `ci.yml` `pip install -e ".[test]"` 无锁定 | ✅ 本次处理（BDD-15） |
| 测试含时间断言 | `backend/tests/**` | ✅ 本次处理——0.0.47 下现有断言应转绿；P3 需补红灯测试 |

### 4.4 回归拦截（同类问题未来还会新增吗？）

**会。** `pyproject.toml` 对 sqlmodel 无上限，上游新版本仍可能引入同类破坏性变更（0.0.47 就是一个例子）。因此需求要求**机械拦截手段**（BDD-15）+ **静态可核验的显式时区声明**（BDD-16）。具体取舍（锁上限 vs CI 一致性检查）在 P2 定，但 BDD-15 要求拦截**可执行且会失败**，不接受纯文档约定。

> 本任务**不新增/改名 `agate/scripts/` 下文件**，故不触发「新增脚本登记面」实测要求。

## 5. 范围声明

- `packages: [peekview]`——仅后端包 `peekview`。MCP 包（`packages/mcp-server/`）经 API 消费，无同一缺陷面（§4.3），本次不改；前端不在域内。
- `domains: [backend]`——无 frontend / mcp 域；无 UI 改动，**不声明 `ui_render_shape` / `ui_ux_dimensions`**。
- `change_type: refactor`——本质是兼容性修复/重构，不新增功能、不改外部契约。

## 6. 能力需求声明

| need | why | available | status |
|------|-----|-----------|--------|
| `local-backend-runtime` | P3 真红灯 + P5/P6 双环境 pytest | `backend/.venv`（0.0.38） | `available` |

**运行环境声明（`verification_env`，M6 修正）**：隔离复现 venv `/tmp/ci-repro-venv`（sqlmodel 0.0.47 + sqlalchemy 2.0.54）**按 P0 重建步骤现场创建即可得**，属环境准备而非固定可用能力，故不列入 `available`；同理「无外网」是沙箱环境前提（CI 结果经 gh CLI 读或隔离 venv 本地复现），不是一项可声明可用性的能力。两者一并声明为 `verification_env`（见 frontmatter）。`verification_env_budget`：止损轮次 2（独立计数，不占 `retries[P5]`）。

无 `[CAPABILITY_GAP]`。本任务无 frontend 域，不触发 vision 硬拦。

## 7. 裁剪说明

`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`——**全走，无裁剪**。

- **P2 不可裁**：涉及核心表 schema 映射 + 数据语义 + 多子系统。
- **P3 保留**：需真红灯证明依赖行为变更（0.0.47 下先失败 → 修复后通过），属"medium/high risk 必须走 TDD 红灯"。
- **P5 保留**：须双环境验证（本地 0.0.38 全绿 + 隔离 0.0.47 全绿）。
- **P6 不可裁**：涉及 schema/数据语义/多端（API+备份+CLI），BDD 逐条实跑。
- **P7 保留**：多文件改动（models.py + pyproject.toml + CI + 测试）。
- **P8 保留**：纯修复对版本策略有影响，需发布准备（releaser 只产出文件）。

## 8. 待确认清单

`[NO_NEED_CONFIRM]`——无未决待确认项。时间字段存储语义全部通过读代码定夺（§2.1）；依赖防回归的具体手段（锁上限 vs CI 一致性检查）属**方案选择**，P2 设计阶段定夺，不阻塞 P1。无阻塞级待确认项、无 `status: GAP`。

## 9. 修订历史

- 2026-10-02：初版（analyst，TPV0101 P1）。
- 2026-10-02：**round 1 修订**（analyst，回派 requirements-review M1–M6）——修正 §2.1 判定依据三分类（多个字段实为 aware 赋值，分类 b）+ §4.1 合并 naive/aware 双扫描清单；BDD-15 改可二值判定（守卫存在 + 注入漂移实测变红）；BDD-17 降为 API 契约不变 + 显式范围外；BDD-1/BDD-9 Given 纳入 aware 场景；BDD-16 扫描范围改全部表模型 datetime 列（**25 列 / 11 表**，经 `__table__.columns` ORM 枚举复核）；`capability_requirements` 的 `no-external-network` 改述为 `verification_env`。
