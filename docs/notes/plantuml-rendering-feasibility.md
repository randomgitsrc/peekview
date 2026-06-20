# PlantUML 渲染支持 — 技术可行性分析

> 状态：立项前技术预研，尚未进入 agate 任务流程（无对应 Txxx）
> 日期：2026-06-20
> 范围：本文档只做技术调研与方案比较，不包含实现细节设计。正式立项时应作为 P1/P2 阶段的输入材料。

## 一、需求背景

PeekView 当前支持 Mermaid 图表渲染（`frontend-v3/src/composables/useMermaid.ts` + `MermaidDiagram.vue`），但部分图表类型 Mermaid 表现力不足，PlantUML 在这些场景下渲染效果更好（更广的图表类型覆盖：类图、组件图、部署图、思维导图、甘特图、WBS、ER图等；对复杂图依赖 Graphviz dot 引擎做自动布局，处理大型图排版通常优于 Mermaid 内置布局算法）。计划目标：新增 PlantUML 渲染支持，架构上比照现有 Mermaid 实现。

**本次调研的一个结构性缺口**：以上"哪些图 Mermaid 表现不佳"是泛泛而谈的通用认知，没有结合 PeekView 实际场景确认具体是哪几类图、出现频率如何。这件事本身的优先级高于下面的技术路线选型——如果实际需要的只是"类图/组件图这类依赖 dot 布局的类型"，路线 B（自研解析+@viz-js/viz）的吸引力会显著上升（不需要官方引擎的完整语法覆盖）；如果需要时序图、甘特图等 dot 布局之外的类型，路线 B 不成立。**正式立项前应先做这个确认**，而不是直接跳到技术选型。

## 二、现有 Mermaid 架构（复用基础）

调研结论：PeekView 现有 Mermaid 管线分三层，**展示层可以直接复用，不需要重写**：

| 层 | 文件 | 职责 | 与具体引擎的耦合度 |
|---|---|---|---|
| markdown 解析路由 | `useMarkdown.ts` | 按 `block.lang === 'mermaid'` 识别代码块，生成带 header/工具栏的占位 DOM，把源码存进 `mermaidSources` Map 供异步渲染 | 低，加一条 `lang === 'plantuml'` 分支即可 |
| 渲染引擎封装 | `useMermaid.ts` | 调 `mermaid.render()`，配置 `securityLevel: 'strict'`，返回 SVG 字符串，5秒超时 | 高，PlantUML 需要单独的 `usePlantUML.ts`，不能复用 |
| 展示/交互组件 | `MermaidDiagram.vue` | pan-zoom（动态导入 `svg-pan-zoom`）、全屏、PNG 导出（canvas 解析原始 SVG 字符串，非 DOM 截图，避免污染） | **几乎为零**，接口是 `svgContent` 字符串 + `id`，与引擎无关，只要 PlantUML 渲染产出合规 SVG 字符串，可直接复用 |

CSP 现状（`backend/peekview/main.py` 约141-148行）：`script-src 'self' 'unsafe-eval'`，为 Mermaid/d3 配置，**不含 `'wasm-unsafe-eval'`**。这是评估候选方案时的一个硬约束。

## 三、候选技术路线（三条，均有真实参考案例支撑）

### 路线 A：官方 plantuml.js（TeaVM 编译产物，客户端渲染）

PlantUML 官方仓库可通过 `./gradlew clean teavm -Pfast` 编译出 `plantuml.js` + `viz-global.js`（Graphviz dot 布局支持），完全在浏览器运行，架构上与 Mermaid 最接近（同为客户端 JS 渲染）。

