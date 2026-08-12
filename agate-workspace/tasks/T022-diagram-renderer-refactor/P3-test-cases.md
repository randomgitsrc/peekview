---
phase: P3
task_id: T022-diagram-renderer-refactor
type: test-cases
parent: P2-design.md
trace_id: T022-P3-20260626
status: draft
created: 2026-06-26
---

# P3 测试用例 — T022 diagram-renderer-refactor

## 第 1 节：测试策略总览

### 1.1 复用 vs 新增 vs P6 留存

| 分类 | 文件 | 测试点 | 说明 |
|------|------|--------|------|
| **复用（已绿）** | `useCodeBlockRenderer.spec.ts` | 13 | composable 纯函数，P4 实现后仍须绿 |
| **复用（已绿）** | `useMarkdown-registry.spec.ts` | 12 | 注册表 + DOMPurify，P4 实现后仍须绿 |
| **复用（已绿）** | `thin-wrappers.spec.ts` | 11 | 三薄包装 props，P4 实现后仍须绿 |
| **复用（已绿）** | `BaseDiagram.spec.ts` | 8 | BaseDiagram 挂载，P4 实现后仍须绿 |
| **复用（已绿）** | `error-handling-mount.spec.ts` | 5 | 错误处理，P4 实现后仍须绿 |
| **复用（已绿）** | `snapshot-html.spec.ts` | 8 | HTML 快照，P4 实现后仍须绿 |
| **复用（已绿）** | `SvgBlock.spec.ts` | 7 | MarkdownViewer + svg 集成，P4 后仍绿 |
| **新增** | `markdown-viewer-degeneration.spec.ts` | 15 | MarkdownViewer 退化（核心新增） |
| **新增** | `emit-handler-diffs.spec.ts` | 15 | emit handler 按 classPrefix 分族差异（I3 矩阵 15 case） |
| **新增** | `mount-loop-unified.spec.ts` | 8 | 统一挂载循环 + renderToken 检查点 |
| **P6 留存** | Playwright E2E | — | 见 1.2 |

**总计**：现有 64 tests（复用）+ 新增 38 tests = 102 tests。P5 全绿门槛。

### 1.2 P6 Playwright 留存（vitest 不可覆盖）

| P1 BDD | 维度 | 原因 |
|--------|------|------|
| 维度 2 大部分（toggle/copy/download/fullscreen 交互） | 2 | 需 DOM 渲染后真实交互 |
| 维度 3 竞态时序（主题快速切换旧 SVG 覆盖） | 3 | 需浏览器真实异步时序 |
| 维度 4 性能基线（首屏渲染时间/cache 命中率） | 4 | 需浏览器真实计时 |
| 维度 6 resize 拖拽（mousedown/mousemove/mouseup） | 6 | 需真实鼠标事件流 |
| 维度 7 主题切换视觉一致性 | 7 | 需截图对比 |
| 维度 8 CSP 运行时验证 | 8 | 需浏览器 CSP 报告 |
| 维度 6 响应式断点（≤768px CSS 变化） | 6 | 需浏览器真实视口 |

## 第 2 节：新增测试文件清单（Given/When/Then 格式）

### 2.1 文件 7：`markdown-viewer-degeneration.spec.ts`（15 tests）

> 测 MarkdownViewer 退化：使用 composable 状态（sourcesMap 而非三 Map）、统一挂载循环、脚本 < 300 行目标。

#### TC-D1：MarkdownViewer 使用 useCodeBlockRenderer 状态

**D1.1** MarkdownViewer 不持有 mermaidSourcesMap/plantumlSourcesMap/svgSourcesMap 三 Map
```gherkin
Given MarkdownViewer 组件源码
When  检查 <script setup> 中变量声明
Then  不存在 mermaidSourcesMap / plantumlSourcesMap / svgSourcesMap 局部变量
And   渲染源数据通过 useCodeBlockRenderer().sourcesMap 获取
```
→ BDD 维度 1（渲染输出，数据来源统一化）

**D1.2** MarkdownViewer 不持有 mermaidCache 局部变量
```gherkin
Given MarkdownViewer 组件源码
When  检查 <script setup> 中变量声明
Then  不存在 mermaidCache 局部变量
And   cache 通过 useCodeBlockRenderer().mermaidCache 获取
```
→ BDD 维度 4（性能，cache 不丢）

