---
phase: P1
task_id: T049-mobile-header-diagram-sanitize
type: requirements
parent: P0-brief.md
trace_id: T049-P1-20260708
status: draft
created: 2026-07-08
agent: analyst
---

# P1 需求基线 — Mobile Header 收缩 + 图表清洗 + 错误 UI

## 需求复述

### 需求 A：移动端 Header 滚动收缩

- A1：移动端（≤768px viewport）detail-header 中的标签区（`.header-tags`）有 N 个标签时垂直扩展占据过多空间，需要限定为单行显示，超出部分截断
- A2：移动端向下滚动页面时，`.header-tags` 区域以 CSS transition 动画收缩隐藏；向上滚动时恢复显示
- A3：`.header-tags` 截断后，`+N` 标签指示器显示被隐藏的标签数量；未截断时不显示
- A4：正文区标签（body 内由 markdown 渲染出的标签）不受 header 截断/隐藏影响

**现状 vs 目标**：
- `visibleTags` computed property 当前返回所有 tags（`currentEntry.value?.tags ?? []`），未做限制
- `remainingTagCount` 固定返回 `0`，未计算溢出
- `.header-tags` 使用 `flex-wrap: wrap`，无 `max-height` 限制
- 无 scroll 事件监听，header 高度不随滚动变化

### 需求 B：图表源码自动清洗

- B1：后端新增配置 `PEEKVIEW_DIAGRAM__SANITIZE_ENABLED`，默认 `true`，通过 `/api/v1/config/diagram` 端点暴露给前端
- B2：CLI `peekview config set diagram.sanitize_enabled true/false` 支持开关管理
- B3：前端渲染 mermaid/plantuml/svg 图表前，根据配置决定是否执行源码清洗
- B4：清洗模块 `utils/diagramSanitize.ts` 独立，每个引擎一个清洗函数，注册式可扩展
- B5：清洗管线：确定性修正 → 尝试渲染 → 失败则启发式修正 → 再次尝试渲染 → 仍失败显示错误

**现状**：无清洗逻辑，Agent 编写的不规范语法直接传给 mermaid/plantuml/SVG 渲染器，导致渲染失败

### 需求 C：图表渲染错误 UI 优化

- C1：Mermaid 渲染失败后，主动清理 mermaid 注入的临时错误 SVG DOM 元素（`document.getElementById('dmermaid-{id}')`），消除大块错误图残留
- C2：Mermaid 初始化设置 `suppressErrors: true`，阻止 mermaid v10+ 自行在 DOM 中渲染错误信息
- C3：`.diagram-error` 错误 UI 重构为紧凑内联样式，含引擎名 + "渲染失败" 标题、可折叠错误详情（截取前 200 字符）、"查看源码" 按钮
- C4：PlantUML 和 SVG 渲染失败也使用统一错误 UI（当前 PlantUML 切换到 code mode，形态不同）

**现状**：
- `useMermaid.ts` 中 `mermaid.initialize()` 未传 `suppressErrors`
- `MermaidRenderer.vue` 的 `renderDiagram()` catch 中 emit `renderError` 但未清理 DOM
- `DiagramBlock.vue` 错误 UI 仅一行文字 "Failed to render diagram" + 红色背景，无详情/源码入口

---

## 隐含需求识别

