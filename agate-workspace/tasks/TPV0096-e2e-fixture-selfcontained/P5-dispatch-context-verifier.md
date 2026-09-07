# P5-dispatch-context-verifier — TPV0096

---
phase: P5
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0096
role: verifier
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P5

路径：phase-cards/P5-verification.md
---
# P5 — 技术验证

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> P5 不可裁剪（核心阶段）
> ⑨ P5 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 verifier subagent（P5 模式）执行 gate_commands.P5
   1.1 写 P5-dispatch-context-verifier.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 逐条判定通过/失败
3. 若失败：判定是真失败还是环境问题 → 真失败回 P4，环境问题修复环境
4. `git rev-parse HEAD` 取当前（父）提交哈希，写入 `.state.yaml` 的 `p5_pass_commit` 字段（TAG0016 BDD-12：供 P6/P8 判定"引用 P5 证据、不重跑"，字段可选、写入时机见 `state-machine.md`「每任务独立状态文件」）
   ⚠️ **P5 commit 不得混入非产出文件改动**（真实反例：`5bdcd90` 混入了 `agate-debt-check.py` 的真实修复）——若发现顺手修复的必要性，应先回 P4 走正常流程，不要混入 P5 commit（R9 缓解措施，P2-design.md §3.2/§1.3）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P5 产出，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P5，不要提前写 P6——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P5): {摘要}"（phase=P5，P5 产出含 P5-test-results/fail-list.txt）
7. P5 commit 完成后进入 P6：**phase 推进 P6 随 P6 产出 commit 一起**（P6-acceptance.md + P6-evidence/ 就绪后），不是单独 phase commit
   ⚠️ P5→P6 是唯一硬拦边界：P6 的 self-authored gate 拦截"非证据文件"，
      P5 的 .txt/.json 等合法产出必须在 phase=P5 的 commit 里提交，不能带进 phase=P6
   ⚠️ 不要"先 commit 产出再单独 commit 改 phase"（state-machine.md:431 明确禁止）——
      phase 与产出同 commit，P6 产出就绪时 phase 一并写 P6

## 如果是重试

→ 修复后重跑 gate_commands.P5 **全量**（T027 教训：修复可能引入回归，不能只检查修复项）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P5 MAX=2）

## 前置条件

- [ ] P4 代码已 commit（暂存区含代码文件）
- [ ] gate_commands.P5 命令在 P2 已声明（这是 gate 会执行的命令清单）

## 执行方式

verifier subagent 从 P2-design.md 读取 gate_commands.P5 并执行：

```bash
# 示例（实际命令取决于 P2 声明）
pytest -q --tb=no                    # 后端单元测试
vitest run --reporter=verbose        # 前端单元测试
playwright test --reporter=line tests/e2e/  # E2E（ui_affected: true 时）
```

紧凑输出模式：用工具的汇总模式（pytest --tb=no / vitest --reporter=dot / go test | tail -30）。只保留通过/失败汇总+失败清单，不逐项 traceback。

**技术栈无关**：gate_commands.P5_formatter 声明 formatter 脚本（可选），将测试输出标准化。见 `assets/formatters/README.md` 速查表。不提供 formatter 时退化为 exit-code-only。

## 判定规则

- **exit 0 + failed=0**：全通过 → 继续
- **exit ≠0 或 failed>0**：主 Agent 判定
  - 真 bug → 回 P4 修复
  - 环境问题（超时/端口占用/依赖缺失）→ 修复环境重新跑
  - flaky test → 记入 P5-test-results/，三振记录
- **PROD_TOUCHED**：任何生产环境触达 → 立即 PAUSED（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- **E2E 未执行**（ui_affected: true 但未跑 P5_e2e）：视为验证不完整
- **全量测试**：P5 阶段应运行全量测试套件（含非本任务测试）。发现预存失败时：
  - 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
  - 主 Agent 判断：修复成本 < 推迟成本 → 立即修复；否则记录到 known-failures.md
  全量测试不阻断 P5 推进，但未运行全量测试时须在 P5-test-results/unit.md 标注"未运行全量测试"。

## 产出规格

- P5-test-results/unit.md：标注 failed 数量（verifier subagent 产出）
- P5-test-results/fail-list.txt：verifier subagent 产出，failed 测试 id 逐行列出（`FAILED ` 前缀同上，
  pytest 参考实现），可为空文件（无失败时）。使用 gate_commands.P5_formatter 声明的 formatter 提取（与 baseline 捕获一致）。无 formatter 时可省略此文件——P5 gate 检测到缺失时优雅降级为 WARNING-only 行为，不因此新增拦截。
- UI 任务：P5-test-results/e2e.md（Playwright 实跑结果 + 截图路径，verifier subagent 产出）

## 预存失败的处理

若 verifier subagent 发现改动前就存在的失败（预存失败），按以下流程登记：

