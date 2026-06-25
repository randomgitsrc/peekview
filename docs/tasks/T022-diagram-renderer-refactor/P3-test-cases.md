---
phase: P3
task_id: T022-diagram-renderer-refactor
type: test-cases
parent: P2-design.md
trace_id: T022-P3-20260625
status: draft
created: 2026-06-25
---

# P3 测试用例文档 — T022 diagram-renderer-refactor

> 只规划「测什么、怎么拆文件、每文件多少测试点、stub 怎么写」，**不写测试代码**。代码由 P3b subagent 按本文拆分计划编写。
> 防空返回核心：纯函数单测优先、单文件 < 15 测试点、stub 可 import 但断言失败（红灯）。
> 依据：P2-design.md §2-7 / P1-requirements.md 29 BDD + I2/I3 矩阵 / P0-brief behavioral_fidelity_strategy + T020 教训。

## 第 1 节：红线基线记录方法

### 1.1 实测基线（重构前现状）

> ⚠️ P0-brief 称「86 单测 + 16 BDD」为旧数。实测为 **140 单测**。以实测为准。

**单测基线命令**（vitest v1，禁 `--tb=short`，禁 `npx vitest` watch）：

```bash
cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20
```

实测输出（2026-06-25，作为红线）：

```
 Test Files  10 passed (10)
      Tests  140 passed (140)
```

**140 单测文件分布**（任一挂 = 红线触发，立即停 P4）：

| 测试文件 | 点数 | 测什么 | 重构影响 |
|----------|------|--------|---------|
| `__tests__/HtmlViewer.spec.ts` | 31 | HTML 渲染器（非本任务） | 不受影响，须保持绿 |
| `__tests__/FileTree.spec.ts` | 13 | 文件树（非本任务） | 不受影响 |
| `__tests__/HtmlViewerIntegration.spec.ts` | 5 | HTML 集成 | 不受影响 |
| `__tests__/SvgBlock.spec.ts` | 10 | **svg block + toggle + 三族共存** | ⚠️ 受影响：L139 `[data-action="toggle-svg-view"]` 迁 emit 后失效，P4 迁移时同步更新（P2 §6.5） |
| 其余 6 个（Shiki/toast 等） | 81 | 工具/composable | 不受影响 |

**e2e BDD 基线命令**（需 debug backend :8888）：`make debug-test 2>&1 | tail -30`

**diagram 相关 e2e**（重构后须全绿）：`e2e/mermaid.spec.ts`(3)、`mermaid-visual.spec.ts`(3)、`png-download.spec.ts`(1)、`png-download-test.spec.ts`(1)、`png-verify.spec.ts`(1)、`mermaid-check.spec.ts`(1)、`verify-mermaid.spec.ts`(1)、`viewer.spec.ts` TC-013(1)。

### 1.2 红线判定规则

- **单测**：`vitest run` ≥ 140 passed。任一 RED = 立即停 P4，先修复。
- **e2e**：上述 diagram 相关 e2e 全绿。任一 fail = 行为回归，立即停。
- **快照**：新增 HTML 快照（第 5 节）重构后须 100% 字符级匹配（P2 §7.2）。
- 主 Agent 亲自跑命令，不信 subagent 自我报告（T020 P6 教训）。

---

## 第 2 节：测试文件拆分计划（核心，防 T020 空返回）

> 原则（P0-brief P3 要求 + T020 教训）：
> 1. **纯函数单测优先**（composable/registry，不依赖 DOM/挂载）→ 文件 1、2
> 2. **组件集成后位**（mount BaseDiagram/薄包装）→ 文件 3、4、6
> 3. **快照测试独立**（HTML 字符级一致）→ 文件 5
> 4. **单文件 < 15 测试点**
>
> 新测试文件位于 `frontend-v3/src/components/diagrams/__tests__/`（新建），import 新结构 stub。
> 旧测试保持原位原绿，P4 迁移时再更新 SvgBlock.spec 的 data-action 断言。

### 文件 1：`useCodeBlockRenderer.spec.ts`（纯函数/composable 逻辑）

