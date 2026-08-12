---
phase: P3
task_id: T059
type: test-cases
parent: P2-design.md
trace_id: T059-P3-20260720
status: draft
created: 2026-07-20
agent: test-designer
test_code_dir: frontend-v3/src/composables/__tests__
---

# P3 Test Cases: Markdown 扩展补全（KaTeX + Task List + Footnote + Sub/Sup）

## 测试策略

- **纯前端单元测试**（P3 简化），使用 vitest + jsdom 环境
- 直接调用 `useMarkdown().render()` 检查 HTML 输出
- DOMPurify 交互单独验证
- CSS/视觉/交互行为（暗色模式、滚动、字体降级）由 P6 E2E 覆盖

## 测试文件

| 文件 | 覆盖范围 |
|------|----------|
| `useMarkdown.extensions.spec.ts` | 核心扩展渲染（B01-B03, B07-B11, B15-B16, B21-B23, B25-B27, B29） |
| `useMarkdown.extensions.boundary.spec.ts` | 边界/降级用例（B04, B05, B09, B13, B17, B24, B28, B30） |
| `useMarkdown.extensions.dompurify.spec.ts` | DOMPurify 交互（B06, B12, B26） |

## 测试用例清单

### E1: KaTeX 数学公式

| TC# | BDD | 测试描述 | 断言 |
|-----|-----|----------|------|
| TC01 | B01 | 行内公式 `$e^{i\pi}$` 渲染 | HTML 含 `<span class="katex">`，不含字面 `$e^{i\pi}$` |
| TC02 | B02 | 块级公式 `$$\frac{a}{b}$$` 渲染 | HTML 含 `<span class="katex-display">` 或 `.katex-block` |
| TC03 | B03 | 货币符号 `$100` 不触发数学 | HTML 不含 `<span class="katex">`，含字面 `100` |
| TC04 | B04 | 未闭合 `$x^2 unclosed` 降级 | HTML 不含 `<span class="katex">`，含字面文本 |
| TC05 | B05 | 未识别命令 `\undefinedcmd` 可见 | HTML 含红色标记（`mathcolor="#cc0000"` 或 `color` 样式含红色） |
| TC06 | B06 | DOMPurify 不破坏 KaTeX 输出 | sanitize 后 `<span class="katex">` 保留，`class="katex-*"` 保留 |
| TC07 | B07 | KaTeX CSS class 存在 | 渲染输出含 `class="katex"`（间接验证 CSS 可应用） |
| TC08 | B08 | 暗色模式 class 可覆盖 | HTML 含 `class="katex"`（CSS 暗色覆盖依赖 `[data-theme='dark'] .katex`，P6 截图验证） |
| TC09 | B09 | 行内代码中 `$var` 不触发数学 | HTML 含 `<code>$var</code>`，不含 `<span class="katex">` |

### E2: 任务列表

| TC# | BDD | 测试描述 | 断言 |
|-----|-----|----------|------|
| TC10 | B10 | 已完成 `- [x] done` 渲染 | HTML 含 `<input type="checkbox" checked disabled>` |
| TC11 | B11 | 未完成 `- [ ] todo` 渲染 | HTML 含 `<input type="checkbox" disabled>`，无 `checked` 属性 |
| TC12 | B12 | DOMPurify 不剥离 checkbox | sanitize 后 `<input type="checkbox">` 保留，`checked`/`disabled` 保留 |
| TC13 | B13 | checkbox 带 disabled 属性 | HTML 含 `disabled`（不可交互性由 HTML 属性保证，P6 E2E 验证点击行为） |
| TC14 | B14 | 暗色模式 checkbox class | HTML 含 `class="task-list-item-checkbox"`（P6 截图验证视觉） |

### E3: 脚注

