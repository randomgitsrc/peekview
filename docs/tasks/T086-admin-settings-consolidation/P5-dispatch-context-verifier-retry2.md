---
phase: P5
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: verifier
trace_id: T086-P5-20260807-retry2
created: 2026-08-07
---

# P5 派发指引 — verifier（重试 #2，PAUSED 恢复后全量重跑）

## 目标

`admin.spec.ts:276`（T086 BDD-11）的选择器 scope 缺陷已修复（`.desktop-only` 前缀），产品代码零改动。本次是本任务第三次 P5 执行，全量重跑 gate_commands.P5，目标是让 E2E 全部约 36 条用例真正执行且全部通过（含之前两轮从未真正验证过的 T086 BDD-12）。

## 约束

- **gate_commands（P2 已固化）**：
  ```yaml
  P5: "make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/admin.spec.ts make debug-test"
  P6_typecheck: "make typecheck"
  ```
- 跑 E2E 前 `make debug-start` + `make debug-seed`，跑完 `make debug-stop`
- **全量重跑**：本轮之前两轮的失败记录：
  - 第一轮：BDD-8/9/10 失败（router.ts 路由拦截问题）—— 已在 retry1 验证修复生效
  - 第二轮（retry1）：BDD-11 失败（选择器 scope 缺陷），BDD-12 因级联从未真正执行过
  - 本轮必须让 BDD-9/10/8/11/12 全部真正执行并给出明确 PASS/FAIL，尤其 **BDD-12 是三轮以来第一次有机会真正被执行**，需重点确认
- 之前两轮出现的 2 个 flaky（BDD-01/02 首屏渲染超时，重试后通过）如果本轮再次出现同类现象，记录但不算真失败；如果变成稳定失败，判定为真失败
- 严禁触碰生产环境
- **签名要求**：P5-test-results/unit.md、e2e.md 含可 grep 匹配的输出签名

## 上游关联

parent: P3-fix-record.md（选择器修复）
祖先: P5-gate-diagnosis.md（第一轮根因）、P5-gate-diagnosis-2.md（第二轮根因）、PAUSED-resolution.md（人工批准的修复决策）

## 输入文件

1. `docs/tasks/T086-admin-settings-consolidation/P3-fix-record.md`（本轮修复内容）
2. `docs/tasks/T086-admin-settings-consolidation/P5-gate-diagnosis-2.md`（上一轮根因，含对照表）
3. `docs/tasks/T086-admin-settings-consolidation/P5-test-results/e2e.md`（上一轮记录，供对照）

## 客观查证信息

- 主 Agent 已独立复核：`git diff` 确认本轮只改了 `admin.spec.ts` 一行（BDD-11 用例内的选择器），BDD-12 未改动（已核实不查询 `user-manager-content`），`playwright --list` 确认 36 用例解析无语法错误
- 若本轮全部通过，这是本任务 P5 gate 的最终判定，通过后可推进 P6

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
4. 更新 .state.yaml phase=P5 → P6
5. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
6. git commit -m "wf({Txxx}-P5): {摘要}"

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

1. 在 `docs/tasks/{Txxx}/known-failures.md`（从 `{agate_root}/assets/templates/known-failures-template.md` 拷贝模板）登记：
   - 测试文件、失败数、根因、是否与当前任务相关
2. 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
3. 主 Agent 按修复成本判断：修复成本 < 推迟成本 → 立即修复；否则记录推迟
4. 即使不立即修复，债务也可见、可追踪——不会因为"与本任务无关"而默默累积

## gate 规则

check-gate.sh P5 → exit 2。主 Agent 验 gate（检查 P5-test-results/ 存在 + failed 计数），CI backstop 兜底。

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

当 P2 声明多个 packages 时，P5 可按包拆分并行——各 verifier subagent 跑各包的 gate_commands，各写 P5-test-results/{pkg}/。

拆分判据同 P3。P5 是只读验证，无代码写冲突风险。

**基础设施隔离（并行时强制）**：
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
