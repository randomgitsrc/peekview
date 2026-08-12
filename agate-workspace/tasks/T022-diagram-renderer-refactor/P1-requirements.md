---
phase: P1
task_id: T022-diagram-renderer-refactor
type: problems
parent: P0-brief.md
trace_id: T022-P1-20260625
status: draft
created: 2026-06-25
---

# P1 需求基线 — T022 diagram-renderer-refactor

## 需求复述

将 Markdown 渲染管线（`MarkdownViewer.vue` 1989 行 [脚本 L1-795 + CSS L797-1989] + `MermaidDiagram.vue` 598 + `PlantUmlDiagram.vue` 416 + `SvgDiagram.vue` 478 + `useMarkdown.ts` 372，共 ~3500 行）重构为可扩展的注册模式，达成四个子目标：

1. **三胞胎抽 `BaseDiagram.vue`**：zoom / fullscreen / pan / PNG 导出骨架集中到基类，Mermaid/PlantUML/SVG 子组件退化为薄包装（< 150 行/个），仅提供渲染源和差异点。
2. **`useMarkdown` 改为渲染器注册模式**：识别 fenced code block 后查表路由，不再显式 `if (lang === 'mermaid')` / `if (lang === 'plantuml')` / `if (lang === 'svg')` 三分支。
3. **渲染状态抽到 composable**（`useCodeBlockRenderer`）：`mermaidCache` / `plantumlSourcesMap` / `svgSourcesMap` / `renderToken` / `*Instances` 等从 `MarkdownViewer` 迁出，MarkdownViewer 退化为"识别 + 派发"（脚本目标 < 300 行）。
4. **事件委托迁移到 emit**：去掉 `data-action` 字符串协议 + `closest()` + `switch case`（当前 16 case），子组件用标准 Vue `emit` / `defineExpose` 通讯。

**量化验收**（P0 定义）：加一种新图表类型 ≤ 1 个新文件 + 1 行注册调用。

**行为保真铁律（最高优先级）**：重构后所有用户可见行为（渲染输出、按钮交互、状态、性能、安全、响应式、主题切换、CSP、错误处理）逐项与重构前一致，不允许任何"等价改写"。任何 subagent 自我报告"应该等价"不构成证据。

> 保真分层（P0 behavioral_fidelity_strategy）：
> - **用户感知保真（必须）**：渲染 HTML 字符级、按钮交互、图表显示、主题切换、状态保留、错误提示 → 字符级/视觉级一致。
> - **技术内部保真（不破坏外部行为即可）**：cache 键格式、算法路径、文件拆分、类名、变量名、CSS class → 内部可自由调整。
>
> 「重构 + 优化」捆绑禁止（P0 known_risks 末条）：一次只做一件事。要嘛只重构（结构变行为不变），要嘛只优化。本任务只做前者。

## 隐含需求识别

### I1. useMarkdown 公开 API 兼容性（下游消费者依赖）

当前签名 `useMarkdown().render(content, theme): Promise<{ html, headings, mermaidSources, plantumlSources, svgSources }>`（useMarkdown.ts L66-368）。下游消费者：
- `MarkdownViewer.vue` L386 调用 `render()`，消费 `result.html` / `result.headings` / `result.mermaidSources` / `result.plantumlSources` / `result.svgSources`。
- `EntryDetailView.vue` L136 传 `:content` prop 给 `MarkdownViewer`，并通过 `emit('headings')` + `<slot name="toc" :headings>` 接收标题（MarkdownViewer L3、L393）。

**为什么必须**：P0 路线 B 明确"不强求统一 Block 协议""不做过度抽象"，且范围声明"动 EntryDetailView 主体"为不做项。若 `render()` 返回值结构变化（如合并三 Map 为通用 `sources`），MarkdownViewer 内部消费方须同步改，但 EntryDetailView 调用面（`:content` 输入 + `headings` slot/emit 输出）不可破坏。

