---
phase: P2
task_id: TPV0101
type: design
parent: P1-requirements.md
trace_id: TPV0101-P2-20261002
status: draft
created: 2026-10-02
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 3
packages: [peekview]
domains: [backend]
ui_affected: false
---

# P2 方案设计 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 上游输入：P1-requirements.md（18 BDD / risk_level=high / domains=[backend] / packages=[peekview] / change_type=refactor）、P0-brief.md（env_constraints + known_risks）、P1-review.md（status: approved）。
> 本设计**不含 UI 设计节**（`ui_affected: false`，无显示/交互变化）。

---

## 0. 影响面梳理（强制节，先于候选方案）

> 量级来源：P0「同类/影响面预判」→ P1 §4.1「双扫描清单（naive 写入点 14 行 + aware 命中 22 行，其中 19 行同属 bind 面）+ §4.2 字段清单（25 列 / 11 表）」→ 本节做**候选方案级**的影响域分析。

### 0.1 改什么（Modify）— 逐文件/逐函数 + BDD 关联

改动分三组：**R1 模型列显式化**（核心）、**R2 依赖防回归守卫**、**R3 测试补充**。

#### R1 模型列显式化（`backend/peekview/models.py`，核心改动）

将 11 张 `table=True` 表的 **25 个 datetime 列**由裸 `datetime` 标注改为显式 naive 列：
`sa_column=Column(DateTime(timezone=False), nullable=..., server_default=..., onupdate=...)`。
关键约束：SQLModel 的 `sa_column_kwargs` **只能传列关键字、不能指定列类型**，故所有裸列（含当前用 `sa_column_kwargs` 的 server_default/onupdate 列）必须改为 `sa_column=Column(DateTime(timezone=False), ...)`，把既有 kwargs 一并迁入 `Column(...)`。列类型名统一 `DateTime`（`sqlalchemy.DateTime`）。关联 BDD-1/2/3/9/16。

| # | 表/模型 | 列（当前行号） | 现有形态 → 改后形态 | BDD |
|---|---------|--------------|-------------------|-----|
| R1-1 | `EntryBase`（被 `Entry` 继承） | `expires_at`(101) / `archived_at`(102) / `archive_delete_at`(103-106) | `Field(default=None)` → `Field(default=None, sa_column=Column(DateTime(timezone=False), nullable=True))`（保留 `archive_delete_at` 的 `description`） | 1/2/3/9/16 |
| R1-2 | `UserBase`（被 `User` 继承） | `disabled_at`(117) | 同上 | 1/2/9/16 |
| R1-3 | `User` | `created_at`(138-141) / `updated_at`(142-148) | `default_factory=now_utc` + `sa_column_kwargs={server_default/onupdate}` → `default_factory=now_utc` + `sa_column=Column(DateTime(timezone=False), nullable=False, server_default=text("CURRENT_TIMESTAMP")[, onupdate=...])` | 1/9/16 |
| R1-4 | `Team` | `created_at`(178-181) / `updated_at`(182-187) | 同 R1-3 | 1/9/16 |
| R1-5 | `TeamMember` | `joined_at`(218-221) | 同 R1-3（仅 server_default） | 1/9/16 |
| R1-6 | `ApiKey` | `expires_at`(238) / `last_used_at`(239) / `created_at`(240-243) / `updated_at`(244-250) | `expires_at`/`last_used_at` 同 R1-1；`created_at`/`updated_at` 同 R1-3 | 1/2/3/9/16 |
| R1-7 | `Entry` | `created_at`(285-288) / `updated_at`(289-295) | 同 R1-3 | 1/9/16 |
| R1-8 | `EntryShare` | `expires_at`(322) / `created_at`(326-329) / `revoked_at`(330) | `expires_at`/`revoked_at` 同 R1-1；`created_at` 同 R1-3 | 1/2/3/9/16 |
| R1-9 | `EntryRead` | `read_at`(360) / `updated_at`(361) | `Field(default_factory=now_utc)` → `Field(default_factory=now_utc, sa_column=Column(DateTime(timezone=False), nullable=False))`（**无** server_default，易漏，P1 点名） | 1/9/16 |
| R1-10 | `EntryStar` | `created_at`(391-394) | 同 R1-3 | 1/9/16 |
| R1-11 | `EntryTombstone` | `deleted_at`(416-419) | 同 R1-3 | 1/9/16 |
| R1-12 | `EntryReadStats` | `last_read_at`(436) / `updated_at`(437) | `last_read_at`：`Field(default=None)` → `Field(default=None, sa_column=Column(DateTime(timezone=False), nullable=True))`；`updated_at`：`Field(default_factory=now_utc)` → 加 `sa_column=Column(DateTime(timezone=False), nullable=False)` | 1/9/16 |
| R1-13 | `File` | `created_at`(499-502) | 同 R1-3 | 1/9/16 |

