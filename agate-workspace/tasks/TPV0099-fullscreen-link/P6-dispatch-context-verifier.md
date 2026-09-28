# P6-dispatch-context-verifier — TPV0099

---
phase: P6
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: verifier
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P6

路径：phase-cards/P6-acceptance.md
---
# P6 — 验收

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P6 不可裁剪。no_behavior_change 可简化（快速验收），不可省略。
> `change_type: refactor` 的任务（P1 frontmatter 声明）P6 **换用回归验收口径**（换口径 ≠ 裁 P6，P6 仍不可裁剪）——见下方「refactor 任务：回归验收口径」。

## 如果是首次进入本阶段

1. 派发 verifier subagent → 产出 P6-acceptance.md + P6-evidence/
   1.1 写 P6-dispatch-context-verifier.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. UI 任务：派 vision-analyst → 产出 vision-reports/（P1 vision 能力 GAP 降级时改走
   人工复核记录路径——截图/帧序列证据 + `(manual-review: <file>)` 引用，不派 vision-analyst）
3. 主 Agent 逐条核实 BDD 对照结果
4. **post-test 环境残留检查（强制步骤）**：验收测试执行完毕后、记录 PASS 证据前，先做环境残留检查——
   快照比对（测试前环境快照 vs 测试后）或清理钩子验证（创建型测试的清理钩子已执行、无残留对象）二选一；
   发现残留先清理并记录，残留未清不计入 PASS 证据。
5. **功能验证和 gate 格式都必须满足**（T046 教训：先做功能验证，不要只凑格式）
6. **运行 `python3 $AGATE_ROOT/scripts/check-p6-format.py --fix "$TASK_DIR/P6-acceptance.md"`** 归一化 PASS/FAIL 大小写和行首空白（verifier 产出后、gate 前，① 自动格式化）
7. 预跑 check-gate.py P6 + check-p6-evidence.py + check-p6-provenance.py
8. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P6，不要提前写 P7——phase = 本 commit 的产出阶段
9. git commit -m "wf({Txxx}-P6): {摘要}"（phase=P6，P6 产出含 P6-acceptance.md + P6-evidence/）
10. P6 commit 完成后进入 P7：**phase 推进 P7 随 P7 产出 commit 一起**（P7-consistency.md 就绪后），不是单独 phase commit
11. **P6.5 judge 复核（强制，所有任务）**：P6 commit 后、P7 前，主 Agent 写 `P6.5-dispatch-context-judge.md`（白名单输入，含角色定义文件路径豁免，见 dispatch-protocol.md「Judge 信息隔离」节）→ 派发 judge（fresh context 逐条重验**所有** BDD，含已 PASS 项，只信证据与 git log）→ judge 产出 `P6.5-judge-verdict.md` → 主 Agent 跑 `check-gate.py P6.5 $TASK_DIR`（= check-judge-verdict.py + check-events.py 双 exit 0；**历史任务无 `judge.enabled: true` 自动跳过**）→ 通过 → verdict 随 commit 落库（**phase 保持 P6**，P6.5 非独立 phase 值）→ 写 `phase: P7`

## 如果是重试

确认上一轮失败原因（BDD 不覆盖 / 证据不足 / gate 格式拦截）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P6 MAX=2）

## 核心原则 ⚠️

**功能验证和 gate 格式都必须满足。** T046 教训：花 2 小时凑 PASS 格式，没花 5 分钟检查 API 响应头。不接受只满足格式不验证功能，也不接受只验证功能不满足格式。gate 是必要条件（格式不对 → commit 不了），不是充分条件（格式对了 ≠ 功能正确）。

**验收报告记录的是验收时的事实，不是修复后的状态。** P6-acceptance.md 的 PASS/FAIL 声明必须基于 evidence 文件的实际输出。如果验收时 BDD 为 FAIL，写 FAIL——修复后重新验收时再改 PASS。不能在同一个 P6 acceptance 里写"修复后 PASS"。

## 前置条件

- [ ] P1-requirements.md BDD 验收条件完整（含 SCOPE+ 增补）
- [ ] P1 声明的 capability_requirements 中 ability 为 available

## 派发

- **角色**：verifier（`{agate_root}/assets/execution-roles/verifier.md`）
- **UI 任务追加**：vision-analyst（`{agate_root}/assets/execution-roles/vision-analyst.md`）
- **输入**：P1-requirements.md + P5-test-results/
- **输出**：P6-acceptance.md + P6-evidence/

