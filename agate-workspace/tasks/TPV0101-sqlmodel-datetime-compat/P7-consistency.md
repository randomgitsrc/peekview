---
phase: P7
task_id: TPV0101
type: consistency
parent: P2-design.md
trace_id: TPV0101-P7-20261003
status: approved
created: 2026-10-03
agent: consistency-reviewer
# ── v2.0 机器计数（gate 读此，不读正文）──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
code_map_new_files_count: 0
code_map_reviewed_count: 0
---

# P7 一致性审查 — TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 口径：对照 `P0-brief.md` / `P1-requirements.md` / `P2-design.md` / `P4-implementation.md` / `P6-acceptance.md` / `.state.yaml` 逐条实做 5 项检查清单。所有结论均可回溯到源文件节名/行号；本文件只读审查，未改动任何源文件。
> 审查动作以只读 shell（显式 timeout）+ 源文件逐行比对完成。

## 检查 1：DESIGN_GAP 配对

**扫描动作**：`grep -nE '\[DESIGN_GAP|\[SCOPE\+|\[SCOPE_GAP|\[CLARIFY' agents-workspace/... /P4-implementation.md`（实际路径 `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P4-implementation.md`）。

**结论：经复核 P4 确无 DESIGN_GAP。**

- P4 §6「范围外声明」（`P4-implementation.md:80`）原文：`无 [DESIGN_GAP]、无 [SCOPE+]、无 [SCOPE_GAP]、无 [CLARIFY]——实现严格对齐 P2 §0.1/§2.1/§2.2。`
- 全任务目录内 `[DESIGN_GAP:` 行首标记实际命中数为 **0**（grep 仅命中 P4 §6 的无偏差声明句与 P7-dispatch-context 的指引文字，均非 implementer 的偏差声明）。
- 故待配对条目为 **0 条**，`design_gap_count=0`、`design_gap_reviewed_count=0`。

[DESIGN_GAP_REVIEWED: 0 条 — 经复核 P4-implementation.md §6 确无 [DESIGN_GAP] 声明，无待配对项]

- P4 §7「新增文件核对表」原文：`本阶段无新增文件（仅改既有 models.py / pyproject.toml），不适用骨架/CODE-MAP 机制。` 与 §6 无偏差声明相互印证。

## 检查 2：SCOPE+ 闭环

**扫描动作**：对 `P1-requirements.md` / `P2-design.md` / `P4-implementation.md` grep `SCOPE\+|SCOPE_RESOLVED|SCOPE_GAP`。

**结论：本任务未产生任何 `[SCOPE+]` 增补，无悬空项需 `[SCOPE_RESOLVED]`。**

- `P1-requirements.md:324`（§4.3 其他扫描面 · MCP 行）确有 `[SCOPE+]` 字样，但为**条件式预防表述**：「若 P2 发现 MCP 有独立时间解析则 `[SCOPE+]` 回补」——这是「若触发才回补」的前提句，非已提出的 SCOPE+。
- `P2-design.md §0.2「不改什么」`（`:83`）与 `BDD-17` 判定 MCP 无自有 ORM 时间列、经 HTTP API 消费、不改 MCP → 触发条件**未成立**，故无 SCOPE+ 产生。
- `P1-requirements.md` frontmatter `scope_resolved: []`（`:31`）为空，与「无 SCOPE+」自洽；P4 §6 亦声明无 `[SCOPE+]`。
- 交叉证据：`P2-design.md §0.4 登记面`（`:104-106`）声明「不适用」；`P4-implementation.md §7` 声明无新增文件——无任何机制增补需要回填基线。

**SCOPE+ 闭环判定：闭环（0 条增补 → 0 条待解决），无 `[SCOPE_RESOLVED]` 缺口。**

## 检查 3：跨文件一致性（引用源文件节名）

### 3.1 `P2-design.md §frontmatter packages: [peekview]` ↔ P8 bump 范围

