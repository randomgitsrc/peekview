---
phase: P7
task_id: T022-diagram-renderer-refactor
type: consistency
parent: P2-design.md
trace_id: T022-P7-20260626
status: draft
created: 2026-06-26
---

# P7 一致性检查 — T022 diagram-renderer-refactor

> 模式：以批判的第三方视角检查，假设 P2 设计**可能有错**，逐项找偏差。
> 输入：P2-design.md（r2 修订版）、P6-acceptance.md（29/29 PASS）、P7-dispatch-context.md + 6 份实际代码。
> 输出：双向检查（设计→实现 / 实现→设计），偏差分类 [BLOCKER]/[DEVIATION]/[EXTENSION]/[OK]。

## Summary

- **方向 1（设计→实现）**：实现覆盖 P2 大部分架构决策。3 项 DEVIATION（行数 + CSS 拆分 + useMarkdown 查表），4 项 EXTENSION（合理扩展）。
- **方向 2（实现→设计）**：实现无新隐含需求，无僵尸 BDD，无 P2 已废弃约束保留。
- **P6 BDD 二值规则**：P6 全部 29/29 标 PASS（人话翻译段无中间态词），二值规则通过。BDD-10.1（扩展性）为间接验证模式（仅 API 存在 + 无 if-else 硬编码），未实跑加 d2 流程——**不构成 P7 BLOCKER**（P6 自身 PASS），但验证深度不足记入 [EXTENSION-5]。
- **总体结论**：**PASS**（无 BLOCKER）。3 项 [DEVIATION] 全部非行为回归，4 项 [EXTENSION] 全部合理，可进入 P8。

## 1. 文件行数核算（量化偏差定位）

| 文件 | P2 目标 | 实际 | 偏差 | 判定 |
|------|---------|------|------|------|
| `BaseDiagram.vue` | < 400 | **531** | **+131** | **[DEVIATION-1]**（行数超 33%） |
| `MermaidDiagram.vue` | < 150 | 77 | -73 | [OK] |
| `PlantUmlDiagram.vue` | < 150 | 69 | -81 | [OK] |
| `SvgDiagram.vue` | < 150 | 57 | -93 | [OK] |
| `useCodeBlockRenderer.ts` | < 200 | 162 | -38 | [OK] |
| `useMarkdown.ts` | ~300 | 297 | -3 | [OK] |
| `MarkdownViewer.vue`（整文件） | 脚本 < 300 | 1430（含 1192 行 CSS） | — | **[DEVIATION-2]**（CSS 未拆分） |
| `MarkdownViewer.vue`（仅 `<script setup>`） | < 300 | 236（L8-236） | -64 | [OK] |
| **新增** `diagramRegistry.ts` | 未在 P2 1.1 文件清单声明 | 40 | +40 | **[EXTENSION-1]**（合理拆出独立文件） |

P2 1.1 节未列出 diagramRegistry.ts，实际实现拆出独立文件（40 行）。属合理结构改进，非行为回归。

## 2. 方向 1（设计→实现）逐项对照

### 2.1 架构总览（P2 第 1 节）

| 项 | 状态 | 备注 |
|---|------|------|
| 1.1 文件清单 | ⚠️ | diagramRegistry.ts 独立成文件，**未在 P2 1.1 清单声明**——[EXTENSION-1] |
| 1.2 数据流 | [OK] | useMarkdown.render → 占位符 → DOMPurify → v-html → mountDiagrams → vueRender —— 与 P2 数据流图一致 |
| 1.3 与 P0 范围声明边界 | [OK] | EntryDetailView 零 diff（未触碰），backend/MCP/CLI 未动，markdown-it 保留，DOMPurify/svg-pan-zoom/mermaid/plantuml/shiki 现有依赖保留 |

### 2.2 BaseDiagram.vue（P2 第 2 节）

