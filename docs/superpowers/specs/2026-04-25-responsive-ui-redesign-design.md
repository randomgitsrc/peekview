# PeekView 响应式 UI 重新设计方案

## 文档信息
- **日期**: 2026-04-25
- **状态**: 设计阶段
- **范围**: EntryDetailView 页面重构、代码高亮修复、Markdown 样式优化

## 问题总结

### 当前存在的问题

1. **按钮重复**
   - EntryDetailView header 有 Copy/Download/Wrap/Theme 按钮
   - CodeViewer 内部 code-header 又有 Copy/Wrap 按钮
   - 用户看到重复的功能按钮，界面混乱

2. **响应式布局异常**
   - 桌面端显示移动端布局（三栏变单栏）
   - 文件树/TOC 侧边栏未正确显示
   - 媒体查询可能存在优先级问题

3. **Markdown 样式问题**
   - 渲染效果不美观
   - 代码块样式与整体设计不统一
   - 缺少必要的视觉层次

4. **代码高亮未生效**
   - Shiki 高亮可能未正确应用
   - 缺少彩色语法高亮效果
   - 主题切换时样式不更新

## 设计目标

### 功能目标
- [ ] 移除重复按钮，统一操作栏
- [ ] 修复响应式布局（桌面/移动正确切换）
- [ ] 美化 Markdown 渲染样式
- [ ] 修复代码语法高亮

### 体验目标
- [ ] 桌面端：顶部工具栏 + 三栏布局
- [ ] 移动端：底部工具栏 + 单栏布局
- [ ] Markdown 风格：文档站风格（类似 VitePress）
- [ ] 代码主题：自动跟随系统主题（深色/浅色）

## 详细设计

### 1. 布局架构重构

#### 1.1 组件职责重新划分

```
EntryDetailView.vue (页面级容器)
├── DesktopLayout (桌面端布局)
│   ├── HeaderBar (顶部工具栏)
│   │   ├── BackLink
│   │   ├── EntryTitle
│   │   └── ActionButtons (Copy/Download/Wrap/Theme)
│   ├── ThreeColumnLayout
│   │   ├── SidebarLeft (FileTree)
│   │   ├── MainContent
│   │   │   ├── CodeViewer (纯展示，无操作按钮)
│   │   │   └── MarkdownViewer
│   │   └── SidebarRight (TOC)
│   └── EntryMeta (底部标签/时间)
└── MobileLayout (移动端布局)
    ├── HeaderBar (简化)
    ├── SingleColumnContent
    └── BottomActionBar (底部工具栏)
```

#### 1.2 响应式断点设计

| 断点 | 范围 | 布局 |
|------|------|------|
| Desktop | ≥1024px | 三栏布局，顶部工具栏 |
| Tablet | 768px-1023px | 两栏布局，顶部工具栏 |
| Mobile | <768px | 单栏布局，底部工具栏 |

#### 1.3 按钮位置策略

**桌面端 (≥768px)**:
- Copy: 顶部工具栏
- Download: 顶部工具栏
- Wrap: 顶部工具栏（仅代码文件）
- Theme: 顶部工具栏

**移动端 (<768px)**:
- Copy: 底部工具栏 (图标 + 文字)
- Download: 底部工具栏 (图标 + 文字)
- Wrap: 底部工具栏 (图标 + 文字，仅代码文件)
- Theme: 底部工具栏 (图标 + 文字)
- File: 底部工具栏 (左滑抽屉)
- TOC: 底部工具栏 (右滑抽屉，仅 Markdown)

### 2. CodeViewer 组件重构

#### 2.1 当前问题
- 内部包含 Copy/Wrap 按钮（与父组件重复）
- 需要接收外部控制状态

#### 2.2 新设计

```typescript
// Props 定义
interface CodeViewerProps {
  content: string
  filename: string
  language: string | null
  lineCount: number | null
  wrap: boolean  // 外部控制换行
}

// Emits
interface CodeViewerEmits {
  // 无操作按钮，纯展示
}
```

#### 2.3 视觉层次

```
┌─────────────────────────────────────────────────────┐
│ 📝 main.py                                  11 lines │  ← 头部信息（无按钮）
├─────────────────────────────────────────────────────┤
│   1 │ def hello():                                 │  ← 行号（sticky left）
│   2 │     print("Hello")                          │  ← 代码内容
│   3 │     return 42                               │
│ ... │                                             │
└─────────────────────────────────────────────────────┘
```