- 只改列**类型映射声明**，不改列名、不改 `nullable`、不改 `server_default`/`onupdate`、不改 `default_factory`；无 SQL 迁移（既有 SQLite 列本就是无 tz `DATETIME`，见 §0.2）。
- `models.py` 顶部 `from sqlalchemy import Column, ForeignKey, Index, Text, text` 需补 `DateTime`（`from sqlalchemy import Column, DateTime, ...`）。

#### R2 依赖防回归守卫（BDD-15；落地形态选择见候选方案 2）

| # | 位置 | 改动 | BDD |
|---|------|------|-----|
| R2-1 | `backend/pyproject.toml:28` | `sqlmodel>=0.0.14` → 加**可机械校验的上限**（如 `sqlmodel>=0.0.14,<1.0.0`）或按方案 2 选择的锁定策略 | 15 |
| R2-2 | `.github/workflows/ci.yml`（backend-test job） | 视方案 2：或将依赖安装改为读锁文件 / 或维持 `pip install -e ".[test]"` 但加依赖一致性校验步骤 | 15 |
| R2-3 | 守卫执行入口 | 守卫须**可执行**：读取 `pyproject.toml` 的 sqlmodel 约束（或跑一致性检查脚本），返回 exit code；注入漂移后必须变红（BDD-15 (i)/(ii)） | 15 |

> R2 的具体文件落点由候选方案 2 定稿；本表为**预期改点**，P4 依选定方案细化。

#### R3 测试补充（P3 产出，P4 落盘）

| # | 位置 | 改动 | BDD |
|---|------|------|-----|
| R3-1 | `backend/tests/test_models.py`（或新增 `test_datetime_naive_compat.py`） | 补 0.0.47 真红灯测试：naive 绑定 / aware 绑定 / NULL / WHERE 比较四路径 + 25 列静态扫描 | 1/2/3/9 |
| R3-2 | `backend/tests/**`（端到端业务域） | 备份恢复（merge+replace）/ star 生命周期 / admin 清理 / CLI / backfill 幂等覆盖 | 10/11/12/13/14 |
| R3-3 | 序列化契约断言 | API 响应 / 备份 JSON / CLI 输出的 naive ISO 形态（无 `+00:00`）逐字段断言 | 7/8/17 |
| R3-4 | 依赖守卫测试 | 守卫存在可执行 + 注入漂移变红两断言 | 15 |

### 0.2 不改什么（Not Modify）— 显式边界 + 理由

