# Entry Detail Header 设计说明

> 本文档供 P1-P7 各阶段 subagent 阅读，与 `design-prototypes/` 目录下 HTML 原型配合使用。
> HTML 原型展示视觉渲染效果，本文档说明布局结构、交互行为、状态变化。

---

## 1. 整体架构

Desktop 和 Mobile 用两套不同的布局。

| | Desktop | Mobile |
|--|---------|--------|
| 行数 | 2 行 header | Sticky header (52px) + 内容区 + 底部栏 (48px) |
| 总高 | ~78px | Sticky 52px |
| 主题切换 | 在标题行右侧 icon | 在 overflow bottom sheet 中 |
| 文件列表 | [Files] toggle 按钮（打开 sidebar） | [Files] 在底部栏左侧，点击出 drawer |
| 更多操作 | More▾ 下拉菜单 | [...] bottom sheet |

---

## 2. Desktop 布局

### 2.1 结构

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Logo] Title (flex:1)           [Files] [TOC] [Copy] [Share] [More▾] [🌙] │  ← .title-row
│ @alice · 3h ago · Exp │ 42 reads · Public · #api #tutorial         │  ← .meta-row
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 各元素说明

**.title-row** — display:flex, align-items:center
| 元素 | 类型 | 大小 | 说明 |
|------|------|------|------|
| Logo | 28×28 rounded 6px | 蓝色背景 P 字 | 固定 |
| Title | flex:1, line-clamp:2 | 16px, font-weight 600 | 长标题最多 2 行 |
| [Files] toggle button | 32×32 icon | folder icon | 点击打开/关闭文件树 sidebar，active 时蓝色高亮。仅 multi-file 条目显示（`isMultiFile === true`） |
| [TOC] toggle button | 32×32 icon | list icon | 点击打开/关闭目录 sidebar。仅 markdown 文件且至少有一个 heading 时显示（`isMarkdown && tocHeadings.length > 0`） |
| [Copy] action button | 32×32 icon | copy icon | 复制内容 |
| [Share] action button | 32×32 icon | share-2 icon | 仅 owner 可见，打开分享对话框 |
| [More▾] overflow | 带 dropdown 的按钮 | three-dots + chevron-down | hover 展开下拉菜单 |
| [🌙] theme toggle | 32×32 icon | moon/sun icon | 全局主题切换 |

**.meta-row** — display:flex, align-items:center, gap:8px, font: 12px mono
| 组 | 内容 | 说明 |
|----|------|------|
| 身份+时间 | `@alice · 3h ago · Exp in 12d` | 左对齐，带 `·` 分隔 |
| 竖线分隔 | `│` | thin vertical line (1px, `--c-border-strong`) |
| 互动+标签 | `42 reads · Public · #api #tutorial` | 右半组 |

### 2.3 Hover/Active 状态

- **icon-btn**: 默认 `color: var(--c-text-secondary)`，hover → `background: var(--c-border), color: var(--c-text)`
- **toggle-btn**: 同 icon-btn 基础样式。active（蓝色高亮）：`background: rgba(77,141,255,.12); color: var(--c-accent-secondary); border-color: rgba(77,141,255,.2)`
- **icon-btn/toggle-btn 都有 tooltip**：悬停 200ms 后在按钮下方显示文字标签（`position:absolute`, 11px, 白底黑字）
- **overflow-toggle**: 同 icon-btn 基础样式，hover 后保持 active 态（dropdown 打开时也保持 active）

### 2.4 Overflow 下拉菜单

> 注：下面用 emoji 示意，**实际使用 Lucide SVG icon**（globe/share-2/download/package/file-text/list/trash-2），每个 icon 16px。

```
┌───────────────────┐
│ 🌐 Make Private   │  ← Owner only，当前状态显示在 hint
│ 📤 Share          │  ← Owner only
├───────────────────┤  ← divider
│ ⬇️ Download       │
│ 📦 Download Pack  │  ← only if multi-file
│ 📄 Raw content    │
│ 📋 Table of Contents │  ← only if markdown
├───────────────────┤  ← divider
│ 🗑️ Delete entry   │  ← red, Owner only
└───────────────────┘
```

- Desktop 和 Mobile 的 overflow 内容**相同**，仅展示形式不同（desktop=dropdown，mobile=bottom sheet）
- Lucide SVG 图标（非 emoji），16px
- 每项右对齐 hint 文字（状态说明或快捷提示）
- Danger 操作 Delete 红色高亮，位于最底部

---

## 3. Mobile 布局

### 3.1 整体结构

```
┌─────────────────────────────────────────┐
│ [←] Truncated title (ellipsis)  (52px)  │  ← .sticky-header
├─────────────────────────────────────────┤
│ Title (19px bold)                        │  ← .page-title（内容区首行）
│ @alice · 3h ago │ 42 reads · Public · #api #tutorial │  ← .meta-tags-bar（随滚动隐藏，tags inline）
│ ───────────────────────────────────────  │
│ Code/Content area...                     │
│                                          │
├─────────────────────────────────────────┤
│ [Files(3)]   ────flex────   [TOC] [...]  │  ← .bottom-bar (48px)
└─────────────────────────────────────────┘
```

