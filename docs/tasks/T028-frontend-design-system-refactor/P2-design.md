---
phase: P2
task_id: T028
task_name: frontend-design-system-refactor
type: design
trace_id: T028-P2-20260629
created: 2026-06-29
status: draft
parent: T028-P1-20260629
---

# T028 Frontend Design System Refactor — P2 Design

## 1. 影响域分析

### 1.1 改什么

| 类别 | 文件 | 变更内容 |
|------|------|----------|
| Token 全局化 | `variables.css` | 将 `--c-*` token 从 LandingView `.stage` 提升到 `[data-theme]` 全局；旧 token 重定义为 `var(--c-*)` 别名 |
| Token 全局化 | `LandingView.vue` | 删除 `.stage` 内的 `--c-*` 声明（已全局化）；重命名非规范 token（`--c-panel` → `--c-surface` 等） |
| 全局样式 | `base.css` | 将 22 处旧 token 替换为 `--c-*` token |
| 布局样式 | `layout.css` | 将 16 处旧 token 替换为 `--c-*` token |
| 共享组件（新建） | `components/BaseButton.vue` | 新建 |
| 共享组件（新建） | `components/BaseTag.vue` | 新建 |
| 共享组件（新建） | `components/BaseBadge.vue` | 新建 |
| 共享组件（新建） | `components/SearchInput.vue` | 新建 |
| 共享组件（新建） | `components/EmptyState.vue` | 新建 |
| 共享组件（新建） | `components/EntryListRow.vue` | 新建 |
| 共享组件（新建） | `components/PageHeader.vue` | 新建 |
| 页面重构 | `EntryListView.vue` | Token 替换 + 共享组件替换 + 样式重写 |
| 页面重构 | `EntryDetailView.vue` | Token 替换 + 共享组件替换（BaseButton）+ 样式重写 |
| 页面重构 | `ApiKeyListView.vue` | Token 替换 + 共享组件替换 + 对话框 token 替换 |
| 页面重构 | `NotFoundView.vue` | Token 替换 + 共享组件替换 |

### 1.2 不改什么

| 类别 | 文件/范围 | 理由 |
|------|-----------|------|
| 不在范围的组件 | LoginDialog, ConfirmDialog, Toast, Pagination, FileTree, TreeNodeItem, ThemeToggle, CodeViewer, MarkdownViewer, HtmlViewer, ImageViewer, DiagramBlock, BannerBar, FilterChip, TocNav, ActionBar, ShareDialog, ShareManagementPanel, SvgRenderer, MermaidRenderer, PlantUmlRenderer | P1 确认：18+ 组件不在范围，靠旧 token 别名兼容 |
| 不在范围的 CSS | `code.css`, `markdown.css` | 代码高亮和 Markdown 渲染样式，靠旧 token 别名兼容 |
| LandingView 视觉 | `.glow`, `.grid-bg`, hero 渐变文本, preview window | 不改视觉效果，只改 token 声明位置和名称 |
| 路由/API/状态管理 | 所有 `.ts` store/api/router 文件 | P0 明确 out of scope |
| Footer SVG 图标 | EntryListView footer 的 GitHub/PyPI/npm SVG | P1 确认保留现有 SVG |
| ApiKeyListView 对话框结构 | Create Key Dialog 的 HTML 结构 | P1 确认只替换 token + BaseButton |

### 1.3 风险在哪

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 旧 token 别名映射不正确，非范围组件颜色断裂 | 低 | 高 | 别名使用 `var(--c-*)` 引用，值等价于原 hex |
| LandingView `.stage` 提升后 scoped 样式权重变化 | 中 | 高 | 提升后删除 `.stage` 内重复声明；scoped CSS 直接用全局 token |
| `--bg-primary` 1:N 映射（D2）——页面背景 vs 卡片背景 | 高 | 中 | 别名主映射=`--c-bg`，页面重构时按上下文手动改 `--c-surface` |
| base.css 迁移影响 LandingView | 低 | 中 | LandingView 自建 .btn 在 scoped 中，优先级更高；验证视觉不变 |
| EntryDetailView 两栏/移动端切换逻辑复杂 | 中 | 中 | 不改布局逻辑，只替换 token + BaseButton |

## 2. 改动方案

### 2.1 Token 迁移方案

#### 2.1.1 全局 `--c-*` Token 声明

将 LandingView `.stage` 中的 token 提升到 `variables.css` 的 `[data-theme]` 规则中。补齐 DESIGN.md 规定但 LandingView 未声明的 token。

**LandingView 现有 token → DESIGN.md 规范名称重命名：**

