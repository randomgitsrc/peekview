---
phase: P2
task_id: T016
task_name: plantuml-rendering
type: review
role: plan-design-review
trace_id: T016-P2-review-2026-06-20
created: 2026-06-20
status: approved
parent: docs/tasks/T016-plantuml-rendering/P2-design.md
---

# P2 方案设计评审：PlantUML 渲染集成

## 1. 评审结论

**rejected** — 发现 2 个 BLOCKER，会导致 BDD-3/BDD-7 验收不通过或运行时渲染错乱。

| 项 | 数量 |
|----|------|
| BLOCKER | 2 |
| 建议（非阻塞） | 5 |

整体设计架构合理（平行链路、方案 X' 决策、CSP 分析、懒加载策略均成立），但在两个关键点存在设计缺口：**语法错误降级的不确定性**与**串行硬约束的保证层级不足**。修复后可重新提交评审。

---

## 2. BDD 覆盖性检查（逐条）

### BDD-1 正常渲染 PlantUML 代码块（含中文） — ✅ 覆盖

- §3.1-3.4 完整设计了 `useMarkdown.ts` → `usePlantUML.ts` → `PlantUmlDiagram.vue` 渲染链路
- §3.1 plantuml-block 占位 DOM 结构仿 mermaid-block，含 header 工具栏
- 中文渲染：P2 未显式说明中文字体处理路径，但原型已验证（prototype-conclusion.md:39 "中文渲染完全正常，浏览器字体子系统处理"），风险低
- **状态**：覆盖，建议在设计中补一句中文字体依赖说明（见建议 5）

### BDD-2 PlantUML 与 Mermaid 混合存在 — ✅ 覆盖

- §1 架构图 + §3.4 两个物理隔离的渲染循环（`renderMermaidDiagrams` / `renderPlantUmlDiagrams`）
- 两条链路独立，互不依赖引擎状态
- **状态**：覆盖

### BDD-3 PlantUML 语法错误的降级处理 — ❌ 未完全覆盖（BLOCKER-1）

- §3.7 第 3 层降级明确承认 plantuml.js 语法错误时"通常在 container 写入错误信息 SVG 或不写入"
- **矛盾点**：默认行为（MutationObserver 检测到 SVG 即视为成功返回）会把错误 SVG 当作成功结果渲染，而 BDD-3 要求"退回展示原始 PlantUML 源码（高亮代码块形式）"——两者直接冲突
- 设计把关键决策推迟到 P6（"若不可接受，需在 usePlantUML.render 内检测 SVG 文本是否含错误标识字符串"），但未给出检测逻辑的设计（检测什么字符串、如何区分正常 SVG 与错误 SVG）
- prototype-conclusion.md:100 明确"未测试语法错误的降级行为"，属未验证项
- **状态**：BLOCKER — 详见 §3.4

### BDD-4 渲染超时的降级处理 — ⚠️ 覆盖（有清理缺口）

- §3.7 第 2 层：5s 超时 → reject → 循环 try/catch → 降级源码 → 继续下一块
- 满足"不卡死队列"要求
- **缺口**：未说明超时后 MutationObserver disconnect 与临时容器清理（见建议 1）
- **状态**：覆盖，建议改进

### BDD-5 plantuml.js 懒加载 — ✅ 覆盖

- §3.3 页面级加载策略：`plantumlSourcesMap.size > 0` 才触发 `ensureLoaded()`
- §3.4 `renderPlantUmlDiagrams` 入口 `blocks.length === 0` 直接 return
- 模块级 Promise 缓存防重复加载
- **状态**：覆盖

### BDD-6 暗色主题渲染 — ✅ 覆盖

- §3.8 明确传递路径 `{dark: theme === 'dark'}`，主题切换时重新渲染（清除 `data-rendered` 标记）
- 依赖 P4/P6 实测 `{dark: true}` 视觉效果（P1 §3.4 已标注风险）
- **状态**：覆盖（设计层面）

### BDD-7 多个 PlantUML 块串行渲染 — ❌ 部分覆盖（BLOCKER-2）