## 产出规格

### P6-acceptance.md

- BDD 逐条对照，每条只允许 PASS 或 FAIL（不允许"调整/跳过/覆盖"）
- 所有 PASS 必须有文件引用：`- PASS Bxx: 描述 (p6-bxx.png)` 或响应日志/断言文件
- UI 任务：操作类 BDD 截图必须互不相同（md5 去重），查询类 BDD 可不截图但须有断言记录文件
- UI 任务：每条 UI 类 PASS 的视觉证据按 **P1 vision 能力三态分档** + **渲染形态选择形式**：
  - **available / supplementable**（P1 capability_requirements 视觉条目 status；无声明默认
    available 语义）→ 含 vision 引用 `(vision: vision-reports/bxx.yaml)`（blocker_count=0）
  - **GAP**（无视觉能力，走降级链）→ 视觉证据 = 截图/帧序列 + **人工复核记录**引用
    `(manual-review: review-bxx.md)`，不要求 vision YAML；复核记录文件必须存在
  - **渲染形态**（P1 frontmatter `ui_render_shape`，缺失=常规布局型）选证据形式：常规布局型 =
    截图/行为日志；渲染组件型可选用**帧序列**（`frames/{bdd-id}-{NN}.png`，PASS 行引首末帧）、
    **渲染输出对比**（`renders/{bdd-id}-{variant}-actual.png`/`-reference.png`/`-diff.json`，
    PASS 行引 actual + diff，diff.json 含量化度量）或**时序截图**
    （`screenshots/{bdd-id}-t{N}.png` 时刻后缀）；帧序列与 `-tN` 时序截图按"同 BDD 证据组
    （bdd-id 前缀）"同权豁免 avg-hash 雷同判定
  - **输入态/交互形态变化类 BDD**（When 子句含输入动作或动作/特效/时序触发）→ 结论必须附
    **人工复核记录**（复核人/复核时间/复核结论），不能仅由自动断言通过——判定标准见
    `assets/execution-roles/verifier.md`
  - **雷同截图降级待复核**：avg-hash 高度相似截图（非逐字节相同）跨 BDD 组重复 → 须附
    `雷同截图复核` 记录或 manual-review 引用（复核人确认"确为不同操作但视觉相近"）才放行；
    无复核记录 → check-p6-evidence 拦截（exit 1）

`pass:`/`fail:`/`ui_affected:` 汇总写在文件头 **frontmatter**（`---` 分隔块），不写正文。
**可直接复制的完整样例**：
```yaml
---
phase: P6
task_id: TAG0001           # 替换为实际任务编号
type: acceptance
parent: P5-verification.md
trace_id: T001-P6-20260101 # {task_id}-P6-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: verifier
# ── v2.0 机器汇总 ──
pass: 28                          # int ≥0
fail: 0                           # int ≥0
ui_affected: false                # bool（与 P2 声明一致）
---
```

**PASS 行最小格式规范**：

```
- PASS BDD-NN: {描述} ({证据路径})
```

证据路径格式：
- 截图：`(screenshots/{filename}.png)`
- vision：`(vision: vision-reports/{filename}.yaml)`
- 其他：`(result.json)` / `(assert.log)` / `(P6-evidence/{filename})` / ...
- 多文件引用（逗号分隔）：`(file1.json, file2.log)` / `(screenshots/a.png, screenshots/b.png)`

描述文本可自由添加，不影响解析（provenance 脚本用精确正则提取路径）。

**总结行格式**：行首 `- PASS`/`- FAIL` 只用于 BDD 条目，不得用于总结行。总结行用其他格式（如 `**Summary**: 34/34 PASS, 0 FAIL`）。check-p6-format.py `--fix` 会自动修正违规总结行。

### P6-acceptance.md（refactor 任务：回归验收口径）

> 适用：P1 frontmatter 声明 `change_type: refactor` 的任务（P2-design.md §3.2）。功能任务（缺省）走上方既有口径，不受本节影响。

refactor 任务无新增功能行为可验收，P6 验收口径 = **行为不变声明 + 全量回归全绿 + 关键路径 BDD 逐条**，固定为三段式：