| LandingView `.stage` 名称 | DESIGN.md 规范名称 | dark 值 | light 值 |
|---|---|---|---|
| `--c-bg` | `--c-bg` | `#0a0d13` | `#f6f8fa` |
| `--c-panel` | `--c-surface` | `#121822` | `#ffffff` |
| `--c-panel2` | `--c-surface-lower` | `#0e131b` | `#eef0f3` |
| `--c-border` | `--c-border` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` |
| `--c-border2` | `--c-border-strong` | `rgba(255,255,255,.13)` | `rgba(0,0,0,.13)` |
| `--c-text` | `--c-text` | `#e9eef4` | `#1f2328` |
| `--c-muted` | `--c-text-secondary` | `#9aa7b4` | `#656d76` |
| `--c-faint` | `--c-text-tertiary` | `#6a7682` | `#8c959f` |
| `--c-accent` | `--c-accent` | `#4d8dff` | `#0969da` |
| `--c-accent2` | `--c-accent-secondary` | `#76a6ff` | `#0550ae` |
| `--glow-color` | `--c-glow` | `rgba(77,141,255,.20)` | `rgba(9,105,218,.10)` |

**新增（DESIGN.md 规定但 LandingView 未声明）：**

| Token | dark 值 | light 值 |
|---|---|---|
| `--c-success` | `#7ee787` | `#1a7f37` |
| `--c-warning` | `#febc2e` | `#9a6700` |
| `--c-error` | `#ff7b72` | `#cf222e` |
| `--c-tag-bg` | `rgba(77,141,255,.14)` | `rgba(9,105,218,.1)` |
| `--c-badge-public-bg` | `rgba(126,231,135,.15)` | `rgba(26,127,55,.1)` |
| `--c-badge-private-bg` | `rgba(255,123,114,.15)` | `rgba(207,34,46,.1)` |
| `--c-badge-shared-bg` | `rgba(254,188,46,.15)` | `rgba(154,103,0,.1)` |

**Landing-only token（保留在 LandingView scoped style，不提升）：**

| Token | 用途 |
|---|---|
| `--c-hero-grad` | Hero 标题渐变 |
| `--c-cta-grad` | CTA 标题渐变 |
| `--pw-*` (7 个) | Preview window 模拟样式 |

#### 2.1.2 旧 Token 别名映射表

旧 token 在 `variables.css` 中重定义为指向新 `--c-*` token 的 `var()` 引用。**注意 D2：同一旧 token 在不同语义上下文映射不同新 token，别名只能取主映射，页面重构时按上下文手动替换。**

| 旧 Token | 别名映射 | 说明 |
|---|---|---|
| `--bg-primary` | `var(--c-bg)` | **主映射=页面背景**。卡片/对话框背景在页面重构时改用 `--c-surface`（D2） |
| `--bg-secondary` | `var(--c-surface)` | 卡片、面板、输入框背景 |
| `--bg-tertiary` | `var(--c-surface-lower)` | 嵌套表面、hover 背景 |
| `--bg-code` | `var(--c-surface-lower)` | 代码块背景 |
| `--bg-overlay` | `rgba(0,0,0,.5)` | 遮罩层（DESIGN.md Modal 规定相同） |
| `--border-color` | `var(--c-border)` | 默认边框 |
| `--border-hover` | `var(--c-text-tertiary)` | 边框 hover 色 |
| `--text-primary` | `var(--c-text)` | 主文本 |
| `--text-secondary` | `var(--c-text-secondary)` | 次要文本 |
| `--text-tertiary` | `var(--c-text-tertiary)` | 三级文本 |
| `--text-on-accent` | `#ffffff` | 强调色上文本（不变） |
| `--accent-color` | `var(--c-accent)` | 主强调色 |
| `--accent-hover` | `var(--c-accent-secondary)` | 强调色 hover |
| `--accent-light` | `var(--c-tag-bg)` | Tag 背景（等价 DESIGN.md Tag 规范） |
| `--success-color` | `var(--c-success)` | 成功色 |
| `--success-bg` | `var(--c-badge-public-bg)` | 成功背景 |
| `--success-text` | `var(--c-success)` | 成功文本 |
| `--success-border` | `rgba(126,231,135,.3)` / `rgba(26,127,55,.3)` | 成功边框 |
| `--warning-color` | `var(--c-warning)` | 警告色 |
| `--warning-bg` | `var(--c-badge-shared-bg)` | 警告背景 |
| `--warning-text` | `var(--c-warning)` | 警告文本 |
| `--warning-border` | `rgba(254,188,46,.3)` / `rgba(154,103,0,.3)` | 警告边框 |
| `--error-color` | `var(--c-error)` | 错误色 |
| `--error-bg` | `var(--c-badge-private-bg)` | 错误背景 |
| `--error-text` | `var(--c-error)` | 错误文本 |
| `--error-border` | `rgba(255,123,114,.3)` / `rgba(207,34,46,.3)` | 错误边框 |
| `--tag-bg` | `var(--c-tag-bg)` | Tag 背景 |
| `--tag-text` | `var(--c-accent-secondary)` | Tag 文本 |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.06)` | 微阴影 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.08)` | 中阴影 |

