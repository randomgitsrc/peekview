# PeekView HTML 网页渲染 技术设计文档

> 版本: 1.3
> 日期: 2026-05-18
> 状态: 评审完成（已纳入对抗式评审意见）
> 关联: 用户需求 — Agent 生成网页的发布与浏览
> 评审: 对抗式专家评审 × 1（见 `docs/reviews/spec-html-render-review.md`）

---

## 1. 需求背景

### 1.1 当前状态

PeekView 目前支持两种渲染模式：

- `language === 'markdown'` → MarkdownViewer（渲染 Markdown）
- 其他所有文件 → CodeViewer（代码语法高亮）

HTML 文件（`.html`）当前被当作代码处理，只显示源码高亮，不渲染成网页。

### 1.2 目标状态

Agent 生成的 HTML 文件可以通过 `peekview create` 发布，前端直接渲染网页效果。

```
Agent 生成 index.html
       ↓
peekview create index.html
       ↓
浏览器打开 PeekView URL → 看到渲染好的网页
```

### 1.3 典型使用场景

- Agent 生成数据可视化 HTML（ECharts、D3.js 图表，依赖 CDN）
- Agent 生成报告、简历、演示文稿的单文件 HTML
- Agent 生成交互式 Demo（带内联 JS 的小工具）
- Agent 生成单文件 Web App（Tailwind CDN + Alpine.js 等）

---

## 2. 设计决策

| 问题 | 决策 | 原因 |
|------|------|------|
| 单文件 vs 多文件 | 支持多文件，每个 .html 独立渲染，相对路径引用显示警告 | 与现有渲染逻辑一致；相对路径失败必须提示而非静默 |
| 渲染方式 | Blob URL（`URL.createObjectURL`）| 无属性长度限制，大文件性能更好，浏览器实现一致 |
| 是否提供源码视图 | 不提供 | HTML 关注渲染结果，源码用 Download 获取 |
| 布局模式 | 与 Markdown/代码完全一致 | 零额外学习成本 |
| sandbox 权限 | **仅 `allow-scripts`** | 展示型网页不需要 form/popup；砍掉以防钓鱼放大 |
| 操作项 | Copy HTML source + Download（无 Wrap）| Copy tooltip 明示"HTML source"避免语义混淆 |

---

## 3. 技术方案

### 3.1 渲染分支

```
language === 'html'     → HtmlViewer（Blob URL 渲染）
language === 'markdown' → MarkdownViewer
其他                    → CodeViewer
```

### 3.2 HtmlViewer 渲染实现

**渲染方式：Blob URL（而非 srcdoc）**

```js
const blob = new Blob([content], { type: 'text/html' })
const blobUrl = URL.createObjectURL(blob)
iframe.src = blobUrl

// 组件卸载时释放，防止内存泄漏
onUnmounted(() => URL.revokeObjectURL(blobUrl))
```

选用 Blob URL 而非 `srcdoc` 的原因：
- `srcdoc` 存在浏览器属性长度软限制（Safari 历史上约 64KB，新版不确定）
- Blob URL 无此限制，浏览器可流式解析大文件
- Blob URL 运行在 null origin，**不继承父文档 CSP**（额外安全收益）

**iframe 声明：**

```html
<iframe
  :src="blobUrl"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  scrolling="yes"
  class="html-frame"
/>
```

**sandbox 权限说明：**

| 权限 | 状态 | 理由 |
|------|------|------|
| `allow-scripts` | ✅ 保留 | 图表、交互必须 |
| `allow-same-origin` | ❌ 禁止 | 与 `allow-scripts` 同时存在会导致沙盒逃逸 |
| `allow-forms` | ❌ 禁止 | 展示型网页不需要；保留则 iframe 可构造钓鱼表单并回传凭据 |
| `allow-popups` | ❌ 禁止 | 展示型网页不需要；保留则 `window.open` 可跳转外部钓鱼页 |
| `allow-top-navigation` | ❌ 禁止 | 防止 iframe 劫持父页面跳转 |

> **安全说明：** PeekView 域名下的 URL 具有信任背书（尤其企业内网部署），`allow-forms` + `allow-popups` 会让 iframe 成为可分发的钓鱼跳板。最小权限原则：不需要的权限一律不开。

**sandbox 扩展原则：**

未来如需新增 sandbox 权限，必须经过安全评审，并在本文档记录"为什么需要、可能放大什么风险"，不得静默添加。

**加载状态：**

监听 iframe `load` 事件判断渲染完成，加载期间显示 Loading 占位，与 Shiki 加载态保持一致。

**大文件处理（三段式）：**

| 文件大小 | 行为 |
|---------|------|
| < 512KB | 正常渲染 |
| 512KB ~ 2MB | 显示黄色性能警告条，仍自动渲染 |
| > 2MB | 不自动渲染，显示提示 + 手动"点击渲染"按钮，避免阻塞主线程 |

### 3.3 布局（与 Markdown 完全对齐）

**桌面端：**

```
┌──────────────────────────────────────────────────────────────┐
│ 🏠 标题（entry summary）  @用户 时间  [Copy HTML source][Download]  🌙 │
├──────────┬───────────────────────────────────────────────────┤
│ FileTree │  <iframe Blob URL>                                │
│（多文件时）│  （撑满内容区，内部自滚动）                       │
└──────────┴───────────────────────────────────────────────────┘
```

**移动端：**

```
┌─────────────────────────────────────┐
│ 🏠 标题（entry summary）        🌙  │
├─────────────────────────────────────┤
│  <iframe Blob URL>                  │
│  （撑满，内部滚动）                  │
├─────────────────────────────────────┤
│  [Files] [Copy HTML source] [Download] │
└─────────────────────────────────────┘
```

**iframe 高度：**

