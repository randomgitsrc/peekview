---
phase: P1
task_id: T046-content-link-resolution
type: problems
parent: P0-brief.md
trace_id: T046-P1-20260704
status: draft
agent: analyst
created: 2026-07-04
---

## 1. 需求复述

用户在 Markdown/HTML 文件中引用本地文件路径（如 `![](images/arch.png)`、`[代码](main.py)`）。发布到 PeekView 后，这些文件以 `File(id, filename, path)` 存储并通过 `/api/v1/entries/{slug}/files/{file_id}/content` 提供访问，但 Markdown/HTML 中的路径引用未被重写，浏览器请求原路径 → 404。

本质：**发布时路径空间映射**——从"本地文件系统"映射到"PeekView 文件服务 URL"。

按影响范围分为 4 级：
- 🔴 P0：Markdown 图片 `![](path)` — 核心场景
- 🟠 P1：Markdown 链接 `[text](path)` — 文件导航
- 🟡 P2：HTML 未覆盖引用（`<a href>`/`<iframe src>`/srcset/inline `url()`）
- ⬜ P3：低频标签（`<object>`/`<embed>`/`<svg><use>`/`<area>`）

## 2. 隐含需求识别

### 2.1 方案质疑：前端重写 vs 后端重写

P0-brief 推荐前端重写，理由是"后端重写复杂度极高"。经分析，**前端重写确实是正确选择**，但理由需补充：

- **后端重写的真实障碍**不是"新增路由"本身，而是需要把 markdown-it + Shiki 语法高亮管线整体搬到 Python 端。Python 生态没有 markdown-it 等价物（python-markdown 对 GFM 扩展、footnote、自定义 fence 的支持差距大），更没有 Shiki。即使做了，渲染质量/一致性也远不如前端。
- 后端 `html_render_service.py` 的 `normalize_ref`/`_sibling_keys`/`_lookup_key` 逻辑可复用，但仅在 **P2 HTML 引用扩展**时复用（扩展 `inject_resources()`），不适用于 Markdown。
- **结论**：前端重写 P0/P1，后端扩展 P2。P0-brief 方向正确。

### 2.2 Raw HTML 块中的路径

Markdown 配置 `html: true`，用户可以在 Markdown 中写 raw HTML（如 `<img src="photo.png">`）。markdown-it 的 `image`/`link_open` renderer rules **不会处理** raw HTML token——这些 token 被当作 `html_inline`/`html_block` 直接输出。

**必须**用 post-DOMPurify DOM walk 处理 raw HTML 中的 `<img src>` 和 `<a href>`。P0-brief 的方案 A+B 组合正确覆盖了这一点。

### 2.3 代码块中的路径不应重写

代码块（fenced code / inline code）中的路径是示例文本，不应重写。markdown-it 的 renderer rules 在 token 级别操作，天然不触及代码块内容——这是方案 A 的优势，确认安全。

### 2.4 Frontmatter 中的路径引用

Frontmatter 中可能有 `image: ./banner.png` 或 `icon: assets/logo.svg` 等 YAML 字段。当前 frontmatter 被解析为 key-value 展示，**不作为 HTML 属性渲染**，因此这些路径不会被浏览器请求。

**结论**：Frontmatter 路径不重写，不影响功能。不列入 BDD。

### 2.5 Markdown 链接重写后的点击行为

Markdown 链接 `[代码](main.py)` 重写为 `/{slug}?file={id}` 后，点击会触发 Vue Router 导航（页面刷新），而非当前页面的文件切换（`entryStore.selectFile`）。

**隐含需求**：重写后的链接点击应触发 `entryStore.selectFile(fileId)`，实现无刷新文件切换，与 FileTree 点击行为一致。

实现方式：在 MarkdownViewer 上拦截 `<a>` 点击事件，判断 `href` 是否为内部文件链接（匹配 pathMap），如果是则 `event.preventDefault()` + 调用 `selectFile`。

### 2.6 DOMPurify 与路径重写的交互

DOMPurify 在 `useMarkdown.ts:308-313` 对每个 HTML block 做 sanitize。重写操作发生在两个时机：
- **方案 A**（markdown-it rules）：在 `md.render()` 产出 HTML 之前，token 级别替换 → DOMPurify 不会删除重写后的属性值（API URL 是合法的）
- **方案 B**（post-DOMPurify DOM walk）：在 DOMPurify sanitize **之后**做 DOM 遍历替换 → 不受 DOMPurify 影响