**D2 处理细节**：`--bg-primary` 的别名映射为 `var(--c-bg)`（页面背景语义）。在重构页面中，原来用 `--bg-primary` 做卡片/对话框背景的地方，必须手动改为 `var(--c-surface)`。需要逐页面 grep + 人工判断。

**颜色值差异说明**：旧 token dark 主题 `--accent-color: #3b82f6` vs 新 `--c-accent: #4d8dff`；旧 `--error-color: #f85149` vs 新 `--c-error: #ff7b72`。别名映射后非范围组件颜色会从旧值变到新值。差异极小（同色系微调），视觉可接受。**这是有意为之**——统一到 DESIGN.md 色板。

#### 2.1.3 variables.css 最终结构

```css
:root {
  /* Spacing (不变) */
  --space-1: 4px; ... --space-7: 48px;
  /* Typography (不变) */
  --font-xs: 12px; ... --font-mono: ...;
  /* Border Radius (不变) */
  --radius-sm: 3px; --radius-md: 6px; --radius-lg: 8px;
  /* Transitions (不变) */
  --transition-fast: 150ms ease; --transition-medium: 250ms ease;
  /* Layout (不变) */
  --header-height: 56px; --sidebar-width: 260px; --toc-width: 240px;
}

/* Dark Theme */
[data-theme="dark"] {
  /* 新 --c-* token（主声明） */
  --c-bg: #0a0d13;
  --c-surface: #121822;
  --c-surface-lower: #0e131b;
  --c-border: rgba(255,255,255,.08);
  --c-border-strong: rgba(255,255,255,.13);
  --c-text: #e9eef4;
  --c-text-secondary: #9aa7b4;
  --c-text-tertiary: #6a7682;
  --c-accent: #4d8dff;
  --c-accent-secondary: #76a6ff;
  --c-glow: rgba(77,141,255,.20);
  --c-success: #7ee787;
  --c-warning: #febc2e;
  --c-error: #ff7b72;
  --c-tag-bg: rgba(77,141,255,.14);
  --c-badge-public-bg: rgba(126,231,135,.15);
  --c-badge-private-bg: rgba(255,123,114,.15);
  --c-badge-shared-bg: rgba(254,188,46,.15);

  /* 旧 token 别名（向后兼容） */
  --bg-primary: var(--c-bg);
  --bg-secondary: var(--c-surface);
  --bg-tertiary: var(--c-surface-lower);
  --bg-code: var(--c-surface-lower);
  --bg-overlay: rgba(0,0,0,.5);
  --border-color: var(--c-border);
  --border-hover: var(--c-text-tertiary);
  --text-primary: var(--c-text);
  --text-secondary: var(--c-text-secondary);
  --text-tertiary: var(--c-text-tertiary);
  --text-on-accent: #ffffff;
  --accent-color: var(--c-accent);
  --accent-hover: var(--c-accent-secondary);
  --accent-light: var(--c-tag-bg);
  --success-color: var(--c-success);
  --success-bg: var(--c-badge-public-bg);
  --success-text: var(--c-success);
  --success-border: rgba(126,231,135,.3);
  --warning-color: var(--c-warning);
  --warning-bg: var(--c-badge-shared-bg);
  --warning-text: var(--c-warning);
  --warning-border: rgba(254,188,46,.3);
  --error-color: var(--c-error);
  --error-bg: var(--c-badge-private-bg);
  --error-text: var(--c-error);
  --error-border: rgba(255,123,114,.3);
  --tag-bg: var(--c-tag-bg);
  --tag-text: var(--c-accent-secondary);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,.08);
}

/* Light Theme */
[data-theme="light"] {
  /* 新 --c-* token（主声明） */
  --c-bg: #f6f8fa;
  --c-surface: #ffffff;
  --c-surface-lower: #eef0f3;
  --c-border: rgba(0,0,0,.08);
  --c-border-strong: rgba(0,0,0,.13);
  --c-text: #1f2328;
  --c-text-secondary: #656d76;
  --c-text-tertiary: #8c959f;
  --c-accent: #0969da;
  --c-accent-secondary: #0550ae;
  --c-glow: rgba(9,105,218,.10);
  --c-success: #1a7f37;
  --c-warning: #9a6700;
  --c-error: #cf222e;
  --c-tag-bg: rgba(9,105,218,.1);
  --c-badge-public-bg: rgba(26,127,55,.1);
  --c-badge-private-bg: rgba(207,34,46,.1);
  --c-badge-shared-bg: rgba(154,103,0,.1);

  /* 旧 token 别名（向后兼容） */
  --bg-primary: var(--c-bg);
  --bg-secondary: var(--c-surface);
  --bg-tertiary: var(--c-surface-lower);
  --bg-code: var(--c-surface-lower);
  --bg-overlay: rgba(0,0,0,.5);
  --border-color: var(--c-border);
  --border-hover: var(--c-text-tertiary);
  --text-primary: var(--c-text);
  --text-secondary: var(--c-text-secondary);
  --text-tertiary: var(--c-text-tertiary);
  --text-on-accent: #ffffff;
  --accent-color: var(--c-accent);
  --accent-hover: var(--c-accent-secondary);
  --accent-light: var(--c-tag-bg);
  --success-color: var(--c-success);
  --success-bg: var(--c-badge-public-bg);
  --success-text: var(--c-success);
  --success-border: rgba(26,127,55,.3);
  --warning-color: var(--c-warning);
  --warning-bg: var(--c-badge-shared-bg);
  --warning-text: var(--c-warning);
  --warning-border: rgba(154,103,0,.3);
  --error-color: var(--c-error);
  --error-bg: var(--c-badge-private-bg);
  --error-text: var(--c-error);
  --error-border: rgba(207,34,46,.3);
  --tag-bg: var(--c-tag-bg);
  --tag-text: var(--c-accent-secondary);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 3px 6px rgba(0,0,0,.08);
}
```

