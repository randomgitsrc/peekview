---
phase: P1
task_id: T016
task_name: plantuml-rendering
type: requirements
trace_id: T016-P1-2026-06-20
created: 2026-06-20
status: approved
parent: docs/tasks/T016-plantuml-rendering/P0-brief.md
---

# P1 需求基线：PlantUML 渲染集成

## 1. 需求概述

为 PeekView 前端新增 PlantUML 代码块（` ```plantuml `）的客户端渲染支持，比照现有 Mermaid 实现的分层架构（解析路由 → 引擎封装 → 展示组件），使 markdown 中的 PlantUML 源码在浏览器端渲染为可交互（pan-zoom / 全屏 / PNG 导出）的 SVG 图表。

## 2. 需求质疑（analyst 视角）

### 2.1 PlantUML 支持是否真的需要？

可行性报告自己标注了一个"结构性缺口"：所谓"Mermaid 表现力不足"是泛泛认知，未结合 PeekView 实际场景确认。原型验证回答了**技术可行性**，但没有回答**业务必要性**。

PeekView 的内容生产者是 Agent（通过 MCP/API 创建条目），消费者是浏览器端的人类读者。需要追问：

- **生产侧**：Agent 实际会产出 PlantUML 源码吗？如果会，是哪些图类型？如果 Agent 主要产出 Mermaid（语法更简单、LLM 训练语料更多），PlantUML 支持的 ROI 需要重新评估。
- **消费侧**：现有用户是否曾反馈"Mermaid 画不出来某类图"？

**结论**：需求方向成立（PlantUML 在类图/组件图/部署图等 dot 布局类型上确实优于 Mermaid，且语法覆盖更广），但 P0-brief 跳过了"谁会用、用来画什么"的业务确认，直接进入技术实现。原型验证让技术风险归零，但业务必要性仍是一个隐含假设。**此项不阻断推进**（技术债已投入、原型已验证），但标注为 [NEED_CONFIRM]：主 Agent 应确认是否存在真实的 PlantUML 使用场景或预期，否则 8.32MB 懒加载资源的投入缺乏业务支撑。

### 2.2 所有图类型都需要，还是只需部分？

路线 A（官方 plantuml.js）语法覆盖完整，意味着"需要哪些图类型"这个问题在实现层面已无意义——引擎本体支持全部。但有两个衍生问题：

- **stdlib 图标库**（awslib/azure/k8s 等）：体积大，原型未涉及。是否在 T016 范围内？P0-brief 列为"低风险/集成时评估"，但未明确是 in-scope 还是 out-of-scope。建议 T016 范围**不含 stdlib**，仅保证核心图类型（类图/时序图/组件图/部署图/状态图/活动图/甘特图/思维导图/WBS 等引擎自带能力），stdlib 作为后续独立任务。[NEED_CONFIRM]
- **图类型验收基线**：原型只测了 3 类（类图/时序图/组件图）。P6 验收应至少覆盖这 3 类 + 1 类原型未测的（如状态图或甘特图），以证明"语法覆盖完整"不是空话。

### 2.3 与现有 Mermaid 的共存策略

两者同属客户端渲染、同走 `useMarkdown.ts` 路由，共存策略表面上清晰（加一条 `lang === 'plantuml'` 分支）。但有一个**架构分歧点**被 P0-brief 低估了：

| 维度 | Mermaid | PlantUML |
|------|---------|----------|
| 渲染 API 返回值 | `Promise<{svg: string}>` — 返回 SVG 字符串 | `render(lines, targetId)` — **void**，SVG 直接写入 DOM 元素 |
| 并发安全 | 引擎内部安全，可并发（MarkdownViewer 现为串行但属偶然） | 引擎用共享内部状态，**并发必静默覆盖**，串行是硬约束 |
| 与展示组件接口 | `MermaidDiagram.vue` 接收 `svgContent: string` prop | 同一接口要求 SVG 字符串，但 plantuml.js 不返回字符串 |

**关键矛盾**：`MermaidDiagram.vue` 的接口是 `svgContent` 字符串，P0-brief/原型结论均声称"可直接复用"。但 plantuml.js 的 `render()` 把 SVG 写进 DOM 后才出现，需要通过 MutationObserver 等待再**提取 outerHTML** 才能得到字符串。这条"DOM → 提取字符串 → 喂给展示组件"的链路是隐含的，P0-brief 未明说。详见 §4.2。

### 2.4 用户手写 vs 工具生成

若 Agent 生成 PlantUML，语法错误概率低，但仍需失败降级（Agent 可能产出半截或不合规源码）。若预期人类手写，可行性报告 4.3 节指出的语法陷阱（如 `elseif` vs `else if`）应有 UI 提示——但这超出 T016 范围，归入后续改善。**T0ML 仅需保证失败时优雅降级为源码展示**，不负责语法纠错提示。

## 3. 隐含依赖识别

P0-brief 列了已知风险，以下是实现必须处理但 P0-brief **未明说**的隐含需求：

### 3.1 [SCOPE+] plantuml.js / viz-global.js 的获取与版本管理（最大未决项）

这两个文件**不是 npm 包**，是 TeaVM 编译产物。原型里它们放在 `references/extracted/` 下，但这不是生产方案。必须决定：

- **来源**：GitHub Release 下载？还是本地 `./gradlew teavm` 编译？（后者需要 Java + gradle，CI 环境不一定有）
- **存放位置**：`frontend-v3/public/vendor/`？`frontend-v3/src/assets/`？这关系到 CSP `script-src 'self'` 的命中（必须同源）。
- **版本追踪**：当前 v1.2026.6。如何记录版本？如何在升级时触发？无 npm 包意味着 `package.json` 无法追踪，需要手动维护。
- **git 仓库体积**：8.32MB 二进制文件进 git 是否可接受？是否需要 git-lfs？

这是 P2 必须产出方案的设计项，且可能影响 P5 构建验证。标注 [NEED_CONFIRM]：主 Agent 需在 P2 启动前确认获取方式倾向（推荐：vendored 进 `public/vendor/`，版本记在 CHANGELOG / 单独的 `vendor/VERSION` 文件）。

### 3.2 [SCOPE+] plantuml.js API 返回 void 与展示组件接口的衔接

如 §2.3 所述，`render(lines, targetId)` 不返回 SVG 字符串，而 `MermaidDiagram.vue` 需要 `svgContent: string`。衔接方案有二：

- **方案 X**：创建临时隐藏 DOM 容器 → 调 `render()` → MutationObserver 等 SVG → 提取 `outerHTML` → 喂给 `MermaidDiagram.vue`（保持展示组件零改动复用）
- **方案 Y**：新建 `PlantUmlDiagram.vue`，让 plantuml.js 直接渲染进组件内部容器，pan-zoom 等逻辑复制一份（展示组件不复用，但避免字符串往返）

P0-brief 倾向"复用 MermaidDiagram.vue"，对应方案 X。但方案 X 有个隐患：从 DOM 提取的 SVG 字符串可能带运行时样式/属性，与 `mermaid.render()` 直接返回的干净 SVG 不同，可能影响 PNG 导出（`MermaidDiagram.vue` 的 `exportMermaidToPng` 解析 SVG 字符串画到 canvas）。这是 §3.3 的前置风险。

### 3.3 [SCOPE+] PNG 导出对 PlantUML SVG 的兼容性

`MermaidDiagram.vue` 的 `exportMermaidToPng()`（MermaidDiagram.vue:213）解析 SVG 字符串时：
- 从 `viewBox` 取宽高（`parts = viewBox.split(/\s+/)`）
- fallback 查找 `g.root` 的 `getBBox()`（MermaidDiagram.vue:258）

PlantUML 产出的 SVG 结构未知是否含 `viewBox`、是否有 `g.root` 类名。若都没有，PNG 导出会走 final fallback（800×600），导出图像比例错误。**P5/P6 必须实测 PlantUML SVG 的 PNG 导出**，不能假设复用零成本。这是 P0-brief 声称"MermaidDiagram.vue 零改动复用"的潜在反例。

### 3.4 暗色主题与 Mermaid 的一致性

- Mermaid：`theme: 'dark' | 'default'`（useMermaid.ts:12）
- PlantUML：`{dark: true}` 选项（原型未实测此选项）

原型页面本身是深色背景，但 vision-helper 看到的是**页面 CSS 深色**，不是 `{dark: true}` 渲染选项的效果。两者可能混淆。P4/P6 必须显式验证 `{dark: true}` 选项的实际效果，并对比 Mermaid 暗色模式的视觉一致性（背景色、文字对比度、连线颜色）。

### 3.5 CSP 是否需要改动

- 现状：`script-src 'self' 'unsafe-eval'`（`unsafe-eval` 为 Mermaid/d3 的 `new Function()` 必需）
- plantuml.js 是 TeaVM **JS 后端**（非 WasmGC），原型未触发 wasm 错误
- 但 `viz-global.js` 是普通 `<script>` 同步加载，必须来自同源（命中 `'self'`）——这与 §3.1 的存放位置直接相关
- 动态 `import('plantuml.js')` 同样受 `'self'` 约束

**预期无需改 CSP**，但必须在 `make debug` 真实 CSP 下验证（P5/P6 铁律）。若意外需要 `wasm-unsafe-eval`，属于安全策略变更，必须主 Agent 拍板。

### 3.6 DOMPurify 与 PlantUML `-->` 箭头语法

AGENTS.md 明确："含 `-->` 的属性会被 DOMPurify 删除"。PlantUML 大量使用 `-->` 作为箭头语法。

**风险评估**：现有 Mermaid 实现把源码存进 `mermaidSources` Map（useMarkdown.ts:233），源码**不进 DOM**，DOMPurify 不触碰。若 PlantUML 沿用同样模式（源码进 `plantumlSources` Map），则 `-->` 不在 DOM 属性里，无风险。但需确认 plantuml 占位 DOM 结构（类似 mermaid-block 的 header/toolbar）的属性中不含 `-->`。**预期安全**，P6 验收时顺手验证。

### 3.7 前端构建产物体积与懒加载边界

- 8.32MB 必须不进主 bundle
- `viz-global.js` 是**全局脚本**（非 ES module），Vite 的 `import()` 不直接适用于它，需要一个运行时 `<script>` 注入器
- 懒加载边界：**页面级**（检测到任一 plantuml 块即加载引擎一次），非块级
- 加载时机：`useMarkdown().render()` 返回 `plantumlSources` Map 后，若 Map 非空则触发加载

### 3.8 MarkdownViewer.vue 渲染编排的串行性

现有 `renderMermaidDiagrams()`（MarkdownViewer.vue:390）用 `for...of` + `await`，已是串行。PlantUML 复用此模式即可满足"串行硬约束"。但需注意：**Mermaid 串行是偶然的（性能可接受所以没并行化），PlantUML 串行是强制的（并发会静默覆盖）**。若未来有人优化 Mermaid 为并行，PlantUML 必须保持串行——这一点应在代码/注释中体现，防止后续误改。P2 设计应明确两个独立的渲染循环，不共用一个可能被并行化的路径。

## 4. domains

```yaml
domains:
  - frontend