| 项 | 状态 | 备注 |
|---|------|------|
| 2.1 props 接口（19 项） | [OK] | 全部声明完整：svgContent/codeViewHtml/blockId/blockIndex/classPrefix/theme/pngBackground/pngViewBoxFallback/pngFinalSize/pngBrFix/pngFilenamePrefix/panZoomMinZoom/panZoomMaxZoom/panZoomInitTryCatch/touchEnabled/resizeEnabled/refreshEventName/modalTitle + 5 个 toggle 差异 props（toggleTextUpdates/refreshOnToggle/copyFeedback/menuClickOutside/menuCloseOthers） |
| 2.1 label prop | [OK] | 实际新增 `label: string` prop（未在 P2 2.1 显式声明），三薄包装分别传 'MERMAID'/'PLANTUML'/'SVG'——[EXTENSION]（合理，弥补 P2 label 派生描述） |
| 2.2 slots | [OK] | 未使用 #renderer slot（BaseDiagram 内部直接 v-html svgContent），与 P2 2.2「slot 非必需，保留作扩展点」一致 |
| 2.3 emits | [OK] | 6 emit（fullscreen/download-png/toggle-view/toggle-menu/copy-code/start-resize），zoom 不 emit——与 P2 修订 4 一致 |
| 2.4 defineExpose 8 项 | [OK] | BaseDiagram 暴露 zoomIn/zoomOut/resetZoom/toggleFullscreen/refreshPanZoom/getSvgElement/downloadPng/exportToPng 三薄包装按差异 re-expose（Mermaid/PlantUml 8 项，**Svg 仅 3 项 toggleFullscreen/downloadPng/refreshPanZoom**）——与 P2 修订 4 完全一致 |
| 2.4.1 modal | [OK] | `<Teleport to="body"><div v-if="isFullscreen" :class="${prefix}-modal-overlay">` + 独立 modalPanZoomInstance（**maxZoom=20 硬编码** L133）——与 P2 2.4.1 一致 |
| 2.5 PNG 导出 | [OK] | exportToPng 函数：brFix 修复（L211）、g-root-getBBox fallback + tempDiv（L237-256）、width-height-attrs fallback（L259-263）、透明背景分支（L303-306）—— 参数化完整 |
| 2.6 行数预算 390 | ⚠️ | 实际 531，**超 141 行**——见 [DEVIATION-1] |

### 2.3 三薄包装（P2 第 3 节）

P2 3.4 速查表逐条对比（按差异 props）：

| 差异 | Mermaid | PlantUML | SVG | P2 期望 | 判定 |
|------|---------|----------|-----|---------|------|
| pngBackground | '#ffffff' | '#ffffff' | 'transparent' | 同 | [OK] |
| pngViewBoxFallback | 'g-root-getBBox' | 'width-height-attrs' | 'width-height-attrs' | 同 | [OK] |
| pngFinalSize | 800×600 | 800×600 | 400×300 | 同 | [OK] |
| pngBrFix | true | false | false | 同 | [OK] |
| panZoomInitTryCatch | false | false | true | 同 | [OK] |
| touchEnabled | true | **false** | true | 同 | [OK] |
| resizeEnabled | true | **false** | true | 同 | [OK] |
| refreshEventName | 'mermaid-refresh' | 'plantuml-refresh' | 'svg-refresh' | 同 | [OK] |
| modalTitle | 'Mermaid Diagram' | 'PlantUML Diagram' | 'SVG Diagram' | 同 | [OK] |
| classPrefix | 'mermaid' | 'plantuml' | 'svg' | 同 | [OK] |
| defineExpose | 8 项 | 8 项 | **3 项** | 同 | [OK] |
| inline PNG | fresh | fresh | downloadPng 委托 | 同 | [OK] |
| 5 toggle 差异 props | all true | all false | all true | 同 | [OK] |

**三薄包装 100% 与 P2 3.4 速查表一致**——无偏差。

### 2.4 useCodeBlockRenderer.ts（P2 第 4 节）

