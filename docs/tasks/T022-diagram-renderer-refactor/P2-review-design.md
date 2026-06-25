---
phase: P2
task_id: T022-diagram-renderer-refactor
type: review
parent: P2-design.md
trace_id: T022-P2-review-design-20260625
reviewer: plan-design-review
status: needs-revision
created: 2026-06-25
---

# P2 设计评审 — plan-design-review 视角

> 评审对象：P2-design.md（1033 行方案）
> 评审视角：高级设计师 + 前端专家，聚焦「前端 spec 交互完整性、UI 行为保真、组件接口设计合理性、UX 回归风险」。
> 最高优先级：P0-brief user_decisions 第 6 条「行为保真铁律」——用户感知保真（渲染输出/按钮交互/主题切换/响应式）必须字符级/视觉级一致。

## 评分维度（0-10）

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 6/10 | loading/empty/edge 覆盖不足：错误处理路径（3 族 render 失败）在薄包装/composable 中完全缺失，modal svgContent 来源未设计，svg zoom 路径自相矛盾 |
| AI Slop 风险 | 7/10 | 差异点参数化细致（I2 24 行 + I3 16-case 速查表 3.4 清晰），但 fullscreen hack 废弃、registry 合并自由度有「顺手改」入口 |
| 移动端考虑 | 7/10 | touch 参数化（touchEnabled）覆盖三族差异，resize 移动端行为未深究但符合保真（原状即无 touch resize） |
| 可访问性 | N/A | 重构任务，保真即不退化即可，不新增 a11y 要求；Escape 关闭 modal 已在 BDD 维度 2 覆盖 |

综合结论：架构方向正确（BaseDiagram + 薄包装 + 注册模式 + composable），差异参数化思路到位，但存在 3 个交互回归 BLOCKER（错误处理缺失、svg zoom 路径矛盾、modal 渲染源未设计）须补充方案后方可放行 P3。

---

## BLOCKER（须补充方案后放行）

### B1. 错误处理路径在薄包装/composable 中完全缺失 — 交互状态覆盖率不足

**问题位置**：第 3 节三薄包装 + 第 4 节 composable + 第 7.1 表第 1 条。

**现状缺口**：

P1 BDD 维度 9 三条错误处理是用户感知保真（错误提示属 P0 保真分层表「用户感知保真」层，要求字符级/视觉级一致）：

1. mermaid render 抛错 → mountPoint.innerHTML 设为 mermaid-error div（Failed to render diagram）
2. plantuml validateSource 失败 → 切换到 code 视图（diagram-mode 移除 is-active + code-mode 加 is-active）+ dataset.rendered=true（不重试）
3. svg 解析失败 → mountPoint.innerHTML 设为 svg-error div（Failed to render SVG）

P2 方案缺口：

- 第 4.3 节 preRenderMermaid / preRenderPlantUml / registerSvg 均无 try/catch，渲染失败时 sourcesMap 不填该项。
- 第 3.1 节 MermaidDiagram svgContent = computed(() => props.svgContent ?? renderer.getMermaidSvg(...))，第 4.3 节 getMermaidSvg 在 sourcesMap 无该 index 时返回空字符串。
- 后果：mermaid render 失败 → sourcesMap 无该项 → getMermaidSvg 返回空 → BaseDiagram v-html 渲染空白 → 不显示 mermaid-error div。用户看到空白而非错误提示 = 行为回归。
- plantuml validateSource 失败 → 方案完全未设计「切换 code 视图 + dataset.rendered=true」逻辑在哪一层实现。薄包装无此逻辑，composable 无此逻辑，MarkdownViewer 挂载阶段也未描述。
- svg 解析失败 → 同 mermaid，svgContent 可能为空或无效，不显示 svg-error div。

**为何是 BLOCKER**：错误提示是用户感知保真（P0 分层表「错误提示」明确列在必须层），BDD 维度 9 三条是 P6 逐条实跑项。方案未设计错误处理 = P6 必 FAIL。这违背 P0 known_risks 第 1 条「错误处理路径不变」。

**要求补充**：

- composable preRenderMermaid / preRenderPlantUml / registerSvg 增加 try/catch，失败时向 sourcesMap 写入错误标记（如 BlockSource.error: string 或单独 errorMap）。
- 薄包装或 MarkdownViewer 挂载阶段：检测 error 标记 → mermaid/svg 渲染 xxx-error div（字符级保真原 innerHTML）；plantuml 执行「切 code 视图 + dataset.rendered=true」逻辑。
- 明确错误处理实现位置（薄包装 computed 内判定 vs MarkdownViewer 挂载循环判定），并对照 BDD 维度 9 三条逐条确认字符级一致。