| TC# | BDD | 测试描述 | 断言 |
|-----|-----|----------|------|
| TC15 | B15 | 脚注引用渲染为上标链接 | HTML 含 `<sup class="footnote-ref">` + `<a href="#fn1">` |
| TC16 | B16 | 脚注回引链接 | HTML 含 `class="footnote-backref"` + `href="#fnref1"` |
| TC17 | B17 | 未定义脚注降级 | 无脚注定义时，HTML 含纯文本 `[^1]`，不含 `footnote-ref` |
| TC18 | B18 | 脚注锚点 href 指向正确 | HTML 含 `href="#fn1"`（滚动行为依赖 scrollIntoView 拦截，P6 E2E 验证） |
| TC19 | B19 | 回引链接 href 指向正确 | HTML 含 `href="#fnref1"` + `class="footnote-backref"`（P6 E2E 验证滚动） |
| TC20 | B20 | 暗色模式脚注 class | HTML 含 `class="footnotes"` + `class="footnotes-sep"`（P6 截图验证） |

### E4: 上标/下标

| TC# | BDD | 测试描述 | 断言 |
|-----|-----|----------|------|
| TC21 | B21 | 上标 `x^2^` 渲染 | HTML 含 `x<sup>2</sup>` |
| TC22 | B22 | 下标 `H~2~O` 渲染 | HTML 含 `H<sub>2</sub>O` |
| TC23 | B23 | 上标在加粗内 `**x^2^**` | HTML 含 `<strong>x<sup>2</sup></strong>` |
| TC24 | B24 | 空分隔符 `x^^` 降级 | HTML 含纯文本 `x^^`，不含空 `<sup></sup>` |

### 跨扩展

| TC# | BDD | 测试描述 | 断言 |
|-----|-----|----------|------|
| TC25 | B25 | 多扩展共存 | 同一 markdown 含 4 扩展，各自渲染正确 |
| TC26 | B26 | 现有功能不受影响 | 表格/删除线/代码块渲染结果与注册前一致 |
| TC27 | B27 | 脚注重复引用 | `[^1]` 多次引用，ID 含冒号 `fnref1:1`，HTML 不含异常 |
| TC28 | B28 | 链接文本中 `$100` 不触发数学 | `[$100](url)` 渲染为链接，不含 `<span class="katex">` |
| TC29 | B29 | 块级公式溢出结构 | HTML 含 `.katex-block` 或 `.katex-display`（CSS overflow-x: auto 由 P6 验证） |
| TC30 | B30 | KaTeX 字体降级 | 渲染输出含 `<span class="katex">`（字体降级是浏览器行为，P6 E2E 验证） |

## BDD 覆盖矩阵

| BDD | TC# | 单元测试可完全验证 | 需 P6 补充 |
|-----|-----|-------------------|------------|
| B01 | TC01 | ✅ | - |
| B02 | TC02 | ✅ | - |
| B03 | TC03 | ✅ | - |
| B04 | TC04 | ✅ | - |
| B05 | TC05 | ✅ | - |
| B06 | TC06 | ✅ | - |
| B07 | TC07 | ✅ (间接) | 截图验证 CSS 加载 |
| B08 | TC08 | ✅ (间接) | 截图验证暗色模式 |
| B09 | TC09 | ✅ | - |
| B10 | TC10 | ✅ | - |
| B11 | TC11 | ✅ | - |
| B12 | TC12 | ✅ | - |
| B13 | TC13 | ✅ (HTML 属性) | E2E 验证点击不翻转 |
| B14 | TC14 | ✅ (间接) | 截图验证暗色模式 |
| B15 | TC15 | ✅ | - |
| B16 | TC16 | ✅ | - |
| B17 | TC17 | ✅ | - |
| B18 | TC18 | ✅ (href 存在) | E2E 验证滚动 |
| B19 | TC19 | ✅ (href 存在) | E2E 验证滚动 |
| B20 | TC20 | ✅ (间接) | 截图验证暗色模式 |
| B21 | TC21 | ✅ | - |
| B22 | TC22 | ✅ | - |
| B23 | TC23 | ✅ | - |
| B24 | TC24 | ✅ | - |
| B25 | TC25 | ✅ | - |
| B26 | TC26 | ✅ | - |
| B27 | TC27 | ✅ | - |
| B28 | TC28 | ✅ | - |
| B29 | TC29 | ✅ (结构) | E2E 验证溢出滚动 |
| B30 | TC30 | ✅ (间接) | E2E 验证字体降级 |
