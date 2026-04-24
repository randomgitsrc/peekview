# Peek UI 设计规范 v1.0

> 设计原则：简洁、专业、开发者优先、跨端一致

---

## 1. 设计语言系统 (Design System)

### 1.1 色彩方案

**主色调**
```
Primary (Accent):    #3B82F6 (蓝)  - 按钮、链接、高亮
Primary Hover:       #2563EB (深蓝)
Primary Light:       #EFF6FF (浅蓝背景)

Success:             #10B981 (绿)  - 成功状态
Warning:             #F59E0B (橙)  - 警告
Error:               #EF4444 (红)  - 错误
```

**中性色 (Dark Theme - 默认)**
```
BG Primary:          #0D1117 (GitHub Dark 背景)
BG Secondary:        #161B22 (卡片、侧边栏)
BG Tertiary:         #21262D (悬停、输入框)
Border:              #30363D (分割线)

Text Primary:        #E6EDF3 (主文字)
Text Secondary:      #8B949E (次要文字)
Text Tertiary:       #6E7681 (辅助文字)
```

**中性色 (Light Theme)**
```
BG Primary:          #FFFFFF
BG Secondary:        #F6F8FA (GitHub Light 背景)
BG Tertiary:         #F3F4F6
Border:              #D0D7DE

Text Primary:        #1F2328
Text Secondary:      #656D76
Text Tertiary:       #8C959F
```

### 1.2 字体系统

```
Font Family:         -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
Monospace:           "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace

Font Sizes:
  xs:  12px  (标签、辅助文字)
  sm:  14px  (正文、菜单)
  md:  16px  (标题 H3)
  lg:  20px  (标题 H2)
  xl:  24px  (标题 H1)

Line Height:         1.5 (正文), 1.4 (代码)
```

### 1.3 间距系统

```
Space Unit:          4px
  1:  4px
  2:  8px
  3:  12px
  4:  16px
  5:  20px
  6:  24px
  8:  32px
```

### 1.4 圆角与阴影

```
Radius:
  sm:   4px  (按钮、标签)
  md:   6px  (输入框、卡片)
  lg:   8px  (面板、弹窗)
  full: 9999px (胶囊按钮)

Shadows (Dark):
  sm:   0 1px 2px rgba(0,0,0,0.3)
  md:   0 4px 6px rgba(0,0,0,0.4)
  lg:   0 10px 15px rgba(0,0,0,0.5)
```

### 1.5 图标系统

- 使用 **VS Code Codicons** 或 **Phosphor Icons**
- 所有功能按钮必须带图标 + Tooltip
- 图标尺寸：16px (按钮内), 20px (独立按钮)

---

## 2. 组件规范

### 2.1 按钮组件

**Primary Button**
- 背景: Primary 色
- 文字: 白色
- 圆角: md (6px)
- 高度: 32px (small), 40px (default)
- 内边距: 0 12px

**Secondary Button (Ghost)**
- 背景: 透明
- 边框: 1px solid Border
- 悬停: BG Tertiary

**Icon Button**
- 尺寸: 32px × 32px
- 圆角: md
- 悬停: BG Tertiary

### 2.2 输入框

- 高度: 32px
- 背景: BG Tertiary
- 边框: 1px solid Border
- 聚焦: 边框变 Primary 色，添加光晕

### 2.3 侧边栏

- 宽度: 240px (文件树), 200px (TOC)
- 背景: BG Secondary
- 边框: 1px solid Border (右侧)

### 2.4 工具栏

- 高度: 48px
- 背景: BG Secondary
- 边框: 1px solid Border (底部)
- 内容：面包屑 + 操作按钮组

---

## 3. 页面布局

### 3.1 桌面端布局 (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Header (56px)                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [←]  Logo/Back    Entry Title                    [Search] [⚙️] [☀️] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Main Toolbar (48px)                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 📁 src/utils  ▾  │  📋 Copy │ ⬇️ Download │ 🔗 Share │ ⚙️ Wrap  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Content Area                                                           │
│  ┌─────────────┬────────────────────────────────────┬────────────────┐ │
│  │             │                                    │                │ │
│  │  File Tree  │         Code / Markdown            │     TOC        │ │
│  │  (240px)    │         Viewer                     │    (200px)     │ │
│  │             │                                    │                │ │
│  │  📁 src     │                                    │  ## Install    │ │
│  │   📄 main   │     ┌──────────────────────┐      │  ## Usage      │ │
│  │   📄 util   │     │                      │      │  ### API       │ │
│  │  📄 README  │     │   Content Area       │      │  ### Config    │ │
│  │             │     │                      │      │                │ │
│  │             │     └──────────────────────┘      │                │ │
│  └─────────────┴────────────────────────────────────┴────────────────┘ │
│                                                                         │
│  Footer (Optional)                                                      │
│  └─ Tags: #python #cli                          Created: 2024-01-15    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**布局规则：**
- Header: 固定顶部，包含导航和全局操作
- Main Toolbar: 面包屑导航 + 文件操作按钮组
- 内容区: 三栏网格布局 `grid-template-columns: 240px 1fr 200px`
- 文件树和 TOC 可折叠（记住用户偏好）