**P1 判定**：这是"技术内部保真"层——`render()` 返回的 Map 结构可改（内部），但 `content` 输入契约 + `headings` slot/emit 输出契约不可变（外部）。P2 设计须声明：若改 `render()` 返回结构，则 MarkdownViewer 是唯一消费者，同步改即可，不触及 EntryDetailView。

### I2. 三胞胎差异矩阵（15% 差异点，P2 设计的硬输入）

三组件虽 85% 重复，但 15% 差异**必须精准参数化**。漏掉任一项 → 对应图表类型回归。以下矩阵基于源码逐行核对：

| 差异维度 | Mermaid | PlantUML | SVG |
|---|---|---|---|
| **渲染源** | `useMermaid.render(id, code, theme)` → mermaid 库；securityLevel:'strict'；5s timeout | `usePlantUML.render(code, theme)` → vendor plantuml.js；**模块级 renderQueue 串行**；validateSource(@start/@end)；MutationObserver | 用户原始 svg 源码（无渲染器），**DOMPurify.sanitize 净化后才传组件**（T020 安全债） |
| **代码视图高亮** | `escapeHtml` 同步转义，**无 Shiki 高亮** | `escapeHtml` 同步转义，**无 Shiki 高亮** | `highlightCode(code, 'xml', theme)` **异步 Shiki 高亮**（useMarkdown L324） |
| **panZoom init 容错** | 无 try-catch（失败抛错） | 无 try-catch | **有 try-catch**（console.warn + panZoomInstance=null） |
| **modal panZoom init 容错** | 无 try-catch | 无 try-catch | **有 try-catch** |
| **panZoom minZoom/maxZoom** | 0.1 / 10 | 0.1 / 10 | 0.1 / 10 |
| **modal minZoom/maxZoom** | 0.1 / **20** | 0.1 / **20** | 0.1 / **20** |
| **inline PNG 导出路径** | MarkdownViewer 内 `downloadMermaidPng` **重新 mermaid.render fresh SVG**（非用挂载组件） | MarkdownViewer 内 `downloadPlantUmlPng` **重新 usePlantUML.render fresh SVG** | MarkdownViewer `downloadSvgPng` **委托 svgInstances.get(id).downloadPng() 组件方法** |
| **modal PNG 导出路径** | 组件 `exportMermaidToPng` 用 props.svgContent | 组件 `exportPlantUmlToPng` 用 props.svgContent | 组件 `exportSvgToPng` 用 props.svgContent |
| **PNG 背景** | `fillRect('#ffffff')` 白底 | `fillRect('#ffffff')` 白底 | **不调 fillRect**，透明背景 alpha=0 |
| **PNG viewBox 尺寸** | parts[2]+20 / parts[3]+20 | parts[2]+20 / parts[3]+20 | parts[2]+20 / parts[3]+20 |
| **PNG fallback 1** | `g.root` getBBox()（tempDiv 注入）—— mermaid 专有 | svgEl width/height 属性 | svgEl width/height 属性 |
| **PNG 最终 fallback** | 800×600 | 800×600 | **400×300** |
| **PNG `<br>` 修复** | `<br>` → `<br/>`（mermaid 输出特性） | 无 | 无 |
| **resize-handle** | 有（`mermaid-resize-handle`，支持拖拽改高 min 200） | **无** | 有（`svg-resize-handle`） |
| **touch 处理** | 有（pinch zoom + drag pan，passive:false） | **无**（无 touchstart/move/end） | 有（pinch zoom + drag pan） |
| **refresh 事件名** | `mermaid-refresh` CustomEvent | `plantuml-refresh` CustomEvent | `svg-refresh` CustomEvent |
| **fullscreen 触发机制** | hidden-button-click hack（`mermaidInstances` 存 toggleFullscreen 闭包点击隐藏按钮） | hidden-button-click hack（`plantumlInstances` 同） | **直接 `component.exposed.toggleFullscreen()`**（svgInstances 存真实实例） |
| **defineExpose 集** | 8 项（zoomIn/zoomOut/resetZoom/toggleFullscreen/refreshPanZoom/getSvgElement/downloadPng/exportMermaidToPng） | 8 项（同结构，exportPlantUmlToPng） | **3 项**（toggleFullscreen/downloadPng/refreshPanZoom，无 zoomIn/Out/reset/getSvgElement/export） |
| **emit 声明** | 有（zoomIn/zoomOut/reset/fullscreen/downloadPng 5 事件，zoom 函数内调 emit） | **无 emit** | **无 emit** |
| **modal title** | "Mermaid Diagram" | "PlantUML Diagram" | "SVG Diagram" |
| **PNG 文件名** | `mermaid-diagram-{id}.png` | `plantuml-diagram-{id}.png` | `svg-diagram-{id}.png` |
| **渲染错误处理** | `mountPoint.innerHTML = '<div class="mermaid-error">…</div>'` | **切换到 code 模式**（移除 diagram is-active + 加 code is-active）+ dataset.rendered=true | `mountPoint.innerHTML = '<div class="svg-error">…</div>'` |
| **header label 文本** | "MERMAID" | "PLANTUML" | "SVG" |
| **block CSS class 前缀** | `mermaid-` | `plantuml-` | `svg-` |

