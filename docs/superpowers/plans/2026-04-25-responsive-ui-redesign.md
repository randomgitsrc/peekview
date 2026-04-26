# PeekView 响应式 UI 重新设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 PeekView 前端 UI，修复按钮重复、响应式布局异常、Markdown 样式问题和代码高亮失效。

**Architecture:** 
- EntryDetailView 拆分为响应式布局组件（DesktopLayout + MobileLayout）
- CodeViewer 移除内部按钮，仅作为纯展示组件
- 添加专业 Markdown 样式（文档站风格）
- 修复 Shiki CSS Variables 主题配置

**Tech Stack:** Vue 3 + TypeScript + Vite + Shiki + markdown-it

---

## 文件结构变更

### 新建文件
- `src/styles/markdown.css` - Markdown 文档站风格样式
- `src/components/DesktopLayout.vue` - 桌面端三栏布局
- `src/components/MobileLayout.vue` - 移动端单栏布局
- `src/components/ActionBar.vue` - 统一操作栏组件

### 修改文件
- `src/views/EntryDetailView.vue` - 重构为布局容器
- `src/components/CodeViewer.vue` - 移除内部按钮，修复高亮
- `src/components/MarkdownViewer.vue` - 添加文档站样式
- `src/styles/variables.css` - 添加 Shiki 主题变量
- `src/styles/dark.css` - 深色主题代码高亮
- `src/styles/light.css` - 浅色主题代码高亮

---

## Task 1: 添加 Shiki CSS Variables 主题支持

**Files:**
- Modify: `src/styles/variables.css`
- Modify: `src/styles/dark.css`
- Modify: `src/styles/light.css`

### 1.1: 在 variables.css 添加 Shiki 变量占位

```css
/* Shiki CSS Variables - will be overridden by theme files */
:root {
  --shiki-foreground: var(--text-primary);
  --shiki-background: transparent;
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
  --shiki-token-operator: #ff7b72;
  --shiki-token-class: #ffa657;
  --shiki-token-interface: #ffa657;
  --shiki-token-type: #ffa657;
  --shiki-token-builtin: #79c0ff;
  --shiki-token-annotation: #ff7b72;
  --shiki-token-namespace: #ffa657;
  --shiki-token-symbol: #ffa657;
  --shiki-token-tag: #7ee787;
  --shiki-token-attribute: #79c0ff;
  --shiki-token-deleted: #ffa198;
  --shiki-token-inserted: #7ee787;
}
```

### 1.2: 在 dark.css 添加深色主题 Shiki 变量

```css
/* Dark theme Shiki colors - GitHub Dark */
[data-theme="dark"] {
  --shiki-foreground: var(--text-primary);
  --shiki-background: transparent;
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
  --shiki-token-operator: #ff7b72;
  --shiki-token-class: #ffa657;
  --shiki-token-interface: #ffa657;
  --shiki-token-type: #ffa657;
  --shiki-token-builtin: #79c0ff;
  --shiki-token-annotation: #ff7b72;
  --shiki-token-namespace: #ffa657;
  --shiki-token-symbol: #ffa657;
  --shiki-token-tag: #7ee787;
  --shiki-token-attribute: #79c0ff;
  --shiki-token-deleted: #ffa198;
  --shiki-token-inserted: #7ee787;
}
```

### 1.3: 在 light.css 添加浅色主题 Shiki 变量

```css
/* Light theme Shiki colors - GitHub Light */
[data-theme="light"] {
  --shiki-foreground: var(--text-primary);
  --shiki-background: transparent;
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
  --shiki-token-operator: #cf222e;
  --shiki-token-class: #953800;
  --shiki-token-interface: #953800;
  --shiki-token-type: #953800;
  --shiki-token-builtin: #0550ae;
  --shiki-token-annotation: #cf222e;
  --shiki-token-namespace: #953800;
  --shiki-token-symbol: #953800;
  --shiki-token-tag: #116329;
  --shiki-token-attribute: #0550ae;
  --shiki-token-deleted: #82071e;
  --shiki-token-inserted: #116329;
}
```

### 1.4: 验证主题切换

测试步骤:
1. 在浏览器中打开代码查看页面
2. 切换主题（点击 theme toggle）
3. 验证代码高亮颜色变化
4. 检查 `--shiki-token-*` CSS 变量是否正确应用

**Commit:** `git add src/styles/*.css && git commit -m "feat: add Shiki CSS Variables theme support"`