### 3. MarkdownViewer 样式优化

#### 3.1 文档站风格设计

**标题样式**:
- H1: 2xl/700 字重，底部边框分隔
- H2: xl/600 字重，顶部 margin-top 较大
- H3: lg/600 字重
- 所有标题：锚点链接（鼠标悬停显示）

**段落样式**:
- 字体: Inter, system-ui
- 字号: base (16px)
- 行高: 1.75 (舒适的阅读体验)
- 最大宽度: 65ch (最佳阅读宽度)

**代码块样式**:
- 背景: `--bg-secondary` 带轻微边框
- 圆角: `--radius-md`
- 语言标签: 左上角显示
- 复制按钮: 右上角悬浮

**列表样式**:
- 有序列表: 数字 + 适当缩进
- 无序列表: 圆点 + 适当缩进
- 嵌套列表: 递增缩进

**引用块**:
- 左侧 3px 蓝色边框
- 背景轻微高亮
- 斜体显示

### 4. 代码高亮修复

#### 4.1 Shiki 主题配置

使用 CSS Variables 主题模式，实现自动跟随系统主题:

```css
/* variables.css - 深色主题 */
[data-theme="dark"] {
  --shiki-foreground: var(--text-primary);
  --shiki-background: var(--bg-secondary);
  --shiki-token-constant: #79c0ff;
  --shiki-token-string: #a5d6ff;
  --shiki-token-comment: #8b949e;
  --shiki-token-keyword: #ff7b72;
  --shiki-token-parameter: #ffdac1;
  --shiki-token-function: #d2a8ff;
  --shiki-token-string-expression: #a5d6ff;
  --shiki-token-punctuation: #c9d1d9;
  --shiki-token-number: #79c0ff;
  --shiki-token-property: #79c0ff;
  --shiki-token-variable: #ffa657;
}

/* variables.css - 浅色主题 */
[data-theme="light"] {
  --shiki-foreground: var(--text-primary);
  --shiki-background: var(--bg-secondary);
  --shiki-token-constant: #0550ae;
  --shiki-token-string: #0a3069;
  --shiki-token-comment: #6e7781;
  --shiki-token-keyword: #cf222e;
  --shiki-token-parameter: #953800;
  --shiki-token-function: #8250df;
  --shiki-token-string-expression: #0a3069;
  --shiki-token-punctuation: #24292f;
  --shiki-token-number: #0550ae;
  --shiki-token-property: #0550ae;
  --shiki-token-variable: #953800;
}
```

#### 4.2 动态主题切换

确保 Shiki 输出在主题切换时自动更新颜色:
- Shiki 使用 CSS Variables 主题，自动响应主题变化
- 无需重新渲染代码块

### 5. 响应式 CSS 架构

#### 5.1 移动优先策略

```css
/* 基础样式 - 移动端 */
.entry-detail-view {
  padding: var(--space-3);
  max-width: 100%;
}

.header-actions {
  display: none; /* 移动端隐藏顶部按钮 */
}

.mobile-bottom-bar {
  display: flex; /* 移动端显示底部栏 */
}

/* 桌面端增强 */
@media (min-width: 768px) {
  .entry-detail-view {
    padding: var(--space-5);
    max-width: 1200px;
    margin: 0 auto;
  }

  .header-actions {
    display: flex;
  }

  .mobile-bottom-bar {
    display: none;
  }
}
```

#### 5.2 三栏布局（桌面）

```css
.entry-content {
  display: grid;
  grid-template-columns: 240px 1fr 220px;
  gap: var(--space-4);
}

.sidebar-left {
  border-right: 1px solid var(--border-color);
}

.sidebar-right {
  border-left: 1px solid var(--border-color);
}
```

#### 5.3 单栏布局（移动）

```css
@media (max-width: 767px) {
  .entry-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sidebar-left,
  .sidebar-right {
    display: none; /* 移动端隐藏，使用抽屉替代 */
  }
}
```

### 6. 底部工具栏设计（移动端）

#### 6.1 布局

```
┌──────────────────────────────────────────────────────┐
│ [📄 文件名]        [📋] [⬇️] [↩️] [🌓]                │
│                    Copy Down Wrap Theme               │
└──────────────────────────────────────────────────────┘
     文件按钮              操作按钮组（图标 + 文字）
```

