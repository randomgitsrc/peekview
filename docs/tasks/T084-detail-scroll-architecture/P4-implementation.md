---
phase: P4
task_id: T084-detail-scroll-architecture
type: implementation
parent: P3-test-cases.md
trace_id: T084-P4-20260731
status: draft
created: 2026-07-31
agent: implementer
---

# P4 代码实现 — T084 详情页滚动架构统一

implementation_dir: /home/kity/oclab/peekview/frontend-v3

[PROD_NOT_TOUCHED]

## 方案

按 P2-design.md 方案 A 实现：`.content-area` 作为唯一纵向滚动容器，viewer 不抢滚动。

## 改动清单

| # | 文件 | 改动 | BDD 覆盖 |
|---|------|------|----------|
| 1 | `src/components/MarkdownViewer.vue` L124-134 | 移除 `.markdown-viewer { height:100%; overflow:auto }`，移除 `.markdown-body { padding:2rem }`（保留 `max-width:900px; margin:0 auto`） | BDD-01, BDD-07, BDD-08 |
| 2 | `src/styles/markdown.css` L2-3 | 移除 `.markdown-body { padding:var(--space-5) }` + 移动端 `@media { padding:1.25rem }` | BDD-08 |
| 3 | `src/styles/code.css` L2-18, L47-51 | `.code-viewer` 移除 `min-height:300px; flex:1` + 移动端 `@media { min-height:0 }`；`.code-body` 从 `overflow:auto; flex:1; min-height:0` → `overflow-x:auto` | BDD-02, BDD-03 |
| 4 | `src/composables/useResponsiveLayout.ts` L26-58 | `setupScrollHide` 移除 `findScrollable` 函数 + `scrollContainer` 变量，直接监听传入 `container` 的 scroll 事件 | BDD-04, BDD-05, BDD-06 |
| 5 | `e2e/t049-mobile-header-diagram-sanitize.spec.ts` L56-89, L107-119 | A-BDD-3/4/5: `window.scrollTo` → `.content-area` scrollTop；`.header-tags` → `.meta-tags-bar` | t049 回归 |
| 6 | `DESIGN.md` §9 L267 后 | 新增「Scroll Architecture」小节，声明 `.content-area` 是唯一纵向滚动容器 | BDD-14 |

## 不改的文件（确认性读取）

| 文件 | 确认内容 |
|------|----------|
| `EntryDetailContent.vue` L160-161 | `.content-area` padding `var(--space-4)` 保留（移动端 `var(--space-3) var(--space-2)` 保留） |
| `CodeViewer.vue` L121-123 | `@import '@/styles/code.css'` 引用关系不变 |
| `HtmlViewer.vue` L189-194 | `height:100%; overflow:hidden` 不变（例外保留） |
| `ImageViewer.vue` L156-161 | `height:100%; overflow:hidden` 不变（例外保留） |
| `EntryDetailView.vue` L195-196 | `setupScrollHide` 调用点不变 |

## 自查结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| vitest 单测（T084） | `npx vitest run src/composables/__tests__/useResponsiveLayout.spec.ts` | 4/4 通过 |
| 全量 vitest | `npx vitest run` | 83 文件 1129 通过 1 skipped 0 失败 |
| typecheck | `npx vue-tsc --noEmit` | 零错误 |
| build | `npm run build` | 成功 |

## 实现细节

### MarkdownViewer.vue

改前：
```css
.markdown-viewer { height: 100%; overflow: auto; }
.markdown-body { padding: 2rem; max-width: 900px; margin: 0 auto; }
```

改后：
```css
.markdown-body { max-width: 900px; margin: 0 auto; }
```

`.markdown-viewer` 规则块整体移除（不再需要任何 scoped 样式声明）。

### markdown.css

改前：
```css
.markdown-body { line-height: 1.7; color: var(--text-primary); max-width: none; padding: var(--space-5); }
@media (max-width: 640px) { .markdown-body { padding: 1.25rem; } }
```

改后：
```css
.markdown-body { line-height: 1.7; color: var(--text-primary); max-width: none; }
```

移动端媒体查询整行移除。

### code.css

改前：
```css
.code-viewer { ...; min-height: 300px; flex: 1; }
@media (max-width: 1023px) { .code-viewer { min-height: 0; } }
.code-body { overflow: auto; flex: 1; min-height: 0; }
```

改后：
```css
.code-viewer { ...; }  /* min-height + flex 移除，overflow:hidden + display:flex + flex-direction:column 保留 */
.code-body { overflow-x: auto; }
```

移动端媒体查询整块移除。

### useResponsiveLayout.ts

改前：`findScrollable` 遍历子元素找 `overflowY: auto/scroll` 且 `scrollHeight > clientHeight` 的，fallback 到 container。

改后：直接监听 container 的 scroll 事件，`onScroll` 中读 `container.scrollTop`，cleanup 直接 `container.removeEventListener`。

### t049 spec

A-BDD-3/4/5 三处：
- `window.scrollTo(0, N)` → `document.querySelector('.content-area').scrollTop = N`
- `.header-tags` → `.meta-tags-bar`

### DESIGN.md

§9 Responsive Behavior 的 Rules 列表后新增 `### Scroll Architecture` 小节，6 条声明。

## 无 [DESIGN_GAP] / [SCOPE+] / [CLARIFY]

实现完全遵循 P2 方案 A，无自主决策偏差，无新隐含需求，无疑问。
