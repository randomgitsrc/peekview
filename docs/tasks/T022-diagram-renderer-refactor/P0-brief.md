---
phase: P0
task_id: T022
task_name: diagram-renderer-refactor
trace_id: T022-P0-20260625
created: 2026-06-25
---

# P0 任务简报 — T022 diagram-renderer-refactor

## task

将 Markdown 渲染管线（`MarkdownViewer.vue` 1989 行 + `MermaidDiagram.vue` 598 + `PlantUmlDiagram.vue` 416 + `SvgDiagram.vue` 478 + `useMarkdown.ts` 372，共 ~3500 行）重构为：

1. **三胞胎组件抽 `BaseDiagram.vue`**：zoom/fullscreen/pan/PNG 导出骨架集中，子组件 < 150 行仅提供渲染源和差异点
2. **`useMarkdown` 改为渲染器注册模式**：识别 fenced code block 后查表路由到对应渲染器/组件，不再显式知道 mermaid/plantuml/svg 存在
3. **渲染状态抽到 composable**（`useCodeBlockRenderer` 或类似）：mermaidCache / plantumlSourcesMap / svgSourcesMap / renderToken 等从 MarkdownViewer 移到独立 composable，MarkdownViewer 退化为"识别 + 派发"，目标 < 300 行
4. **事件委托迁移到 emit**：去掉 `data-action` + `closest()` + switch case 的全局字符串协议，子组件用标准 Vue 通讯

**验收量化条件**（P1 需落地为 BDD）：加一种新图表类型 ≤ 1 个新文件 + 1 行注册调用。

**硬约束**：
- **保留 T020 XSS 净化**：svg 代码块 DOMPurify 净化（`foreignObject`/`<script>`/on* 剥除）必须 100% 保留
- **不丢测试覆盖**：86 单测 + Playwright BDD 16/16 必须全绿
- **保留主题切换/响应式/IME 行为**

## user_decisions

1. **路线**：B + 状态 composable 化（"温和 C"），不动 EntryDetailView 主体，不强求统一 Block 协议
2. **范围**：仅 Markdown 渲染管线内重构（MarkdownViewer + 3 个 Diagram + useMarkdown + 新增 composable）
3. **不做过度抽象**：code/markdown/html/image/mermaid/plantuml/svg 性质差异大，不强求统一 Block 接口
4. **不丢 T020 安全债**：svg DOMPurify 净化为硬约束
5. **可扩展性量化目标**：加新图表类型 ≤ 1 文件 + 1 行注册
6. **【行为保真铁律 - 最高优先级】**：重构后所有用户可见行为（渲染输出、交互、状态、性能、安全、响应式、主题切换、CSP）必须与重构前**逐项一致**，不允许任何"等价改写"或"我看着差不多"。任何 subagent 自我报告"应该等价"不构成证据，必须有可重复验证的基线证据。具体保真策略见 `## behavioral_fidelity_strategy` 章节。**用户原话**："重构完以后原来好用的功能不好用或直接丢失了、不符合预期了 这种是严格禁止的"

## behavioral_fidelity_strategy

行为保真的具体执行策略（主 Agent 亲自 gate，subagent 自我报告不可信）：

**保真分层原则**（避免过度约束）：

| 层级 | 含义 | 保真度要求 |
|------|------|----------|
| **用户感知保真**（必须） | 渲染输出（HTML 字符级）、按钮交互、图表显示、主题切换、状态保留、错误提示 | **字符级 / 视觉级一致**，不允许任何偏差 |
| **技术内部保真**（不破坏外部行为即可） | 内部实现细节（cache 键格式、算法路径、文件拆分、类名、变量名、CSS class） | 只要求**外部行为不变**，内部可自由调整 |

**重构 + 优化边界**（避免"顺手改"陷阱）：

- ✅ 允许（纯结构性改动，无外部行为变化）：机械重命名、文件拆分、提取函数、调整 CSS class 名
- ❌ 禁止（真正的"捆绑"风险）：顺手改算法、换实现路径、改外部行为、"我觉得这样更好"

P4 实施拆子步骤时，每个子步骤的 commit message 必须能明确回答："这次改动是否改变外部行为？"——是 = 该子步骤被拒（拆出去单独立项），否 = 允许。