**路径**：`src/components/diagrams/__tests__/useCodeBlockRenderer.spec.ts`
**类型**：纯函数单测（不 mount 组件，直接调 composable，mock useMermaid/usePlantUML/highlightCode）
**测试点**：13

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 1.1 | mermaidCache key 格式 `${theme}-${code}` | 命中跳过 render，miss 调渲染器 | 4.3 |
| 1.2 | sourcesMap 按 blockIndex 查（getMermaidSvgByIndex） | index key，miss 返回空串 | 4.3 修订3 |
| 1.3 | getCodeViewHtml(index) | mermaid/plantuml 同步；svg 异步 | 4.3/5.2 |
| 1.4 | getError(index) 返回 error 标记 | preRender catch 时填 | 4.3 修订2 |
| 1.5 | nextToken 递增 + isCurrent 二值 | 旧 token ≠ current | 4.4 |
| 1.6 | preRenderMermaid cache 命中不调渲染器 | mock 断言未调用 | 4.3 |
| 1.7 | preRenderMermaid 抛错标记 error 不操作 DOM | catch→set error，不 throw | 4.4.1 修订2 |
| 1.8 | preRenderPlantUml 走 usePlantUML.render 串行 | mock 断言调用；禁 Promise.all | 4.5 |
| 1.9 | registerSvg 异步 Shiki 填 codeViewHtml | mock highlightCode await 后填 | 4.3/5.2 |
| 1.10 | registerInstance/unregister/getInstance 按 lang+id | 三 Map | 4.3 |
| 1.11 | beginResize/endResize 维护 resizingBlock | start-resize handler 用 | 4.3 |
| 1.12 | clearInstances 清空三族 Map | unmount/重渲染前调 | 4.3 |
| 1.13 | renderMermaidFresh/renderPlantUmlFresh 非 cache | inline PNG fresh，调渲染器 | 4.3 |

### 文件 2：`useMarkdown-registry.spec.ts`（纯函数/注册路由 + DOMPurify）

**路径**：`src/components/diagrams/__tests__/useMarkdown-registry.spec.ts`
**类型**：纯函数单测（调 render，断言输出 html/sources 结构，不 mount）
**测试点**：12

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 2.1 | diagramRegistry 含 mermaid/plantuml/svg 三 meta | 注册表初始三项 | 5.1 |
| 2.2 | registerDiagramType 新增 d2 类型 1 行注册 | 可扩展性量化验收 | 5.1/P1量化 |
| 2.3 | fence lang=mermaid 命中走 diagram 分支 | 输出含 mermaid-block 占位容器 | 5.2 |
| 2.4 | 未知 lang(python) 走默认 code block | 不命中→Shiki 高亮 | 5.2 |
| 2.5 | render 返回 sources Map（合并三 Map） | 新 API 签名 | 5.3 |
| 2.6 | render 返回 html + headings 契约不变 | content 输入+headings 输出 | 5.3/I1 |
| 2.7 | svg sanitize 剥除 `<script>` | T020 安全债 | 5.4/维度5 |
| 2.8 | svg sanitize 剥除 `onclick` 保留合法元素 | circle/path/g 仍在 | 5.4/维度5 |
| 2.9 | svg sanitize 剥除 `foreignObject`（大小写不敏感） | T020 安全债 | 5.4/维度5 |
| 2.10 | 整体 HTML 末尾 DOMPurify ADD_ATTR 白名单保留 | data-action 等保留 | 5.4 |
| 2.11 | 内联 svg（非围栏）不走 registry 路由 | 不产生 .svg-block | 5.6/I8 |
| 2.12 | codeViewHighlighter escape-html(同步) vs shiki-xml(异步) | mermaid/plantuml 同步，svg 异步 | 5.2 |

### 文件 3：`BaseDiagram.spec.ts`（组件集成：props/emits/expose/modal）

