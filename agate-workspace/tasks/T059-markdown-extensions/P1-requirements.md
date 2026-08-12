---
phase: P1
task_id: T059
type: requirements
parent: P0-brief.md
trace_id: T059-P1-20260720
status: revised
created: 2026-07-20
agent: analyst
---

# P1 Requirements: Markdown 扩展补全（KaTeX + Task List + Footnote + Sub/Sup）

## 1. 需求复述

为 PeekView 的 Markdown 渲染器（`useMarkdown.ts`）添加四项扩展语法支持，使技术文档渲染完整：

| # | 扩展 | 语法 | 渲染目标 | 优先级 |
|---|------|------|----------|--------|
| E1 | KaTeX 数学公式 | `$inline$` / `$$display$$` | 可视化数学公式（行内+块级） | 🔴 高 |
| E2 | 任务列表 | `- [x]` / `- [ ]` | 带 checkbox 的列表项（只读） | 🟠 中 |
| E3 | 脚注 | `[^1]` + `[^1]: ...` | 可点击脚注引用+底部注释区 | 🟠 中 |
| E4 | 上标/下标 | `x^2^` / `H~2~O` | `<sup>` / `<sub>` 标签 | 🟡 中低 |

**约束**：纯前端变更，不涉及后端 API/数据库/MCP/CLI。

## 2. 隐含需求识别

### 2.1 DOMPurify 白名单（前端/安全）

**发现**：经实测验证，DOMPurify 3.x 默认白名单已覆盖四项扩展所需的全部标签和属性：

| 扩展 | 所需标签 | DOMPurify 默认允许 | 所需属性 | DOMPurify 默认允许 |
|------|----------|-------------------|----------|-------------------|
| KaTeX | span, math, svg, line, mfrac, mi, annotation | ✅ 全部 | class, style, aria-hidden, xmlns, mathcolor, encoding | ✅ 全部（aria-* 有正则模式） |
| Task List | input, ul, li | ✅ 全部 | type, checked, disabled, class | ✅ 全部 |
| Footnote | sup, section, hr, ol, li, a | ✅ 全部 | id, href, class | ✅ 全部 |
| Sub/Sup | sub, sup | ✅ 全部 | （无特殊属性） | ✅ |

**结论**：当前 `ADD_ATTR` / `ADD_TAGS` 配置是增量式（添加到默认，非替换），四项扩展无需新增白名单条目。但 P0-brief 标记此为风险，P5 必须实测验证 DOMPurify 对 KaTeX 完整输出的通过率。

**隐含需求**：DOMPurify 配置在 3 处调用（`useMarkdown.ts`、`SvgRenderer.vue`、`useMarkdown.svg.spec.ts`）需保持一致。若 P5 发现需扩展白名单，3 处必须同步修改。

### 2.2 KaTeX CSS 加载策略（前端/性能）

**发现**：`katex.min.css` 约 24KB（未压缩），含 `@font-face` 声明引用 KaTeX 数学字体。

**隐含需求**：
- KaTeX CSS 必须在首屏渲染前加载完成，避免 FOUC
- 无需动态加载或按需加载（KaTeX CSS 是渲染必需品，不是可选增强）

### 2.3 KaTeX 暗色模式适配（前端/视觉）

**发现**：KaTeX 默认使用黑色文字，在暗色主题下不可见。

**隐含需求**：
- 需在 `[data-theme='dark'] .markdown-body .katex` 中覆盖颜色变量
- KaTeX CSS 使用 `.katex` 下的颜色继承，覆盖 `.katex` 的 `color` 即可
- MathML 层（`katex-mathml`）设为 `display:none`，无需暗色适配

### 2.4 脚注 SPA 锚点行为（前端/交互）

**发现**：
- 脚注链接格式：`<a href="#fn1">` → `<li id="fn1">`
- 回引链接格式：`<a href="#fnref1" class="footnote-backref">` → `<sup id="fnref1">`
- 当前页面已有 `scroll-behavior: smooth`（`base.css`）和 `scrollIntoView` 模式（`TocNav.vue`）
- `.markdown-body` 容器设 `overflow: auto`，是独立滚动容器

