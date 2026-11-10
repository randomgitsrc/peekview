---
phase: P8
task_id: TPV0102
task_name: explore-card-list-ux
created: 2026-11-11
agent: main
type: retrospective
---

# TPV0102 复盘 — Explore 列表体验修正

## 1. 任务概览

| 项 | 值 |
|---|---|
| 任务 | TPV0102 explore-card-list-ux |
| 范围 | 四项 UX 修正（时间显示 / 文件数显隐 / 可见性下拉 / 0 文件空态）+ 一个破坏性变更（API 时间字段补 `Z`） |
| 阶段 | P0 → P8 全走（无裁剪） |
| 产出 | 30 条 BDD / 112 测试用例 / 30 条 BDD 全 PASS / 13 条 DESIGN_GAP 全配对 |
| 评审 | P1 两轮、P2 三轮（双评审）、P4 两轮（双评审）、P6.5 judge 独立复核 30/30 |

## 2. 值得沉淀的机制发现（按价值排序）

### 发现 1：subagent 四次纠正主 Agent —— 其中两次是我给错了 schema

这是本任务最值得记录的信号。四次纠正：

| # | 谁 | 纠正了什么 | 我的错误性质 |
|---|---|---|---|
| 1 | analyst | 否决 `new Date(本地化文本)` 反解判据（实测 `ja-JP` → `NaN`、`de-DE` → 错月份） | 我给了个**看似合理但实测不成立**的方案方向 |
| 2 | architect | 补出 `tail -30` 截断 traceback 的根因（我的四格矩阵少一格） | 我的矩阵**不完整** |
| 3 | eng-review | 纠正「假绿」归因（`agate_common` 强制 `set -o pipefail`，管道取左侧失败码） | 我在**裸 shell** 测出结论就当成结论，没走被测系统的真实执行通路 |
| 4 | P7 consistency-reviewer | DESIGN_GAP 实际 13 条（我数成 18）、`verdict`/`basis` 枚举非法 | **两处都是没核对脚本源码就凭印象写** |

**共性根因**：我给出的「客观查证信息」里混入了**未经权威源核对的推断**。

**具体教训（可直接执行）**：
- **给 subagent 的 schema / 枚举 / 数量，必须从权威源核对**——枚举查契约 YAML（如 `rules/task-data/level-2.yaml` 的 `method_enum`），数量用**权威计数函数**而非宽松 grep（`count_design_gap(allow_blockquote=False)` 的 `^\s*-?\s*\[DESIGN_GAP:` vs 宽松 `grep -c "\[DESIGN_GAP"` 差 5 条）
- **自测必须走被测系统的真实执行通路**——测 `check-tdd-red.py` 的行为就得经 `agate_common.run_test_with_formatter`（它有 `set -o pipefail` 前缀），不能用等价「简化复现」替代
- 宽松 grep 的假阳性形态：**小节标题**（`### …（[X] 候选）` 无冒号）与**表格引用**。计数量时先看命中样本，再决定口径

### 发现 2：「既有失败」的定性必须有正确对照基线

P4 rev1 把 8 项 E2E 红定性为「既有失败」，理由是「还原本轮 4 处 CSS 后重跑，红法一致」。

**这个对照的基线选错了**：它只能证明「不是这一轮引入的」，不能证明「不是前四批引入的」。而那些 spec **全是本任务 P3 新写的**——本任务之前根本不存在，按定义不可能是预存失败。

**判据（可直接执行）**：
- 对照基线必须是**任务开始前的 HEAD**（`git stash` 全部改动 / `git show <pre-task-commit>:` 对比），不是「本轮改动前」
- **新写的测试不可能有「预存失败」**。若一份 spec 是本任务创建的，它的红只能是本任务引入（或测试自身写错）
- 收尾自查要看**总输出**，不只看 `passed/failed` 计数：全量 vitest 报 `Tests 1456 passed` 同时 `Errors 1 error`（unhandled rejection），只看计数会漏

### 发现 3：验收判据本身可能写错，必须区分「实现未达标」与「判据不可达」

本任务有 **2 条判据本身写错**（已在 P7 登记）：

