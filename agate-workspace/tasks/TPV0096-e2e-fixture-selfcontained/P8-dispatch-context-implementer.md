# P8-dispatch-context-implementer — TPV0096

---
phase: P8
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0096
role: implementer（P8 releaser 模式）
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P8

路径：phase-cards/P8-release.md
---
# P8 — 发布

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P8 + internal_only: true + internal_only_reason 已声明 → 跳过，标记 READY
> ⑨ P8 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 releaser subagent（implementer P8 模式）执行发布准备
   1.1 写 P8-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. releaser subagent 产出 P8-release.md，**不执行 git commit/tag**
3. 主 Agent 执行 gate 验证 → 通过后执行 bump-version + CHANGELOG 更新 → 同一 commit + tag
4. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P8-release.md，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 READY，不要提前写 DONE——phase = 本 commit 的产出阶段；终态 DONE 收尾随任务终态 commit 一起

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下发布准备步骤：

1. 读取 P2-design.md packages 声明，确定需 bump 的包
2. 为每个 package 执行发布检查命令
3. 更新 CHANGELOG [Unreleased] → 版本号
4. 确认债务清单：读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（若存在），在 P8-release.md 写入 `debt_check:` 字段（TAG0001 Phase 3）
5. 产出 P8-release.md（含 bump_type、版本号变更确认、CHANGELOG 更新确认、debt_check 字段、临时资源清单）

> **注意**：releaser subagent 不执行 bump-version / git commit / git tag，这些由主 Agent 在 gate 验证通过后亲自执行。

## 多包发布拆批（模式 2/3，条件触发）

> 仅当 P2 packages > 1 时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry 见 dispatch-protocol「派发编排机制」并行规则。

多包发布时 P8 可拆批并行（模式 2 静态拆批 / 模式 3 并行）：

1. 每个 package 派一个 releaser subagent（implementer P8 模式），各写 `P8-release-{pkg}.md`
2. 各 releaser 只处理自己包的发布准备（版本 bump 建议 + CHANGELOG 更新 + 发布检查命令）
3. 所有 releaser 返回后，主 Agent 派合并 subagent 整合唯一 P8-release.md
4. 合并 subagent 需交叉核对：各包版本号不冲突、bump_type 汇总一致、CHANGELOG 变更合并无遗漏
5. 主 Agent 在 gate 验证通过后统一执行 bump-version / git commit / git tag

**合并机制**：单包时 releaser 直接产出 P8-release.md（不走合并）；多包时各 releaser 产 P8-release-{pkg}.md，合并 subagent 整合唯一 P8-release.md 供 gate 检查。

## releaser→主 Agent 交接

P8-release.md 中的**临时资源清单**是 releaser→主 Agent 的交接文件：
- releaser subagent 负责写入临时资源清单（本任务启动的临时服务/进程/数据/开发安装）
- 主 Agent 使用该清单执行 READY 收尾检查中的清理工作
- P8-release.md 由 releaser subagent 产出，主 Agent 不直接编写

## 前置条件

- [ ] P7-consistency.md 通过（无 BLOCKER / DESIGN_GAP 已配对）
- [ ] P2-design.md packages 声明（决定哪些包需要 bump）

## 产出规格

P8-release.md 必须包含：
- `bump_type: major / minor / patch`
- `debt_check: none / reviewed`——债务清单确认留痕（TAG0001 Phase 3）：`none` = 本次无关注项（合法选项，不视为失败）；`reviewed` = 已核对，建议正文附条目 id 清单。只查留痕存在，不查内容达标、不阻断发布
- 版本号变更确认（version 文件已修改）
- CHANGELOG [Unreleased] → 新版本号
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装

## gate 规则

```bash
check-gate.py P8 $TASK_DIR
```

- bump_type 字段存在
- `debt_check` 字段存在（缺失 → exit 1；内容任意，含 `none` / 未关闭债务 → 不阻断，BDD-17）
- 暂存区有 version 文件变更
- 暂存区 CHANGELOG 有变更
- 若任务在 `agate-workspace/roadmap/roadmap.md` 有关联 RM 条目（按 `task_id` 反查「关联任务」列），须先回写「状态」列为 `done`，否则阻断（RM-AG0043）