### 3.2 桌面端布局 (768px - 1023px)

```
┌─────────────────────────────────────────┐
│ Header                                  │
├─────────────────────────────────────────┤
│ Toolbar                                 │
│ [📁 src/utils ▾] [Copy] [Download]    │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┬───────────────────────┐  │
│  │ File     │                       │  │
│  │ Tree     │    Content Area       │  │
│  │ (200px)  │                       │  │
│  │          │                       │  │
│  └──────────┴───────────────────────┘  │
│                                         │
│  (TOC 显示在内容顶部，可折叠)            │
│  ┌───────────────────────────────────┐ │
│  │ ▾ Outline                         │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

- 三栏 → 两栏（隐藏 TOC 侧边栏，改为内容区顶部可折叠面板）

### 3.3 移动端布局 (< 768px)

```
┌─────────────────────────────┐
│ Header                      │
│ [←] Title              [☀️] │
├─────────────────────────────┤
│                             │
│      Content Area           │
│      (Full Width)           │
│                             │
├─────────────────────────────┤
│ Bottom Bar (56px)           │
│ ┌─────────────────────────┐ │
│ │ ☰ 3 files │ ↩ 📋 ⬇️ ☰ │ │  ← 多文件场景
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ routes.py │ ↩ 📋 ⬇️ ☰  │ │  ← 单文件场景
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ routes.py │ 📋 ⬇️      │ │  ← 代码文件（无TOC）
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**移动端底部栏 v3 设计规范：**

| 场景 | 左侧区域 | 右侧按钮 |
|------|----------|----------|
| **多文件条目** | ☰ 汉堡按钮 + "N files" 徽章 | Wrap, Copy, Download, TOC |
| **单文件代码** | 📄 文件名（无汉堡） | Wrap, Copy, Download |
| **Markdown有TOC** | 📄 文件名 | Copy, Download, TOC |

**按钮行为：**
- **Wrap (↩)**：切换代码自动换行（代码文件显示，Markdown隐藏）
- **Copy (📋)**：复制当前文件内容（不含行号）
- **Download (⬇️)**：下载当前文件
- **TOC (☰)**：打开大纲抽屉（仅 Markdown 有标题时显示）
- **汉堡按钮**：打开文件列表抽屉（多文件时显示）

**抽屉交互：**
- 点击汉堡按钮 → 文件树抽屉
- 点击文件名区域 → 文件树抽屉（单文件时也可打开查看更多文件）
- 点击 TOC 按钮 → 大纲抽屉
- 点击遮罩层或 ✕ → 关闭抽屉

**文件树抽屉：**
```
┌─────────────────────────────┐
│ Files                [✕]    │
├─────────────────────────────┤
│ 📁 src                      │
│   📄 main.py               │
│   📄 util.py               │
│ 📄 README.md               │
│                             │
└─────────────────────────────┘
```

**TOC 抽屉：**
```
┌─────────────────────────────┐
│ Outline              [✕]    │
├─────────────────────────────┤
│ ## Introduction             │
│ ## Installation             │
│ ## Usage                    │
│   ### Basic               │
│   ### Advanced            │
│ ## API                      │
│                             │
└─────────────────────────────┘
```

---

## 4. 功能清单

### 4.1 全局功能

| 功能 | 桌面端 | 移动端 | 说明 |
|------|--------|--------|------|
| 主题切换 | ☀️ 按钮 | ☀️ 按钮 | Dark/Light/Auto |
| 搜索 | 顶部搜索框 | 抽屉内搜索 | 条目搜索 |
| 设置 | ⚙️ 按钮 | ⚙️ 按钮 | 偏好设置抽屉 |

### 4.2 文件操作

| 功能 | 桌面端 | 移动端 | 触发方式 |
|------|--------|--------|----------|
| 复制当前文件 | Toolbar 按钮 | 底部栏按钮 | Ctrl+C / 点击 |
| 下载当前文件 | Toolbar 按钮 | 底部栏按钮 | - |
| 下载全部 (ZIP) | Toolbar 下拉菜单 | 抽屉菜单 | - |
| 文件切换 | 左侧树 | 抽屉树 | 点击 |
| 行号跳转 | URL Hash | URL Hash | #L10-L20 |

