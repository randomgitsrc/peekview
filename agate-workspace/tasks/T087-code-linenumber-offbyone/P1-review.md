---
phase: P1
task_id: T087-code-linenumber-offbyone
type: review
parent: P1-requirements.md
agent: requirements-review
status: approved
---

# P1 需求基线评审 — T087 代码块行号 off-by-one

> retry#1（2026-08-07）：analyst 已按 retry#0 修订清单完成两处措辞修订，详见末尾"retry#1 确认"节。结论从 needs-revision 升级为 approved。

## 评审范围

评审对象：`docs/tasks/T087-code-linenumber-offbyone/P1-requirements.md`
对照上游：`P0-brief.md`
实测验证源：`frontend-v3/src/composables/useShiki.ts`、`frontend-v3/src/components/CodeViewer.vue`、`frontend-v3/src/composables/useMarkdown.ts`
Shiki 版本：`^1.10.0`（package.json）

[PROD_NOT_TOUCHED]

## 实测结论可信度验证（dispatch-context 重点 #1）

P1 §2 称"实测 Shiki 1.x `codeToHtml` 与 `code.split('\n')` 产生相同数量的行（都多一个尾部空行）"，修正 P0 的"Shiki 高亮列不多，两者错位"。

核实结果：
- `useShiki.ts:185-190` `highlight()`：`code` 同时传给 `highlighter.codeToHtml(code, ...)`（line 185）和 `renderLineNumbers(code)`（line 190），两者输入完全相同。
- `useShiki.ts:202-207` `highlightCode()`：同上结构，line 202 `codeToHtml` + line 207 `renderLineNumbers` 同输入。
- Shiki 1.x `codeToHtml` 内部按 `\n` split 生成 `.line` 元素，不处理末尾换行 → `"a\nb\n"` 产生 3 个 `.line`（末尾空）。`code.split('\n')` 同样产生 3 元素（末尾空串）。
- 结论：P1 的实测结论**可信**。P0 原描述"高亮列不多、两列错位"不准确；P1 修正为"两列都多一个尾部空行、数量对齐"正确，且据此把 BDD 验收锚点调整为"行号数 == `.line` 数 == 逻辑行数"三联对齐，锚点更精确。

## BDD 评审

- **BDD-1**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - Given `"a\nb\n"` / When 渲染完成 / Then 行号 2 + `.line` 2 + 对齐。整数比较，二值明确。
- **BDD-2**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 末尾无换行边界。Then 行号 2 + `.line` 2。二值明确。
- **BDD-3**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 单行无换行边界。Then 行号 1 + `.line` 1。二值明确。
- **BDD-4**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 空文件边界。Then 不渲染行号列也不渲染高亮列。已核实 `CodeViewer.vue:88` `if (!props.content) { highlightedCode.value = ''; return }` 短路逻辑存在，Then 与代码行为一致。二值明确。
  - ⚠️ **与 §2 边界声明措辞冲突**：见下方"BDD 跨条一致性"专项。
- **BDD-5**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 仅换行符 `"\n"` 边界。Then 行号 1 + `.line` 1。二值明确。
- **BDD-6**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 中间空行 + 末尾换行 `"a\n\n"` 边界。Then 行号 2 + `.line` 2（中间空行保留）。二值明确。
- **BDD-7**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - Markdown 代码块路径。Given 含"token.content 可能已被 trim 末尾换行"——Given 有不确定性，但 Then 锚定"无论 markdown-it 是否 trim，两列必须对齐"，最终判定取实际渲染结果比对两列数量，二值明确。已核实 `useMarkdown.ts:267` `const code = token.content` 取 fence 内容传给 `highlightCode`。
- **BDD-8**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - Markdown 多代码块不回归。Then 每个代码块两列对齐。逐块比对，二值明确。
- **BDD-9**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - wrap 软换行对齐。Then `.line-number[index]` ↔ `.line[index]` 配对、数量相等。已核实 `CodeViewer.vue:83` `watch(highlightedCode, syncLineHeights)`。二值明确。
- **BDD-10**: PASS 可判 + 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
  - 源码视图切换走 CodeViewer。Then 与 BDD-1 一致（行号 2 + `.line` 2）。二值明确。

**BDD 编号格式**：BDD-1..BDD-10 连续不跳号，均使用 `#### BDD-NN:` 标准格式。每条单条 Given-When-Then，无多场景合并。

**多端维度标注说明**：本任务纯前端 composable 改动，MCP/CLI/API/后端均不涉及行号渲染（P1 §2 已声明），故 10 条 BDD 多端维度均为 ✗（合理不适用，非遗漏）。

## 隐含需求覆盖