主 Agent **必须亲自执行**以下验证（不可跳过、不可委托 subagent）：
- 从 P2 packages 逐包读取发布检查命令并执行 → 全部 exit 0
- **P5 验证（TAG0016 BDD-14 精简为条件化表述，底线不变——至少一次客观验证动作不可省）**：
  跑 `python3 agate/scripts/check-p6-provenance.py --audit7-only $TASK_DIR`，读 stdout 的
  `AUDIT7_RESULT: <reuse_allowed|reuse_blocked|no_reuse_claim_possible>` 行判定：
  - `AUDIT7_RESULT: reuse_allowed`（exit 0）→ 复用同一份 `P5-test-results/`（不重新执行命令）
  - `AUDIT7_RESULT: reuse_blocked`（exit 1）或 `AUDIT7_RESULT: no_reuse_claim_possible`
    （exit 0 但结果非 reuse_allowed）→ 完整重跑 `gate_commands.P5`（exit 0 + failed==0）
   - **⚠️ 时序注意（DEBT0013）**：若 `gate_commands.P5` 的链路包含
     `check-protocol-consistency.py` 的 CHECK 7（README version badge 与最新 git tag 一致性），
     P5 重跑应安排在 **commit + 创建 git tag 之后** 进行，而非 bump 版本文件后立即重跑——
     bump 已完成、tag 尚未创建的中间状态下，CHECK 7 必然报 `badge vX.Y.A != tag vX.Y.B` ERROR，
     这是设计使然（校验的是"发布完成态"），不是回归。先 tag 后重跑即 0 ERROR。
- `git log v{prev_version}..HEAD --oneline` 对照 CHANGELOG 无遗漏
- 从 P2 packages 验证 version 文件路径

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理。以上检查项无 gate 脚本自动验证（已知缺口），**必须逐项实际执行检查命令**（如 `ps aux | grep debug` 确认服务已停止、`git status` 确认工作区干净），不得仅凭记忆打勾。

**状态与版本**：
- [ ] .state.yaml phase == READY
- [ ] {AGATE_WORKSPACE}/tasks/active-tasks.md 任务行状态已更新
- [ ] git 工作区干净
- [ ] git tag 已创建
- [ ] 若本任务触发复盘（异常模式 / 发现机制缺口 / 高价值任务），复盘产出
  `tasks/{Txxx}/retrospective.md` 基于 `agate/assets/templates/retrospective-template.md`
  模板撰写

**测试环境已清理**：
- [ ] 调试服务/进程已停止
- [ ] 临时数据已删除
- [ ] 测试占用的端口已释放

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

- [ ] bump-version 完成 + P5 验证全绿（重跑或复用 `P5-test-results/`，见上方「gate 规则」条件化表述）
- [ ] CHANGELOG 已更新
- [ ] git tag 已创建
- [ ] READY 收尾检查全部通过

## 常见错误

1. **不重跑 P5 gate**：bump-version 后直接 tag，不确认测试仍全绿
2. **CHANGELOG [Unreleased] 留在模板状态**：版本 bump 完但 CHANGELOG 没更新
3. **忘记清理测试环境**：debug server 还在跑、临时数据没删 → READY 不干净
4. **临时资源清单遗漏**：P4/P5 阶段启动的服务/安装的包没记录 → 清理时遗漏
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- READY → DONE：任务完成，代码可合并/发布
- 本任务是 agate 链条的终点——P8 完成后任务状态转为 DONE

> 完成 → 任务 DONE
<!-- AGATE_CARD_END -->

## 目标

发布准备（只产出文件，不 commit/tag）：P8-release.md + CHANGELOG.md 新增 [Unreleased] 节。本任务裁定**不做版本 bump**（P1 §7：纯测试改动无用户可见行为变化）——bump_type 记 `none` 并附理由。

## 约束

