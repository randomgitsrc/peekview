---
phase: P4
task_id: T091-mobile-detail-visual-polish
role: test-designer
---

# 派发指引 — T091 P4 附带修复：markdown-body inset 断言的测量目标 CSS 盒模型缺陷

## 背景

implementer 在 P4 自查时发现（并正确遵守约束、未擅自修改测试文件、标记为 `[DESIGN_GAP:]` 报告给主 Agent）：`t090-mobile-detail-ux-polish.spec.ts::test_bdd_8_markdown_mobile_inset_symmetric_24px` 和 `t091-mobile-detail-visual-polish.spec.ts::test_bdd_3_markdown_body_16px_padding_24px_total_inset` 这两条测试，各自的第一个断言（`getComputedStyle(markdownBody).padding === '16px'`）已通过，证明实现完全正确；但第二个断言（`markdownBody.boundingBox().x` 应落在 24px±2 区间）恒定失败，实测稳定为 8px。

主 Agent 已独立核实根因：`getBoundingClientRect()`/`boundingBox()` 返回元素自身的 border-box 位置，这个位置由**父元素的 padding + 自身的 margin**决定，**不受元素自身 padding 影响**——padding 只会把该元素的子内容向内推，不会移动该元素自己框的左边缘。这是标准 CSS 盒模型行为，不是实现缺陷。`.markdown-body` 自身的 `boundingBox().x` 永远等于 `.content-area` 的 padding（8px），无论 `.markdown-body` 自己的 padding 设成多少。

视觉上"总左侧留白 24px"（content-area 8px + markdown-body 16px）是真实存在的——用户能看到文字确实从 24px 处开始渲染，只是测量对象选错了：应该测量 `.markdown-body` **内部第一个子元素**的 `boundingBox().x`，而不是 `.markdown-body` 自身。子元素的位置会真实反映父元素（markdown-body）的 padding，因为 padding 是把子内容往内推的那个空间。

已核实 `MarkdownViewer.vue` 模板结构（L2-9）：`.markdown-body` 的直接子元素是 `<template v-for>` 循环渲染出的 `<div v-html="block.html">` 或 `<DiagramBlock>`，第一个 block 通常是 `<div v-html>` 包裹的渲染后 markdown HTML（如 `<h1>`/`<p>` 等）。这个 div 自身没有显式 margin 设置，其 `boundingBox().x` 应该精确等于 `content-area padding(8px) + markdown-body padding(16px) = 24px`。

## 你要做的事

**只修改这两处断言的测量目标**，其余代码/断言逻辑/常量名不动：

1. `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 的 `test_bdd_8_markdown_mobile_inset_symmetric_24px`（当前 L306-329）：
   - 当前 L311-312：
     ```
     const md = page.locator('[data-testid="markdown-body"]')
     const mdBox = await md.boundingBox()
     ```
   - 改为测量 `.markdown-body` 的第一个直接子元素，例如：
     ```
     const md = page.locator('[data-testid="markdown-body"]')
     const firstChild = md.locator('> *').first()
     const mdBox = await firstChild.boundingBox()
     ```
   - 后续 `leftInset`/`rightInset`/两个 `expect` 语句逻辑不变（仍然是对称性 + 24px±2 定值判断），只是 `mdBox` 来源换了
   - **注意**：`rightInset` 的计算用了 `viewportWidth - (mdBox!.x + mdBox!.width)`——如果第一个子元素本身宽度不是撑满 markdown-body 内容区（比如是个短标题），这个 `rightInset` 公式可能不再准确反映"markdown-body 右侧留白"。请先用 CDP 或本地起 `make debug-quick` 实测确认第一个子元素（`t090-long-markdown` 这个 entry 用的什么内容，`LONG_MARKDOWN` 常量定义在文件顶部）的实际宽度是否撑满容器（如果是一段长文本包裹的 div，通常会撑满 `width: 100%` 或至少接近父容器宽度）。如果撑满，公式不用改；如果不撑满（比如是个短标题独占一行但宽度小于容器），需要改用其他方式验证右侧留白（例如改测 `.markdown-body` 自身的 `width`/`getComputedStyle` 计算 `viewportWidth - contentAreaPadding*2 - markdownBodyPadding*2` 这类纯数值断言，不依赖某个具体子元素的实际渲染宽度）。请实测后选择正确写法，不要盲目套用上面的示例代码。

2. `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` 的 `test_bdd_3_markdown_body_16px_padding_24px_total_inset`（当前 L94-112）：
   - 当前 L99、L105：
     ```
     const md = page.locator('[data-testid="markdown-body"]')
     ...
     const mdBox = await md.boundingBox()
     ```
   - 同样改为测量第一个子元素的 `boundingBox()`，`padding` 断言（L102-103，检查 `getComputedStyle` 值为 16px）**保留不动**——那一步本来就是对的，问题只在后面的 `mdBox!.x` 判断
   - 这个测试用的 entry 是 `markdown-test`（通过 `?firstFileId=` 指定 markdown 文件），请实测确认该 entry 渲染出的第一个子元素宽度情况，同上一条注意事项

## 约束

- 只改这 2 处断言的测量目标（选择器/变量来源），不改常量定义、不改判断阈值、不改其他任何测试
- 不改动 `EntryMetaTagsBar.vue`/`MarkdownViewer.vue`/`EntryDetailMobileBar.vue`/`DESIGN.md`（P4 implementer 已完成且验证正确的实现代码，不要动）
- 修完后自跑 `E2E_SPEC=e2e/t09 make debug-test` 确认这 2 条测试（chromium + Mobile Chrome 各 1 条，共 4 条）从失败转为通过，且没有引入新的失败（其余 46 passed 应保持不变）

## 产出

在 `docs/tasks/T091-mobile-detail-visual-polish/P3-test-cases.md` 末尾追加一节"P4 阶段测试修正记录"，说明：改了哪两处、为什么改（CSS 盒模型根因）、实测确认的子元素宽度情况、自跑结果（转绿数量）。不要重写整份文件，只追加。

完成后向我报告：改动的文件+行号、自跑结果摘要（失败数从多少变多少），不要贴全部日志。

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