**路径**：`src/components/diagrams/__tests__/BaseDiagram.spec.ts`
**类型**：组件集成（@vue/test-utils mount BaseDiagram，mock svg-pan-zoom）
**测试点**：14

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 3.1 | svgContent v-html 渲染到 .{prefix}-viewer | props.svgContent 注入 DOM | 2.1 |
| 3.2 | codeViewHtml v-html 渲染到 code-mode content | props.codeViewHtml 注入 | 2.1 修订1 |
| 3.3 | classPrefix 派生 CSS class + header label | mermaid→mermaid-block/MERMAID | 2.1 |
| 3.4 | 点击 toggle 按钮 emit('toggle-view', blockId) | emit 信号+blockId | 2.3/6.2 |
| 3.5 | 点击 menu 按钮 emit('toggle-menu', blockId) | emit | 2.3/6.2 |
| 3.6 | 点击 copy 按钮 emit('copy-code', blockId) | emit | 2.3/6.2 |
| 3.7 | 点击 download 按钮 emit('download-png', blockId) | emit | 2.3/6.2 |
| 3.8 | 点击 fullscreen 按钮 emit('fullscreen', blockId) | emit | 2.3/6.2 |
| 3.9 | mousedown resize-handle emit('start-resize', blockId, startY) | emit+startY | 2.3/6.2 |
| 3.10 | resizeEnabled=false 不渲染 resize-handle | plantuml 差异 | 2.1/I2 |
| 3.11 | touchEnabled=false 不绑定 touch 事件 | plantuml 差异 | 2.1/I2 |
| 3.12 | toggleFullscreen() 打开 .{prefix}-modal-overlay | modal v-if isFullscreen | 2.4.1 |
| 3.13 | modal-title 文本 = modalTitle prop | 'Mermaid Diagram' 等 | 2.4.1 |
| 3.14 | closeFullscreen()(Escape/关闭按钮) 移除 overlay | modal 关闭+panZoom destroy | 2.4.1 |

### 文件 4：`thin-wrappers.spec.ts`（三薄包装差异化测试）

**路径**：`src/components/diagrams/__tests__/thin-wrappers.spec.ts`
**类型**：组件集成（mount MermaidDiagram/PlantUmlDiagram/SvgDiagram，断言差异 props 传给 BaseDiagram）
**测试点**：12

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 4.1 | MermaidDiagram baseProps：brFix=true/viewBox=g-root/filename=mermaid-diagram | mermaid 专有 | 3.1/3.4 |
| 4.2 | MermaidDiagram pngBackground=#ffffff/800x600/touch=true/resize=true | mermaid 差异 | 3.4 |
| 4.3 | MermaidDiagram defineExpose 8 项（含 exportMermaidToPng 别名） | 保真 P1 I2 | 3.1 |
| 4.4 | MermaidDiagram 声明 5 emit（zoom-in/out/reset/fullscreen/download-png） | 保真 P1 I2 | 3.1 |
| 4.5 | PlantUmlDiagram touchEnabled=false/resizeEnabled=false | plantuml 差异 | 3.2/3.4 |
| 4.6 | PlantUmlDiagram 无 refresh/无 toggle-text/无 Copied（差异 props） | menuClickOutside=false 等 | 3.2/6.3 |
| 4.7 | PlantUmlDiagram defineExpose 8 项（含 exportPlantUmlToPng 别名） | 保真 | 3.2 |
| 4.8 | PlantUmlDiagram 无 emit 声明（attrs fallthrough） | 保真 P1 I2 | 3.2 |
| 4.9 | SvgDiagram pngBackground=transparent/400x300/brFix=false | svg 透明差异 | 3.3/3.4 |
| 4.10 | SvgDiagram panZoomInitTryCatch=true（warn+null） | svg 容错差异 | 3.3/3.4 |
| 4.11 | SvgDiagram defineExpose 仅 3 项（toggleFullscreen/downloadPng/refreshPanZoom） | 保真 P1 I2 | 3.3 |
| 4.12 | 三薄包装按 blockIndex 查 sourcesMap（getMermaidSvgByIndex 等） | 查找键统一 blockIndex | 4.3 修订3 |

### 文件 5：`snapshot-html.spec.ts`（HTML 输出字符级一致）