1. **行为不变声明节**：verifier 自声明"本次重构仅改变内部实现，不改外部行为；判定依据 = 全量回归全绿 + 关键路径 BDD 逐条 PASS；**禁止为凑验收数量新增功能性质 BDD**（禁止伪造功能 BDD）"。
2. **全量回归全绿节**：以"全量回归全绿"为一条关键路径 BDD 的 PASS 行——`- PASS BDD-NN: 全量回归全绿（重构后完整测试套件 0 失败）(P6-evidence/regression.log)`，其中 regression.log 为全量回归套件实跑输出，尾行 `EXIT_CODE: 0`（check-p6-provenance.py 审计 5 核对）。
3. **关键路径验收节**：其余关键路径行为不变断言 BDD 逐条 PASS/FAIL（每条带证据引用）。

frontmatter 额外声明 `regression_pass: true`（bool，可选字段）：
```yaml
# ── v2.0 机器汇总 ──
pass: N
fail: 0
ui_affected: false
regression_pass: true      # refactor 口径：全量回归全绿声明（change_type=refactor 时 gate 必校验）
```

约束：
- **回归双证是硬校验**：`regression_pass: true` + `P6-evidence/regression.log` 存在是 check-gate.py P6 对 refactor 任务的强制要求，任一缺失 → gate exit 1（BDD-4）。回归检查独立于关键路径 FAIL 判定，关键路径 PASS 不能豁免。
- **regression.log 必须被一条 PASS 行引用**（满足 check-p6-provenance.py 审计 1c 证据引用 + 审计 5 EXIT_CODE 核对）。
- **禁止新增非 BDD 编号 PASS 行**：check-p6-format.py 只认 `- PASS|FAIL BDD-N` 行，回归结果不能单列 `- PASS REGRESSION: ...`——"全量回归全绿"作为一条关键路径 BDD 的 PASS 行呈现，多文件证据用逗号分隔。
- **BDD 编号机制不豁免**：refactor 任务 P1 仍须 ≥1 条"关键路径行为不变断言" BDD，P6 逐条 PASS/FAIL 对照（check-p6-provenance.py 审计 3 的 PASS+FAIL ≥ P1 BDD 数 对 refactor 不豁免）。
- **no_behavior_change 不豁免回归双证**：refactor 口径只看 change_type，即使任务声明了 no_behavior_change，回归双证仍强制（BDD-6）。
- **禁止伪造功能 BDD**：禁止为凑验收数量新增功能性质 BDD——refactor 任务的 BDD 都是关键路径行为不变断言。

### P6-acceptance.md（引用 P5 证据、不重跑：BDD-12/13）

> 适用范围：`change_type: refactor` 任务的「全量回归全绿」证据（上方口径要求独立 `regression.log`）。TAG0016 起，当 P5 通过点到本次 P6 发起时点之间**无非产出文件改动**时，可引用同一份 `P5-test-results/`，不必再独立跑一次全量回归产出 `regression.log`。

判定依据：`check-p6-provenance.py` 审计 7（`audit7_p5_evidence_reuse`，读取 `.state.yaml` 的可选字段 `p5_pass_commit`，比对 `p5_pass_commit..HEAD` 间的改动，排除 `agate-workspace/tasks/` 前缀后判定）：

- **`reuse_allowed`**（无非产出文件改动）→ 允许「行为不变声明」引用 `P5-test-results/` 路径作为全量回归证据的 PASS 行引用（如
  `- PASS BDD-NN: 全量回归全绿（复用 P5 通过证据，P5→P6 间无代码改动）(../P5-test-results/unit.md)`），不必新产出 `P6-evidence/regression.log`
- **`reuse_blocked`**（检测到非产出文件改动，含 BDD-13 场景：P6→P4 修复后重到 P6 但未重跑 P5）→ 仍要求按上方既有口径独立产出 `P6-evidence/regression.log`（尾行 `EXIT_CODE: 0`），不得声明复用
- **`no_reuse_claim_possible`**（`.state.yaml` 无 `p5_pass_commit` 字段，存量任务兼容）→ 静默回退，等同 `reuse_blocked`，按既有口径独立产出 `regression.log`

**gate 门槛**：若 P6-acceptance.md 已写"引用 P5 证据"类表述但审计 7 判定为 `reuse_blocked`，`check-p6-provenance.py` 拦截（exit 1，GATE PROVENANCE），要求重跑 P5 后再走 P6。判定方向保守——失败只会导致"本可复用却被要求重跑"，不会出现"应重跑却被放行"的安全漏洞。