**实测/实证数据**：
- 官方 GitHub Releases 的 `js-plantuml-1.2026.6.zip`（预编译产物打包）实测 **30.5 MB**（含 demo/stdlib，非最终前端产物体积，但量级参考意义强）
- PlantUML 官方文档原话：*"plantuml.js is several MB. A lazy-load strategy (only fetch when a plantuml block is detected) avoids impacting pages without diagrams."* —— 懒加载是官方明确建议，非可选项
- TeaVM 用的是 **JS 后端**（产物文件名 `.js`），不是 WasmGC 后端，理论上不需要 `'wasm-unsafe-eval'`，现有 CSP 的 `'unsafe-eval'` 可能已够用 —— **此判断基于文档推断，未经实测，必须在正式实现前验证**
- 官方仓库存在一份 `GITHUB_INTEGRATION.md`，是专门为"在第三方页面渲染用户 markdown 中的代码块"场景写的参考架构，和 PeekView 需求场景高度一致：
  - API 极简：仅 `plantumlLoad()` 初始化 + `render(lines, targetId)` 渲染（含 `{dark: true}` 选项）
  - **推荐架构是 iframe 沙箱 + postMessage**，不是像现有 Mermaid 那样直接在主文档 DOM 跑引擎。这与上面"现有 CSP 可能已够用"的判断是**两种互斥的应对路径，不是可叠加的双重保险**：如果直接嵌入主文档（路径1）且 CSP 验证够用，不需要 iframe；选 iframe 沙箱（路径2）则是不依赖 CSP 验证结果的保守选择，代价是数据需经 postMessage 异步传回，"直接复用 `MermaidDiagram.vue` 的 `v-html` 渲染模式"会变复杂。这是一个需要在 P2 二选一拍板的架构分歧点，不是两者都要做
  - **明确的并发陷阱**：同一 JS 上下文连续渲染多张图必须串行等待前一张 SVG 出现在 DOM，引擎用共享内部状态，并发调用会静默覆盖结果 —— 如果 PeekView 一篇文档含多个 plantuml 代码块且不采用 iframe-per-diagram 隔离，会直接踩这个坑
- CHANGELOG 显示官方仍在持续优化体积问题（v1.2026.3：`Exclude teavm/** resources in plantuml-mit-light`），说明这条路线还在演进中，非完全定型

**成熟度判断**：plantuml.js 的稳定版本是 2026 年才发布（社区讨论原话："as of a two weeks ago, there is a stable version of plantuml.js"），集成案例少，工程稳定性明显低于 Mermaid（多年成熟使用）。

### 路线 B：自研语法解析 + 成熟渲染库组合

参考案例：第三方开源项目 `markdown-viewer-extension`（GitHub `markdown-viewer/markdown-viewer-extension`，1.3k+ star，多平台 markdown 转 docx 工具，支持 PlantUML/Mermaid/Vega/drawio/Graphviz 等）。

调研其 `package.json` 依赖清单，**关键发现**：该项目**没有使用官方 plantuml.js / TeaVM 任何相关包**。依赖里有 `mermaid`（直接依赖，符合预期）和 `@viz-js/viz`（WASM 封装的 Graphviz，专做 dot 布局），以及一个组织私有 scoped 包 `@markdown-viewer/draw-uml`（未能获取其内部实现细节，命名强烈暗示是自研的 PlantUML 语法解析层，对接 `@viz-js/viz` 完成最终渲染）。

**这个事实的意义**：一个面对几乎相同需求场景（markdown 中渲染 PlantUML 代码块）的真实生产项目，没有选择"直接用官方引擎"这条路，而是自己写了一层语法转换 + 复用更专注、更成熟的 Graphviz WASM 库。这是一条经过验证可行、但代价不同的路线——好处是不依赖体积庞大、成熟度新的官方引擎；代价是需要自己开发并维护 PlantUML 语法到渲染指令的转换层，且大概率无法覆盖 PlantUML 全部图表类型（自研解析层通常只覆盖团队实际用到的子集，时序图/甘特图/思维导图等非 dot-布局类型的图，`@viz-js/viz` 本身不直接提供支持，需要额外实现）。

### 路线 C：服务端 Java 渲染（传统 plantuml.jar）