**路径**：`src/components/diagrams/__tests__/snapshot-html.spec.ts`
**类型**：快照测试（vitest toMatchInlineSnapshot/.snap）
**测试点**：8

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 5.1 | mermaid 围栏块 render 输出 html 快照 | 占位容器+codeViewHtml 字符级 | 7.2 |
| 5.2 | plantuml 围栏块 render 输出 html 快照 | 字符级 | 7.2 |
| 5.3 | svg 围栏块 render 输出 html 快照（净化后） | 字符级 | 7.2 |
| 5.4 | 三族混合 render 输出 html 快照 | 三族共存结构 | 7.2 |
| 5.5 | 默认 code block(python) render 输出 html 快照 | 非 diagram 走默认 | 7.2 |
| 5.6 | svg DOMPurify 净化后 code 快照（无 script/onclick/foreignObject） | 安全债 | 5.4/维度5 |
| 5.7 | mermaid codeViewHtml（escapeHtml 同步）快照 | 转义后字符级 | 5.2 |
| 5.8 | BaseDiagram 挂载后 .{prefix}-block outerHTML 结构快照 | DOM 结构语义一致 | 7.2 |

### 文件 6：`error-handling-mount.spec.ts`（错误处理跨层）

**路径**：`src/components/diagrams/__tests__/error-handling-mount.spec.ts`
**类型**：组件集成（mount MarkdownViewer/BaseDiagram，注入 error 标记，断言错误 UI）
**测试点**：5

| # | 测试点 | 测什么 | P2 节 |
|---|--------|--------|-------|
| 6.1 | mermaid render 抛错→mountPoint innerHTML = mermaid-error div | 字符级保真 mermaid-error | 4.4.1/维度9 |
| 6.2 | plantuml validateSource 失败→切 code 视图+dataset.rendered=true | diagram-mode 移除 is-active，code-mode 加 | 4.4.1/维度9 |
| 6.3 | svg 解析失败→mountPoint innerHTML = svg-error div | vueRender catch 兜底 | 4.4.1/维度9 |
| 6.4 | preRender error 标记 sourcesMap.error（不操作 DOM） | composable 阶段只标记 | 4.4.1 修订2 |
| 6.5 | mount 阶段消费 error 标记写错误 UI | mountPoint 存在时写 DOM | 4.4.1 |

### 文件 7：`e2e/t022-diagram-refactor.spec.ts`（Playwright，ui_affected 强制）

**路径**：`e2e/t022-diagram-refactor.spec.ts`（新建）+ 复用现有 e2e
**类型**：Playwright E2E（需 debug backend :8888）
**测试点**：8（覆盖现有 e2e 未覆盖的 BDD；现有 e2e 保留作回归）

| # | 测试点 | 测什么 | BDD 维度 |
|---|--------|--------|----------|
| 7.1 | plantuml toggle：无 refresh/无 toggle-text 更新 | plantuml 差异保真 | 维度2 |
| 7.2 | plantuml copy-code：无 Copied 反馈（仅 console.log） | plantuml 差异 | 维度2 |
| 7.3 | svg PNG 下载：透明背景+文件名 svg-diagram-*.png | svg 差异 | 维度2 |
| 7.4 | mermaid PNG 下载：白底+fresh re-render+文件名 mermaid-diagram-*.png | mermaid 差异 | 维度2 |
| 7.5 | renderToken 防竞态：快速切主题无旧 SVG 覆盖 | 竞态保护 | 维度3 |
| 7.6 | mermaid cache 命中：切主题再切回不重新 render | 性能不退化 | 维度4 |
| 7.7 | 响应式断点 <=768px：header padding/toggle-text 隐藏/action-btn 尺寸 | 响应式 | 维度6 |
| 7.8 | resize-handle 拖拽改高（min 200，maxHeight=none） | mermaid/svg resize | 维度6 |

### 拆分汇总

| 文件 | 类型 | 测试点 | <15 |
|------|------|--------|-----|
| 1 useCodeBlockRenderer.spec.ts | 纯函数 | 13 | 是 |
| 2 useMarkdown-registry.spec.ts | 纯函数 | 12 | 是 |
| 3 BaseDiagram.spec.ts | 组件集成 | 14 | 是 |
| 4 thin-wrappers.spec.ts | 组件集成 | 12 | 是 |
| 5 snapshot-html.spec.ts | 快照 | 8 | 是 |
| 6 error-handling-mount.spec.ts | 组件集成 | 5 | 是 |
| 7 e2e/t022-diagram-refactor.spec.ts | Playwright | 8 | 是 |
| **新增合计** | | **72** | |

加现有 140 单测（保持绿）= 重构后 212 单测全绿 + e2e 全绿。