### I3. MarkdownViewer 内 16 个 data-action handler 的行为差异（不能一刀切迁移）

事件委托 `handleDelegatedAction`（L340-363）的 switch 有 16 case，但同族 handler 行为**不一致**：

| handler 族 | mermaid | plantuml | svg |
|---|---|---|---|
| **toggle-view** | toggle is-active + 更新 toggle-text('Diagram'/'Code') + dispatch `mermaid-refresh` 事件 + 用 `document.getElementById` | **仅 toggle is-active，无 refresh 事件，无 toggle-text 更新** | toggle is-active + 更新 toggle-text + dispatch `svg-refresh` + 用 `contentRef.value.querySelector`（非 getElementById） |
| **toggle-menu** | 关闭其他 mermaid 菜单 + toggle show + click-outside 监听 | **仅 toggle show，无关闭其他，无 click-outside** | 关闭其他 svg 菜单 + toggle show + click-outside |
| **copy-code** | clipboard + `✓ Copied!` UI 反馈（menu 末按钮 2s） | clipboard + **仅 console.log，无 UI 反馈** | clipboard + `✓ Copied!` UI 反馈 |
| **download-png** | MarkdownViewer 内 re-render fresh | MarkdownViewer 内 re-render fresh | 委托组件 `downloadPng()` |
| **open-fullscreen** | `mermaidInstances.get(id).toggleFullscreen()`（闭包 hack） | `plantumlInstances.get(id).toggleFullscreen()` | `svgInstances.get(id).toggleFullscreen()`（真实实例） |
| **start-resize** | 有（mousedown → mousemove/mouseup） | **无 resize handler** | 有 |

**为什么必须**：迁移到 emit 时，若 P4 把三族 handler 统一为相同行为（如都加 refresh 事件 / 都加 click-outside），会**改变 plantuml 的现有行为** → 行为回归。P0 铁律：plantuml 当前"无 refresh、无 toggle-text、无 click-outside、copy 无反馈"是**现状**，重构后须保持这个现状（哪怕它看起来是 bug，也不在本次修）。

### I4. renderToken 防竞态迁移边界条件

`renderToken`（L38）在 `renderContent` 中 `++renderToken` 生成 token，在 8 个 async 边界后检查 `if (myToken !== renderToken) return`（L387/396/414/416/484/489/500/539）。覆盖场景：主题切换时旧渲染未完成被新渲染覆盖；内容更新时同理。

**为什么必须**：状态抽到 composable 时，token 检查点必须保留在每个 async 边界后。若 composable 把 renderMermaid/renderPlantUML/renderSvg 封装成不透明调用，检查点可能丢失 → 主题快速切换时出现旧 SVG 覆盖新 SVG（竞态回归）。P2 设计须明确 composable 暴露的 render 函数仍返回可中断的 token 语义。

