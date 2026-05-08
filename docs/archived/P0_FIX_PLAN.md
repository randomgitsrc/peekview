# P0 问题修复计划

> **版本**: v1.0  
> **日期**: 2026-04-25  
> **总工时**: 4.5小时  
> **优先级**: Phase 1 (P0) > Phase 2 (P1) > Phase 3 (P1)

---

## 📋 问题分析

### 根因总结

根据 694 次测试执行分析，主要问题集中在：

| 类别 | 问题数 | 根因 | 影响 |
|------|--------|------|------|
| 滚动功能 | 9 | CSS overflow 配置错误 | 🔴 阻塞使用 |
| 样式规范 | 11 | 设计实现偏差 | 🟡 视觉问题 |
| 响应式 | 7 | 移动端适配不完整 | 🟡 体验问题 |

---

## 🔴 Phase 1: 滚动功能修复 (2小时)

**优先级**: P0 (阻塞发布)  
**状态**: 🔄 Task #3

### 问题清单

| ID | 描述 | 文件 | 修复方案 |
|----|------|------|----------|
| SCROLL-01 | 页面不可滚动 | App.vue | 添加 `overflow-y: auto` |
| SCROLL-CODE-01 | 代码区不可垂直滚动 | CodeViewer.vue | 添加 `overflow-y: auto` 和 `max-height` |
| SCROLL-CODE-02 | 代码区不可水平滚动 | CodeViewer.vue | 修复 `overflow-x: auto` 已存在，检查容器 |
| SCROLL-CODE-03 | 行号未固定 | CodeViewer.vue | 添加 `position: sticky; left: 0` |
| SCROLL-MD-01 | Markdown区不可滚动 | MarkdownViewer.vue | 添加 `overflow-y: auto` 和 `max-height` |
| SCROLL-MD-02 | TOC点击不跳转 | EntryDetailView.vue | 检查 `scrollToHeading` 实现 |
| SCROLL-PERF-01 | 滚动事件监听缺失 | CodeViewer/MarkdownViewer | 添加滚动事件监听 |
| SCROLL-MOBILE-01 | 移动端不可滚动 | App.vue/EntryDetailView.vue | 修复 mobile viewport 和 overflow |
| SCROLL-MOBILE-03 | 平滑滚动失效 | 全局 | 添加 `scroll-behavior: smooth` |

### 具体修复步骤

#### 1.1 App.vue - 页面整体滚动

```vue
<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow-y: auto; /* 添加 */
}
</style>
```

#### 1.2 CodeViewer.vue - 代码区滚动

```vue
<style scoped>
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex; /* 添加 */
  flex-direction: column; /* 添加 */
  max-height: calc(100vh - 200px); /* 添加 */
}

.code-content {
  padding: var(--space-3);
  overflow: auto; /* 修改: auto 代替 overflow-x: auto */
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
  background: var(--shiki-color-background, var(--bg-secondary));
  flex: 1; /* 添加 */
}

/* 行号固定 */
.line-number,
.code-content :deep(.line-number) {
  position: sticky; /* 添加 */
  left: 0; /* 添加 */
  background: inherit; /* 添加 */
  z-index: 1; /* 添加 */
}
</style>
```

#### 1.3 MarkdownViewer.vue - Markdown区滚动

```vue
<style scoped>
.markdown-viewer {
  padding: var(--space-4);
  line-height: var(--line-height-prose);
  color: var(--text-primary);
  overflow: auto; /* 修改: auto 代替 overflow-wrap */
  max-height: calc(100vh - 200px); /* 添加 */
  word-wrap: break-word;
  hyphens: auto;
}
</style>
```

#### 1.4 EntryDetailView.vue - 布局调整