**D1.3** MarkdownViewer 不持有 mermaidInstances/plantumlInstances/svgInstances 三 Map
```gherkin
Given MarkdownViewer 组件源码
When  检查 <script setup> 中变量声明
Then  不存在 mermaidInstances / plantumlInstances / svgInstances 局部变量
And   instance 通过 useCodeBlockRenderer().instances 获取
```
→ BDD 维度 2（交互，instance 引用不丢）

**D1.4** MarkdownViewer 不持有 renderToken 局部变量
```gherkin
Given MarkdownViewer 组件源码
When  检查 <script setup> 中变量声明
Then  不存在 renderToken 局部变量
And   renderToken 通过 useCodeBlockRenderer().nextToken()/isCurrent() 获取
```
→ BDD 维度 3（防竞态，token 不丢）

#### TC-D2：MarkdownViewer 统一挂载循环

**D2.1** 不存在 renderMermaidDiagrams / renderPlantUmlDiagrams / renderSvgBlocks 三段独立函数
```gherkin
Given MarkdownViewer 组件源码
When  检查 <script setup> 中函数声明
Then  不存在 renderMermaidDiagrams / renderPlantUmlDiagrams / renderSvgBlocks 独立函数
And   存在统一挂载循环（遍历 sourcesMap → 按 lang 查 wrapperRegistry → h + vueRender）
```
→ BDD 维度 1（三族共存，统一路径）

**D2.2** 挂载循环查 wrapperRegistry 路由到正确薄包装
```gherkin
Given MarkdownViewer 渲染含 mermaid/plantuml/svg 三族的内容
When  挂载循环执行
Then  lang='mermaid' 查到 MermaidDiagram 组件
And   lang='plantuml' 查到 PlantUmlDiagram 组件
And   lang='svg' 查到 SvgDiagram 组件
```
→ BDD 维度 1（三族路由正确）

**D2.3** 挂载循环通过 h(Wrapper, props) + vueRender 挂载（非 <component :is>）
```gherkin
Given MarkdownViewer 挂载循环代码
When  检查挂载方式
Then  使用 h(Component, props) + vueRender(vNode, mountPoint) 手动挂载
And   不使用 <component :is> 模板挂载
```
→ P1 I6（挂载机制保留，两阶段流程保真）

**D2.4** 挂载循环保留 dataset.rendered 去重
```gherkin
Given MarkdownViewer 已渲染过 mermaid block（dataset.rendered='true'）
When  触发重渲染（主题切换）
Then  删除 dataset.rendered 后重新挂载
And   挂载成功后 dataset.rendered 重新设为 'true'
```
→ P1 I6（去重机制保留）

**D2.5** 挂载循环保留两阶段流程（v-html → nextTick → 挂载）
```gherkin
Given MarkdownViewer.renderContent 执行
When  流程顺序
Then  先 renderedHtml.value = result.html（v-html 渲染占位）
And   再 await nextTick()（等 DOM 更新）
And   最后挂载循环（querySelector .xxx-block → vueRender）
```
→ P1 I6（两阶段保真）

#### TC-D3：MarkdownViewer emit handler 按 classPrefix 分族差异化

**D3.1** handleToggleView mermaid 分族：切 is-active + 更新 toggle-text + dispatch refresh
```gherkin
Given 已渲染的 mermaid block（diagram-mode is-active）
When  BaseDiagram emit('toggle-view', 'mermaid-block-0')
Then  diagram-mode 与 code-mode is-active 互换
And   toggle-text 更新为 "Code"
And   向 .mermaid-viewer 派发 'mermaid-refresh' CustomEvent
```
→ BDD 维度 2（mermaid toggle 差异保真）

**D3.2** handleToggleView plantuml 分族：仅切 is-active，无 refresh 无 toggle-text
```gherkin
Given 已渲染的 plantuml block（diagram-mode is-active）
When  BaseDiagram emit('toggle-view', 'plantuml-block-0')
Then  diagram-mode 与 code-mode is-active 互换
And   不派发 refresh 事件
And   toggle-text 不更新（保持现状）
```
→ BDD 维度 2（plantuml toggle 差异保真，P1 I3）