---

## Task 2: 重构 CodeViewer 组件（移除按钮）

**Files:**
- Modify: `src/components/CodeViewer.vue`

### 2.1: 移除内部按钮，简化为纯展示组件

```vue
<template>
  <div class="code-viewer" ref="container">
    <!-- 仅保留文件名和行数显示 -->
    <div class="code-header">
      <span class="filename">{{ filename }}</span>
      <span class="line-count" v-if="lineCount">{{ lineCount }} lines</span>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="code-loading">
      <div class="code-skeleton" v-for="i in 8" :key="i">
        <span class="skeleton-line-number"></span>
        <span class="skeleton-line-content"></span>
      </div>
    </div>

    <!-- Shiki highlighted code -->
    <div
      v-else-if="highlighted"
      class="code-content"
      :class="{ wrap }"
      v-html="highlighted"
    ></div>

    <!-- Safe fallback -->
    <div v-else class="code-content fallback" :class="{ wrap }">
      <pre><code>{{ content }}</code></pre>
    </div>

    <div v-if="isEmpty" class="empty-file">Empty file</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{
  content: string
  filename: string
  language: string | null
  lineCount: number | null
  wrap: boolean  // 从父组件接收
}>()

const { highlight } = useShiki()

const highlighted = ref('')
const isLoading = ref(true)
const container = ref<HTMLElement>()

const isEmpty = computed(() => props.content.length === 0)

async function doHighlight() {
  if (isEmpty.value) {
    highlighted.value = ''
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    highlighted.value = await highlight(
      props.content,
      props.language || 'text',
    )
  } catch {
    highlighted.value = ''
  } finally {
    isLoading.value = false
  }
}

// Re-highlight when content or language changes
watch(
  () => [props.content, props.language],
  () => doHighlight(),
)

onMounted(doHighlight)

// Line selection from URL hash
onMounted(() => {
  const hash = window.location.hash
  if (hash.startsWith('#L')) {
    const el = document.querySelector(hash)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('line-highlight')
    }
  }
})
</script>
```

### 2.2: 更新 CodeViewer 样式

```vue
<style scoped>
.code-viewer {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: auto;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
}

.code-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-sm);
}

.filename {
  font-weight: 600;
  color: var(--text-primary);
}

.line-count {
  color: var(--text-secondary);
  font-size: var(--font-xs);
}

/* Code content - Shiki output */
.code-content {
  padding: var(--space-3);
  overflow: auto;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
  background: var(--shiki-color-background, var(--bg-secondary));
  flex: 1;
}

.code-content :deep(pre) {
  margin: 0;
  background: transparent !important;
  overflow: visible;
}

.code-content :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: var(--font-sm);
  line-height: var(--line-height-code);
}

/* Ensure Shiki tokens use CSS variables */
.code-content :deep(.shiki) {
  background: transparent !important;
}

.code-content :deep(.shiki code) {
  background: transparent !important;
}

/* Token colors */
.code-content :deep(.token.keyword) { color: var(--shiki-token-keyword); }
.code-content :deep(.token.string) { color: var(--shiki-token-string); }
.code-content :deep(.token.number) { color: var(--shiki-token-number); }
.code-content :deep(.token.comment) { color: var(--shiki-token-comment); }
.code-content :deep(.token.function) { color: var(--shiki-token-function); }
.code-content :deep(.token.class-name) { color: var(--shiki-token-class); }
.code-content :deep(.token.operator) { color: var(--shiki-token-operator); }
.code-content :deep(.token.punctuation) { color: var(--shiki-token-punctuation); }
.code-content :deep(.token.property) { color: var(--shiki-token-property); }
.code-content :deep(.token.variable) { color: var(--shiki-token-variable); }
.code-content :deep(.token.constant) { color: var(--shiki-token-constant); }
.code-content :deep(.token.builtin) { color: var(--shiki-token-builtin); }
.code-content :deep(.token.tag) { color: var(--shiki-token-tag); }
.code-content :deep(.token.attr-name) { color: var(--shiki-token-attribute); }

/* Line highlight for hash selection */
:deep(.line-highlight),
.line-highlight {
  background: var(--accent-subtle);
  border-radius: var(--radius-sm);
}

/* Word wrap */
.code-content.wrap {
  white-space: pre-wrap;
  word-break: break-all;
}

.code-content.wrap :deep(pre) {
  white-space: pre-wrap;
}

/* Fallback styling */
.fallback pre {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
}

.empty-file {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

/* Loading skeleton */
.code-loading {
  padding: var(--space-3);
}

.code-skeleton {
  display: flex;
  gap: var(--space-3);
  padding: 2px 0;
}

.skeleton-line-number {
  width: 30px;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-line-content {
  flex: 1;
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  max-width: 60%;
}
</style>
```