- `P2-design.md` frontmatter `packages: [peekview]`（`:12`）、`domains: [backend]`（`:13`）；`P1-requirements.md` frontmatter 同（`:13-14`）；`P4-implementation.md` frontmatter 同（`:12-13`）。
- 改动面核实：`P4-implementation.md §1 改动文件清单`（`:23-26`）仅 `backend/peekview/models.py` + `backend/pyproject.toml`；`§0.2 不改什么` 明列 `packages/mcp-server/**` 不改。
- 实测交叉证据：`git show --stat 14ca829a` 中**源码文件仅 2 个**（`backend/peekview/models.py` / `backend/pyproject.toml`），其余为 agate 任务区文件；`P6-acceptance.md §一`（`:30`）同引该 commit 得出相同结论。
- **P8-release.md 在 P7 时点尚未产出**（`.state.yaml` phase=P7；任务目录无 P8-release.md），故为前瞻判定：packages=[peekview] 且无 mcp-server 改动 → P8 版本 bump 范围应且仅应为 `peekview` 包（`packages/mcp-server/` 独立版本不动）。**判定：一致，无越界。**

### 3.2 `P1-requirements.md` BDD 数（18）↔ `P6-acceptance.md` 验收结果数（18 pass / 0 fail）

- P1 `#### BDD-` 行首计数实测 = **18**（`P1-requirements.md:110,115,120,127,132,139,144,149,154,159,166,171,176,181,188,196,203,209`，编号恰为 BDD-1…BDD-18，无缺号重号）。
- P6 `PASS BDD-` 计数实测 = **18**，编号集合恰为 `{BDD-1 … BDD-18}`；`FAIL BDD-` 计数 = **0**。frontmatter `pass: 18 / fail: 0 / regression_pass: true`（`P6-acceptance.md:11-14`）与正文 `§三` 18 条逐条一一对应。
- `P1-requirements.md §3.1–§3.6` 的 BDD 分组（3.1:1-3 / 3.2:4-5 / 3.3:6-10 / 3.4:11-14 / 3.5:15-16 / 3.6:17-18）与 P6 §三逐条映射无错位。
- **判定：数量 + 编号集 + 逐条内容匹配，一致。**

### 3.3 `P4-implementation.md` 实现路径 ↔ `P2-design.md §2 方案 1`

- `P2-design.md §1 候选方案 1（选定）`（`:112-124`）＝ R1「25 列显式 `Column(DateTime(timezone=False))`」+ R2「pyproject sqlmodel 依赖上限 + 可执行守卫」；`§2.1 列定义统一形态`（`:173-206`）四形态、`§2.2 依赖防回归守卫`（`:208-215`）落地形态。
- `P4-implementation.md §1`（`:23-26`）实现路径＝ `models.py` 25 列显式 `sa_column=Column(DateTime(timezone=False), ...)` + `pyproject.toml` L28 `"sqlmodel>=0.0.14,<1.0.0"`。
- 静态实测：`grep -cE 'DateTime\(timezone=False\)' backend/peekview/models.py` = **25**（与 P1 §4.2「25 列 / 11 表」、P4 §2 计数一致）；`grep -n 'sqlmodel' backend/pyproject.toml` = `"sqlmodel>=0.0.14,<1.0.0"`（`:28`）；`models.py:16` 已补 `DateTime` import。
- `P4-implementation.md §2`（`:30-55`）逐表形态与 `P2-design.md §2.1` 四形态（可空/sd/sd+onupdate/无 sd）逐类对齐；`§5 迁移幂等`（`:76`）对应 `P2 §0.2`「不改迁移 SQL」。
- 一处**看似缺口已排除**：`P2-design.md §0.1 R2-2`（`:62`）列 `.github/workflows/ci.yml` 为「视方案 2」的候选改点；选定方案 1 在 `§2.2`（`:208-215`）明确守卫落地为「pyproject 上限 + `test_dependency_guard.py`」、不改 CI，故 `P4 §1` 未动 ci.yml 与 P2 自洽，**不是偏差**。
- **判定：实现路径与 P2 方案 1 吻合。**

## 检查 4：未决项清零