> **known-failures.md 只登预存失败**（P5 之前就存在的、与当前任务无关的）。当前任务引入的失败用 P5-test-results/ 记录。

1. 在 `{AGATE_WORKSPACE}/tasks/{Txxx}/known-failures.md`（从 `{agate_root}/assets/templates/known-failures-template.md` 拷贝模板）登记：
   - 测试文件、失败数、根因、是否与当前任务相关
2. 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
3. 主 Agent 按修复成本判断：修复成本 < 推迟成本 → 立即修复；否则记录推迟
4. 即使不立即修复，债务也可见、可追踪——不会因为"与本任务无关"而默默累积

## gate 规则

check-gate.py P5 → exit 2。主 Agent 验 gate（检查 P5-test-results/ 存在 + failed 计数），CI backstop 兜底。

**external-output-gate vs self-authored-gate**：P5 的 gate 是 external-output-gate——主 Agent 验证的是 verifier subagent 的产出（P5-test-results/），而非自己跑的命令结果。这与 P4（主 Agent 自己写代码、自己跑 lint）的 self-authored-gate 不同。external-output-gate 的信任链依赖 subagent 隔离 + CI backstop 双重保障。

## 推进条件（全部满足才写 phase: P6）

- [ ] gate_commands.P5 全部命令 exit 0 + failed=0
- [ ] UI 任务：gate_commands.P5_e2e 已执行且通过
- [ ] 无 PROD_TOUCHED 标记
- [ ] 测试环境隔离正常（对比测试前后生产库状态）

## 常见错误

1. **不跑 E2E**：UI 任务只跑单元测试和类型检查 → 端到端行为未验证。T046 教训：38 个单元测试全绿 + vue-tsc OK，但浏览器里图片是破的
2. **把测试绿了当作功能正确**：单元测试通过 ≠ 用户看到的功能正常。P5 是代码正确性验证，P6 才是用户视角验收
3. **修复后不重跑全量**：只跑修复的那一个测试 → 修复引入的回归没被发现

## P5 commit→push 窗口残余风险（N5）

**残余风险**：verifier subagent 产出 P5-test-results/ 后，主 Agent commit 并推进到 P6，但 push→CI 之前存在时间窗口。伪造的 P5-test-results 可在此窗口内流向下游。

**缓解**：主 Agent 在推进前**必须**执行签名校验——grep test runner 输出签名：

```bash
grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)' P5-test-results/unit.md
```

计数 >0 才视为有效产出，计数=0 视为假完成，计为重试。这不是重跑测试（CI backstop 在 push 后兜底全量验证）。

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 时，P5 可按包拆分并行——各 verifier subagent 跑各包的 gate_commands，各写 P5-test-results/{pkg}/。

拆分判据同 P3。P5 是只读验证，无代码写冲突风险。

**但"无写冲突"不等于可以随便并行**：`gate_commands.P5` 常是全量测试套件（含 xdist 多进程）或 E2E 浏览器命令，属**资源密集型默认串行**——按 dispatch-protocol.md「派发编排机制」并行规则第 4 条处理，即使包间无依赖也默认改为串行；要并行必须先按下方「基础设施隔离」为每批分配独立端口/数据库/临时目录，无法隔离即串行（安全默认值）。判据细节见该节，本卡片不重复展开。

**环境准备职责边界（本阶段落地）**：verifier subagent **默认不自行启动环境**——debug server、测试数据库、临时端口等由主 Agent（或 P0-brief 声明的单一责任方）统一准备好，通过 dispatch-context 注入访问方式；多个并行 verifier 共享同一环境时更是如此，不允许各自启动。环境验证失败时的可重试/不可重试分类、批处理要求与止损轮次，一律按 dispatch-protocol.md「verification_env 失败处理协议」与「环境准备职责边界」执行，本卡片只做落地引用，不重复展开规则。

**基础设施隔离（本阶段特定，并行时强制）**：
- 测试端口：各 verifier 使用独立端口（与 P4 并行时分配的端口一致，或新分配）
- 测试数据库：各 verifier 用独立数据库（与 P4 隔离方案一致），不共享同一 test.db
- 临时输出：各 verifier 写入 `P5-test-results/{pkg}/` 独立目录，不共享同一 unit.md
- E2E 浏览器：Playwright 默认隔离 browser context，但若 E2E 测试启动了本地 server，各 verifier 需用不同端口

主 Agent 在并行派发前**必须**为每个 verifier 的 dispatch-context 分配独立的基础设施参数（同 P4，未分配导致冲突时计为重试）。

## 下游影响

- P6 验收在 P5 通过的基础上做用户视角验证
- P8 发布时需重跑 P5 gate（确认 bump-version 后测试仍全绿）

> 完成 → 读 phase-cards/P6-acceptance.md
<!-- AGATE_CARD_END -->

## 目标