- 产出文件仅两个：`agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P8-release.md` + 仓库根 `CHANGELOG.md`（只新增 [Unreleased] 节，不动既有版本节）；**严禁**碰 VERSIONS.json/package.json 等版本文件、严禁 git commit/tag、严禁 make bump-version
- P8-release.md 必含字段：
  - `bump_type: none`（附理由：3 个 e2e spec 改造 + docs 规范节，无产品代码/无用户可见行为变化；dispatch-prompt P8 追加「测试缺陷不应影响版本号决策」同理适用于测试基建）
  - `debt_check: reviewed`（正文附条目清单：DEBT0010 本任务 closure criteria 已达成候选——三 spec 干净环境全绿已 P6/P6.5 双证，状态转 closed 建议留主 Agent；DEBT0011 t022/verify-mermaid 同型缺陷延后；DEBT0012 seed 422 预存；DEBT0008 部分推进——BDD-13 规范落盘为其 closure criteria 之一）
  - 版本号变更确认：声明「无（bump_type: none）」
  - CHANGELOG 更新确认：[Unreleased] 节已新增（引条目摘要）
  - 临时资源清单（releaser→主 Agent 交接）：本任务全周期启动过的临时服务（debug :8888 多轮启停，均已 debug-stop 清理）/tmp 中间日志（/tmp/p5-e2e-1..3.log、/tmp/p6-*.log、/tmp/bdd12-*.log、/tmp/p2-minval.sh、/tmp/peekview-debug.log）/探针 entry e2e-probe-p2（已删除验证）/无开发安装、无生产触达
- CHANGELOG [Unreleased] 内容方向（成文你自己写，Keep a Changelog 风格，zh-CN）：
  - 测试基建：3 个渲染类 E2E spec（mermaid/mermaid-check/mermaid-visual）自建 entry 化——每 test 匿名创建 fixture（e2e- 前缀确定性 slug、防御性预删、不吞错）+ afterEach 清理队列 + BASE_URL 防生产护栏；死选择器迁移（.mermaid-content→.diagram-viewer/.diagram-code、.mermaid-action-btn→.diagram-action-btn.fullscreen-btn、.diagram-modal-overlay→.diagram-modal）；goto 迁移 /entries/:slug→/:slug；mermaid-visual 假绿修复（断言无条件执行）。干净 debug 环境 14 用例双 project 全绿可重复（DEBT0010 闭环）
  - 文档：docs/process/debug-workflow.md 新增「E2E 编写规范」节（4 条：路由写法/seed 或自建+清理/护栏/认证配对）
- 发布检查命令：无包需 bump → 本节写「不适用（bump_type: none）；快速反馈类检查已由 P5 五键覆盖（单测 1343 绿 + typecheck 通过 + E2E 14 绿）」
- 上下文控制：读 CHANGELOG 头部确认格式、读 P1 §7/P0 裁剪倾向对齐口径即可，不整目录全读
- 严禁 :8080 与 ~/.peekview/；任意 bash 命令外层 timeout 60s；子派发能力：不启用

## 上游关联

- P7 approved（commit f5bc4b6b）：0 BLOCKER/2 笔误级 DEVIATION（judge verdict 措辞层，不阻断）
- P1 §7 裁剪声明：P8 保留、不 bump、CHANGELOG [Unreleased] 记录——本阶段执行落点
- debt 现状：DEBT0010/0011/0012 已登记（tech-debt.md，P7 commit 入库）

## 输入文件

- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P1-requirements.md（§7 裁剪声明）
- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P7-consistency.md（收尾口径）
- agate-workspace/debt/tech-debt.md（debt_check 依据）
- CHANGELOG.md（格式参照）
- /home/kity/oclab/agateon/agate/assets/execution-roles/implementer.md（P8 模式）+ /home/kity/oclab/agateon/agate/assets/templates/dispatch-prompt.md 的「P8 派发追加」节

## 产出文件（路径硬约束）

1. agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P8-release.md（frontmatter 用 agate-md-field-set --list 填；bump_type/debt_check 写正文或 frontmatter 以 --list 允许为准，两处都有更稳；agent 被拒则手写记录）
2. CHANGELOG.md（顶部新增 `## [Unreleased]` 节，位于 `## [0.24.1]` 之前）

## 门槛（什么算完成）

- P8-release.md 含 bump_type: none + debt_check: reviewed + 四要素（版本确认/CHANGELOG 确认/临时资源清单/检查命令声明）
- CHANGELOG.md 有 [Unreleased] 节且内容与实际改动一致（不虚构未做事项）
- 未触碰版本文件、未 git 操作
- 返回前 bash grep 确认两文件改动落盘

## 返回给我（重要）
只返回：
1. P8-release.md 路径
2. 一句话摘要（≤30 字）
3. files_modified: [P8-release.md, CHANGELOG.md]
绝对不要返回文件全文。