### 2.3: 运行单元测试

```bash
cd /home/kity/lab/projects/peekview/.worktrees/fix-scroll/frontend
npm run test -- CodeViewer
```

期望: 所有测试通过

**Commit:** `git add src/components/CodeViewer.vue && git commit -m "refactor: CodeViewer as pure display component"`

---

## Task 3: 创建 ActionBar 组件（统一操作栏）

**Files:**
- Create: `src/components/ActionBar.vue`

### 3.1: 创建 ActionBar 组件

```vue
<template>
  <div class="action-bar" :class="{ 'is-mobile': isMobile }">
    <!-- Desktop: 水平排列 -->
    <template v-if="!isMobile">
      <button
        v-if="canCopy"
        class="action-btn"
        :class="{ active: copied }"
        @click="copy"
        title="Copy content"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
      </button>

      <button
        v-if="canDownload"
        class="action-btn"
        @click="download"
        title="Download file"
      >
        <Icon icon="codicon:download" />
        <span>Download</span>
      </button>

      <button
        v-if="canWrap"
        class="action-btn"
        :class="{ active: wrap }"
        @click="toggleWrap"
        title="Toggle word wrap"
      >
        <Icon :icon="wrap ? 'codicon:word-wrap' : 'codicon:debug-continue'" />
        <span>{{ wrap ? 'No wrap' : 'Wrap' }}</span>
      </button>

      <ThemeToggle />
    </template>

    <!-- Mobile: 图标 + 文字，垂直堆叠 -->
    <template v-else>
      <button
        v-if="canCopy"
        class="action-btn mobile"
        :class="{ active: copied }"
        @click="copy"
      >
        <Icon :icon="copied ? 'codicon:check' : 'codicon:copy'" />
        <span class="btn-label">{{ copied ? 'Done' : 'Copy' }}</span>
      </button>

      <button
        v-if="canDownload"
        class="action-btn mobile"
        @click="download"
      >
        <Icon icon="codicon:download" />
        <span class="btn-label">Save</span>
      </button>

      <button
        v-if="canWrap"
        class="action-btn mobile"
        :class="{ active: wrap }"
        @click="toggleWrap"
      >
        <Icon :icon="wrap ? 'codicon:word-wrap' : 'codicon:debug-continue'" />
        <span class="btn-label">{{ wrap ? 'Unwrap' : 'Wrap' }}</span>
      </button>

      <button class="action-btn mobile theme" @click="toggleTheme">
        <Icon :icon="isDark ? 'codicon:sun' : 'codicon:moon'" />
        <span class="btn-label">{{ isDark ? 'Light' : 'Dark' }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import ThemeToggle from './ThemeToggle.vue'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  canCopy?: boolean
  canDownload?: boolean
  canWrap?: boolean
  content?: string
  filename?: string
  wrap?: boolean
  isMobile?: boolean
}>()

const emit = defineEmits<{
  copy: []
  download: []
  toggleWrap: []
}>()

const { theme, toggleTheme } = useTheme()
const isDark = computed(() => theme.value === 'dark')

const copied = ref(false)

async function copy() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    emit('copy')
    setTimeout(() => copied.value = false, 2000)
  } catch {
    // Clipboard not available
  }
}

function download() {
  emit('download')
}

function toggleWrap() {
  emit('toggleWrap')
}
</script>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn.active {
  background: var(--accent-light);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

/* Mobile styles */
.action-bar.is-mobile {
  display: flex;
  justify-content: space-around;
  padding: var(--space-2);
  gap: var(--space-1);
}

.action-btn.mobile {
  flex-direction: column;
  padding: var(--space-2);
  min-width: 64px;
  min-height: 56px;
  border: none;
  background: transparent;
  font-size: 10px;
}

.action-btn.mobile:hover {
  background: var(--bg-secondary);
  transform: none;
  box-shadow: none;
}

.action-btn.mobile.active {
  background: var(--accent-light);
}

.btn-label {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-secondary);
}

.action-btn.mobile.active .btn-label {
  color: var(--accent-color);
}
</style>
```