**D3.3** handleToggleView svg 分族：切 is-active + 更新 toggle-text + dispatch refresh
```gherkin
Given 已渲染的 svg block（diagram-mode is-active）
When  BaseDiagram emit('toggle-view', 'svg-block-0')
Then  diagram-mode 与 code-mode is-active 互换
And   toggle-text 更新为 "Code"
And   向 .svg-viewer 派发 'svg-refresh' CustomEvent
```
→ BDD 维度 2（svg toggle 差异保真）

**D3.4** handleCopyCode mermaid/svg 分族：clipboard + Copied UI 反馈
```gherkin
Given 已渲染的 mermaid block
When  BaseDiagram emit('copy-code', 'mermaid-block-0')
Then  navigator.clipboard.writeText 被调用（参数为该 block 源码）
And   下拉菜单末按钮文本变为 "✓ Copied!" 持续 2 秒
```
→ BDD 维度 2（copy 差异，mermaid/svg 有反馈）

**D3.5** handleCopyCode plantuml 分族：clipboard + 仅 console.log，无 Copied 反馈
```gherkin
Given 已渲染的 plantuml block
When  BaseDiagram emit('copy-code', 'plantuml-block-0')
Then  navigator.clipboard.writeText 被调用
And   不显示 "✓ Copied!" UI 反馈
And   仅 console.log
```
→ BDD 维度 2（copy 差异，plantuml 无反馈保真，P1 I3）

#### TC-D4：主题切换触发重渲染

**D4.1** 主题切换触发 renderContent
```gherkin
Given MarkdownViewer 已渲染（light 主题）
When  theme 从 'light' 切换为 'dark'
Then  watch([content, theme]) 触发 renderContent
And   mermaid 重新 render 生成 dark 主题 SVG
And   SVG 重新挂载
```
→ BDD 维度 7（主题切换重渲染）

### 2.2 文件 8：`emit-handler-diffs.spec.ts`（15 tests）

> 测 P1 I3 矩阵 15 case：三族 × 五类 handler 差异。纯 MarkdownViewer handler 单测，mock DOM + composable。

#### TC-E1：toggle-view 差异（3 case）

**E1.1** mermaid toggle-view：dispatches refresh + updates toggle-text
```gherkin
Given mock DOM 含 .mermaid-block，diagram-mode is-active
When  handleToggleView('mermaid-block-0', 'mermaid')
Then  diagram-mode/code-mode is-active 互换
And   .toggle-text 文本更新
And   dispatchEvent 被调用（'mermaid-refresh'）
```
→ BDD 维度 2, P1 I3 toggle-view mermaid

**E1.2** plantuml toggle-view：no refresh + no toggle-text update
```gherkin
Given mock DOM 含 .plantuml-block，diagram-mode is-active
When  handleToggleView('plantuml-block-0', 'plantuml')
Then  diagram-mode/code-mode is-active 互换
And   dispatchEvent 不被调用
And   .toggle-text 文本不变
```
→ BDD 维度 2, P1 I3 toggle-view plantuml

**E1.3** svg toggle-view：dispatches refresh + updates toggle-text
```gherkin
Given mock DOM 含 .svg-block，diagram-mode is-active
When  handleToggleView('svg-block-0', 'svg')
Then  diagram-mode/code-mode is-active 互换
And   .toggle-text 文本更新
And   dispatchEvent 被调用（'svg-refresh'）
```
→ BDD 维度 2, P1 I3 toggle-view svg

#### TC-E2：toggle-menu 差异（3 case）

**E2.1** mermaid toggle-menu：closes other mermaid menus + click-outside
```gherkin
Given 两个 mermaid block 的菜单（menu-1 open, menu-2 closed）
When  handleToggleMenu('mermaid-block-1', 'mermaid')
Then  menu-1 toggle show
And   menu-0 关闭（如果之前 open）
And   document.addEventListener('click', clickOutsideHandler) 被调用
```
→ BDD 维度 2, P1 I3 toggle-menu mermaid

**E2.2** plantuml toggle-menu：only toggle show, no close-others, no click-outside
```gherkin
Given 两个 plantuml block 的菜单
When  handleToggleMenu('plantuml-block-0', 'plantuml')
Then  menu-0 toggle show
And   其他 plantuml 菜单不受影响
And   不绑定 click-outside 监听
```
→ BDD 维度 2, P1 I3 toggle-menu plantuml