---

## 第 3 节：BDD → 测试映射表（P1 29 条逐条映射）

> 每条 BDD 必须有对应测试（test-designer 质量门槛）。

### 维度 1：渲染输出（5 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 1 | mermaid 围栏→.mermaid-block/.mermaid-viewer-mount/svg/diagram is-active/code 非活跃 | 文件2.3 + 文件5.1 + 现有 SvgBlock TC-12 |
| 2 | svg 围栏→.svg-block/.svg-label=SVG/toggle 按钮/svgContent 净化无 script | 文件2.3/2.7 + 文件5.3 |
| 3 | 内联 svg 不产生 .svg-block | 文件2.11 + 现有 SvgBlock TC-10 |
| 4 | plantuml 围栏→.plantuml-block/label=PLANTUML/串行执行 | 文件2.3 + 文件1.8 + 文件5.2 |
| 5 | 三族共存互不干扰 | 文件2.5 + 文件5.4 + 现有 SvgBlock TC-12 |

### 维度 2：按钮交互（7 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 6 | mermaid toggle→is-active 互换+toggle-text Diagram/Code+dispatch mermaid-refresh | 文件3.4 + 文件7.1(plantuml 反例) + 现有 e2e mermaid.spec |
| 7 | plantuml toggle→仅 is-active 互换，无 refresh，无 toggle-text | 文件4.6 + 文件7.1 |
| 8 | mermaid copy-code→剪贴板+Copied 2s 反馈 | 文件3.6 + 现有 e2e |
| 9 | plantuml copy-code→剪贴板+仅 console.log 无反馈 | 文件4.6 + 文件7.2 |
| 10 | svg download-png→文件名 svg-diagram-*.png+有效 PNG+透明背景 | 文件4.9 + 文件7.3 |
| 11 | mermaid download-png→文件名 mermaid-diagram-*.png+白底+fresh re-render | 文件7.4 |
| 12 | mermaid fullscreen→.mermaid-modal-overlay+modal-title+svg 可见+Escape 关闭 | 文件3.12/3.13/3.14 + 现有 e2e mermaid-visual |

### 维度 3：状态保持（2 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 13 | 渲染中切主题→旧 renderToken 中途 return，无旧 SVG 覆盖新 SVG | 文件1.5 + 文件7.5 |
| 14 | 文件树/TOC/滚动状态保持（不动 EntryDetailView 主体） | 现有 FileTree.spec(13)+回归保护 |

### 维度 4：性能（2 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 15 | mermaidCache key=theme-code，切主题再切回命中 cache 不重新 render | 文件1.1/1.6 + 文件7.6 |
| 16 | 首屏时间不显著高于重构前基线（P3 录制红线，P5 对比） | 文件5(快照基线)+P5 性能对比 |

### 维度 5：安全（4 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 17 | svg 含 script alert(1)→净化后无 script 无 alert(1) | 文件2.7 + 文件5.6 |
| 18 | svg 含 onclick=alert(1)→净化后无 onclick，保留合法元素 | 文件2.8 + 文件5.6 |
| 19 | svg 含 foreignObject→净化后无 foreignObject（大小写不敏感） | 文件2.9 + 文件5.6 |
| 20 | 整体 HTML 经 DOMPurify→无内联事件处理器，data-action 白名单保留 | 文件2.10 |

### 维度 6：响应式（2 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 21 | <=768px→header padding 6px 10px/toggle-text 隐藏/action-btn 26x26/content min-height 150px | 文件7.7 |
| 22 | resize-handle mousedown 拖拽→content 高度随鼠标(min 200/maxHeight=none)，mouseup 固定 | 文件3.9 + 文件7.8 |

### 维度 7：主题切换（2 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 23 | 切 dark→watch 触发 renderContent+mermaid 重新 render+panZoom 重初始化+dark CSS 生效 | 文件1.1 + 文件7.5 + 现有 e2e viewer TC-030 |
| 24 | svg code 视图切主题→Shiki 高亮重新挂载(highlightCode 用新 theme) | 文件1.9 + 文件7.5 |

### 维度 8：CSP 合规（1 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 25 | 去 data-action 改 emit→无新内联事件，主应用 CSP 不违规，data-action 保留白名单 | 文件2.10 + 文件3.4-3.9(emit 非 inline) |