### 3.2: 添加单元测试

```typescript
// src/components/__tests__/ActionBar.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionBar from '../ActionBar.vue'

describe('ActionBar', () => {
  it('renders copy button when canCopy is true', () => {
    const wrapper = mount(ActionBar, {
      props: { canCopy: true, content: 'test' }
    })
    expect(wrapper.find('button').text()).toContain('Copy')
  })

  it('emits toggleWrap when wrap button clicked', async () => {
    const wrapper = mount(ActionBar, {
      props: { canWrap: true, wrap: false }
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('toggleWrap')
  })

  it('renders mobile layout when isMobile is true', () => {
    const wrapper = mount(ActionBar, {
      props: { canCopy: true, isMobile: true }
    })
    expect(wrapper.find('.action-bar').classes()).toContain('is-mobile')
  })
})
```

**Commit:** `git add src/components/ActionBar.vue src/components/__tests__/ActionBar.spec.ts && git commit -m "feat: add ActionBar component for unified action buttons"`

---

## Task 4: 重构 EntryDetailView 响应式布局

**Files:**
- Modify: `src/views/EntryDetailView.vue`

### 4.1: 重构模板结构

```vue
<template>
  <div class="entry-detail-view">
    <!-- 顶部 Header - 桌面端显示完整操作栏 -->
    <header class="detail-header">
      <div class="header-left">
        <router-link to="/" class="back-link">
          <Icon icon="codicon:arrow-left" />
          <span>Back</span>
        </router-link>
      </div>

      <h1 class="entry-title">{{ entry?.summary }}</h1>

      <!-- 桌面端操作栏 -->
      <div class="header-right desktop-only">
        <ActionBar
          :can-copy="canCopy"
          :can-download="canDownload"
          :can-wrap="canWrap"
          :content="fileContent"
          :wrap="wrapCode"
          :is-mobile="false"
          @copy="handleCopy"
          @download="handleDownload"
          @toggle-wrap="wrapCode = !wrapCode"
        />
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="detail-content" v-if="entry">
      <!-- 桌面端三栏布局 -->
      <div class="desktop-layout desktop-only">
        <!-- 左栏：文件树 -->
        <aside v-if="entry.files.length > 1" class="sidebar-left">
          <FileTree
            :files="entry.files"
            :active-file-id="activeFile?.id ?? null"
            @select="selectFile"
          />
        </aside>

        <!-- 中栏：内容 -->
        <main class="content-area">
          <FileDisplay
            :file="activeFile"
            :content="fileContent"
            :loading="fileLoading"
            :error="fileError"
            :wrap="wrapCode"
            @retry="loadFileContent"
          />
        </main>

        <!-- 右栏：TOC -->
        <aside v-if="hasToc" class="sidebar-right">
          <nav class="toc-nav">
            <h3>Outline</h3>
            <ul>
              <li v-for="h in headings" :key="h.id">
                <a :href="`#${h.id}`" @click.prevent="scrollToHeading(h.id)">
                  {{ h.text }}
                </a>
              </li>
            </ul>
          </nav>
        </aside>
      </div>

      <!-- 移动端单栏布局 -->
      <div class="mobile-layout mobile-only">
        <main class="content-area">
          <FileDisplay
            :file="activeFile"
            :content="fileContent"
            :loading="fileLoading"
            :error="fileError"
            :wrap="wrapCode"
            @retry="loadFileContent"
          />
        </main>
      </div>
    </div>

    <!-- 移动端底部操作栏 -->
    <div class="mobile-bottom-bar mobile-only" v-if="entry">
      <ActionBar
        :can-copy="canCopy"
        :can-download="canDownload"
        :can-wrap="canWrap"
        :content="fileContent"
        :wrap="wrapCode"
        :is-mobile="true"
        @copy="handleCopy"
        @download="handleDownload"
        @toggle-wrap="wrapCode = !wrapCode"
      />
    </div>
  </div>
</template>
```

### 4.2: 添加响应式 CSS

```vue
<style scoped>
.entry-detail-view {
  min-height: 100vh;
  background: var(--bg-primary);
}

/* Header */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  flex-shrink: 0;
}

.back-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-color);
  text-decoration: none;
  font-size: var(--font-sm);
}

.entry-title {
  flex: 1;
  margin: 0 var(--space-4);
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  flex-shrink: 0;
}

/* Content Layout */
.detail-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-4);
}