| 不改范围 | 理由 |
|---------|------|
| **SQLite 迁移 SQL**（`database.py` 的 8 处 `DATETIME` 列定义 L89/102/117/137/164/243/244/251） | 列存储类型本就是无 tz `DATETIME`（既定约定），问题在 **ORM 映射层**而非存储层；改 SQL 会触发数据迁移（本任务禁止） |
| **API 响应 schema 的时间字段**（`models.py` 非 `table=True` 的响应模型 L446/457/458/643/653/689/727/…） | 响应字段非列，序列化形态由来源列决定；本任务只改列映射，响应形态应**逐字段相等**（BDD-7/8/17 反向验证） |
| **前端 `frontend-v3/**`** | 只消费 API 字符串；`domains: [backend]`，不跑前端测试（BDD-17 显式范围外） |
| **MCP 包 `packages/mcp-server/**`** | 无自有 ORM 时间列，经 HTTP API 消费；受 BDD-7/17 契约间接保护 |
| **`auth.py` JWT `exp`**（b20） | 非 DB 列绑定，与 ORM bind 无关 |
| **迁移 SQL / 备份 JSON 结构 / CLI 输出格式** | 属外部契约，本任务保持形态不变（BDD-8） |
| **`read_tracking_service.py:48` `window_key` 字符串窗口键 / `:248 fromisoformat`**（naive 面 #15/#16） | 写入字符串列不经 datetime bind；P1 §4.1.1 判「不处理」，P2 确认其比较逻辑（`window_ts = now.strftime(...)`）不经 ORM 时间列绑定，0.0.47 不触发 |
| **`admin_service.py:225/555/604` 的 aware 非列绑定**（b21/b22） | 仅内存过滤 / 备份文件名时间戳字符串，不绑定 datetime 列 |
| **`now_utc()` / `datetime.now(timezone.utc)` 赋值点**（19 行 b1–b19 + 14 行 a 类） | **不改代码**——这些是 aware/naive 值的**生产者**；显式 `DateTime(timezone=False)` 列会在 bind 时去时区（0.0.38/0.0.47 均如此，minval 已验证），无需逐点改造。它们只作为**测试覆盖面**（BDD-9），不作为改动面 |
| **`agate/scripts/` 下任何文件** | 本任务不新增/改名协议脚本 → 登记面节**不适用**（P1 §4.4 已声明） |

### 0.3 风险在哪（Risk）— 每条配缓解

| # | 风险 | 缓解 |
|---|------|------|
| RK-1 | **`sa_column_kwargs`→`sa_column=Column(...)` 迁移漏带 kwargs**：某列 `server_default`/`onupdate` 未迁入 `Column`，导致默认值丢失、`created_at` 变 NULL 或 `updated_at` 不自动更新 | P4 逐列比对 §0.1 表；测试断言 `__table__.columns[c].server_default is not None`（25 列静态扫描，BDD-16）+ 业务测试覆盖 update 行为 |
| RK-2 | **aware 赋值绑到 naive 列的去时区行为**：`datetime.now(timezone.utc)` 值被静默去时区而非抛错，若语义理解错会以为"漂移" | minval 已实测：aware 绑定 `DateTime(timezone=False)` 后回读为等价 UTC 时刻的 naive 值（无漂移）；BDD-1(ii)/BDD-9 显式断言 |
| RK-3 | **两版本行为分叉**：修法在 0.0.47 通过但 0.0.38 回归（如用了 0.0.38 不存在的 `NaiveDatetime`） | 修法 A 用**纯 SQLAlchemy `Column(DateTime(...))`**，不依赖版本特有能力；P5 双环境全量（本地 + 隔离 0.0.47）均须绿（BDD-4/5） |
| RK-4 | **序列化契约隐性变化**：列映射变化意外影响 API 输出形态 | BDD-7/8/17 逐字段断言 naive ISO（无 `+00:00`）；P6 实跑 API/备份/CLI |
| RK-5 | **既有数据读出漂移**：读出被误加时区 | 保持 `DateTime(timezone=False)`（naive 存储/读出语义不变）；BDD-6 断言 UTC 时刻相等 + countdown 无偏移 |
| RK-6 | **25 列遗漏**：只改被报告的 `archive_delete_at`，漏掉无 `server_default` 的 `EntryRead.read_at`/`EntryReadStats.updated_at` 等易漏列 | BDD-16 静态扫描 25 列全量断言（ORM 枚举 `__table__.columns`，含继承列）；§0.1 表逐列点名 |
| RK-7 | **依赖守卫形同虚设**：只写文档约定、无 exit code / 注入漂移不变红 | BDD-15 要求**实测两次**（守卫绿 + 注入漂移后红）；守卫须是 `gate_commands` 里可独立执行的一条命令（见 §2 方案 2） |
| RK-8 | **测试污染生产**：0.0.47 验证误写 `~/.peekview/` 或触碰 `:8080` | conftest `isolate_config_file`（autouse）隔离 + 隔离 venv + 临时数据目录；BDD-18 断言 |

### 0.4 登记面（新增/改名 `agate/scripts/` 下文件时必填）

**不适用** —— 本任务不新增/改名 `agate/scripts/` 下任何文件。CHECK 9 / SG.6 / CHECK 10 三处均不因本任务触发（无新脚本文件、无脚本改名/退役、协议文档未引用新脚本名）。

---

