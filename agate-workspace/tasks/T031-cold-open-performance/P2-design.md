---
phase: P2
task_id: T031-cold-open-performance
type: design
parent: P1-requirements.md
trace_id: T031-P2-20260722
status: draft
created: 2026-07-22
agent: architect
---

# P2 方案设计 — Explore 列表页性能与交互优化

## 声明字段

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
ui_interaction_points:
  - 卡片/列表项右键菜单（原生链接上下文菜单）
  - 卡片/列表项内 toggle/delete 按钮点击
  - 卡片/列表项内 username 点击导航
  - Explore 列表加载骨架屏（grid + list 双模式）
  - 详情页加载骨架屏
  - 分隔符渲染（亮/暗主题）
  - 搜索框 placeholder
  - 首页 Explore 按钮文案

gate_commands:
  P5: "make test-frontend"
  P5_e2e: "make debug-test"
  P5_typecheck: "make typecheck"

env_constraints:
  debug_env: "make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)"
  seed_data: "make debug-seed (alice/bob/carol, testpass123, 12 entries)"
  isolation_check: "make debug-verify-isolation 或 sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'"

files_to_read:
  - path: frontend-v3/src/components/EntryCard.vue
    why: 卡片组件重构为 <a> 包裹 + 嵌套交互元素处理 + 分隔符修复
  - path: frontend-v3/src/components/EntryListRow.vue
    why: 列表行组件同样重构为 <a> + 分隔符修复
  - path: frontend-v3/src/views/EntryListView.vue:108-110
    why: 加载态 "Loading..." 替换为骨架屏；footer 分隔符；搜索 placeholder
  - path: frontend-v3/src/views/EntryDetailView.vue:132-136
    why: 详情页加载态替换为骨架屏
  - path: frontend-v3/src/views/EntryDetailView.vue:704-708
    why: onMounted 中 loadEntry 调用，并行加载改造入口
  - path: frontend-v3/src/stores/entry.ts:81-105
    why: loadEntry 串行链改造为并行
  - path: frontend-v3/src/api/client.ts:128-156
    why: getEntry/getFileContent API 签名确认
  - path: frontend-v3/src/views/LandingView.vue:45
    why: hero-cta "Explore" 文案修改
  - path: frontend-v3/src/views/LandingView.vue:167
    why: cta-band "Explore" 文案修改
  - path: frontend-v3/src/router.ts:24-28
    why: 详情页路由 props 定义，确认导航参数传递方式
  - path: DESIGN.md:190-201
    why: Card/List Item 样式规范，骨架屏需匹配真实布局尺寸

minimal_validation:
  assumption: "<a> 内嵌套 <button> 时点击 button 会冒泡触发导航；嵌套 <a> 会被 HTML parser 打断"
  method: "Playwright CDP + page.setContent() 构造最小 HTML 测试页，验证 DOM 结构、点击冒泡、右键菜单"
  result: confirmed
  note: |
    1. <a> > <button>：button 留在 <a> 内（DOM 合法），btn1Parent="A"
    2. button 有 stopPropagation+preventDefault：<a> 导航被阻止（navigated=false）
    3. button 无 stopPropagation：点击冒泡触发 <a> 导航（navigated=true）
    4. 嵌套 <a> inside <a>：HTML parser 打断结构，inner <a> 变为 sibling（parent=BODY）——不可行
    5. 右键点击 button 区域：closest('a') 找到 link，浏览器显示链接上下文菜单
