---
phase: P8
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: implementer
assignment: releaser（P8 交付收尾模式）
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `P8-release.md`——本任务的交付收尾声明。**你只产出文件，不执行 git commit / 不 bump version / 不 tag**（那些由主 Agent 在 gate 通过后亲自执行）。

### 约束

**P8 的职责边界（严格）**

| 你做 | 你不做 |
|---|---|
| 声明 `bump_type` **意图** | ❌ 执行 version bump |
| 声明 `delivery`（交付方式） | ❌ `git commit` / `git push` / `git tag` |
| 声明 `debt_check` | ❌ 改 `VERSIONS.json` |
| 核对 CHANGELOG `[Unreleased]` 已含 task_id | ❌ 发布到 PyPI |
| 逐 package 跑发布检查命令 | ❌ 修改代码 |
| 写**临时资源清单**（供主 Agent 清理） | |

**必须声明的三个字段（缺失 → `check-gate.py P8` exit 1）**

```yaml
bump_type: minor        # major / minor / patch（意图，不执行）
delivery:               # 非 legacy 任务是结构化 {method, ref, reason}
  method: <非空>        # 如 git-commit（本任务不发布包，只交付代码）
  ref: [<至少 1 项>]    # method ≠ none 时必填
  reason: <说明>
debt_check: reviewed    # none / reviewed
```

> `delivery.method: none` 时 `reason` 必填；`method ≠ none` 时 `ref` 至少 1 项。

**`bump_type` 判定（意图，你给建议 + 理由）**

本任务含**破坏性变更**（API/CLI 的 datetime 字段补 `Z`，是对外可见的响应格式变更）。按 P8 卡规则：
- 公共 API 行为变化 / 破坏性变更 → `major`
- 加功能 / 内部重构改 API（向后兼容）→ `minor`
- 修 bug / 不改 API 行为 → `patch`
- **测试缺陷不应影响版本号决策**

**本项目惯例参考**：项目当前 `0.26.1`，处于 `0.x`（semver 下 0.x 的 minor 可承载破坏性变更）。P4 的 `docs-changelog` 批**已把 upgrading.md 的目标版本写作 `v0.26.1 → v0.27.0`**（minor）。你据此判定并写清理由；**若你认为应是 major，必须说明与项目 0.x 惯例的关系**，由主 Agent 最终裁决。

**逐 package 跑发布检查命令（必须真跑）**

P2/P1 声明了 **3 个包**：`peekview`（后端）/ `frontend-v3`（前端）/ `docs`。

> ⚠️ **注意 F6（P7 已登记）**：`P4-implementation.md` 的 frontmatter `packages` **只写了 `[peekview]`**，这是 P4 的笔误。**P8 的 bump/检查范围必须以 P1/P2 的三包为准**（P1-requirements.md:19-22 与 P2-design.md:11-14 均为 `[peekview, frontend-v3, docs]`）。

建议检查命令（按项目 `Makefile` 的既有 target，**真跑并记录 exit code**）：
- `peekview`：`make test-quick`（后端全量）/ `make lint` / `make typecheck`
- `frontend-v3`：`make test-frontend` / `make build-frontend`（确认构建产物存在）
- `docs`：`make check-docs`

> 这些命令 P5 已跑过且全绿。你可复用 P5 结论（`AUDIT7_RESULT: reuse_allowed`，主 Agent 已确认），但**建议至少实跑 `make check-docs` 与 `make build-frontend`**（后者验证构建产物、前者验证文档一致性——这两条 P5 未作为 gate 项）。

**核对 CHANGELOG `[Unreleased]`（已由 P4 docs 批写好）**

主 Agent 已确认 `CHANGELOG.md` 的 `[Unreleased]` 含 **6 处 `TPV0102` 标记**，覆盖：
- `### ⚠️ Breaking Change`（datetime 补 `Z`，13 个字段全列 + 指向 upgrading.md）
- `### 变更` ×3（时间主显绝对化 / 文件数 0&1 显隐 / 可见性下拉菜单）+ 第 4 条（详情页 `.status-tag` 与 overflow 菜单连带）
- `### 修复` ×1（0 文件专用空态）