### P6-evidence/

- 必须非空，每个文件含实质内容（截图 >1KB，断言文件含实际输出）
- 不接受 1 行文本文件充数（T046 教训：15 个 1 行 txt 文件凑 provenance 数量）
- 元素级截图建议使用父级元素 + padding，避免过小截图（≤1KB 虽不阻断但会触发 WARNING）
- 操作类 BDD 截图必须互不相同（md5 完全重复会被 hook 硬阻断，无例外）。
  若某个行为差异类 BDD 天然会产出视觉相同的页面（如两个不同查询都命中同一个空状态），
  优先改用非截图证据（断言日志 / response.json）而非截图，或截图时带上能体现差异的元素
  （如带时间戳的调试面板、高亮差异区域），确保截图本身逐字节不同。
  查询类 BDD 本来就可以不截图，这类场景应优先归为查询类而非勉强用截图。

### vision-helper 结论绑定 ⚠️

- `ui_affected: true` 时至少一条 PASS 基于 vision-helper 报告
- vision-helper 报 `blocker_count > 0`：不能仅用程序化指标（naturalWidth>0, complete=true, HTTP 200）反驳
- 必须追查根因（curl -I 检查响应头 / DevTools Network / API 日志），追查结果写入 P6-acceptance.md
- **真实视觉分析（BDD-10）**：P1 显式声明视觉能力 status=available 时，P6 必须执行**真实视觉分析**
  ——按所选证据形式（截图/帧序列逐帧描述帧间差异与时序/渲染输出对比描述结果差异）→ 结构化描述 →
  判定 BDD；**不得仅以 naturalWidth>0 / complete=true / HTTP 200 / 像素方差断言视觉 PASS**。
  视觉分析对象不写死工具/技术栈（vision YAML 由 vision-analyst 产出，形式随渲染形态适配）；
  渲染组件型任务的真实视觉分析按所选证据形式执行：帧序列逐帧描述 → 时序/动效判定、渲染输出对比
  → 结果差异描述 → 判定（anchor 为 P1/P2 定义的量化判据）。渲染正确性/时序/动效类 BDD 的判据
  必须有量化锚点（渲染结果对比 + diff 度量/帧时间戳对齐/动效起止状态断言），禁主观词。

## gate 规则

```bash
check-p6-format.py --fix $TASK_DIR/P6-acceptance.md  # ① 自动格式化（verifier 产出后、gate 前）
check-gate.py P6 $TASK_DIR      # FAIL=0 / 总数>0
check-p6-evidence.py $TASK_DIR  # 证据目录非空 / UI截图>1KB / md5去重
check-p6-provenance.py $TASK_DIR # 证据-结论对应 / dispatch-context审计 / BDD对照 / P5证据复用判定（审计7，BDD-12/13）

# ── P6.5 judge 复核（强制，所有任务；历史任务无 judge.enabled: true 自动跳过）──
check-gate.py P6.5 $TASK_DIR    # = check-judge-verdict.py + check-events.py 双 exit 0
```

- FAIL > 0 → gate exit 1 → 回 P4

格式问题 → 运行 check-p6-format.py --fix 归一化 → 再验 gate → … → 通过（⑩迭代循环，格式迭代和 gate 重试共享 retry 预算）

**⚠️ FAIL > 0 时，主 Agent 不能直接改项目源码让它变绿**：P6 是 self-authored gate（判定对象是 verifier 自己写的 P6-acceptance.md），验收阶段本身不应该有代码变更——`pre-commit-gate.sh` 会硬拦截 phase=P6 时暂存的非证据文件（不在 `P6-evidence/` 下的文件）。正确流程：诊断问题出在哪个上游阶段 → 退回该阶段（`agate/rules/state-transitions.md` 回退规则，退回前须先跑 `agate-archive-stale-outputs.py` 归档当前 P6 产出，或用 `agate-retreat-to.py` 自动化多步回退）→ 重新派发对应角色 subagent 修复 → 重新走到 P6 时，旧的 P6-acceptance.md/P6-evidence/ 已被归档清空，verifier 必须重新产出真实证据，不存在"挑几条改改、其余沿用旧结论"的空间。**回退落地后必须建 DEBT 条目**（`source: retreat`，`evidence` 引用 retreat 提交哈希，模板 `assets/templates/tech-debt-template.md`——TAG0001 强制，见 `agate/rules/state-transitions.md` 回退规则节）。

