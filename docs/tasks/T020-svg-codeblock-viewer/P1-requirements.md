---
phase: P1
task_id: T020
task_name: svg-codeblock-viewer
trace_id: T020-P1-20260624
parent: P0-brief.md
created: 2026-06-24
---

# P1 需求基线 — T020 svg-codeblock-viewer

## 1. 需求复述

为 markdown 中 ` ```svg ` 围栏代码块新增一体化查看体验，对齐现有 mermaid/plantuml 工具栏能力：默认渲染矢量图、图/码 toggle、复制源码、下载 PNG（**透明背景**）、全屏/缩放。同时修正过时的 `frontend-v3/src/utils/__tests__/mime.spec.ts`（其断言 `guessMimeType('icon.svg')` 为 null，但 `mime.ts` 自 e8069c6b 起已映射 svg → `image/svg+xml`，测试未跟上导致 1 个失败）。

与 mermaid/plantuml 的本质区别：后者是「源码 → 库生成 SVG」，本任务是「现成 SVG 内容 → 直接渲染」。工具栏 UI 壳可复用，挂载/渲染流程不同。安全前提：SVG 可内嵌 `<script>`/事件处理器/`foreignObject`，渲染时必须净化，且不得扩大其他渲染管线的攻击面。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IR1 | **DOMPurify SVG 净化策略**：` ```svg ` 代码块内容直接进入 DOM，须用允许 SVG 图形元素（svg/g/path/rect/circle/text/…）的净化配置，同时剥除 `<script>`、`on*` 事件属性、`<foreignObject>`、`javascript:`/外部 `href` 引用 | known_risk #1；SVG 是已知 XSS 载体，现有 mermaid/plantuml 的 SVG 经库生成且注入到空挂载点、未走最终 `DOMPurify.sanitize`，从未处理「用户提供的 SVG 内容」 |
| IR2 | **净化作用域隔离**：为支持 SVG 而改动的 DOMPurify 配置，不得改变内联 `<svg>` 管线现状，也不得削弱普通 markdown/html 的 script/事件属性剥除 | known_risk #2 三管线不互扰 + 范围声明「内联 `<svg>` 维持现状」；全局开启 SVG profile 可能改变内联 `<svg>` 现有渲染结果，须作用域化处理（对 svg 代码块内容单独 sanitize，或确认全局改动不波及） |
| IR3 | **PNG 透明导出独立于 mermaid/plantuml 白底导出**：现有 `downloadMermaidPng`/`downloadPlantUmlPng` 均 `ctx.fillStyle='#ffffff'` 填白底，SVG 导出须保留透明 alpha，不可共用该路径 | known_risk #4；范围声明明确要求透明背景 |
| IR4 | **复用 UI 壳但独立渲染流程 + pan-zoom viewer**：svg 代码块无库异步渲染，直接注入净化后 SVG；全屏/缩放须有适用于任意 SVG 的 viewer（mermaid 用 `MermaidDiagram` 组件，svg 代码块需等价能力） | known_risk #3；不能照抄 mermaid 的「源码→生成」挂载流程 |
| IR5 | **尺寸/ViewBox 回退**：用户 SVG 可能缺 `width`/`height`/`viewBox`，展示与 PNG 导出需回退尺寸，不得产生零尺寸图或崩溃 | mermaid 导出有完整回退链；svg 代码块内容不可控，须等价健壮 |
| IR6 | **主题响应**：图形视图静态不变，代码视图须随 light/dark 主题切换重高亮（Shiki） | 与现有 code block 行为一致；mermaid 按 theme 缓存重渲染，svg 图形本身无需重渲染 |
| IR7 | **`mime.spec.ts` 测试更正**：将 `expect(guessMimeType('icon.svg')).toBeNull()` 改为 `toBe('image/svg+xml')` | known_risk #6；映射正确，测试过时 |
| IR8 | **交互委托复用 `data-action` 机制**：新工具栏按钮走现有 `handleDelegatedAction` 委托，新增 svg 相关 action 分支 | 一致性；`data-action`/`data-block-id` 已在 DOMPurify `ADD_ATTR` 白名单 |
| IR9 | **多端同步：无** | ` ```svg ` 代码块渲染纯前端（markdown 渲染层），不涉及 backend/MCP/CLI；`mime.spec.ts` 亦为前端单测。多端维度已过，无同步需求 |
| IR10 | **数据维度：无** | 不涉及 DB schema/迁移/存量数据；仅前端渲染 + 单测 |
| IR11 | **兼容维度**：`mime.ts` 返回 `image/svg+xml` 是 e8069c6b 既定行为（供独立 .svg 文件 ImageViewer 使用），本任务仅修测试不改映射，须确认无消费方依赖旧「null」语义 | 防止修测试引入隐性回归 |

## 3. BDD 验收条件

> 以下为 P6 验收依据，逐条可独立验证。XSS 类须在真实浏览器（Playwright）实跑。

**BDD-1 代码块渲染矢量图**
Given markdown 含一个 ` ```svg ` 围栏代码块，内容为合法 SVG（如 `<svg xmlns="..."><circle r="40" fill="red"/></svg>`）
When 查看该 entry
Then 块渲染为带工具栏的容器（标签 "SVG"、toggle、fullscreen、下拉菜单）AND 图形视图区存在一个内联 `<svg>` 元素并显示矢量图（红色圆形），而非仅语法高亮的源码文本