**你要做**：核对完整性（4 项需求是否都覆盖），**不要重写**（已合规）。如发现遗漏，**报告主 Agent，不要自行改**（CHANGELOG 属 P4 产出）。

**债务清单核对（`debt_check`）**

- 读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（存在，最大编号 `DEBT0021`）
- 本任务 P7 的 `findings` 里有 **4 条既有债/判据瑕疵**（F1 卡片标题重叠 / F2 `BaseBadge` label stale / F3 BDD-25 后半条不可测 / F4 P2 VC-5 几何不可满足）+ **1 条本任务实现期发现**（F8 / DG7：`stores/team.ts` 失败后无退避重试 → 请求风暴）
- `debt_check` 写 `reviewed`，并在正文**附条目 id 清单**说明：哪些是既有债（不属本任务）、哪些建议新增 DEBT 条目（尤其 F8/DG7 与 F1/F2）
- **不要**自己去 `tech-debt.md` 写新条目（那不是 P8 的职责）——列出建议，由主 Agent 决定

**临时资源清单（releaser → 主 Agent 的交接文件，必写）**

本任务用过的东西（供主 Agent 做 READY 清理）：
- debug backend `:8888`（`make debug-quick`，数据 `/tmp/peekview-debug/`）—— P6 期间由主 Agent 用后台 job 托底
- vision-engine 副本：`.agate-tmp/ve/`（skill 拷贝 + ratelimit 重定向，因沙箱下 `~/.local/share/vision-engine` 只读）
- `.agate-tmp/` 下各类探针/副本（`td_*` / `probe*` / `p6/bdd12-replica.db` 等）
- CDP Chrome `:18800`（外部服务，**不属本任务**，不要建议停）
- 生产 `:8080`：**全程未触碰**

**你在清单里写"本任务启动了哪些"，主 Agent 负责清理。**

### 环境约束
- 严禁触碰生产 `:8080` 与 `~/.peekview/`（应 000）
- **不要**启动/停止 debug 服务（主 Agent 管理）
- 状态标记二值：`[PROD_NOT_TOUCHED]`
- 任何 bash 命令外层 `timeout`（构建类 600s）
- 临时产物落 `.agate-tmp/`

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P2-design.md`（`packages` + `gate_commands` + §9）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（三包声明 / 4 项需求）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P7-consistency.md`（findings + F6）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P5-test-results/`（可复用的验证证据）
- `{AGATE_WORKSPACE}/debt/tech-debt.md`（债务清单）
- `CHANGELOG.md` / `docs/process/upgrading.md`（已写好，核对）
- `Makefile`（检查命令真相源）
- `AGENTS.md`（铁律 8：CHANGELOG；发布流程）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P8-release.md agate-md-field-set --list` 查字段。

已确定值：phase=P8, task_id=TPV0102, parent=P7-consistency.md, trace_id=TPV0102-P8-20261111, agent=implementer, created=2026-11-11, status=draft

由你判定：`bump_type`（建议 minor + 理由）、`delivery`（结构化）、`debt_check`（reviewed）

**主动 set**：`prod_touched false`（hook 会要求）

⚠️ 工具坑：list 字段按**空白拆分**，不要写 `"[a, b]"`；结构化 `delivery` 若工具不支持，用正文 + frontmatter 手写（**先试工具，失败再报告我**）。

### 门槛（什么算完成）
- `P8-release.md` 存在，frontmatter 含 `bump_type` / `delivery`（结构化，method 非空）/ `debt_check`
- CHANGELOG `[Unreleased]` 已含 `TPV0102`（核对通过）
- 逐 package 检查命令已跑并记录 exit code
- 临时资源清单已写
- 债务核对已写（含 4 条既有债 + F8/DG7 建议）
- `check-changelog.py TPV0102` 通过
- **未执行 git commit / 未 bump version / 未 tag**

### 返回给我

只返回四行：
  1. 产出文件路径
  2. 一句话摘要（不超过 40 字）
  3. `bump_type` 判定 + 理由（一句）；三包检查命令的 exit code 汇总
  4. files_modified: [...]
