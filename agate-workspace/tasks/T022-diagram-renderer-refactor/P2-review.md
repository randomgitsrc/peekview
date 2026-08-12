---
phase: P2
task_id: T022-diagram-renderer-refactor
type: review
parent: P2-design.md
trace_id: T022-P2-review-20260625
reviewer: review (lead)
status: approved
created: 2026-06-25
---

# P2 二审 + 组长汇总 — T022 diagram-renderer-refactor

> 二审职责：逐条确认首轮 6 个 BLOCKER（E1/E2/E3/D1/D2/D3）是否在 P2-design.md 修订版（1251 行）正文中**真正落地**，而非仅停留在修订记录的声明。核实方法：对照修订记录声称的「修订位置」逐节读正文，确认代码/接口/流程图实际存在且自洽。
> 组长职责：汇总两份首轮评审（P2-review-eng.md / P2-review-design.md）结论，按 role-system.md 规则判定统一 status。组长不发表新意见。

## 1. BLOCKER 解决确认表

| BLOCKER ID | 描述（首轮） | 修订位置（声称） | 修订内容核实（正文逐节核对） | 解决判定 |
|------------|-------------|-----------------|------------------------------|---------|
| **E1** | BaseDiagramProps 仅有 svgContent 无 codeViewHtml；useMarkdown renderCodeView 产出无传入路径，数据流断裂；svg 异步 Shiki 时机未决 | 2.1 + 4.2 + 5.2 + 3.1/3.2/3.3 | ✅ 2.1（L115）`codeViewHtml: string` 已入 props 接口；差异覆盖核对（L153）说明 template `v-html codeViewHtml` 渲染。✅ 4.2（L544）`BlockSource.codeViewHtml?: string`。✅ 5.2（L822-851）`renderCodeView`（同步 escapeHtml）+ `renderCodeViewAsync`（svg Shiki 异步）+「数据流补全」段完整描述 useMarkdown→sourcesMap→薄包装→BaseDiagram 路径；svg 异步 Shiki **锁定 preRender 阶段 await**（L851/L838），非 mount 二轮填充。✅ 3.1（L349-355）/3.2（L413-418）/3.3（L459-463）三薄包装均 `renderer.getCodeViewHtml(props.blockIndex)` 取值并传 `baseProps.codeViewHtml`。数据流闭环，不再凭空消失。 | ✅ 已解决 |
| **E2** | 4.4 草图把 preRender 放 v-html 前，但原错误处理（L470-473/518-528/566-569）操作 mountPoint DOM（v-html+nextTick 后才存在）；preRender 抛错时无 mountPoint 可写错误 UI，错误处理归属未决 | 4.3 + 4.4.1 + 4.2 + 7.1 | ✅ 4.3（L590-613）`preRenderMermaid` try/catch → catch 标记 `sourcesMap.set(index,{...,error:'Failed to render diagram'})`；`preRenderPlantUml` try/catch → 标记 `error:'plantuml-validate-failed'`；`registerSvg` Shiki try/catch 不阻断。均**只标记不操作 DOM**（mountPoint 此时不存在）。✅ 4.4.1（L701-744）新增完整错误处理流程图：preRender 标记 → mount 阶段（v-html+nextTick 后，mountPoint 存在）检查 `source.error`——mermaid→`mountPoint.innerHTML=mermaid-error div`（不挂组件，保真 L470-473）；plantuml→切 code 视图+`dataset.rendered=true`（保真 L520-527）；svg→保留 mount 阶段 vueRender try/catch 兜底（保真 L566-569，因 svg 无 preRender 渲染）。✅ 4.2（L545）`BlockSource.error?: string`。✅ 7.1 第 1 条（L999）指向 4.4.1。时序矛盾消除：preRender 只标记、mount 阶段消费，两阶段归属明确。 | ✅ 已解决 |
| **D1** | composable preRenderMermaid/preRenderPlantUml/registerSvg 均无 try/catch；渲染失败 sourcesMap 不填 → getMermaidSvg 返回空 → BaseDiagram 渲染空白，用户看不到错误提示（BDD 维度 9 三条必 FAIL） | 同 E2（合并修订） | ✅ 与 E2 同一修订覆盖。4.3 三 preRender 均 try/catch 并写 error 标记。4.4.1 BDD 维度 9 三条逐条对应（L739-742）：mermaid error div 字符级保真、plantuml 切 code 视图+rendered=true、svg vueRender catch 兜底。composable 错误处理不再缺失。 | ✅ 已解决 |
| **E3** | 4.3 `sourcesMap.get(...)` 省略 key（占位未填）无法实现；mermaidCache 以 `${theme}-${code}` 为 key 与 sourcesMap 以 index 为 key 混用；薄包装传 code 给 getMermaidSvg 但 preRender 按 index 存，函数内部无法用 code 查 sourcesMap | 4.3 + 3.1/3.2/3.3 + return | ✅ 4.3（L573-584）占位消除：`getMermaidSvgByIndex(index)`/`getPlantUmlSvgByIndex(index)`/`getCodeViewHtml(index)`/`getError(index)` 全部按 index 查 sourcesMap，无 `sourcesMap.get(...)` 裸占位。✅ 查找键统一为 blockIndex（薄包装持有），mermaidCache 仍 `${theme}-${code}` 但仅 preRenderMermaid 内部用（L570-572），薄包装不直接查 cache。✅ 3.1（L349）/3.2（L413）/3.3（L459）薄包装 computed 入参统一为 `props.blockIndex`。✅ return（L664）导出四个 getter。两套查找键职责分离（cache=渲染缓存，sourcesMap=挂载源数据），不再混淆。 | ✅ 已解决 |
| **D2** | 2.3 emits 注释暗示 zoom 统一走 emit；2.4 SvgDiagram defineExpose 仅 3 项（无 zoomIn）；6.2 zoom handler 调 `svgInstances.get(id).zoomIn()` → undefined → svg zoom 交互回归 | 2.3 + 6.2 表 + 标题 | ✅ 2.3（L185-208）BaseDiagram emits 实际声明仅 fullscreen/download-png/toggle-view/toggle-menu/copy-code/start-resize，**zoom-in/zoom-out/reset 已移除**（L189-194 改为注释说明 zoom 不 emit）。✅ 6.2 表（L928）zoom 行标注「不 emit（BLOCKER-4 修订）」「BaseDiagram 内部 @click 直调 panZoomInstance.zoomIn()」「svg instance 不 expose zoomIn，MarkdownViewer 无 zoom handler，无矛盾」。✅ 6.2 标题（L918）改为「15-case diagram handler 映射 + 1 case 保留」。✅ copy-code-block 行补入（L929，标注不迁移保留 MarkdownViewer）。✅ SvgDiagram defineExpose 3 项保持（L481-488）。核心矛盾消除：无 zoom handler 调 instance.zoomIn() → 无 undefined 调用。**注**：3.1 MermaidDiagram（L373）仍 `defineEmits(['zoom-in','zoom-out','reset',...])` 且注释称「BaseDiagram emit 透传」与 2.3 已移除 zoom emit 不一致——但该声明是保真原 mermaid 死信号（L193 已论证），声明存在但永不触发、无害，属文档措辞非行为矛盾，列非阻断项。 | ✅ 已解决 |
| **D3** | 2.1 props svgContent 声称 modal 也用但 MarkdownViewer 何时传入未设计；6.2 fullscreen handler 声称废弃 hidden-button hack 直接调 toggleFullscreen() 但如何打开 modal 并传入 svgContent 未说明；原 modal panZoom maxZoom=20（主图 10）说明独立实例，新方案如何创建第二个 panZoom 未设计（BDD 维度 2 fullscreen 必 FAIL） | 2.1 + 2.4.1 + 6.2 + 3.1/3.2/3.3 | ✅ 2.1（L134/L146-147）panZoomMaxZoom 注释修正为「modal panZoom 内部独立实例 maxZoom 硬编码 20，不用此 prop」；明确「modal 是 BaseDiagram 内部 Teleport+v-if overlay，无 isModal prop」。✅ 2.4.1（L233-290）新增完整 modal 渲染源设计：源码核实结论（modal 复用主图 props.svgContent，同一字符串 v-html 到 modal 内独立 div，不二次渲染）+ hidden-button hack 存在原因（vueRender 不返回实例，mermaid/plantuml 闭包对象间接触发）+ 废弃后新路径（薄包装 re-expose toggleFullscreen 指向 BaseDiagram.toggleFullscreen）+ 完整 modal template（Teleport+v-if overlay+modal-title+modal-container+v-html svgContent）+ toggleFullscreen/closeFullscreen/zoomInModal 实现 + modalPanZoomInstance 独立 maxZoom=20 硬编码。✅ 6.2 fullscreen 行（L926）描述废弃 hack + modal 渲染源指向 2.4.1。✅ 3.1/3.2/3.3 三薄包装均无 isModal prop。✅ BDD 维度 2 fullscreen 各断言对应（L284-288）：modal-overlay（v-if）+ modal-title（prop）+ svg 可见（v-html svgContent）+ Escape 关闭（closeFullscreen）。渲染源断链消除，废弃 hack 等价性论证完整。 | ✅ 已解决 |