**执行策略**：

**P1（需求基线）**：
- BDD 验收条件中**每一条**行为必须可量化（"渲染出包含 X class 的元素" 而非"渲染正确"）
- 列出"行为保真验收清单"（P6 逐条实跑用），覆盖：渲染输出、按钮交互、状态保持、性能、安全、响应式、主题切换、CSP、错误处理

**P3（TDD - 红线基线测试集）**：
- **重构前**先跑一次现有 86 单测 + 16 BDD，记录全绿基线，**作为红线**：重构期间任何测试挂了都不允许继续，必须先修复
- 关键 DOM 输出加**快照测试**（snapshot test），重构后快照必须 100% 匹配（字符级）
- 关键交互流程加**端到端录制**（Playwright 录屏），重构后行为必须视觉一致
- 优先写**纯函数单测**（composable 逻辑），再写组件集成测试，避免 T020 P3 那种 subagent 空返回

**P4（实施 - 增量保真）**：
- 拆分子步骤：每完成一个小重构就**立即**跑一遍红线测试集，挂了立即停
- 关键节点保留**过渡期并存代码**（旧路径 + 新路径）做 A/B 对比，待新路径完全验证后再删旧路径
- **禁止"重构 + 优化"**捆绑（一次只做一件事：要嘛只重构，要嘛只优化）

**P5（验证）**：
- 86 单测全绿（与重构前基线 1:1 对比）
- 16 BDD 全绿（行为不变）
- 关键流程的视觉对比（截图/录屏与重构前对比）
- 性能基线对比（首屏渲染时间、mermaid 缓存命中率、renderToken 防竞态有效性）

**P6（验收 - 行为保真专项）**：
- 行为保真验收清单逐条实跑，每条由主 Agent 亲自跑 Playwright 验证
- 不接受"代码看起来对"或"subagent 报告 PASS"
- T020 P6 PAUSED 重验教训（`a2945978 wf(T020-P6): PAUSED — P6 结果存疑（URL/skill 未核实），需新会话重验`）必须重视：subagent 报告的 PASS 必须由主 Agent 亲自复核
- 出"行为保真报告"（重构前 vs 重构后逐项对比表 + 截图/录屏证据）

**P7（一致性 - 行为保真专项检查）**：
- 验证 P6 的"行为保真报告"完整、证据齐全、无 BLOCKER
- 验证所有变更文件未引入新行为

## known_risks