### I5. PlantUML 串行约束保留

`usePlantUML.render` 用模块级 `renderQueue: Promise<unknown>` 链（L13、L62-72）保证串行——plantuml.js 共享内部状态，并发调用静默覆盖。

**为什么必须**：重构若把渲染调度移入 composable 且误用 `Promise.all` 并行化 → plantuml 图表静默错乱。P2 须声明：PlantUML 渲染调用路径不变（仍走 usePlantUML.render 的串行队列）。

### I6. 挂载机制 h()+vueRender 与 dataset.rendered 去重

当前用 `h(Component, props)` + `vueRender(vNode, mountPoint)` 手动挂载到 `.xxx-viewer-mount`，用 `dataset.rendered='true'` 防重复渲染，重渲染前 `delete dataset.rendered`（L401-410）。

**为什么必须**：迁移到 emit / 注册模式后，若改用 `<component :is>` 模板挂载，挂载时机会变（v-html 渲染 HTML → 再挂载组件的两阶段流程可能被合并），导致 mountPoint 不存在时挂载失败。P2 须明确保留"先 v-html 占位 → nextTick → 查 mountPoint → 挂载组件"的两阶段流程，或证明新流程等价。

### I7. CSS 迁移（1192 行样式）

MarkdownViewer.vue 含 1192 行 CSS（L797-1989），覆盖三族 block 样式（`.mermaid-block` / `.plantuml-block` / `.svg-block` 镜像结构）+ code-block-wrapper + front-matter + dark mode 覆写。

**为什么必须**：P0 目标 MarkdownViewer < 300 行（含 CSS 不现实）。CSS 须随组件拆分迁移到 BaseDiagram / 子组件 / 保留在 MarkdownViewer（front-matter / code-block / dark-mode 部分）。这是 P0"不做"清单未提及但技术必须的隐含项。P2 须声明 CSS 拆分归属。

### I8. 内联 svg 不走代码块管线

`SvgBlock.spec.ts` TC-10 断言：markdown 中的内联 svg（非 ` ```svg ` 围栏）走 markdown inline html，**不产生** `.svg-block` 容器。useMarkdown 的 fence renderer 只在 `lang === 'svg'` 时走 svg 分支。

**为什么必须**：注册模式重构后，路由判定仍基于 fenced code block 的 lang，不能误把内联 svg 也路由到 SvgDiagram。这是用户感知保真（内联 svg 渲染不变）。

### I9. T021 时序约束已解除

P0 coordination 称"T021 P4 完成后再启本任务 P4"。经核实 T021（zen-mode）已 DONE 发布（v0.1.67），EntryDetailView 头部/侧栏改动已合入。本任务 P4 可直接启动，无并发冲突。但须复核：T021 是否改动了 MarkdownViewer 的调用方式（`:headings` / `@select-heading`）——已确认现状为 EntryDetailView L136-141，重构须对此现状保真。

### I10. T020 复盘教训（标注供后续阶段）

- **P3 subagent 空返回**：T020 P3 经历 3 次 subagent 空返回（Vue 组件测试过重）。本任务 P3 须拆分：纯函数单测（composable 逻辑）优先，组件集成测试后置，避免单 test file 过重。
- **P6 PAUSED 重验**：T020 P6 第一轮 subagent 报告存疑被 PAUSED。本任务 P6 须主 Agent 亲自跑 Playwright，不接受 subagent PASS 报告作 gate 证据。
- **SvgBlock.spec 依赖 data-action**：当前单测断言 `[data-action="toggle-svg-view"]`（L139）。迁移到 emit 后此选择器失效 → P3 须同步更新测试。

## BDD 验收条件

> 每条 Given/When/Then 可二值判定（PASS/FAIL），覆盖行为保真验收清单 9 维度。P6 逐条实跑。
> 环境约定：debug backend `http://127.0.0.1:8888`（PEEKVIEW_DEBUG_MODE=1，数据目录 `/tmp/peekview-debug/`）。测试 entry 通过 debug backend HTTP API 创建。