**绝对不要返回文件全文。**

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P8

路径：phase-cards/P8-release.md
---
# P8 — 交付收尾

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P8 + internal_only: true + internal_only_reason 已声明 → 跳过，标记 READY
> ⑨ P8 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 releaser subagent（implementer P8 模式）执行交付收尾
   1.1 写 P8-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. releaser subagent 产出 P8-release.md，**不执行 git commit**
3. 主 Agent 执行 gate 验证 → 通过后同一 commit 提交交付收尾（CHANGELOG `[Unreleased]` 写本任务条目）——**不 bump version、不 tag**
   > **READY 前置 = 交付物 + CHANGELOG `[Unreleased]` 含 task_id + `bump_type` 意图 + 交付收尾 + CI 全绿（含 push 口径）；不含 version bump / tag。**
4. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）——**含 canonical 临时产物目录 `<项目根>/.agate-tmp/`**（受限 harness 下的探针/一次性脚本；其四项约定与「存在却未被忽略」的 P8 告警见 `platform-notes.md`「受限 harness 通用约束」，忽略片段见 `assets/templates/gitignore-fragment.txt`）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P8-release.md，若 .gitignore 忽略需 git add -f）
   ⚠️ **本次 commit 的 .state.yaml 须写 `phase: P8`**（phase = 本 commit 的产出阶段）——
   `pre-commit-gate` 对 `READY` 是跳过（不跑 `gate_p8`），**以 READY 提交会让 P8 gate 从不运行**。
   ⇒ **进入 READY 要单独再提交一次**（`phase: P8` 提交 P8 产出 → 再改 READY 单独提交）。
   `check-state-transition.py` 已机械校验「转 READY 时上一次已提交 phase 必须是 P8」
   （P1 声明 `internal_only` 从而合法裁剪 P8 时允许 P7）。
   ⚠️ 终态 DONE 收尾随任务终态 commit 一起，不要提前写 DONE
   （TAG0042 批 1：`agate-next` 亦**不预写**下一阶段，phase 一律由本 commit 的产出阶段写入。）

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下交付收尾步骤：

1. 读取 P2-design.md packages 声明，确定各包的 `bump_type` 意图（major/minor/patch）
2. 为每个 package 执行发布检查命令
3. 更新 CHANGELOG `[Unreleased]` 写本任务条目（含 task_id）
4. 确认债务清单：读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（若存在），在 P8-release.md 写入 `debt_check:` 字段（TAG0001 Phase 3）
5. 产出 P8-release.md（含 bump_type、CHANGELOG `[Unreleased]` 条目确认、debt_check 字段、临时资源清单）

> **注意**：releaser subagent 不执行 git commit，由主 Agent 在 gate 验证通过后亲自执行；**P8 不 bump version、不 tag**（发布由独立流程 + 人工授权入口触发，见 `state-machine.md` 发布授权说明）。

## 多包发布拆批（模式 2/3，条件触发）

> 仅当 P2 packages > 1 时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry 见 dispatch-protocol「派发编排机制」并行规则。

多包发布时 P8 可拆批并行（模式 2 静态拆批 / 模式 3 并行）：

1. 每个 package 派一个 releaser subagent（implementer P8 模式），各写 `P8-release-{pkg}.md`
2. 各 releaser 只处理自己包的交付收尾（`bump_type` 意图 + CHANGELOG 更新 + 发布检查命令）
3. 所有 releaser 返回后，主 Agent 派合并 subagent 整合唯一 P8-release.md
4. 合并 subagent 需交叉核对：各包版本号不冲突、bump_type 汇总一致、CHANGELOG 变更合并无遗漏
5. 主 Agent 在 gate 验证通过后统一执行交付收尾 commit（**不 bump version、不 tag**）

**合并机制**：单包时 releaser 直接产出 P8-release.md（不走合并）；多包时各 releaser 产 P8-release-{pkg}.md，合并 subagent 整合唯一 P8-release.md 供 gate 检查。

## releaser→主 Agent 交接