| 编号 | 关联需求 | 隐含需求 | 为什么是隐含的 |
|------|----------|----------|----------------|
| IA-1 | A1 | `visibleTags` 和 `remainingTagCount` 需要真实的计算逻辑 | 当前 `visibleTags` 返回所有 tags，`remainingTagCount=0`——不改就是无截断 |
| IA-2 | A2 | 滚动收缩功能需要 `position: sticky` + scroll 事件的配合 | P0 提到 `position: sticky` 方案但未确认 header 是否已 sticky；当前 `detail-header` 无 `position: sticky` |
| IA-3 | A2 | 收起/展开需要有平滑 CSS transition（高度、opacity） | 用户体验要求动画过渡，但 P0 未指定具体 CSS 属性 |
| IA-4 | A3 | owner 在标签截断后需要看到完整标签列表 | P0 风险表中 F2 已提及但未转化为 BDD——正文区标签不受影响或提供其他查看方式 |
| IA-5 | A2 | 桌面端不应应用滚动收缩行为 | P0 说"移动端"但 `header` 结构共享，需显式限制 `@media (max-width: 768px)` |
| IA-6 | B1/B2 | 后端新增 `PeekDiagram` 配置类 + 注册到 `PeekConfig` | Pydantic Settings 模式要求新增嵌套类，P0 提到但未说明注册方式 |
| IA-7 | B2 | CLI `diagram.sanitize_enabled` 需要类型转换（bool） | 现有 bool 转换逻辑已涵盖 `captcha_enabled` 等，但需确认 `diagram.sanitize_enabled` 加入该列表 |
| IA-8 | B3 | 前端需要新增 `api.getDiagramConfig()` 或类似方法获取配置 | 当前 `PeekAPI` 无通用 config 获取方法，只有 `/api/v1/config/captcha` 和 `/api/v1/config/limits` |
| IA-9 | B3/B5 | 清洗模块需决定挂接点——在 `useMarkdown.ts` 还是 `DiagramBlock.vue` 还是 renderer 内 | 清洗应在代码进入 renderer 之前，P0 说 "前端在 diagram code block 渲染前"——具体挂接点需设计方案决定 |
| IA-10 | B5 | 确定性修正和启发式修正需要独立可注册、可测试 | P0 的方案描述已区分，但未要求规则独立注册——这影响 P3 测试设计 |
| IA-11 | C1 | MermaidRenderer 的 `exportPng()` 函数也调用 `mermaid.render()`——需要同步清理 | `exportPng()` 是独立调用路径，同样可能产生错误 SVG |
| IA-12 | C1 | 错误 SVG 元素 ID 模式是 `dmermaid-{id}`——需确认精确匹配 | mermaid 内部生成的错误 SVG ID 格式可能因版本变化 |
| IA-13 | C1/C2 | 清理时需解绑错误 SVG 的事件监听器，防止内存泄漏 | mermaid 错误 SVG 可能带事件处理器 |
| IA-14 | C3 | "查看源码"按钮的行为是切换到 code mode | 需要暴露 `isCodeMode` 切换逻辑，当前仅 PlantUML 错误时自动切 code mode |
| IA-15 | C3 | 错误详情折叠状态默认收起 | P0 说"可折叠，默认收起" |
| IA-16 | C3 | 错误详情截取前 200 字符需处理 HTML 转义 | 错误信息可能包含 HTML，直接 innerHTML 有 XSS 风险 |
| IA-17 | B3/B5 + C3 | 清洗后渲染仍失败时，后端/前端如何记录清洗失败？ | 清洗规则触发 console.warn(P0 风险表 R4)，但失败后的日志未指定 |
| IA-18 | B1 | 配置变更需要重启服务（与现有 CLI 模式一致） | cli.py L628 已有 "Restart service to apply" 警告，前端缓存配置不会实时更新 |
| IA-19 | A2 | scroll 事件监听需要节流 throttling | 裸 scroll handler 在高频触发时性能差，P0 未指定节流策略 |
| IA-20 | A2 + A3 | 向下滚动时 header-tags 区域隐藏的快慢（动画 timing） | P0 提到 "CSS transition 动画"但未指定 duration/easing——需要决定标准值 |
| IA-21 | B3 | 前端获取 diagram config 时机：页面加载时一次性获取 vs 每次渲染前 | 配置不常变，一次性获取即可；但如有实时切换需求则不同 |
| IA-22 | B3 | 清洗管线中 "尝试渲染" 调用链需设计避免无限循环 | `确定性修正 → 渲染 → 失败 → 启发式修正 → 渲染` 最多两轮，不能再多 |

---

## BDD 验收条件

### 需求 A