**扫描动作**：`grep -nE '^\[(NEED_CONFIRM|BLOCKER|DEVIATION-CRITICAL)\]' P1-requirements.md`。

- 实测行首命中 = **0**（grep exit 1）。`P1-requirements.md:36` 为 `[NO_NEED_CONFIRM]` 声明；§8 待确认清单（`:363-365`）亦为 `[NO_NEED_CONFIRM]`。
- frontmatter `need_confirm_resolved: []`（`:29`）、`suggest_resolved: []`（`:30`）、`scope_resolved: []`（`:31`）三者皆空，与「无未决项」自洽。
- P6 为客观二值验收（`pass/fail`，`P6-acceptance.md:11-12`），无 `NEED_CONFIRM` 残留。
- **`P7-consistency.md` / `P4-implementation.md` 均无 BLOCKER / DEVIATION-CRITICAL**。
- **判定：未决项清零。**

## 检查 5：CODE-MAP 核对

- `find agate-workspace -name 'CODE-MAP.md'` 实测 = **0 命中**（`agate-workspace/agents/` 仅 `project.md`）→ **CODE-MAP 机制未采用**。
- `P4-implementation.md §7 新增文件核对表`（`:82-84`）声明「本阶段无新增文件，不适用骨架/CODE-MAP 机制」；`P4 §1` 改动清单亦无新增文件。
- 故对照 `CODE-MAP.md` 的逐条核对**不适用**；`code_map_new_files_count=0` / `code_map_reviewed_count=0`。
- 注：任务整体在 **P3** 阶段新增了两个测试文件（`backend/tests/test_datetime_naive_compat.py`、`backend/tests/test_dependency_guard.py`，实测存在），属 P3 产出、非 P4 新增文件；CODE-MAP 机制未采用，不产生 `[CODE_MAP_DRIFT]`。
- **判定：机制未采用，明示不适用。**

## 检查 6（补充）：架构决策落点核对

- `agate-workspace/decisions/` 目录实测**不存在** → 无本任务应落的既有跨任务架构决策可核对。
- 本任务为纯依赖/列语义修复，未引入跨任务架构决策，**无需新增决策**；不产生待办。

## 结论汇总

| 检查项 | 结果 | 锚点 |
|--------|------|------|
| 1 DESIGN_GAP 配对 | ✅ 0 条，无待配对 | `P4-implementation.md §6`（:80）、§7（:82-84） |
| 2 SCOPE+ 闭环 | ✅ 闭环（0 增补） | `P1-requirements.md §4.3`（:324 为条件句）、frontmatter :31；`P2 §0.2`（:83）、`P2 §0.4`（:104-106） |
| 3a packages ↔ bump 范围 | ✅ 一致（仅 peekview） | `P2-design.md §frontmatter`（:12）、`P4 §1`（:23-26）、`git show --stat 14ca829a`；P8 未产出，前瞻判定 |
| 3b BDD 18 ↔ 验收 18 | ✅ 数量/编号逐条匹配 | `P1-requirements.md §3.1-3.6`（:110-213）、`P6-acceptance.md §三`（:38-54）、frontmatter（:11-12） |
| 3c 实现路径 ↔ 方案 1 | ✅ 吻合 | `P2-design.md §1/§2.1/§2.2`（:112-215）、`P4 §1/§2/§5`（:23-76）、`models.py` 25 处、`pyproject.toml:28` |
| 4 未决项清零 | ✅ 0 | `P1-requirements.md` 行首标记 = 0、`:36/:29-31` |
| 5 CODE-MAP | ✅ 机制未采用，不适用 | 无 `CODE-MAP.md`；`P4 §7`（:82-84） |

**最终判定：status = approved**。`blocker_count=0`、`deviation_count=0`、`deviation_critical_count=0`、`design_gap_count=0`、`design_gap_reviewed_count=0`、`code_map_new_files_count=0`、`code_map_reviewed_count=0`。P4 实现未偏离 P1 需求基线与 P2 选定方案 1，可推进 P8。