P8-release.md 中的**临时资源清单**是 releaser→主 Agent 的交接文件：
- releaser subagent 负责写入临时资源清单（本任务启动的临时服务/进程/数据/开发安装）
- 主 Agent 使用该清单执行 READY 收尾检查中的清理工作
- P8-release.md 由 releaser subagent 产出，主 Agent 不直接编写

## 前置条件

- [ ] P7-consistency.md 通过（无 BLOCKER / DESIGN_GAP 已配对）
- [ ] P2-design.md packages 声明（决定哪些包需要交付收尾检查）

## 产出规格

P8-release.md 必须包含：
- `bump_type: major / minor / patch`（**意图声明**——P8 不执行 version bump，发布由独立流程负责）
- `delivery` 字段——交付方式声明（P8 为**交付收尾**，须声明交付方式；缺失 → `check-gate.py P8` exit 1）。
  **非 legacy 任务**（TAG0050 批 F / F12）为**结构化** `delivery: {method, ref, reason}`：`method`
  非空；`method: none` 时 `reason` 必填；`method ≠ none` 时 `ref` 至少 1 项。legacy 任务保留子串判定
- `debt_check: none / reviewed`——债务清单确认留痕（TAG0001 Phase 3）：`none` = 本次无关注项（合法选项，不视为失败）；`reviewed` = 已核对，建议正文附条目 id 清单。只查留痕存在，不查内容达标、不阻断发布
- CHANGELOG `[Unreleased]` 写本任务条目（含 task_id；载体 `check-changelog.py <task_id>`）
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装

## gate 规则

```bash
check-gate.py P8 $TASK_DIR
```

- bump_type 字段存在
- `delivery` 字段存在（缺失 → exit 1；交付收尾须声明交付方式）
- `debt_check` 字段存在（缺失 → exit 1；内容任意，含 `none` / 未关闭债务 → 不阻断，BDD-17）
- CHANGELOG `[Unreleased]` 含本任务 task_id——载体 `check-changelog.py <task_id>`
- 若任务在 `agate-workspace/roadmap/roadmap.md` 有关联 RM 条目（按 `task_id` 反查「关联任务」列），须先回写「状态」列为 `done`，否则阻断（RM-AG0043）

主 Agent **必须亲自执行**以下验证（不可跳过、不可委托 subagent）：
- 从 P2 packages 逐包读取发布检查命令并执行 → 全部 exit 0
- **P5 验证（TAG0016 BDD-14 精简为条件化表述，底线不变——至少一次客观验证动作不可省）**：
  跑 `python3 agate/scripts/check-p6-provenance.py --audit7-only $TASK_DIR`，读 stdout 的
  `AUDIT7_RESULT: <reuse_allowed|reuse_blocked|no_reuse_claim_possible>` 行判定：
  - `AUDIT7_RESULT: reuse_allowed`（exit 0）→ 复用同一份 `P5-test-results/`（不重新执行命令）
  - `AUDIT7_RESULT: reuse_blocked`（exit 1）或 `AUDIT7_RESULT: no_reuse_claim_possible`
    （exit 0 但结果非 reuse_allowed）→ 完整重跑 `gate_commands.P5`（exit 0 + failed==0）
   - **⚠️ 时序说明（原 DEBT0013，v0.78.2 起已消解）**：`check-protocol-consistency.py` 的 CHECK 7 已改为
     README badge ↔ **CHANGELOG 最新已发布版本**（**tag 无关**），故 release 流程中版本节/badge 更新后、
     打 tag 之前重跑不再报错——"发布进行中"（版本尚无对应 tag）判 **PASS + 提示**。
     ⇒ 发布顺序为 **先合 release PR → 合并后 main CI 绿 → 后打 tag → Release**；tag 指向校验由
     `.github/workflows/release.yml` 的「Verify tag points to matching commit」步承担
     （tag 名须等于 tag 所指提交的 badge 版本）。

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理。以上检查项无 gate 脚本自动验证（已知缺口），**必须逐项实际执行检查命令**（如 `ps aux | grep debug` 确认服务已停止、`git status` 确认工作区干净），不得仅凭记忆打勾。