```

## 5. BDD 验收条件（Given/When/Then）

### BDD-1 正常渲染 PlantUML 代码块（含中文）

```gherkin
Given 一个 markdown 条目，含 ```plantuml 块，内容为类图，含中文类名（用户/订单）和中文方法名（登录/注册）
When 在浏览器中打开该条目
Then 该代码块渲染为 SVG 图表，类框/方法名/关系连线完整可见
And 中文字符正常显示，无方块/豆腐块/乱码
And 图表带 header 工具栏（与 Mermaid 块一致的交互入口）
```

### BDD-2 PlantUML 与 Mermaid 混合存在于同一文档

```gherkin
Given 一个 markdown 条目，同时含一个 ```mermaid 块和一个 ```plantuml 块
When 在浏览器中打开该条目
Then 两个块各自独立渲染为 SVG 图表
And Mermaid 块的渲染不因 PlantUML 引擎加载而失败
And PlantUML 块的渲染不因 Mermaid 引擎状态而失败
And 两个块的渲染顺序不影响最终结果（均成功显示）
```

### BDD-3 PlantUML 语法错误的降级处理

```gherkin
Given 一个 markdown 条目，含一个 ```plantuml 块，源码为无效语法（如缺少 @startuml/@enduml 配对，或未闭合的块）
When 在浏览器中打开该条目
Then 该块退回展示原始 PlantUML 源码（高亮代码块形式）
And 显示错误提示标识（不裸抛异常到控制台导致页面白屏）
And 同文档中其他正常块（mermaid 或 plantuml）仍正常渲染
```

### BDD-4 渲染超时的降级处理

```gherkin
Given 一个 ```plantuml 块，其渲染耗时超过 5 秒（或模拟超时）
When 在浏览器中打开该条目
Then 该块在 5 秒后超时，退回展示原始源码
And 超时不会阻塞后续块的渲染（串行队列继续推进，不卡死）
And 控制台输出超时日志便于排查
```

