# P4-review-progress — T087 design-review（分阶段落盘）

agent: design-review
task: T087-code-linenumber-offbyone

## 维度 1: 行号对齐视觉正确性

- 代码锚点：useShiki.ts:185 (highlight) + useShiki.ts:203 (highlightCode) 均新增 `const trimmedCode = code.replace(/\n$/, '')`
- trimmedCode 同时传给 codeToHtml (line 186 / 204) 和 renderLineNumbers (line 191 / 209)
- renderLineNumbers (line 150-154) 未改，收到的 code 已被调用方 trim
- 两列输入一致 → 输出自然对齐（BDD-9 syncLineHeights 按 .line-number[index] ↔ .line[index] 配对，数量一致即正确配对）
- P3 测试 9/9 全绿（独立复跑确认）
- 结论：对齐逻辑正确，无 BLOCKER

## 维度 2: 无回归

- CodeViewer.vue / useMarkdown.ts git diff 为空（未改）
- 现有 useShiki.spec.ts 18 passed | 1 skipped（独立复跑确认，无回归）
- 改动局限在 highlight/highlightCode 内部，函数签名/返回结构不变
- 结论：无回归风险，无 BLOCKER

## 维度 3: trim 方式（replace(/\n$/,'') vs trimEnd()）

- 独立 node 验证 11 case 全部符合预期
- /\n$/ 只去末尾单个 \n，不去中间空行（"a\n\n\n" → "a\n\n"）
- 保留末尾有意义空格（"a  \n" → "a  "，Python 缩进/Markdown 硬换行安全）
- trimEnd() 会误伤末尾空格 → 选 replace(/\n$/,'') 正确
- 结论：trim 方式精准，无 BLOCKER

## 维度 4: 边界 case 视觉表现

- 6 case + 3 衍生 case 对照 P4-implementation.md 边界表，逐行核对一致
- BDD-1/2/3/4/5/6 + BDD-7/7b 在 P3 测试中均有断言（.line-number count == .line count == 逻辑行数）
- 结论：边界 case 处理正确，无 BLOCKER

## 维度 5: 实现与 P2 设计一致

- P2 方案 A 伪代码：trimmedCode = code.replace(/\n$/, ''); codeToHtml(trimmedCode); renderLineNumbers(trimmedCode)
- 实际代码逐行匹配伪代码（highlight + highlightCode 两处对称）
- renderLineNumbers 不改、CodeViewer.vue 不改、useMarkdown.ts 不改、后端/MCP 不改 → 与 P2 "不改什么" 清单完全一致
- 无 [SCOPE_GAP] / [DESIGN_GAP] / [SCOPE+]
- 结论：实现严格遵循 P2 设计，无 BLOCKER

## 不适用维度

- AI Slop / Typography / Spacing / 交互状态：本任务纯逻辑 bug fix，无 UI 视觉/交互改动，不适用