### 维度 9：错误处理（3 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 26 | mermaid 语法错误抛错→mountPoint.innerHTML=mermaid-error div | 文件1.7 + 文件6.1/6.4/6.5 |
| 27 | plantuml validateSource 失败→切 code 视图+dataset.rendered=true | 文件6.2 |
| 28 | svg 解析失败→mountPoint.innerHTML=svg-error div | 文件6.3 |

### 量化可扩展性（1 条）

| # | BDD 摘要 | 测试文件.点 |
|---|----------|------------|
| 29 | 新增 d2 类型<=1 文件+1 行注册，不改 BaseDiagram/useCodeBlockRenderer/MarkdownViewer 核心 | 文件2.2 |

**29 条 BDD 全覆盖**

## 第 4 节：stub 代码清单（P3b 创建，让测试能 import 但断言失败=红灯）

> stub 目的：让新测试文件能 import（无 collection error），但断言全部失败（红灯，证明真在测目标功能）。
> stub 放新目录 `frontend-v3/src/components/diagrams/`，**不删旧组件**（旧组件保持，P4 迁移完成后再删）。

### 4.1 `src/composables/useCodeBlockRenderer.ts`（新建 stub）

```typescript
// STUB - P3b 创建，P4 实现
import { ref } from 'vue'

export interface BlockSource {
  lang: 'mermaid' | 'plantuml' | 'svg' | string
  code: string
  svgContent?: string
  codeViewHtml?: string
  error?: string
}

export function useCodeBlockRenderer() {
  const mermaidCache = new Map<string, string>()
  const sourcesMap = new Map<number, BlockSource>()
  const renderToken = ref(0)
  const instances = {
    mermaid: new Map<string, any>(),
    plantuml: new Map<string, any>(),
    svg: new Map<string, any>(),
  }
  const resizingBlock = ref<string | null>(null)
  const startY = ref(0)
  const startHeight = ref(0)

  function getMermaidSvgByIndex(_index: number): string { return '' }
  function getPlantUmlSvgByIndex(_index: number): string { return '' }
  function getCodeViewHtml(_index: number): string | undefined { return undefined }
  function getError(_index: number): string | undefined { return undefined }
  async function preRenderMermaid(_i: number, _c: string, _t: string, _cv: string): Promise<void> {}
  async function preRenderPlantUml(_i: number, _c: string, _t: string, _cv: string): Promise<void> {}
  async function registerSvg(_i: number, _c: string, _t: string): Promise<void> {}
  async function renderMermaidFresh(_c: string, _t: string): Promise<string> { return '' }
  async function renderPlantUmlFresh(_c: string, _t: string): Promise<string> { return '' }
  function nextToken(): number { return 0 }
  function isCurrent(_t: number): boolean { return false }
  function registerInstance(_l: string, _i: string, _inst: any) {}
  function unregisterInstance(_l: string, _i: string) {}
  function getInstance(_l: string, _i: string) { return undefined }
  function beginResize(_id: string, _y: number, _h: number) {}
  function endResize() {}
  function clearInstances() {}

  return {
    mermaidCache, sourcesMap, renderToken, instances,
    resizingBlock, startY, startHeight,
    getMermaidSvgByIndex, getPlantUmlSvgByIndex, getCodeViewHtml, getError,
    preRenderMermaid, preRenderPlantUml, registerSvg,
    renderMermaidFresh, renderPlantUmlFresh,
    nextToken, isCurrent,
    registerInstance, unregisterInstance, getInstance,
    beginResize, endResize, clearInstances,
  }
}
```

### 4.2 `src/components/diagrams/BaseDiagram.vue`（新建 stub）