- §3.4 单个 `renderPlantUmlDiagrams` 循环内串行（for...of + await）✅
- "任一块失败不影响其他块"（循环内 try/catch）✅
- **缺口**：跨 `renderPlantUmlDiagrams` 调用的并发未防护。`MarkdownViewer.vue:443` 的 `watch` async 回调无互斥，用户快速切换条目会导致两个 `renderContent` → 两个 `renderPlantUmlDiagrams` 并发 → `usePlantUML.render` 并发调用 → plantuml.js 共享内部状态静默覆盖
- **状态**：BLOCKER — 详见 §3.4

### BDD-8 展示组件交互复用 — ✅ 覆盖

- pan-zoom / 全屏：PlantUmlDiagram.vue 复制 MermaidDiagram.vue 逻辑（§5.4 接受代码重复）
- PNG 导出：§3.6 独立 `exportPng()`，通用尺寸提取策略
- PNG 异常降级：§3.6 末尾 catch → console.error + alert
- **状态**：覆盖

### BDD-9 真实 CSP 下的渲染 — ✅ 覆盖（设计层面）

- §4 CSP 分析：同源命中 'self'，TeaVM JS 后端预期不需 wasm-unsafe-eval
- §4.4 风险表 + P5/P6 真实 CSP 下 Playwright 验证
- 条件性 [NEED_CONFIRM]：若 viz-global.js 触发 wasm 需主 Agent 拍板
- **状态**：覆盖（实际验证在 P5/P6）

### 覆盖性汇总

| BDD | 状态 | 说明 |
|-----|------|------|
| BDD-1 | ✅ | 中文字体处理路径建议补说明 |
| BDD-2 | ✅ | |
| BDD-3 | ❌ | BLOCKER-1：语法错误降级方案不确定 |
| BDD-4 | ⚠️ | 超时后资源清理缺失（建议） |
| BDD-5 | ✅ | |
| BDD-6 | ✅ | 依赖 P4/P6 实测 |
| BDD-7 | ❌ | BLOCKER-2：跨循环并发未防护 |
| BDD-8 | ✅ | |
| BDD-9 | ✅ | 设计层面覆盖 |

---

## 3. 关键设计点评审

### 3.1 方案 X' 选择（X 实现路径 + Y 组件命名） — ✅ 合理

**评审结论**：方案 X' 决策成立，核心理由有效。

**论据验证**（读 MarkdownViewer.vue 确认）：

- `downloadMermaidPng`（MarkdownViewer.vue:78-214）确实是 mermaid 硬编码全局函数，line 91 `const { svg } = await mermaid.render(\`export-${blockId}\`, code)` 重新生成 SVG。PlantUML 无法复用此路径 — **论据成立**。
- 主工具栏的 "Download PNG" 按钮（useMarkdown.ts:246 `data-action="download-mermaid-png"`）触发此全局函数，PlantUML 必须有自己的 `downloadPlantUmlPng` 全局函数 — **双路径在全局函数层面不可避免，论据成立**。

**需精确化的点**（建议 3）：P2 §3.5 论据"PNG 导出双路径不可避免"的表述可能让人误以为所有 PNG 导出都不可复用。实际上 `MermaidDiagram.vue:exportMermaidToPng`（line 213-330）基于 `props.svgContent`，技术上可复用。P2 选择不复用的真实理由是避免 viewBox/g.root 假设（line 234-271 针对 mermaid SVG 结构）——这也是合理的选择。建议区分这两个层面，使论据更精确。

**方案 X' 的其他理由**也成立：
- 保持 MermaidDiagram.vue 零改动（避免 mermaid 路径回归风险）✅
- 接口对称（useMermaid.render → string → MermaidDiagram 与 PlantUML 路径对称）✅
- 临时容器提取一次性（非持续耦合）✅

### 3.2 串行渲染隔离 — ❌ 不充分（BLOCKER-2）

**P2 设计的串行保证**（§3.4）：
- 两个物理隔离的渲染循环（renderMermaidDiagrams / renderPlantUmlDiagrams）✅
- `renderPlantUmlDiagrams` 内 `for...of + await usePlantUML.render` 保证单循环内串行 ✅
- 注释要求"不可改为并行" ✅