#### 2.1.4 LandingView 兼容方案（F1）

**问题**：`.stage` 内的 `--c-*` 声明提升到全局后，LandingView 的 scoped style 中 `var(--c-*)` 仍正常工作（CSS 自定义属性继承）。但 `.stage` 内的旧名称（如 `--c-panel`）需替换为规范名称（`--c-surface`）。

**方案**：
1. 删除 LandingView `<style>`（非 scoped）中的 `.stage` 和 `[data-theme="light"] .stage` 规则块（line 238-259）
2. LandingView `<style scoped>` 中所有 token 引用替换为规范名：`var(--c-panel)` → `var(--c-surface)`，`var(--c-panel2)` → `var(--c-surface-lower)`，`var(--c-border2)` → `var(--c-border-strong)`，`var(--c-muted)` → `var(--c-text-secondary)`，`var(--c-faint)` → `var(--c-text-tertiary)`，`var(--c-accent2)` → `var(--c-accent-secondary)`，`var(--glow-color)` → `var(--c-glow)`
3. Landing-only token（`--c-hero-grad`, `--c-cta-grad`, `--pw-*`）移入 `<style scoped>` 内的 `.stage` 选择器下（保持作用域隔离）
4. 验证：提升后 LandingView 视觉与重构前完全一致

**冲突检测**：`.stage` 内只有 Landing-only token 需要局部声明，这些不会与全局 `--c-*` 冲突（不同名）。全局 `--c-*` 在 `.stage` 内自动可用（CSS 继承），无需 `.stage` 重新声明。

### 2.2 共享组件 API 设计

#### 2.2.1 BaseButton

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | DESIGN.md §6 Button 变体 |
| `size` | `'default' \| 'small'` | `'default'` | default=40px, small=34px |
| `disabled` | `boolean` | `false` | opacity 0.5, cursor not-allowed |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | 原生 button type |

| Emits | 参数 | 说明 |
|---|---|---|
| `click` | `MouseEvent` | 透传原生 click |

| Slots | 说明 |
|---|---|
| `default` | 按钮内容（文本 + 可选图标） |

样式规范：
- Primary: `bg: --c-accent; color: #fff; shadow: 0 6px 20px --c-glow; hover: --c-accent-secondary`
- Secondary: `bg: transparent; color: --c-text; border: 1px solid --c-border-strong; hover: bg --c-border, border --c-text-tertiary`
- Ghost: `bg: transparent; color: --c-text; border: 1px solid transparent; hover: bg --c-border`
- Danger: `bg: --c-error; color: #fff; hover: filter: brightness(0.9)`
- Focus ring: `outline: 2px solid --c-accent-secondary; outline-offset: 2px` (F3)
- `prefers-reduced-motion`: 禁用 transform (F5)

#### 2.2.2 BaseTag

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| 无自定义 props | | | 纯展示组件 |

| Slots | 说明 |
|---|---|
| `default` | 标签文本 |