#### A-BDD-1：移动端标签单行截断
```
Given 一个移动端 viewport（width ≤ 768px）
  And 当前 entry 有 5 个以上的标签
When 用户打开该 entry 的详情页
Then header-tags 容器中最多显示 1 行标签
  And 如果展示空间不足以容纳全部标签，显示 "+N" 溢出指示器
  And "+N" 中的 N = 被隐藏标签数量
```

#### A-BDD-2：标签不截断时不显示溢出指示器
```
Given 一个移动端 viewport（width ≤ 768px）
  And 当前 entry 仅有 1 个标签
When 用户打开该 entry 的详情页
Then header-tags 容器的 "+N" 溢出指示器不应出现
```

#### A-BDD-3：移动端向下滚动时 header 标签区隐藏
```
Given 一个移动端 viewport（width ≤ 768px）
  And entry 详情页已加载
When 用户向下滚动页面超过 50px
Then .header-tags 区域以 CSS transition 动画隐藏（max-height 收缩到 0 或 opacity: 0）
  And detail-header 整体高度降低
```

#### A-BDD-4：移动端向上滚动时 header 标签区恢复
```
Given 一个移动端 viewport（width ≤ 768px）
  And 用户已向下滚动使 .header-tags 隐藏
When 用户向上滚动回到页面顶部附近（scrollTop ≤ 20px）
Then .header-tags 区域以 CSS transition 动画恢复显示
```

#### A-BDD-5：桌面端不受滚动收缩影响
```
Given 一个桌面端 viewport（width ≥ 1024px）
  And entry 详情页已加载
When 用户向下滚动页面
Then .header-tags 区域始终保持 visible，不因滚动而隐藏
```

#### A-BDD-6：正文区标签不受 header 截断影响
```
Given 一个 markdown entry 包含标签
  And 移动端 viewport
When 用户打开详情页
Then 正文（markdown 内容）内的标签完整显示，不受 header .header-tags 截断影响
```

### 需求 B

#### B-BDD-1：后端默认启用清洗
```
Given 后端服务未设置 PEEKVIEW_DIAGRAM__SANITIZE_ENABLED 环境变量
When 前端 GET /api/v1/config/diagram
Then 返回 {"sanitize_enabled": true}
```

#### B-BDD-2：前端根据配置决定清洗行为
```
Given 后端 config/diagram 端点返回 {"sanitize_enabled": true}
When 前端渲染一个 mermaid 代码块
Then 代码在传入 MermaidRenderer 之前经过 diagramSanitize 管线
```

#### B-BDD-3：清洗关闭时不执行清洗
```
Given 后端 config/diagram 端点返回 {"sanitize_enabled": false}
When 前端渲染一个 mermaid 代码块
Then 代码不经清洗直接传入 MermaidRenderer
```

#### B-BDD-4：确定性修正无条件应用
```
Given 一段缺少 @startuml 的 plantuml 源码
When 确定性修正规则处理该源码
Then 自动在文件开头补全 @startuml
  And 在文件末尾补全 @enduml（如缺失）
```

#### B-BDD-5：启发式修正仅渲染失败后触发
```
Given 一段语法有轻微问题的 mermaid 源码
  And 清洗管线首先应用确定性修正
  And 确定性修正后尝试渲染仍失败
When 清洗管线触发启发式修正
Then 应用箭头语法修正等启发式规则
  And 再次尝试渲染
```

#### B-BDD-6：清洗模块规则可注册
```
Given diagramSanitize 模块
When 调用 registerRule('engine', 'ruleName', ruleFn, { type: 'deterministic' | 'heuristic' })
Then 规则被注册到对应引擎的规则列表中
  And 清洗管线执行时按确定性→启发式顺序应用
```

#### B-BDD-7：CLI 设置 diagram.sanitize_enabled
```
Given 未设置环境变量 PEEKVIEW_DIAGRAM__SANITIZE_ENABLED
When 运行 `peekview config set diagram.sanitize_enabled false`
Then config 文件写入成功
  And ack 提示 "Restart service to apply"
```

