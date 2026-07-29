---
phase: P2
task_id: T076-entry-card-interaction
type: design
parent: P1-requirements.md
trace_id: T076-P2-20260730
status: draft
created: 2026-07-30
agent: architect
---

## 影响域分析

### 改什么

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/components/BaseTag.vue` | 新增可选 `href` prop；有 href 时渲染 `<a>`，无 href 时保持 `<span>`（向后兼容） |
| `frontend-v3/src/components/EntryCard.vue` | card-body `<a>` → `<div>`；title `<h3>` → `<a>`；username `<span>` → `<a>`；BaseTag 传 href；tag-overflow 加 tooltip；移除 `navigate` emit |
| `frontend-v3/src/components/EntryListRow.vue` | 整行 `<a>` → `<div>`；title → `<a>`；username → `<a>`；BaseTag 传 href；tag-overflow 加 tooltip + TAG_LIMIT 截断；移除 `navigate` emit |
| `frontend-v3/src/views/EntryListView.vue` | 新增 `currentTags` ref；restoreFromURL 读 tags；loadEntries 传 tags；toolbar 显示 tag FilterChips（可移除）；移除 `@navigate` 监听 |
| `frontend-v3/src/views/searchUrl.logic.ts` | `parseRestoreQuery` 返回值增加 `tags: string[]` 字段 |
| `frontend-v3/src/components/__tests__/BaseTag.spec.ts` | 更新：有 href 时渲染 `<a>`，无 href 时渲染 `<span>` |
| `frontend-v3/src/components/__tests__/EntryListRow.spec.ts` | 更新：适配新结构 |
| `frontend-v3/e2e/entry-card-interaction.spec.ts` | 新增 E2E spec 覆盖 BDD-01~21 |

### 不改什么

- `frontend-v3/src/api/client.ts`：`listEntries` 已支持 `tags` 参数（:111）
- `frontend-v3/src/types/index.ts`：`ListEntriesParams` 已有 `tags?: string[]`（:53）
- `frontend-v3/src/stores/entry.ts`：`loadEntries` 透传 params，无需改
- `frontend-v3/src/router.ts`：路由定义不变
- 后端任何文件
- `FilterChip.vue`：直接复用，不改

### 风险在哪

- card-body 从 `<a>` 变 `<div>` 后，`navigateToEntry` 的 firstFileId query 逻辑需迁移到 title `<a>` 的 href 中（或 `@click.prevent` + `router.push`）
- EntryListRow 当前无 TAG_LIMIT（显示全部 tags），加截断后需确认行高一致
- `@navigate` emit 移除后，EntryListView 的 `navigateToEntry` 函数变为死代码，需清理

## §1 候选方案

### 方案 A：BaseTag 多态渲染 + 原生 `<a>` 链接（推荐）

BaseTag 新增可选 `href` prop：有值时渲染 `<a :href="href">`，无值时保持 `<span>`。EntryCard/EntryListRow 中 title 和 username 也改为原生 `<a>`（非 router-link），通过 `@click.prevent` + `router.push` 实现 SPA 导航，同时保留真实 href 供右键复制链接。

tag-overflow tooltip：CSS-only，`<span tabindex="0" :data-tags="allTags.join(', ')">` + `::after { content: attr(data-tags) }`，通过 `:hover` 和 `:focus` 触发显示。移动端 tap 触发 focus 显示 tooltip。

权衡：
- 优点：原生 `<a>` 天然支持右键复制链接（BDD-04/05）、Tab 聚焦（BDD-20）、屏幕阅读器语义；BaseTag 向后兼容（无 href 时不变）；CSS tooltip 零 JS 依赖
- 缺点：`@click.prevent` + `router.push` 比 `<router-link>` 多几行代码；CSS tooltip 样式定制受限（单行，无交互）
- 工作量：~4h

### 方案 B：BaseTag emit 事件 + JS tooltip 组件

BaseTag 保持 `<span>`，新增 `clickable` prop + `@click` emit。父组件在 BaseTag 外包 `<a>` 或监听事件后 `router.push`。tag-overflow 用 JS 组件（teleport popover）实现 tooltip。

权衡：
- 优点：BaseTag 职责单一（纯展示）；JS tooltip 可定制（多行、可交互、动画）
- 缺点：BaseTag 外包 `<a>` 增加嵌套；右键复制链接需额外处理（`<a>` 在 BaseTag 外层，href 需手动设置）；JS tooltip 增加组件数量和测试负担；移动端需额外处理 click-outside 关闭
- 工作量：~6h

### 选择理由

选方案 A。核心取舍：BDD-04/05（右键复制链接）和 BDD-20（键盘聚焦）要求真实 `<a>` 元素，方案 B 的 `<span>` + emit 无法原生支持这些浏览器行为，需要额外 hack。方案 A 用原生语义元素直接满足，代码量更少，无新组件引入。CSS tooltip 对 tag 列表（纯文本、短内容）足够。

## 设计细节

### BaseTag 改造

```vue
<template>
  <a v-if="href" class="base-tag" :href="href" @click.prevent="$emit('navigate', href)">
    <slot />
  </a>
  <span v-else class="base-tag"><slot /></span>