样式：`bg: var(--c-tag-bg); color: var(--c-accent-secondary); radius: 6px; padding: 4px 10px; font: 12px var(--font-mono)`

#### 2.2.3 BaseBadge

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `status` | `'public' \| 'private' \| 'shared'` | `'public'` | DESIGN.md §6 Status Badge |

| Slots | 无 |

样式：
- Public: `bg: var(--c-badge-public-bg); color: var(--c-success)`
- Private: `bg: var(--c-badge-private-bg); color: var(--c-error)`
- Shared: `bg: var(--c-badge-shared-bg); color: var(--c-warning)`
- 通用: `radius: 6px; padding: 4px 10px; font: 12px var(--font-mono)`

#### 2.2.4 SearchInput

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `modelValue` | `string` | `''` | v-model 绑定 |
| `placeholder` | `string` | `'Search...'` | 占位文本 |

| Emits | 参数 | 说明 |
|---|---|---|
| `update:modelValue` | `string` | v-model 更新 |
| `clear` | — | 点击清除按钮 |
| `keydown` | `KeyboardEvent` | 透传键盘事件（Enter/Escape） |

样式：`bg: --c-surface-lower; border: 1px solid --c-border; radius: 8px; padding: 10px 12px 10px 36px; font: 14px; focus: border-color --c-accent, ring 0 0 0 3px --c-glow; placeholder: --c-text-tertiary; left search icon 16px --c-text-tertiary; right clear button when value present`

#### 2.2.5 EmptyState

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `icon` | `string` | `'Inbox'` | Lucide 图标名 |
| `heading` | `string` | — | 标题（20px/600） |
| `description` | `string` | `''` | 描述（14px/--c-text-secondary） |
| `ctaLabel` | `string` | `''` | CTA 按钮文本（为空则不显示） |

| Emits | 参数 | 说明 |
|---|---|---|
| `cta` | — | CTA 按钮点击 |

样式：`centered; max-width: 480px; icon: 48px Lucide --c-text-tertiary; heading: 20px/600; description: 14px --c-text-secondary; CTA: BaseButton primary`

#### 2.2.6 EntryListRow

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `entry` | `Entry` | — | Entry 数据对象 |
| `isOwner` | `boolean` | `false` | 是否为 entry 拥有者（显示操作按钮） |
| `currentUsername` | `string \| null` | `null` | 当前用户名（用于 @me 判断） |

| Emits | 参数 | 说明 |
|---|---|---|
| `navigate` | `Entry` | 点击行导航 |
| `toggleVisibility` | `Entry` | 切换公开/私有 |
| `delete` | `Entry` | 删除 |

| Slots | 说明 |
|---|---|
| `actions` | 自定义操作按钮（覆盖默认 visibility/delete） |

样式：`desktop: grid 1fr auto; mobile(<=640px): stacked; padding: 16px 24px; border-bottom: 1px solid --c-border; hover: bg --c-surface-lower; title: 16px/600; meta: 13px --c-text-tertiary; hover-only actions: visible on touch (F4)`

#### 2.2.7 PageHeader

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | `string` | — | 页面标题（28px/600） |
| `backTo` | `string` | `''` | 返回链接（为空则不显示） |
| `backLabel` | `string` | `'Back'` | 返回链接文本 |

| Emits | 无 |

| Slots | 说明 |
|---|---|
| `meta` | 标题下方的 meta 信息 |
| `actions` | 右侧操作按钮区域 |

样式：`bg: --c-surface; border-bottom: 1px solid --c-border; padding: 0 24px; height: --header-height; display: flex; align-items: center; gap: --space-3`

### 2.3 页面重构方案

#### 2.3.1 EntryListView

**当前状态**：64 处旧 token，纯 card grid 布局，自建搜索框/按钮/空状态/分页。

| 区域 | template 变更 | style 变更 |
|------|--------------|-----------|
| 根容器 | — | `background: var(--c-bg)` |
| Header | SearchInput 替换 `.search-box`; BaseButton ghost 替换 `.btn-login`; 用户下拉菜单保留结构但 token 替换 | 全部 token → `--c-*` |
| Owner tabs | — | token → `--c-*`; active: `color: --c-accent; border-bottom: 2px solid --c-accent` |
| Filter chip | 保留 FilterChip | token 靠别名兼容 |
| Entry grid | EntryListRow 组件替换 `.entry-card` | 删除 `.entry-card` 等旧样式；panel: `bg: --c-surface; border: 1px solid --c-border-strong; radius: 14px` |
| Empty state | EmptyState 组件替换 `.empty` | 删除旧 `.empty` |
| Pagination | 保留 Pagination | token 靠别名兼容 |
| Footer | — | token → `--c-*` |
| Dialogs | 保留 LoginDialog/ConfirmDialog | token 靠别名兼容 |