**提交前暂存面审查（凭证/临时物防泄漏，RM-AG0077⑤）**：
- [ ] **`git diff --cached --name-only` 已过目**，确认不含未忽略的临时目录/敏感文件
  - 背景：**项目侧** release 命令常直接 `git add -A`（如 `make bump-version`）。某任务实测它会 stage
    **162** 条路径、其中 **158** 条在未忽略的临时目录下、含 **10 个明文 token/cookie** ⇒
    **凭证入 git 历史不可逆**。协议侧无法改项目命令，故把这一步作为**提交前的显式检查**。
  - 若发现非预期路径：先补 `.gitignore`（片段见 `assets/templates/gitignore-fragment.txt`）再 `git reset` 重来，**不要**带着它们提交

**状态**：
- [ ] .state.yaml phase == READY
- [ ] {AGATE_WORKSPACE}/tasks/active-tasks.md 任务行状态已更新
- [ ] git 工作区干净
- [ ] 若本任务触发复盘（异常模式 / 发现机制缺口 / 高价值任务），复盘产出
  `tasks/{Txxx}/retrospective.md` 基于 `agate/assets/templates/retrospective-template.md`
  模板撰写

**测试环境已清理**：
- [ ] 调试服务/进程已停止
- [ ] 临时数据已删除
- [ ] 测试占用的端口已释放
- [ ] **canonical 临时产物目录 `<项目根>/.agate-tmp/` 已清理**（或确认无需保留物、已空）
  - 自查：`ls -A .agate-tmp 2>/dev/null`；含明文凭证/会话 token 的先删
  - 约束（受限 harness）：该目录须**已被 `.gitignore` 忽略**（`git check-ignore -q .agate-tmp`）、
    内部文件名**不得**匹配测试收集模式——两项均有 `check-gate.py P8` WARNING 兜底，
    完整约定见 `platform-notes.md`「受限 harness 通用约束」、忽略片段见 `assets/templates/gitignore-fragment.txt`

**开发环境已还原**：
- [ ] 开发安装已卸载
- [ ] 系统环境无污染
- [ ] 项目依赖恢复到发布版本

**协议一致性（改造协议自身的任务必做，TAG0001-0003 批次 D4 教训）**：
- [ ] **在干净 checkout 上跑一次 `check-protocol-consistency.py`**（`git clone` 到临时目录或 CI 兜底确认），0 ERROR
  - 原因：本地 worktree 的 `.worktrees` 路径过滤会掩盖任务产出文件的扫描问题，本地 0 ERROR ≠ CI 0 ERROR
  - 若无法干净 checkout，**至少确认 CI 的 consistency job 对本次 PR 通过**
- [ ] **确认任务产出目录（`docs/tasks/` 或 `{AGATE_WORKSPACE}/tasks/`）不被一致性检查器误扫**（若为 dogfooding 任务，任务产出应已在 `NARRATIVE_DIRS` 白名单）

**生产环境无残留**：
- [ ] 无 PROD_TOUCHED 标记（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- [ ] 生产数据/API 未被测试写入

## 推进条件（全部满足才写 phase: READY）

- [ ] 交付收尾完成（`bump_type` 意图 + CHANGELOG `[Unreleased]` 含 task_id）+ P5 验证全绿（重跑或复用 `P5-test-results/`，见上方「gate 规则」条件化表述）
- [ ] READY 收尾检查全部通过

## 常见错误

1. **不重跑 P5 gate**：交付收尾后直接推进 READY，不确认测试仍全绿
2. **CHANGELOG [Unreleased] 留在模板状态**：未在 `[Unreleased]` 写本任务条目
3. **忘记清理测试环境**：debug server 还在跑、临时数据没删 → READY 不干净
4. **临时资源清单遗漏**：P4/P5 阶段启动的服务/安装的包没记录 → 清理时遗漏
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- READY → DONE：任务完成，代码可合并/发布
- 本任务是 agate 链条的终点——P8 完成后任务状态转为 DONE

> 完成 → 任务 DONE
<!-- AGATE_CARD_END -->