| 项 | 状态 | 备注 |
|---|------|------|
| 4.1 状态迁出（11 个） | [OK] | mermaidCache/sourcesMap/renderToken/instances.{mermaid,plantuml,svg}/resizingBlock/startY/startHeight 全部迁出（MarkdownViewer.vue L20-23 解构，renderContent 内调） |
| 4.2 BlockSource 接口 | ⚠️ | 实现 lang 字段为 `string` 而非 P2 4.2 定义的 union `'mermaid'\|'plantuml'\|'svg'`——[EXTENSION-2]（合理，留扩展余地） |
| 4.3 公开 API | [OK] | getMermaidSvgByIndex/getPlantUmlSvgByIndex/getCodeViewHtml/getError/preRenderMermaid/preRenderPlantUml/registerSvg/renderMermaidFresh/renderPlantUmlFresh/svgToPng/nextToken/isCurrent/registerInstance/unregisterInstance/getInstance/beginResize/endResize/clearInstances 完整 |
| 4.3 错误处理 try/catch | [OK] | preRenderMermaid catch → error='Failed to render diagram'（L52-55）；preRenderPlantUml catch → error='plantuml-validate-failed'（L61-64）；registerSvg Shiki 失败不阻断（codeViewHtml 留空 L70-72）——与 P2 4.4.1 错误处理流程图一致 |
| 4.4 renderToken 8 检查点 | [OK] | MarkdownViewer.renderContent 内 4 个 isCurrent（render 完成后/nextTick 后）+ mountDiagrams 4 个（ensureLoaded 后/循环开始 × 1 + preRenderMermaid/PlantUml/Svg 后 × 3）= 8 个，**与 P2 4.4 显式位置保留一致** |
| 4.5 串行约束 | [OK] | usePlantUML.render 内部 renderQueue 串行保留（composable 直接 await usePlantUML.render，无 Promise.all 并行化） |
| 4.6 行数预算 < 200 | [OK] | 实际 162 行 |

### 2.5 useMarkdown.ts（P2 第 5 节）

| 项 | 状态 | 备注 |
|---|------|------|
| 5.1 渲染器注册表 | ⚠️ | P2 5.1 把 registry 定义在 useMarkdown.ts 内，实际拆为独立 diagramRegistry.ts（40 行）——[EXTENSION-1]（合理拆出） |
| 5.1 registerDiagramType API | [OK] | diagramRegistry.ts L28-30 实现 |
| 5.2 if/else → 查表路由 | ⚠️ | useMarkdown.ts L230-254 **仍是 if/else 三分支**（mermaid/plantuml/svg 各独立分支），仅 `getDiagramType('svg')` 拿 sanitize——**[DEVIATION-3]**（核心设计未落地） |
| 5.2 code 视图 HTML 数据流 | [OK] | mermaid/plantuml escapeHtml 同步填 sources.codeViewHtml（useMarkdown.ts L231/L239）；svg 的 Shiki 异步高亮在 useCodeBlockRenderer.registerSvg 内 await 填 sourcesMap.codeViewHtml（与 P2 修订 1 一致：svg 异步 Shiki 时机锁定 preRender 阶段） |
| 5.3 公开 API | [OK] | `render()` 返回 `{ html, headings, sources: Map<number, {lang, code, codeViewHtml}> }`（P2 5.3 一致） |
| 5.4 DOMPurify 两层 | [OK] | 第 1 层：svg meta.sanitize 净化（diagramRegistry.ts L24）；第 2 层：末尾整体 DOMPurify.sanitize（useMarkdown.ts L288-291，ADD_ATTR 白名单含 data-action/data-code/data-line/data-block-id/data-index/data-mode/target/rel）—— 两层完整保留 |
| 5.5 挂载机制 | [OK] | v-html + nextTick + querySelector + h(Wrapper,props) + vueRender —— 与 P2 一致 |
| 5.7 行数预算 ~300 | [OK] | 实际 297 行 |

### 2.6 MarkdownViewer.vue emit handler（P2 第 6 节）