**关键 D2 处理**：
- `.entry-list { background: var(--bg-primary) }` → `var(--c-bg)` （页面背景）
- `.user-dropdown { background: var(--bg-primary) }` → `var(--c-surface)` （面板背景）
- `.card-action-btn { background: var(--bg-primary) }` → `var(--c-surface)` （按钮背景）

**F4 处理**：`.card-actions` 使用 `@media (hover: hover)` 控制显隐，触控设备始终可见。

#### 2.3.2 EntryDetailView

**当前状态**：17 处旧 token（scoped style）+ 16 处（layout.css），两栏/移动切换逻辑复杂。

| 区域 | template 变更 | style 变更 |
|------|--------------|-----------|
| Header | BaseButton 替换操作按钮（visibility/share/delete/wrap/copy/download/raw/pack） | token → `--c-*` |
| File sidebar | 保留 FileTree | layout.css token → `--c-*` |
| Content area | 保留各 Viewer | layout.css token → `--c-*` |
| TOC sidebar | 保留 TocNav | layout.css token → `--c-*` |
| Mobile actions | BaseButton small 替换按钮 | layout.css token → `--c-*` |
| Drawers | 保留结构 | layout.css token → `--c-*` |
| Zen mode | 不改逻辑 | token → `--c-*` |
| layout.css | — | 所有旧 token → `--c-*`（见 §2.4.2） |

**关键 D2 处理（layout.css）**：
- `.content-area { background: var(--bg-primary) }` → `var(--c-bg)` （内容区=页面级）
- `.drawer { background: var(--bg-primary) }` → `var(--c-surface)` （抽屉=面板）
- `.detail-header { background: var(--bg-secondary) }` → `var(--c-surface)` （header=面板）

#### 2.3.3 ApiKeyListView

**当前状态**：30 处旧 token，自建按钮/对话框/表单。

| 区域 | template 变更 | style 变更 |
|------|--------------|-----------|
| 根容器 | — | `background: var(--c-bg)` |
| Page header | PageHeader 组件 + BaseButton primary | 删除旧 `.page-header` |
| Key list | BaseBadge 替换 expiry 状态 | token → `--c-*`; `.key-card`: `bg: --c-surface; border: --c-border-strong; radius: 14px` |
| Empty state | EmptyState 组件替换 `.empty` | 删除旧 `.empty` |
| Create Key Dialog | 按钮替换为 BaseButton；token 替换；**结构不改** | `dialog bg: --c-surface; radius: 14px; border: --c-border-strong`; input/select token → `--c-*` |
| Revoke button | BaseButton danger small | — |
| Cleanup button | BaseButton secondary | — |
| ConfirmDialog | 保留 | token 靠别名兼容 |

**D2 处理**：
- `.apikey-page { background: var(--bg-primary) }` → `var(--c-bg)`
- `.dialog { background: var(--bg-primary) }` → `var(--c-surface)`
- `.key-card { background: var(--bg-secondary) }` → `var(--c-surface)`

#### 2.3.4 NotFoundView

**当前状态**：6 处旧 token，极简页面。

| 区域 | template 变更 | style 变更 |
|------|--------------|-----------|
| 根容器 | — | `background: var(--c-bg)` |
| 标题 | — | `color: var(--c-text)` |
| 路径 | — | `color: var(--c-text-secondary); font-family: var(--font-mono)` |
| 返回链接 | BaseButton secondary 替换 `.home-link` | 删除旧 `.home-link` |

### 2.4 base.css 与 layout.css 迁移方案

#### 2.4.1 base.css（22 处旧 token）

| 旧用法 | 新用法 | 上下文 |
|---|---|---|
| `html, body { background: var(--bg-primary) }` | `var(--c-bg)` | 页面背景 |
| `html, body { color: var(--text-primary) }` | `var(--c-text)` | 页面文本 |
| Scrollbar track `var(--bg-secondary)` | `var(--c-surface)` | 滚动条轨道 |
| Scrollbar thumb `var(--border-color)` | `var(--c-border)` | 滚动条滑块 |
| Scrollbar thumb border `var(--bg-secondary)` | `var(--c-surface)` | 滚动条边框 |
| Scrollbar thumb hover `var(--border-hover)` | `var(--c-text-tertiary)` | 滚动条 hover |
| `a { color: var(--accent-color) }` | `var(--c-accent)` | 链接色 |
| `.btn { border/bg/color }` | `border: --c-border-strong; bg: transparent; color: --c-text` | 全局按钮 → secondary 风格 |
| `.btn:hover` | `bg: --c-border; border: --c-text-tertiary; color: --c-text` | 按钮 hover |
| `.btn-primary { bg/border: var(--accent-color) }` | `var(--c-accent)` | 主按钮 |
| `.btn-primary:hover { var(--accent-hover) }` | `var(--c-accent-secondary)` | 主按钮 hover |
| `.btn-ghost:hover { var(--bg-tertiary) }` | `var(--c-border)` | Ghost hover |
| `.btn.active { var(--accent-light); var(--accent-color) }` | `bg: --c-tag-bg; color: --c-accent; border: --c-accent` | Active 状态 |

