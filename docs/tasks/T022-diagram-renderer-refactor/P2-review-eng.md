---
phase: P2
task_id: T022-diagram-renderer-refactor
type: review
parent: P2-design.md
trace_id: T022-P2-review-eng-20260625
reviewer: plan-eng-review
status: needs-revision
created: 2026-06-25
---

# P2 工程经理评审 — T022 diagram-renderer-refactor

> 评审对象：P2-design.md（1033 行）。视角：架构、数据流、状态管理、接口契约、影响域。
> 评审基线：P1-requirements.md（29 BDD + I2 24 行差异矩阵 + I3 16-case 差异矩阵）+ P0-brief.md（12 known_risks + 行为保真策略）+ 源码逐行核对（MarkdownViewer.vue / useMarkdown.ts / MermaidDiagram.vue / SvgBlock.spec.ts）。

## 架构问题（阻塞级）

### BLOCKER-1：BaseDiagram props 接口遗漏 codeViewHtml，code 视图 HTML 无传入路径

- 位置：2.1（props 接口）与 6.1（挂载边界重划）矛盾。
- 问题：6.1 明确 BaseDiagram template 渲染完整 block（header + 按钮 + content[diagram viewer + code 视图 v-html codeViewHtml] + resize + modal）。即 code 视图 HTML（mermaid/plantuml 的 escapeHtml 同步输出；svg 的 highlightCode 异步 Shiki 输出）须由 BaseDiagram v-html 渲染。但 2.1 的 BaseDiagramProps 只有 svgContent，**没有 codeViewHtml 字段**。
- 数据流断裂：useMarkdown 的 renderCodeView 产出 code 视图 HTML（5.2），但该 HTML 既未存入 sourcesMap（4.2 BlockSource 只有 lang/code/svgContent，无 codeViewHtml），也未作为 prop 传入 BaseDiagram。code 视图 HTML 在数据流图中凭空消失。
- 源码核对：原 useMarkdown.ts L242/275/307 在 block HTML 中内联 toggle-text 及 code 视图 escapeHtml 输出。新方案把 block 结构从 useMarkdown v-html 迁到 BaseDiagram 模板，code 视图 HTML 必须有明确传入路径。
- 建议：
  1. BaseDiagramProps 新增 codeViewHtml: string。
  2. BlockSource（4.2）新增 codeViewHtml?: string，由 useMarkdown renderCodeView 填充。
  3. 薄包装从 renderer.sourcesMap.get(blockIndex).codeViewHtml 取值传给 BaseDiagram。
  4. svg 异步 Shiki 高亮（原 useMarkdown 二轮替换占位符）须明确：preRender 阶段 await 填入 sourcesMap，还是 mount 阶段二次填充——设计须二选一并写入数据流图。

### BLOCKER-2：渲染错误处理流程时序矛盾（preRender 与 mount 的 DOM 依赖冲突）

- 位置：2.1（错误处理在 composable）与 4.4（renderContent 时序草图）矛盾。
- 问题：
  - 4.4 草图把 await renderer.preRenderMermaid(...) 放在 html.value = result.html（v-html）**之前**。即 preRender 发生在 DOM 挂载之前。
  - 但原错误处理（MarkdownViewer.vue L470-473 mermaid mountPoint.innerHTML 设 error div；L520-527 plantuml 切 code mode + dataset.rendered=true；L567-568 svg mountPoint.innerHTML 设 error div）**全部操作 mountPoint DOM**，而 mountPoint 只在 v-html + nextTick 之后才存在。
  - 若 preRender 在 composable 中执行（v-html 前），preRender 抛错时无 mountPoint 可写错误 UI → 要么错误吞掉（违反 P1 维度 9 BDD），要么错误处理延迟到 mount 阶段（与 2.1「错误处理在 composable」矛盾）。
- 源码核对：L425-571 的 renderMermaidDiagrams/renderPlantUmlDiagrams/renderSvgBlocks 把「调渲染器」与「写错误 DOM」耦合在同一 try/catch 内，因 mountPoint 此时已存在。设计拆到 composable（preRender）+ MarkdownViewer（mount）两处，错误处理归属未决。
- 建议：
  1. 明确错误处理归属：preRenderXxx 抛错时 composable 在 sourcesMap.set(index, { ..., error: true }) 标记（不操作 DOM）。
  2. mount 阶段 MarkdownViewer 检查 source.error：mermaid/svg → mountPoint.innerHTML = error div；plantuml → 切 code mode + dataset.rendered=true。
  3. 或：preRender 仍在 v-html 之后（保留原始时序），composable 只迁状态不迁渲染调用——须重新权衡 4.4 时序。
  4. P2 须在 4 节补「错误处理流程图」，明确 error 标记 → mount 阶段消费的完整路径。