```vue
<!-- STUB - P3b 创建，P4 实现 -->
<script setup lang="ts">
defineProps<{
  svgContent: string
  codeViewHtml: string
  blockId: string | number
  blockIndex: number
  classPrefix: 'mermaid' | 'plantuml' | 'svg'
  theme: 'light' | 'dark'
  pngBackground: '#ffffff' | 'transparent'
  pngViewBoxFallback: 'g-root-getBBox' | 'width-height-attrs'
  pngFinalSize: { width: number; height: number }
  pngBrFix: boolean
  pngFilenamePrefix: string
  panZoomMinZoom: number
  panZoomMaxZoom: number
  panZoomInitTryCatch: boolean
  touchEnabled: boolean
  resizeEnabled: boolean
  refreshEventName: string
  modalTitle: string
  toggleTextUpdates: boolean
  refreshOnToggle: boolean
  copyFeedback: boolean
  menuClickOutside: boolean
  menuCloseOthers: boolean
}>()
defineEmits<{
  (e: 'fullscreen', blockId: string | number): void
  (e: 'download-png', blockId: string | number): void
  (e: 'toggle-view', blockId: string | number): void
  (e: 'toggle-menu', blockId: string | number): void
  (e: 'copy-code', blockId: string | number): void
  (e: 'start-resize', blockId: string | number, startY: number): void
}>()
defineExpose({
  zoomIn: () => {}, zoomOut: () => {}, resetZoom: () => {},
  toggleFullscreen: () => {}, refreshPanZoom: () => {},
  getSvgElement: () => null, downloadPng: () => {}, exportToPng: (_s: string) => {},
})
</script>
<template><div></div></template>
```

### 4.3 三薄包装 stub（`src/components/diagrams/MermaidDiagram.vue` 等，各新建）

```vue
<!-- STUB MermaidDiagram.vue / PlantUmlDiagram.vue / SvgDiagram.vue - P3b 创建 -->
<script setup lang="ts">
import BaseDiagram from './BaseDiagram.vue'
defineProps<{ code: string; theme: 'light' | 'dark'; blockId: string | number; blockIndex: number; svgContent?: string }>()
const baseProps = {}   // STUB: 空，断言差异 props 失败
defineExpose({})      // STUB: 空，断言 expose 项失败
</script>
<template><BaseDiagram v-bind="baseProps" /></template>
```

> PlantUmlDiagram/SvgDiagram stub 同结构。SvgDiagram stub 的 defineExpose 仅声明 3 项（toggleFullscreen/downloadPng/refreshPanZoom）但实现为空函数，断言失败。

### 4.4 useMarkdown 注册表 stub

> ⚠️ useMarkdown.ts 已存在且被旧测试/旧 MarkdownViewer 依赖。**P3b 不改 useMarkdown.ts**（保持旧路径绿）。
> stub 策略：新建 `src/composables/diagramRegistry.ts` 导出空 registry + registerDiagramType，文件 2 测试 import 此 stub。P4 时再把 registry 接入 useMarkdown。

```typescript
// STUB src/composables/diagramRegistry.ts - P3b 创建
export interface DiagramTypeMeta {
  lang: string
  classPrefix: string
  label: string
  codeViewHighlighter: 'escape-html' | 'shiki-xml'
  sanitize?: (code: string) => string
}
const diagramRegistry = new Map<string, DiagramTypeMeta>()
export function registerDiagramType(_meta: DiagramTypeMeta) {}   // STUB: 不写入
export function getDiagramType(_lang: string): DiagramTypeMeta | undefined { return undefined }
```

### 4.5 stub 完整清单

| stub 文件 | 位置 | 让哪个测试文件能 import |
|-----------|------|------------------------|
| useCodeBlockRenderer.ts | `src/composables/` | 文件 1, 4, 6 |
| BaseDiagram.vue | `src/components/diagrams/` | 文件 3, 4 |
| MermaidDiagram.vue | `src/components/diagrams/` | 文件 4 |
| PlantUmlDiagram.vue | `src/components/diagrams/` | 文件 4 |
| SvgDiagram.vue | `src/components/diagrams/` | 文件 4 |
| diagramRegistry.ts | `src/composables/` | 文件 2 |

> 旧 `src/components/{Mermaid,PlantUml,Svg}Diagram.vue` + 旧 `useMarkdown.ts` **保持不动**（旧测试 + 旧 MarkdownViewer 依赖，保红线绿）。新 `diagrams/` 目录与旧 `components/` 根目录共存，无命名冲突。

---

## 第 5 节：测试策略说明

### 5.1 快照测试

