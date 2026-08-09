---
phase: P4
task_id: T091-mobile-detail-visual-polish
role: implementer
---

# 派发指引 — T091 P4 重试 #1：修复 meta-tags-bar 遗留 CSS 冲突（P6 验收退回）

## 背景（退回原因，务必先读）

上一轮 P4 实现（4 个文件改动）已通过 design-review + P5 全量测试（vitest 1215/0 + E2E 50/0），但走到 P6 真实视觉验收时，verifier 发现了一个 P5 的 E2E 套件完全没有覆盖到的真实缺陷，导致 13 条 BDD 里 2 条（BDD-2、BDD-9）FAIL。**这不是要重做 P4 的全部工作，已完成的 4 个文件改动本身仍然正确**，只是遗漏了一个额外文件的冲突清理，需要定向修复。

完整 FAIL 详情见 `docs/tasks/T091-mobile-detail-visual-polish/.retreat-history.md`（`20260809-175444 归档 P6` 一节），本节只摘要根因和修复方向。

## 根因（已被 orchestrator 独立 CDP 复测二次确认，非 verifier 一家之言）

`frontend-v3/src/components/EntryMetaTagsBar.vue` 的 `<style scoped>` 块里，`.meta-tags-bar` 规则设置了 `flex-wrap: wrap`（本任务 P4 上一轮的改动），但**没有显式声明 `overflow-x`/`white-space`**。与此同时，`frontend-v3/src/styles/layout.css:466-478` 存在一条**全局、非 scoped 的同名规则**：

```css
.meta-tags-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-text-secondary);
  overflow-x: auto;
  white-space: nowrap;
  transition: opacity 0.3s ease;
  border-bottom: 1px solid var(--c-border);
}
```

这条全局规则大概率是 `EntryMetaTagsBar.vue` 组件化之前的旧实现残留，本任务的 P2-design.md 制定方案时完全没有意识到它的存在（`files_to_read` 清单里没有 `layout.css`，是 P2 阶段的一个盲区，不是 P4 implementer 的失职）。由于 scoped 组件的 `.meta-tags-bar` 规则没有显式覆盖 `overflow-x`/`white-space`，CSS 级联让全局规则的这两条声明继续生效——`overflow-x: auto` 隐含把 `overflow-y` 也变成 `auto`（CSS 规范：只要 overflow-x/y 任一非 `visible`，另一个非 `visible` 值会从 `visible` 提升为 `auto`），这会让 flex 容器的高度计算行为改变，实测表现为：**当 `.content-area` 因内容过长需要滚动时**（真实使用场景，比如打开一个内容较长的 markdown/code/csv/tsv/xml/plantuml entry），meta-tags-bar 自身的可视高度坍缩到约 33px，第二行起的标签被推出可视区域外、完全不可见。

**orchestrator 独立复测数据**（`markdown-test` entry，加 `?firstFileId=18` 强制显示真实 markdown 文件）：
```json
{
  "contentAreaScrollHeight": 18488,
  "contentAreaClientHeight": 788,
  "metaBarOffsetHeight": 33,
  "metaBarOverflowX": "auto",
  "metaBarWhiteSpace": "nowrap",
  "metaBarFlexWrap": "wrap",
  "metaBarScrollWidth": 354,
  "metaBarClientWidth": 354
}
```
（`xml-maven-pom` entry 独立复测同样命中：`scrollHeight=937 > clientHeight=788`，`metaBarOffsetHeight=33`，`overflowX=auto`，`whiteSpace=nowrap`——确认这不是 markdown 独有，是所有会触发 `.content-area` 滚动的 entry 共性问题）

**为什么 P5 的 50/50 全绿 E2E 没发现这个问题**：已核实 `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` 里 BDD-1（`test_bdd_1_meta_tags_bar_wraps_no_horizontal_scroll`）和 BDD-2（`test_bdd_2_meta_tags_bar_breathing_room`）导航 `markdown-test` entry 时**没有加 `?firstFileId=` 参数**，落在该 entry 的默认文件（`architecture.svg`，按目录字母序排在最前，内容短，`.content-area` 不需要滚动），从未触发这条 bug 路径。这是 E2E 测试覆盖的真实盲区，不在本轮修复范围内（测试覆盖盲区的处理留给后续，本轮先修实现本身；P6 verifier 已经用真实场景截图证明了这是用户会实际遇到的问题）。

## 你要做的事

### 修复本身（最小、精确的改动）

在 `frontend-v3/src/components/EntryMetaTagsBar.vue` 的 `<style scoped>` 块里，给 `.meta-tags-bar` 规则**显式补充** `overflow-x: visible;`（如有必要，可以不必显式设置 `white-space`，因为 flex 容器本身的 `white-space` 主要影响其内部文本节点的换行，不直接决定 flex-wrap 行为——但建议一并核实：修复后请用同样的 CDP 方式在 `markdown-test?firstFileId=18` 和 `xml-maven-pom` 两个 entry 上实测确认 `metaBarOffsetHeight` 恢复到 89px 附近的正常值，而不是想当然认为只加 `overflow-x` 就够）。