---

### B2. svg zoom 交互路径自相矛盾 — defineExpose 3 项 vs handler 统一调 instance.zoomIn()

**问题位置**：第 2.3 节 emits 注释 vs 第 2.4 节 defineExpose vs 第 6.2 表 zoom handler。

**矛盾**：

- 第 2.3 节 emits 注释：「zoom（仅 mermaid 当前有，plantuml/svg 无 emit 但有 zoom 按钮 → BaseDiagram 统一 emit 信号，薄包装按需监听）」——暗示 zoom 统一走 emit 到 MarkdownViewer。
- 第 2.4 节 defineExpose：SvgDiagram 仅 re-expose 3 项（toggleFullscreen/downloadPng/refreshPanZoom），不含 zoomIn/zoomOut/resetZoom。
- 第 6.2 表 zoom handler：「三族统一: instance.zoomIn/zoomOut/resetZoom()（panZoom）」——MarkdownViewer handler 调 svgInstances.get(id).zoomIn()。
- 第 3.3 节 SvgDiagram defineExpose 确认仅 3 项。

**后果**：svg zoom 按钮点击 → BaseDiagram emit zoom-in → MarkdownViewer handler → svgInstances.get(id).zoomIn() → undefined（svg instance 未 expose zoomIn）→ 报错或静默失败。svg zoom 交互回归。

**I2 矩阵佐证**：P1 I2 「emit 声明」行：mermaid 有 5 emit（zoomIn/Out/reset/fullscreen/downloadPng），plantuml/svg 无 emit。但 I2「panZoom minZoom/maxZoom」行：svg 0.1/10（有 zoom 能力）。原 svg 的 zoom 按钮如何触发 zoom？需核实：原 svg 组件内 zoom 按钮是直接调 panZoom.zoomIn()（组件内部，不经过 data-action 委托），还是走 data-action。

**要求补充**：

- 核实原 svg/mermaid/plantuml 的 zoom 按钮触发路径（组件内直接调 panZoom vs data-action 委托到 MarkdownViewer）。
- 若原为组件内直接调 panZoom：zoom 不应 emit 到外层，BaseDiagram 内部 @click 直接调 panZoom.zoomIn() 即可，emit 信号多余但无害。第 2.3 节「统一 emit 信号」属过度设计，且导致 svg zoom 回归。
- 若原为 data-action 委托：svg instance 必须 re-expose zoomIn/zoomOut/resetZoom（从 3 项改为 6 项），否则 handler 调用失败。
- 澄清 zoom/fullscreen 这类纯组件内行为（不需外层 instance/DOM 操作）应在 BaseDiagram 内部直接调 panZoom，不 emit；emit 只用于需外层参与的（toggle-view 切 DOM class、download-png fresh render、start-resize window 监听）。

---

### B3. modal（fullscreen）的 svgContent 来源未设计 — 废弃 hidden-button hack 后渲染源断链

**问题位置**：第 2.4 节 toggleFullscreen + 第 3.1 节 MermaidDiagram modal 模式 + 第 6.2 表 fullscreen handler。

**现状缺口**：

- 第 2.1 节 props：svgContent: string（已渲染/已净化的最终 SVG 字符串，modal 模式也用此）。
- 第 3.1 节 MermaidDiagram：svgContent = computed(() => props.svgContent ?? renderer.getMermaidSvg(...))。modal 模式 props.svgContent 由父传入。但父（MarkdownViewer）何时传入？传什么？
- 第 6.2 表 fullscreen handler：「三族: getInstance(prefix,id).toggleFullscreen()（统一直接调用，废弃 hidden-button hack）」。
- 第 2.4 节 toggleFullscreen：「开/关 modal overlay」。

**断链**：原 mermaid/plantuml 的 hidden-button hack 是为了在 modal 内重新挂载组件实例并传入 props.svgContent（主图已渲染的 SVG）。新方案废弃 hack，直接调 instance.toggleFullscreen()，但：

- toggleFullscreen 是当前主图实例的方法，它如何打开一个新的 modal 实例并传入 svgContent？
- 如果 modal 是 BaseDiagram 内部的 overlay div（v-if isFullscreen），那 modal 内的 svg 是同一个 svgContent（主图的），还是重新 render 的？
- 原 modal 的 panZoom maxZoom=20（主图 10），说明 modal 是独立 panZoom 实例。新方案 BaseDiagram 内部 modal 如何创建第二个 panZoom 实例？