**LandingView 兼容**：LandingView 的 `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-sm` 在 `<style scoped>` 中自定义（line 279-284），会覆盖 base.css 全局 `.btn`。迁移 base.css 后 LandingView 按钮不受影响。但 LandingView scoped 样式内的旧名称也需替换为规范 `--c-*` 名称。

#### 2.4.2 layout.css（16 处旧 token）

| 旧用法 | 新用法 | 上下文 |
|---|---|---|
| `.detail-header { background: var(--bg-secondary) }` | `var(--c-surface)` | Header 面板 |
| `.detail-header { border-bottom: var(--border-color) }` | `var(--c-border)` | Header 边框 |
| `.detail-header .back-btn:hover { background: var(--bg-tertiary) }` | `var(--c-surface-lower)` | 返回按钮 hover |
| `.file-sidebar { border-right: var(--border-color) }` | `var(--c-border)` | 文件树边框 |
| `.content-area { background: var(--bg-primary) }` | `var(--c-bg)` | 内容区背景（D2=页面级） |
| `.toc-sidebar { border-left: var(--border-color) }` | `var(--c-border)` | TOC 边框 |
| `.toc-sidebar { background: var(--bg-secondary) }` | `var(--c-surface)` | TOC 面板 |
| `.mobile-actions { background: var(--bg-secondary) }` | `var(--c-surface)` | 移动端操作栏 |
| `.mobile-actions { border-top: var(--border-color) }` | `var(--c-border)` | 操作栏边框 |
| `.drawer-overlay { background: var(--bg-overlay) }` | `rgba(0,0,0,.5)` | 遮罩 |
| `.drawer { background: var(--bg-primary) }` | `var(--c-surface)` | 抽屉面板（D2=面板） |
| `.drawer-left { border-right: var(--border-color) }` | `var(--c-border)` | 抽屉边框 |
| `.drawer-right { border-left: var(--border-color) }` | `var(--c-border)` | 抽屉边框 |
| `.drawer-header { border-bottom: var(--border-color) }` | `var(--c-border)` | 抽屉 header 边框 |
| `.loading-state/.empty-state { color: var(--text-secondary) }` | `var(--c-text-secondary)` | 状态文本 |
| `.error-state { color: var(--error-color) }` | `var(--c-error)` | 错误文本 |

## 3. 实施顺序

### Phase 1: Token 基础设施

1. `variables.css` — 添加 `--c-*` 全局声明 + 旧 token 别名 + 新增 token
2. `LandingView.vue` — 删除非 scoped `.stage` 规则；scoped 内 token 替换为规范名；Landing-only token 移入 scoped `.stage`
3. `base.css` — 旧 token → `--c-*` 替换
4. `layout.css` — 旧 token → `--c-*` 替换
5. **验证**：`cd frontend-v3 && npx vue-tsc --noEmit` + `make build-frontend` + LandingView 视觉检查

### Phase 2: 共享组件

6. `BaseButton.vue` — 实现 + 单测
7. `BaseTag.vue` — 实现 + 单测
8. `BaseBadge.vue` — 实现 + 单测
9. `SearchInput.vue` — 实现 + 单测
10. `EmptyState.vue` — 实现 + 单测
11. `EntryListRow.vue` — 实现 + 单测
12. `PageHeader.vue` — 实现 + 单测
13. **验证**：`cd frontend-v3 && ./node_modules/.bin/vitest run` + `npx vue-tsc --noEmit`

### Phase 3: 页面重构

14. `NotFoundView.vue` — 最简单，验证组件集成
15. `EntryListView.vue` — 核心：EntryListRow + SearchInput + EmptyState + PageHeader
16. `EntryDetailView.vue` — 最复杂：BaseButton 替换（layout.css 已在 Phase 1 处理）
17. `ApiKeyListView.vue` — PageHeader + BaseBadge + EmptyState + BaseButton + 对话框 token
18. **验证**：每页完成后 `npx vue-tsc --noEmit` + `make build-frontend`

