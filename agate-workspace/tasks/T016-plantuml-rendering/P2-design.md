---
phase: P2
task_id: T016
task_name: plantuml-rendering
type: design
trace_id: T016-P2-2026-06-20
created: 2026-06-20
status: revised
parent: docs/tasks/T016-plantuml-rendering/P1-requirements.md
---

# P2 方案设计：PlantUML 渲染集成

## 1. 方案概述

仿现有 Mermaid 三层架构（`useMarkdown.ts` 路由 → `useMermaid.ts` 引擎封装 → `MermaidDiagram.vue` 展示组件）新增 PlantUML 平行链路：在 markdown 解析层加 `plantuml` 分支收集源码 Map，新增 `usePlantUML.ts` 封装引擎懒加载 + 串行渲染 + 超时降级，新增 `PlantUmlDiagram.vue` 接收 SVG 字符串并提供与 MermaidDiagram 一致的 pan-zoom / 全屏 / PNG 导出交互。两个引擎的渲染循环物理隔离，PlantUML 串行为硬约束。

### 架构图（文字描述）

```
MarkdownViewer.vue (渲染编排器)
  │
  ├─ useMarkdown().render(content, theme)
  │     ├─ fence lang === 'mermaid'   → mermaidSources Map + 占位 DOM
  │     └─ fence lang === 'plantuml'  → plantumlSources Map + 占位 DOM (新增)
  │
  ├─ await renderMermaidDiagrams()       [现有循环，串行偶然]
  │     └─ useMermaid.render(id, code, theme) → svg string
  │           └─ h(MermaidDiagram, {svgContent, id}) → vueRender
  │
  └─ await renderPlantUmlDiagrams()      [新增循环，串行硬约束]
        └─ usePlantUML.render(code, theme) → svg string (内部临时容器+MutationObserver)
              └─ h(PlantUmlDiagram, {svgContent, id}) → vueRender
```

## 2. P2→P3 门槛声明

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
gate_commands:
  - "cd backend && make test"
  - "cd frontend-v3 && npm run build"
  - "cd frontend-v3 && npm run test"
  - "make debug + Playwright 截图 + vision-helper（真实 CSP 下渲染验证）"