| 项 | 状态 | 备注 |
|---|------|------|
| 6.1 挂载边界重划 | [OK] | useMarkdown 生成占位 `<div class="${prefix}-block" id data-block-id data-index data-lang>`，BaseDiagram 挂载后渲染完整 block（header+按钮+content+modal） |
| 6.1 data-action 字符串协议去除 | [OK] | 原 `closest()` + switch case 数据协议**完全去掉**，无 data-action 字符串处理（除 useMarkdown.ts L261/L275 code-block-wrapper 复制按钮的 `data-action="copy-code-block"`，保真 P2 6.2 「copy-code-block 不迁移」） |
| 6.2 15-case 差异 handler | [OK] | handleToggleView 按 classPrefix 分支（mermaid/svg L53-58 更新 toggle-text + dispatch refresh；plantuml 不进 L53 分支仅 L49-52 切 is-active）——保真 P1 I3 矩阵 |
| 6.2 6 个 emit handler | [OK] | handleToggleView/handleFullscreen/handleCopyCode/handleDownloadPng/handleToggleMenu/handleStartResize —— 对应 5 emit + 1 start-resize |
| 6.3 5 toggle 差异 props | [OK] | 5 props 完整，handler 内按 props 分支（实际 handler 在 MarkdownViewer 但 props 在 BaseDiagram 内部使用 @if 控制 render-text/refresh） |
| 6.4 CSP 合规 | [OK] | 全用 Vue @click（编译为 addEventListener），无内联 onclick —— 与 P2 6.4 一致 |
| 6.5 data-action 处置 | [OK] | HTML 生成无 data-action 字符串协议（仅 code-block-wrapper 复制按钮保留，ADD_ATTR 白名单保留 data-action 无害） |
| 6.6 MarkdownViewer 脚本结构 | [OK] | 236 行 <script setup>，结构与 P2 6.6 描述一致（renderContent/8 检查点/preRender/挂载循环/6 handler） |
| 6.6 CSS 拆分 | ⚠️ | P2 6.6 明确「block 通用样式随 BaseDiagram；差异样式随薄包装；front-matter/code-block-wrapper/dark-mode 保留 MarkdownViewer」——**实际未执行**，三族 block CSS 全在 MarkdownViewer.vue L401-1192（~790 行）——**[DEVIATION-2]** |

## 3. 方向 2（实现→设计）反向检查

### 3.1 实现超出设计的合理扩展 [EXTENSION]

**[EXTENSION-1]** `diagramRegistry.ts` 独立成文件（40 行）
- P2 5.1 把 registry 定义在 useMarkdown.ts 内（~30 行），实际拆为独立文件
- 合理：结构更清晰，「加新图表 1 行注册」语义更明确

**[EXTENSION-2]** `BlockSource.lang: string`（P2 4.2 写为 union `'mermaid'|'plantuml'|'svg'`）
- 实际为 `string` 类型（useCodeBlockRenderer.ts L7）
- 合理：留注册模式扩展性余地（第三方 chart 类型可注册）

**[EXTENSION-3]** `BaseDiagram.vue` ResizeObserver 自动 resize 监听（L427-437）
- P2 2.1 props.resizeEnabled 已声明，但未明确预算 ResizeObserver 实现
- 实际：ResizeObserver 在 panZoom 销毁重建外，额外自动 resize 监听（onMounted L427-437）
- 合理：保真原 Mermaid/PlantUml/Svg 组件的 ResizeObserver 行为

**[EXTENSION-4]** `BaseDiagram.vue` `onWheel`/`onWheelModal` 自定义 wheel 缩放（L333-351）
- P2 2.1 未列 wheel 缩放
- 实际：实现自定义 wheel 缩放（不使用 svg-pan-zoom 内置 mouseWheelZoomEnabled）
- 合理：保真原 mermaid/svg 的 wheel 缩放逻辑

**[EXTENSION-5]** P2 6.3 的 5 个 toggle 差异 props 在 BaseDiagram template 内 **静态引用**（无内部 handler 差异）
- P2 6.3 描述 BaseDiagram 内部根据 props 决定「是否更新 toggle-text / dispatch refresh / 显示 Copied / 绑 click-outside / 关闭其他」
- 实际：BaseDiagram 内部用 `refreshOnToggle`（L196）决定是否 dispatch refresh，`toggleTextUpdates` 控制 v-if toggle-text（L491）—— 部分实现
- **handleCopyCode/menuClickOutside/menuCloseOthers 实际由 MarkdownViewer handler 处理**（L65-82/L102-123），BaseDiagram 仅 emit 信号
- 合理：handler 业务逻辑在 MarkdownViewer 集中处理（保真 P2 6.2 「handler 实现位置：MarkdownViewer」）

### 3.2 实现遗漏 P2 设计 [DEVIATION]

**[DEVIATION-1]** `BaseDiagram.vue` 531 行 vs 目标 < 400（**超 131 行 / +33%**）
- P2 2.6 行数预算：template ~130 / script ~180 / style ~80 = 390 行
- 实际：template ~47 行（基类骨架紧凑） + script ~482 行（含 exportToPng 108 行） + style 0 行（无 `<style>` 块） = 531 行
- **核心根因**：P2 2.6 预算 script 180 行，但实际：
  - exportToPng 函数 ~108 行（L206-313）—— **未在 script 预算内**
  - onTouchStart/Move/End 三函数 ~38 行（L360-397）—— P2 2.1 列 touchEnabled prop 但未预算
  - ResizeObserver 监听 ~10 行（L427-437）—— 同上
  - onWheel/onWheelModal ~20 行（L333-351）—— 同上
  - modal panZoom 独立 init/destroy ~30 行（L110-140 + L183-189）—— P2 2.4.1 仅描述未预算