### Phase 4: 清理与最终验证

19. 全页面 dark/light 切换验证
20. 移动端响应式验证（3 断点）
21. 键盘 a11y 验证（focus ring）
22. `prefers-reduced-motion` 验证
23. 旧 token 残留 grep 检查（仅允许 variables.css 中存在别名定义）

## 4. 声明字段

```yaml
packages:
  - peekview (frontend-v3 only)

domains:
  - frontend
  - design-system
  - ui

ui_affected: true
ui_affected_detail:
  - EntryListView.vue (token + 组件替换 + 样式重写)
  - EntryDetailView.vue (token + BaseButton 替换 + 样式重写)
  - ApiKeyListView.vue (token + 组件替换 + 对话框 token)
  - NotFoundView.vue (token + BaseButton 替换)
  - LandingView.vue (token 作用域调整，视觉不变)
  - variables.css (token 全局化 + 别名)
  - base.css (token 迁移)
  - layout.css (token 迁移)
  - 新增 7 个共享组件

gate_commands:
  P5: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P5_vitest: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P5_build: "make build-frontend 2>&1 | tail -20"
  P6: "Playwright screenshots: dark + light + mobile (640px / 1024px / 1440px) for EntryListView, EntryDetailView, ApiKeyListView, NotFoundView, LandingView"

env_constraints:
  debug_env: "make debug (:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认测试数据在 debug DB"

files_to_read:
  - path: frontend-v3/src/styles/variables.css
    why: Token 迁移主文件——添加 --c-* 全局声明 + 旧 token 别名
  - path: frontend-v3/src/styles/base.css
    why: 全局样式 token 迁移（22 处）
  - path: frontend-v3/src/styles/layout.css
    why: EntryDetail 布局 token 迁移（16 处）
  - path: frontend-v3/src/views/LandingView.vue
    why: .stage token 提升 + 规范名替换
  - path: frontend-v3/src/views/EntryListView.vue
    why: 页面重构——EntryListRow + SearchInput + EmptyState + PageHeader 替换
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: 页面重构——BaseButton 替换 + scoped style token 迁移
  - path: frontend-v3/src/views/ApiKeyListView.vue
    why: 页面重构——PageHeader + BaseBadge + EmptyState + BaseButton + 对话框 token
  - path: frontend-v3/src/views/NotFoundView.vue
    why: 页面重构——BaseButton 替换
  - path: frontend-v3/src/components/LoginDialog.vue
    why: 不改但需理解——EntryListView 使用，验证别名兼容
  - path: frontend-v3/src/components/ConfirmDialog.vue
    why: 不改但需理解——EntryListView/EntryDetailView/ApiKeyListView 使用
  - path: frontend-v3/src/components/FileTree.vue
    why: 不改但需理解——EntryDetailView 使用，验证别名兼容
  - path: frontend-v3/src/components/Pagination.vue
    why: 不改但需理解——EntryListView 使用，验证别名兼容
  - path: frontend-v3/src/components/FilterChip.vue
    why: 不改但需理解——EntryListView 使用
  - path: frontend-v3/src/components/BannerBar.vue
    why: 不改但需理解——EntryListView 使用
  - path: frontend-v3/src/components/ThemeToggle.vue
    why: 不改但需理解——EntryListView/EntryDetailView 使用
  - path: frontend-v3/src/types/index.ts
    why: Entry 类型定义——EntryListRow props 需要
  - path: DESIGN.md
    why: 设计规范真相源——组件样式/token 规范

minimal_validation:
  assumption: "CSS 自定义属性从 :root/[data-theme] 继承到 .stage scoped 内正常工作；.stage 内局部声明与全局不冲突（不同名）"
  method: "在 variables.css 添加全局 --c-* 声明后，在 LandingView 保留 .stage 内 Landing-only token，用 Chrome DevTools 检查 computed styles 是否正确"
  result: "not_needed"
  note: "CSS 自定义属性继承是标准行为，无需验证。Landing-only token 与全局 token 不同名，无冲突可能。"

implementation_complete_when:
  - variables.css 包含 --c-* 全局声明 + 旧 token 别名
  - LandingView 无非 scoped .stage 规则块，所有 token 使用规范名
  - base.css 和 layout.css 仅使用 --c-* token
  - 7 个共享组件存在且通过 vitest
  - 4 个页面使用 --c-* token + 共享组件
  - npx vue-tsc --noEmit 退出码 0
  - make build-frontend 成功
  - 旧 token 仅存在于 variables.css 别名定义 + 非 scope 组件 + code.css + markdown.css
  - 所有页面 dark/light 切换视觉正确
  - 所有页面移动端响应式正确
```