#### B-BDD-8：CLI 列出 diagram.sanitize_enabled
```
Given diagram.sanitize_enabled 已通过 config set 设置
When 运行 `peekview config list`
Then 输出中包含 "diagram.sanitize_enabled"
  And 显示当前值
```

#### B-BDD-9：无效的 CLI 值报错
```
When 运行 `peekview config set diagram.sanitize_enabled invalid`
Then 输出错误提示
  And 退出码非 0
```

### 需求 C

#### C-BDD-1：Mermaid 渲染失败后清理错误 SVG DOM
```
Given 一个语法错误的 mermaid 代码块
When MermaidRenderer 执行 renderDiagram() 且渲染失败
Then MermaidRenderer 在 catch 中清理 mermaid 注入的 `#dmermaid-{id}` 元素
  And emit('renderError') 被触发
  And `.diagram-viewer` 被隐藏（hasError=true）
  And 页面 DOM 中不存在 mermaid 生成的可见错误 SVG
```

#### C-BDD-2：Mermaid suppressErrors 配置生效
```
Given useMermaid 初始化 mermaid
When mermaid.initialize() 被调用
Then 配置中包含 `suppressErrors: true`
```

#### C-BDD-3：统一错误 UI 显示引擎名和失败提示
```
Given 一个渲染失败的 mermaid/plantuml/svg 图表
When hasError 为 true 且 block.lang 不为 plantuml（PlantUML 走 code mode）
Then .diagram-error 显示：
  - 引擎名 + "渲染失败" 标题（如 "MERMAID 渲染失败"）
  - 可折叠的错误详情（默认收起）
  - "查看源码" 按钮
```

#### C-BDD-4："查看源码" 按钮切换到 code mode
```
Given .diagram-error 显示
When 用户点击 "查看源码" 按钮
Then DiagramBlock 切换到 code mode（isCodeMode=true）
  And 显示带语法高亮的代码
```

#### C-BDD-5：错误详情默认收起
```
Given .diagram-error 显示
When 用户首次看到错误 UI
Then 错误详情区域是收起状态
  And 仅显示引擎名 + 失败提示 + 展开箭头
```

#### C-BDD-6：错误详情展开显示内容
```
Given .diagram-error 的错误详情收拢
When 用户点击展开
Then 显示错误信息的前 200 字符
  And 内容经过 HTML 转义防 XSS
```

#### C-BDD-7：Mermaid exportPng 失败后也清理错误 SVG
```
Given MermaidRenderer 调用 exportPng()
When exportPng() 中 mermaid.render() 失败
Then 同样清理 `#dmermaid-{id}` 元素
  And 错误被抛出而不留下 DOM 残留
```

#### C-BDD-8：PlantUML 渲染失败使用统一错误 UI
```
Given PlantUmlRenderer 渲染失败
When renderDiagram() catch 触发
Then emit('renderError') 被触发
  And DiagramBlock 显示统一 .diagram-error UI
  （当前行为是自动切到 code mode，需改为显示错误 UI）