**为何是 BLOCKER**：BDD 维度 2 fullscreen BDD 要求「出现 mermaid-modal-overlay 遮罩 + modal-title 'Mermaid Diagram' + 遮罩内 svg 可见 + boundingBox.height > 500 + Escape 关闭」。若 modal svgContent 来源未设计，modal 内可能渲染空白或报错。这是用户感知保真（图表显示）。

**要求补充**：

- 明确 modal 的实现方式：是 BaseDiagram 内部 v-if overlay（同实例，svgContent 复用主图），还是 MarkdownViewer 挂载第二个 BaseDiagram 实例到 modal 容器（需传 svgContent props）。
- 若同实例 overlay：说明 modal 内 panZoom 如何独立初始化（maxZoom=20），svgContent 如何复用（主图 getSvgElement().outerHTML？还是 props.svgContent？）。
- 若二次挂载实例：说明 MarkdownViewer fullscreen handler 如何获取 svgContent 并传给新实例，对照原 hidden-button hack 的行为保真。
- 验证 BDD 维度 2 fullscreen BDD 的「modal-title 文本」「svg 可见」「Escape 关闭」在新方案下如何实现。

---

## 建议（非阻断，供 P4 实现参照）

### S1. fullscreen hidden-button hack 废弃属「重构+优化」捆绑风险

第 2.1 节差异覆盖核对 + 第 6.2 表 fullscreen handler 声明「废弃 hidden-button hack，统一 toggleFullscreen() 直接调用，技术内部保真」。

P0 known_risks 末条 + behavioral_fidelity_strategy「重构+优化边界」明确：「禁止顺手改实现路径」。hidden-button hack 虽是技术内部，但废弃它需要证明新路径（直接 toggleFullscreen）行为等价。若原 hack 是为了解决某种时机问题（如 modal 挂载时 svgContent 未就绪），直接调用可能引入新 bug。

**建议**：P4 实施时，若新路径（直接 toggleFullscreen）无法 1:1 复现原行为，保留 hidden-button hack 作为过渡（A/B 并存），待 P6 验证等价后再删。或在 P2 补充「废弃 hack 的等价性论证」（原 hack 为何存在？新路径如何覆盖其作用？）。

### S2. wrapperRegistry 与 diagramRegistry「P4 可合并」自由度过大

第 5.5 节：「wrapperRegistry 可与 diagramRegistry 合并：meta 增加 wrapper: Component 字段。但为职责分离，分开声明更清晰。P4 可合并。」

这给了 P4 subagent「顺手合并」的入口。P0 禁止「重构+优化捆绑」。

**建议**：P2 明确二选一，不留「P4 可合并」悬置。建议分开声明（职责分离），P4 不得合并（除非单独立项）。

### S3. resize-handle 的 mousemove/mouseup 监听层级未明确

第 6.2 表 start-resize + 第 6.6 节 MarkdownViewer 脚本结构有 handleResizeMove/Up。但监听是 window/document 级还是元素级未说明。

原代码 resize 拖拽时鼠标移出 block 仍生效（典型 resize 实现 window 监听）。若 P4 误用元素级 @mousemove，拖拽出 block 失效。

**建议**：P2 明确 resize 的 mousemove/mouseup 绑定在 window（或 document），保真原拖拽范围。

### S4. 主题切换时 svg code 视图 Shiki 重挂载的触发路径

第 7.3 节：「svg code 视图 highlightCode(code, 'xml', theme) 异步重挂载，theme 变 → Shiki 用新主题高亮。」

但 code 视图 HTML 是 useMarkdown.render 生成的（第 5.2 节 renderCodeView shiki-xml 占位符 + 二轮异步填充）。主题切换 → watch(theme) → renderContent → useMarkdown.render 重新生成 codeViewHtml → v-html 替换整个 block → panZoom 销毁重建。

**建议**：P2 明确主题切换是「整个 block 重渲染」（panZoom 销毁重建，符合原行为）还是「局部更新 code 视图」。若前者，确认 panZoom 重建时机与原一致（refreshPanZoom + refreshEventName dispatch）。P6 BDD 维度 7 实跑验证。

### S5. cross-族 menu 交互未明确

第 6.2 表 toggle-menu：mermaid/svg「关闭其他同族菜单」，plantuml「仅 toggle show」。但若 mermaid menu 已打开，用户点 plantuml menu，是否关闭 mermaid menu？