/* Desktop Layout */
.desktop-layout {
  display: grid;
  grid-template-columns: 260px 1fr 220px;
  gap: var(--space-4);
  min-height: calc(100vh - 200px);
}

.sidebar-left {
  border-right: 1px solid var(--border-color);
  padding-right: var(--space-3);
}

.sidebar-right {
  border-left: 1px solid var(--border-color);
  padding-left: var(--space-3);
}

.content-area {
  min-width: 0;
}

/* Mobile Layout */
.mobile-layout {
  display: block;
}

.mobile-layout .content-area {
  margin-bottom: calc(80px + env(safe-area-inset-bottom));
}

/* Mobile Bottom Bar */
.mobile-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}

/* Responsive Breakpoints */
@media (min-width: 1024px) {
  .desktop-only {
    display: flex;
  }
  .mobile-only {
    display: none;
  }
}

@media (max-width: 1023px) {
  .desktop-only {
    display: none !important;
  }
  .mobile-only {
    display: block;
  }

  .detail-header {
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .entry-title {
    order: 3;
    width: 100%;
    margin: var(--space-2) 0 0 0;
    text-align: left;
    font-size: var(--font-md);
  }

  .mobile-bottom-bar .action-bar {
    display: flex;
    justify-content: space-around;
    height: 100%;
    padding: var(--space-2) var(--space-4);
  }
}
</style>
```

### 4.3: 更新脚本部分

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useEntry } from '../composables/useEntry'
import FileTree from '../components/FileTree.vue'
import FileDisplay from '../components/FileDisplay.vue'
import ActionBar from '../components/ActionBar.vue'
import { api } from '../api/client'

const route = useRoute()
const { entry, loading, fetchEntry } = useEntry()

const activeFile = ref<FileResponse | null>(null)
const fileContent = ref('')
const fileLoading = ref(false)
const fileError = ref<string | null>(null)
const wrapCode = ref(false)
const headings = ref<Array<{id: string, text: string, level: number}>>([])

const canCopy = computed(() => activeFile.value && !activeFile.value.is_binary)
const canDownload = computed(() => !!activeFile.value)
const canWrap = computed(() => activeFile.value && !activeFile.value.is_binary && activeFile.value.language !== 'markdown')
const hasToc = computed(() => headings.value.length > 0)

// ... 其他逻辑保持不变
</script>
```

**Commit:** `git add src/views/EntryDetailView.vue && git commit -m "refactor: responsive layout with desktop/mobile switching"`

---

## Task 5: 创建 Markdown 文档站样式

**Files:**
- Create: `src/styles/markdown.css`

### 5.1: 创建 markdown.css

```css
/* Markdown Document Style - Inspired by VitePress/Docusaurus */

.markdown-body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-primary);
  max-width: 75ch;
  margin: 0 auto;
  padding: var(--space-4);
}

/* Typography */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 2em;
  margin-bottom: 0.8em;
  color: var(--text-primary);
  position: relative;
}

.markdown-body h1 {
  font-size: 2rem;
  padding-bottom: 0.5em;
  border-bottom: 1px solid var(--border-color);
  margin-top: 0;
}

.markdown-body h2 {
  font-size: 1.5rem;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-body h3 {
  font-size: 1.25rem;
}

.markdown-body h4 {
  font-size: 1.125rem;
}

/* Anchor links */
.markdown-body h1:hover .header-anchor,
.markdown-body h2:hover .header-anchor,
.markdown-body h3:hover .header-anchor {
  opacity: 1;
}

.markdown-body .header-anchor {
  float: left;
  margin-left: -0.87em;
  padding-right: 0.23em;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.2s;
  text-decoration: none;
  color: var(--accent-color);
}

/* Paragraphs */
.markdown-body p {
  margin-bottom: 1.25em;
  overflow-wrap: break-word;
}

/* Lists */
.markdown-body ul,
.markdown-body ol {
  padding-left: 1.25em;
  margin-bottom: 1.25em;
}

.markdown-body li {
  margin-bottom: 0.5em;
}

.markdown-body li > p {
  margin-bottom: 0.5em;
}

.markdown-body ul ul,
.markdown-body ol ol,
.markdown-body ul ol,
.markdown-body ol ul {
  margin-top: 0.5em;
}

/* Blockquotes */
.markdown-body blockquote {
  margin: 1.5em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--accent-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-style: italic;
}

.markdown-body blockquote p {
  margin: 0;
}

/* Code */
.markdown-body code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
  font-size: 0.875em;
  background: var(--bg-secondary);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}

.markdown-body pre {
  margin: 1.5em 0;
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow-x: auto;
  position: relative;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.7;
  display: block;
}

/* Copy button on code blocks */
.markdown-body .code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border-bottom: 1px solid var(--border-color);
}

.markdown-body .code-block-lang {
  font-size: var(--font-xs);
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.markdown-body .code-copy-btn {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-xs);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.markdown-body .code-copy-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* Tables */
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  display: block;
  overflow-x: auto;
}

.markdown-body th,
.markdown-body td {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  text-align: left;
}

.markdown-body th {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-body tr:nth-child(even) {
  background: var(--bg-secondary);
}

/* Links */
.markdown-body a {
  color: var(--accent-color);
  text-decoration: none;
  transition: opacity 0.15s;
}

.markdown-body a:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* Images */
.markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 1.5em 0;
}

/* Horizontal rules */
.markdown-body hr {
  border: 0;
  border-top: 1px solid var(--border-color);
  margin: 2em 0;
}

/* Task lists */
.markdown-body input[type="checkbox"] {
  margin-right: 0.5em;
}

/* Dark mode adjustments */
[data-theme="dark"] .markdown-body {
  color: var(--text-primary);
}

[data-theme="dark"] .markdown-body blockquote {
  background: rgba(255, 255, 255, 0.03);
}
```

### 5.2: 在 main.ts 中导入 markdown.css

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import './styles/dark.css'
import './styles/light.css'
import './styles/markdown.css'  // 添加

createApp(App).use(router).mount('#app')
```

**Commit:** `git add src/styles/markdown.css src/main.ts && git commit -m "feat: add document-style markdown CSS"`

---

## Task 6: 更新 MarkdownViewer 组件

**Files:**
- Modify: `src/components/MarkdownViewer.vue`

### 6.1: 应用文档站样式

```vue
<template>
  <div class="markdown-viewer markdown-body" ref="viewerRef" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import sanitizeHtml from 'sanitize-html'
import { useShiki } from '../composables/useShiki'

const props = defineProps<{ content: string }>()

const emit = defineEmits<{
  headings: [{ id: string; text: string; level: number }[]]
}>()

const viewerRef = ref<HTMLElement | null>(null)

interface Heading {
  id: string
  text: string
  level: number
}

// markdown-it instance with anchor plugin
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

md.use(anchor, {
  permalink: anchor.permalink.headerLink({
    safariReaderFix: false,
    class: 'header-anchor',
    symbol: '#',
  }),
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''),
})