- **数据维度**：覆盖✓。P1 §2 明确"无"——content 原样透传，已读 `useShiki.ts:185/202` 确认 `codeToHtml` 与 `renderLineNumbers` 收同一 `code`，后端 `read_bytes()` 原样返回，无迁移、无存量数据受影响。
- **前端维度**：覆盖✓。§2 列出行号列/高亮列对齐变化（视觉改动）+ wrap 模式 `syncLineHeights` 配对一致性（BDD-9）+ 源码视图切换（BDD-10）。
- **多端维度**：覆盖✓（声明无）。P1 §2 明确"纯前端 composable 改动，MCP/CLI/API/后端均不涉及行号渲染"，与代码事实一致。
- **边界维度**：覆盖✓。§2 + BDD 列空文件（BDD-4）/ 仅换行符（BDD-5）/ 单行无换行（BDD-3）/ 中间空行+末尾换行（BDD-6）/ 末尾带换行（BDD-1）/ 末尾不带换行（BDD-2）6 个边界。
- **兼容维度**：覆盖✓。§2 提 wrap 模式不破坏 + BDD-8 Markdown 不回归 + BDD-9 wrap 对齐 + BDD-10 源码视图切换不回归。

## BDD 跨条一致性（dispatch-context 重点 #3）

**BDD-4 vs §2 边界声明**：

- §2 边界声明原文："空文件（`""`）：CodeViewer 路径在 `!props.content` 时短路不渲染；`renderLineNumbers` 纯函数对 `""` 产生 1 个行号（与 Shiki 1 个 `.line` 对齐）。"
- BDD-4 Then："不渲染行号列也不渲染高亮列（CodeViewer 对空 content 短路，`highlightedCode` 为空）"

**矛盾分析**：
两处锚点位于不同抽象层——§2 后半句锚定"`renderLineNumbers` 纯函数行为"（输入 `""` → 1 行号），BDD-4 锚定"CodeViewer 组件实际渲染路径"（短路不调 `renderLineNumbers` → 0 行号）。已核实 `CodeViewer.vue:88` 短路逻辑确实存在，空文件根本不调用 `renderLineNumbers`。

**判定**：非逻辑矛盾（两句话各自在所属抽象层为真），但 §2 把"纯函数层"和"组件层"混写在同一条边界声明里，读者会误以为"空文件会渲染 1 个行号"，与 BDD-4 的"不渲染"直接冲突。

**修订要求**：§2 空文件边界声明应明确分层表述，例如：
> 空文件（`""`）：CodeViewer 组件层在 `!props.content` 时短路不渲染（见 BDD-4，行号列与高亮列均不渲染）。`renderLineNumbers` 纯函数层对 `""` 产生 1 个行号（与 Shiki 1 个 `.line` 对齐），但此路径在组件层不会被触发。

此项为**轻量级措辞修订**，不阻断核心需求基线的正确性。

**其余 BDD 跨条一致性**：BDD-1/BDD-2/BDD-3/BDD-5/BDD-6/BDD-10 同场景（CodeViewer 渲染）的 Then 均为"行号数 == `.line` 数 == 逻辑行数 + 对齐"，无矛盾。BDD-7/BDD-8（Markdown 路径）Then 为"两列对齐"，与 CodeViewer 路径验收锚点一致，无矛盾。保护优先级：无多重保护机制重叠，N/A。

## 裁剪评审

- **裁剪**：`phases: [P1, P2, P3, P4, P5, P6, P7, P8]` 全保留，无裁剪。裁剪评审 N/A。
- **risk_level**：`low-medium`。理由"根因单点、无后端、无 schema、无权限边界；但修复语义横切 `codeToHtml` 输入（不止 `renderLineNumbers`），且 3 条渲染路径需回归"。与实际风险匹配——P1 发现的"trim 必须同时作用于两输入"确实使修复面比 P0 预想的宽，low-medium（非 low）判断正确。
- **capability_requirements**：`browser-vision` / `supplementable`。P6 截图验证需要，`playwright-cdp` + `vision-engine` 均可用。三态判断正确，无 GAP，不阻塞。

## P1 纯净性（dispatch-context 重点 #2）

**[DESIGN_CONSTRAINT] 是否混入解决方案设计**：

P1 §2 [DESIGN_CONSTRAINT]："trim 必须同时作用于 `codeToHtml` 的输入和 `renderLineNumbers` 的输入"。

**分析**：
- 实质是结果行为约束（两列必须对齐 + 行号数 = 逻辑行数），P1 §2 末尾明确"留给 P2 决定如何达到对齐（trim 输入共享 / 分别 trim / 其他）"，方向正确。
- 但措辞"trim 必须**同时作用于**"隐含"trim 是唯一手段"——若 P2 提出"split 后 pop 末尾空元素"或"Shiki `codeToHtml` 选项控制"等非 trim 方案，是否违反此约束？措辞有实现倾向。

**判定**：**轻微纯净性瑕疵**，不构成硬性方案锁定（P1 §2 末尾的"其他"已留口），但措辞会让 P2 误以为只能用 trim。