## 按包拆分并行（条件触发，受限模式）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry 见 dispatch-protocol「派发编排机制」并行规则。**P6 例外**：P6 的汇总整合走自身证据并行 + 汇总 verifier 机制（下方），不适用权威节共享文件统一后处理规则。

P6 采用**证据并行、验收文件不并行**模式：

1. 各包 verifier 并行跑 BDD 验证，证据写入 P6-evidence/{pkg}/，同时写 P6-evidence/{pkg}/results.md（PASS/FAIL 行 + 证据引用，不进 gate）
2. 所有 verifier 返回后，派一个汇总 verifier 逐包读取 results.md，转抄整合进唯一的 P6-acceptance.md
3. 汇总 verifier 确认各包 BDD 编号合集 = P1 全部 BDD 编号，无重复/遗漏，**必须在 P6-acceptance.md 中记录交叉核对结果**

基础设施隔离同 P5（端口/数据库/截图目录独立）。

**环境准备职责边界（本阶段落地）**：P6 的环境访问沿用 P5 已由主 Agent 准备好的环境（环境状态未变时不重复起）；需要新环境时同样遵循 dispatch-protocol.md「verification_env 条件化」/「环境准备职责边界」的统一准备规则——由主 Agent 统一启动并通过 dispatch-context 注入访问方式，**不由 verifier subagent 自行启动**（多个并行 verifier 各自起环境会导致端口占用与资源竞争）。环境验证失败时的分类与止损见 dispatch-protocol.md「verification_env 失败处理协议」，本卡片不重复展开。

## 推进条件（全部满足才写 phase: P7）

- [ ] 所有 BDD PASS（FAIL=0）
- [ ] P6-evidence/ 目录非空 + 证据文件被引用
- [ ] UI 任务：vision-helper blocker_count=0；blocker>0 时须在 P6-acceptance.md 写明追查命令 + 输出 + 根因结论（仅写"已追查"不合规）
- [ ] provenance 审计通过
- [ ] **P6.5 judge 复核通过（强制，所有任务）**：judge 启用任务须 `P6.5-judge-verdict.md` 存在 + `check-gate.py P6.5` exit 0（check-judge-verdict + check-events 双脚本）；历史任务（无 `judge.enabled: true`）自动跳过（BDD-1/2）

## 常见错误（T046 实证）

1. **用 DOM 属性替代视觉验证**：img.src 被重写 = 图片显示正常。不对——还有 Content-Type、CORS、CSP 等 100 种原因导致图片不渲染。**vision-helper 说破了就是破了**
2. **凑 PASS 数量**：deferred BDD 标 PASS、用 1 行文本文件充证据 → provenance 审计能通过但功能不对
3. **只验证中间指标不验证用户结果**：naturalWidth>0, complete=true, API 返回 200 → 结论"功能正常"。用户看到的：破图。**问自己：用户看到了什么**
4. **收到视觉否定先反驳**：vision-helper 报异常 → 先 curl -I 查响应头 → 再决定是 vision 误报还是真问题。T046：三次视觉否定被三次程序化指标反驳，15 分钟浪费
5. **验收失败自己动手改代码**：这和上面几条本质是同一类问题（判定证据和判定对象由同一人在同一时间点生产），只是这次改的是真代码而非假 markdown，反而更难被察觉。正确动作是退回重新派发，见上方 FAIL > 0 的处理说明

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P7 一致性检查依赖 P6 的 BDD 对照结果
- 验收结果是判定任务成败的最终依据——P8 发布只是机械步骤

## 自查≠gate
写完验证脚本后应自跑确认脚本可执行（自查），但自查通过 ≠ P6 gate 通过。
P6 gate 由主 Agent 亲自跑 gate 脚本（check-gate.py P6 + check-p6-evidence.py + check-p6-provenance.py），验证的是 verifier subagent 的产出。结果以主 Agent 跑的 gate 脚本为准。
不要在返回中声称"验收已通过"或"全部 BDD PASS"——只返回路径 + 摘要。
自查可（非阻断）复跑 `python3 agate/scripts/check-maintainability.py {TASK_DIR}` 确认 P4 后无新增反模式——P6 阶段暂存区通常已不含代码 diff，此为自查提醒而非 gate 判定点（检测器挂载在 P4，BDD-13）。