const { highlight } = useShiki()

function extractHeadings(html: string): Heading[] {
  const result: Heading[] = []
  const regex = /<h([2-4])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    result.push({ id, text, level })
  }
  return result
}

const rendered = computed(() => {
  const html = md.render(props.content)

  const sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'button', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      a: ['href', 'id', 'name', 'class'],
      h1: ['id', 'class'],
      h2: ['id', 'class'],
      h3: ['id', 'class'],
      h4: ['id', 'class'],
      span: ['class'],
      button: ['class', 'aria-label', 'data-code-index'],
      code: ['class', 'language-*'],
      pre: ['class'],
    },
  })

  nextTick(() => {
    const headings = extractHeadings(sanitized)
    emit('headings', headings)
  })

  return sanitized
})

// Highlight code blocks
watch(rendered, () => {
  nextTick(async () => {
    if (!viewerRef.value) return

    const codeBlocks = viewerRef.value.querySelectorAll('pre code')
    for (const block of codeBlocks) {
      const code = block.textContent || ''
      const langClass = block.className.match(/language-(\w+)/)
      const lang = langClass ? langClass[1] : 'text'

      try {
        const highlightedHtml = await highlight(code, lang)
        const pre = block.parentElement
        if (pre) {
          pre.innerHTML = highlightedHtml
        }
      } catch {
        // Keep original
      }
    }
  })
})
</script>

<style scoped>
.markdown-viewer {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  padding: var(--space-4);
}
</style>
```

**Commit:** `git add src/components/MarkdownViewer.vue && git commit -m "refactor: MarkdownViewer with document styles"`

---

## Task 7: 响应式 CSS 修复和验证

**Files:**
- Modify: `src/App.vue`
- Modify: `src/views/EntryDetailView.vue`

### 7.1: 验证响应式断点

```css
/* App.vue - 确保响应式基础 */
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* EntryDetailView - 响应式断点 */
@media (min-width: 1024px) {
  /* Desktop: 显示三栏布局 */
}