- **🔴 行为回归（用户明确强调，最高优先级）**：重构最大的风险不是"重构不出来"而是"重构出来行为变了"。具体场景：渲染 HTML 字符级不一致、按钮交互变（点击后行为不同）、状态丢失（文件树展开/TOC 滚动位置/阅读进度）、性能变差、安全净化失效、响应式断点变化、主题切换不重渲染、CSP 违规内联事件。**任何一项发生 = 任务失败**。对策：见 `## behavioral_fidelity_strategy` 完整保真策略
- **测试覆盖不能降**：现有 86 单测（HtmlViewer/MarkdownViewer/Mermaid/PlantUML/Svg 等）+ Playwright BDD 16/16（覆盖渲染/toggle/copy/PNG/Fullscreen/XSS/三管线共存/主题切换/尺寸回退）。重构后必须全绿，P3 必出回归保护测试集
- **与 T021 时序冲突**：T021（zen-mode）改 EntryDetailView.vue 头部/侧栏。本任务**不动 EntryDetailView 主体**，但 MarkdownViewer 在 EntryDetailView 中被引用，需确保 useMarkdown 公开 API 不破坏 EntryDetailView 调用方。建议等 T021 完成 P4 实施后再启 P4，避免周围文件多 agent 并发改动冲突
- **useMarkdown 公开 API 稳定性**：当前签名 `useMarkdown().render(content, theme): Promise<{ html, headings, mermaidSources, plantumlSources, svgSources }>`，下游消费者（MarkdownViewer/EntryDetailView）依赖此签名。重构需保持 API 兼容或显式 bump 公开接口
- **Mermaid 串行约束保留**：usePlantUML.render 内部有模块级 Promise 链保证串行（plantuml.js 共享内部状态并发静默覆盖），重构不能引入并行调用
- **renderToken 防竞态保留**：当前 MarkdownViewer 用 `renderToken` 防止主题切换/内容更新时旧渲染覆盖新渲染。状态抽到 composable 时这个机制必须保留
- **三胞胎差异点识别不全风险**：Mermaid/PlantUML/SVG 三个组件虽 85% 重复，但 15% 差异（渲染源、白底 vs 透明底、zoom options、touch handling）必须精准识别并参数化。漏掉差异点会导致某个图表类型回归。P1 必须详尽列出三胞胎差异矩阵
- **主题切换/IME 行为**：主题切换时 mermaid/plantuml/svg 重新渲染，SVG 代码块走 Shiki 高亮重新挂载。重构不能破坏这些重挂载流程
- **PNG 透明背景**：T020 给 svg 导出不调 fillRect 走 alpha=0，mermaid/plantuml 走 fillRect 白底。三种导出参数化到 BaseDiagram 时不能丢这个差异
- **CSP 影响**：data-action 字符串协议是为满足 CSP 去掉内联 onclick 的妥协，迁移到 emit 后还需确保不引入新的内联事件
- **subagent 抗不住复杂 Vue 测试**：T020 P3 经历过 3 次 subagent 空返回（Vue 组件测试过重），本次重构涉及多个组件结构变更，测试代码量大。P3 阶段需提前考虑测试拆分策略（基础纯函数单测 + 少量集成）
- **subagent 自我报告不可信（T020 P6 PAUSED 教训）**：T020 P6 第一轮因 subagent 报告"URL/skill 未核实"被 PAUSED，需新会话重验。**重构任务重灾区**：subagent 容易自我报告"重构成功，行为等价"，但实际有细微回归。本任务 P6 必须由主 Agent 亲自跑 Playwright 验证关键场景，不接受 subagent PASS 报告作为 gate 通过证据
- **重构 + 优化捆绑风险**：subagent 倾向于"顺手优化"（清理冗余代码、改个变量名、换个 API）。这种"重构 + 优化"捆绑极易引入行为回归。**P4 阶段明确禁止**：一次只做一件事——要嘛只重构（结构变行为不变），要嘛只优化（行为可能变）。本任务只做前者

## executor_env

- platform: opencode
- has_task_tool: true
- has_local_runtime: true
- network: full

## env_constraints

- debug_env:
  - 后端调试：`make debug`（127.0.0.1:8888，独立数据目录 /tmp/peekview-debug/，PEEKVIEW_DEBUG_MODE=1 自动隔离）
  - 后端测试：`cd backend && .venv/bin/python -m pytest tests/`（用 backend/.venv，editable v0.1.65）—— 本任务纯前端，后端测试仅作回归
  - 前端测试：`cd frontend-v3 && ./node_modules/.bin/vitest run`（非 npx vitest；vitest v1 不支持 --tb=short）
  - 前端构建：`cd frontend-v3 && npm run build`（自动复制到 static/）
  - Playwright E2E：`make debug-test`（需 debug backend 运行）
  - **严禁** pip3 install --break-system-packages -e .（AGENTS.md 铁律 5）
  - **严禁** 用 CLI 创建测试 entry（AGENTS.md 铁律 8），只通过 debug backend HTTP API
  - **严禁** 直接 sqlite3 操作生产数据库（AGENTS.md 铁律 6）

## pruning_tendency

全阶段保留。理由：
- 涉及 5+ 文件结构重组、状态迁移、API 兼容
- 测试覆盖不能降（P3 必做红线基线测试集，P5 必做全绿验证）
- **行为保真需要 P1/P3/P5/P6/P7 全部参与**（不能裁剪任何阶段）
- T020 XSS 净化为硬约束（P6 必做 XSS 验证）
- 与 T021 时序需协调（P1 阶段就需明确）
- 重构任务风险高（行为回归），不能省任何验证环节

**不裁剪任何阶段**：[P1, P2, P3, P4, P5, P6, P7, P8]

## phase_hint

[P1, P2, P3, P4, P5, P6, P7, P8]

## 范围声明

