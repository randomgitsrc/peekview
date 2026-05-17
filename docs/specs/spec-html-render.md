# PeekView HTML 网页渲染 技术设计文档

> 版本: 1.2
> 日期: 2026-05-18
> 状态: 评审完成
> 关联: 用户需求 — Agent 生成网页的发布与浏览

---

## 1. 需求背景

### 1.1 当前状态

PeekView 目前支持两种渲染模式：

- `language === 'markdown'` → MarkdownViewer（渲染 Markdown）
- 其他所有文件 → CodeViewer（代码语法高亮）

HTML 文件（`.html`）当前被当作代码处理，只显示源码高亮，不渲染成网页。

### 1.2 目标状态

Agent 生成的 HTML 网页可以通过 `peekview create` 发布，前端像浏览 Markdown 一样，直接渲染网页效果，而不是展示源码。

```
Agent 生成 index.html
       ↓
peekview create index.html
       ↓
浏览器打开 PeekView URL → 看到渲染好的网页
```

### 1.3 典型使用场景

- Agent 生成数据可视化 HTML（ECharts、D3.js 图表）
- Agent 生成报告、简历、演示文稿的单文件 HTML
- Agent 生成交互式 Demo（带内联 JS 的小工具）
- Agent 生成单文件 Web App（Tailwind CDN + Alpine.js 等）

---

## 2. 设计决策

| 问题 | 决策 | 原因 |
|------|------|------|
| 单文件 vs 多文件 | 支持多文件，每个 .html 文件独立渲染 | 与现有 CodeViewer/MarkdownViewer 逻辑一致，按文件 language 决定渲染方式 |
| 渲染方式 | `<iframe srcdoc>` | 浏览器原生能力，天然沙盒隔离，无需后端改动 |
| 是否提供源码视图 | 不提供 | HTML 关注渲染结果，源码用 Download 获取 |
| 布局模式 | 与 Markdown/代码完全一致 | 零额外学习成本，桌面端顶部 header + 内容区，移动端顶部 header + 底部 ActionBar |
| 操作项 | Copy + Download（无 Wrap）| Wrap 对网页无意义，其余与其他文件类型一致 |

---

## 3. 技术方案

### 3.1 渲染分支

在 `EntryDetailView.vue` 中新增第三个渲染分支：

```
language === 'html'     → HtmlViewer（iframe 渲染）
language === 'markdown' → MarkdownViewer
其他                    → CodeViewer
```

### 3.2 HtmlViewer 组件

核心实现：

```html
<iframe
  :srcdoc="content"
  sandbox="allow-scripts allow-forms allow-popups"
  referrerpolicy="no-referrer"
  class="html-frame"
/>
```

**sandbox 属性说明：**

| 权限 | 说明 |
|------|------|
| `allow-scripts` | 允许 JS 执行（图表、交互必须）|
| `allow-forms` | 允许表单提交 |
| `allow-popups` | 允许 window.open（外链跳转）|
| ❌ `allow-same-origin` | **禁止**。`allow-scripts` + `allow-same-origin` 同时开启时，iframe 内 JS 可移除 sandbox 属性，沙盒完全失效（MDN 明确警告）|
| ❌ `allow-top-navigation` | 禁止，防止 iframe 劫持父页面跳转 |

> **安全说明：** 去掉 `allow-same-origin` 后，iframe 运行在 `null origin` 下，无法访问父页面的 DOM、cookie、localStorage，XSS 防护有效。代价是 iframe 内 JS 也无法使用 localStorage/IndexedDB，Agent 生成的展示型网页通常不需要此能力。

**iframe 高度策略：**

撑满内容区剩余高度，内容在 iframe 内自己滚动，不动态调整高度。

**加载状态：**

监听 iframe 的 `load` 事件判断渲染完成，加载期间显示 Loading 占位，与 CodeViewer 的 Shiki 加载态保持一致。

**大文件处理：**

`srcdoc` 将完整 HTML 内容作为属性值注入，文件过大时（尤其内联 base64 图片）会有渲染性能问题。超过 **512KB** 时在内容区顶部显示警告提示，仍正常渲染，不阻断。

### 3.3 布局（与 Markdown 完全对齐）

**桌面端：**

```
┌──────────────────────────────────────────────────────────┐
│ 🏠 标题       @用户 时间  [Copy][Download]  🌙           │  ← header
├──────────┬───────────────────────────────────────────────┤
│ FileTree │  <iframe srcdoc>                              │
│（多文件时）│  （撑满内容区，内部自滚动）                   │
└──────────┴───────────────────────────────────────────────┘
```

**移动端：**