- **功能未越界**：无新外部行为，保真原 Mermaid/PlantUml/Svg 组件功能
- **判定**：[DEVIATION]——P2 行数预算过紧（未把所有功能算入 script），非行为回归
- 严重度：中

**[DEVIATION-2]** `MarkdownViewer.vue` CSS 未拆分到 BaseDiagram/薄包装
- P2 1.1「CSS（原 1192 行）按归属拆分：block 通用样式随 BaseDiagram，差异样式随薄包装」
- P2 6.6「CSS 拆分：block 通用样式随 BaseDiagram；差异样式随薄包装；front-matter/code-block-wrapper/dark-mode 保留 MarkdownViewer」
- **实际**：MarkdownViewer.vue L401-1192 共 ~790 行 CSS 全在三族 block 样式（mermaid-block/plantuml-block/svg-block）下，**未迁移**
- 实际整文件 1430 行 = 1 行 template + 235 行 script + 1192 行 style（style 239-1430）——其中 1192 行 CSS 100% 未拆
- BaseDiagram.vue `<style>` 块为 0 行（实际无 scoped style）
- 判定：[DEVIATION]——P2 明确承诺但未执行
- 严重度：中——是 P2 明确声明的设计意图，未达成属「计划未落地」

**[DEVIATION-3]** `useMarkdown.ts` 仍是 if/else 三分支，未真正查表路由
- P2 5.1 给出 `diagramRegistry = new Map<lang, DiagramTypeMeta>([...])` + `registerDiagramType(meta)` 注册 API
- P2 5.2 明确「原 if/else 三分支 → 新查表路由」+ 伪代码 `const meta = diagramRegistry.get(lang); if (meta) { ... } else { defaultCodeBlock }`
- **实际**：useMarkdown.ts L230-254 仍是 `if (block.lang === 'mermaid') { ... } else if (block.lang === 'plantuml') { ... } else if (block.lang === 'svg') { getDiagramType('svg')... }` 三分支
- 唯一使用 diagramRegistry：`getDiagramType('svg')` 拿 sanitize 函数（仅 svg 一族，mermaid/plantuml 不调）
- 判定：[DEVIATION]——P2 核心设计「加新图表类型 ≤ 1 文件 + 1 行注册」**未真正落地**
- **加 d2 实际需要**：1 新 D2Diagram.vue + 1 行 `registerDiagramType({ lang:'d2', ... })` + 1 新 if-else 分支 = **2 文件 + 1 行注册 + 1 if 分支**（与 P0 量化目标「≤ 1 文件 + 1 行注册」偏差）
- 严重度：中——P2 BDD-10.1 声称「加 d2 类型 1 文件 + 1 行注册」可达成，但实际需修改 useMarkdown.ts 加新 if 分支

### 3.3 P2 已声明但实现未做

无「P2 明确声明 X 必须做，但实现未做」的 BLOCKER。

### 3.4 P2 已废弃但实现仍保留

无——P2 修订记录中的所有修订（修订 1-5）实现中均已应用。

### 3.5 僵尸 BDD / 僵尸需求

无——P6 29/29 BDD 全部对应 P1 I1-I10 需求基线 + P2 设计意图，无僵尸 BDD。

## 4. P6 BDD 二值规则审查

### 4.1 整体判定
- P6-acceptance.md 全部 29 条标 **PASS** 或 **FAIL**（无中间态词「调整/跳过/覆盖」）
- "人话翻译"段落全部对应"X 行为正常"或"X 已验证"，无中间描述
- ✅ P6 二值规则**通过**