### 维度 1：渲染输出（字符级一致）

```gherkin
Given markdown 内容含 ` ```mermaid\ngraph LR; A-->B\n``` ` 围栏块
When  MarkdownViewer 完成异步渲染
Then  DOM 中存在 class 含 "mermaid-block" 的元素
And   该元素内存在 class 含 "mermaid-viewer-mount" 的挂载点
And   挂载点内存在 <svg> 元素（mermaid 已渲染）
And   存在 class 含 "mermaid-content" 且 data-mode="diagram" 且 class 含 "is-active" 的元素（默认图形视图）
And   存在 class 含 "mermaid-content" 且 data-mode="code" 且 class 不含 "is-active" 的元素（代码视图默认隐藏）
```

```gherkin
Given markdown 内容含 ` ```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>\n``` ` 围栏块
When  MarkdownViewer 完成异步渲染
Then  DOM 中存在 class 含 "svg-block" 的元素
And   存在 class 含 "svg-label" 且文本内容为 "SVG" 的元素
And   存在 class 含 "svg-view-toggle" 且 data-action="toggle-svg-view" 的按钮（或等价 emit 触发元素）
And   围栏 svg 代码经 DOMPurify 净化后传入 SvgDiagram（svgContent prop 不含 "<script>" 不含 "onclick" 不含 "foreignObject"）
```

```gherkin
Given markdown 内容含内联 svg（非围栏，如 "text <svg>...</svg> more"）
When  MarkdownViewer 完成渲染
Then  DOM 中不存在 class 含 "svg-block" 的元素（内联 svg 走 inline html，不进代码块管线）
```

```gherkin
Given markdown 内容含 ` ```plantuml\n@startuml\nBob -> Alice : hello\n@enduml\n``` ` 围栏块
When  MarkdownViewer 完成异步渲染
Then  DOM 中存在 class 含 "plantuml-block" 的元素
And   存在 class 含 "plantuml-label" 且文本为 "PLANTUML" 的元素
And   plantuml 渲染串行执行（第二个 plantuml 块的渲染在第一个完成后才开始，无并发覆盖）
```

```gherkin
Given markdown 内容同时含 mermaid / plantuml / svg 三个围栏块
When  MarkdownViewer 完成异步渲染
Then  DOM 中分别存在 .mermaid-block / .plantuml-block / .svg-block 三个独立容器（三族共存互不干扰）
```

### 维度 2：按钮交互（toggle / copy / PNG / fullscreen）

```gherkin
Given 已渲染的 mermaid block 处于 diagram 视图（diagram-mode is-active）
When  点击 data-action="toggle-mermaid-view" 的按钮（或等价 emit 事件）
Then  class "mermaid-content[data-mode='code']" 获得 "is-active"
And   class "mermaid-content[data-mode='diagram']" 失去 "is-active"
And   toggle 按钮内 class "toggle-text" 的文本变为 "Code"
When  再次点击同一按钮
Then  diagram-mode 重新获得 "is-active"，code-mode 失去 "is-active"
And   toggle-text 文本变回 "Diagram"
And   切回 diagram 时向 .mermaid-viewer 派发 "mermaid-refresh" CustomEvent（触发 panZoom 重新初始化）
```

```gherkin
Given 已渲染的 plantuml block 处于 diagram 视图
When  点击 toggle-plantuml-view 按钮
Then  diagram-mode 与 code-mode 的 is-active 互换
And   （plantuml 现状）不派发 refresh 事件
And   （plantuml 现状）toggle-text 不更新文本（保持现状=保真）
```

```gherkin
Given 已渲染的 mermaid block 的下拉菜单
When  点击 "copy-mermaid-code" 按钮
Then  剪贴板内容等于该 block 的原始 mermaid 源码
And   下拉菜单末按钮文本变为 "✓ Copied!" 持续 2 秒后恢复
```

