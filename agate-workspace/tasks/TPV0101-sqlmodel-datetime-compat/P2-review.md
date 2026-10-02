---
phase: P2
task_id: TPV0101
type: review
parent: P2-design.md
trace_id: TPV0101-P2-review-20261002
status: approved
created: 2026-10-02
agent: plan-eng-review
---

# P2 评审 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 结论：**approved**（0 BLOCKER，3 非阻塞 WARNING）。选定方案 1（逐列显式 `Column(DateTime(timezone=False))` + 依赖上限守卫）经独立实测确认解决根因、跨双版本成立、覆盖 aware 绑定面、无数据迁移。对依赖守卫上限 `<1.0.0` 的有效性与 P3 隔离 venv 前置两点提出非阻塞改进建议，交 P4/P6 收口。只审不改。

---

## 一、方案正确性 ✅（证据：本评审独立实测）

**根因与修法均实测成立**：

- 根因实测（对照组 `/tmp/opencode/tpv0101_control.py`）：0.0.47 下裸 `datetime` 列类型 = `UTCDateTime tz=True`，naive 绑定 **RED**（`ValueError: Datetime values must have timezone information`）；0.0.38 下裸列 = `DateTime tz=False`，绑定 OK。与 P0/DEBT0019 陈述一致。
- 修法实测（`/tmp/opencode/tpv0101_minval.py`）：显式 `Column(DateTime(timezone=False))` 在 0.0.47 与 0.0.38 均 **8/8 路径 OK**（naive 绑定/回读、aware 绑定/回读、NULL、WHERE naive/aware 比较）。
- **kwargs 迁移形态实测**（本评审新写 `/tmp/opencode/tpv0101_review_check.py`）：把 `sa_column_kwargs` 迁入 `sa_column=Column(DateTime(timezone=False), nullable=..., server_default=text("CURRENT_TIMESTAMP"), onupdate=...)` 后，双版本下 `nullable`/`server_default`/`onupdate` **逐一保留**（`tz=False` 全真）。设计 §2.1 的四类统一形态可照抄实现。
- **`sa_column_kwargs` 不可与 `sa_column` 共存**已实测确认（0.0.47 抛 `RuntimeError: Passing sa_column_kwargs is not supported when also passing a sa_column`）→ 设计「所有用 `sa_column_kwargs` 的列必须改为 `sa_column=Column(...)`」的约束**真实且必要**，非过度设计。
- **aware 绑定路径覆盖**：P1 §4.1.2 的 19 行「本次处理」命中点（b1–b19）在显式 naive 列下均经 `process_bind_param` 去时区（minval aware-bind/readback 已证），设计 §0.2 将其正确列为「不作为改动面、作为测试覆盖面（BDD-9）」。**无遗漏 aware 绑定面**。
- **列清单口径独立复核**：本评审以 ORM 枚举 `__table__.columns` 实测 = **25 个 datetime 列 / 11 表**，逐表与设计 §0.1 / P1 §4.2 完全一致（含 Entry 继承 EntryBase 的 3 列）。设计表中列出的现有行号（101/102/103、117、138/142、178/182、218、238/239/240/244、285/289、322/326/330、360/361、391/416、436/437、499）与源码逐一吻合。

**结论**：选定方案真正消除根因（列语义显式化，脱离上游推断），跨 0.0.38/0.0.47 稳定，未遗漏 aware 绑定路径。

## 二、候选方案充分性 ✅

- `candidate_count: 3`，三方案均给出可判定权衡 + 选择理由。
- **方案 3（改 aware 存储）否决理由充分**：违反 naive 存储既定约定（`database.py` 迁移 SQL、`star_service._naive_utc` docstring）、需数据迁移、破坏 naive ISO 序列化契约（→ BDD-6/7/8 直接失败）、改动面最大。设计 §候选 3 的三条 ❌ 均与 P1 基线硬约束对应，**否决成立**。
- 方案 2（仅依赖治理）作为「不消除根因 → 不选为主方案，但正交吸收为 R2」处理，逻辑自洽。

## 三、影响面梳理 ✅

- **改什么**：落到文件+函数+行号+BDD 关联（R1 25 列逐列、R2 守卫、R3 测试），无「相关代码」模糊表述。
- **不改什么**：覆盖 SQLite 迁移 SQL / API 响应 schema / 前端 / MCP / JWT exp / 备份 JSON / CLI 输出 / `read_tracking` 字符串窗口键 / admin 非列绑定 / `now_utc` 赋值点。**API 契约、前端、MCP、存储迁移格式均已显式覆盖**——派发指引关注点齐全。
- **风险**：RK-1…RK-8 每条配缓解，含双源（模型声明 vs 列 kwargs）同步风险 RK-1、schema 变更 RK-5、遗漏列 RK-6，覆盖高频风险项。
- **登记面** ✓ 正确声明「不适用」（不新增/改名 `agate/scripts/` 文件）。经核对本任务改动面确无协议脚本增删。

## 四、gate_commands 可执行性 ⚠️（3 非阻塞 WARNING）

**可执行性实测**：

- 隔离 venv `/tmp/ci-repro-venv` **实测存在**：sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1，与 P0 声明一致。
- `P5`（`cd backend && .venv/bin/python -m pytest tests/`）与 `P5_ci_repro`（同形，0.0.47）**实测均可收集全部测试**（`--co` 通过），且 `import peekview` 在两 venv 下均解析到 `backend/peekview/__init__.py`。
- `P5_dep_guard` / `P5_schema_guard` 依赖的 `packaging`（26.2/26.3）+ `tomllib` 两 venv 均可用 → **守卫可实现**。
- **无 `--strict` 反模式** ✅：各 key 独立命令、独立执行，无 `&&` 串联短路。
- `P5_e2e` 正确不声明（`ui_affected: false`）。