**隐含需求**：
- 原生 `#hash` 锚点在 `overflow:auto` 容器内可能不滚动（浏览器滚动 document，非子容器）
- 脚注链接点击后页面滚动到目标位置
- 回引链接同理
- 不应触发 Vue Router 导航

### 2.5 任务列表 checkbox 只读性（前端/交互）

**发现**：`markdown-it-task-lists` 生成的 `<input>` 已带 `disabled` 属性，用户无法勾选。

**隐含需求**：
- 无需额外 JavaScript 禁用逻辑
- 需 CSS 美化 checkbox 外观（与 GitHub 风格一致）
- 暗色模式下 checkbox 需适配

### 2.6 脚注/任务列表 CSS 样式（前端/视觉）

**发现**：当前 `MarkdownViewer.vue` 无脚注和任务列表样式。

**隐含需求**：
- 脚注：分隔线样式、脚注区缩进、引用编号上标样式、回引箭头样式
- 任务列表：checkbox 与文字对齐、列表项缩进调整
- 暗色模式：所有新增样式需暗色变体

### 2.7 $ 分隔符与货币冲突（边界）

**发现**：`@iktakahiro/markdown-it-katex` 内置智能分隔符解析：
- `$` 后跟数字 → 不视为数学分隔符（`$100` → 纯文本）
- `$` 在行内代码中 → 不触发（`` `$var` `` → 代码）
- 未闭合 `$` → 渲染为纯文本（不报错）
- `\$` → 转义为字面 `$`

**结论**：P0-brief 标记的风险已被插件自身缓解，无需额外配置。但需在 BDD 中覆盖边界用例验证。

### 2.8 多端影响确认（兼容）

| 端 | 影响 | 理由 |
|----|------|------|
| Backend API | 无 | Raw API 返回原始 markdown，不涉及渲染 |
| MCP Server | 无 | `publish_files` / `get_entry` 不修改 markdown 内容 |
| CLI | 无 | `peekview create` / `get` 不涉及前端渲染 |
| HTML Render | 间接 | 后端 BS4 sibling 注入不解析 markdown，但 HTML render 路由的 CSP 已足够宽松 |

### 2.9 KaTeX 错误渲染（边界）

**发现**：`@iktakahiro/markdown-it-katex` 默认 `throwOnError: false`，未识别命令渲染为红色文字（`mathcolor="#cc0000"`），不抛异常。

**隐含需求**：
- 错误公式应可见（红色标记），不应静默消失
- 暗色模式下红色错误文字需保持可读性

### 2.10 脚注 ID 含冒号（边界）

**发现**：重复引用同一脚注时，`markdown-it-footnote` 生成 `id="fnref1:1"`（含冒号）。HTML ID 允许冒号，CSS 选择器需转义。DOMPurify 不剥离含冒号的 ID。

**隐含需求**：若需用 JS 定位此类元素，`getElementById('fnref1:1')` 可正常工作；CSS 选择器需 `#fnref1\\:1` 转义。当前无 CSS 按 ID 选择脚注元素，无影响。

## 3. BDD 验收条件

### E1: KaTeX 数学公式

**B1** — 行内公式渲染
```
Given markdown 内容含 "$e^{i\pi}$"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 <span class="katex"> 且不包含字面文本 "$e^{i\pi}$"
```

**B2** — 块级公式渲染
```
Given markdown 内容含 "$$\frac{a}{b}$$"（独占一行）
When  useMarkdown.render() 执行
Then  块级公式独占一行渲染，与行内公式视觉区分
```

**B3** — 货币符号不误触发
```
Given markdown 内容含 "$100"（$ 后跟数字）
When  useMarkdown.render() 执行
Then  输出 HTML 不包含 <span class="katex">，$100 作为纯文本渲染
```

**B4** — 未闭合分隔符降级
```
Given markdown 内容含 "$x^2 unclosed"（无闭合 $）
When  useMarkdown.render() 执行
Then  输出 HTML 不包含 <span class="katex">，原文作为纯文本渲染
```

**B5** — KaTeX 错误公式可见
```
Given markdown 内容含 "$\undefinedcmd$"（未识别命令）
When  useMarkdown.render() 执行
Then  错误公式渲染为可见的红色标记文字，不静默消失
```