**E2.3** svg toggle-menu：closes other svg menus + click-outside
```gherkin
Given 两个 svg block 的菜单
When  handleToggleMenu('svg-block-1', 'svg')
Then  menu-1 toggle show
And   menu-0 关闭
And   click-outside 监听绑定
```
→ BDD 维度 2, P1 I3 toggle-menu svg

#### TC-E3：copy-code 差异（3 case）

**E3.1** mermaid copy-code：clipboard + ✓Copied! UI 2s
```gherkin
Given mock mermaidSourcesMap 含 index=0 code
When  handleCopyCode('mermaid-block-0', 'mermaid')
Then  navigator.clipboard.writeText(mermaidCode) 被调用
And   菜单末按钮文本设为 "✓ Copied!"
And   2 秒后文本恢复
```
→ BDD 维度 2, P1 I3 copy-code mermaid

**E3.2** plantuml copy-code：clipboard + only console.log, no UI feedback
```gherkin
Given mock plantumlSourcesMap 含 index=0 code
When  handleCopyCode('plantuml-block-0', 'plantuml')
Then  navigator.clipboard.writeText(plantumlCode) 被调用
And   不修改任何按钮文本
And   console.log 被调用
```
→ BDD 维度 2, P1 I3 copy-code plantuml

**E3.3** svg copy-code：clipboard + ✓Copied! UI 2s
```gherkin
Given mock svgSourcesMap 含 index=0 code
When  handleCopyCode('svg-block-0', 'svg')
Then  navigator.clipboard.writeText(svgCode) 被调用
And   菜单末按钮文本设为 "✓ Copied!"
And   2 秒后文本恢复
```
→ BDD 维度 2, P1 I3 copy-code svg

#### TC-E4：download-png 差异（3 case）

**E4.1** mermaid download-png：re-render fresh + svgToPng(白底/800×600/brFix)
```gherkin
Given 已渲染 mermaid block
When  handleDownloadPng('mermaid-block-0', 'mermaid')
Then  renderer.renderMermaidFresh(code, theme) 被调用
And   renderer.svgToPng(freshSvg, { background:'#ffffff', finalSize:800×600, brFix:true }) 被调用
```
→ BDD 维度 2, P1 I2 PNG 差异

**E4.2** plantuml download-png：re-render fresh + svgToPng(白底/800×600/no brFix)
```gherkin
Given 已渲染 plantuml block
When  handleDownloadPng('plantuml-block-0', 'plantuml')
Then  renderer.renderPlantUmlFresh(code, theme) 被调用
And   renderer.svgToPng(freshSvg, { background:'#ffffff', finalSize:800×600, brFix:false }) 被调用
```
→ BDD 维度 2, P1 I2 PNG 差异

**E4.3** svg download-png：delegates to instance.downloadPng()
```gherkin
Given 已渲染 svg block，svgInstances 含 instance
When  handleDownloadPng('svg-block-0', 'svg')
Then  renderer.getInstance('svg', 'svg-block-0').downloadPng() 被调用
And   不调 renderXxxFresh（委托组件，非 re-render fresh）
```
→ BDD 维度 2, P1 I2 PNG 差异（svg 委托）

#### TC-E5：fullscreen 差异（3 case）

**E5.1** mermaid fullscreen：instance.toggleFullscreen()（废弃 hidden-button hack）
```gherkin
Given 已渲染 mermaid block，mermaidInstances 含 instance
When  handleFullscreen('mermaid-block-0', 'mermaid')
Then  renderer.getInstance('mermaid', 'mermaid-block-0').toggleFullscreen() 被调用
And   不使用 querySelector('.xxx-fullscreen-trigger').click()（无 hidden-button hack）
```
→ BDD 维度 2, P2 修订 5（废弃 hack）

**E5.2** plantuml fullscreen：instance.toggleFullscreen()（废弃 hidden-button hack）
```gherkin
Given 已渲染 plantuml block，plantumlInstances 含 instance
When  handleFullscreen('plantuml-block-0', 'plantuml')
Then  renderer.getInstance('plantuml', 'plantuml-block-0').toggleFullscreen() 被调用
And   不使用 hidden-button hack
```
→ BDD 维度 2, P2 修订 5