</template>
```

- `href` prop: `string | undefined`，默认 undefined
- `navigate` emit: 传 href，父组件 `router.push`
- 样式：`a.base-tag` 增加 `text-decoration: none; cursor: pointer;` + `:hover { text-decoration: underline }` + `:focus-visible { outline: 2px solid var(--c-accent-secondary); outline-offset: 2px; border-radius: 6px; }`

### EntryCard 结构

```html
<div class="card-body">
  <a class="card-title" :href="'/' + entry.slug" @click.prevent="navigateToEntry">
    {{ entry.summary || entry.slug }}
  </a>
  <div class="card-meta-text">
    <a v-if="entry.username" class="meta-username" :href="'/users/' + entry.username"
       @click.prevent="navigateToUser">@{{ entry.username }}</a>
    <span class="meta-sep"> · </span>
    <span class="meta-time">{{ relativeTime }}</span>
    ...
  </div>
  <div v-if="entry.tags.length" class="card-tags">
    <BaseTag v-for="tag in visibleTags" :key="tag"
             :href="'/explore?tags=' + encodeURIComponent(tag)"
             @navigate="navigateToTag">{{ tag }}</BaseTag>
    <span v-if="remainingTagCount > 0" class="tag-overflow"
          tabindex="0" :data-tags="entry.tags.join(', ')">+{{ remainingTagCount }}</span>
  </div>
  <div class="card-footer">...</div>
</div>
```

- `navigateToEntry`：保留 firstFileId query 逻辑（从 EntryListView 迁入组件内部）
- `navigateToTag`：`router.push(href)`
- 移除 `navigate` emit（父组件不再需要）
- card-body 移除 `cursor: pointer`（只有链接区域有手型）

### EntryListRow 结构

同 EntryCard 模式。额外改动：
- 加入 `TAG_LIMIT = 3`（与 EntryCard 一致）
- 整行 `<a>` → `<div class="entry-list-row">`
- 行 hover 背景保持（CSS 在 `.entry-list-row:hover` 上，不依赖 `<a>`）

### tag-overflow tooltip（CSS-only）

```css
.tag-overflow {
  position: relative;
  cursor: default;
}
.tag-overflow::after {
  content: attr(data-tags);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}