**B6** — DOMPurify 不剥离 KaTeX 输出
```
Given markdown 内容含 "$\frac{a}{b}$"
When  useMarkdown.render() 执行（含 DOMPurify sanitize）
Then  KaTeX 渲染输出经 DOMPurify 后结构完整，公式视觉正确
```

**B7** — KaTeX CSS 已加载
```
Given 应用已加载
When  检查文档 <head> 或 Vite 产物
Then  包含 KaTeX CSS 规则（.katex 相关样式）
```

**B8** — 暗色模式下公式可见
```
Given 暗色主题已激活（data-theme="dark"）
When  渲染含数学公式的 entry
Then  公式文字颜色与暗色主题下正文文字颜色一致
```

**B9** — 行内代码中 $ 不触发数学
```
Given markdown 内容含 "`$var`"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 <code>$var</code>，不包含 <span class="katex">
```

### E2: 任务列表

**B10** — 已完成任务渲染
```
Given markdown 内容含 "- [x] done"
When  useMarkdown.render() 执行
Then  渲染为带勾选状态的只读 checkbox
```

**B11** — 未完成任务渲染
```
Given markdown 内容含 "- [ ] todo"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 <input type="checkbox" disabled>（无 checked 属性）
```

**B12** — DOMPurify 不剥离 checkbox
```
Given markdown 内容含 "- [x] done"
When  useMarkdown.render() 执行（含 DOMPurify sanitize）
Then  输出 HTML 保留 <input type="checkbox"> 元素及其 checked、disabled 属性
```

**B13** — checkbox 不可交互
```
Given 渲染后的任务列表 checkbox
When  用户点击 checkbox
Then  checkbox 状态不变（checked 保持 disabled，checked 状态不翻转）
```

**B14** — 暗色模式下 checkbox 可见
```
Given 暗色主题已激活
When  渲染含任务列表的 entry
Then  checkbox 边框和背景与暗色主题下其他表单元素风格一致
```

### E3: 脚注

**B15** — 脚注引用渲染
```
Given markdown 内容含 "Hello[^1]" 和 "[^1]: This is a note"
When  useMarkdown.render() 执行
Then  脚注引用渲染为上标链接，指向脚注定义区
```

**B16** — 脚注回引链接
```
Given markdown 内容含脚注定义
When  useMarkdown.render() 执行
Then  脚注项包含回引链接，点击可跳回引用位置
```

**B17** — 未定义脚注降级
```
Given markdown 内容含 "Hello[^1]" 但无脚注定义
When  useMarkdown.render() 执行
Then  输出 HTML 包含纯文本 "[^1]"，不包含 <sup class="footnote-ref">
```

**B18** — 脚注锚点点击滚动
```
Given 渲染后的 entry 含脚注引用和脚注定义
When  用户点击脚注引用链接（<a href="#fn1">）
Then  页面平滑滚动到脚注定义位置（scrollIntoView 行为）
```

**B19** — 脚注回引点击滚动
```
Given 渲染后的 entry 含脚注回引链接
When  用户点击回引链接（<a href="#fnref1">）
Then  页面平滑滚动回脚注引用位置
```

**B20** — 暗色模式下脚注可读
```
Given 暗色主题已激活
When  渲染含脚注的 entry
Then  脚注分隔线、文字、链接颜色与暗色主题下正文风格一致
```

### E4: 上标/下标

**B21** — 上标渲染
```
Given markdown 内容含 "x^2^"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 x<sup>2</sup>
```

**B22** — 下标渲染
```
Given markdown 内容含 "H~2~O"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 H<sub>2</sub>O
```

**B23** — 上标在加粗内正常
```
Given markdown 内容含 "**x^2^**"
When  useMarkdown.render() 执行
Then  输出 HTML 包含 <strong>x<sup>2</sup></strong>
```

**B24** — 空分隔符降级
```
Given markdown 内容含 "x^^" 或 "H~~O"（空上标/下标）
When  useMarkdown.render() 执行
Then  输出 HTML 包含纯文本 "x^^" 或 "H~~O"（不生成空 <sup>/<sub>）
```