**不要删除或修改 `frontend-v3/src/styles/layout.css:466-478` 这条全局规则本身**——这条全局规则可能还被其他未使用 scoped 组件的旧页面/场景依赖（本任务没有能力/范围去核实全局影响面），最小改动原则下，只在 `EntryMetaTagsBar.vue` 的 scoped 规则里显式声明覆盖即可，scoped 规则的 CSS specificity（`data-v-xxx` 属性选择器）足以覆盖同优先级的全局类选择器。

### 验证方式（不能只看 vue-tsc/lint，必须真实测量）

1. `make build-frontend` 让改动反映到 :8888
2. 用 CDP 或 Playwright 脚本，对以下 entry **加正确的 `?firstFileId=` 或直接使用会触发 `.content-area` 可滚动的 entry**，实测 `meta-tags-bar` 的 `offsetHeight`：
   - `markdown-test?firstFileId=18`（真实 markdown 文件，此前测得 bug 状态下是 33px，目标恢复到 89px 附近）
   - `xml-maven-pom`（此前测得 bug 状态下是 33px）
   - `python-entry-service`、`csv-employees`、`tsv-server-metrics`、`plantuml-arch`（P6 verifier 报告里这几个同样受影响，请逐一确认修复后均恢复正常）
3. 同时确认没有引入回归：`markdown-test`（默认 svg 文件，`.content-area` 不可滚动的场景）、`json-api-config`、`yaml-docker-compose`、`svg-standalone`、`mermaid-charts` 这几个此前未受影响的 entry，修复后仍然正常（`offsetHeight` 不应变差）

### 额外核查项（不确定是否是独立问题，请一并确认）

P6 verifier 的 vision-analyst 分析报告里，`xml-maven-pom`（TreeView 类型，与 json/yaml 同类型渲染路径）被标记为 `severity: blocker`，描述是"标签芯片被下方 Search 输入框直接压住裁切，与同为 TreeView 类型的 json/yaml 表现不一致"。orchestrator 已独立复测 `xml-maven-pom` 确认其命中的是**同一个** `overflowX:auto/whiteSpace:nowrap` 根因（与 markdown 场景数值模式完全一致），**大概率这条"Search 框压住"只是 meta-tags-bar 坍缩到 33px 后的视觉表现之一，不是独立的第二个 bug**，但请你在修复后重新截图核实一次 `xml-maven-pom` 的渲染，确认 Search 框重叠现象是否随主修复一并消失。如果修复后仍然存在遮挡，需要单独标记 `[DESIGN_GAP: xml/TreeView 与 meta-tags-bar 存在独立于本次修复的层叠/重叠问题]`，不要在没有查清楚之前就假设"应该也一起修好了"。

## 约束（沿用上一轮的全部约束，未变）

- 只改 `EntryMetaTagsBar.vue` 的 scoped 样式（新增 `overflow-x` 声明），本轮**不涉及** `MarkdownViewer.vue`/`EntryDetailMobileBar.vue`/`DESIGN.md` 的既有改动（这些上一轮已完成且 design-review approved，不需要重新触碰，除非你在验证中发现它们与本次修复有交互问题）
- 不改动 `layout.css` 里的全局规则本身
- 不改测试文件（`frontend-v3/e2e/t09*.spec.ts`）——上一轮的测试已经过 review，本轮不涉及测试设计变更
- 生产环境隔离：严禁触碰生产 `:8080`/`~/.peekview/`

## 必读文件

1. `docs/tasks/T091-mobile-detail-visual-polish/.retreat-history.md`（P6 FAIL 详情原文）
2. `frontend-v3/src/components/EntryMetaTagsBar.vue`（全文件仅 41 行，本轮改动目标）
3. `frontend-v3/src/styles/layout.css:460-502`（只读，理解冲突的全局规则，不要修改）
4. `docs/tasks/T091-mobile-detail-visual-polish/P2-design.md`（上一轮设计方案，理解已完成的其他 3 处改动为什么不需要动）

## 产出

更新 `docs/tasks/T091-mobile-detail-visual-polish/P4-implementation.md`（在文件末尾追加"P4 重试 #1"一节，不要重写整份文件），说明：改了什么、CDP 实测修复前后的数值对比（至少 markdown-test 和 xml-maven-pom 两个 entry）、xml Search 框重叠现象的核查结论。

## 完成后向我报告

- 具体改动（文件+行号+新增的 CSS 声明）
- 修复前后的 `meta-tags-bar offsetHeight` 实测对比（至少 2 个 entry）
- xml Search 框重叠现象修复后是否消失
- 一句话总结，不要贴全文

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