**缺口**：串行硬约束的保证层级在**调用方**（renderPlantUmlDiagrams 的 for...of），而非**引擎封装层**（usePlantUML.render）。这只能防止单次渲染内的并行化，无法防止跨渲染调用的并发。

**并发场景分析**：

1. **快速切换条目**：`MarkdownViewer.vue:443-445` 的 watch 回调是 async function，Vue 3 不会自动排队或取消未完成的 async watch 回调。用户在 PlantUML 渲染中（单图原型 436ms，3 图串行 740ms）切换条目，`props.content` 变化触发第二次 `renderContent`，两个 `renderPlantUmlDiagrams` 并发执行 → `usePlantUML.render` 并发调用 → plantuml.js 共享内部状态静默覆盖。

2. **多 MarkdownViewer 实例**：虽然当前 PeekView 的 EntryDetailView 通常只有一个 MarkdownViewer，但设计未明确排除未来多实例场景。

3. **主题快速切换**：`theme.value` 变化同样触发 watch，与 content 变化叠加可产生并发。

**影响**：P1 §3.8 明确"PlantUML 串行是硬约束（引擎共享内部状态，并发静默覆盖）"。静默覆盖是最难 debug 的问题类型——没有错误提示，图就错了。BDD-7 的"SVG 内容无串台/覆盖"在并发场景下无法保证。

**对比原型**：prototype.html:478-480 的串行循环是单页单次 `main()` 调用，不存在跨调用并发，故原型未暴露此问题。

**修复方向**：在 `usePlantUML.render` 内部实现模块级串行化（Promise 链队列），保证无论多少调用方并发调用，引擎调用都是串行的。例如：

```typescript
let renderQueue: Promise<string> = Promise.resolve('')
function render(code, theme): Promise<string> {
  renderQueue = renderQueue.then(() => doRender(code, theme))
  return renderQueue
}
```

这样即使两个 `renderPlantUmlDiagrams` 并发，`usePlantUML.render` 调用也会自动排队，引擎层面保证串行。

### 3.3 CSP 兼容性分析 — ✅ 充分

**评审结论**：§4 CSP 分析详尽，结论合理。

- §4.1 同源命中 'self' 分析正确（vendored 文件在 `public/vendor/plantuml/` → 构建后 `/vendor/plantuml/` 同源）✅
- §4.2 TeaVM JS 后端不依赖 wasm 的判断有原型验证支撑（prototype-conclusion.md:55 "未触发 wasm 相关错误"）✅
- §4.3 viz-global.js 的 asm.js/wasm 风险识别到位，标注为 P5/P6 必验证项 ✅
- §4.4 风险表 + 条件性 [NEED_CONFIRM]（若需 wasm-unsafe-eval 则主 Agent 拍板）符合安全策略变更流程 ✅

**一个未提及的细节**（建议级，非阻塞）：§3.3 `import(/* @vite-ignore */ '/vendor/plantuml/plantuml.js')` 使用 `@vite-ignore` 跳过 Vite 模块图。需确认 Vite 构建产物中此动态 import 保持原生 browser dynamic import 语义，不被转换。P5 构建验证时检查即可。

### 3.4 失败降级设计 — ❌ BDD-3 降级不完整（BLOCKER-1）

**引擎加载失败降级**（§3.7 第 1 层）— ✅ 完整
- ensureLoaded reject → 全部块降级源码 + 不影响 mermaid

**超时降级**（§3.7 第 2 层）— ✅ 基本完整
- 5s 超时 → reject → 单块降级 → 循环继续
- 缺口：超时后 MutationObserver/临时容器清理（建议 1）

**语法错误降级**（§3.7 第 3 层）— ❌ 不完整

P2 设计原文（§3.7）：

> plantuml.js 通常在 container 写入错误信息 SVG 或不写入
> 前者：MutationObserver 检测到 SVG，视为成功返回——P6 验收需检查错误 SVG 的视觉是否可接受（若不可接受，需在 usePlantUML.render 内检测 SVG 文本是否含错误标识字符串如 "error"/"syntax"，若是则 reject）
> 后者：走超时路径