**WARNING-1（非阻塞）：依赖守卫上限 `<1.0.0` 对「本次同类破坏性变更」实为 no-op**。设计 §2.2 选 `sqlmodel>=0.0.14,<1.0.0`，而**0.0.47 本身满足 `<1.0.0`**——若未来 0.0.48 复现同类变更，该上限**不会拦截**，与 BDD-15「设计意图注记」声称的「上游再引入同类变更时能被拦截」不完全相符。建议：P4 落地时把上限收紧到能覆盖已验证安全版本（如 `<0.0.47`，或按已验证上限明确写死），使守卫对「同类变更」有真实拦截力；若维持 `<1.0.0`，须在 CHANGELOG/P8 明示「本守卫只防大版本，不防小版本同类变更」以免误导。**不作为 BLOCKER**：P1 已显式将「上游发布事件」降为非 BDD 的设计意图注记，BDD-15 的 Then 二值断言（守卫存在 + 注入漂移变红）在此上限下仍可机械满足（注入漂移 = 移除上限 → 守卫红）。

**WARNING-2（非阻塞）：P3 隔离 venv 重建前置未提升为 P3 阶段显式 checklist**。派发指引点名此点。设计在 `gate_commands` 注记写「隔离 venv 路径按 P0 重建步骤现场创建」+ `env_constraints.ci_repro` 写「已实测存在且版本正确」。但 `/tmp` 易失（沙箱回收），**若 P3 开场时 `/tmp/ci-repro-venv` 已丢失，`P3` 真红灯命令直接不可运行**。建议：主 Agent 在派发 P3 前把「确认/重建 `/tmp/ci-repro-venv` 且版本=0.0.47」作为 P3 dispatch-context 的显式前置项（当前设计已声明重建方法，仅缺「执行时机」的强制落点）。

**WARNING-3（非阻塞）：`P3` 命令工作目录与 P5 key 不一致**。`P3` 用 `.../python -m pytest backend/tests/...`（无 `cd backend`），而 `P5*` 用 `cd backend && ... tests/...`。实测两者均可运行（editable 安装使模块从任意 cwd 解析），但建议统一为一种形态，降低 P3 运行者误判「路径不存在」的风险。

**timeout 评估**：`P5=300` / `P5_ci_repro=600` / 守卫类=120。全量后端套件（0.0.47 修复前 38 failed+502 errors）耗时可能高，600s 对 `P5_ci_repro` 属合理偏宽（符合「宁可档位定高」原则）；单元守卫 120s 与 `AGATE_TDD_TIMEOUT` 对齐。**均合理，非阻塞**。

## 五、BDD 覆盖 ✅（18/18 有落点）

覆盖对照表可信：BDD-1/2/3/9→R1+minval+R3-1；BDD-4/5→双环境 `P5`/`P5_ci_repro`；BDD-6/7/8→§0.2+序列化断言；BDD-10/11/12/13/14→R1+R3-2 业务域；BDD-15→R2+`P5_dep_guard`+P6 注入漂移；BDD-16→25 列+`P5_schema_guard`；BDD-17→§0.2 范围外+API 契约；BDD-18→conftest 隔离。经与 P1 §3 逐条比对，**18 条均有对应设计落点**；BDD-15 的长期拦截意图见 WARNING-1。

## 六、风险与迁移 ✅

- **无数据迁移**成立：只改 ORM 列类型映射，不动 SQLite 存储类型（本即无 tz `DATETIME`），既有数据零改动。
- **naive 读出语义保持**：显式 `DateTime(timezone=False)`，既有 naive 字符串按 UTC 解释，`build_countdown` 无偏移（BDD-6）；设计 §0.3 RK-5 配缓解。
- **序列化契约不变**：响应字段非列、形态由来源列决定，逐字段相等（BDD-7/8/17）——方向正确。

## 七、不可行假设与实现就绪度

- 设计依赖的关键前提（四路径绑定、跨版本、kwargs 保留、25 列口径）**均由本评审实测确认**，无未验证的前提残留。
- 实现的唯一「假设」是 WARNING-1 的上限有效性——已在 P1 范围内显式降级，不构成不可行假设。
- `files_to_read` 覆盖实现所需上下文（models.py/ pyproject.toml / database.py / conftest / star_service / ci.yml），范围合理不爆炸；方案清晰到 implementer 无需步骤计划即可实现。**实现就绪度 OK**。

---

## BLOCKER 清单

**无。**

## 非阻塞建议（交 P4/P6 收口）

1. **WARNING-1**：收紧依赖上限（或明示只防大版本），使 BDD-15 的拦截意图对同类小版本变更有效。
2. **WARNING-2**：P3 派发前把「隔离 venv 存在且 =0.0.47」设为显式前置 checklist。
3. **WARNING-3**：统一 `P3` 与 `P5*` 的工作目录形态。

## 测试缺口

- 无新增缺口。BDD 已覆盖 naive/aware/NULL/WHERE 四路径 + 双环境 + 序列化 + 业务域 + 守卫 + 生产隔离。

## 锁定决策

- 选定方案 1（显式 `Column(DateTime(timezone=False))` 逐列 + 依赖上限守卫）。
- 保持 naive UTC 存储/序列化契约，不做 aware 化改造、不迁移数据。
- `ui_affected: false`，不声明 `P5_e2e`。

---

**status: approved**（agent=plan-eng-review≠main）。可进入 P3。