### BDD-5 plantuml.js 懒加载（无 plantuml 块时不加载）

```gherkin
Given 一个 markdown 条目，仅含普通代码块和 ```mermaid 块，无任何 ```plantuml 块
When 在浏览器中打开该条目
Then 浏览器的网络请求中不出现 plantuml.js 和 viz-global.js 的下载
And 页面加载性能与未集成 PlantUML 支持前一致（无 8.32MB 开销）
And Mermaid 块正常渲染不受影响
```

### BDD-6 暗色主题渲染

```gherkin
Given 浏览器主题设为 dark
When 打开含 ```plantuml 块的条目
Then PlantUML SVG 使用暗色适配（`{dark: true}` 选项生效）：背景/文字/连线对比度可读
And 视觉风格与同文档 Mermaid 暗色模式渲染协调一致（无明显突兀）
When 切换主题为 light
Then PlantUML 块以 light 主题重新渲染（主题切换响应正常）
```

### BDD-7 多个 PlantUML 块串行渲染

```gherkin
Given 一个 markdown 条目，含 3 个 ```plantuml 块（不同图类型）
When 在浏览器中打开该条目
Then 3 个块按文档顺序串行渲染（块2 的渲染在块1 的 SVG 出现后才开始）
And 3 个块最终全部渲染成功，SVG 内容无串台/覆盖
And 总渲染耗时合理（原型基线 740ms，上限不应超过数秒）
And 任一块失败不影响其他块的渲染（失败块降级，其余继续）
```