@media (min-width: 768px) and (max-width: 1023px) {
  /* Tablet: 简化布局 */
}

@media (max-width: 767px) {
  /* Mobile: 单栏 + 底部栏 */
}
```

### 7.2: 运行响应式测试

```bash
cd /home/kity/lab/projects/peekview/.worktrees/fix-scroll/frontend
npx playwright test e2e/responsive.spec.ts --project="Mobile Chrome"
```

期望: 所有响应式测试通过

**Commit:** `git add src/App.vue && git commit -m "fix: responsive breakpoints and layout"`

---

## Task 8: 编写 E2E 测试

**Files:**
- Create: `e2e/responsive.spec.ts`

### 8.1: 响应式测试

```typescript
import { test, expect } from '@playwright/test'

test.describe('Responsive Layout', () => {
  test('desktop shows three-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/multi-file-entry')
    
    // 验证三栏布局
    await expect(page.locator('.sidebar-left')).toBeVisible()
    await expect(page.locator('.content-area')).toBeVisible()
    await expect(page.locator('.sidebar-right')).toBeVisible()
    
    // 验证顶部操作栏
    await expect(page.locator('.header-right')).toBeVisible()
  })

  test('mobile shows single column with bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/multi-file-entry')
    
    // 验证侧边栏隐藏
    await expect(page.locator('.sidebar-left')).toBeHidden()
    await expect(page.locator('.sidebar-right')).toBeHidden()
    
    // 验证底部栏
    await expect(page.locator('.mobile-bottom-bar')).toBeVisible()
  })

  test('buttons work on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/code-entry')
    
    // 点击 Wrap 按钮
    await page.locator('.header-right .action-btn', { hasText: 'Wrap' }).click()
    
    // 验证代码区域有 wrap class
    await expect(page.locator('.code-content')).toHaveClass(/wrap/)
  })

  test('buttons work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/code-entry')
    
    // 点击底部栏 Wrap 按钮
    const wrapBtn = page.locator('.mobile-bottom-bar .action-btn', { hasText: 'Wrap' })
    await expect(wrapBtn).toBeVisible()
    await wrapBtn.click()
    
    // 验证代码区域有 wrap class
    await expect(page.locator('.code-content')).toHaveClass(/wrap/)
  })
})
```

### 8.2: 运行 E2E 测试

```bash
cd /home/kity/lab/projects/peekview/.worktrees/fix-scroll/frontend
npm run test:e2e
```

期望: 所有 E2E 测试通过

**Commit:** `git add e2e/responsive.spec.ts && git commit -m "test: add responsive layout E2E tests"`

---

## Task 9: 最终验证和回归测试

### 9.1: 构建验证

```bash
cd /home/kity/lab/projects/peekview/.worktrees/fix-scroll/frontend
npm run build
npm run type-check
```

期望: 构建成功，无 TypeScript 错误

### 9.2: 单元测试

```bash
npm run test
```

期望: 所有单元测试通过

### 9.3: E2E 回归测试

```bash
npm run test:e2e
```

期望: 所有 E2E 测试通过

### 9.4: 视觉检查

手动检查:
1. 桌面端三栏布局正常
2. 移动端单栏 + 底部栏正常
3. 按钮无重复
4. Markdown 渲染美观
5. 代码高亮显示彩色

**Commit:** `git commit -m "chore: final verification and regression testing"`

---

## 完成标准

### 功能验收
- [ ] 桌面端显示三栏布局（文件树-内容-TOC）
- [ ] 移动端显示单栏布局 + 底部操作栏
- [ ] Copy/Download/Wrap/Theme 按钮位置正确，无重复
- [ ] 代码语法高亮显示彩色（深色/浅色主题）
- [ ] Markdown 渲染美观（文档站风格）
- [ ] 按钮功能正常（复制、下载、换行、主题切换）

### 体验验收
- [ ] 响应式断点正确（1024px/768px）
- [ ] 移动端底部栏不遮挡内容
- [ ] 触摸目标大小适当（最小 44px）
- [ ] 动画流畅（60fps）

### 测试验收
- [ ] 单元测试通过率 100%
- [ ] E2E 测试通过率 100%
- [ ] 构建无警告/错误
