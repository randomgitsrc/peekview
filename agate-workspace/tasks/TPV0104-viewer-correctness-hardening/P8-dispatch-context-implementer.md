---
phase: P8
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: releaser
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P8 交付收尾**：产出 `P8-release.md`（含 `bump_type` 意图、CHANGELOG `[Unreleased]` 条目、`debt_check`、临时资源清单）。

⚠️ **你只产出文件，不执行 git commit**（由主 Agent 在 gate 通过后亲自执行）。
⚠️ **P8 不 bump version、不 tag**（版本发布由独立流程 + 人工授权触发）。

### 你要做的 5 件事

#### 1. 确定 `bump_type` 意图

P2 声明的 `packages` = `['peekview', 'frontend-v3', 'docs']`。

**判断依据（本任务的实际改动性质）**：
- **后端**：新增注入预算能力（`_MAX_INJECT_IDS` 50→40、新增单文件文本 2 MiB + 总字节 8 MiB 上限、`skipped[]` 跳过清单、`?inject=` 加 `max_length=4096`）；`order_by` 确定性
- **前端**：新增 `?file=` 持续态 URL 参数、全屏入口按钮、TOC h1–h4、截断态表头、真实字节判断
- **是否有 Breaking Change？** 需你判断并说明：
  - `_MAX_INJECT_IDS` 50→40 是**行为收紧**（超过 40 个 sibling 现在会被跳过并记录，之前会注入到 50）→ **对依赖 41–50 个资源注入的用法是行为变化**
  - `?inject=` 超 4096 字符 → 422（之前无限制）
  - 但都不改 API 签名/响应结构，只加字段（`skipped[]` 是新加）
  - → **请你独立判断 `bump_type`，并写清理由**。参考本项目 CHANGELOG 历史（`0.27.0` 曾因 datetime 形态变化记 Breaking Change）
- **`mcp_server` 不在范围**：P2 的 `packages` 明列不含它（`P1-requirements.md:528` 声明范围外），实测 `packages/mcp-server/` **零改动** → **请在 `P8-release.md` 里显式声明「不 bump `mcp_server`」并引用 `P1:528`**，避免版本一致性检查误判漏 bump。

#### 2. 为每个 package 执行发布检查命令

P2 的 `gate_commands` 里有 `P8*` 键（若有）。请核对并执行；若无 `P8*` 键，则跑：
```bash
make test-quick        # 后端
make test-frontend     # 前端
make typecheck
make lint
make check-docs        # 文档版本一致性
```
逐条记录 exit code 与结果。

#### 3. 更新 CHANGELOG `[Unreleased]`（**这是你的产出之一**）

当前 `CHANGELOG.md` 的 `## [Unreleased]` 是**空的**。你需要写入本任务条目。

**要求**：
- **含 `task_id: TPV0104`**
- 按 Keep a Changelog 分类（`### 新增` / `### 变更` / `### 修复` 等；本项目用中文分类，见历史条目）
- 内容要**面向用户**，说清「用户能感知到什么变化」，不要写内部实现细节
- 参考 `0.27.1` / `0.27.0` 条目的写法与详略程度

**本任务给用户的实质变化（供你组织文案，不要照抄）**：
- HTML 预览的资源注入现在有明确上限（40 个资源 / 单文件 2 MiB / 总计 8 MiB），超出的会被跳过并**在响应里给出可机器解析的跳过清单**（之前是静默丢弃）
- 大文件查看按**真实字节数**判断（之前中文内容会因「字符数≠字节数」被误判）
- Markdown 目录支持 h1–h4（之前漏掉 Setext 标题产生的 h1），同名标题锚点不再冲突，目录文字不再带 Markdown 标记
- 详情页 URL 支持 `?file=<id>` 深链（刷新/分享保留当前文件），全屏阅读可直达当前文件
- 表格截断时明确告知「已显示前 N 行，共 M 行」，且截断态不再提供无效的排序/筛选控件
- 全屏阅读模式不再保留侧栏空白

#### 4. `debt_check` 字段

读 `agate-workspace/debt/tech-debt.md`，在 `P8-release.md` 写入 `debt_check:` 字段。**本任务新增了 DEBT0022**（存储层同名覆盖，`status: open`）——请核实并写入。

#### 5. 临时资源清单

