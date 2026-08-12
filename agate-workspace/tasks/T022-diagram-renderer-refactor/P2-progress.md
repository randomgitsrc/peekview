## P2 进度记录

### 步骤 1：读取角色定义 + P0/P1/WORKFLOW（完成）
- architect 角色要求：数据流优先、状态机完整、接口契约明确、影响域分析、读现有代码再设计
- P0 关键：路线 B + 温和 C，T021 已 DONE 时序约束解除，行为保真铁律最高优先级
- P1 关键：29 BDD + I2 三胞胎差异矩阵（24 行）+ I3 16-case handler 差异矩阵 + I4-I10 隐含需求
- 四字段 gate 硬要求：packages/domains/ui_affected/gate_commands
- 分阶段落盘：每完成一个关键决策立即追加

### 待读取代码
- useMarkdown.ts（公开 API）
- MarkdownViewer.vue（事件委托 + 状态管理）
- MermaidDiagram.vue / PlantUmlDiagram.vue / SvgDiagram.vue（三胞胎结构）


### 步骤 2：读 useMarkdown.ts + 三胞胎 + EntryDetailView 调用面（完成）

**useMarkdown.ts（372 行）公开 API**：
- `render(content, theme): Promise<MarkdownRenderResult>`
- `MarkdownRenderResult = { html, headings, mermaidSources: Map<number,string>, plantumlSources, svgSources }`
- 流程：markdown-it fence 收集 codeBlocks → 占位符 `<!--CODE_BLOCK_N-->` → 二轮替换
- 三族 block HTML 在 useMarkdown 内硬编码（含 data-action/data-block-id/data-index），不是组件模板
- mermaid/plantuml code 视图：`escapeHtml` 同步（无 Shiki）；svg code 视图：`highlightCode(code,'xml',theme)` 异步
- 末尾 DOMPurify.sanitize（ADD_ATTR 含 data-action/data-block-id/data-index/data-mode/data-code/data-line/target/rel；ADD_TAGS: button）
- **下游消费者**：仅 MarkdownViewer（L386-392 解构 result）。EntryDetailView 不消费 render() 返回值

**EntryDetailView 调用面（L136-141）实测**：
- `<MarkdownViewer :content="..." :headings="tocHeadings" @select-heading="scrollToHeading" />`
- 但 MarkdownViewer `defineProps<{ content: string }>()` 仅声明 content；`:headings` 是 dormant fallthrough attr；`@select-heading` 从未被 emit（MarkdownViewer emit 'headings'）
- **结论**：真实外部契约只有 `:content` 输入。render() 返回结构可改（MarkdownViewer 唯一消费者）。为保真保留 defineProps/defineEmits 签名不变（避免 fallthrough 行为变化）

**三胞胎结构核对（对照 P1 I2 矩阵）**：
- MermaidDiagram 598：emit 5 事件 / touch / 无 try-catch / fillRect 白 / `<br>`→`<br/>` / viewBox fallback=g.root getBBox(tempDiv) / final 800×600 / defineExpose 8 项 / refresh='mermaid-refresh'
- PlantUmlDiagram 416：无 emit / 无 touch / 无 try-catch / fillRect 白 / 无 br 修复 / viewBox fallback=width/height attrs / final 800×600 / defineExpose 8 项 / refresh='plantuml-refresh'
- SvgDiagram 478：无 emit / touch / try-catch / 无 fillRect 透明 / 无 br 修复 / viewBox fallback=width/height attrs / final 400×300 / defineExpose 3 项 / refresh='svg-refresh'
- **inline PNG 路径不对称**：mermaid/plantuml 在 MarkdownViewer 内 re-render fresh（mermaid.render / usePlantUML.render）；svg 委托组件 downloadPng()。modal 内三族都用 props.svgContent

**事件委托 handleDelegatedAction（L340-363）16 case + handleDelegatedResize start-resize**：
- 三族 handler 行为差异已在 P1 I3 矩阵列明，迁移 emit 时不可统一

**状态变量（迁出候选）**：mermaidCache / mermaidSourcesMap / plantumlSourcesMap / svgSourcesMap / renderToken / mermaidInstances / plantumlInstances / svgInstances / resizingBlock / startY / startHeight