**修订要求**：[DESIGN_CONSTRAINT] 改写为纯结果导向，例如：
> [DESIGN_CONSTRAINT] 修复后 `codeToHtml` 输出的 `.line` 数与 `renderLineNumbers` 输出的行号数必须一致且等于文件内容的逻辑行数（末尾 `\n` 不产生额外行）。实现手段（trim 输入 / 后处理 split 结果 / Shiki 选项 / 其他）由 P2 决定，P1 只定义结果行为。

**其余纯净性**：BDD 均描述用户可见行为（行号数量、对齐、是否渲染），无 API 调用细节、无函数签名规定、无实现路径锁定。§6 packages 声明是范围标注非实现设计。纯净性整体良好。

## dispatch-context 重点 #4：BDD-7 "可能 trim" 可二值判定性

BDD-7 Given："token.content 可能已被 trim 末尾换行"——Given 条件确实有不确定性（markdown-it 是否 trim 取决于其版本/配置）。

但 Then："无论 markdown-it 是否 trim，两列必须对齐"——验收时取**实际渲染结果**比对两列数量，不依赖 Given 的确定性。即：无论 trim 与否，只要两列数量相等即 PASS，否则 FAIL。二值可判。

**判定**：BDD-7 可二值判定，无需修订。"可能 trim"是 Given 对 markdown-it 行为不确定性的如实描述，不是 BDD 缺陷。建议（非强制）P1 可在 BDD-7 补一句"验收时取实际渲染结果比对，不依赖 markdown-it 是否 trim"使二值判定路径更显式。

## 结论

**status: approved**

P1 需求基线通过评审。10 条 BDD（BDD-1..BDD-10）全部可二值判定、编号格式合规、5 个隐含需求维度全覆盖、无裁剪、risk_level 匹配、实测结论可信、BDD 验收锚点（三联对齐）精确。retry#0 提出的两处措辞问题已由 analyst 在 retry#1 修订完成（见下方确认）。

## retry#1 确认（2026-08-07）

analyst 已按 retry#0 修订清单完成修订，逐项核实：

| # | 修订项 | 核实结果 |
|---|--------|---------|
| 1 | §2 空文件边界声明分层表述 | ✅ 已分层："CodeViewer 组件层在 `!props.content` 时短路不渲染（见 BDD-4，行号列与高亮列均不渲染）。`renderLineNumbers` 纯函数层对 `""` 产生 1 个行号...但此路径在组件层不会被触发。"。标注 `[BASELINE_CHANGE]`。与 BDD-4 不再冲突。 |
| 2 | §2 [DESIGN_CONSTRAINT] 改写为纯结果导向 | ✅ 已改写为"修复后 `codeToHtml` 输出的 `.line` 数与 `renderLineNumbers` 输出的行号数必须一致且等于文件内容的逻辑行数（末尾 `\n` 不产生额外行）。实现手段（trim 输入 / 后处理 split 结果 / Shiki 选项 / 其他）由 P2 决定，P1 只定义结果行为"。标注 `[BASELINE_CHANGE]`。不再有实现倾向。 |
| 3 | BDD-7 补注（建议非强制） | ⚠️ 未单独补注，但 BDD-7 的 Then 已含"无论 markdown-it 是否 trim，两列必须对齐"，二值判定路径已隐含。retry#0 已确认此项非强制，可接受。 |

**BDD 完整性**：BDD 仍为 10 条（BDD-1..BDD-10），编号不变，Given/When/Then 语义未改，无新 `[NEED_CONFIRM]`。

**基线保护合规**：两处修订均标注 `[BASELINE_CHANGE: 措辞修订，不改语义，P1-review retry#1]`，符合 P1 基线保护规则（主 Agent 批准 + 标注 + 不改 BDD 语义）。本次修订属措辞澄清，未改 BDD 的 Given/When/Then 语义。

**最终判定**：approved。P1 需求基线可推进至 P2。

## 修订清单（供 analyst 回改）

> 注：以下为 retry#0 的修订清单，已在 retry#1 全部完成（见上方"retry#1 确认"表），保留作历史记录。

| # | 位置 | 问题 | 修订要求 |
|---|------|------|---------|
| 1 | §2 空文件边界声明 | 与 BDD-4 措辞冲突（纯函数层 vs 组件层混写） | 分层表述：组件层短路不渲染（见 BDD-4）；纯函数层 1 行号但组件层不触发 |
| 2 | §2 [DESIGN_CONSTRAINT] | 措辞有实现倾向（"trim 必须同时作用于"） | 改写为纯结果导向：两列行数一致且等于逻辑行数；实现手段由 P2 决定 |
| 3（建议非强制） | BDD-7 | "可能 trim"的二值判定路径不够显式 | 补注"验收取实际渲染结果比对，不依赖 markdown-it 是否 trim" |