**解决统计：6/6 BLOCKER 已解决。**

## 2. 汇总结论

**status: approved**

首轮两份评审均标 `needs-revision`，共 6 个 BLOCKER（工程评审 E1/E2/E3 + 设计评审 D1/D2/D3）。architect 修订版将 6 个 BLOCKER 去重合并为 5 条修订（E2 与 D1 同为错误处理合并）。二审逐条对照 P2-design.md 正文核实：5 条修订均已在声称的「修订位置」实际落地——接口字段（2.1/4.2）、composable API 实现（4.3，无占位）、错误处理流程图（4.4.1）、modal 渲染源设计小节（2.4.1）、emits 移除 zoom（2.3）、6.2 表修正（copy-code-block 补行 + 标题改 15-case）均在正文存在且自洽，非仅修订记录声明。

按组长规则：所有 BLOCKER 已解决 → `status: approved`。两位首轮专家无分歧（均为 needs-revision，均已被同一轮修订覆盖）。无未解决 BLOCKER，无需交人工的分歧项。

修订完整性自检（设计文档 L1243-1250）声称的四字段/packages/env_constraints/minimal_validation 保持完整、未引入新矛盾，二审核实属实：第 8 节声明字段完整；BDD 维度 9（错误处理）+ 维度 2（fullscreen）覆盖补齐，无未覆盖 BDD；行为保真铁律未违反（error 字符级保真、modal 复用 svgContent、zoom 组件内部直调均对照源码现状）。