```

## §1 候选方案

### 子项 A：并行加载

### 方案 A1（选定）：列表页预传 fileId，详情页 Promise.all 并行请求

列表页 entries 数据已含 files 数组（有 file id）。点击卡片导航时，通过 route query 传递 `firstFileId`。详情页 onMounted 中同时发出 `getEntry(slug)` 和 `getFileContent(slug, firstFileId)`，用 Promise.all 等待两者完成。

- 优点：真正并行（两个网络请求同时发出），减少 ~1 RTT；不改后端 API
- 风险：query 参数污染 URL（用 `router.replace` 清理）；若 entry 无文件则不发 fileContent 请求
- 错误边界：getEntry 失败时丢弃 fileContent 结果（Promise.all 中 getEntry reject 则整体 reject）
- shareToken 兼容：shareToken 仍通过 route query 传递，getEntry 和 getFileContent 都需要（getFileContent 当前不接受 shareToken——需确认 share 场景下 fileContent 是否走不同路径）

### 方案 A2（否决）：仅优化 selectFile 内部，不做真并行

保持 loadEntry 串行结构，只在 selectFile 内部减少不必要的 await。

- 优点：改动最小
- 否决理由：getFileContent 依赖 getEntry 返回的 slug+fileId，当前已是 getEntry 后立即调用 selectFile→getFileContent，无额外等待可优化。不做真并行则 BDD-1 不满足（"两个请求是并发发出的"）

**选择理由**：A1 是唯一能满足 BDD-1"并发发出"要求的方案。列表页已有 files 数据，传递 fileId 成本极低。

### 子项 B：卡片改真 `<a>` 链接

### 方案 B1（选定）：整卡 `<a>` 包裹 + 交互元素用 stopPropagation

将 EntryCard 的 `.card-body` 从 `div[role=button]` 改为 `<a :href="'/' + entry.slug">`。EntryListRow 同理。

嵌套交互元素处理：
- **toggle/delete buttons**：保留在 `<a>` 内部，已有 `@click.stop`，追加 `.prevent` 阻止默认导航
- **username 链接**：HTML 规范禁止 `<a>` 内嵌套 `<a>`（验证确认：parser 会打断结构）。改为 `<span class="meta-username" @click.stop.prevent="navigateToUser">` + `cursor:pointer` + 保留 accent 色样式。语义上用 `role="link"` + `tabindex="0"` + `@keydown.enter` 补偿 a11y
- **键盘可访问性**：`<a>` 原生支持 Enter 导航，移除 `role="button"` / `tabindex="0"` / `@keydown.space`。Space 键不触发导航（符合链接语义）

- 优点：原生右键菜单（新标签页/复制链接）；SEO 友好；语义正确
- 风险：button 区域右键也显示链接菜单（可接受——button 区域小且 hover 才显示）

### 方案 B2（否决）：仅标题 `<a>`，卡片其余保持 div

只在 `.card-title` 外包 `<a>`，卡片整体仍用 `@click` 导航。

- 优点：改动最小，无嵌套冲突
- 否决理由：BDD-2 要求"右键点击卡片/列表项的标题区域"显示链接菜单——仅标题是链接时，点击卡片其他区域仍无链接语义。且用户期望整卡可右键。P0 明确说"card-title（乃至整张卡片）改真 <a> 链接"

**选择理由**：B1 满足 BDD-2（整卡右键菜单）和 BDD-7（嵌套交互元素可用），验证确认 stopPropagation 可阻止冒泡导航。

### 子项 C：分隔符 `·` 修复

### 方案 C1（选定）：CSS `::before` 伪元素 + `content: "·"`

将 `<span class="meta-sep"> · </span>` 替换为 `<span class="meta-sep"></span>`（空 span），CSS 用 `::before { content: "·"; }` 渲染。伪元素 content 使用 CSS 字体栈渲染，不受组件 font-family 影响。

实际上更简单的方案：直接给 `.meta-sep` 设置 `font-family: var(--font-ui)` 覆盖 mono 字体。问题根因是 `.card-meta-text` 设了 `font-family: var(--font-mono)`，而 mono 字体（JetBrains Mono）可能不含 U+00B7 字形导致 fallback 到系统字体渲染为方块。

**最终选定**：给 `.meta-sep` 添加 `font-family: Inter, -apple-system, sans-serif`（UI 字体栈），确保 `·` 使用有该字形的字体渲染。三处统一修改。

- 优点：改动最小（一行 CSS × 3 处），不改变 DOM 结构
- 风险：无

### 方案 C2（否决）：改用 `|` 或 `•` 字符

- 否决理由：改变视觉设计，`·` 是设计意图，问题只是字体 fallback

### 子项 D：搜索框 placeholder

直接修改：`placeholder="搜索标题、标签和文件内容..."` → `placeholder="Search titles, tags & content..."`

### 子项 E：Explore 按钮文案

两处 `Explore` → `Browse public`。更明确表达"浏览公开内容"。

### 子项 F：骨架屏

### 方案 F1（选定）：内联骨架屏组件，匹配真实布局

EntryListView 加载态：
- grid 模式：渲染 6 个 `.skeleton-card`（与 `.entry-card` 同尺寸：radius 14px, padding 24px），内含 title bar + meta bar + tags bar（灰色圆角条，shimmer 动画）
- list 模式：渲染 6 个 `.skeleton-row`（与 `.entry-list-row` 同布局：grid 2col），内含 title bar + meta bar

EntryDetailView 加载态：
- 渲染 header skeleton（title bar + meta bar）+ content skeleton（大面积灰色块）

骨架屏样式：`background: var(--c-border)` + `@keyframes shimmer` 渐变动画。颜色用 `--c-border` / `--c-border-strong` 确保亮暗主题适配。

- 优点：布局形态一致，无跳动；纯 CSS 动画无 JS 开销
- 风险：无

### 方案 F2（否决）：通用 spinner 组件

- 否决理由：BDD-6 明确要求"与真实内容布局形态一致的占位元素（骨架屏），而非纯文本 Loading..."

## §2 影响域分析

### 改什么

| 文件 | 改动 |
|------|------|
| `EntryCard.vue` | card-body div → `<a>`；username router-link → span；meta-sep 字体修复；移除 role/tabindex/keydown |
| `EntryListRow.vue` | 根 div → `<a>`；username router-link → span；meta-sep 字体修复；移除 role/tabindex/keydown |
| `EntryListView.vue` | Loading... → 骨架屏（grid+list）；placeholder 改英文；footer separator 字体修复 |
| `EntryDetailView.vue` | Loading... → 骨架屏；onMounted 并行加载改造 |
| `stores/entry.ts` | 新增 `loadEntryParallel(slug, fileId?, shareToken?)` 方法（或改造 loadEntry 接受可选 fileId） |
| `LandingView.vue` | 两处 "Explore" → "Browse public" |

### 不改什么

- 后端 API（不改契约）
- `api/client.ts`（getEntry/getFileContent 签名不变）
- `router.ts`（路由定义不变，query 参数由组件自行处理）
- EntryDetailView 的 meta-dot（CSS 空 span，不受 `·` 字体问题影响）
- 详情页的 selectFile 逻辑（用户手动切换文件仍走原路径）
- MCP server / CLI

### 风险

| 风险 | 缓解 |
|------|------|
| `<a>` 内 button 右键显示链接菜单 | 可接受——button 区域小且 hover 才显示 |
| username 改为 span 后失去原生链接语义 | 用 role="link" + tabindex + keydown.enter 补偿 |
| 并行加载时 shareToken 传递 | getFileContent 当前不接受 shareToken——需确认 share 场景。若 share 访问的 entry 是私有的，fileContent 请求需要认证。检查：share 场景下 getEntry 带 shareToken，但 getFileContent 不带——当前串行链也是如此（selectFile 内部 getFileContent 不传 shareToken）。所以并行化不改变此行为 |
| 骨架屏 shimmer 动画性能 | 纯 CSS transform 动画，GPU 加速，无 JS 开销 |

## §3 实现完成标志

1. `make typecheck` 通过
2. `make test-frontend` 通过
3. 右键点击卡片标题区域显示原生链接上下文菜单（含"在新标签页中打开"）
4. 点击 toggle/delete 按钮不触发卡片导航
5. 点击 username 导航到用户页，不触发卡片导航
6. 详情页 getEntry 和 getFileContent 并发发出（Network tab 可见两个请求同时 pending）
7. 加载态显示骨架屏（grid/list 双模式 + 详情页）
8. 分隔符在亮暗主题下显示为正常 `·`（无方块）
9. 搜索框 placeholder 为英文
10. 首页两处按钮文案为 "Browse public"

## §4 BDD 覆盖映射

| BDD | 方案覆盖 |
|-----|---------|
| BDD-1 并行加载 | 子项 A：route query 传 fileId + Promise.all |
| BDD-2 原生链接 | 子项 B：整卡 `<a>` |
| BDD-3 分隔符 | 子项 C：meta-sep 字体覆盖 |
| BDD-4 placeholder | 子项 D：改英文 |
| BDD-5 按钮文案 | 子项 E：Browse public |
| BDD-6 骨架屏 | 子项 F：内联骨架屏 |
| BDD-7 嵌套交互 | 子项 B：stopPropagation + username span |