```
┌─────────────────────────────────────┐
│ 🏠 标题                         🌙  │  ← header
├─────────────────────────────────────┤
│  <iframe srcdoc>                    │
│  （撑满，内部滚动）                  │
├─────────────────────────────────────┤
│  [Files] [Copy] [Download]          │  ← 底部 ActionBar
└─────────────────────────────────────┘
```

### 3.4 多文件行为

每个文件按自身 `language` 决定渲染方式，与现有逻辑完全一致：

| 文件 | 渲染方式 |
|------|---------|
| `index.html` | HtmlViewer（iframe）|
| `style.css` | CodeViewer（语法高亮）|
| `main.js` | CodeViewer（语法高亮）|
| `README.md` | MarkdownViewer |

**文件间相对路径限制：**

`<iframe srcdoc>` 无法解析同 entry 内其他文件的相对路径引用（如 `<link href="style.css">`），资源会静默加载失败。

| 场景 | 效果 |
|------|------|
| 内联所有 CSS/JS 的单 HTML | ✅ 完美渲染 |
| 使用 CDN 外链（Tailwind、ECharts 等）| ✅ 完美渲染 |
| 依赖同 entry 内其他文件的相对路径 | ⚠️ 样式/脚本缺失，HTML 结构仍显示 |

### 3.5 操作行为定义

| 操作 | 行为 | 说明 |
|------|------|------|
| Copy | 复制 HTML 源码 | 与 Markdown、代码文件一致，均复制文件原始内容 |
| Download | 下载 HTML 文件 | 与其他文件类型一致 |
| Wrap | **不显示** | 对网页渲染无意义 |

### 3.6 安全风险记录

**已处理：XSS / 沙盒逃逸**

通过去掉 `allow-same-origin` + `null origin` 隔离解决，见 3.2。

**已知风险：iframe 内脚本可发起外部网络请求**

`allow-scripts` 允许 iframe 内 JS 执行 `fetch` / `XMLHttpRequest`，可能将用户数据发到外部服务器。这是 Agent 生成内容的固有风险，与直接打开 HTML 文件无本质区别。本期记录在案，不做额外限制，后续可通过后端 CSP header 收紧。

### 3.7 CLI 侧

`peekview create` 无需改动，已支持任意文件上传。

```bash
# 单文件
peekview create report.html

# 多文件（各文件按自身类型渲染，相对路径引用不通）
peekview create index.html style.css main.js
```

---

## 4. 前端改动范围

| 文件 | 改动 | 规模 |
|------|------|------|
| `src/components/HtmlViewer.vue` | 新建，核心是 `<iframe srcdoc>` + 样式 | 小 |
| `src/views/EntryDetailView.vue` | 新增 `isHtml` 计算属性；渲染分支加 HtmlViewer；header 和 ActionBar 对 HTML 文件隐藏 Wrap 按钮 | 小 |
| `src/stores/entry.ts` | `canWrap` 排除 html 文件 | 极小 |

**后端无需改动。**

---

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| HTML 文件包含外部 CDN 资源 | 正常加载，浏览器直接请求 |
| HTML 文件包含相对路径资源 | 静默失败，文档说明此限制 |
| 多文件 entry 含多个 .html | 每个各自独立渲染，FileTree 切换 |
| 恶意 HTML（XSS）| sandbox `null origin` 隔离，无法访问父页面（见 3.2）|
| HTML 文件 > 512KB | srcdoc 注入，显示性能警告，仍正常渲染 |

---

## 6. 实现计划

### P0 — 问题定义 ✅
- [x] 需求分析
- [x] 技术方案
- [x] 布局设计确认
- [x] 多文件行为确认

### P1 — 测试设计
- [ ] HtmlViewer 单元测试：srcdoc 正确传入
- [ ] E2E：上传 .html 文件 → 详情页显示 iframe 而非代码高亮
- [ ] E2E：多文件 entry，切换 .html 和 .css 文件渲染方式不同
- [ ] E2E：Copy / Download 正常工作
- [ ] E2E：Wrap 按钮对 HTML 文件不显示

### P2 — 代码实现
- [ ] `HtmlViewer.vue`
- [ ] `EntryDetailView.vue` 改动
- [ ] `entry.ts` store 改动

### P3 — 验证
- [ ] 截图：HTML 文件渲染效果（桌面端 + 移动端）
- [ ] 测试：ECharts CDN / Tailwind CDN 外部资源加载

### P4 — 一致性检查
- [ ] CHANGELOG 更新
- [ ] FEATURES.md 更新

---

## 7. 不在本期范围内

- 多文件间相对路径支持（需后端虚拟文件系统 API，后续版本）
- 源码/预览切换视图
- HTML 文件的全文搜索索引