执行 P2 §6 gate_commands 全部 P5 域命令并落盘证据：`P5`（make test-frontend）/ `P5_typecheck`（make typecheck）/ `P5_e2e`（E2E_SPEC=e2e/mermaid.spec.ts make debug-test）/ `P5_e2e_b`（E2E_SPEC=e2e/mermaid-check.spec.ts …）/ `P5_e2e_c`（E2E_SPEC=e2e/mermaid-visual.spec.ts …）。产出 P5-test-results/（unit.md + fail-list.txt + e2e.md）。

## 约束

- **执行顺序与环境形态**：
  1. `make test-frontend`（timeout 600s）与 `make typecheck`（timeout 600s）——无需服务，直接跑
  2. 三个 E2E 键各自**单调用自包含**（本平台 bwrap 沙箱：服务只能在你自己调用进程树内运行）：
     `cd /home/kity/oclab/peekview && make debug-start && make debug-seed && E2E_SPEC=e2e/<spec>.ts make debug-test > /tmp/p5-e2e-<n>.log 2>&1; rc=$?; timeout 120s make debug-stop > /dev/null 2>&1; exit $rc`
     外层 timeout **900s**（内层 E2E_TIMEOUT=600，外层须留余量）。**严禁漏 debug-stop**（红灯/失败也必须走 `rc=$?; stop; exit $rc` 形态）。
  3. E2E 三键**串行**执行（共享 :8888 与 debug DB，禁止并行）
- **verification_env 轮次预算**：止损 2 轮（独立计数）。环境类失败（服务起不来/端口占用）→ 记录现象后重试 1 次；再失败 → 停止并如实报告
- 全量口径：make test-frontend 即全量前端单测（含 src 侧）。**预存失败处理**：src 侧 vitest 既有 flaky 已在 P4 评审 3 轮采样中观察（失败轮与改动面零交集）——如遇失败，先判定「与本次改动相关（e2e/docs 文件）还是预存」：预存的逐条登记到 P5-test-results/unit.md 预存失败节（测试文件/失败数/与改动无关的证据），不改代码、不修复
- 紧凑输出：只留汇总与失败清单，不逐项 traceback；每个日志文件末行加 `EXIT_CODE: <n>`
- 签名要求（N5）：unit.md 必须含 test runner 输出签名（如 `1343 passed` 行），e2e.md 必须含每个 spec 的 passed/failed/flaky 计数与退出码
- PROD 隔离：严禁 :8080 与 ~/.peekview/；结束写 [PROD_NOT_TOUCHED]
- 子派发能力：不启用

## 上游关联

- P4 已 commit（13594c9f）：被验证代码 = 当前 HEAD 的 3 spec + docs
- BDD-12 基线（P3 §5）：svg-inline-render 2 passed 全绿（对照用途，P5 不必重跑）；render-regression 失败家族 bdd_3/4/5/7/8 = 既有 flaky
- 红灯基线（P3 §5）：改造前真红灯已确认——P5 预期全绿（fixture 自建 + 清理使 3 spec 在干净环境可重复通过）

## 输入文件

- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P2-design.md（§6 gate_commands + §4 env_constraints）
- agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P3-test-cases.md（§5 基线 + §6 判据）
- /home/kity/oclab/agateon/agate/assets/execution-roles/verifier.md（角色定义）

## 产出文件（路径硬约束）

目录：agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P5-test-results/
- unit.md：make test-frontend + make typecheck 结果（退出码、passed/failed 计数、失败清单或「0 failed」、预存失败节如适用、末行 EXIT_CODE: <n>）
- fail-list.txt：失败测试 id 逐行（`FAILED ` 前缀；无失败可为空文件）
- e2e.md：三个 E2E 键各自结果（spec 名/退出码/双 project passed-failed-flaky 计数/耗时/末行 EXIT_CODE: <n>）；E2E 日志关键摘要转录（/tmp/p5-e2e-*.log 不入库，摘录进 e2e.md）
- frontmatter：phase: P5 / task_id: TPV0096 / parent: P2-design.md / trace_id: TPV0096-P5-20260907 / agent: verifier / status: draft（agate-md-field-set 写入，agent 字段被拒则手写并记录）

过程记录追加到 P5-progress.md（每条命令执行前先追加一行：要跑什么、预期多久）。

## 门槛（什么算完成）

- 5 个 gate_commands 键全部执行且有退出码记录（unit/typecheck/E2E×3）
- P5-test-results/unit.md + fail-list.txt + e2e.md 落盘且含 runner 输出签名
- E2E 三键无跳过（如因环境失败未跑成 → 如实记录轮次与现象，不伪造）
- [PROD_NOT_TOUCHED]

## 返回给我（重要）
只返回：
1. P5-test-results/ 路径
2. 一句话摘要（≤30 字：5 键退出码概况）
3. files_modified: [路径]
绝对不要返回文件全文。