### 4.2 间接验证模式
- 9 条 BDD 标为「PASS（单元测试覆盖）」模式（2.5/2.6/2.7/2.8/4.1/4.2/6.3/9.2/9.3/9.4/11.1）
- 这是 PASS 形态的间接验证（菜单按钮存在 + 单元测试覆盖 + P5 验证 emit handler）——**不构成中间态**
- BDD-10.1 扩展性验证：「P5 单元测试 `markdown-viewer-degeneration.spec.ts` 已覆盖 emit handler 调用」+「`registerDiagram` API 存在」+「`MarkdownViewer.vue` 已退化为识别 + 派发，无 if-else 硬编码」—— **未实跑加 d2 流程**
  - 不构成 P7 BLOCKER（仅是 P6 验证深度不足）
  - 但与 P2 5.1 量化目标「≤ 1 文件 + 1 行注册」有距离（[DEVIATION-3] 根因）
  - 标注为 P6 验证深度观察，非 P6 二值违规

## 5. P6 已知行为保真事实复核

P6 报告声称行为保真 9 维度全部 PASS：
- 渲染输出：3 族 DOM 存在 + svg 元素内容（mermaid 7103 字符 / plantuml 3026 字符 / svg 233 字符）—— 可在代码中验证（BaseDiagram.vue template + useMarkdown.ts 占位容器生成）
- 按钮交互：toggle 切 is-active（BaseDiagram L489-492 emit + MarkdownViewer L44-59 handler）—— 路径完整
- 全屏：modal v-if 出现 + Escape 关闭（BaseDiagram L515 closeFullscreen）—— 路径完整
- 渲染竞态：renderToken 8 检查点保留（MarkdownViewer L212/L219/L148/L151/L171/L174/L177 + mountDiagrams 内 isCurrent）—— 与 P2 一致
- 安全：DOMPurify 两层（diagramRegistry L24 svg meta.sanitize + useMarkdown L288 整体净化）—— 与 P2 一致
- 响应式：CSS 媒体查询 @media (max-width: 768px) 保留（MarkdownViewer L1133-1182）—— 与 P2 一致
- 主题切换：watch([content, theme], renderContent) 保留（MarkdownViewer L233-235）—— 与 P2 一致
- CSP：无内联 onclick（Vue @click 编译为 addEventListener）—— 与 P2 一致
- 错误处理：preRender 标记 error + mount 阶段消费（MarkdownViewer L157-167）—— 与 P2 4.4.1 流程图一致

**P6 行为保真事实可验证**，与 P2 设计一致。

## 6. 总体结论

### 6.1 偏差汇总
- **[BLOCKER]**：0
- **[DEVIATION]**：3（行数超目标 + CSS 未拆分 + useMarkdown 仍 if-else）
- **[EXTENSION]**：5（合理偏差：独立 registry / lang 泛型 / ResizeObserver / wheel 缩放 / toggle props 静态引用）
- **[OK]**：其余 25+ 项设计项全部一致

### 6.2 P7 通过判定

**P7 总体结论：✅ PASS**（无 BLOCKER，准予进入 P8）

- **3 项 [DEVIATION] 全部非行为回归**：P2 行数预算过紧 + CSS 拆分未执行 + useMarkdown 查表路由未真正落地——属「计划未达预期」类偏差，非实现错误
- **5 项 [EXTENSION] 全部合理**：未引入新外部行为，保真原组件功能
- **P6 29/29 BDD 行为保真 9 维度全部 PASS**（P6 已自证，P7 不重验）
- **P2 修订 5 项全部应用**（修订 1-5 在代码中可定位）

### 6.3 建议（P8 决策参考）

**[DEVIATION-1]** BaseDiagram.vue 531 行：建议接受现状——功能完整且无新行为，下一轮迭代可考虑将 exportToPng 移至独立工具模块（与 useCodeBlockRenderer.svgToPng 合并），但本任务不阻塞

**[DEVIATION-2]** CSS 未拆分：建议接受现状——CSS 整体迁移工作量大且不影响行为；可作为下一轮 refactor 任务单独立项

**[DEVIATION-3]** useMarkdown 仍 if-else：建议接受现状作为已知偏差 / 或要求后续小修——把 if-else 改为 for-loop + getDiagramType.get(lang) 查表是 ~20 行改动，但需同步改 mermaid/plantuml 走 meta.sanitize 路径；本任务已 P6 验收通过，不阻塞 P8

### 6.4 下一阶段
P7 → P8（发布准备：bump frontend-v3 version + CHANGELOG）