## 1. 候选方案（candidate_count: 3）

### 候选方案 1（选定）：逐列显式 `Column(DateTime(timezone=False))` + 钉依赖上限守卫

**做法**：R1（§0.1）为 25 个 datetime 列显式声明 `sa_column=Column(DateTime(timezone=False), ...)`；R2 同步把 `pyproject.toml` 的 `sqlmodel` 约束从无上限改为**有上限**（守卫 = 可机械校验的版本约束），并在 CI/测试侧补一条可执行的守卫（注入漂移变红），满足 BDD-15/16。

**权衡**：
- ✅ **最小、精准**：只改列类型映射声明，不动业务代码、不动 SQL、不迁移数据；25 列逐列可控。
- ✅ **跨版本稳定**：用纯 SQLAlchemy `Column(DateTime(...))`，0.0.38 与 0.0.47 行为一致（minval 8/8 + kwargs 变体 OK）。
- ✅ **语义显式**：BDD-16 静态可核验（每个列都带显式 `timezone=False`），未来上游再改推断也不受影响（因为不再依赖推断）。
- ✅ **同时覆盖 (a)/(b)/(c) 三路径**：显式 naive 列接受 naive 绑定、去时区 aware 绑定、`CURRENT_TIMESTAMP` 均可。
- ⚠️ 25 列逐一改，人工核对量大 → 由 BDD-16 静态扫描机械兜底（25 计数）。
- ⚠️ 依赖守卫若不落到可执行命令，BDD-15 无法满足 → 与 R2 绑定，非本方案的可选项。

**选择理由**：**核心 + 防回归正交组合**。R1 直接消除根因（列语义显式化，不随上游漂移），R2 拦截未来同类破坏性变更。二者缺一不可：只做 R1 则下次上游变更新增列/新表仍会中招；只做 R2 则当前 CI 仍红。成本最低、风险最低、可直接映射到 P1 的 18 BDD。

---

### 候选方案 2：仅依赖治理（钉版本上限 / lock / CI 一致性检查），不改模型列

**做法**：不动 `models.py`，只把 `sqlmodel` 钉到 `<0.0.47`（或 lock 到 0.0.38），使 CI 装到与本地一致的旧版本。

**权衡**：
- ✅ 改动面最小（1 个文件）。
- ❌ **不消除根因**：列语义仍依赖上游推断，一旦需要升级 sqlmodel（任何其他依赖要求）就再次大面积崩；项目停留在旧版本。
- ❌ **与 P1 目标冲突**：BDD-16 要求「25 列每一个均带显式时区声明」，方案 2 无法满足；BDD-1/9「最新依赖下可正常写入」无法满足（被判为"回避"而非"兼容"）。
- ❌ 钉成 `<0.0.47` 属**倒退**，P0 §二 MVP 明写"恢复 CI 在**最新依赖**下全绿"。

**选择结论**：**不选为主方案**。但它与方案 1 **正交**——方案 1 已将其（钉上限 + 可执行守卫）作为 R2 吸收，故方案 2 的价值在方案 1 中以子集形式存在。

---

### 候选方案 3（备选）：改存储为 tz-aware（`Column(DateTime(timezone=True))` + 全路径改 aware）

**做法**：把 25 列改为 aware 存储，并把 14 行 naive 写入点改造为 aware。

**权衡**：
- ✅ 与现代 tz-aware 实践一致，绑定 aware 值天然正确。
- ❌ **既有数据时区漂移（致命）**：SQLite 既有值是无 tz 字符串，`DateTime(timezone=True)` 读出时会把 naive 字符串按 UTC 语义补 tz——看似无害，但既有 **naive 存储语义**是既定约定（`database.py` 迁移 SQL、`star_service._naive_utc` docstring 明写 "matching the archive_delete_at storage"）；一旦混入历史非严格 UTC 值将静默偏移。BDD-6 明确要求"既有数据读出无时区漂移"。
- ❌ **需数据迁移**：与"不引入迁移、保持 naive 存储语义"硬约束直接冲突（P0 §二 / 派发约束）。
- ❌ **序列化契约变化**：aware 列读出带 `+00:00`，破坏 BDD-7/8 的 naive ISO 契约，波及前端/MCP/备份。
- ❌ 改动面最大（25 列 + 22 个 aware/naive 命中点全改），风险最高。