列出本任务使用过的临时资源并确认已清理：
- `<项目根>/.agate-tmp/` 下的探针脚本、日志、临时 app 数据
- debug 实例数据目录
- **确认无残留 entry**（debug DB 中不应有 `tpv0104` 相关残留）

### ⚠️ 严格边界

1. **不执行 `git commit`**
2. **不 bump version、不打 tag**（不改 `VERSIONS.json`）
3. **不改实现代码与测试**
4. **不改 `P1-requirements.md`**
5. `CHANGELOG.md` 只改 `[Unreleased]` 区域，不动已发布的历史条目

### 环境隔离（强制）
- **新代码在 `:8893`**（`:8888`/`:8890` 有宿主侧旧进程残留，仅可只读探测）
- **严禁** `:8080`、**严禁** `~/.peekview/`
- 状态标记二值：`[PROD_TOUCHED]` / `[PROD_NOT_TOUCHED]`
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- 命令外层 `timeout`（`make test-quick` 等长命令用 600s）

### 产出规格（`P8-release.md`）

必须含：
- **`bump_type:`** 字段（每个 package 一个，含判断理由）
- **`debt_check:`** 字段
- CHANGELOG `[Unreleased]` 条目确认（贴出你写入的内容）
- 各 package 的发布检查命令与 exit code
- **显式声明 `mcp_server` 不 bump + 引用 `P1:528`**
- 临时资源清单 + 清理确认
- 若有 Breaking Change，单列一节说明

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（`packages`、`gate_commands`）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（BDD + `:528` 的 mcp_server 范围声明）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6-acceptance.md`（54/54 PASS）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P6.5-judge-verdict.md`（judge passed 54/54）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P7-consistency.md`（BLOCKER 0 / CRITICAL 0）
- `{project_root}/CHANGELOG.md`（**只改 `[Unreleased]`**）
- `{project_root}/VERSIONS.json`（**只读，不修改**）
- `{AGATE_WORKSPACE}/debt/tech-debt.md`（**只读**，取 `debt_check`）
- `{project_root}/AGENTS.md`（发布流程、铁律）

</dispatch_guide>

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

<objective_info>
- **任务**：TPV0104 Viewer 正确性与资源边界加固（8 项缺陷 / 54 条 BDD / 跨前后端）。
- **状态**：P1–P7 全部完成。P6 判 54/54 PASS；P6.5 judge `passed`（54/54）；P7 BLOCKER 0 / CRITICAL 0。
- **提交链**：`4ec6b1b6`(P4) → `e11208ad`(P5) → `a918b092`(P6) → `660a4749`(P6 重验) → `5b8e831b`(P6.5) → P7（最新）。
- **当前版本**：`VERSIONS.json` = `peekview 0.27.1` / `mcp_server 0.12.0`（**只读，不修改**）。
- **CHANGELOG 现状**：`## [Unreleased]` 为空（待你写入）。
- **测试基线（P7 后）**：后端 **1222P / 1F（预存 `test_cli_remote`，沙箱 `~/.peekview/` 只读）/ 3S**；前端 **127 files / 1514P / 4S / 0F**；`make typecheck` / `make lint` / `make check-docs` 全 exit 0；`make build-frontend` exit 0。
- **技术债**：`agate-workspace/debt/tech-debt.md` 共 **19 条**，本任务新增 **DEBT0022**（`status: open`，存储层同名覆盖）。
- **P2 冻结的对外可见值（写 CHANGELOG 时可引用）**：注入上限 **40 个资源** / 单文件文本 **2 MiB** / 总字节 **8 MiB**；`skipped[]` 六元 reason（`count_limit`/`file_too_large`/`binary_too_large`/`total_budget`/`not_found`/`not_injectable`）
- **本任务修了 7 项真实缺陷**（其中 4 项在「全绿」状态下被评审/judge 抓出）：预算单位错配（字符 vs 字节）、`İ` 致 `</body>` 劈开、`not_injectable` 缺 `file_id`、`overflow` 无界 13×、`owners` 互覆盖、BDD-38 Then③ `filename: null`、e2e 证据路径相对 cwd。
- 环境：`:8893` 在线（新代码）；生产 `:8080` 不可达；`~/.peekview/` mtime **2026-11-12**（零写入）。
</objective_info>