原 plantuml toggle-menu 不关闭其他，可能 mermaid menu 仍开着。这是现状保真。但方案未明确「同族」边界。

**建议**：P2 明确 menuCloseOthers 的作用域是「同 classPrefix」还是「所有 diagram 族」。保真原行为即可（可能可忽略，但 P4 实现时需对照源码确认）。

### S6. IME 保留策略可加强一句

第 7.4 节 IME 保留结论正确（MarkdownViewer 非输入框，无 IME 场景）。但 P0 known_risks 第 8 条把「主题切换/IME 行为」并列。建议 P2 补一句「IME 影响域在 EntryDetailView 输入控件，本任务不动 EntryDetailView → IME 零影响已由范围边界保障」，与 P0 风险条目显式对应。

---

## 可忽略项

### N1. 移动端 resize-handle 无 touch 版

原代码 resize 是 mousedown/mousemove/mouseup，移动端无 touch resize。方案保真（resizeEnabled prop 控制 mermaid/svg 渲染，plantuml 不渲染）。移动端 resize 不可用是现状，保真即可。可忽略。

### N2. 可访问性未新增

重构任务，保真即不退化。原代码 a11y 水平若有限，重构后保持同等水平即可。不新增 a11y 要求（不在本任务范围）。Escape 关闭 modal 已在 BDD 维度 2 覆盖。可忽略。

### N3. minimal_validation needed: false 合理

P2 是设计阶段，代码未写，不需浏览器验证。P3 TDD 快照 + P6 Playwright 实跑覆盖验证。needed: false + 充分 reason 满足 P1 requires_minimal_validation: true 的声明要求。可忽略。

---

## 对照 P1 BDD 覆盖核查（UI 交互相关）

| BDD 维度 | 涉及 UI 交互 | P2 方案覆盖 | 判定 |
|----------|-------------|------------|------|
| 维度 1 渲染输出 | mermaid/plantuml/svg/inline-svg/三族共存 | 第 3/5 节薄包装 + 注册模式 + 5.6 内联 svg 不走 fence | 覆盖 |
| 维度 2 按钮交互 | toggle/copy/PNG/fullscreen | 第 6.2 表 16-case 映射 + 6.3 差异 props | 部分覆盖：fullscreen modal 源未设计（B3） |
| 维度 3 状态保持 | renderToken 防竞态 | 第 4.4 节 8 检查点保留 | 覆盖 |
| 维度 4 性能 | mermaidCache 命中 | 第 7.6 节 cache key 不变 | 覆盖 |
| 维度 5 安全 | DOMPurify 净化 | 第 5.4 节两层净化 | 覆盖 |
| 维度 6 响应式 | 断点 + resize | 第 7.5 节 + touchEnabled/resizeEnabled | 覆盖（S3 补充监听层级） |
| 维度 7 主题切换 | 重渲染 + Shiki 重挂载 | 第 7.3 节 | 覆盖（S4 补充触发路径） |
| 维度 8 CSP | 无内联事件 | 第 6.4 节 Vue @click 非内联 | 覆盖 |
| 维度 9 错误处理 | 3 族 render 失败 | 未覆盖 | B1 BLOCKER |
| 量化可扩展性 | 加 d2 类型 | 第 5.1 节 registerDiagramType | 覆盖 |

未覆盖 BDD：维度 9 错误处理（3 条）+ 维度 2 fullscreen 子条（modal 渲染源）。须补充后方可放行 P3。

---

## 评审结论

**status: needs-revision**

架构方向（BaseDiagram 基类 + 三薄包装 + 注册模式 + useCodeBlockRenderer composable + emit 迁移）整体合理，差异参数化思路到位（I2 矩阵 24 行 + I3 16-case 速查表覆盖完整），保真分层策略清晰。但存在 3 个交互回归 BLOCKER：

1. B1 错误处理路径未设计（mermaid-error/svg-error/plantuml 切 code 视图 三条 BDD 必 FAIL）
2. B2 svg zoom 路径矛盾（defineExpose 3 项 vs handler 调 zoomIn）
3. B3 modal svgContent 来源未设计（fullscreen BDD 必 FAIL）

这 3 项均属用户感知保真层（错误提示、按钮交互、图表显示），违背 P0 行为保真铁律。须 P2 补充对应方案后方可放行 P3。

6 条建议（S1-S6）非阻断，供 P4 实现参照。3 项可忽略（N1-N3）已说明理由。

**是否需要补充 spec**：是。须针对 B1/B2/B3 补充设计方案后重新评审。