**选择结论**：**不可取**——违反 naive 存储既定约定、触发数据迁移、破坏序列化契约、BDD-6/7/8 直接失败。

---

### 方案对比速览

| 维度 | 方案 1（选定） | 方案 2 | 方案 3 |
|------|--------------|--------|--------|
| 消除根因 | ✅ 列语义显式化 | ❌ 回避 | ✅ 但代价高 |
| 满足 BDD-16（25 列显式） | ✅ | ❌ | ✅（但语义相反） |
| 满足 BDD-1/9（最新依赖） | ✅ | ❌ | ✅ |
| 保持 naive 存储/序列化契约 | ✅ | ✅ | ❌ |
| 无数据迁移 | ✅ | ✅ | ❌ |
| 改动面 | 中（25 列） | 小 | 大（25 列 + 22 点） |
| 防未来漂移 | ✅（上限守卫） | ✅（上限） | ✅ |

---

## 2. 设计细节（选定方案 1）

### 2.1 列定义统一形态（R1）

```python
from sqlalchemy import Column, DateTime, ForeignKey, Index, Text, text

# 可空时间列（expires_at/archived_at/archive_delete_at/disabled_at/last_used_at/revoked_at/last_read_at）
expires_at: datetime | None = Field(
    default=None,
    sa_column=Column(DateTime(timezone=False), nullable=True),
)

# server_default 时间列（created_at/joined_at/deleted_at 等）
created_at: datetime = Field(
    default_factory=now_utc,
    sa_column=Column(DateTime(timezone=False), nullable=False,
                     server_default=text("CURRENT_TIMESTAMP")),
)

# server_default + onupdate（updated_at 类）
updated_at: datetime = Field(
    default_factory=now_utc,
    sa_column=Column(DateTime(timezone=False), nullable=False,
                     server_default=text("CURRENT_TIMESTAMP"),
                     onupdate=text("CURRENT_TIMESTAMP")),
)

# 无 server_default 的 default_factory（EntryRead.read_at/updated_at, EntryReadStats.updated_at）
read_at: datetime = Field(
    default_factory=now_utc,
    sa_column=Column(DateTime(timezone=False), nullable=False),
)
```

> `archive_delete_at` 保留原 `description` 参数；`EntryBase` 的 3 列在基类改，`Entry` 无需重复（BDD-16 需含继承列）。

### 2.2 依赖防回归守卫（R2，BDD-15）

落地形态（本设计选定）：
1. `backend/pyproject.toml`：`"sqlmodel>=0.0.14,<1.0.0"`（加可机械校验的上限；上限仅在 sqlmodel 下一个大版本发布时评估放宽）。
2. **可执行守卫**：新增后端测试（P4 落盘）`backend/tests/test_dependency_guard.py`，读取 `backend/pyproject.toml` 的 `sqlmodel` 约束并断言其**存在上限**（用 `packaging`/`tomllib` 解析）；同时断言已安装 sqlmodel 版本满足该约束。守卫经 `gate_commands.P5_dep_guard` 独立执行。
3. **注入漂移实测**：P4/P6 临时把约束放宽为 `>=0.0.14`（或移除上限）→ 重跑守卫 → 必须**失败**；恢复后通过。记录前后 exit code（BDD-15 (ii) 的"实测"证据）。

> 说明：BDD-15 只要求"守卫存在可执行 + 注入漂移变红"，不要求守卫检测"上游发布新版本"（P1 已注明无法构造该事件）。选上限守卫而非 lock，因其对"依赖漂移"直接可判、无需引入额外锁文件与 CI 安装流程改动；这与方案 2 的"钉上限"是同一手段，故方案 1 已正交吸收方案 2。

---

## 3. 完成标准（可判定）