**问题 1：默认行为与 BDD-3 矛盾**
BDD-3 要求"该块退回展示原始 PlantUML 源码（高亮代码块形式）"。但 P2 的默认行为是"检测到 SVG 即视为成功返回"——如果 plantuml.js 写入错误信息 SVG，usePlantUML.render 会返回这个错误 SVG 字符串，PlantUmlDiagram.vue 会渲染它（错误图而非源码）。这不满足 BDD-3。

**问题 2：条件性方案未设计**
设计说"若不可接受，需在 usePlantUML.render 内检测 SVG 文本是否含错误标识字符串"——但未给出：
- 检测什么字符串（"error"? "syntax"? plantuml.js 实际输出什么？）
- 如何区分正常 SVG 与错误 SVG（plantuml.js 的错误 SVG 结构未知）
- 检测逻辑放在 usePlantUML.render 的哪个环节

**问题 3：时机风险**
把关键降级决策推迟到 P6 验收。如果 P6 才发现需要错误检测，而 P4 实现的 usePlantUML.render 没有这个逻辑，则 P6 验收失败需要回 P4 修改——违反 gate 流程。更糟的情况：如果 plantuml.js 的错误 SVG 没有固定标识字符串（不可检测），则 BDD-3 在当前架构下无法满足。

**修复方向**：P4 实现前（或 P2 修订时）快速验证 plantuml.js 语法错误时的实际行为（写不写 SVG、SVG 内容特征），据此确定降级方案：
- 若不写 SVG → 走超时路径，BDD-3 自然满足
- 若写错误 SVG 且有固定标识 → usePlantUML.render 内检测标识后 reject
- 若写错误 SVG 且无固定标识 → 需替代方案（如 try/catch 包裹 plantuml.js render 调用，或预校验 @startuml/@enduml 配对）

---

## 4. BLOCKER

### BLOCKER-1: BDD-3 语法错误降级方案不确定

**位置**：P2-design.md §3.7 第 3 层降级、§3.2 错误处理

**问题**：plantuml.js 语法错误时可能写入错误 SVG，usePlantUML.render 默认行为（检测到 SVG 即视为成功）与 BDD-3 验收条件（退回展示原始源码）直接矛盾。降级方案为条件性表述（"若不可接受则..."），未给出确定性实现设计。prototype-conclusion.md:100 明确此行为未验证。

**影响**：BDD-3 验收条件无法确定性满足。若 P6 才发现默认行为不可接受，需回 P4 修改 usePlantUML.render，违反 gate 流程。

**修复要求**：P2 修订时（或 P4 实现前）快速验证 plantuml.js 语法错误行为，给出确定性降级方案（不依赖 P6 才确定）。

### BLOCKER-2: 串行硬约束保证层级不足，跨循环并发风险

**位置**：P2-design.md §3.4 串行渲染循环设计

**问题**：串行保证仅在 `renderPlantUmlDiagrams` 的 for...of 循环内（调用方），`usePlantUML.render` 层面无模块级串行化。`MarkdownViewer.vue:443` 的 watch async 回调无互斥，快速切换条目/主题会导致多个 `renderContent` → `renderPlantUmlDiagrams` 并发 → `usePlantUML.render` 并发调用 → plantuml.js 共享内部状态静默覆盖。

**影响**：BDD-7 "SVG 内容无串台/覆盖"在并发场景下无法保证。静默覆盖无错误提示，最难 debug。原型（prototype.html:478 单页单次）未暴露此问题。

**修复要求**：在 `usePlantUML.render` 内部实现模块级串行化（Promise 链队列或 mutex），保证引擎层面串行，不依赖调用方纪律。

---

## 5. 建议（非阻塞改进）

### 建议 1: 超时后资源清理

**位置**：P2-design.md §3.2 usePlantUML.render、§3.7 第 2 层

usePlantUML.render 超时后应明确 disconnect MutationObserver + 移除临时容器（从 DOM 删除）。否则：(a) MutationObserver 泄漏；(b) plantuml.js 可能异步写入 SVG 到已废弃的临时容器，虽不影响展示组件（用的是已提取字符串），但增加无意义 DOM 操作。串行循环中每次 render 创建新临时容器，不清理会累积。