```gherkin
Given 已渲染的 plantuml block 的下拉菜单
When  点击 "copy-plantuml-code" 按钮
Then  剪贴板内容等于该 block 的原始 plantuml 源码
And   （plantuml 现状）无 "✓ Copied!" UI 反馈，仅 console.log（保持现状=保真）
```

```gherkin
Given 已渲染的 svg block 处于 diagram 视图
When  点击 download-svg-png 按钮
Then  浏览器触发文件下载，文件名匹配 /svg-diagram-.*\.png/
And   下载的文件是有效 PNG（首 8 字节为 89 50 4E 47 0D 0A 1A 0A）
And   PNG 背景为透明（canvas 未调用 fillRect，alpha=0）
```

```gherkin
Given 已渲染的 mermaid block
When  点击 download-mermaid-png 按钮（header 下拉菜单内）
Then  触发文件下载，文件名匹配 /mermaid-diagram-.*\.png/
And   PNG 为有效 PNG
And   PNG 背景为白色（canvas 调用 fillRect('#ffffff')）
And   下载前重新 mermaid.render 生成 fresh SVG（非用挂载 DOM 的 svg）
```

```gherkin
Given 已渲染的 mermaid block
When  点击 fullscreen 按钮（data-action="open-mermaid-fullscreen"）
Then  出现 class 含 "mermaid-modal-overlay" 的全屏遮罩
And   遮罩内存在 class "mermaid-modal" 且含 modal-title 文本 "Mermaid Diagram"
And   遮罩内 <svg> 可见且 boundingBox.height > 500
When  按下 Escape 键或点击关闭按钮
Then  全屏遮罩消失
```

### 维度 3：状态保持（防竞态 / 文件树 / TOC / 滚动）

```gherkin
Given MarkdownViewer 正在渲染 mermaid 块（异步进行中）
When  在渲染完成前切换主题（触发新一轮 renderContent）
Then  旧渲染的 renderToken 与新 token 不符，旧渲染在中途 return 不写入 DOM
And   最终 DOM 展示的是新主题对应的渲染结果（无旧 SVG 覆盖新 SVG 的竞态）
```

```gherkin
Given 用户在 EntryDetailView 展开了文件树某节点 / 滚动了 TOC / 记录了阅读进度
When  MarkdownViewer 内部完成重构渲染（不重新挂载 EntryDetailView 主体）
Then  文件树展开状态 / TOC 滚动位置 / 阅读进度保持不变（重构不动 EntryDetailView 主体）
```

### 维度 4：性能（不退化）

```gherkin
Given 同一份含 3 个 mermaid 块的 markdown 内容
When  首次渲染（mermaidCache 为空）
Then  渲染完成后 mermaidCache 中存在对应 cache 条目（key 格式 `${theme}-${code}`）
When  切换主题再切回原主题
Then  mermaid 块命中 cache 未重新调用 mermaid.render（缓存命中率不降）
```

```gherkin
Given 含 mermaid 块的页面首屏
When  从页面加载到 .mermaid-block 内 <svg> 可见
Then  耗时不显著高于重构前基线（P3 录制重构前首屏时间作红线，P5 对比不退化）
```

### 维度 5：安全（T020 XSS 净化保留）

```gherkin
Given svg 围栏块源码含 `<script>alert(1)</script>`
When  useMarkdown.render 处理该块并经 DOMPurify 净化后传入 SvgDiagram
Then  svgContent 中不含 "<script>"
And   不含 "alert(1)"
```

```gherkin
Given svg 围栏块源码含 `onclick="alert(1)"` 属性
When  经 DOMPurify 净化
Then  svgContent 中不含 "onclick"
And   保留合法 svg 元素（circle/path/rect/text/g 仍在）
```

```gherkin
Given svg 围栏块源码含 <foreignObject>
When  经 DOMPurify 净化
Then  svgContent 中不含 "foreignObject"（大小写不敏感）
```

