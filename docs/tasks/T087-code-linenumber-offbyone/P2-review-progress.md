# P2-review progress log — T087 plan-design-review

## 维度 1：交互状态覆盖率

评分依据：行号渲染的 loading/error/empty 边界覆盖。

- empty（空文件 BDD-4）：设计明确指出 CodeViewer `doHighlight()` 对 `!props.content` 短路（源码 line 88-91 已验证），`renderLineNumbers` 此路径不触发。纯函数层 `"".split('\n')` = 1 行号 + 1 `.line`，与 P1 [SUGGEST] 一致。覆盖。
- loading：`isHighlighting` 状态在 CodeViewer 已有（源码 line 47），本任务不改 loading 行为，设计正确声明"不改 CodeViewer"。非本任务范围，不扣分。
- error：`doHighlight` 的 catch 走 fallback `<pre><code>`（源码 line 99-100），fallback 不含行号列，两列对齐问题不存在。设计未显式提 error 路径，但 fallback 路径天然不触发 renderLineNumbers，无错位风险。可接受。
- edge case（仅换行符 BDD-5 / 中间空行+末尾换行 BDD-6）：设计 6-case 全覆盖，每个 case 都给出 trim 后结果 + 行号数 + `.line` 数，三联对齐明确。

评分：9/10。empty/edge 全覆盖；error 路径未显式说明但天然不触发，扣 1 分为提示性。

## 维度 2：AI Slop 风险

评分依据：trim 点是否明确、有无歧义给实现留"随便搞"空间。

- trim 点精确到行号：`highlight()` line 185 前对 `code` trim + line 190 用 trimmedCode；`highlightCode()` line 202 前 + line 207。两处对称，伪代码清晰。
- trim 方式明确：`code.replace(/\n$/, '')`，非 `trimEnd()`，理由（避免误伤末尾有意义空格）成立。
- trim 后的 code 必须同时传给 `codeToHtml` 和 `renderLineNumbers`，伪代码用 `trimmedCode` 变量名两次引用，无歧义。
- "不改 renderLineNumbers 函数体"明确，避免实现者误改函数体引入错位。
- 否决方向（renderLineNumbers 内 trim / pop / trimEnd / Shiki transformer）全部列出，堵住实现者走错路。

评分：10/10。trim 点、方式、否决方向全部无歧义，实现者无自由发挥空间。

## 维度 3：移动端考虑

评分依据：行号列在移动端布局影响。

- 本任务不改布局（不改 CodeViewer.vue 的 template/CSS），只改行数（行号列和高亮列的行数同时减一或保持）。
- 设计声明"不改 CodeViewer"，`syncLineHeights` 按 index 配对逻辑不变（源码 line 52-75 已验证 `.line-number[index] ↔ .line[index]`），两列数量一致即可正确配对。
- 移动端 wrap 模式（BDD-9）由 syncLineHeights 处理，设计明确"两列数量一致即可正确配对"，无额外移动端风险。

评分：9/10。本任务确实不改移动端布局，设计正确声明范围。扣 1 分因未显式声明"移动端无影响"但隐含可推断。

## 维度 4：可访问性

评分依据：行号列 aria-hidden 保持。

- `renderLineNumbers` 源码 line 153 `<div class="line-numbers" aria-hidden="true">`，设计声明"不改 renderLineNumbers 函数体"，aria-hidden 保持。
- 行号是装饰性视觉辅助，aria-hidden=true 正确（屏幕阅读器不应读行号）。
- 设计未显式提 aria-hidden，但"不改 renderLineNumbers"隐含保持。

评分：9/10。aria-hidden 通过"不改函数体"隐式保持。扣 1 分因未显式声明"aria-hidden 保持"作为验收锚点，但实现约束已保证。

## 维度 5：组件完整性

评分依据：CodeViewer/useMarkdown 消费方的 input/output 完整描述。

- CodeViewer：input `props.content`（string）+ `props.language` + `theme`；output `highlightedCode`（HTML string）。空 content 短路（BDD-4）明确。源码 line 87-106 验证。
- useMarkdown：fence renderer 收集 `token.content`（line 267）→ `codeBlocks.push` → `highlightCode(codeBlock.code, codeBlock.lang, theme)`（line 378）。input/output 描述完整。
- renderLineNumbers：input `code`（string），output HTML string（`<div class="line-numbers">...`）。未 export，通过 highlight/highlightCode 间接调用。设计第 6 节给出 P3 测试策略（export vs 间接测），由 P3 决定。
- 两消费方（CodeViewer → highlight；useMarkdown → highlightCode）的 input/output 都有对应 BDD 覆盖。

评分：10/10。两消费方 input/output 完整，BDD 映射全覆盖。

## 评审重点 1-6

见 P2-review.md 主体。