.tag-overflow:hover::after,
.tag-overflow:focus::after {
  opacity: 1;
}
```

- `tabindex="0"` 使移动端 tap 触发 `:focus` 显示 tooltip
- `:focus-visible` outline 提供键盘焦点指示

### EntryListView tag 过滤

1. `restoreFromURL`：从 URL 读 `tags` 参数（逗号分隔），设 `currentTags` ref
2. `loadEntries` 调用：传 `tags: currentTags.value.length ? currentTags.value : undefined`
3. toolbar 显示：`<FilterChip v-for="tag in currentTags" :label="tag" @dismiss="removeTag(tag)" />`
4. `removeTag`：从 `currentTags` 移除 → `updateURL({ tags: remaining.join(',') || undefined })` → reload
5. `onBeforeRouteUpdate`：同步 `tags` 参数
6. `parseRestoreQuery` 扩展：返回 `tags: string[]`

### focus 样式（全局）

所有新增 `<a>` 元素统一：
```css
:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}
```

### navigate emit 清理

- EntryCard/EntryListRow 移除 `navigate` emit 定义
- EntryListView 移除 `@navigate="navigateToEntry"` 绑定
- `navigateToEntry` 函数迁移到 EntryCard/EntryListRow 内部（保留 firstFileId 逻辑）

## 四字段

packages: [frontend-v3]
domains: [frontend]
ui_affected: true

gate_commands:
  P5: "make typecheck && make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/entry-card-interaction.spec.ts make debug-test"

## env_constraints

env_constraints:
  debug_env: "make debug-start（:8888，隔离 DB /tmp/peekview-debug/）+ make debug-seed（alice/bob/carol + 12 条目含多 tag）"
  isolation_check: "E2E beforeAll 检查 BASE_URL 不含 :8080/prod；make debug-verify-isolation 或 sqlite3 /tmp/peekview-debug/peekview.db 手动查"

## files_to_read

files_to_read:
  - path: frontend-v3/src/components/EntryCard.vue
    why: 主改动文件，理解当前 card-body `<a>` 结构和 CSS
  - path: frontend-v3/src/components/EntryListRow.vue
    why: 同步改动，理解整行 `<a>` 结构
  - path: frontend-v3/src/components/BaseTag.vue
    why: 改造为多态渲染（href prop）
  - path: frontend-v3/src/views/EntryListView.vue:234-542
    why: script 部分，理解 loadEntries/updateURL/restoreFromURL/onBeforeRouteUpdate 模式
  - path: frontend-v3/src/views/searchUrl.logic.ts
    why: 扩展 parseRestoreQuery 增加 tags 字段
  - path: frontend-v3/src/components/FilterChip.vue
    why: 复用现有 chip 组件显示 tag 过滤指示
  - path: frontend-v3/src/components/__tests__/BaseTag.spec.ts
    why: 需更新测试适配 `<a>` 渲染
  - path: frontend-v3/e2e/search.spec.ts:1-50
    why: E2E spec 模式参考（BASE_URL/安全检查/waitForContent）

## minimal_validation

minimal_validation:
  assumption: "CSS ::after tooltip 在移动端 tap 时通过 :focus 触发显示"
  method: "标准浏览器原生行为（tabindex=0 元素 tap 获得 focus 是 W3C 规范行为），项目内 EntryListRow 已有 tabindex=0 + @keydown.enter 先例"
  result: "not_needed"
  note: "tap-to-focus 是标准浏览器行为，无需最小验证。若 P6 实跑发现特定浏览器不触发，降级为 @click toggle class 方案（CSS 改动，不影响架构）"

## 实现完成的标志

1. `make typecheck` 零错误
2. `make test-frontend` 全绿（含更新后的 BaseTag.spec.ts、EntryListRow.spec.ts）
3. `make build-frontend` 成功
4. E2E spec `e2e/entry-card-interaction.spec.ts` 覆盖 BDD-01~21 全绿
5. hover title → 仅 title 下划线；hover meta-time → 无下划线
6. 右键 title → 复制 entry URL；右键 username → 复制 user URL
7. 点击 tag → 导航到 `/explore?tags=xxx`，列表过滤
8. tag-overflow hover/tap → tooltip 显示全部 tags
9. Tab 键遍历 → title/username/tag 有可见 focus ring
10. 卡片整体 hover → 边框高亮保持
