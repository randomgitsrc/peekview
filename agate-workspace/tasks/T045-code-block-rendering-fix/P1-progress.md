# T045 P1 Progress

## Step 1: Read analyst.md
- Role: P1 需求分析师, 认知模式=先质疑再定义
- Output: P1-requirements.md with 需求复述/隐含需求/BDD验收条件/待确认清单/裁剪说明/范围声明/能力需求声明
- 小任务可简化（P1_simplified: true），但需求质疑和 BDD 不可跳

## Step 2: Read P0-brief.md
- 三个子问题：zebra stripe 不整行 / 配色差值太小 / Markdown+Diagram 无行号
- 改动域：useShiki.ts, MarkdownViewer.vue, DiagramBlock.vue, variables.css, code.css
- known_risks: highlightCode DOM 变更影响回归 / dark+light 双主题 / Mermaid/PlantUML code mode 无高亮
- pruning_tendency: 适度裁剪，P3 可跳，P7 可跳

## Step 3: Read WORKFLOW.md
- P1 gate: BDD ≥1, NEED_CONFIRM=0, GAP=0
- P3 默认保留，跳过需理由（≤3行且有现成覆盖 / 纯文档配置）
- P6 默认保留，小任务裁剪需充分理由
- 涉及 UI 变化 → P6 不可裁剪

## Step 4: Read source files
- useShiki.ts: highlight() 生成 code-container+line-numbers+html; highlightCode() 只返回 codeToHtml
- MarkdownViewer.vue: zebra CSS 用 .line:nth-child(even) 但 pre * transparent 覆盖; .line 未设 display:block
- variables.css: dark --bg-code: #0e131b, --bg-code-even: #131920; light --bg-code: #eef0f3, --bg-code-even: #e8ebef
- code.css: CodeViewer 的 .line 有 display:block, MarkdownViewer 没有
- useMarkdown.ts: Markdown 代码块用 highlightCode()（无行号）; diagram SVG 用 highlightCode('xml'); mermaid/plantuml 用 escapeHtml()
- DiagramBlock.vue: code mode 用 v-html="block.codeViewHtml"，zebra CSS 用 .line:nth-child(even)

## Step 5: 隐含需求分析
- 隐含1: highlightCode 改为含行号后，DiagramBlock 的 codeViewHtml 结构也变，需确认 DiagramBlock CSS 兼容
- 隐含2: mermaid/plantuml code mode 当前是 escapeHtml 无 .line 元素，zebra CSS 不生效，加行号需同步加 .line 结构
- 隐含3: MarkdownViewer 的 pre * transparent 覆盖了 zebra 背景，必须增加 zebra 选择器优先级
- 隐含4: 配色调整需保证 dark/light 主题都满足 WCAG 对比度
- 隐含5: 行号列宽度在不同行数时需对齐（1位数 vs 3位数 vs 5位数）