参考案例：你自己的另一个仓库 `randomgitsrc/md2docx`（markdown 转 docx 的命令行工具），其 `scripts/plantuml-renderer.js` 是一份完整、经过三轮代码评审的实现。这条路线技术上成熟（PlantUML 官方原生支持方式），但定位完全不同——它是**批处理工具调用本地 Java + jar**，渲染出 PNG 静态图片再嵌入文档，不是浏览器实时交互渲染。对 PeekView（Web 应用、用户打开页面即时渲染）这种场景，意味着要在后端引入 Java 运行时、管理 jar 版本、处理服务端渲染队列——这是架构级改动，偏离"和 Mermaid 架构保持一致（纯客户端渲染）"的初始设想，**不建议作为 PeekView 的主选路线**，但其源码暴露的两个具体工程风险点对路线 A/B 同样有参考价值（见下节）。

## 四、跨路线共通的风险点（与具体技术路线选择无关，必须在 P1/P2 验证）

### 4.1 中文（CJK）渲染兼容性 —— 本次调研新发现的关键风险点，原分析遗漏

从路线 C 的真实代码中发现：`plantuml-renderer.js` 包含一个专门的 `findChineseFont()` 函数，探测系统已装的中文字体（Noto Sans SC / WenQuanYi Zen Hei / SimSun / Microsoft YaHei / DengXian）并通过 `skinparam defaultFontName` 注入到 PlantUML 源码。**这个函数的存在本身就是中文渲染问题的实锤证据**——如果中文显示天然没问题，不需要写这么细致的字体探测/注入逻辑。

进一步搜索确认了根本机制：CJK 字体体积大（5-15MB），不会预装在大多数西方系统/精简容器镜像里，这是渲染引擎所在环境缺中文字体导致"豆腐块"（□）乱码的根本原因，不是 PlantUML 工具本身不支持中文。PlantUML 公共在线服务器的用户讨论也印证了类似的字体/排版问题需要用户自己托管定制字体版本解决。

**这对路线选择的影响**：
- 路线 C（服务端 Java/AWT 渲染）：明确依赖**服务器系统**是否装中文字体，是真实存在、需要主动处理的运维风险
- 路线 A（plantuml.js 客户端渲染）：渲染逻辑最终依赖**浏览器的字体子系统**而非 Java AWT 处理文字，这个机制差异本身是确定的（TeaVM 编译产物运行在浏览器里）。但"是否和 Mermaid 风险一样低"这个具体类比**未经验证**——plantuml.js 渲染 SVG 文字时是用原生 `<text>` 标签（走浏览器字体渲染，风险与 Mermaid 类似）还是把字形预先栅格化/转路径（不依赖浏览器字体，风险特征完全不同），这次调研没有确认，不能假设两者机制一致
- 受限于本次验证所在沙箱环境的网络策略（`plantuml.com`、PlantUML 官方在线渲染服务、GitHub Release 资产下载域名均不在网络白名单），**没有做到用一段真实中文 PlantUML 源码实际渲染出图、肉眼确认效果**。这是本次轻量验证的唯一未完成项，必须在正式立项的 P1/P2 阶段补做实测（几分钟即可完成：打开 plantuml.js 官方 demo 页面贴一段中文源码看效果）。

### 4.2 渲染失败的降级策略

路线 C 的实现里，无论 Java 未装、jar 下载失败、语法错误还是渲染超时（30秒上限），统一降级为展示原始代码块，不阻断整体转换流程。这是个稳妥、值得照搬的容错模式。PeekView 选择任何路线，都应确认：渲染失败时退回展示原始 plantuml 代码块（需要确认现有 `useMermaid.ts` 当前的失败处理逻辑是否已是同等级别，作为基线参照）。

### 4.3 PlantUML 语法本身的易用性成本