### 3.2 Sticky header

- 高度 52px
- 毛玻璃背景：`background: rgba(18,24,34,.88); backdrop-filter: blur(16px)`
- 左侧 back button (34×34, chevron-left icon)
- 右侧 truncate title（flex:1, white-space:nowrap, text-overflow:ellipsis）
- 无其他元素

### 3.3 Meta-tags-bar（随滚动隐藏）

```
@alice · 3h ago │ 42 reads · Public · #api #tutorial
```

- 与 desktop meta-row 结构一致（竖线分隔时间/阅读量两组）
- 用 Intersection Observer 或 scroll 事件控制隐藏
- 隐藏时序：页面刚加载时可见，用户向下滚动时渐隐（opacity transition）
- 仅当 .sticky-header 出现后才触发隐藏

### 3.4 底部栏（动态变化）

底部栏 48px，border-top: 1px solid var(--c-border)

**布局**：`[Files(N)] [flex:1] [动态按钮] [...]`

**Files 按钮**：
- 左侧固定，带 folder icon + "Files" 文字 + 文件数 badge
- badge：灰色小圆角矩形 `background: var(--c-border)`，字体 mono 10px
- 点击打开 Files drawer（左滑出 280px drawer）

**右侧按钮按文件类型变化**：

| 文件类型 | 条件 | 显示的按钮 |
|---------|------|-----------|
| .md | isMarkdown === true | `[TOC]` (primary) + `[...]` |
| 文本/代码 | !isMarkdown && !isBinary | `[Wrap]` + `[Copy]` (primary) + `[...]` |
| 二进制/图片 | isBinary === true | `[...]`（只有 overflow） |

- primary 按钮（TOC、Copy）有蓝色填充背景：`background: rgba(77,141,255,.12); color: var(--c-accent)`
- Wrap 按钮为普通样式
- [...] 按钮 38×38，three-dots icon

### 3.5 Overflow bottom sheet

> 注：下面用 emoji 示意，**实际使用 Lucide SVG icon**（moon/globe/share-2/download/package/file-text/trash-2），每个 icon 18px。

点击 [...] 打开底部弹窗：

```
┌──────────────────────────────────────┐
│ ═══ (drag handle)                     │
│ More actions                          │  ← sheet header
│ ✕ (close button)                      │
├──────────────────────────────────────┤
│ 🌙 Dark theme        Tap to toggle   │  ← 总是显示
├──────────────────────────────────────┤  ← divider
│ 🌐 Make Private     Currently Public │  ← Owner only
│ 📤 Share           Create share link │  ← Owner only
├──────────────────────────────────────┤  ← divider
│ ⬇️ Download              .md         │
│ 📦 Download as Pack       5 files    │  ← only if multi-file
│ 📄 Raw content   Structured JSON     │
├──────────────────────────────────────┤  ← divider
│ 🗑️ Delete entry     Permanently     │  ← 红色，Owner only
└──────────────────────────────────────┘
```

- 从底部弹出，带 backdrop overlay (rgba(0,0,0,.45))
- 圆角 16px 顶部
- 每项 icon 18px + label + 右对齐 hint
- Divider 分组，3 个分隔：显示设置 / Owner操作 / 文件操作 / 危险区
- 危险操作（Delete）红色高亮 `color: var(--c-error)`

---

## 4. ThemeToggle 组件改动

当前 `ThemeToggle.vue` 使用 emoji（🌙/☀️），需要改为 Lucide SVG 图标：

- 暗色 → moon icon（`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`）
- 亮色 → sun icon（circle + rays）

Desktop 中使用 `theme-btn` class（32×32 icon button）
Mobile 中在 overflow drawer 顶部显示

---

## 5. 涉及的状态与逻辑

| 状态 | 影响 |
|------|------|
| 是否 Owner | 显示/隐藏 Share、Make Private、Delete |
| 文件类型（markdown/code/binary） | 底部栏按钮组合，TOC toggle 显示 |
| 是否 multi-file | 显示 Files 按钮、Pack 操作 |
| TOC 是否有 headings | TOC 按钮 disabled 或隐藏 |
| 当前 Wrap 状态 | Wrap 按钮 primary/secondary 切换 |
| 当前 file tree 是否打开 | Files toggle active 状态 |
| 当前 TOC 面板是否打开 | TOC toggle active 状态 |
| 当前主题（dark/light） | Moon/Sun 图标切换 |

---

## 6. 现有代码参考

- `frontend-v3/src/views/EntryDetailView.vue` — 主视图，header template 在 line 16-274，scoped CSS 在 line 796-1070
- `frontend-v3/src/components/ThemeToggle.vue` — 当前 emoji 实现
- `frontend-v3/src/styles/layout.css` — drawer 样式（line 123-162），通用布局
- `frontend-v3/src/stores/entry.ts` — 状态管理：`canWrap`/`canCopy`/`canDownload`/`canPack`/`isMarkdown`/`isMultiFile`
- `frontend-v3/src/components/OverflowMenu.vue` — 当前实现桌面 dropdown，需扩展支持 mobile bottom sheet（传入 variant prop）