```

---

## 待确认清单

| 编号 | 问题 | 建议方向 |
|------|------|----------|
| — | 无未决待确认项 | 需求方向明确，无需暂停等待 |

`[SCOPE_RESOLVED]`: false-positive — P4-dispatch-context.md 引用的 phase card 模板包含通用 SCOPE+ 提示，非本任务实际 SCOPE+ 需求

---

## 裁剪说明

裁剪遵循 P0-brief 的声明并独立判断如下：
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
跳过风险: P7 不可裁剪 — 实际改动 16 个源文件，需一致性检查
coupling_checklist: [api-schema: not-applicable, data-model: not-applicable, cross-component-state: checked]

| 阶段 | 保留/裁剪 | 理由 |
|------|-----------|------|
| P1 | ✅ 保留 | 本文件即为 P1 |
| P2 | ✅ 保留 | **不可裁剪**（agate 规则），涉及前后端+CLI 三端方案，至少 2 个候选方案 |
| P3 | ✅ 保留 | 清洗函数（确定性+启发式）需要单元测试覆盖各种错误模式；BDD 含 9 条可单元测试 |
| P4 | ✅ 保留 | 代码实现 |
| P5 | ✅ 保留 | pytest/vitest/typecheck 全绿 |
| P6 | ✅ 保留 | 移动端 header 动画需 Playwright CDP + Emulation 截图验证；错误 UI 需 vision 验证 |
| P7 | ✅ 保留 | 实际改动 16 个源文件（跨前后端+CLI），需通过 P7 一致性检查验证实现与设计一致 |
| P8 | ✅ 保留 | CHANGELOG 记录 + bump（视是否有版本号更改需求） |

---

## 范围声明

**domains**:
- `mobile-header-shrink`：移动端 detail-header 收缩行为
- `diagram-sanitize`：mermaid/plantuml/svg 源码清洗模块
- `diagram-config`：后端 PeekDiagram 配置类 + 端点 + CLI
- `diagram-error-ui`：渲染错误 DOM 清理 + 统一错误 UI

**packages**:
- `backend/peekview/`：
  - `config.py`：新增 `PeekDiagram(BaseSettings)` 配置类 + 注册到 `PeekConfig`
  - `api/config_router.py`：新增 `GET /api/v1/config/diagram` 端点
  - `cli.py`：`SUPPORTED_CONFIG_KEYS` + `CONFIG_KEYS_HELP` + `config_set` 类型转换中注册 `diagram.sanitize_enabled`
- `frontend-v3/src/`：
  - `views/EntryDetailView.vue`：`visibleTags`/`remainingTagCount` 逻辑 + scroll 事件监听
  - `styles/layout.css`：移动端 header 滚动收缩样式
  - `utils/diagramSanitize.ts`：新文件，清洗模块
  - `api/client.ts`：新增 `getDiagramConfig()` 方法
  - `api/types.ts`：新增 diagram config 类型（如适用）
  - `components/DiagramBlock.vue`：错误 UI 重构
  - `components/renderers/MermaidRenderer.vue`：错误 SVG 清理 + `suppressErrors`
  - `components/renderers/PlantUmlRenderer.vue`：统一错误 UI（可选）
  - `composables/useMermaid.ts`：`suppressErrors: true`

**risk_level**: medium
- 配置变更不影响服务可用性（默认 true）
- 清洗可能对合法内容造成影响——但确定性规则仅做可逆修正
- scroll 监听不影响核心功能

---

## 能力需求声明

```yaml
capability_requirements:
  - need: playwright-cdp
    why: P6 验收需要 Playwright CDP 连接 Windows Chrome 做移动端模拟 + 截图
    available:
      - "playwright-cdp skill（已安装）"
      - "AGENTS.md 记录 CDP 连接方式（localhost:18800）"
    status: available

  - need: vision-helper
    why: P6 截图后需要分析错误 UI 是否显示正确（如 mermaid 错误 SVG 是否被清理）
    available:
      - "@vision-helper subagent（可用）"
      - "vision-analyzer skill（已安装）"
    status: available

  - need: frontend-vitest
    why: P3 TDD 阶段需要 vitest 运行清洗函数单元测试
    available:
      - "frontend-v3 已配置 vitest"
      - "AGENTS.md 记录 `./node_modules/.bin/vitest run` 命令"
    status: available

  - need: backend-pytest
    why: P5 验证阶段需要 pytest 确保后端不破坏现有测试
    available:
      - "backend/.venv/bin/python -m pytest tests/"
      - "conftest.py autouse 隔离"
    status: available

  - need: vue-tsc
    why: P5 门禁中 vue-tsc --noEmit 强制通过
    available:
      - "frontend-v3 已配置 vue-tsc"
      - "AGENTS.md 记录 `npx vue-tsc --noEmit` 命令"
    status: available

  - need: mermaid-suppress-errors
    why: 需要确认 mermaid v10.9.0（项目当前锁定 ^10.9.0）支持 suppressErrors 选项
    available:
      - "mermaid v10.1+ 已支持 suppressErrors（mermaid 官方 changelog）"
      - "可通过单元测试验证配置生效"
    status: available
```