**E5.3** svg fullscreen：instance.toggleFullscreen()
```gherkin
Given 已渲染 svg block，svgInstances 含 instance
When  handleFullscreen('svg-block-0', 'svg')
Then  renderer.getInstance('svg', 'svg-block-0').toggleFullscreen() 被调用
```
→ BDD 维度 2, P1 I2（svg 直接调 exposed）

### 2.3 文件 9：`mount-loop-unified.spec.ts`（8 tests）

> 测统一挂载循环 + renderToken 防竞态检查点保留 + PlantUML 串行约束。

#### TC-M1：统一挂载循环路由

**M1.1** 挂载循环遍历 sourcesMap 按 lang 查 wrapperRegistry
```gherkin
Given useCodeBlockRenderer().sourcesMap 含 {0:mermaid, 1:plantuml, 2:svg}
When  MarkdownViewer 挂载循环执行
Then  index=0 → h(MermaidDiagram, props) + vueRender
And   index=1 → h(PlantUmlDiagram, props) + vueRender
And   index=2 → h(SvgDiagram, props) + vueRender
```
→ BDD 维度 1（三族路由）

**M1.2** 未知 lang 跳过挂载（不崩）
```gherkin
Given sourcesMap 含 {0:{lang:'python', code:'...'}}
When  挂载循环执行
Then  跳过 index=0（无对应 wrapper）
And   不抛错
```
→ 边界

**M1.3** 挂载成功后 registerInstance
```gherkin
Given 挂载循环挂载 mermaid block
When  vueRender 成功
Then  renderer.registerInstance('mermaid', 'mermaid-block-0', instance) 被调用
```
→ BDD 维度 2（instance 注册）

#### TC-M2：renderToken 防竞态检查点

**M2.1** renderContent 内 nextToken + useMarkdown.render 后检查 isCurrent
```gherkin
Given MarkdownViewer.renderContent 执行
When  nextToken() 生成 myToken
And   await render(content, theme) 完成
Then  检查 isCurrent(myToken)，若 false 则 return
```
→ BDD 维度 3, P1 I4

**M2.2** 挂载循环内每个 block 前检查 isCurrent
```gherkin
Given sourcesMap 含 3 个 block
When  挂载循环遍历
Then  每个挂载前检查 isCurrent(myToken)
And   若 token 已变则中断循环 return
```
→ BDD 维度 3, P1 I4

**M2.3** 快速主题切换旧渲染被中断
```gherkin
Given renderContent 正在渲染（async 中途）
When  主题切换触发新 renderContent（nextToken 递增）
Then  旧 renderContent 的 isCurrent(myToken) 返回 false
And   旧渲染中途 return 不写 DOM
```
→ BDD 维度 3（竞态防护）

#### TC-M3：PlantUML 串行约束

**M3.1** 挂载循环中 plantuml 渲染串行（非 Promise.all）
```gherkin
Given sourcesMap 含 2 个 plantuml block
When  挂载循环执行 preRender
Then  第二个 plantuml 的 preRender 在第一个完成后才开始
And   不使用 Promise.all 并行化
```
→ BDD 维度 1, P1 I5（串行硬约束）

**M3.2** 挂载循环中 mermaid 可 cache 跳过
```gherkin
Given mermaidCache 已含 'light-graph TD' 条目
When  挂载循环处理 mermaid block（同 code+theme）
Then  不调用 useMermaid.render（cache 命中）
And   直接从 cache 取 svg
```
→ BDD 维度 4（cache 命中率不降）

## 第 3 节：TDD 红灯预期

### 3.1 新增测试文件红灯分析