### 跨扩展

**B25** — 多扩展共存无冲突
```
Given markdown 内容同时含 KaTeX 公式、任务列表、脚注、上标下标
When  useMarkdown.render() 执行
Then  四项扩展各自正确渲染，互不干扰
```

**B26** — 现有功能不受影响
```
Given markdown 内容含表格、删除线、代码块、Mermaid 图（现有已支持特性）
When  useMarkdown.render() 执行（注册新插件后）
Then  现有特性渲染结果与注册前一致
```

**B27** — 脚注重复引用渲染正确
```
Given markdown 内容含同一脚注的多次引用（如 "text1[^1] text2[^1]" 和 "[^1]: note"）
When  useMarkdown.render() 执行
Then  脚注引用均正确渲染为上标链接，含冒号的 ID 不导致 JS/CSS 异常
```

**B28** — 链接文本中 $ 不误触发数学模式
```
Given markdown 内容含 "[$100](url)"
When  useMarkdown.render() 执行
Then  $100 作为链接文本渲染，不触发数学模式
```

**B29** — 块级公式溢出可滚动
```
Given markdown 内容含宽度超出容器的块级公式
When  渲染该 entry
Then  公式区域横向可滚动，内容不被截断
```

**B30** — KaTeX 字体加载失败降级
```
Given KaTeX 数学字体加载失败（网络不可达或字体文件缺失）
When  渲染含数学公式的 entry
Then  公式回退到系统字体渲染，文字仍可读
```

## 4. 待确认清单

所有隐含需求方向已明确，无需人工确认。

所有隐含需求方向明确：
- DOMPurify 白名单：实测确认无需扩展（P5 验证）
- KaTeX CSS 加载：首屏前加载完成（P2 决定具体方式）
- 脚注滚动：点击后滚动到目标位置（P2 决定具体方式）
- checkbox 只读：插件已 disabled（无需额外逻辑）

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
P1_simplified: false
```

**阶段裁剪理由**：
- **P1**：✅ 保留 — 四项扩展有隐含依赖需识别（DOMPurify、CSS 加载、SPA 滚动）
- **P2**：✅ 保留 — 不可裁剪。涉及 DOMPurify 配置策略、CSS 加载方式、脚注滚动实现方式等设计决策
- **P3**：✅ 保留（简化）— 纯前端无后端变更，单元测试覆盖解析输出即可，不需要 E2E 测试先行。但插件注册+DOMPurify 交互需测试覆盖
- **P4**：✅ 保留 — 实现阶段
- **P5**：✅ 保留 — 必须验证 DOMPurify 对 KaTeX 完整输出的通过率（P0 风险项）
- **P6**：✅ 保留 — 不可裁剪。涉及 UI 视觉变化（公式渲染、checkbox、脚注、暗色模式），需截图验收
- **P7**：✅ 保留 — 改动跨 ≥3 文件（useMarkdown.ts、MarkdownViewer.vue、package.json、DOMPurify 配置多处），需一致性检查
- **P8**：✅ 保留 — 前端包版本需 bump

## 6. 范围声明

```yaml
packages:
  - frontend-v3
domains:
  - frontend
risk_level: medium
ui_affected: true
```

**risk_level 理由**：中风险 — DOMPurify 交互需验证（虽初步判断无问题），KaTeX CSS 对首屏性能有影响，脚注滚动在 SPA 中需验证。无安全/数据/权限风险。

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 KaTeX 公式渲染、checkbox 外观、脚注滚动、暗色模式适配
    available:
      - "vision-analyst（agate 内置执行角色，首选）"
      - "playwright-cdp skill（已注入，作为补充）"
      - "@vision-helper（可调用，作为补充）"
    status: available

  - need: dom-interaction-testing
    why: 验证脚注锚点点击滚动行为、checkbox 不可交互性
    available:
      - "playwright-cdp skill（CDP 模式，可执行点击+滚动验证）"
    status: available
```

## 范围增补追踪

[SCOPE_RESOLVED] 无范围增补——P1-P4 执行过程中未发现超出基线的隐含需求