- **录制时机**：P3b 写测试首次跑即生成快照。因 stub 的 render 未实现，`expect(html).toMatchSnapshot()` 因 stub 返回空 → 红灯（正确，证明在测目标）。
- **比对**：P4 实现后跑出快照基线（基于重构前 useMarkdown.render 输出），P5/P6 对比重构前后须 100% 字符级匹配（P2 §7.2）。
- **快照范围**：useMarkdown.render 输出 html 字段（占位容器 + codeViewHtml，不含按钮——按钮迁组件模板）；BaseDiagram 挂载后 `.xxx-block` outerHTML 用结构快照（允许属性顺序差异）。
- **存储**：`__tests__/__snapshots__/snapshot-html.spec.ts.snap`（vitest 默认路径）。

### 5.2 纯函数单测（composable/registry 隔离测试）

- **隔离方式**：直接调 composable 函数（`useCodeBlockRenderer()`），mock 外部依赖（`useMermaid.render`/`usePlantUML.render`/`highlightCode`），不 mount 任何组件，不依赖 DOM。
- **为何优先**：T020 P3 教训——Vue 组件测试过重致 subagent 空返回。纯函数单测轻量、快、断言明确，先跑绿可建立信心再攻组件集成。
- **mock 边界**：`vi.mock('@/composables/useMermaid')` 等，断言渲染器是否被调用、cache 是否写入、token 是否递增，不测真实 mermaid 渲染。

### 5.3 组件测试（BaseDiagram/薄包装 mount）

- **工具**：`@vue/test-utils` mount（已装，v2.4.10），`createPinia()` 注入（MarkdownViewer 用 useThemeStore）。
- **mock**：svg-pan-zoom 模块 mock（`vi.mock('svg-pan-zoom')`），jsdom 无 getBBox 真实实现。
- **emit 断言**：`wrapper.find('.xxx-view-toggle').trigger('click')` → `expect(wrapper.emitted('toggle-view')).toBeTruthy()` + 验证 payload blockId。
- **defineExpose 断言**：`wrapper.vm.$refs` 或 `wrapper.vm` 访问 expose 项，断言存在 + 调用不报错。
- **modal 断言**：调 `wrapper.vm.toggleFullscreen()` → `wrapper.find('.xxx-modal-overlay').exists()` + `nextTick` 等 panZoom init。

### 5.4 现有测试保护（86→140 单测 + e2e 回归）

- **红线基线**：重构前 140 单测 + diagram e2e 全绿（第 1 节），重构期间任一挂立即停。
- **SvgBlock.spec 更新**：P4 迁移 emit 后，L139 `[data-action="toggle-svg-view"]` 改为按 class/click emit 断言（`.svg-view-toggle` + trigger click），点数不变保持 10。
- **旧测试保位**：旧 `__tests__/` 测试不改（除 SvgBlock.spec），新测试放新 `diagrams/__tests__/`，P4 迁移完成 + 旧组件删除后合并。

### 5.5 e2e BDD（Playwright，ui_affected 强制）

- **viewport 配置**（B3 规范）：playwright.config.ts 两 project——`desktop`(1280x800) + `mobile`(390x844)。截图存 `docs/tasks/T022-diagram-renderer-refactor/evidences/`。
- **截图文件名**：`desktop_1280x800.png` / `mobile_390x844.png`，操作类 BDD 两 viewport 截图互不相同。
- **依赖**：debug backend :8888（PEEKVIEW_DEBUG_MODE=1，数据目录 /tmp/peekview-debug/），测试 entry 通过 `curl -X POST http://127.0.0.1:8888/api/v1/entries` 创建（AGENTS.md 铁律 8）。

---

## 门槛自检

| 门槛 | 状态 |
|------|------|
| 1. P3-test-cases.md 存在 + 合法 Header | 通过 |
| 2. 测试文件拆分计划明确（7 文件 + 每文件点数 + 均 < 15） | 通过（13/12/14/12/8/5/8） |
| 3. BDD 29 条逐条有测试映射 | 通过（维度1-9 + 量化 = 5+7+2+2+4+2+2+1+3+1=29） |
| 4. stub 代码清单完整（6 stub 文件，P3b 可直接写） | 通过 |
| 5. 纯函数单测优先原则体现（文件 1、2 纯函数在前） | 通过 |