### BLOCKER-3：getMermaidSvg 接口契约不连贯（查找键混用 + 占位 bug）

- 位置：4.3 composable 公开 API。
- 问题：
  - sourcesMap.get(...) 省略了 key（设计占位未填），无法实现。
  - mermaidCache 以 `${theme}-${code}` 为 key（4.1），sourcesMap 以 `index: number` 为 key（4.2）。两套查找键不互通。
  - 薄包装 MermaidDiagram（3.1）computed 调 renderer.getMermaidSvg(props.code, props.theme)——按 code 查。但 preRender 填的是 sourcesMap.set(index, {...})——按 index 存。薄包装持有 blockIndex 却传 code 给 getMermaidSvg，函数内部无法用 code 查 sourcesMap。
- 根因：设计混淆「cache 查找键（code+theme）」与「sourcesMap 查找键（index）」。薄包装同时持有两者，但 API 只接受其一。
- 建议：
  1. 薄包装 computed 改为 renderer.getMermaidSvgByIndex(props.blockIndex)（按 index 查 sourcesMap，命中返回 svgContent；未命中 fallback 到 mermaidCache 按 code+theme 查）。
  2. 或 sourcesMap 改为以 `${lang}-${code}` 为 key（但 index 用于 block HTML 占位符匹配，不能丢）。
  3. P2 须在 4.3 给出**无占位的完整实现**，并标注薄包装 computed 入参是 blockIndex 还是 code，二者须一致。

## 架构问题（非阻塞）

### 建议-1：6.2「16-case handler 映射」遗漏 copy-code-block + 误纳 zoom 为委托 case

- 位置：6.2 映射表。
- 问题 A（遗漏 copy-code-block）：源码 MarkdownViewer.vue L361 `case 'copy-code-block'` 是 handleDelegatedAction 16 case 之一（通用代码块复制，非 diagram 专用）。6.2 表声称「16-case handler 映射完整」，但实际映射 5 族 × 3 + start-resize = 16，把 copy-code-block 静默丢弃。应显式声明 copy-code-block 不迁移，保留在 MarkdownViewer。
- 问题 B（zoom 非委托 case）：6.2 末行「zoom-in / zoom-out / reset（mermaid 当前 emit）」标注「三族统一 emit 信号」。但源码 handleDelegatedAction 16 case 中**无 zoom-in/out/reset**——zoom 按钮在 MermaidDiagram 组件模板内 @click 直调 panZoomInstance.zoomIn()（MermaidDiagram.vue L18-20 toolbar-btn），是组件内部逻辑，不经 data-action 委托。设计把 zoom 迁到 emit → MarkdownViewer handler 属不必要的迁移，增加行为回归风险（panZoom 时机、instance re-expose 链路）。
- 建议：
  1. 6.2 表补 copy-code-block 行：标注「不迁移，保留 MarkdownViewer」。
  2. zoom 保留为组件内部逻辑（BaseDiagram 内 @click 直调 panZoom），不 emit 到 MarkdownViewer。
  3. 修正 6.2 表标题为「15-case diagram handler 映射 + 1 case 保留」。

### 建议-2：CSS 1192 行拆分缺选择器级映射，style scoped 迁移会改变作用域属性

- 位置：1.1（CSS 拆分决策）+ 6.6（CSS 拆分归属）。
- 问题：1.1 说「block 通用样式随 BaseDiagram，差异样式随各薄包装，front-matter/code-block-wrapper/dark-mode 保留 MarkdownViewer」，但无选择器→目标文件映射表。Vue `<style scoped>` 会给选择器加 data-v-xxx 属性，迁组件后哈希变化 → 若有跨组件选择器（如 MarkdownViewer 的 `.dark .mermaid-block .mermaid-content`）依赖特定作用域属性，迁移后可能失效。
- 源码核对：MarkdownViewer.vue L797-1989 共 1192 行 CSS，含三族镜像结构 + dark mode 覆写（.dark 前缀）。dark mode 选择器跨作用域（.dark 在 body/root，.mermaid-block 在组件内），迁移后作用域隔离可能断链。
- 建议：P4 实施前产出「CSS 选择器 → 目标文件」映射表（含 dark mode 选择器归属），并对跨作用域选择器标注 :deep() 处理方式。P3 加 dark mode 渲染快照。

### 建议-3：preRender 并行化边界措辞过于宽松（「可」而非「禁止」）