> 完成 → 读 phase-cards/P7-consistency.md
<!-- AGATE_CARD_END -->

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）。

## 目标

对 TPV0099（全屏模式链接 `/{slug}/f`）做 **P6 验收**：**逐条实跑 19 条 BDD**，产出 `P6-acceptance.md` + `P6-evidence/`。

**核心原则（P6 卡）**：**功能验证和 gate 格式都必须满足**。不接受只满足格式不验证功能，也不接受只验证功能不满足格式。
**记录的是验收时的事实，不是修复后的状态**——若某条 BDD 为 FAIL 就写 FAIL（但本任务 P5 已 6/6 全绿，预期全 PASS）。

## 输入文件

1. **`P1-requirements.md`（19 条 BDD 基线，权威判据）** —— 每条 `#### BDD-NN` 的 Given/When/Then 逐字为准
2. `P2-design.md` —— 方案与 §6.1 E2E 映射 + §6.5 验证执行约束
3. `P3-test-cases.md` —— 测试设计与 BDD 映射
4. `P5-test-results/` —— P5 已跑的证据（可引用）
5. `P4-review.md` / `P4-implementation.md`
6. 可复用的测试：`frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（32 passed）+ `-auth.spec.ts`（6 passed）

## 产出规格

### `P6-acceptance.md`

frontmatter：
```yaml
---
phase: P6
task_id: TPV0099
type: acceptance
parent: P5-verification.md
trace_id: TPV0099-P6-20260928
status: draft
created: 2026-09-28
agent: verifier
pass: <int>          # 期望 19
fail: <int>          # 期望 0
ui_affected: true
---
```

正文：**每条 BDD 一行**，只允许 `PASS` 或 `FAIL`，**所有 PASS 必须带证据引用**。

**行格式**（`{判定}` 取 `PASS`/`FAIL`；证据路径必填）：

```
{判定} BDD-NN: {描述} ({证据路径})
```

即以列表项起首，后接判定词、BDD 编号、描述、括号内证据路径。示例（**spec 内实际写法**）：判定词 `PASS`、编号 `BDD-1`、证据 `screenshots/bdd-1-fullscreen-form.png`。

- 截图证据路径格式：`(screenshots/{filename}.png)`；其他：`(P6-evidence/{filename})`；多文件逗号分隔
- **总结行不得用列表项形态的判定词**（判定词只用于 BDD 条目）→ 用 `**Summary**: 19/19 PASS, 0 FAIL`
- ⚠️ **本文件为 P6 验收的派发产物，`check-p6-provenance.py` 审计 2 会扫描它并拦截"行首列表项判定词"**（该审计只剥离 AGATE_CARD 块与顶部 frontmatter，**不剥离围栏代码块**）→ 故本节示例**刻意不写成以判定词开头的列表行**

### `P6-evidence/`

- **必须非空，每个文件含实质内容**（截图 >1KB；断言文件含实际输出）
- **不接受 1 行文本文件充数**（T046 教训：15 个 1 行 txt 凑数量）
- **操作类 BDD 截图必须逐字节不同**（md5 完全重复会被硬阻断，无例外）。若某行为差异天然产出视觉相同页面 → **优先改用非截图证据**（断言日志/response.json），或截图时带上能体现差异的元素
- **查询类 BDD 可不截图**（但须有断言记录文件）
- 建议目录：`P6-evidence/screenshots/`、`P6-evidence/*.json` / `*.log`

---

## ⚠️ 本任务的四条硬约束（P2/P3/P4 沉淀，违反会导致假绿或误判）

### 1. BDD-1/2/3 **必须钉定非归档、非过期 seed `dsh-architecture`**

**理由**：BDD-3 的 Given 是 **entry 无关**的。若挑到 archived entry（`legacy-deploy`），`.archived-banner` 是满宽顶部横条且**不在 zen 隐藏集、不在 BDD-3 的 A/B 排除集内** → 会在**与本任务无关的既有条件**上判 FAIL，被误读成"本任务实现错了"。**禁止**用 `legacy-deploy` 或任何 `status: archived`/已过期 entry 跑 BDD-1/2/3。

### 2. BDD-3 的 A/B 排除集**不可简化**

P1 BDD-3 的排除集是**两组不对称规则**：A 组（结构链 `html`/`body`/`#app`/`.entry-detail`）取"**自身+全部祖先，不含后代**"；B 组（内容流容器链）取"**自身+全部后代**"。文中明写"两组不可互换、不可统一写成祖先/后代"。

**已实测证明**：统一写成"祖先/后代"会让判据**退化成恒真**（正确实现与失败态都判 PASS）。

→ 请按 A/B 规则复现，并做**三态负向对照**证明判据有拦截力（P1 rev2 自证基线：①正确实现命中 **0**；②强制 `.detail-header` 可见命中 **3**；③注入未纳入隐藏集的满宽横条命中 **1**）。**仅验 ① 不算通过**。

### 3. BDD-10 认证配对 + **清理必须用服务端返回的 slug**

- 路径 = **alice 登录建私有 entry → alice 建 share → 匿名带 token 读 → alice 删除**
- **区分力判据**：三态结果必须**互不相同**——真实 token 可见 / 无 token 与伪 token 均不可见（`[false,false,true]`），否则退化为恒真假绿
- **清理判据 = 删除后以 alice 复查 `raw` = 404**
- ⚠️ **清理必须用服务端返回的 slug**（`(await createRes.json()).slug`）——后端在 slug 冲突时会**静默改 `-2` 后缀**（本任务已因此真实留过 2 条残留）。**你的验证若自建 entry，务必照此**，否则会留残留且"无残留"断言假绿

### 4. 双视口须**显式钉定**

`playwright.config.ts` 的两个 project 默认视口是 **1280×720 / 393×727**，**都不是** BDD 要求的档位 → 用 `test.use({ viewport })` 钉定：桌面 **1280×800**（BDD-1/2/3）、移动 **390×844**（BDD-14）。

---

## 三个环境陷阱（必读，否则白跑或误判）

1. **跑任何 E2E 前必须先 `make build-frontend-fast`**（~15s）——`e2e-safety-check.sh` 的 Check 6（`find frontend-v3/src -newer static/index.html`）会 **FATAL 拒绝运行**。主 Agent 派发前已跑（当前 static 新鲜）
2. **`make debug-test` 裸调用只跑 1 个 spec**（`debug-server.spec.ts`）→ **必须 `E2E_SPEC=<spec> make debug-test`**，否则你会以为"E2E 跑了"而实际零覆盖
3. **⚠️ Playwright 每次 run 会清空 `frontend-v3/test-results/`** —— 你为 BDD 截的图若放在那，**下一次 Playwright 调用就删了**。→ **截完立即复制到 `P6-evidence/`**（P5 期已因此丢过一次截图）

**已知 2 条 flaky 单测**：`DiagramBlock.spec.ts`、`TableView.spec.ts`（全量下偶发单条失败、隔离复跑即绿）——若 `make test-frontend` 出单条失败，**必须隔离复跑确认**再定性。

---

## 19 条 BDD 与 seed 对照（P1 已逐条实测可达性）

| BDD | seed / 前提 | 视口 | 类型 |
|---|---|---|---|
| BDD-1/2/3 | `dsh-architecture` 匿名 | 桌面 1280×800 | 形态/布局/视觉 |
| BDD-4/5/6/7 | BDD-7 用 `tsv-server-metrics` 匿名 | 桌面 | 交互 |
| BDD-8 | `unicode-filenames` 匿名（正文有文件间链接） | 桌面 | 交互 |
| BDD-9 | `markdown-test` + `?firstFileId` 动态解析（**需 alice**） | 桌面 | 交互 |
| BDD-10 | **自建私有 + share**（alice 建/删） | 桌面 | 分享 |
| BDD-11/12/13 | `dsh-architecture` 匿名 | 桌面 | 回归 |
| BDD-14 | `dsh-architecture` 匿名 | **移动 390×844** | 移动端 |
| BDD-15 | `mermaid-charts`（**需 alice**） | 桌面 | 图表 |
| BDD-16 | `dsh-architecture` 匿名 + **截图留证** | 桌面 | 人工体验路径 |
| BDD-17 | `svg-icons` 匿名（独立 SVG 走 ImageViewer） | 桌面 | 图表 |
| BDD-18/19 | 不存在 slug / `dsh-architecture/f/xyz` 匿名 | 桌面 | 边界 |

⚠️ **不要用 `/entries` 总数做断言**：计数随 E2E 残留漂移。且注意该 API 的 `limit` 参数**不生效**（用 `per_page`，默认 20）——本任务已因此踩过一次"扫描面被静默截断"。

---

## 视觉证据要求（**ui_affected: true**）

P1 声明视觉能力 `status: available`（vision-engine 实测可调）→ **P6 必须执行真实视觉分析**：
- **每条 UI 类 PASS 须带 vision 引用**：`(vision: vision-reports/bdd-N.yaml)`，`blocker_count=0`
- **不得仅以 `naturalWidth>0` / `complete=true` / `HTTP 200` / 像素方差断言视觉 PASS**
- vision-analyst 由主 Agent **另行派发**（你不必自己跑 vision）；你负责**截图 + 行为日志 + 断言文件**，并在 PASS 行预留 vision 引用路径
- 若 `blocker_count > 0` → 追查根因（`curl -I` 响应头 / Network / API 日志），结果写入 `P6-acceptance.md`

**截图要求**：条数多，但**每条截图须体现该 BDD 的差异**（避免 md5 重复）；查询类 BDD 可不截图、用断言 JSON/log。

---

## 环境与纪律（强制）

- debug backend `http://127.0.0.1:8888` **已运行且已 re-seed**（主 Agent 派发前：alice 22 / 匿名 15；`dsh-architecture`/`tsv-server-metrics`/`unicode-filenames`/`svg-icons` 匿名 raw 均 **200**）。**开工前先探** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`（本任务该服务已掉线 4 次）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn`/`make debug`/`npm run dev`。标记 `[PROD_TOUCHED]`/`[PROD_NOT_TOUCHED]`
- **临时/探针文件严禁放 `frontend-v3/` 下**（会抬高 vitest 基线）→ 放 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（E2E 类 900s）
- **自建 entry 必须清理**（用**服务端返回的 slug**），并在产出里给残留复查结果
- **post-test 环境残留检查（P6 卡强制步骤）**：验收跑完后，自查 debug DB 中 `e2e-`/`tpv0099` 前缀残留 = **0**（用 `per_page` 分页扫全量，勿用 `limit`），把结果写进 `P6-evidence/`
- 子派发能力：不启用
- **分阶段落盘**：每完成一批 BDD**立即追加**到 `P6-progress.md`

## 门槛（什么算完成）

- `P6-acceptance.md` 含 **19 条 BDD 逐条 PASS/FAIL**（每条 PASS 带证据引用）
- frontmatter `pass`/`fail`/`ui_affected` 与正文一致
- `P6-evidence/` 非空、截图 >1KB、操作类截图 md5 互不相同、无 1 行凑数文件
- 残留检查结果已记录（残留 = 0）
- 四条硬约束逐条落实（BDD-1/2/3 钉定 seed、BDD-3 A/B 不可简化且有三态对照、BDD-10 认证配对 + 服务端 slug 清理、双视口显式钉定）

## 返回给我（只三行）

1. 产出（`P6-acceptance.md` + `P6-evidence/`）
2. **一句话结论**（PASS/FAIL 计数）
3. **若有 FAIL**：逐条列出 + 定性（真 bug / 环境 / 判据问题）

**不要返回文件全文。**

## 客观查证信息（objective_info）

- 环境：debug `http://127.0.0.1:8888`（v0.24.1）；Chrome CDP `:18800`；Playwright 1.61.1；双 project（chromium + Mobile Chrome/Pixel5）、`fullyParallel: true`
- P5 基线：6/6 命令 exit 0、failed=0；`make test-frontend` 111 files / 1350 passed；匿名 E2E 32 passed；auth E2E 6 passed
- 关键选择器：`[data-testid="content-area"]`、`[data-testid="mobile-bottom-bar"]`、`.entry-detail`、`.entry-detail.zen-mode`、`.not-found`、`.error-state`、`.toc-sidebar`、`.per-page-trigger`/`.per-page-listbox`、`.sr-only[aria-live]`、`a[data-peekview-file-id]`
- zen 隐藏集 = **8 项**（`layout.css:208` 的 `.resize-handle` + `layout.css:649-654` 六项 + `EntryDetailView.vue:260` 的 `.meta-tags-bar`）+ 2 处 `v-show` 兜底
- 现有可复用测试：`frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（16 用例，覆盖 BDD-1/2/3/4/5/6/7/8/11/12/13/14/16/17/18/19）+ `-auth.spec.ts`（3 用例，覆盖 BDD-9/10/15）

> 本文件不含通过/失败预判。