**结论**：两种方案都不受 DOMPurify 干扰，安全。

### 2.7 路径匹配歧义：同名文件

当 entry 中有多个同名文件（如 `src/utils.py` 和 `test/utils.py`），basename fallback 会匹配到先注册的那个。P0-brief 提到"取第一个匹配 + 控制台 warning"。

**隐含需求**：匹配优先级必须明确——精确 path 匹配 > filename 匹配 > basename fallback。basename 冲突时**不应随机选择**，而应优先匹配与当前 Markdown 文件同目录的文件（相对路径解析）。若无法消歧义，保持原样不重写（比错误重写更安全）。

### 2.8 私有 Entry 的文件访问

私有 entry 的 `/api/v1/entries/{slug}/files/{id}/content` 需要 cookie 认证。重写后的 `<img src="/api/v1/entries/...">` 浏览器请求会自动携带同源 cookie，所以图片/链接重写对私有 entry 同样有效。

**结论**：无需额外处理，认证自动生效。

### 2.9 T045 协调

T045（code-block-rendering-fix）和本任务都改 `useMarkdown.ts`。T045 改行号/zebra 渲染，本任务改路径重写。两者改不同的 renderer rules，不重叠。但需要在 P4 时确认 T045 已合并或协调冲突。

## 3. BDD 验收条件

### 🔴 P0 — Markdown 图片路径重写

**AC-P0-1**: 相对路径图片重写
- Given 创建一个 entry 含文件 `images/arch.png`(id=3) 和 `README.md`，Markdown 内容为 `![架构](images/arch.png)`
- When 在 PeekView 查看 `README.md`
- Then `<img>` 的 `src` 被重写为 `/api/v1/entries/{slug}/files/3/content`

**AC-P0-2**: 同目录文件名匹配
- Given 创建一个 entry 含文件 `photo.png`(id=5) 和 `README.md`（同目录），Markdown 内容为 `![照片](photo.png)`
- When 在 PeekView 查看
- Then `<img>` 的 `src` 被重写为 `/api/v1/entries/{slug}/files/5/content`

**AC-P0-3**: 绝对路径 basename fallback
- Given 创建一个 entry 含文件 `screenshot.png`(id=7)（path=`/tmp/screenshot.png`），Markdown 内容为 `![截图](/tmp/screenshot.png)`
- When 在 PeekView 查看
- Then `<img>` 的 `src` 被重写为 `/api/v1/entries/{slug}/files/7/content`

**AC-P0-4**: 外部 URL 不重写
- Given Markdown 内容为 `![CDN](https://cdn.example.com/img.png)`
- When 渲染
- Then `<img>` 的 `src` 保持 `https://cdn.example.com/img.png` 不变

**AC-P0-5**: 无匹配文件时保持原样
- Given Markdown 内容为 `![不存在](missing.png)`，entry 中无此文件
- When 渲染
- Then `<img>` 的 `src` 保持 `missing.png` 不变

**AC-P0-6**: Raw HTML 中的图片路径重写
- Given 创建一个 entry 含文件 `photo.png`(id=5)，Markdown 内容为 `<img src="photo.png" alt="照片">`
- When 渲染
- Then `<img>` 的 `src` 被重写为 `/api/v1/entries/{slug}/files/5/content`

**AC-P0-7**: 代码块中的路径不重写
- Given Markdown 内容为 `` ```python\n# See ![](image.png)\n``` ``
- When 渲染
- Then 代码块中的 `![](image.png)` 保持原样

### 🟠 P1 — Markdown 链接路径重写

**AC-P1-1**: 链接到同 entry 内文件
- Given 创建一个 entry 含文件 `main.py`(id=10) 和 `README.md`，Markdown 内容为 `[代码](main.py)`
- When 在 PeekView 查看
- Then `<a>` 的 `href` 被重写为 `/{slug}?file=10`（或等效的内部文件切换链接）

**AC-P1-2**: 点击重写链接触发文件切换
- Given `<a href="/{slug}?file=10">` 在 MarkdownViewer 中渲染
- When 用户点击该链接
- Then 当前页面切换到 `main.py` 文件查看（无页面刷新，调用 `entryStore.selectFile`）