### BDD-8 [补充] 展示组件交互复用（pan-zoom / 全屏 / PNG 导出）

```gherkin
Given 一个已渲染成功的 PlantUML 图表
When 用户点击全屏按钮
Then 图表在全屏 modal 中显示，pan-zoom 可用
When 用户点击 zoom in / zoom out / reset
Then 图表缩放响应正常（与 Mermaid 图表行为一致）
When 用户点击 Download PNG
Then 下载的 PNG 图像内容完整、比例正确、无黑边/截断
And 若 PlantUML SVG 结构导致 PNG 导出异常，有降级处理而非静默失败
```

### BDD-9 [补充] 真实 CSP 下的渲染

```gherkin
Given PeekView 调试服务（make debug）以真实 CSP `script-src 'self' 'unsafe-eval'` 运行
When 打开含 ```plantuml 块的条目
Then plantuml.js / viz-global.js 从同源加载成功（无 CSP 违规报错）
Then PlantUML 块正常渲染（无 wasm/eval 相关 CSP 阻断）
And 浏览器控制台无 CSP 违规报告
```

## 6. 裁剪说明

P0-brief 倾向全保留 P1-P8。**作为 analyst，我同意全保留**，理由如下：

| 阶段 | 建议 | 理由 |
|------|------|------|
| P1 | 保留 | 本文档本身。已识别多个 [SCOPE+] 和 [NEED_CONFIRM]，证明需求确需基线化 |
| P2 | 保留 | §3.1 获取方式、§3.2 API 衔接方案 X/Y、§3.7 懒加载边界、§3.8 串行循环隔离——均为需设计决策的架构点，非"方案明确" |
| P3 | 保留 | 串行队列逻辑、超时降级、懒加载触发条件需单元测试；plantuml.js 是新引擎封装，无现成覆盖 |
| P4 | 保留 | 核心实现 |
| P5 | 保留 | CSP 真实环境验证是铁律；PNG 导出兼容性需实测；体积影响需量化 |
| P6 | 保留 | UI 改动 + 安全相关（CSP），符合"P6 不可跳"裁剪铁律；必须 Playwright 实跑 + vision 验证中文渲染 |
| P7 | 保留 | 涉及 `useMarkdown.ts` / `useMermaid.ts`(参照) / `MarkdownViewer.vue` / 新 `usePlantUML.ts` / 可能新建组件——多文件改动需一致性检查 |
| P8 | 保留 | `frontend-v3` 改动需 bump peekview 版本 + CHANGELOG |

**不建议裁剪任何阶段**。本任务涉及前端 UI + 多文件改动 + CSP 安全相关 + 新外部资源引入，符合"涉及安全/多端 → P6 不可跳"的裁剪铁律，且 P2 存在多个未决设计点，P3 有可测试的串行/降级逻辑，均非"任务简单"。

## 7. 能力缺口检查 [CAPABILITY_GAP]

| 能力 | 状态 | 说明 |
|------|------|------|
| plantuml.js / viz-global.js 获取 | **supplementable** | 文件已存在于原型 `references/extracted/`，证明可获取。但生产获取策略（vendor 位置 / 版本管理 / git 体积）需 P2 定方案。非硬 GAP，但需 [NEED_CONFIRM] 主 Agent 拍板获取方式 |
| Playwright + vision 验证 | **available** | 原型验证已使用此能力（连本地 Chrome CDP `:18800` + vision-helper 分析截图），路径打通可复用 |
| CSP 验证环境 | **available** | `make debug` 提供真实 CSP 的调试服务，无需额外搭建 |
| 前端单元测试框架 | **available** | `cd frontend-v3 && npm run test` 现成，Mermaid 相关测试已有先例可参照 |
| SVG 结构分析能力（PNG 导出兼容） | **supplementable** | 需在 P4/P5 实际渲染 PlantUML 后检查其 SVG 结构（viewBox / g.root），与 `MermaidDiagram.vue` 的 `exportMermaidToPng` 逻辑比对。无需新工具，但需人工分析 |

**无 [CAPABILITY_GAP]**。所有能力要么 available，要么 supplementable（可通过 P2 设计 + P4/P5 验证补齐）。**不需停下等外部能力就位**，可推进至 P2。

## 8. 待确认事项汇总（主 Agent 已拍板）

> 以下事项由主 Agent 在 P1→P2 门槛判定时决策，NEED_CONFIRM 已消除。

1. **[RESOLVED] 业务必要性**：用户主动要求 PlantUML 渲染支持（"使得前端可以正常渲染plantuml"），业务必要性已由需求方确认。8.32MB 懒加载资源投入有业务支撑。

2. **[RESOLVED] stdlib 范围**：T016 **不含** stdlib（awslib/azure/k8s 等图标库）。仅保证核心图类型（类图/时序图/组件图/部署图/状态图/活动图/甘特图等引擎自带能力）。stdlib 作为后续独立任务。

3. **[RESOLVED] plantuml.js 获取方式**：vendored 进 `frontend-v3/public/vendor/plantuml/`（plantuml.js + viz-global.js），版本记录在 `frontend-v3/public/vendor/plantuml/VERSION`。不用 git-lfs（8.32MB 一次性进 git 可接受）。确保 CSP `script-src 'self'` 同源命中。

4. **[SCOPE+] API 衔接方案 X/Y**：留 P2 设计阶段决策（复用 MermaidDiagram.vue 方案 X vs 新建 PlantUmlDiagram.vue 方案 Y）。P2 须二选一并说明理由。

5. **[SCOPE+] PNG 导出兼容性**：P0-brief 声称"MermaidDiagram.vue 零改动复用"，但 `exportMermaidToPng` 的 SVG 结构假设（viewBox / g.root）未经 PlantUML SVG 验证。P5/P6 必须实测，可能需小幅适配。

6. **[SCOPE+] 图类型验收基线**：P6 验收覆盖原型 3 类（类图/时序图/组件图）+ 状态图（原型未测），共 4 类，证明"语法覆盖完整"。

## 9. 参考

- `docs/tasks/T016-plantuml-rendering/P0-brief.md` — 任务简报
- `docs/tasks/T016-plantuml-rendering/references/prototype-conclusion.md` — 原型验证结论
- `docs/tasks/T016-plantuml-rendering/references/prototype.html` — 原型实现（串行队列参考）
- `docs/notes/plantuml-rendering-feasibility.md` — 技术预研
- `frontend-v3/src/composables/useMermaid.ts` — Mermaid 引擎封装（参照对象）
- `frontend-v3/src/composables/useMarkdown.ts` — markdown 解析路由（集成点）
- `frontend-v3/src/components/MermaidDiagram.vue` — 展示组件（复用候选）
- `frontend-v3/src/components/MarkdownViewer.vue` — 渲染编排器（集成点，串行循环所在）
