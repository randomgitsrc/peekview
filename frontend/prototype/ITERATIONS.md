# Peek Frontend Prototype - 迭代记录

> 位置: `frontend/prototype/index.html`

---

## v3 - 移动端底部工具栏重构 (2026-04-23)

### 变更动机
- 移动端 Toolbar 被隐藏导致 Wrap/Copy/Download 按钮无法访问
- 需要根据文件类型（代码/Markdown）和条目类型（单文件/多文件）自适应显示

### 设计决策

| 场景 | 左侧区域 | 右侧按钮 |
|------|----------|----------|
| **多文件条目** | ☰ 汉堡按钮 + "N files" 徽章 | Wrap, Copy, Download, TOC |
| **单文件代码** | 📄 文件名（无汉堡） | Wrap, Copy, Download |
| **Markdown有TOC** | 📄 文件名 | Copy, Download, TOC（无Wrap） |

### 按钮行为
- **Wrap (↩)**: 切换代码自动换行，仅代码文件显示
- **Copy (📋)**: 复制当前文件内容（不含行号）
- **Download (⬇️)**: 下载当前文件
- **TOC (☰)**: 打开大纲抽屉，仅 Markdown 有标题时显示
- **汉堡按钮**: 打开文件列表抽屉，多文件时显示

### 技术实现
```vue
<!-- MobileBottomBar.vue Props -->
interface Props {
  activeFile: FileResponse | null
  hasMultipleFiles: boolean
  fileCount: number
  isCodeFile: boolean
  canCopy: boolean
  canDownload: boolean
  hasToc: boolean
  content?: string
}

const emit: ['toggleFileDrawer', 'toggleToc', 'download', 'toggleWrap']
```

---

## v2 - 行号与复制修复 (2026-04-22)

### 问题
- 换行模式下代码换行后，行号与代码行错位
- 复制时会包含行号

### 解决方案

**CSS 结构变更:**
```css
/* 从列布局改为行布局 */
.code-lines { display: flex; flex-direction: column; }
.code-line {
  display: flex;
}
.line-number {
  flex-shrink: 0;
  user-select: none;  /* 禁止选择 */
}
.line-content {
  flex: 1;
  white-space: pre;   /* 不换行时 */
}
.code-block.wrap-enabled .line-content {
  white-space: pre-wrap;  /* 换行模式 */
}
```

**复制实现:**
```typescript
// 从原始数据复制，不是从 DOM
async function copyCode() {
  await navigator.clipboard.writeText(props.content)
}
```

---

## v1 - 初始设计 (2026-04-21)

### 桌面端布局
- 三栏: FileTree (240px) | Content | TOC (200px)
- Toolbar: 面包屑 + Copy/Download/Share/Wrap 按钮

### 移动端布局
- Header: 返回 + 标题 + 主题切换
- Content: 全宽内容区
- Bottom Bar: 文件选择 + Copy/Download/TOC 按钮
- 抽屉: 文件树抽屉 + TOC 抽屉

### 主题系统
- FOUC 预防: `<head>` 内联脚本设置 `data-theme`
- CSS Variables: `[data-theme="dark"]` 覆盖颜色
- 切换动画: `transition` 平滑过渡

---

## 待验证清单

- [x] 桌面端三栏布局
- [x] 移动端底部工具栏 (v3)
- [x] 代码换行按钮功能
- [x] 行号与代码对齐（换行时）
- [x] 文件抽屉展开/收起
- [x] TOC 抽屉展开/收起
- [x] 主题切换 (Dark/Light)
- [x] 复制代码（不含行号）
- [x] **EntryListView 原型 (entries.html)**
  - [x] 搜索框 + 实时过滤
  - [x] 标签筛选
  - [x] 条目卡片网格
  - [x] 空状态
  - [x] 分页
  - [x] 移动端响应式
- [ ] 截图验证（桌面端/移动端）
- [ ] 真实设备测试

---

## EntryListView 原型 (2026-04-23)

**文件**: `frontend/prototype/entries.html`

### 功能
- **搜索框**: 实时过滤（关键词匹配标题/摘要/标签）
- **标签筛选**: 点击标签过滤，支持 "All" 和清除
- **条目卡片**: 标题、摘要（2行截断）、标签、状态、文件数、创建时间、过期时间
- **空状态**: 搜索无结果时显示
- **分页**: 页码导航
- **响应式**: 桌面端网格布局，移动端单列

### 与 EntryDetailView 的导航
点击卡片跳转: `entries.html?entry={slug} → index.html?entry={slug}`

### 真实实现差异
| 原型 | 真实实现 |
|------|---------|
| 前端 mock 过滤 | 后端 FTS5 搜索 API |
| 静态假数据 | `/api/v1/entries` 动态获取 |
| 前端分页 | 真实分页参数 |
| 静态时间显示 | Day.js 相对时间格式化 |