**AC-P1-3**: 外部链接不重写
- Given Markdown 内容为 `[Google](https://google.com)`
- When 渲染
- Then `<a>` 的 `href` 保持 `https://google.com` 不变

**AC-P1-4**: 锚点链接不重写
- Given Markdown 内容为 `[章节](#intro)`
- When 渲染
- Then `<a>` 的 `href` 保持 `#intro` 不变

**AC-P1-5**: 链接到 Markdown 文件（文件切换）
- Given 创建一个 entry 含文件 `GUIDE.md`(id=20) 和 `README.md`，Markdown 内容为 `[指南](GUIDE.md)`
- When 点击重写后的链接
- Then 切换到 `GUIDE.md` 文件查看

**AC-P1-6**: Raw HTML 中的链接路径重写
- Given 创建一个 entry 含文件 `page.html`(id=15)，Markdown 内容为 `<a href="page.html">页面</a>`
- When 渲染
- Then `<a>` 的 `href` 被重写为内部文件切换链接

### 🟡 P2 — HTML 未覆盖引用

**AC-P2-1**: HTML `<a href>` 内部链接重写
- Given HTML entry 含 `<a href="readme.md">`，entry 中有 `readme.md`(id=30)
- When 通过 render 路由查看
- Then `<a>` 的 `href` 被重写为 `/api/v1/entries/{slug}/files/30/content`

**AC-P2-2**: HTML `<iframe src>` 重写
- Given HTML entry 含 `<iframe src="inner.html">`，entry 中有 `inner.html`(id=31)
- When 通过 render 路由查看
- Then `<iframe>` 的 `src` 被重写为 `/api/v1/entries/{slug}/files/31/render`

### ⬜ P3 — 低频标签（本迭代不实现）

P3 级别不在本次任务范围内，不设 BDD 条件。

## 4. 待确认清单

（无未决 `[NEED_CONFIRM]`）

以下问题已有明确判断，不需要人确认：
- 方向选择：前端重写（P0-brief 已推荐，分析确认正确）
- Frontmatter 路径：不重写（非渲染内容）
- 代码块路径：不重写（markdown-it token 级天然安全）
- 私有 entry 认证：同源 cookie 自动携带，无需额外处理

## 5. 裁剪说明

risk_level: medium

phases: [P1, P2, P3, P4, P5, P6, P8]

- **跳过 P7（一致性检查）**：理由——改动集中在前端 `useMarkdown.ts` + `MarkdownViewer.vue` + `EntryDetailView.vue` + 新建 `path-map.ts`，后端仅 P2 时改 `html_render_service.py`。文件间一致性风险低（pathMap 是独立工具函数，各消费方通过 props 传递）。P2 设计阶段已覆盖接口约定。跳过风险: 低——若 P4 实现时 pathMap 接口在 `useMarkdown.ts` / `MarkdownViewer.vue` / `EntryDetailView.vue` 之间不一致，P5 测试和 P6 验收会捕获。
- **保留 P3（TDD）**：理由——P0-brief 标注"保守"，涉及 Markdown 渲染管线核心路径。pathMap 构建/路径归一化/匹配优先级逻辑有边界情况（同名文件、绝对路径、`./` 前缀），需要测试覆盖。
- **保留 P6（验收）**：理由——UI 交互（图片渲染 + 链接点击文件切换）必须实跑验证，BDD 条件涉及浏览器行为。
- **P8 保留**：前端改动涉及用户可见功能，需 CHANGELOG 记录。

### 跳过风险评估

（已内联至每条裁剪声明的"跳过风险:"字段）

## 6. 范围声明

packages: [peekview]

domains: [frontend, backend]

注：P0/P1 仅前端，P2 涉及后端 `html_render_service.py` 扩展。MCP 不受影响。

## 7. 能力需求声明

capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证图片重写渲染和链接点击文件切换
    available:
      - playwright-vision skill（已注入）
      - vision-analyst（agate 内置执行角色）
    status: available

  - need: playwright-cdp
    why: P6 验收需 Playwright 模拟链接点击，验证文件切换行为
    available:
      - playwright-cdp skill（已注入）
      - Chrome CDP :18800
    status: available

  - need: frontend-dev
    why: 需要修改 Vue 组件和 TypeScript composable
    available:
      - 本地开发环境（make debug / vitest / vue-tsc）
    status: available

## SCOPE+ 增补区（后续阶段回写）