### 4.3 代码查看器功能

| 功能 | 桌面端 | 移动端 |
|------|--------|--------|
| 语法高亮 | ✓ | ✓ |
| 行号显示 | ✓ | ✓ (可开关) |
| 自动换行 | ✓ Toolbar切换 | ✓ **底部栏按钮** |
| 代码复制 | ✓ 按钮（仅代码，不含行号） | ✓ **底部栏按钮** |
| 字体缩放 | Ctrl +/- | 双指缩放 |
| 行高亮 | URL Hash | URL Hash |

**底部栏按钮优先级（移动端）：**
1. **代码文件**：Wrap, Copy, Download
2. **Markdown**：Copy, Download, TOC（无 Wrap）
3. **多文件条目**：额外显示汉堡按钮 + 文件计数

### 4.4 Markdown 功能

| 功能 | 桌面端 | 移动端 | 说明 |
|------|--------|--------|------|
| TOC 导航 | 右侧边栏 | 抽屉 | - |
| 锚点跳转 | ✓ | ✓ | - |
| 代码块复制 | ✓ 悬浮按钮 | ✓ 按钮 | 仅复制代码，不含行号 |
| 表格横向滚动 | ✓ | ✓ | 正文换行，表格/代码块不换行 |
| 图片自适应 | ✓ | ✓ | max-width: 100% |
| 正文自动换行 | ✓ | ✓ | 长文本自动折行 |
| Mermaid 图表 | P2 | P2 | - |

**正文换行规则：**
- 普通段落文本：自动换行 (`overflow-wrap: break-word`)
- 代码块：横向滚动 (`overflow-x: auto`, `white-space: pre`)
- 表格：横向滚动 (`overflow-x: auto`)
- 行内代码：不断行 (`white-space: nowrap`)

---

## 5. 交互设计

### 5.1 悬停状态

- 按钮: 背景色变深 + 轻微上移
- 链接: 下划线 + 颜色变 Primary
- 文件树项: 背景 BG Tertiary
- 代码行: 背景高亮

### 5.2 点击反馈

- 按钮: 缩放 0.95 + 背景色变深
- 列表项: 背景闪烁
- 链接: 颜色变化

### 5.3 加载状态

- 骨架屏: 脉冲动画
- 按钮加载: Spinner + 禁用
- 内容加载: 渐进显示

### 5.4 过渡动画

```css
/* 标准过渡 */
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;

/* 抽屉动画 */
drawer-enter: translateX(100%) → translateX(0), 200ms
overlay-enter: opacity 0 → 1, 200ms
```

### 5.5 Toast 通知

- 位置: 桌面右上角，移动底部居中
- 时长: 3 秒自动消失
- 类型: Success (绿), Error (红), Info (蓝)

---

## 6. 响应式断点

```css
/* Mobile First */
sm: 640px   /* 大手机 */
md: 768px   /* 平板竖屏 */
lg: 1024px  /* 平板横屏/小桌面 */
xl: 1280px  /* 标准桌面 */
2xl: 1536px /* 大桌面 */
```

**布局变化：**
- < 768px: 单栏，抽屉导航
- 768px - 1023px: 两栏，TOC 顶部折叠
- ≥ 1024px: 三栏，完整功能

---

## 7. 无障碍设计

- 所有交互元素可通过键盘访问 (Tab, Enter, Space)
- 足够的颜色对比度 (WCAG AA)
- ARIA 标签完整
- 支持 `prefers-reduced-motion`
- 支持屏幕阅读器

---

## 8. 原型界面

### 8.1 桌面端原型

```html
<!-- 简化版 HTML 结构原型 -->
<div class="app dark">
  <!-- Header -->
  <header class="h-14 border-b flex items-center px-4">
    <button class="mr-4">←</button>
    <h1 class="flex-1 truncate">Project Documentation</h1>
    <button>🔍</button>
    <button>☀️</button>
  </header>

  <!-- Toolbar -->
  <div class="h-12 border-b flex items-center px-4 gap-2">
    <div class="breadcrumb flex-1">📁 src / utils / helper.py</div>
    <button class="px-3 py-1.5 bg-blue-600 rounded">📋 Copy</button>
    <button class="px-3 py-1.5 border rounded">⬇️ Download</button>
    <button class="px-3 py-1.5 border rounded">🔗 Share</button>
  </div>

  <!-- Main Content -->
  <div class="flex h-[calc(100vh-104px)]">
    <!-- Left: File Tree -->
    <aside class="w-60 border-r overflow-auto p-2">
      <div class="tree">
        <div class="folder">📁 src</div>
        <div class="file active pl-4">📄 main.py</div>
        <div class="file pl-4">📄 utils.py</div>
      </div>
    </aside>

    <!-- Center: Content -->
    <main class="flex-1 overflow-auto p-4">
      <pre class="code-block"><code>def hello():</code></pre>
    </main>

    <!-- Right: TOC -->
    <aside class="w-52 border-l overflow-auto p-3 bg-secondary">
      <h4 class="text-xs uppercase mb-2">Outline</h4>
      <nav class="text-sm">
        <a href="#install" class="block py-1">Install</a>
        <a href="#usage" class="block py-1 pl-3">Usage</a>
      </nav>
    </aside>
  </div>
</div>
```