#### 6.2 按钮规格

- 高度: 56px（符合 iOS/Android 推荐值）
- 图标: 24px
- 文字: 10px，图标下方
- 触摸目标: 最小 44x44px

### 7. 交互设计

#### 7.1 按钮反馈

- 悬停: 背景色变化 + 轻微上移 (-1px)
- 点击: 背景色加深 + 缩放 (0.98)
- 复制成功: Toast 提示 + 按钮图标变为 ✓

#### 7.2 抽屉动画

- 打开: 从底部滑入 (300ms, ease-out)
- 关闭: 向下滑出 (200ms, ease-in)
- 遮罩: 淡入淡出 (200ms)

#### 7.3 文件树交互

- 点击文件: 高亮当前文件 + 加载内容
- 展开/收起: 旋转箭头图标 (180°)
- 当前文件指示: 左侧蓝色竖条

### 8. 技术实现

#### 8.1 依赖

- Shiki: 代码高亮（已集成）
- markdown-it: Markdown 渲染（已集成）
- markdown-it-anchor: 锚点生成（已集成）

#### 8.2 状态管理

```typescript
// EntryDetailView 状态
const state = {
  wrapCode: ref(false),        // 换行开关
  currentTheme: ref('dark'),   // 当前主题
  fileDrawerOpen: ref(false),  // 文件抽屉
  tocDrawerOpen: ref(false),   // TOC 抽屉
}
```

#### 8.3 CSS 变量（已存在，需验证完整性）

确保以下变量已定义:
- 颜色: `--bg-primary`, `--bg-secondary`, `--text-primary`, etc.
- 间距: `--space-*` 系列
- 圆角: `--radius-*` 系列
- 字体: `--font-*` 系列

### 9. 测试策略

#### 9.1 单元测试

- CodeViewer: 渲染代码、行号显示、换行切换
- MarkdownViewer: 标题锚点、代码块复制

#### 9.2 E2E 测试

- 响应式: 不同视口下的布局正确性
- 功能: 按钮操作、抽屉开关、文件切换
- 交互: 动画流畅性、触摸目标大小

#### 9.3 视觉回归测试

- Markdown 渲染截图对比
- 代码高亮截图对比
- 主题切换截图对比

### 10. 验收标准

#### 10.1 功能验收

- [ ] 桌面端显示三栏布局，顶部工具栏
- [ ] 移动端显示单栏布局，底部工具栏
- [ ] 无重复按钮
- [ ] Copy/Download/Wrap/Theme 功能正常工作
- [ ] 代码语法高亮正确显示（彩色）
- [ ] Markdown 渲染美观（文档站风格）
- [ ] 主题切换时代码高亮自动更新

#### 10.2 体验验收

- [ ] 移动端底部栏高度 56px，不遮挡内容
- [ ] 触摸目标最小 44x44px
- [ ] 按钮点击有视觉反馈
- [ ] 抽屉动画流畅（60fps）
- [ ] 加载状态有骨架屏

## 变更影响分析

### 受影响的文件

1. `src/views/EntryDetailView.vue` - 主要重构
2. `src/components/CodeViewer.vue` - 移除内部按钮
3. `src/components/MobileBottomBar.vue` - 可能调整
4. `src/components/MarkdownViewer.vue` - 样式优化
5. `src/styles/variables.css` - 添加 Shiki 主题变量
6. `src/styles/markdown.css` - 新建 Markdown 样式文件

### 向后兼容性

- API 无变化
- 路由无变化
- 用户数据无影响

### 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 响应式布局回归 | 中 | 全面 E2E 测试覆盖 |
| 主题切换异常 | 低 | CSS Variables 模式已验证 |
| 性能下降 | 低 | 组件懒加载，骨架屏优化 |

## 实现计划概要

1. **Phase 1**: EntryDetailView 布局重构（组件拆分）
2. **Phase 2**: CodeViewer 重构（移除内部按钮）
3. **Phase 3**: Markdown 样式优化（文档站风格）
4. **Phase 4**: Shiki 代码高亮修复（主题变量）
5. **Phase 5**: 响应式 CSS 修复
6. **Phase 6**: 测试编写与回归测试

---

*设计文档完成，等待实现计划*
