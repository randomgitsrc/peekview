---
phase: P4
task_id: T090-mobile-detail-ux-polish
role: test-designer
---

# 派发指引 — T090 P4 阶段定向修复 2 处测试代码 bug（implementer 报告的 [DESIGN_GAP]，主 Agent 已诊断并批准）

## 背景

implementer 完成 P4 实现后自查 E2E，10/12 通过，2 条失败标 `[DESIGN_GAP]` 交主 Agent 决策（详见 `docs/tasks/T090-mobile-detail-ux-polish/P4-implementation.md` 的 `[DESIGN_GAP]` 节）。主 Agent 已诊断根因并写入 `docs/tasks/T090-mobile-detail-ux-polish/P4-gate-diagnosis.md`，请先读这份诊断文件理解根因，**不要重新调研，直接按诊断结论执行修复**。

两处都确认是**测试代码/文字表述的口径 bug**，不是实现或设计缺陷，不需要改动任何已实现的 Vue 组件代码，只需改两个地方：

## 修复 1：P1-requirements.md BDD-8 追加消歧义注释（[BASELINE_CHANGE]，已获主 Agent 批准）

**不要改动 BDD-8 的 Given/When/Then 原文语义**，只在该条 BDD 后追加一段澄清说明，明确"基线 40px"和目标"10px"均为**单侧**计量口径（与 P0-brief.md/P2-design.md 一贯使用的口径一致），不是"左右两侧数值相加"。

建议追加内容（可参照此措辞，不要求逐字照抄，但语义要点须覆盖）：

```
[BASELINE_CHANGE: 澄清 BDD-8 计量口径——"基线约40px"与"目标10px或更小"均为单侧（左侧或右侧任一侧）的层叠间距值，与 P0-brief.md/P2-design.md 全程使用的单侧口径一致（P2 §2 候选3-A原文"归零后总量8px，缩减80%"的8px即为单侧content-area剩余padding）。"左右两侧间距之和"这一表述指的是"左侧测量值"与"右侧测量值"各自独立相对基线的缩减程度（由于布局左右对称，两侧数值相等），不是将左右两侧数值相加后再与40px比较。此为P4阶段发现P3测试代码按字面"相加"实现导致口径错配（40 vs 相加后的16，误判60%不达标）后的澄清修订，不改变原有验收意图，候选3-A物理上已达到80%缩减，远超75%门槛。]
```

追加位置：紧跟在 BDD-8 原文块之后（即当前 P1-requirements.md 里 BDD-8 的 Then 子句之后）。

## 修复 2：E2E 测试 BDD-8 测量公式改为单侧

`frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 第 308-312 行左右，当前：

```ts
const leftInset = mdBox!.x
const rightInset = viewportWidth - (mdBox!.x + mdBox!.width)
const totalInset = leftInset + rightInset
const reductionRatio = (MARKDOWN_MOBILE_BASELINE_INSET_PX - totalInset) / MARKDOWN_MOBILE_BASELINE_INSET_PX
```

改为只用单侧值（`leftInset`，因布局左右对称，测左侧即代表单侧口径）与基线 40 比较，不再对左右两侧求和：

```ts
const leftInset = mdBox!.x
const rightInset = viewportWidth - (mdBox!.x + mdBox!.width)
const reductionRatio = (MARKDOWN_MOBILE_BASELINE_INSET_PX - leftInset) / MARKDOWN_MOBILE_BASELINE_INSET_PX
```

保留 `rightInset` 的计算和一个轻量断言确认左右对称（如 `expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(2)`），作为"确实左右对称、用单侧代表全局"这个前提的验证，不要直接删掉 `rightInset` 变量。

## 修复 3：BDD-6 file-tree 选择器收窄范围

`frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 里 `test_bdd_6_bottom_bar_markdown_buttons_functional` 用 `page.getByText(/^Files ·/)` 定位抽屉头部，与 `FileTree.vue` 组件内部自带的同名 `<h3>Files · N</h3>` 冲突（strict-mode violation，两个元素）。

把选择器收窄到抽屉头部范围内，例如：

```ts
page.locator('.drawer-header').getByText(/^Files ·/)
```

请先读 `frontend-v3/src/components/EntryDetailContent.vue` 确认抽屉头部实际的 class 名/结构（可能不是 `.drawer-header`，请核实实际选择器），用能唯一定位到抽屉头部（而非 `FileTree.vue` 内部标题）的选择器替换。

## 不要做的事

- 不要改动任何 `.vue` 组件代码（实现本身没问题，已通过 implementer 自查）
- 不要改动 P1-requirements.md 除 BDD-8 追加澄清注释之外的任何内容
- 不要改动 BDD-8 的 Given/When/Then 原文字面

## 验证要求

修复后完整重跑全部 12 条 E2E（`BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/t090-mobile-detail-ux-polish.spec.ts --project=chromium`），确认 12/12 全部通过。debug backend 已在 :8888 运行，测试数据已存在。

## 门槛（什么算完成）

- P1-requirements.md BDD-8 后追加 `[BASELINE_CHANGE]` 澄清注释，原 Given/When/Then 文字未改动
- E2E 测试两处代码修复完成
- 完整重跑 12/12 全部通过（附实跑输出证据）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。
1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. 预跑 check-gate.sh P4（确认暂存区有代码文件）
5. 更新 .state.yaml phase=P4 → P5
6. git add docs/tasks/{Txxx}/ + 代码文件（含 .state.yaml，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P4): {摘要}"

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`docs/tasks/Txxx/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `docs/tasks/Txxx/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.sh 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 派发 verifier subagent 执行 gate_commands.P5，主 Agent 验 gate（检查产出 + failed 计数 + N5 最小校验）。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | —（plan-eng-review 在 P2 已派）| — |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.sh 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前**必须**为每个 subagent 的 dispatch-context 分配上述隔离参数。当前无 gate 脚本检查（已知缺口），但未分配导致运行时冲突（端口占用/数据库锁）时计为重试，不算环境问题。

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（无触发评审角色时此项自动满足）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **先更新 .state.yaml 再 commit**：state 和产出在同一 commit 里——不要先 commit 产出再单独 commit state
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md

6. **修改 P1 文档**：P4 发现 BDD 矛盾时标 DESIGN_GAP，不直接改 P1-requirements.md。需变更 P1 时标 `[BASELINE_CHANGE: 理由]` 并经主 Agent 批准。
<!-- AGATE_CARD_END -->
