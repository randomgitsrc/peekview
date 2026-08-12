---
phase: P4
task_id: T031-cold-open-performance
type: review
parent: P4-implementation.md
trace_id: T031-P4-review-20260722
status: approved
created: 2026-07-22
agent: design-review
---

# P4 Design Review — 实现与 P2 方案一致性

## 子项逐一检查

### A. 并行加载 ✅

| P2 要求 | 实现 | 判定 |
|---------|------|------|
| 列表页导航时 route query 传 firstFileId | `EntryListView.vue:367-369` — `router.push({ path, query: { firstFileId } })` | ✅ |
| 详情页 onMounted 用 Promise.all 并发 getEntry + getFileContent | `stores/entry.ts:86-89` — `Promise.all([entryPromise, contentPromise])` | ✅ |
| router.replace 清理 query 参数 | `EntryDetailView.vue:718-719` — `router.replace({ path: route.path, query: {} })` | ✅ |
| getEntry 失败则整体 reject | contentPromise 有 `.catch(() => null)`，entryPromise 无 catch → reject 传播 | ✅ |
| shareToken 兼容（不改变原有行为） | shareToken 仅传 getEntry，getFileContent 不传（与串行链一致） | ✅ |
| entry 无文件时不发无效请求 | fileId 为 undefined 时传 0，404 被 `.catch(() => null)` 吞掉，`entry.files.length > 0` 守卫 | ✅ |

### B. 卡片改真 `<a>` 链接 ✅

| P2 要求 | 实现 | 判定 |
|---------|------|------|
| EntryCard `.card-body` 改为 `<a :href>` | `EntryCard.vue:21-24` — `<a class="card-body" :href="'/' + entry.slug" @click.prevent>` | ✅ |
| EntryListRow 根元素改为 `<a>` | `EntryListRow.vue:2-6` — `<a class="entry-list-row" :href="'/' + entry.slug" @click.prevent>` | ✅ |
| toggle/delete buttons 保留 `@click.stop` + `.prevent` | EntryCard: `.card-actions @click.stop.prevent`（line 3）；EntryListRow: `.entry-actions @click.stop.prevent`（line 37） | ✅ |
| username 改 span + stopPropagation | 两处均为 `<span class="meta-username" @click.stop.prevent="navigateToUser">` | ✅ |
| 移除 role="button" / tabindex="0" / @keydown.space | 两组件卡片/行元素上无这些属性 | ✅ |
| 原生右键菜单 | `<a>` 原生支持 | ✅ |

### C. 分隔符 `·` 修复 ✅

| P2 要求 | 实现 | 判定 |
|---------|------|------|
| `.meta-sep` 添加 `font-family: Inter, -apple-system, sans-serif` | EntryCard CSS line 209 + inline style lines 36,39；EntryListRow CSS line 168 + inline style lines 20,23；EntryListView `.footer-meta .separator` line 924 | ✅ |
| 三处统一修改 | EntryCard / EntryListRow / EntryListView footer | ✅ |

### D. 搜索框 placeholder ✅

`EntryListView.vue:62` — `placeholder="Search titles, tags & content..."` ✅

### E. Explore 按钮文案 ✅

- `LandingView.vue:45` — hero-cta: `Browse public` ✅
- `LandingView.vue:167` — cta-band: `Browse public` ✅

### F. 骨架屏 ✅

| P2 要求 | 实现 | 判定 |
|---------|------|------|
| EntryListView grid 模式 6 个 skeleton-card（radius 14px, padding 24px） | `EntryListView.vue:109-115` + CSS `.skeleton-card { border-radius: 14px; padding: var(--space-4) }` | ✅ |
| EntryListView list 模式 6 个 skeleton-row | `EntryListView.vue:116-121` + CSS `.skeleton-row` | ✅ |
| 内含 title bar + meta bar + tags bar（grid）/ title + meta（list） | skeleton-title / skeleton-meta / skeleton-tags classes | ✅ |
| EntryDetailView header skeleton + content skeleton | `EntryDetailView.vue:135-141` — skeleton-header (title-bar + meta-bar) + skeleton-content (content-block) | ✅ |
| `background: var(--c-border)` + shimmer 动画 | 两处 `.skeleton-bar { background: var(--c-border); animation: shimmer 1.5s infinite }` | ✅ |
| 纯 CSS 动画 | `@keyframes shimmer { opacity }` — 无 JS | ✅ |

## 范围控制

P2 "不改什么" 清单验证：

| 不改项 | 状态 |
|--------|------|
| 后端 API | ✅ 无后端文件改动 |
| api/client.ts | ✅ 未修改 |
| router.ts | ✅ 未修改 |
| EntryDetailView meta-dot | ✅ 仍为 `<span class="meta-dot"></span>` |
| selectFile 逻辑 | ✅ `entry.ts:118-134` 未变 |
| MCP server / CLI | ✅ 未触碰 |

改动文件完全匹配 P2 "改什么" 表格：EntryCard.vue, EntryListRow.vue, EntryListView.vue, EntryDetailView.vue, entry.ts, LandingView.vue。无范围外改动。

## a11y 补偿

username span 在 EntryCard（line 28-35）和 EntryListRow（line 12-19）均具备：
- `role="link"` ✅
- `tabindex="0"` ✅
- `@keydown.enter.stop.prevent="navigateToUser"` ✅

## 代码质量

- 无新增注释 ✅（EntryDetailView overflowItems 中的 `// Group N` 注释为预存代码，非本次改动）
- 无硬编码颜色 ✅（骨架屏用 `var(--c-border)`，所有颜色走 CSS 变量）
- 16/16 vitest 通过 + vue-tsc --noEmit 无错误（dispatch-context 确认）

## 结论

实现与 P2-design.md 6 个子项完全一致，无范围外改动，a11y 补偿到位，代码质量符合项目规范。

**Status: approved**