**本任务做**：
- `BaseDiagram.vue` 基类组件，封装 zoom/fullscreen/pan/PNG 导出骨架
- 三个 Diagram 子组件（Mermaid/PlantUML/SVG）改写为薄包装（目标 < 150 行/个）
- `useMarkdown` 改为渲染器注册模式：识别 fenced code block + 查表路由
- 新增 `useCodeBlockRenderer`（或类似命名）composable，托管 mermaidCache / plantumlSourcesMap / svgSourcesMap / renderToken
- MarkdownViewer 退化为"识别 + 派发"薄组件（目标 < 300 行）
- 事件委托迁移到 Vue emit，去掉 data-action 字符串协议
- 全部现有测试覆盖保留 + 新增组件/逻辑的针对性测试
- **【行为保真硬约束】**：重构前后所有用户可见行为逐项一致（见 `## behavioral_fidelity_strategy`）
  - 渲染输出字符级一致（HTML 快照测试）
  - 按钮交互（copy/toggle/PNG/fullscreen）行为不变
  - 运行时状态保留（文件树/TOC/滚动位置）
  - 性能不退化
  - T020 XSS 净化保留
  - 响应式/主题切换/IME 行为不变
  - CSP 合规不引入新内联事件
  - 错误处理路径不变

**本任务不做**：
- 统一 Block 协议（不过度设计，code/markdown/html/image/mermaid/plantuml/svg 性质差异大）
- 动 `EntryDetailView.vue` 主体（仅在 MarkdownViewer 引用接口变化时最小化调整其调用方）
- 动 backend / MCP / CLI（纯前端重构）
- 改 API 行为（语义不变，只重构内部结构）
- 引入新的第三方依赖（用现有 vue / svg-pan-zoom / mermaid / plantuml / shiki）
- 把 markdown 渲染从 markdown-it 换成其他库

## coordination

- **T021 时序**：T021（zen-mode）改 EntryDetailView.vue 头部/侧栏。本任务 P4 实施**必须等 T021 完成 P4 实施**再启动，避免多 agent 并发改动冲突。P0 阶段标记此约束，P1/P2 阶段复核
- **T020 复盘教训应用**：
  - **P3 subagent 空返回**：T020 P3 经历 3 次 subagent 空返回（Vue 组件测试过重），本任务 P3 测试设计需提前拆分——基础纯函数单测（composable 逻辑）放首位，组件集成测试放后位，避免单 test file 过重
  - **P6 PAUSED 重验**：`a2945978 wf(T020-P6): PAUSED — P6 结果存疑（URL/skill 未核实），需新会话重验` 教训：subagent 自我报告 PASS 不可信。本任务 P6 必须由主 Agent 亲自跑 Playwright 验证关键场景，**不接受 subagent PASS 报告作为 gate 通过证据**
  - **行为保真硬约束**：T020 在主 Agent 亲自 Playwright 验证 16/16 BDD 通过后才发版，本任务同样需要主 Agent 亲自验证行为保真
- **T020 安全债保留**：svg DOMPurify 净化在 useMarkdown 渲染阶段，重构后此净化逻辑必须保留（迁入渲染器注册表或保留在 useMarkdown）。P6 必出 XSS 验证用例

## 预期成果

| 指标 | 当前 | 目标 |
|------|------|------|
| MarkdownViewer.vue | 1989 行 | < 300 行 |
| MermaidDiagram.vue | 598 行 | < 150 行（薄包装） |
| PlantUmlDiagram.vue | 416 行 | < 150 行（薄包装） |
| SvgDiagram.vue | 478 行 | < 150 行（薄包装） |
| 新增 BaseDiagram.vue | — | < 400 行（基类骨架） |
| 新增 useCodeBlockRenderer.ts | — | < 200 行（状态 composable） |
| useMarkdown.ts 公开 API | 返回 mermaidSources 等 3 个 Map | 返回通用 sources Map + 渲染器路由 |
| 加新图表类型工作量 | 5 文件 × ~500 行 | 1 文件 + 1 行注册 |
| 测试覆盖 | 86 单测 + 16 BDD | 全保留 + 新增 |
| 行数总计 | ~3500 行 | ~1500 行（-57%） |
| **行为保真报告** | — | **P6 必出**：重构前 vs 重构后逐项对比表 + 截图/录屏证据 |