**BDD-2 默认显示图形视图**
Given 一个已渲染的 ` ```svg ` 代码块
When 页面加载完成
Then 图形模式（diagram-mode）为 active 可见，代码模式隐藏 AND toggle 按钮文本为 "Diagram"

**BDD-3 图/码 toggle**
Given ` ```svg ` 代码块处于图形模式
When 点击 toggle 按钮
Then 切换到代码模式：显示 Shiki 高亮的原始 SVG 源码 AND 图形视图隐藏 AND toggle 文本变为 "Code"
When 再次点击
Then 切回图形模式 AND toggle 文本变回 "Diagram"

**BDD-4 复制源码**
Given 一个 ` ```svg ` 代码块
When 打开下拉菜单并点击 "Copy Code"
Then 原始 SVG 源码文本被写入剪贴板 AND 出现瞬时 "Copied!" 反馈（2s 内恢复）

**BDD-5 下载 PNG（透明背景）**
Given 一个 ` ```svg ` 代码块，其 SVG 无背景填充（透明）
When 点击 "Download PNG"
Then 下载一个 PNG 文件 AND 该 PNG 在 SVG 空白区域 alpha 通道为 0（透明，**非白底**）——可通过对角像素采样 alpha=0 验证

**BDD-6 全屏/缩放**
Given ` ```svg ` 代码块处于图形模式
When 点击 fullscreen 按钮
Then SVG 在全屏/overlay viewer 中打开，支持滚轮缩放与拖拽平移 AND 可关闭返回内联视图

**BDD-7 XSS：script 剥除**
Given ` ```svg ` 代码块 SVG 内含 `<script>alert(1)</script>`
When 渲染
Then 渲染后块 DOM 中不存在任何 `<script>` 元素 AND 无 alert 弹出 AND 其余图形元素保留可见

**BDD-8 XSS：事件属性剥除**
Given ` ```svg ` 代码块 SVG 内含 `<circle onclick="alert(1)" onload="alert(2)" r="10"/>`
When 渲染并点击该圆形
Then 渲染后 DOM 中不存在任何 `on*` 事件属性 AND 点击不触发任何处理器 AND 圆形图形保留可见

**BDD-9 XSS：危险 SVG 构造剥除、图形保留**
Given ` ```svg ` 代码块 SVG 内含 `<foreignObject><div>x</div></foreignObject>`、`<use href="javascript:alert(1)"/>` 及合法的 `<path>/<rect>/<text>/<g>` 元素
When 渲染
Then 合法图形元素（path/rect/text/g/svg）保留并可见 AND `foreignObject` 与 `javascript:` 引用被移除

**BDD-10 三管线不互扰：内联 `<svg>`**
Given markdown 含内联 `<svg>`（非围栏代码块）
When 渲染
Then 其行为与本任务前完全一致（不加工具栏；渲染/净化结果不变）——即 svg 代码块支持的引入不改变内联 svg 管线

**BDD-11 三管线不互扰：独立 .svg 文件**
Given entry 含独立 `.svg` 文件
When 经 ImageViewer 查看
Then 维持现有行为（只看图 + 点击缩放），不施加新工具栏