```

## 3. 详细设计

### 3.1 文件改动清单

| 文件 | 类型 | 改动概述 |
|------|------|----------|
| `frontend-v3/public/vendor/plantuml/plantuml.js` | 新增 | 官方 plantuml.js v1.2026.6（TeaVM 编译产物，6.94MB），vendored 二进制 |
| `frontend-v3/public/vendor/plantuml/viz-global.js` | 新增 | viz.js UMD 全局脚本（1.38MB），plantuml.js 的图形布局依赖 |
| `frontend-v3/public/vendor/plantuml/VERSION` | 新增 | 版本记录文件，记录 plantuml.js 版本、viz-global.js 来源、fetch 日期、上游 Release URL |
| `frontend-v3/src/composables/usePlantUML.ts` | 新增 | PlantUML 引擎封装：懒加载 + 串行渲染 + 5s 超时 + 失败降级 |
| `frontend-v3/src/components/PlantUmlDiagram.vue` | 新增 | 展示组件：接收 svgContent/id，提供 pan-zoom/全屏/PNG 导出（PNG 导出独立实现，适配 plantuml SVG 结构） |
| `frontend-v3/src/composables/useMarkdown.ts` | 修改 | ① `MarkdownRenderResult` 接口新增 `plantumlSources: Map<number, string>` 字段；② fence 渲染分支加 `lang === 'plantuml'` 分支，生成 plantuml-block 占位 DOM（结构仿 mermaid-block，label 改为 PLANTUML，CSS 类名前缀 plantuml-） |
| `frontend-v3/src/components/MarkdownViewer.vue` | 修改 | ① 引入 `usePlantUML` + `PlantUmlDiagram`；② 接收 `result.plantumlSources` 存入 `plantumlSourcesMap`；③ 新增 `renderPlantUmlDiagrams()` 串行循环；④ `renderContent()` 末尾 `await renderPlantUmlDiagrams()`；⑤ 新增 plantuml 相关事件委托分支（toggle-plantuml-view / open-plantuml-fullscreen / download-plantuml-png / copy-plantuml-code / toggle-plantuml-menu）；⑥ 新增 `downloadPlantUmlPng()` 全局函数（不复用 `downloadMermaidPng`，因后者硬编码 `mermaid.render`） |

### 3.2 usePlantUML.ts 接口设计

```typescript
export function usePlantUML() {
  // 模块顶层单例状态（非函数内 ref）
  // const engineLoaded = ref(false)
  // let engineLoadingPromise: Promise<void> | null = null

  // 懒加载引擎：viz-global.js + plantuml.js，幂等
  async function ensureLoaded(): Promise<void>

  // 渲染单个图：内部创建临时隐藏 div，调 plantuml.js render(lines, targetId, {dark})
  // MutationObserver 等 SVG 出现，5s 超时，提取 outerHTML 返回字符串
  // 【串行硬约束·引擎层】render 内部通过模块级 Promise 链队列排队，保证引擎调用
  //   串行（详见 §3.4.1）。调用方无需保证串行，引擎层自我防护。
  // 【语法错误降级·第一道】render 入口先调 validateSource 预校验
  //   （@startuml/@enduml 配对），失败直接 reject 不调引擎；详见 §3.7 第 3 层。
  async function render(
    code: string,
    theme: 'dark' | 'light'
  ): Promise<string>  // 返回 SVG outerHTML 字符串；任何失败均 reject

  // 模块级串行化队列（模块顶层声明，非函数内）：
  //   let renderQueue: Promise<unknown> = Promise.resolve()
  // 每次 render 调用：
  //   const result = renderQueue.then(() => doRender(code, theme))
  //   renderQueue = result.catch(() => {})  // 吞掉前一次 reject，防止队列链式卡死
  //   return result                          // 当前调用的 reject 仍传播给调用方
  // doRender = ensureLoaded → validateSource → plantuml.js render → 等 SVG → 检测 → 提取

  // 预校验（内部私有，不暴露）：检查 @startuml/@enduml 配对，详见 §3.7
  function validateSource(code: string): { ok: boolean; reason?: string }

  return { render, ensureLoaded }
```

**返回值设计说明**：虽然 plantuml.js 的 `render(lines, targetId)` 返回 void（SVG 直接写 DOM），但 `usePlantUML.render` 在 MutationObserver 检测到 SVG 后**立即提取 outerHTML** 并 resolve 字符串。设计目的：

1. `PlantUmlDiagram.vue` 接收此字符串作为 `svgContent` prop，接口与 `MermaidDiagram.vue` 完全一致
2. PNG 导出用此字符串（避免 pan-zoom 修改后的 live DOM 状态污染 PNG，与 `MermaidDiagram.vue:exportMermaidToPng` 注释 "uses original SVG string to avoid DOM tainting issues" 一致）
3. 失败时（超时/语法错误）抛 Error，调用方 try/catch 退回源码展示

**错误处理**（所有失败路径均 reject，由调用方 `MarkdownViewer.renderPlantUmlDiagrams` 统一 try/catch 降级为源码展示）：

- **加载失败**（网络/CSP 阻断/文件缺失）：`ensureLoaded()` reject，`render` 调用前 await `ensureLoaded`，故传播到调用方
- **预校验失败**（语法错误降级·第一道）：`render` 入口先调 `validateSource(code)`，检查 `@startuml`/`@enduml` 配对（trim 后以 `@startuml` 开头、以 `@enduml` 结尾、两者计数相等且 startuml 在前 enduml 在后；兼容 `@startuml(name)` 等变体用正则 `/^@startuml(\s|$|\()/`）。失败直接 reject `Error('PlantUML source invalid: missing/balanced @startuml/@enduml')`，**不调引擎**。此道确定性覆盖 BDD-3 主用例（"缺少 @startuml/@enduml 配对，或未闭合的块"）。
- **引擎同步异常**（语法错误降级·第二道）：try/catch 包裹 `plantuml.js render(lines, targetId, {dark})` 调用本身（原型 prototype.html:441 未包裹，本设计补上）。若引擎同步抛异常（如 TeaVM 内部 Error），catch 后 reject。原型未触发此路径，作为防御性兜底。
- **错误 SVG 内容检测**（语法错误降级·第三道，兜底）：MutationObserver 检测到 SVG 后，**提取 outerHTML 前检测内容**是否为错误图。初始启发式规则：SVG 文本节点匹配 `/error|syntax\s*error|cannot|invalid/i`，或 SVG 尺寸异常小（width/height < 50px）。**P4 实现时必须实测确认**：用一个已知语法错误的图（如 `@startuml\ninvalid syntax here\n@enduml`）实际渲染一次，记录错误 SVG 的真实特征字符串（文本内容 / class / 尺寸），据此精确化检测规则。命中则 reject `Error('PlantUML render produced error SVG')`，不返回错误 SVG 字符串。
- **渲染超时**（5s，兜底）：上述均未触发但 SVG 未出现，MutationObserver timer 触发，reject `Error('PlantUML render timeout')`。覆盖"引擎静默不输出"场景。
- **资源清理**（对应评审建议 1）：任何 reject 前（超时/检测命中）必须 disconnect MutationObserver + 从 DOM 移除临时容器。防止 observer 泄漏与 plantuml.js 异步写入已废弃容器累积。

**BDD-3 降级确定性说明**：上述四道检测（预校验 → 同步异常 → 错误 SVG → 超时）构成完整闭环，覆盖 plantuml.js 所有可能行为（同步抛异常 / 写错误 SVG / 静默不输出 / 正常输出）。BDD-3 验收条件"退回展示原始源码"在所有失败场景下均能满足，**不依赖 P6 验收才确定**。P4 实现时需实测错误 SVG 特征以精确化第三道检测规则（从启发式初始规则到实测确认规则），但四道检测的框架与触发顺序在 P2 已确定，P4 照此实现即可。

### 3.3 加载策略实现

**问题**：viz-global.js 是全局脚本（非 ES module），Vite 的 `import()` 不适用；plantuml.js 是 ES module 但位于 `public/` 不在 Vite 模块图内。

**方案**：两层加载器，串行保证顺序。

**第一层：viz-global.js 懒加载器**（运行时 script 注入）

```
function loadVizGlobal(): Promise<void>
  - 检查 window 是否已有 viz 全局对象（如 window.Viz 或特定标识），有则立即 resolve
  - 否则创建 <script> 元素：src='/vendor/plantuml/viz-global.js'，async=false
  - 监听 script.onload → resolve；script.onerror → reject(Error('viz-global.js load failed'))
  - document.head.appendChild(script)
  - 模块级 Promise 缓存，防止重复注入
```

**第二层：plantuml.js 动态 import**

```
async function loadPlantUmlEngine(): Promise<{render: Function}>
  - await loadVizGlobal()  // 串行保证 viz 先就位
  - return await import(/* @vite-ignore */ '/vendor/plantuml/plantuml.js')
  - @vite-ignore 关键：阻止 Vite 尝试把 public/ 文件纳入构建模块图
  - 模块级 Promise 缓存，防止重复 import
```

**加载时机**：页面级，非块级。

- `MarkdownViewer.renderContent()` 拿到 `result.plantumlSources` 后，若 `Map.size > 0`，在 `renderPlantUmlDiagrams()` 入口处调 `usePlantUML.ensureLoaded()`（幂等，多块只加载一次）
- 若 `Map.size === 0`，**不触发任何加载**（BDD-5 验收点：无 plantuml 块时网络请求中不出现 plantuml.js / viz-global.js）

**CSP 命中分析**（详见 §4）：`/vendor/plantuml/` 同源，动态 `<script src>` 和动态 `import()` 均受 `'self'` 约束，命中通过。

### 3.4 串行渲染循环设计

**决策**：两个物理隔离的渲染循环，不共用路径。

**理由**（对照 P1 §3.8）：

- PlantUML 串行是**硬约束**（引擎共享内部状态，并发静默覆盖，原型已验证）
- Mermaid 串行是**偶然**（性能可接受，未并行化；未来可能优化为并行）
- 若共用循环，未来 Mermaid 并行化改造会误伤 PlantUML

**实现位置**：`MarkdownViewer.vue` 新增 `renderPlantUmlDiagrams()`，与现有 `renderMermaidDiagrams()` 平行。

```
async function renderPlantUmlDiagrams():
  const blocks = contentRef.value.querySelectorAll('.plantuml-block')
  if (blocks.length === 0) return  // BDD-5: 无块不加载
  await ensureLoaded()  // 页面级一次，失败则全部降级

  for (const block of blocks):  // 串行 for...of + await，硬约束
    mountPoint = block.querySelector('.plantuml-viewer-mount')
    if (mountPoint.dataset.rendered === 'true') continue
    index = parseInt(block.dataset.index)
    code = plantumlSourcesMap.get(index)
    if (!code) continue

    try:
      svg = await usePlantUML.render(code, theme.value)  // 串行点
      vNode = h(PlantUmlDiagram, { svgContent: svg, id: `plantuml-${index}` })
      vueRender(vNode, mountPoint)
      mountPoint.dataset.rendered = 'true'
    catch err:
      // 降级：mountPoint 替换为源码 + 错误提示
      mountPoint.innerHTML = '<div class="plantuml-error">...</div>'
```

**串行保证的关键**：`for...of + await usePlantUML.render` 直接保证串行——`usePlantUML.render` 内部调 `plantuml.js render()` 后用 MutationObserver 等 SVG 出现才 resolve，下一个块在当前块 resolve 后才开始。**不依赖组件生命周期时序**（组件挂载在 render resolve 之后）。

**注释要求**（P1 §3.8 明确）：`renderPlantUmlDiagrams` 函数头注释必须写明：

> PlantUML 串行是硬约束：引擎用共享内部状态，并发调用静默覆盖结果。
> 此循环不可改为并行（Promise.all）。Mermaid 的串行是偶然，可独立优化，但此循环不可与 Mermaid 循环合并或同步并行化。

**⚠ 仅有此 for...of 循环不足以保证串行硬约束**（评审 BLOCKER-2）。此循环只保证**单次 `renderPlantUmlDiagrams` 调用内部**串行，无法防止**跨调用并发**：`MarkdownViewer.vue:443-445` 的 `watch(() => [props.content, theme.value], async () => { await renderContent() })` 是 async function，Vue 3 不会自动排队或取消未完成的 async watch 回调。用户在 PlantUML 渲染中（原型 3 图串行 740ms）快速切换条目或主题，会触发第二次 `renderContent` → 第二个 `renderPlantUmlDiagrams` 与第一个并发执行 → `usePlantUML.render` 并发调用 → plantuml.js 共享内部状态静默覆盖（BDD-7 "SVG 内容无串台/覆盖"无法保证）。原型 prototype.html:478 是单页单次 `main()` 调用，未暴露此问题。

跨调用并发防护需 §3.4.1 的两层设计：引擎层模块级队列（硬保证）+ 编排层 watch 取消（防浪费）。

### 3.4.1 并发安全：两层串行化防护（评审 BLOCKER-2 修复）

**设计目标**：保证 plantuml.js 引擎调用在任何并发场景下都串行执行，不依赖调用方纪律。

**两层防护职责划分**：

| 层级 | 位置 | 机制 | 职责 |
|------|------|------|------|
| **L1 引擎层** | `usePlantUML.ts` 模块级 | Promise 链队列 | 硬保证 plantuml.js `render()` 调用串行，无论多少调用方并发。**不可违反，不可移除。** |
| **L2 编排层** | `MarkdownViewer.vue` watch 回调 | renderToken 取消 | 快速切换条目/主题时，丢弃旧条目的渲染结果（不 mount），避免旧 SVG 覆盖新条目 DOM。防浪费 + 防 mount 错位。 |

**为什么两层缺一不可**：

- **仅有 L1 不够**：L1 保证引擎调用串行，但两个并发的 `renderPlantUmlDiagrams` 都会排队把所有 render 调用执行完。旧条目的渲染结果会 mount 到新条目的 DOM 上（`mountPoint` 按 `data-index` 查找，新旧条目 index 可能相同），导致新条目显示旧图。
- **仅有 L2 不够**：L2 的 token 检查在 `await` 之后，但 plantuml.js `render()` 一旦进入引擎无法中断。若两个 `renderContent` 几乎同时调 `usePlantUML.render`，L2 的 token 检查可能在 render 调用之前就过了（两个都认为自己是 latest），但 render 调用本身并发 → 引擎状态覆盖。L2 无法保证引擎调用本身串行，只能保证不 mount 过期结果。

**L1 引擎层串行化设计**（`usePlantUML.ts` 模块顶层）：

```
// 模块顶层（非 usePlantUML() 函数内，所有实例共享）
let renderQueue: Promise<unknown> = Promise.resolve()

async function doRender(code, theme): Promise<string> {
  // ensureLoaded → validateSource → 创建临时容器 → plantuml.js render →
  // MutationObserver 等 SVG → 内容检测 → 提取 outerHTML → 清理 → return svg
  // 任何失败 throw（见 §3.2 错误处理）
}

function render(code: string, theme: 'dark' | 'light'): Promise<string> {
  const result = renderQueue.then(() => doRender(code, theme))
  // 关键：吞掉前一次的 reject，防止一次失败导致整个队列链式 reject（后续调用都被跳过）
  renderQueue = result.catch(() => {})
  // 当前调用的 reject 仍正常传播给调用方（result 未 catch）
  return result
}
```

**关键点**：

1. `renderQueue` 是模块级单例，所有 `usePlantUML()` 实例共享（即使未来多 MarkdownViewer 实例也共用一个队列，引擎串行全局保证）
2. `.catch(() => {})` 仅作用于 `renderQueue`（链的续接），不吞掉返回给调用方的 `result` 的 reject —— 调用方仍能 try/catch 到错误并降级
3. 引擎加载 `ensureLoaded` 也在 `doRender` 内部首次 await，复用同一队列，避免加载与渲染竞争

**L2 编排层取消设计**（`MarkdownViewer.vue`）：

```
// 组件内
let renderToken = 0

async function renderContent() {
  const myToken = ++renderToken   // 本次渲染的令牌
  isLoading.value = true
  try {
    const result = await render(props.content, themeName)
    // 快速切换时，旧 renderContent 的 markdown 解析结果在此被丢弃
    if (myToken !== renderToken) return   // 已被新渲染取代，不更新 DOM
    headings.value = result.headings
    renderedHtml.value = result.html
    mermaidSourcesMap = result.mermaidSources
    plantumlSourcesMap = result.plantumlSources
    emit('headings', result.headings)
    await nextTick()
    if (myToken !== renderToken) return   // 双重检查
    // ...reset mount points...
    await renderMermaidDiagrams()
    if (myToken !== renderToken) return   // mermaid 完成后再次检查
    await renderPlantUmlDiagrams(myToken) // 传入 token
  } catch (err) {
    if (myToken === renderToken) console.error('Markdown render failed:', err)
  } finally {
    if (myToken === renderToken) isLoading.value = false
  }
}

async function renderPlantUmlDiagrams(myToken: number) {
  if (!contentRef.value) return
  const blocks = contentRef.value.querySelectorAll('.plantuml-block')
  if (blocks.length === 0) return
  await ensureLoaded()  // 失败则全部降级
  if (myToken !== renderToken) return   // 加载期间被取消

  for (const block of blocks) {
    if (myToken !== renderToken) return   // 循环内每块前检查，快速退出
    // ...mountPoint / index / code 获取...
    try {
      const svg = await usePlantUML.render(code, theme.value)
      if (myToken !== renderToken) return // await 期间被取消，丢弃 SVG 不 mount
      // mount PlantUmlDiagram...
    } catch (err) {
      if (myToken !== renderToken) return // 已取消，不写错误 UI
      // 降级为源码展示...
    }
  }
}
```

**L2 token 机制关键点**：

1. `renderToken` 是组件内闭包变量（非模块级，每个 MarkdownViewer 实例独立计数）
2. 每次 `renderContent` 入口 `++renderToken`，捕获 `myToken`
3. 在每个 `await` 之后检查 `myToken !== renderToken`，若不等说明有更新的渲染启动，当前渲染立即 return（丢弃结果）
4. `finally` 中也检查 token，只有最新渲染才更新 `isLoading`（避免旧渲染把 loading 提前关掉）
5. **L2 不影响 L1**：即使 L2 取消了（return），L1 队列中已排队的 `doRender` 仍会执行完（引擎调用不可中断），但其结果被丢弃不 mount。这是可接受的浪费（最多一个图的渲染耗时，原型单图 436ms）。

**与 Mermaid 路径的关系**：L2 的 token 机制同时保护 `renderMermaidDiagrams`（Mermaid 虽串行是偶然，但快速切换同样导致 mount 错位）。本设计在 `renderMermaidDiagrams` 后也加 token 检查，作为顺带修复（不改变 Mermaid 引擎行为，只防 mount 错位）。**L1 引擎层队列仅 PlantUML 有**，Mermaid 引擎本身并发安全不需要。

**P6 验收点**（BDD-7 并发场景）：

- 构造含 3 个 plantuml 块的条目 A，渲染进行中（740ms 窗口内）快速切换到条目 B（含不同 plantuml 块）
- 验证：条目 B 的 plantuml 块全部正确渲染（无串台 A 的图），条目 A 的渲染被丢弃（不 mount 到 B），控制台无 plantuml.js 内部状态错误
- 验证：快速来回切换主题（dark↔light）多次，最终渲染结果与当前主题一致

### 3.5 API 衔接方案选择（X/Y）及理由

**初判**：P1 倾向方案 Y（新建 PlantUmlDiagram.vue，plantuml.js 直接渲染进组件容器），理由是避免 DOM→字符串→DOM 往返。

**深入分析后发现的关键约束**（[SCOPE+] 发现，详见 §5）：

1. **`MarkdownViewer.vue:downloadMermaidPng` 是 mermaid 硬编码全局函数**（line 78-214），调用 `mermaid.render('export-${blockId}', code)` 重新生成 SVG。PlantUML **无法复用**此路径——`mermaid.render` 是 Mermaid 引擎专属。这意味着无论选 X 还是 Y，PlantUML 的 PNG 下载都必须走独立路径。

2. **`MermaidDiagram.vue` 内部耦合 mermaid 特定假设**：

   - `svg.removeAttribute('width')` / `svg.style.width = '100%'`（line 72-77）假设 SVG 有 width/height 属性，plantuml SVG 未必有
   - `exportMermaidToPng` 的 viewBox/g.root 解析（line 234-271）针对 mermaid SVG 结构
   - 复用 `MermaidDiagram.vue` 需打补丁验证 plantuml SVG 兼容性，违反"保持 mermaid 路径稳定"原则

3. **方案 X 的"DOM 提取 outerHTML"链路复杂度被高估**：实际上 `usePlantUML.render` 内部用一个临时隐藏 div 接收 plantuml.js 写入，MutationObserver 一旦检测到 SVG 立即提取 outerHTML，临时 div 丢弃。这是一次性操作，非持续耦合。提取的字符串是 plantuml.js 原生产出，与 `mermaid.render` 返回的字符串性质相同（都是干净 SVG，未受 pan-zoom 等运行时修改）。

**最终决策**：**方案 X 的实现路径 + 方案 Y 的组件命名**（混合方案，记为 **方案 X'**）

具体：

- **实现路径用 X**：`usePlantUML.render(code, theme)` 内部临时容器渲染 + 提取 outerHTML 返回字符串
- **展示组件用 Y 命名**：新建 `PlantUmlDiagram.vue`，**不修改** `MermaidDiagram.vue`
- **接口对齐**：`PlantUmlDiagram.vue` 的 props 与 `MermaidDiagram.vue` 一致（`svgContent: string`, `id: string`），但内部 PNG 导出逻辑独立实现（参照 `MermaidDiagram.vue:exportMermaidToPng` 但适配 plantuml SVG 结构）

**核心理由**：

1. **PNG 导出双路径不可避免**（[SCOPE+] 发现），无论 X/Y 都需独立实现，故 Y 的"避免字符串往返"优势不成立
2. **保持 MermaidDiagram.vue 稳定**：不复用、不修改，避免 mermaid 路径回归风险
3. **接口对称**：与 Mermaid 路径（`useMermaid.render → string → MermaidDiagram`）完全对称，降低 P7 一致性检查成本
4. **临时容器提取是一次性的**：不与展示组件持续耦合，复杂度可控
5. **PNG 导出可独立适配 plantuml SVG 结构**：避免 mermaid 特定的 viewBox/g.root 假设（P1 §3.3 风险点）

**与 P0-brief/原型结论的"零改动复用"说法对比**：P0-brief 称 `MermaidDiagram.vue` 复用为零改动，本设计**否决此说法**。理由：`MarkdownViewer.vue:downloadMermaidPng` 全局函数硬编码 mermaid.render，是 P1 §3.3 已识别的隐含风险，本设计在 P2 进一步发现"PNG 导出双路径不可避免"，故 PlantUmlDiagram.vue 必须独立实现 PNG 导出。MermaidDiagram.vue 保持零改动，但不复用。

### 3.6 PNG 导出兼容性处理方案

**问题**（P1 §3.3）：`MermaidDiagram.vue:exportMermaidToPng` 解析 SVG 字符串时依赖 viewBox 和 `g.root` 类名。PlantUML SVG 结构未知。

**方案**：`PlantUmlDiagram.vue` 内部实现独立的 `exportPng()` 方法，**不复制** mermaid 的 viewBox/g.root 假设，改用更通用的尺寸提取策略：

```
async function exportPng(): Promise<Blob>:
  svgString = props.svgContent  // usePlantUML.render 返回的干净字符串
  fixedSvg = svgString.replace(/<br>/gi, '<br/>')
  svgEl = DOMParser.parseFromString(fixedSvg, 'image/svg+xml').documentElement

  // 通用尺寸提取（按优先级）：
  // 1. viewBox 属性（plantuml SVG 通常有，格式 "0 0 W H"）
  // 2. width/height 属性（plantuml SVG 通常有，如 "795" 或 "795px"，需 parseInt）
  // 3. 临时挂载到隐藏 DOM + getBoundingClientRect()（兜底）
  // 4. final fallback: 800x600（与 MermaidDiagram.vue 一致）

  // 后续 canvas 绘制流程与 MermaidDiagram.vue 一致：
  // - setAttribute width/height
  // - XMLSerializer serialize
  // - btoa(unescape(encodeURIComponent(...))) → data URL
  // - Image onload → canvas drawImage → toBlob
```

**P5/P6 验证项**：

- 检查 plantuml SVG 实际结构（是否有 viewBox / width / height 属性）
- 实测 PNG 导出图像比例正确、无黑边/截断（BDD-8 验收点）
- 若 plantuml SVG 结构异常（如只有 width 没 viewBox），按通用策略兜底

**降级**：若 `exportPng()` 抛错，`downloadPng()` catch 后 `console.error` + `alert('Failed to download PNG')`，与 `MarkdownViewer.vue:downloadMermaidPng` 行为一致。

### 3.7 失败降级策略

**三层降级**：

1. **引擎加载失败**（网络/CSP 阻断/文件缺失）：

   - `ensureLoaded()` reject
   - `renderPlantUmlDiagrams()` 入口 try/catch 捕获
   - 所有 plantuml 块统一替换为源码展示 + "PlantUML 引擎加载失败"提示
   - 不影响 mermaid 块渲染

2. **单块渲染超时**（5s）：

   - `usePlantUML.render` 内部 MutationObserver timer 触发，reject `Error('PlantUML render timeout')`
   - `renderPlantUmlDiagrams()` 循环内 try/catch 捕获
   - 该块 mountPoint 替换为源码 `<pre>` + "渲染超时"提示
   - 循环继续下一块（BDD-4 验收点：不卡死队列）

3. **单块语法错误**（BDD-3，确定性方案，详见 §3.2 错误处理）：

   `usePlantUML.render` 内部四道检测依次触发，任一命中即 reject，调用方 try/catch 降级为源码展示：

   - **第一道·预校验**（`validateSource`，在调引擎前）：检查 `@startuml`/`@enduml` 配对。失败直接 reject，**不调引擎**。确定性覆盖 BDD-3 主用例"缺少 @startuml/@enduml 配对，或未闭合的块"。
   - **第二道·引擎同步异常**：try/catch 包裹 `plantuml.js render()` 调用本身（原型未包裹，本设计补上）。引擎同步抛异常时 catch → reject。
   - **第三道·错误 SVG 内容检测**（兜底）：MutationObserver 检测到 SVG 后，提取 outerHTML 前检测内容是否为错误图。初始启发式规则：文本匹配 `/error|syntax\s*error|cannot|invalid/i` 或尺寸 < 50px。**P4 实现时实测确认**：用已知语法错误图实际渲染，记录错误 SVG 真实特征，精确化规则。命中 → reject，不返回错误 SVG。
   - **第四道·超时兜底**：引擎静默不输出任何 SVG，5s 超时 → reject。

   **降级结果**：该块 mountPoint 替换为源码 `<pre>` + 错误提示（结构见下方降级 UI）。循环继续下一块（BDD-4 "不卡死队列"同此机制）。

   **确定性保证**：四道检测覆盖 plantuml.js 所有可能行为（抛异常 / 写错误 SVG / 静默 / 正常），BDD-3 "退回展示原始源码"在所有失败场景下均满足。**不依赖 P6 验收才确定降级方案**——P4 实现时仅需实测精确化第三道规则的特征字符串，框架与触发顺序已定。

**降级 UI 结构**（仿 `mountPoint.innerHTML = '<div class="mermaid-error">Failed to render diagram</div>'`）：

```html
<div class="plantuml-error">
  <span>⚠ PlantUML 渲染失败</span>
  <pre class="plantuml-fallback-code"><code>{escapedCode}</code></pre>
</div>
```

### 3.8 暗色主题处理

**传递路径**：`MarkdownViewer.renderContent()` → `theme.value`（'dark' | 'light'）→ `renderPlantUmlDiagrams()` → `usePlantUML.render(code, theme)` → plantuml.js `render(lines, targetId, {dark: theme === 'dark'})`

**关键点**：

- `usePlantUML.render` 接收 `'dark' | 'light'`，内部转换为 `{dark: boolean}` 传给 plantuml.js
- 主题切换时（`watch(() => [props.content, theme.value])` 触发 `renderContent`），plantuml 块重新渲染——需在 `renderPlantUmlDiagrams` 入口清除 `mountPoint.dataset.rendered` 标记（仿 `renderMermaidDiagrams` 中清除 `.mermaid-viewer-mount` 的 `data-rendered`）
- P4 实现时验证 `{dark: true}` 选项的实际视觉效果
- P6 验收对照 Mermaid 暗色模式的视觉一致性（背景色、文字对比度、连线颜色）

**P1 §3.4 风险缓解**：原型未测 `{dark: true}`，本设计明确传递路径，P4/P6 必须实测。

## 4. CSP 兼容性分析

现有 CSP：`script-src 'self' 'unsafe-eval'`（`unsafe-eval` 为 Mermaid/d3 的 `new Function()` 必需，不可移除）。

### 4.1 vendored 文件同源加载是否命中 'self'

- `frontend-v3/public/vendor/plantuml/` 经 Vite 构建后位于 `/vendor/plantuml/`，与主文档同源
- 动态 `<script src="/vendor/plantuml/viz-global.js">`：受 `script-src 'self'` 约束，同源命中 ✅
- 动态 `import('/vendor/plantuml/plantuml.js')`：受 `script-src 'self'` 约束，同源命中 ✅
- **无需 `script-src 'unsafe-inline'`**：vendored 文件是外部资源（非内联脚本），不受 inline 约束

### 4.2 plantuml.js (TeaVM JS 后端) 是否需要额外 CSP 指令

- plantuml.js 是 TeaVM 编译为 **JS 后端**的产物（非 WasmGC），原型验证未触发 wasm 错误
- TeaVM JS 后端可能使用 `eval` / `new Function()`，但 `'unsafe-eval'` 已允许
- **预期无需 `wasm-unsafe-eval`**：若 TeaVM JS 后端不加载 .wasm 模块，则不触发 wasm 相关 CSP 指令
- **P5/P6 铁律验证**：必须在 `make debug` 真实 CSP 下 Playwright 实跑，检查控制台无 CSP 违规报告

### 4.3 viz-global.js 是否触发 eval/wasm

- viz-global.js 是 viz.js（Graphviz 的 Emscripten 编译产物）的 UMD 全局脚本
- viz.js 历史上使用 `asm.js`（非 wasm），故需 `'unsafe-eval'`（已允许）
- 若新版本 viz.js 切换到 wasm，可能需 `wasm-unsafe-eval`——**这是 P5/P6 必须验证的风险点**
- **预期兼容**：原型验证 viz-global.js 在无 CSP 限制下正常工作，且原型结论 §3.4 明确"未触发 wasm 相关错误"

### 4.4 CSP 风险结论

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| viz-global.js 触发 wasm 需 `wasm-unsafe-eval` | 低 | 高（需改 CSP，安全策略变更） | P5/P6 真实 CSP 下 Playwright 验证；若触发则 [NEED_CONFIRM] 主 Agent 拍板是否加 `wasm-unsafe-eval` |
| plantuml.js TeaVM 触发未知 CSP 指令 | 低 | 中 | 同上 |
| 动态 import 被 CSP 阻断 | 极低 | 高 | 同源已命中 'self'，预期无问题 |

**结论**：预期无需改 CSP，但 P5/P6 必须在 `make debug` 真实 CSP 下验证。若意外需要 `wasm-unsafe-eval`，属于安全策略变更，**[NEED_CONFIRM] 主 Agent 拍板**。

## 5. [SCOPE+] 发现（P1 遗漏的隐含需求）

### 5.1 PNG 导出双路径不可避免

**发现**：`MarkdownViewer.vue:downloadMermaidPng`（line 78-214）是 mermaid 硬编码的全局 PNG 下载函数，调用 `mermaid.render('export-${blockId}', code)` 重新生成干净 SVG 用于导出。PlantUML 无法复用此路径，因为 `mermaid.render` 是 Mermaid 引擎专属 API。

**影响**：

- PlantUML 的 PNG 下载必须独立实现（在 `PlantUmlDiagram.vue` 内部 `exportPng()` 方法 + `MarkdownViewer.vue` 新增 `downloadPlantUmlPng()` 全局函数）
- 这否决了 P0-brief "MermaidDiagram.vue 零改动复用"的说法——展示组件不复用，PNG 导出独立实现

**已纳入 §3.5 方案选择决策**。

### 5.2 useMarkdown.ts 接口扩展

**发现**：`MarkdownRenderResult` 接口需新增 `plantumlSources: Map<number, string>` 字段，调用方 `MarkdownViewer.vue` 需相应接收。

**影响**：`useMarkdown.ts` 和 `MarkdownViewer.vue` 都需修改。已在 §3.1 文件改动清单中列出。

### 5.3 DOMPurify ADD_ATTR 检查

**发现**：现有 `DOMPurify.sanitize` 调用（useMarkdown.ts:296-299）的 `ADD_ATTR` 列表为 `['data-action', 'data-code', 'data-line', 'data-block-id', 'data-index', 'data-mode', 'target', 'rel']`。plantuml-block 占位 DOM 使用的属性（data-action/data-block-id/data-index/data-mode）均已在白名单内。

**影响**：预期无需扩展 ADD_ATTR。但 P6 验收需确认 plantuml-block 占位 DOM 的属性不被 DOMPurify 删除（仿 mermaid-block 结构，预期安全）。

### 5.4 PlantUmlDiagram.vue 代码复制维护成本

**发现**：方案 X' 决策下，`PlantUmlDiagram.vue` 需复制 `MermaidDiagram.vue` 的 pan-zoom / 全屏 / touch 逻辑（约 300 行），仅 PNG 导出独立实现。

**影响**：

- 短期：代码重复，维护漂移风险
- 长期：未来可抽 `useDiagramViewer.ts` composable 共享 pan-zoom/全屏逻辑，但 T016 不做此重构（out-of-scope）
- P7 一致性检查需关注两组件接口对称性，但允许实现独立演化

**标注**：此为方案 X' 的权衡代价，主 Agent 已在 §3.5 决策理由中接受。

## 6. 风险与缓解（对照 P1 风险表）

| P1 风险 | P2 设计缓解 |
|---------|------------|
| plantuml.js 体积 6.94MB + viz-global.js 1.38MB | §3.3 页面级懒加载，仅检测到 plantuml 块才加载；模块级 Promise 缓存防止重复加载 |
| 并发渲染陷阱 | §3.4 单循环串行 + §3.4.1 两层防护：L1 引擎层模块级 Promise 链队列（硬保证 plantuml.js 调用串行，不依赖调用方）+ L2 编排层 renderToken 取消（快速切换条目/主题时丢弃旧渲染结果，防 mount 错位）；函数头注释明确"不可改为并行" |
| CSP 实际兼容性 | §4 详细分析：同源命中 'self'，TeaVM JS 后端预期不需 wasm-unsafe-eval；P5/P6 真实 CSP 下 Playwright 验证；若意外需 wasm-unsafe-eval 则 [NEED_CONFIRM] |
| stdlib 体积 | §7 out-of-scope，T016 不含 stdlib |
| 暗色主题 | §3.8 明确传递路径 `{dark: theme === 'dark'}`，P4/P6 实测视觉一致性 |
| 失败降级 | §3.7 三层降级策略：引擎加载失败/单块超时/单块语法错误；语法错误降级为四道检测闭环（预校验 → 同步异常 → 错误 SVG 内容检测 → 超时），确定性满足 BDD-3，不依赖 P6 才定方案 |
| PNG 导出兼容性（P1 §3.3） | §3.6 独立 exportPng 实现，通用尺寸提取策略（viewBox → width/height → getBoundingClientRect → fallback），P5/P6 实测 |
| API 衔接方案 X/Y（P1 §8 第4项） | §3.5 决策方案 X'（X 实现路径 + Y 组件命名），核心理由：PNG 导出双路径不可避免 + 保持 MermaidDiagram.vue 稳定 |
| MarkdownViewer 串行循环隔离（P1 §3.8） | §3.4 两个物理隔离循环，不共用路径，注释明确防止未来 Mermaid 并行化误伤 |

## 7. 不做的事（范围边界）

- **stdlib 图标库**（awslib/azure/k8s 等）：T016 不含，作为后续独立任务（P1 RESOLVED）
- **语法纠错 UI 提示**：T016 仅保证失败时优雅降级为源码展示，不负责语法纠错（P1 §2.4）
- **抽 useDiagramViewer composable**：T016 允许 PlantUmlDiagram.vue 与 MermaidDiagram.vue 代码重复，未来可重构（§5.4）
- **修改 MermaidDiagram.vue**：保持 mermaid 路径稳定，PlantUML 独立组件（§3.5）
- **修改现有 downloadMermaidPng 全局函数**：保持 mermaid PNG 路径稳定，PlantUML 独立全局函数（§5.1）
- **git-lfs**：8.32MB 一次性进 git 可接受（P1 RESOLVED）
- **plantuml.js / viz-global.js 自动获取脚本**：T016 手动放置 vendored 文件 + VERSION 记录；自动 fetch 脚本可作为后续改善，不阻断 T016
- **多 plantuml 块并发渲染优化**：串行是硬约束，不优化（§3.4）

## 8. [NEED_CONFIRM] 事项

仅一项条件性 [NEED_CONFIRM]：

- **若 P5/P6 验证发现 viz-global.js 触发 wasm 需 `wasm-unsafe-eval`**：属于安全策略变更，主 Agent 拍板是否加 `wasm-unsafe-eval` 到 CSP。预期低概率发生（原型未触发 wasm 错误）。

无其他不可逆决策需主 Agent 确认。

## 9. 参考

- `docs/tasks/T016-plantuml-rendering/P0-brief.md` — 任务简报
- `docs/tasks/T016-plantuml-rendering/P1-requirements.md` — 需求基线（9 条 BDD）
- `docs/tasks/T016-plantuml-rendering/references/prototype.html` — 原型实现（串行队列参考）
- `docs/tasks/T016-plantuml-rendering/references/prototype-conclusion.md` — 原型验证结论
- `frontend-v3/src/composables/useMermaid.ts` — Mermaid 引擎封装（参照对象）
- `frontend-v3/src/composables/useMarkdown.ts` — markdown 解析路由（集成点）
- `frontend-v3/src/components/MermaidDiagram.vue` — 展示组件（接口参照，不复用）
- `frontend-v3/src/components/MarkdownViewer.vue` — 渲染编排器（集成点，串行循环所在）
- `AGENTS.md` — CSP 现状、铁律

## 修订记录

### 2026-06-20 修订（解决 P2 评审 2 个 BLOCKER）

**评审报告**：`docs/tasks/T016-plantuml-rendering/P2-review.md`（status: rejected）

**本次修订解决的 BLOCKER**：

#### BLOCKER-1：BDD-3 语法错误降级方案不确定 → 已解决

**问题**：原 §3.7 第 3 层降级为条件性表述（"若不可接受则..."），默认行为（检测到 SVG 即视为成功）与 BDD-3 验收条件（退回源码）矛盾，降级决策推迟到 P6。

**解决**：在 §3.2 错误处理 + §3.7 第 3 层明确**四道检测闭环**，确定性覆盖 plantuml.js 所有可能行为（同步抛异常 / 写错误 SVG / 静默不输出 / 正常输出）：

1. **预校验**（`validateSource`，@startuml/@enduml 配对，不调引擎直接 reject）— 确定性覆盖 BDD-3 主用例"缺少 @startuml/@enduml 配对"
2. **引擎同步异常** try/catch（补上原型 prototype.html:441 未包裹的 render 调用）
3. **错误 SVG 内容检测**（MutationObserver 检测到 SVG 后、提取前检测；P4 实测确认特征字符串，检测框架已定）
4. **超时兜底**（5s）

降级方案在 P2 已确定，P4 实现时仅需实测精确化第三道规则的特征字符串，**不依赖 P6 验收才定方案**。

#### BLOCKER-2：串行硬约束保证层级不足 → 已解决

**问题**：原 §3.4 仅在 `renderPlantUmlDiagrams` 的 for...of 内串行，`usePlantUML.render` 层面无模块级串行化；`MarkdownViewer.vue:443` watch async 回调无互斥，快速切换条目/主题导致并发调用 plantuml.js → 共享内部状态静默覆盖。

**解决**：新增 §3.4.1 **两层串行化防护**：

- **L1 引擎层**（`usePlantUML.ts` 模块级）：Promise 链队列（`renderQueue`），每次 render 调用排队，硬保证 plantuml.js 调用串行，不依赖调用方纪律。`.catch(() => {})` 吞掉前一次 reject 防队列卡死，当前调用 reject 仍传播给调用方。
- **L2 编排层**（`MarkdownViewer.vue`）：`renderToken` 取消机制，每次 `renderContent` 入口 `++renderToken`，每个 await 后检查 token，快速切换时丢弃旧渲染结果（不 mount），防 mount 错位。

两层缺一不可：L1 保引擎调用串行（防状态覆盖），L2 防 mount 错位（旧图 mount 到新条目 DOM）。L2 顺带给 `renderMermaidDiagrams` 加 token 检查（防 mount 错位，不改变 Mermaid 引擎行为）。

**其他修订**：

- §3.2 接口设计：render 注释补充串行化队列与预校验说明，新增 `validateSource` 内部函数声明
- §6 风险表：更新"并发渲染陷阱"与"失败降级"两行，引用 §3.4.1 两层防护与 §3.7 四道检测
- frontmatter status: draft → revised

**未引入新的 [SCOPE+] / [NEED_CONFIRM]**：本次修订均在原设计范围内补强确定性，未扩展任务范围。L2 token 机制顺带覆盖 Mermaid 的 mount 错位防护属合理一致性改进（不改 Mermaid 引擎行为，仅防 DOM mount 错位），非新范围。原有条件性 [NEED_CONFIRM]（viz-global.js 触发 wasm 需主 Agent 拍板）不变。