### 建议 2: 确认 viz-global.js 全局变量接口契约

**位置**：P2-design.md §3.3 loadVizGlobal

P2 写"检查 window 是否已有 viz 全局对象（如 window.Viz 或特定标识）"——"如"表明未确认。plantuml.js 依赖 viz-global.js 定义的全局变量，若名字不匹配则加载成功但渲染失败（报错或静默不渲染）。建议 P4 实现前读 viz-global.js 源码确认全局变量名，并在 loadVizGlobal 中精确检查。

### 建议 3: PNG 导出论据精确化

**位置**：P2-design.md §3.5 核心理由第 1 点

"PNG 导出双路径不可避免"应区分两个层面：
- (a) 全局函数 `downloadMermaidPng`（MarkdownViewer.vue:78-214）硬编码 `mermaid.render`（line 91）→ 确实不可复用，论据成立
- (b) 组件方法 `exportMermaidToPng`（MermaidDiagram.vue:213-330）基于 `props.svgContent` → 技术上可复用，但 P2 选择不复用以避免 viewBox/g.root 假设

区分后论据更精确，不影响方案 X' 决策结论（独立实现 PlantUmlDiagram.vue 的 exportPng 仍是合理选择）。

### 建议 4: PlantUmlDiagram.vue pan-zoom 适配验证

**位置**：P2-design.md §3.5、§5.4

MermaidDiagram.vue:72-77 的 pan-zoom 初始化逻辑 `svg.removeAttribute('width')` + `svg.style.width = '100%'` 假设 SVG 有 width/height 属性。PlantUmlDiagram.vue 复制此逻辑时，若 plantuml SVG 无 width/height 属性（只有 viewBox），removeAttribute 无害但 `style.width='100%'` 可能让 SVG 撑满容器或缩放异常。P4/P5 实现时需验证 plantuml SVG 属性兼容性，必要时调整初始化逻辑。

### 建议 5: 补充中文字体处理路径说明

**位置**：P2-design.md §3.1 或 §3.2

BDD-1 要求"中文字符正常显示，无方块/豆腐块/乱码"。P2 设计未显式说明中文字体处理。prototype-conclusion.md:39 已验证"浏览器字体子系统处理，不依赖服务端 CJK 字体"。建议在设计中补一句说明，避免 P4 实现者误以为需要额外字体配置。

---

## 6. 总结

P2 设计的整体架构方向正确——平行链路、方案 X' 混合决策、CSP 分析、懒加载策略、三层降级框架——均经得起审查。`downloadMermaidPng` 硬编码 `mermaid.render` 的论据经读码确认成立。

但有 2 个 BLOCKER 必须修复后才能进入 P3：

1. **BDD-3 语法错误降级**：默认行为与验收条件矛盾，确定性方案缺失，不能推迟到 P6 才定
2. **串行硬约束保证层级**：仅在调用方 for...of 做串行不足以覆盖跨调用并发，必须在 usePlantUML.render 引擎层面做模块级串行化

两个 BLOCKER 的修复方向都明确（见 §4），不需要推翻整体架构，属于定向修补。修复后重新提交 P2 评审。

**status: approved**

---

## 7. 重审记录（2026-06-20）

architect 已修改 P2-design.md 解决两个 BLOCKER，主 Agent 亲自读修订内容验证：

### BLOCKER-1 重审：语法错误降级
- 解决：P2-design.md 新增四道检测闭环（预校验 validateSource → try/catch → SVG 内容检测 → 5s 超时）
- 验证：明确声明"BDD-3 降级不依赖 P6 验收才确定"
- 结论：已解决

### BLOCKER-2 重审：串行硬约束层级
- 解决：新增两层串行化防护（L1 引擎层模块级 renderQueue Promise 链队列 + L2 编排层 renderToken 取消机制）
- 验证：两层职责清晰，有具体伪代码，P4 照此实现即可
- 结论：已解决

### 重审结论
两个 BLOCKER 均已给出确定性方案，无新 BLOCKER。5 个建议为非阻塞改进项。

status: approved（重审）