- 位置：4.5。
- 问题：「mermaid/svg 预渲染可并行...但为稳妥 + 保真，P4 可保留串行 for...of await 循环」——「可」是建议非约束。P4 subagent 可能选 Promise.all 并行化 mermaid。mermaid 库内部状态（securityLevel:'strict' 全局配置、mermaidAPI 全局）是否真无共享，未经源码验证。
- 建议：措辞改为「**禁止**对所有 diagram 预渲染使用 Promise.all（含 mermaid/svg），保留原始串行 for...of await 循环」。仅允许 cache 命中时同步跳过。

### 建议-4：sourcesMap 返回结构变更的测试影响未验证

- 位置：5.3（API 兼容声明）。
- 问题：设计声明仅 MarkdownViewer 消费 render() 返回值，但 files_to_read（第 8 节）未包含检查 __tests__ 目录是否直接 import useMarkdown。若存在直接 import useMarkdown 的测试，返回结构变更会破坏。
- 建议：P3 先 grep 确认 `from '@/composables/useMarkdown'` 仅在 MarkdownViewer.vue 使用。files_to_read 补该项检查。

## 测试缺口

1. **错误处理路径无测试设计**：P1 维度 9 有 3 条 BDD（mermaid error / plantuml error 切 code / svg error），但 P2 未说明 P3 如何为「composable preRender 标记 error → mount 阶段消费」写单测（需 mock 渲染器抛错 + 验证 sourcesMap.error 标记 + 验证 mount 阶段 DOM）。建议 P3 补 composable 错误标记单测。
2. **跨作用域 CSS dark mode 无快照**：P3 红线只提 HTML 快照 + DOM 结构快照，未提 dark mode CSS 渲染快照。建议 P3 加 dark 主题下 `.mermaid-block` 渲染快照（验证 scoped 作用域迁移不破坏 dark mode 选择器）。
3. **zoom 内部逻辑迁移无测试**：若采纳建议-1（zoom 保留组件内部），P3 须确认现有 MermaidDiagram zoom 单测（若有）迁移到 BaseDiagram 后仍覆盖。设计 files_to_read 未列 zoom 相关测试。

## 锁定决策

本次评审后确定的技术方向（无异议，仅记录）：

1. **三胞胎抽 BaseDiagram + 薄包装 < 150 行**：架构方向正确，85% 重复集中、15% 差异 props 参数化的分层合理。差异覆盖核对（2.1 末尾）对照 P1 I2 24 行逐条对应，无遗漏差异点（除 BLOCKER-1 的 codeViewHtml）。
2. **useMarkdown 注册模式（Map<fence-lang, renderer>）**：查表路由替代三分支 if/else 正确。registerDiagramType API 满足 P0 可扩展性量化目标（1 文件 + 1 行注册）。可扩展性验证（5.1）达标。
3. **renderToken 防竞态保留（4.4）**：composable 暴露 nextToken/isCurrent，8 检查点保留在 MarkdownViewer 显式位置，不封装不透明调用——策略正确，避免竞态回归。
4. **plantuml 串行约束保留（4.5）**：直调 usePlantUML.render，模块级 renderQueue 不动，禁 Promise.all——正确。
5. **DOMPurify 两层净化保留（5.4）**：svg 专属 sanitize（meta.sanitize）+ 末尾整体 sanitize，位置与 T020 安全债一致——正确。
6. **挂载机制两阶段保留（5.5）**：v-html 占位 → nextTick → querySelector mountPoint → h + vueRender，不改 `<component :is>`——正确，避免挂载时机变化。
7. **API 兼容判定（5.3）**：render() 返回 sources 合并 Map 属技术内部保真，EntryDetailView 调用面（:content + headings emit）零改动——判定正确。
8. **minimal_validation: not_needed**：字段存在且 result 填写（not_needed），推理（Vue @click 是框架编译机制非内联事件）合理，符合 P2 最小验证要求。CSP 合规可在 P3 早期验证（非 BLOCKER）。
9. **known_risks 12 条逐条回应（7.1）**：每条有对策 + 验证阶段，覆盖完整。BLOCKER-2 的错误处理时序是唯一未在 7.1 充分展开的隐含点。

## 评审结论

**status: needs-revision**

3 个 BLOCKER（接口契约遗漏 codeViewHtml / 错误处理时序矛盾 / getMermaidSvg 占位 bug）须修订后才能通过。4 个建议（16-case 映射修正 / CSS 选择器映射 / 并行化措辞收紧 / 测试影响验证）可在 P3/P4 落实。

核心问题集中在**数据流不完整**（code 视图 HTML 传入路径断裂、错误处理跨阶段归属未决）和**接口契约占位未填**（getMermaidSvg）。这两个是 P4 实施时 subagent 必然卡住的硬阻塞，须在 P2 补齐。

阻塞问题数量：3。