```vue
<style scoped>
.entry-content {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  max-height: calc(100vh - 150px); /* 添加 */
}

/* TOC 点击滚动修复 */
function scrollToHeading(headingId: string) {
  const element = document.getElementById(headingId)
  if (element) {
    // 使用 scrollIntoView 确保可见
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // 更新 URL hash
    history.pushState(null, '', `#${headingId}`)
  }
}
</style>
```

---

## 🟡 Phase 2: 样式规范修复 (1.5小时)

**优先级**: P1 (建议发布前完成)  
**状态**: ⬜ Task #1

### 问题清单

| ID | 描述 | 当前值 | 期望值 | 文件 |
|----|------|--------|--------|------|
| STYLE-S-04 | Header高度 | 37px | 56px | EntryDetailView.vue |
| STYLE-C-03 | 默认暗色主题 | 亮色 | 暗色 | useTheme.ts |
| STYLE-I-04 | 图标按钮缺失 | 2/5 | 5/5 | EntryDetailView.vue |
| RESP-D-01 | Header未固定 | static | sticky | EntryDetailView.vue |
| THEME-04 | 主题持久化 | None | 有值 | useTheme.ts |
| STYLE-C-02 | Primary hover色 | - | #2563EB | variables.css |
| STYLE-C-06 | Secondary背景 | - | #161B22 | dark.css |
| STYLE-SH-01 | 按钮阴影 | none | 有阴影 | variables.css |
| STYLE-SH-03 | Drawer阴影 | none | 有阴影 | MobileFileDrawer.vue |
| INTER-H-02 | 按钮hover效果 | none | translateY | 全局 |
| INTER-C-03 | 点击过渡 | - | 150ms | 全局 |

### 具体修复步骤

#### 2.1 Header 高度和固定

```vue
<!-- EntryDetailView.vue -->
<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  height: 56px; /* 修改: 37px -> 56px */
  position: sticky; /* 添加 */
  top: 0; /* 添加 */
  z-index: 10; /* 添加 */
  background: var(--bg-primary); /* 添加 */
}
</style>
```

#### 2.2 默认暗色主题

```typescript
// useTheme.ts
export function useTheme() {
  // 默认使用暗色主题
  const theme = ref<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'dark')
  
  // 如果没有保存过主题，检查系统偏好
  if (!localStorage.getItem('theme')) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.value = prefersDark ? 'dark' : 'dark' // 默认暗色
    localStorage.setItem('theme', theme.value)
  }
}
```

#### 2.3 添加图标按钮

```vue
<!-- EntryDetailView.vue -->
<template>
  <div class="header-actions">
    <button
      v-if="activeFile && !activeFile.is_binary"
      class="header-btn"
      @click="copyContent"
    >
      <Icon icon="codicon:copy" /> <!-- 添加图标 -->
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
    <button
      v-if="activeFile"
      class="header-btn"
      @click="downloadFile"
    >
      <Icon icon="codicon:download" /> <!-- 添加图标 -->
      Download
    </button>
    <ThemeToggle />
  </div>
</template>
```

#### 2.4 按钮阴影和hover效果

```css
/* variables.css */
:root {
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --transition-fast: 150ms ease;
}

/* 全局按钮样式 */
button {
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

---

## 🟡 Phase 3: 响应式修复 (1小时)

**优先级**: P1  
**状态**: ⬜ Task #2

### 问题清单

| ID | 描述 | 当前值 | 期望值 | 文件 |
|----|------|--------|--------|------|
| RESP-M-01 | 移动端内容宽度 | 726px | 100% | EntryDetailView.vue |
| RESP-M-05 | 底部安全区 | 0px | ≥56px | MobileBottomBar.vue |
| RESP-M-11 | 触摸目标 | 5/7<44px | 全部≥44px | MobileBottomBar.vue |
| INTER-A-03 | Drawer动画 | 58ms | 200ms | MobileFileDrawer.vue |
| RESP-M-08 | Drawer高度 | 100% | ~70% | MobileFileDrawer.vue |
| STYLE-SH-03 | Drawer阴影 | none | 有阴影 | MobileFileDrawer.vue |
| RESP-M-04 | iOS安全区 | 0px | env(safe-area) | 全局 |

### 具体修复步骤

#### 3.1 移动端内容宽度

```vue
<!-- EntryDetailView.vue -->
<style scoped>
@media (max-width: 768px) {
  .entry-detail-view {
    padding: var(--space-3);
    padding-bottom: 72px;
    max-width: 100%; /* 添加 */
    width: 100%; /* 添加 */
    margin: 0; /* 添加 */
  }
}
</style>
```

#### 3.2 移动端底部栏

```vue
<!-- MobileBottomBar.vue -->
<style scoped>
.mobile-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px; /* 确保 ≥44px */
  padding-bottom: env(safe-area-inset-bottom); /* iOS安全区 */
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
}

.bottom-bar-btn {
  min-width: 44px; /* 触摸目标 */
  min-height: 44px;
  padding: var(--space-2);
}
</style>
```

#### 3.3 Drawer 动画和样式

```vue
<!-- MobileFileDrawer.vue -->
<style scoped>
.drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70vh; /* 70% 视口高度 */
  background: var(--bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15); /* 阴影 */
  transform: translateY(100%);
  transition: transform 200ms ease-out; /* 200ms 动画 */
  z-index: 200;
}

.drawer.is-open {
  transform: translateY(0);
}
</style>
```

#### 3.4 iOS安全区全局设置

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

```css
/* 全局安全区适配 */
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
  --safe-area-right: env(safe-area-inset-right);
}
```

---

## ✅ 修复验证清单

每个问题修复后需要验证：

- [ ] 修改对应文件
- [ ] 运行 `npm run build` 构建成功
- [ ] 运行 `npm run test` 前端测试通过
- [ ] 手动验证修复效果
- [ ] 更新测试报告状态

---

## 📊 进度跟踪

| 阶段 | 任务 | 工时 | 状态 | 完成问题数 |
|------|------|------|------|------------|
| Phase 1 | Task #3 | 2h | 🔄 待开始 | 0/9 |
| Phase 2 | Task #1 | 1.5h | ⬜ 未开始 | 0/11 |
| Phase 3 | Task #2 | 1h | ⬜ 未开始 | 0/7 |
| **总计** | - | **4.5h** | - | **0/27** |

---

## 🚀 发布建议

| 阶段完成后 | 状态 | 建议 |
|------------|------|------|
| Phase 1 | 核心功能可用 | Beta 发布 |
| Phase 1+2 | 桌面端完整 | 桌面端正式发布 |
| Phase 1+2+3 | 全平台完整 | 全平台正式发布 |