**放行 P3。**

## 3. 非阻断建议（供 P3/P4 参考）

以下为首轮评审的非阻断项 + 二审发现的文档措辞不一致，不阻塞 P2 放行，P3/P4 须落实：

### 3.1 二审新发现（文档措辞不一致）

- **N1（D2 残留）**：3.1 MermaidDiagram（L371-375）仍 `defineEmits(['zoom-in','zoom-out','reset','fullscreen','download-png'])` 且注释「BaseDiagram emit 透传到 MarkdownViewer」。但 2.3 已从 BaseDiagram emits 移除 zoom——zoom 声明在薄包装是保真原 mermaid 死信号（L193 已论证），声明存在但永不触发、无害。**P4 建议**：修正 3.1 注释为「zoom emit 声明保留以保真原 mermaid 信号声明，但 BaseDiagram 不 emit zoom（zoom 走组件内部 @click），此声明为死信号不触发 handler」，或直接从薄包装 defineEmits 移除 zoom 三项（需确认不破坏 attrs fallthrough）。

### 3.2 首轮工程评审非阻断项（P2-review-eng.md）

- **建议-2（CSS 选择器映射）**：1.1/6.6 CSS 1192 行拆分缺选择器→目标文件映射表；Vue `<style scoped>` 迁组件后 data-v-xxx 哈希变化，跨作用域选择器（如 `.dark .mermaid-block .mermaid-content`）可能断链。**P4 实施前产出「CSS 选择器→目标文件」映射表（含 dark mode 归属）**，跨作用域选择器标注 `:deep()` 处理方式；**P3 加 dark mode 渲染快照**。
- **建议-4（测试影响验证）**：5.3 声明仅 MarkdownViewer 消费 render() 返回值，但未 grep 确认 `from '@/composables/useMarkdown'` 是否在 `__tests__` 直接 import。**P3 先 grep 确认**，若存在直接 import 的测试，返回结构变更（三 Map→sources 合并）会破坏。
- **建议-3（并行化措辞）**：已采纳——4.5（L750）措辞已改为「**禁止**对所有 diagram 预渲染使用 Promise.all」。✅ 已在正文落实，无需 P4 再处理。