```gherkin
Given useMarkdown.render 输出的完整 HTML
When  经 useMarkdown 内 DOMPurify.sanitize（L363）
Then  输出 HTML 合规 CSP（不含内联 onclick/onload 等事件处理器，data-action 等 ADD_ATTR 白名单属性保留）
```

### 维度 6：响应式（断点 / 移动端）

```gherkin
Given 视口宽度 > 768px 的桌面端，已渲染 mermaid block
When  调整窗口至 ≤ 768px
Then  .mermaid-header padding 变为 6px 10px
And   .mermaid-view-toggle 的 .toggle-text 隐藏（仅显图标）
And   .mermaid-action-btn 尺寸变为 26×26
And   .mermaid-content min-height 变为 150px
```

```gherkin
Given mermaid/svg block 有 resize-handle
When  在桌面端 mousedown 拖拽 resize-handle
Then  对应 .xxx-content[data-mode="diagram"] 高度随鼠标变化（最小 200px）
And   拖拽期间 maxHeight 设为 none
When  mouseup
Then  高度固定，cursor 恢复
```

### 维度 7：主题切换（重渲染 / IME）

```gherkin
Given 已渲染 mermaid 块（light 主题），mermaidCache 含 light 主题 SVG
When  切换到 dark 主题
Then  watch([content, theme]) 触发 renderContent
And   mermaid 重新 render 生成 dark 主题 SVG（cache key 含 theme）
And   SVG 重新挂载，panZoom 重新初始化
And   dark 模式 CSS 覆写生效（.markdown-body 背景 #0d1117 等）
```

```gherkin
Given svg 围栏块的 code 视图（data-mode="code" is-active）
When  切换主题
Then  code 视图 Shiki 高亮重新挂载（highlightCode 用新 theme）
```

### 维度 8：CSP 合规

```gherkin
Given 重构后的事件通讯改为 Vue emit（去除 data-action 字符串协议）
When  检查渲染输出的 HTML 与运行时行为
Then  不引入新的内联事件处理器（无 onclick="" / onload="" 等内联属性）
And   主应用 CSP `script-src 'self' 'unsafe-eval'` 不违规
And   现有 data-action 属性若保留在 HTML 中，仍属 DOMPurify ADD_ATTR 白名单（不破坏净化）
```

### 维度 9：错误处理（路径不变）

```gherkin
Given mermaid 源码语法错误导致 mermaid.render 抛错
When  renderMermaidDiagrams 捕获异常
Then  mountPoint.innerHTML 设为 '<div class="mermaid-error">Failed to render diagram</div>'
```

```gherkin
Given plantuml 源码缺少 @startuml/@enduml（validateSource 失败）导致渲染抛错
When  renderPlantUmlDiagrams 捕获异常
Then  切换到 code 视图（diagram-mode 移除 is-active，code-mode 加 is-active）
And   dataset.rendered 设为 true（不重试）
```

```gherkin
Given svg 源码解析失败
When  renderSvgBlocks 捕获异常
Then  mountPoint.innerHTML 设为 '<div class="svg-error">Failed to render SVG</div>'
```

### 量化可扩展性验收

```gherkin
Given 重构完成后的代码库
When  要新增一种图表类型（如 "d2"）
Then  只需新增 1 个文件（如 D2Diagram.vue 或注册项）+ 1 行注册调用
And   不需修改 BaseDiagram.vue / useCodeBlockRenderer.ts / MarkdownViewer.vue 的核心逻辑
```

## 待确认清单

无。

user_decisions 已确认（路线 B + 状态 composable 化、仅 Markdown 管线、不过度抽象、T020 安全债硬约束、可扩展性量化、行为保真铁律）。三胞胎差异矩阵已逐行核对源码识别完整。能力需求见下节（supplementable，非 GAP）。T021 时序约束已解除。所有隐含需求均有明确技术判定方向，不涉及业务方向选择。

## 裁剪说明

**全阶段保留，不裁剪。** 与 P0-brief `pruning_tendency` 一致。

`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`