路线 C 实现里专门写了 `fixMultiElse()` 函数，处理一个具体陷阱：标准活动图允许一个 if 块内多个 else 分支，但 PlantUML 语法要求多分支必须用 elseif。这说明 PlantUML 语法本身存在一些不直观、容易写错的地方，不只是"画图能力强弱"的问题。如果 PeekView 用户需要手写 PlantUML 源码（而非工具生成），这是一个值得在文档/UI 提示里覆盖的易用性成本。

## 五、三条路线对比汇总

| 维度 | 路线A 官方plantuml.js | 路线B 自研解析+@viz-js/viz | 路线C 服务端Java渲染 |
|---|---|---|---|
| 语法覆盖完整度 | 完整（官方引擎本体） | 受限于自研解析层覆盖范围，大概率不全 | 完整（官方引擎本体） |
| 架构一致性（vs现有Mermaid） | 高，同为客户端渲染 | 高，同为客户端渲染 | 低，需引入服务端Java依赖 |
| 包体积 | 大（官方文档承认"几MB"，需懒加载） | 待评估，理论上比完整引擎小 | 不涉及前端体积，但需服务端Java环境 |
| 工程成熟度 | 新（2026年才稳定），案例少 | 有真实生产案例验证可行 | 成熟（官方原生方式），但路线C本身定位不符PeekView场景 |
| CSP兼容性 | 推断兼容，待实测 | 待评估 | 不适用（非浏览器执行） |
| 中文渲染 | 推断风险较低（浏览器字体），待实测 | 待评估 | 已知风险，需服务端装CJK字体 |
| 实现工作量 | 中（复用展示层，新写引擎封装+架构权衡） | 高（需自研语法解析层） | 高（架构级改动，偏离现有设计） |

## 六、结论与建议

需求方向成立，PlantUML 在特定图表类型上的表现力优势是真实的。技术上**优先评估路线 A（官方 plantuml.js）**，理由：架构一致性最高（复用现有 Mermaid 展示层成本最低）、语法覆盖最完整、且不存在路线 C 已知的服务端中文字体运维负担（路线 A 的中文渲染风险尚未实测，但至少不依赖"服务器是否装了CJK字体"这个明确的运维变量，见4.1节）。**路线 B 作为备选**，如果路线 A 在体积或成熟度上的风险被验证为不可接受，且 PeekView 实际需要的 PlantUML 图表类型主要是依赖 dot 布局的类型（类图、组件图等），路线 B 值得重新评估。路线 C 不建议作为主路线。

**不建议直接立项进入 agate P0-P8 流程**。建议按以下顺序推进：第一步，确认 PeekView 实际需要 PlantUML 支持的具体图表类型和场景（见第一节末尾的结构性缺口），这件事决定路线 A/B 的取舍权重，应先于技术实测；第二步，补完 4.1 节遗留的中文渲染实测和 plantuml.js 在 PeekView 实际 CSP 策略下的加载实测（均可在有网络权限的开发环境几分钟内完成）。三项确认后，再决定是否正式创建任务（T0xx）并进入 P1 需求基线阶段——届时 iframe 沙箱 vs 直接嵌入主文档这个架构分歧点，应作为 P2 设计阶段的核心决策点，而非在预研阶段拍板。

## 七、本次调研的方法论局限（诚实标注）

- 路线A的体积数字（30.5MB）来自官方 Release 打包 zip，包含 demo/stdlib，不等于最终会被打进 PeekView 前端构建产物的精确体积，仅作量级参考
- 路线A的CSP兼容性判断基于 TeaVM 文档对 JS 后端 vs WasmGC 后端的区分推断，未经实际加载测试验证
- 路线B的核心私有包 `@markdown-viewer/draw-uml` 内部实现未能获取，其"自研解析"的判断基于依赖列表的间接推理，非直接代码证据
- 4.1节中文渲染风险的"路线A风险更低"判断是基于渲染机制原理的推论（浏览器字体子系统 vs Java AWT），不是实测结果，是本次调研最大的遗留验证项