使用 `min-height: calc(100dvh - <header高度> - <actionbar高度>)` 而非 `100vh`，避免移动端地址栏收起/展开时的抖动和 iOS Safari scroll chaining 问题。

**标题显示规则：**

Header 显示 entry summary，iframe 内的 `<title>` 不影响外层页面 title（Blob URL null origin 下浏览器通常不会传播 title，P3 验证此项）。

### 3.4 多文件行为

每个文件按自身 `language` 决定渲染方式：

| 文件 | 渲染方式 |
|------|---------|
| `index.html` | HtmlViewer（Blob URL）|
| `style.css` | CodeViewer |
| `main.js` | CodeViewer |
| `README.md` | MarkdownViewer |

**相对路径警告（必须实现，不得静默失败）：**

HtmlViewer 使用 DOMParser 解析 HTML 内容，统计相对路径引用数量（`<link href>` / `<script src>` / `<img src>` 中不以 `http`、`https`、`//`、`data:` 开头的引用）。检测到 N 个时，iframe 上方显示可关闭警告条：

> "此 HTML 含 N 个本地资源引用，PeekView 当前不支持多文件相对路径，这些资源不会加载。"

### 3.5 操作行为定义

| 操作 | 行为 | 说明 |
|------|------|------|
| Copy | 复制 HTML 源码 | tooltip 显示"Copy HTML source"，明示复制的是源码而非渲染文本 |
| Download | 下载 HTML 文件 | 与其他文件类型一致 |
| Wrap | **不显示** | 对网页渲染无意义 |

### 3.6 安全风险记录

| 风险 | 状态 | 处理方式 |
|------|------|---------|
| 沙盒逃逸 / XSS | ✅ 已处理 | 不加 `allow-same-origin`，null origin 隔离 |
| 钓鱼放大 | ✅ 已处理 | 不加 `allow-forms` / `allow-popups`，切断表单回传和弹窗路径 |
| Referer 泄露 | ✅ 已处理 | `referrerpolicy="no-referrer"` |
| iframe 内 fetch 外泄 | ⚠️ 已知，接受 | `allow-scripts` 允许 fetch；后续可通过后端 CSP 收紧 |

---

## 4. 前端改动范围

| 文件 | 改动 | 具体说明 |
|------|------|---------|
| `src/components/HtmlViewer.vue` | 新建 | Blob URL 创建/释放；DOMParser 相对路径检测；iframe + 警告条 + 大文件分级；load 事件 Loading 态 |
| `src/views/EntryDetailView.vue` | 修改 | 新增 `isHtml`；渲染分支加 HtmlViewer；HTML 文件隐藏 Wrap；Copy tooltip 改为"Copy HTML source" |
| `src/stores/entry.ts` | 修改 | `canWrap` 增加 `activeFile.language === 'html'` 排除分支（与 `markdown` 并列）；未来可重构为 `isViewerType` 工具函数，本期不做 |

**后端无需改动。**

---

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| HTML 含 CDN 外链资源 | 正常加载（allow-scripts 可执行，浏览器直接请求 CDN）|
| HTML 含相对路径资源 | DOMParser 检测 → 显示警告条，不静默失败 |
| 多文件 entry 含多个 .html | 每个各自独立渲染，FileTree 切换 |
| HTML 文件 > 2MB | 不自动渲染，手动触发 |
| HTML 文件 512KB~2MB | 黄色警告条 + 自动渲染 |
| 恶意 HTML | null origin + 最小 sandbox 权限，见 §3.6 |
| iframe 内 `<title>` 与 entry summary 冲突 | Header 始终显示 entry summary（P3 验证）|
| iOS Safari 移动端滚动 | `100dvh` + `scrolling="yes"`（P3 验证）|

---

## 6. 实现计划

### P0 — 问题定义 ✅
- [x] 需求分析、技术方案、安全模型
- [x] Blob URL vs srcdoc 选型
- [x] 钓鱼放大风险 → 最小 sandbox 权限
- [x] 相对路径策略（警告条，不静默失败）
- [x] 布局设计（dvh 移动端）
- [x] 大文件三段式策略
- [x] Copy 语义（Copy HTML source）

### P1 — 测试设计
- [ ] Blob URL 正确创建和释放（无内存泄漏）
- [ ] DOMParser 相对路径检测触发警告条
- [ ] > 2MB 文件不自动渲染，手动触发正常
- [ ] Load 事件后 Loading 态消失
- [ ] HTML 文件时 Wrap 按钮不显示
- [ ] Copy tooltip 显示"Copy HTML source"
- [ ] 切换 .html 和 .css 渲染方式正确
- [ ] **安全 negative test**：iframe 内 `top.location` 修改失败
- [ ] **安全 negative test**：iframe 内无法读取父页面 cookie
- [ ] CSP 继承测试：Blob URL iframe 在父文档有 CSP 时的行为

### P2 — 代码实现
- [ ] `HtmlViewer.vue`
- [ ] `EntryDetailView.vue` 改动
- [ ] `entry.ts` store 改动

### P3 — 验证
- [ ] 截图：HTML 渲染效果（桌面端 + 移动端）
- [ ] ECharts CDN / Tailwind CDN 外部资源加载正常
- [ ] iOS Safari + Android Chrome 滚动行为
- [ ] iframe 内 `<title>` 是否污染外层 `document.title`
- [ ] Blob URL iframe 在父文档有 CSP 时的行为

### P4 — 一致性检查
- [ ] CHANGELOG 更新
- [ ] FEATURES.md 更新

---

## 7. 不在本期范围内

- 多文件间相对路径支持（需后端虚拟文件系统 API）
- 源码/预览切换视图
- Copy as text（复制渲染后可见文本）
- HTML 文件的全文搜索索引
- 后端 CSP header 加固（后续优化项）