实现完成的标志：
1. `models.py` 25 个 datetime 列全部为显式 `DateTime(timezone=False)`；静态扫描 `__table__.columns` 计数 = 25，无裸 `datetime` 列（BDD-16）。
2. 隔离 venv（sqlmodel 0.0.47）后端全量 pytest 0 failed；本地 venv（0.0.38）后端全量 pytest 0 failed（BDD-5）。
3. naive 绑定 / aware 绑定 / NULL / WHERE 比较四路径均通过（BDD-1/2/3/9）。
4. API 响应 / 备份 JSON / CLI 输出时间字段为 naive ISO 字符串、无 `+00:00`，与修复前逐字段相等（BDD-7/8）。
5. 备份恢复（merge+replace）、star 生命周期、admin 清理、CLI 禁用、backfill 幂等全部通过（BDD-10/11/12/13/14）。
6. 依赖守卫存在、可执行返回成功；注入漂移后返回失败（BDD-15）。
7. 生产 DB / :8080 未被触碰（BDD-18）。

---

## gate_commands

```yaml
gate_commands:
  # P3：任务级红灯基线（0.0.47 下真红灯）。用隔离 venv 复现 CI 依赖；P3 走 AGATE_TDD_TIMEOUT。
  # 语义：修复前该命令在 0.0.47 环境必红（裸列 naive bind ValueError）；修复后转绿。
  P3: "/tmp/ci-repro-venv/bin/python -m pytest backend/tests/test_datetime_naive_compat.py -v --tb=short --rootdir=backend"

  # P5：本地全量（0.0.38），紧凑输出
  P5: "backend/.venv/bin/python -m pytest backend/tests/ -q --tb=short --rootdir=backend"
  P5_timeout_seconds: 300

  # P5_ci_repro：隔离 venv（0.0.47）全量——本任务 CI 等价核心 key
  P5_ci_repro: "/tmp/ci-repro-venv/bin/python -m pytest backend/tests/ -q --tb=short --rootdir=backend"
  P5_ci_repro_timeout_seconds: 600

  # 依赖防回归适应度检查（BDD-15）：守卫存在 + 通过（注入漂移的变红由 P6 人工实测记录）
  P5_dep_guard: "backend/.venv/bin/python -m pytest backend/tests/test_dependency_guard.py -q --tb=short --rootdir=backend"
  P5_dep_guard_timeout_seconds: 120

  # 架构适应度：模型列时区语义静态可核验（BDD-16，25 列显式声明）
  P5_schema_guard: "backend/.venv/bin/python -m pytest backend/tests/test_datetime_naive_compat.py -q --tb=short --rootdir=backend -k schema"
  P5_schema_guard_timeout_seconds: 120

  project_module: "peekview"
```

> - `P3` 命令须在修复前（0.0.47）真红灯：测试文件由 P3 产出，断言裸列 naive 绑定可写——修复前 0.0.47 下 `Entry(archive_delete_at=naive)` 插入抛 `ValueError: Datetime values must have timezone information`。
> - 隔离 venv 路径 `/tmp/ci-repro-venv` 按 P0 重建步骤现场创建（`python3 -m venv` + `pip install -e ".[test]"`，落在 0.0.47）。
> - 各 key 独立声明、独立执行，不共享 `&&` 短路（遵循 `--strict` 反模式禁令）。`P5_e2e` **不声明**（`ui_affected: false`）。
> - 架构适应度检查维度：本任务涉及"**存储层类型契约稳定性**"——由 `P5_schema_guard`（25 列显式 tz 声明静态核验）与 `P5_dep_guard`（依赖漂移拦截）承载。

## files_to_read

```yaml
files_to_read:
  - path: backend/peekview/models.py
    why: 25 个 datetime 列定义落点（逐列显式 naive），含 EntryBase 继承列；顶部 sqlalchemy import 需补 DateTime
  - path: backend/peekview/models.py:82-107
    why: EntryBase/UserBase 基类时间列（expires_at/archived_at/archive_delete_at/disabled_at）
  - path: backend/peekview/models.py:339-437
    why: EntryRead/EntryReadStats 无 server_default 的 default_factory 列（易漏）
  - path: backend/pyproject.toml:28
    why: sqlmodel 依赖约束加可机械校验上限（BDD-15）
  - path: backend/peekview/database.py:89-251
    why: 8 处 SQLite DATETIME 列定义（确认无 tz、无需改 SQL，仅核对映射一致）
  - path: backend/tests/conftest.py:23-47
    why: autouse 隔离机制（isolate_config_file），P3 新测试复用；确认不碰生产
  - path: backend/tests/test_models.py
    why: 既有模型测试形态参考，新测试文件命名/夹具风格
  - path: backend/peekview/services/star_service.py:39-106
    why: _naive_utc / build_countdown（naive 存储语义与倒计时判定的消费方，BDD-6/11）
  - path: .github/workflows/ci.yml:1-40
    why: backend-test job 安装/测试流程（确认 P5_ci_repro 与 CI 等价）
```