### 8.2 移动端原型

```html
<div class="app dark mobile">
  <!-- Header -->
  <header class="h-14 border-b flex items-center px-4">
    <button>←</button>
    <h1 class="flex-1 truncate text-center">Entry Title</h1>
    <button>☀️</button>
  </header>

  <!-- Content (Full Width) -->
  <main class="p-4 pb-20">
    <pre class="code-block">...</pre>
  </main>

  <!-- Bottom Bar -->
  <div class="fixed bottom-0 left-0 right-0 h-14 border-t flex items-center px-4 gap-2 bg-primary">
    <button class="flex-1 flex items-center gap-2 truncate">
      📁 src/utils/helper.py
      <span>▼</span>
    </button>
    <div class="flex gap-1">
      <button class="w-10 h-10 flex items-center justify-center">📋</button>
      <button class="w-10 h-10 flex items-center justify-center">⬇️</button>
      <button class="w-10 h-10 flex items-center justify-center">☰</button>
    </div>
  </div>

  <!-- Drawer (Hidden by default) -->
  <div class="drawer-overlay">
    <div class="drawer">
      <div class="drawer-header">
        <h3>Files</h3>
        <button>✕</button>
      </div>
      <div class="drawer-content">
        <!-- File Tree -->
      </div>
    </div>
  </div>
</div>
```

---

## 9. 文件结构

```
frontend/src/
├── styles/
│   ├── variables.css      # CSS 变量 (颜色、间距)
│   ├── dark.css           # 暗色主题
│   ├── light.css          # 亮色主题
│   └── components.css     # 组件基础样式
├── components/
│   ├── ui/                # 基础 UI 组件
│   │   ├── Button.vue
│   │   ├── IconButton.vue
│   │   ├── Input.vue
│   │   ├── Tooltip.vue
│   │   └── Toast.vue
│   ├── layout/            # 布局组件
│   │   ├── Header.vue
│   │   ├── Toolbar.vue
│   │   ├── Sidebar.vue
│   │   └── BottomBar.vue
│   ├── file/              # 文件相关
│   │   ├── FileTree.vue
│   │   ├── FileTreeItem.vue
│   │   ├── FileDrawer.vue
│   │   └── FileBreadcrumb.vue
│   ├── code/              # 代码展示
│   │   ├── CodeViewer.vue
│   │   ├── LineNumbers.vue
│   │   └── CopyButton.vue
│   ├── markdown/          # Markdown
│   │   ├── MarkdownViewer.vue
│   │   ├── TocSidebar.vue
│   │   ├── TocDrawer.vue
│   │   └── CodeBlock.vue
│   └── mobile/            # 移动端特有
│       ├── MobileHeader.vue
│       ├── MobileBottomBar.vue
│       └── MobileDrawer.vue
├── composables/
│   ├── useTheme.ts
│   ├── useShiki.ts
│   ├── useEntry.ts
│   ├── useToast.ts
│   └── useClipboard.ts
├── views/
│   ├── EntryListView.vue
│   └── EntryDetailView.vue
└── App.vue
```

---

## 10. 实现优先级

### Phase 1: 基础框架
- [ ] CSS 变量系统
- [ ] 主题切换
- [ ] 基础布局组件

### Phase 2: 核心功能
- [ ] 文件树组件
- [ ] 代码高亮
- [ ] Markdown 渲染

### Phase 3: 工具栏
- [ ] 复制/下载功能
- [ ] TOC 导航
- [ ] 响应式适配

### Phase 4: 移动端
- [ ] 抽屉组件
- [ ] 底部栏
- [ ] 触摸优化

### Phase 5:  polish
- [ ] 动画优化
- [ ] 无障碍
- [ ] 性能优化

---

*设计规范 v1.0 - 2024-04-21*