| # | 判据瑕疵 | 本质 |
|---|---|---|
| F3 | BDD-25 后半条「与多文件未选中可区分」——但 `entryDetail.loadEntry` 在 `files.length > 0` 时**恒选 `files[0]`**，`empty-select-file` 分支**不可达** | P1 写了一条产品里不存在的场景 |
| F4 | P2 VC-5 的 `<=2px` 基线在 280px 卡宽 + 207px 绝对时间下**几何上不可满足**（en-US 桌面 20/20 卡都换行） | P2 定的阈值没做量纲核算 |

**教训**：写 BDD/视觉契约时，先验证「这个场景在产品里可达吗」「这个阈值在目标视口下算得出来吗」。不可达的判据比没有判据更糟——它会诱使实现方为了让测试变绿而扭曲产品。

### 发现 4：协议层缺陷（建议报上游）

`check-changelog.py` 的右边界正则 `( |:|$|,|-)` **不含全角 `）`**，而本仓 CHANGELOG 惯例正是 `（TPV0102）` → 该检查对**全仓 12/12 历史 task_id 全部 exit 1**。

- 实测：`（TPV0102）` FAIL / `(TPV0102)` 半角亦 FAIL / 仅 `（TPV0102 ）`（加空格）PASS
- 影响面：`pre-commit-gate.py` 只 WARNING 不阻断，`check-gate P8` 不读它 → **不阻塞发布**，但**信号完全失效**（所有任务都红 = 没有信息量）
- **处置**：本任务拒绝改 CHANGELOG 凑绿灯，登记为协议侧债

同类还有一处：`agate-inject-card.py P6.5` 因 `agate-next-card.py P6.5` 输出为空而失败（P6.5 无独立阶段卡片），需手工注入 P6 卡内容。

## 3. 流程执行中的自检失误（主 Agent 自身）

| # | 失误 | 纠正方式 |
|---|---|---|
| 1 | 用 `sleep` 轮询 subagent 状态（用户指出浪费 token） | 改为**结束本轮等通知**。根因：把「长驻服务需后台 job 托底」的平台规则**错套到 subagent 上**——subagent 是受管理任务，完成时会回调，不需要托底 |
| 2 | 用 `; echo $?` 取管道退出码，把 `check-gate P6` 的 `exit 2` 误读成 `exit 0` | 改为**精确测量**（不带管道）再判定 |
| 3 | P1/P2/P3/P5 四次因缺 `prod_touched` 被 pre-commit 拦 | 应固化为：**每阶段写主产出时立即 `set prod_touched false`**（`--list` 不列该字段，但 hook 对非 legacy 主产出强制要求） |
| 4 | P4 gate 首次 exit 1 且无 stderr | 原因：P4/P5/P6 gate 检查**暂存区**（`git diff --cached`），必须先 `git add` 再跑 |

## 4. 建议登记的债务（交发布流程 / 后续任务）

| # | 内容 | 来源 |
|---|---|---|
| DEBT0022（建议） | `stores/team.ts` 的 `loadMyTeams` catch 只置 `error` 不置 `teamsLoaded` → 失败后每次 `ensureMyTeamsLoaded()` 都重试（请求风暴） | P7 F8 / P4 DG7 |
| DEBT0023（建议） | ① 卡片长标题与右上 hover 操作区重叠（既有债，本任务已减轻 121px，最坏仍 34px）② `BaseBadge` label 在 setup 期求值一次 → 可见性切换后徽章文字 stale | P7 F1 / F2 |
| 协议债（建议报 agateon 上游） | `check-changelog.py` 全角 `）` 右边界缺陷 | 本复盘发现 4 |

## 5. 结论

本任务四项 UX 改动 + 一个破坏性变更全部交付，30 条 BDD 全 PASS，13 条 DESIGN_GAP 全配对，P6.5 judge 独立复核通过。

**最大收获不是代码，而是四次被 subagent 纠正**——它们暴露了一个稳定模式：**我在「客观查证信息」里容易混入未核对权威源的推断**。已把教训固化为可执行判据（发现 1 的三条），后续任务应直接套用。