## env_constraints

```yaml
env_constraints:
  debug_env: "沿用 P0：make debug（:8888，独立数据目录 /tmp/peekview-debug/）；测试用 make test-quick（venv）。本任务无 UI，P5 不需 E2E。"
  local_dep_versions: "本地 backend/.venv = sqlmodel 0.0.38 / sqlalchemy 2.0.51 / pytest 9.1.1（P5 默认环境）"
  ci_repro: "隔离 venv /tmp/ci-repro-venv = sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1（P5_ci_repro 环境）；沙箱无外网，按 P0 重建步骤现场创建。已实测存在且版本正确。"
  prod_not_touch: "严禁触碰生产 :8080 / ~/.peekview/（AGENTS.md 铁律）；测试依赖 conftest autouse 隔离 + 临时数据目录。"
  isolation_check: "P5 前后校验 /tmp/ci-repro-venv 与 backend/.venv 均指向各自版本；确认无写入 ~/.peekview/（BDD-18）。生产隔离由 conftest isolate_config_file 保证。"
```

## minimal_validation

```yaml
minimal_validation:
  assumption: "显式 sa_column=Column(DateTime(timezone=False)) 在 sqlmodel 0.0.38 与 0.0.47 下均能正确接受 naive/aware/NULL/WHERE 比较四类绑定；且裸 datetime 在 0.0.47 下确为 tz-aware(UTCDateTime) 导致 naive 绑定抛错。"
  method: "隔离 venv（0.0.47/2.0.54）与本地 venv（0.0.38/2.0.51）各跑最小 SQLModel 表脚本，覆盖四路径 + server_default/onupdate/default_factory 变体；并跑对照脚本确认裸列在 0.0.47 报错、NaiveDatetime 在 0.0.38 不可导入。"
  result: "confirmed"
  note: >
    脚本 /tmp/opencode/tpv0101_minval.py（四路径）结果：0.0.38 与 0.0.47 均 8/8 路径 OK
    （naive 绑定/回读、aware 绑定/回读、NULL 绑定/回读、WHERE naive 比较、WHERE aware 比较）。
    脚本 /tmp/opencode/tpv0101_minval2.py（server_default+onupdate+default_factory 变体）两版本均 OK：
    列类型 DateTime tz=False，nullable/server_default 保留，default_factory 产 aware 值写入后回读为
    等价 UTC 时刻的 naive 值（无漂移）。
    对照 /tmp/opencode/tpv0101_control.py：0.0.47 下裸列类型 = UTCDateTime tz=True，naive 绑定 RED
    （ValueError: Datetime values must have timezone information）——确认为根因；0.0.38 下裸列 = DateTime tz=False
    绑定 OK（解释本地为何全绿）。NaiveDatetime 在 0.0.38 与 0.0.47 均 ImportError（该版本无此类）——
    修法 B 排除。
    结论：修法 A 跨双版本稳定，纳入选定方案。
```

---

## 附：与 P1 需求的覆盖对照

| BDD | 覆盖方式 |
|-----|---------|
| BDD-1/2/3/9 | R1 显式 naive 列 + minval 四路径；R3-1 红灯测试 |
| BDD-4/5 | RK-3 缓解 + `P5`(0.0.38) 与 `P5_ci_repro`(0.0.47) 双环境全量 |
| BDD-6/7/8 | §0.2 不改序列化形态；R3-3 逐字段断言；`P5`/`P5_ci_repro` |
| BDD-10/11/12/13/14 | R1 覆盖对应表列；R3-2 业务域测试 |
| BDD-15 | R2 上限守卫 + `P5_dep_guard` + P6 注入漂移实测 |
| BDD-16 | R1 全 25 列 + `P5_schema_guard` 静态扫描 |
| BDD-17 | §0.2 前端/MCP 显式范围外；API 契约断言 |
| BDD-18 | env_constraints.isolation_check + conftest 隔离 |