| 文件 | 测试点 | 当前红灯原因 | P4 实现后转绿条件 |
|------|--------|-------------|------------------|
| `markdown-viewer-degeneration.spec.ts` | D1.1-D1.4 | MarkdownViewer 仍持有 mermaidSourcesMap 等 6 个局部变量 | 迁入 useCodeBlockRenderer 后删除 |
| | D2.1 | 三段独立挂载函数仍存在 | 统一为 mountAllDiagrams 循环 |
| | D2.2 | wrapperRegistry 不存在 | 新增 wrapperRegistry Map |
| | D2.3 | 当前即用 h+vueRender（绿灯） | 保持 |
| | D2.4 | 当前 dataset.rendered 逻辑已存在（绿灯） | 保持 |
| | D2.5 | 当前两阶段流程已存在（绿灯） | 保持 |
| | D3.1 | handleToggleView 未 dispatch refresh（当前无差异） | P4 按分族差异化实现 |
| | D3.2 | handleToggleView 对 plantuml 也更新 toggle-text（当前无差异） | P4 按 P1 I3 差异实现 |
| | D3.3 | 同 D3.1（svg 也缺 refresh） | P4 按 P1 I3 差异实现 |
| | D3.4 | handleCopyCode 无 Copied UI 反馈 | P4 实现分族差异 |
| | D3.5 | handleCopyCode 对 plantuml 也显示 Copied | P4 按 P1 I3 差异实现 |
| | D4.1 | 当前 watch theme 已触发（绿灯） | 保持 |
| `emit-handler-diffs.spec.ts` | E1.1-E5.3 全部 | emit handler 无分族差异逻辑 | P4 按 P1 I3 矩阵实现 15 case |
| `mount-loop-unified.spec.ts` | M1.1 | 三段独立函数，无统一挂载循环 | P4 统一循环 |
| | M1.2 | 无 wrapperRegistry | P4 新增 |
| | M1.3 | 当前 registerInstance 方式不一致 | P4 统一 |
| | M2.1-M2.3 | 当前 renderToken 检查点已存在（部分绿灯） | 迁入 composable 后保持 |
| | M3.1 | plantuml 串行已有（绿灯，但需验证统一循环后仍串行） | P4 保留串行 |
| | M3.2 | cache 命中逻辑已有（绿灯） | 迁入 composable 后保持 |

### 3.2 红灯统计

- **确定红灯**：29/38 新增测试（D1.1-D1.4, D2.1-D2.2, D3.1-D3.5, E1.1-E5.3, M1.1-M1.3）
- **预期绿灯**：9/38 新增测试（D2.3, D2.4, D2.5, D4.1, M2.1-M2.3 部分, M3.1, M3.2）
- TDD 红灯率 ≈ 76%，足以验证 P4 实现覆盖率

## 第 4 节：与 P1 BDD 的追溯映射

### 维度 1：渲染输出（字符级一致）

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| mermaid block DOM 结构 | D2.2, M1.1 | mount-loop-unified, markdown-viewer-degeneration |
| svg block DOM 结构 | 复用 SvgBlock.spec TC-01 | SvgBlock.spec |
| 内联 svg 不走代码块管线 | 复用 useMarkdown-registry 2.11 | useMarkdown-registry |
| plantuml block DOM 结构 | D2.2, M1.1 | mount-loop-unified |
| 三族共存互不干扰 | 复用 SvgBlock.spec TC-12, D2.2 | SvgBlock, mount-loop-unified |
| plantuml 串行执行 | M3.1 | mount-loop-unified |

### 维度 2：按钮交互（toggle/copy/PNG/fullscreen）

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| mermaid toggle（is-active + toggle-text + refresh） | D3.1, E1.1 | markdown-viewer-degeneration, emit-handler-diffs |
| plantuml toggle（仅 is-active，无 refresh/toggle-text） | D3.2, E1.2 | 同上 |
| svg toggle（is-active + toggle-text + refresh） | D3.3, E1.3 | 同上 |
| mermaid copy（clipboard + Copied 反馈） | D3.4, E3.1 | 同上 |
| plantuml copy（clipboard + console.log，无 Copied） | D3.5, E3.2 | 同上 |
| svg copy（clipboard + Copied 反馈） | E3.3 | emit-handler-diffs |
| svg download-png（透明/委托组件） | E4.3 | emit-handler-diffs |
| mermaid download-png（白底/fresh） | E4.1 | emit-handler-diffs |
| plantuml download-png（白底/fresh） | E4.2 | emit-handler-diffs |
| fullscreen（三族 toggleFullscreen） | E5.1-E5.3 | emit-handler-diffs |
| **留存 P6**（真实 DOM 交互验证） | P6 Playwright | — |