### 3.3 首轮设计评审非阻断项（P2-review-design.md）

- **S1（fullscreen hack 过渡保留）**：修订 5 已给等价性论证（原 hack 仅为触发组件内 toggleFullscreen，新路径直接调真实方法，渲染源不变）。**P4/P6 验证**：若新路径无法 1:1 复现原行为，保留 hidden-button hack 作 A/B 过渡，待 P6 验证等价后再删。
- **S2（registry 合并自由度）**：5.5（L898）仍留「P4 可合并」悬置。**P4 不得合并** wrapperRegistry 与 diagramRegistry（除非单独立项），保持职责分离。
- **S3（resize 监听层级）**：6.2 start-resize + 6.6 handleResizeMove/Up 未明确 mousemove/mouseup 绑 window 还是元素级。**P4 明确绑 window**（保真原拖拽出 block 仍生效）。
- **S4（主题切换触发路径）**：7.3 svg code 视图 Shiki 重挂载触发路径——主题切换走「整个 block 重渲染」（panZoom 销毁重建）还是「局部更新 code 视图」未明示。**P2 当前隐含前者**（5.2 svg codeViewHtml 在 preRender await 填入，主题切换触发 renderContent 重走 preRender）。**P4 确认 panZoom 重建时机与原一致**（refreshPanZoom + refreshEventName dispatch），P6 BDD 维度 7 实跑。
- **S5（cross-族 menu 作用域）**：6.2 toggle-menu mermaid/svg「关闭其他同族菜单」未明确「同族」边界是 classPrefix 还是所有 diagram 族。**P4 对照源码确认** menuCloseOthers 作用域，保真原行为。
- **S6（IME 声明）**：7.4 已合理（MarkdownViewer 非输入框无 IME）。建议补一句对应 P0 known_risks 第 8 条「IME 影响域在 EntryDetailView 输入控件，本任务不动 EntryDetailView → IME 零影响已由范围边界保障」。**P4 补注释即可**。

### 3.4 首轮测试缺口（两评审共同提出，P3 落实）

1. **错误处理路径测试**：4.4.1 已给明确实现路径，**P3 须写**——composable preRender 错误标记单测（mock 渲染器抛错 + 验证 sourcesMap.error）+ mount 阶段错误 DOM 测试（验证 mermaid-error div / plantuml 切 code 视图 / svg-error div 字符级一致）。
2. **跨作用域 CSS dark mode 快照**：P3 加 dark 主题下 `.mermaid-block` 渲染快照（验证 scoped 作用域迁移不破坏 dark mode 选择器）。
3. **zoom 内部逻辑测试**：zoom 保留组件内部 @click 直调 panZoom（修订 4），**P3 确认**现有 MermaidDiagram zoom 单测（若有）迁移到 BaseDiagram 后仍覆盖；files_to_read 补 zoom 相关测试文件。