**BDD-12 三管线不互扰：共存**
Given markdown 同时含 mermaid、plantuml、` ```svg ` 三个代码块
When 渲染并对其中任一执行 toggle/下载
Then 三者各自正确独立渲染，互不影响

**BDD-13 mime.spec.ts 修复**
Given `guessMimeType` 工具函数
When 调用 `guessMimeType('icon.svg')`
Then 返回 `'image/svg+xml'`（测试已更正为期望此值，不再为 null）AND `mime.spec.ts` 全套绿

**BDD-14 DOMPurify 配置作用域（隐含 IR2）**
Given useMarkdown 末尾的全局 `DOMPurify.sanitize`
When 引入 ` ```svg ` 代码块支持
Then SVG 净化能力作用于 svg 代码块内容，且不削弱非 SVG 内容的 script/事件属性剥除；若采用全局配置改动，则内联 `<svg>` 管线行为须仍满足 BDD-10

**BDD-15 尺寸回退（隐含 IR5）**
Given ` ```svg ` 代码块的 SVG 缺 `width`/`height`/`viewBox`
When 渲染与导出 PNG
Then viewer 与导出采用合理回退尺寸，不崩溃、不产出零尺寸图

**BDD-16 主题响应（隐含 IR6）**
Given 已渲染的 ` ```svg ` 代码块
When 切换 light/dark 主题
Then 图形视图保持正确渲染（矢量不坏）AND 代码视图按主题重高亮

## 4. 待确认清单

无 `[NEED_CONFIRM]`。

理由：所有方向均由 P0 约束唯一确定——「三管线不互扰」「维持现状」「透明背景」给出了清晰边界；剩余均为可在 P2/P5 验证的纯技术问题（如内联 `<svg>` 当前是否被剥除、DOMPurify 默认对 SVG 子元素的处理），不涉及业务方向判断，不阻塞流程。若 P2 验证发现内联 `<svg>` 现状与假设冲突，按 `[SCOPE+]` 回写本基线再定。

## 5. 裁剪说明

`pruning_tendency: 保守`，声明：

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

全走，无跳过。理由：
- 涉及前端 UI 新功能 + XSS 净化 + 多管线并存，P2 设计（UI 壳结构、净化作用域策略、PNG 透明导出方案、viewer 选型）不可跳；
- P3 默认保留——XSS 净化与 PNG 透明导出有明确可测边界，须先写测试；
- P5 技术验证（vitest + Playwright 净化实跑）不可跳；
- P6 验收（BDD 逐条实跑 + 浏览器截图）不可跳——涉及安全与 schema 无关但属多端 UI，裁剪风险高；
- P7 一致性（多文件：useMarkdown.ts / MarkdownViewer.vue / mime.spec.ts / 可能新增 viewer 组件）保留；
- P8 发布准备（前端构建产 static/，版本 bump + CHANGELOG）保留。

`P1_simplified: false`（非小任务降级模式）。

## 6. 范围声明

**确认 P0 做/不做边界（接受）：**

做：
- ` ```svg ` 围栏代码块加工具栏（渲染矢量图 + 图/码 toggle + 复制源码 + 下载 PNG 透明底 + 全屏/缩放）
- 修复 `mime.spec.ts` 过时断言（期望 `image/svg+xml`）

不做：
- 独立 `.svg` 文件 ImageViewer 升级（维持现状）
- 内联 `<svg>` 加工具栏（维持现状，但 IR2/BDD-10 要求不改变其现有行为）
- `![alt](file.svg)` markdown 图片引用形式
- SVG 编辑功能
- SVG 内嵌动画/交互脚本支持（按静态矢量图处理——BDD-7/8/9 须剥除脚本与事件属性，与此一致）

```yaml
packages:
  - frontend-v3        # 唯一改动包；markdown 渲染层 + 单测
domains:
  - frontend
  - security           # DOMPurify SVG 净化、XSS 攻击面控制
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: dompurify-svg-sanitization
    why: svg 代码块内容净化（剥除 script/事件属性/foreignObject，保留图形元素）
    available:
      - dompurify（已在 frontend-v3 依赖，useMarkdown.ts 在用）
    status: available

  - need: syntax-highlighting
    why: 代码视图对 SVG 源码 Shiki 高亮 + 主题切换重高亮
    available:
      - shiki（useShiki 已在用）
    status: available

  - need: browser-vision
    why: P6 验收须在真实浏览器实跑 XSS 净化、工具栏交互、PNG 透明像素采样、全屏缩放
    available:
      - playwright-vision skill（已注入，本地 Chrome CDP 18800）
    status: available
```

无 `[CAPABILITY_GAP]`。三态均为 available，流程自走。