### 维度 3：状态保持（防竞态）

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| renderToken 防竞态旧渲染中断 | D1.4, M2.1-M2.3 | markdown-viewer-degeneration, mount-loop-unified |
| EntryDetailView 不重挂载 | P6 验证（集成测试无法在 vitest 隔离验证） | — |

### 维度 4：性能

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| mermaidCache key 格式 + 命中 | 复用 useCodeBlockRenderer 1.1/1.6, M3.2 | useCodeBlockRenderer, mount-loop-unified |
| 首屏渲染时间 | **留存 P6** | — |

### 维度 5：安全（T020 XSS 净化）

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| svg 剥除 `<script>` | 复用 useMarkdown-registry 2.7, snapshot-html 5.6 | useMarkdown-registry, snapshot-html |
| svg 剥除 onclick 保留合法元素 | 复用 useMarkdown-registry 2.8, snapshot-html 5.6 | 同上 |
| svg 剥除 foreignObject | 复用 useMarkdown-registry 2.9, snapshot-html 5.6 | 同上 |
| 整体 HTML DOMPurify ADD_ATTR 白名单 | 复用 useMarkdown-registry 2.10 | useMarkdown-registry |

### 维度 6：响应式

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| 断点 CSS 变化（≤768px） | **留存 P6**（需浏览器真实视口） | — |
| resize-handle 拖拽 | **留存 P6**（需真实鼠标事件） | — |

### 维度 7：主题切换

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| watch theme 触发 renderContent | D4.1 | markdown-viewer-degeneration |
| mermaid 重 render + cache key 含 theme | 复用 useCodeBlockRenderer 1.1 | useCodeBlockRenderer |
| svg code 视图 Shiki 重高亮 | 复用 useCodeBlockRenderer 1.9 | useCodeBlockRenderer |
| 主题切换视觉一致性 | **留存 P6** | — |

### 维度 8：CSP 合规

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| 不引入内联事件处理器 | P2 6.4 论证（Vue @click 非 inline）+ 复用 useMarkdown-registry 2.10 | useMarkdown-registry |
| 主应用 CSP 不违规 | **留存 P6**（需浏览器 CSP 报告） | — |

### 维度 9：错误处理

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| mermaid render 抛错 → mermaid-error div | 复用 error-handling-mount 6.1/6.4 | error-handling-mount |
| plantuml validate 失败 → 切 code 视图 | 复用 error-handling-mount 6.2 | error-handling-mount |
| svg 解析失败 → svg-error div | 复用 error-handling-mount 6.3 | error-handling-mount |

### 可扩展性验收

| BDD 条件 | 测试覆盖 | 文件 |
|----------|---------|------|
| 加 d2 类型 ≤ 1 文件 + 1 行注册 | 复用 useMarkdown-registry 2.2 | useMarkdown-registry |

## 第 5 节：P1 BDD 覆盖率汇总

| 维度 | BDD 总数 | vitest 覆盖 | P6 留存 | 覆盖率 |
|------|---------|------------|---------|--------|
| 1. 渲染输出 | 5 | 5 | 0 | 100% |
| 2. 按钮交互 | 7 | 7 | 7（P6 重验） | 100%（单测 + P6） |
| 3. 状态保持 | 2 | 1 | 1 | 50%（竞态时序留 P6） |
| 4. 性能 | 2 | 1 | 1 | 50%（首屏时间留 P6） |
| 5. 安全 | 4 | 4 | 0 | 100% |
| 6. 响应式 | 2 | 0 | 2 | 0%（全需浏览器） |
| 7. 主题切换 | 2 | 1 | 1 | 50%（视觉留 P6） |
| 8. CSP | 1 | 0 | 1 | 0%（需浏览器） |
| 9. 错误处理 | 3 | 3 | 0 | 100% |
| 可扩展性 | 1 | 1 | 0 | 100% |
| **合计** | **29** | **23** | **12**（含 P6 重验 7） | **79% 单测覆盖** |

> 维度 1/5/9 全覆盖 ✅
> 维度 2/3/7/8 部分单测覆盖 ✅（交互逻辑可单测，DOM 时序/视觉/CSP 需浏览器）
> 维度 4/6 单测不可覆盖 ✅（性能基线/响应式断点需浏览器）