理由（逐阶段）：
- **P1**（本阶段）：5+ 文件结构重组 + 状态迁移 + API 兼容性分析 + 三胞胎差异矩阵，必须建需求基线。
- **P2**：方案不明确（composable 边界、注册表设计、CSS 拆分归属、emit 事件契约设计均需 architect 出方案），不可跳。
- **P3**：默认保留。涉及 140 个单元测试 + BDD 红线基线，重构前须先跑绿作红线 + 加快照测试。T020 教训：subagent 抗不住重 Vue 测试，须拆分纯函数单测优先。
- **P4**：实现主体，不可跳。
- **P5**：140 单测全绿 + BDD 全绿 + 视觉对比 + 性能基线对比，不可跳。
- **P6**：行为保真硬约束（用户最高优先级），须主 Agent 亲自 Playwright 验收 9 维度。涉及安全（XSS）改动不可跳 P6。T020 教训：subagent PASS 不可信，须重验。
- **P7**：多文件改动（5+ 文件结构重组 + CSS 迁移），一致性检查不可跳。
- **P8**：前端构建 + 发版准备（双包发布需评估是否含前端 dist），必做。

`single_agent_mode: false`（has_task_tool: true）

## 范围声明

引用 P0-brief 范围声明，P1 复核确认：

**本任务做**：
- `BaseDiagram.vue` 基类组件（zoom/fullscreen/pan/PNG 导出骨架）
- 三个 Diagram 子组件改写为薄包装（< 150 行/个）
- `useMarkdown` 改为渲染器注册模式（fenced code block + 查表路由）
- 新增 `useCodeBlockRenderer` composable（托管 mermaidCache / sourcesMap / renderToken / instances）
- MarkdownViewer 退化为薄组件（脚本目标 < 300 行）
- 事件委托迁移到 Vue emit，去掉 data-action 字符串协议
- 全部现有测试保留 + 新增针对性测试
- 行为保真硬约束：重构前后 9 维度逐项一致

**本任务不做**：
- 统一 Block 协议（不过度设计）
- 动 `EntryDetailView.vue` 主体（仅 MarkdownViewer 引用接口变化时最小化调整调用方，且 `:content` 输入 + `headings` slot/emit 输出契约不可破坏）
- 动 backend / MCP / CLI（纯前端重构）
- 改 API 行为（语义不变）
- 引入新第三方依赖（用现有 vue / svg-pan-zoom / mermaid / plantuml / shiki / DOMPurify）
- 换 markdown 渲染库（保留 markdown-it）

**packages**: `frontend-v3`（前端单包）
**domains**: `frontend`
**ui_affected**: `true`（MarkdownViewer / 3 Diagram 组件 / 新增 BaseDiagram + composable，用户可见渲染区域结构变更）
**requires_minimal_validation**: `true`（行为保真需浏览器视觉验证，P2 architect 须产出 `minimal_validation` 块）

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 截图验证渲染输出、toggle 交互、fullscreen modal、主题切换视觉一致性（9 维度行为保真）
    available:
      - vision-analyst（agate 内置执行角色，首选）
      - playwright-cdp skill（已注入，Chrome CDP :18800，作为补充）
    status: available

  - need: frontend-unit-test
    why: P3/P5 须跑 vitest 140 单测 + 新增测试，确认红线基线与全绿
    available:
      - 本地运行时（backend/.venv + frontend-v3/node_modules，env_constraints 已声明 `cd frontend-v3 && ./node_modules/.bin/vitest run`）
    status: available

  - need: e2e-playwright
    why: P6 须跑 Playwright BDD（mermaid.spec / png-download.spec / viewer.spec），需 debug backend 运行
    available:
      - make debug-test（env_constraints 已声明，需 debug backend 运行在 :8888）
    status: available
```

三态判定：全部 `available`，无能力缺口。浏览器视觉验证虽主力模型自身不直接具备，但环境中 playwright-cdp skill + Chrome CDP:18800 提供补充路径 → `available`（非 supplementable，因 skill 已注入可直接调用）。
