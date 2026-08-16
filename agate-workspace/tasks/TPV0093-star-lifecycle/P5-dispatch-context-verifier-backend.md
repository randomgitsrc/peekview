---
phase: P5
task_id: TPV0093-star-lifecycle
type: test-results
parent: P4-review.md
trace_id: TPV0093-P5-20260816-backend-r2
status: ready
---

# P5 派发上下文 — verifier（backend 包，串行版）

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
4. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P5 产出，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P5，不要提前写 P6——phase = 本 commit 的产出阶段
5. git commit -m "wf({Txxx}-P5): {摘要}"（phase=P5，P5 产出含 P5-test-results/fail-list.txt）
6. P5 commit 完成后进入 P6：**phase 推进 P6 随 P6 产出 commit 一起**（P6-acceptance.md + P6-evidence/ 就绪后），不是单独 phase commit
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

技术验证 TPV0093 **backend 包**：执行 gate_commands.P5（`make test-quick`），产出 P5-test-results/unit.md + fail-list.txt。**只跑命令、只落盘结果，不做任何探索/诊断/额外工作。**

## 上游关联

- gate_commands（P2-design.md §8 固化）：`P5: "make test-quick"`、`project_module: "backend/peekview"`
- 前置：P4 已 commit；本 verifier 与 frontend verifier **串行**（先 backend 后 frontend，避免 pytest/vitest 资源竞争）

## 执行（严格按此流程，不多做）

1. 跑 `cd /home/kity/oclab/peekview && make test-quick 2>&1 | tail -15; echo "GATE_EXIT: ${PIPESTATUS[0]}"`
   - **命令 timeout 300 秒**（bash 工具 timeout 参数设为 300000）。若超过 300 秒未完成 → **立即停止**，写 progress 报告"命令超时"，返回主 Agent，不要重试、不要等待
2. 从输出提取 passed/failed 计数，写入 `P5-test-results/unit.md`（含测试运行器输出签名）
3. failed=0 → fail-list.txt 为空文件；有 failed → 逐行列出（`FAILED ` 前缀）
4. 若有预存失败（与 TPV0093 无关）：unit.md 标注"预存失败"，并登记 `known-failures.md`（从 `{agate_root}/assets/templates/known-failures-template.md` 拷贝模板）
5. 验证测试环境隔离（pytest conftest autouse tmp_path 已隔离；确认未触碰 ~/.peekview/）

## 约束

- **只跑命令 + 落盘**：不修改任何源码/测试；不做额外探索
- 环境隔离：pytest 隔离；严禁触碰生产 :8080 / ~/.peekview/
- 每完成一个关键步骤（命令跑完/产出写完），**立即追加写 progress 心跳**（P5-progress.md）
- 日志末行格式：`EXIT_CODE: <n>`（0 成功）
- 状态标记：`[PROD_TOUCHED]`/`[PROD_NOT_TOUCHED]`

## 产出（路径约束）

1. `agate-workspace/tasks/TPV0093-star-lifecycle/P5-test-results/unit.md`
2. `agate-workspace/tasks/TPV0093-star-lifecycle/P5-test-results/fail-list.txt`
3. 如需：`known-failures.md`

⚠️ 路径硬约束：写入上述任务目录，不写 /tmp。

## 门槛

- unit.md 存在且含测试运行器输出签名（passed/failed 计数）
- fail-list.txt 存在（可为空）
- 末行 EXIT_CODE: 0
- 若命令超时/失败 → 如实报告，不伪造结果

## 返回给我（重要）

只返回两行：
  1. 产出文件路径
  2. 一句话摘要（不超过 30 字：N passed / M failed / 超时 / 失败原因）
绝对不要返回文件全文——我只需要路径和摘要。