
## P4 启动 — 2026-07-31

[PROD_NOT_TOUCHED]

### 已读取输入
- P4-dispatch-context-implementer.md ✓
- implementer.md 角色定义 ✓
- P2-design.md ✓ (方案 A，files_to_read 11 项)
- P3-test-cases.md ✓ (4 vitest + 7 Playwright E2E)

### 开始读取 files_to_read 清单

### files_to_read 全部读取完成
- MarkdownViewer.vue L124-134 ✓ (移除 height:100% + overflow:auto + padding:2rem)
- markdown.css L1-3 ✓ (移除全局 padding + 移动端 padding)
- code.css L1-51 ✓ (.code-viewer 移除 min-height/flex, .code-body 改 overflow-x:auto)
- useResponsiveLayout.ts L26-58 ✓ (移除 findScrollable, 直接监听 container)
- EntryDetailContent.vue L160-161 ✓ (确认不改：content-area padding 保留)
- CodeViewer.vue L121-123 ✓ (确认不改：@import code.css)
- HtmlViewer.vue L189-194 ✓ (确认不改：height:100% 不变)
- ImageViewer.vue L156-161 ✓ (确认不改：height:100% 不变)
- EntryDetailView.vue L195-196 ✓ (确认不改：setupScrollHide 调用点)
- t049 spec L56-89, L107-119 ✓ (修正 scrollTo + 选择器)
- DESIGN.md L267 ✓ (新增 Scroll Architecture 小节)

### P3 测试代码读取完成
- useResponsiveLayout.spec.ts: 4 测试 (BDD-04/05/06 + cleanup)
- t084-scroll-architecture.spec.ts: 7 测试 (BDD-01/02/03/07/08/09/10)

### 测试期望行为确认
- setupScrollHide 直接监听传入 container 的 scroll 事件（非 findScrollable 子元素）
- container.scrollTop 变化时触发 metaTagsHidden
- .markdown-viewer scrollTop 保持 0（不抢滚动）
- .code-body scrollTop 保持 0（不抢纵向滚动），但保留 overflow-x:auto
- .markdown-body paddingTop 为 0px（padding 由 content-area 承担）

### 开始实施代码改动

### 代码改动完成

1. MarkdownViewer.vue: 移除 .markdown-viewer { height:100%; overflow:auto } + .markdown-body { padding:2rem }
2. markdown.css: 移除 .markdown-body { padding:var(--space-5) } + 移动端 @media padding
3. code.css: .code-viewer 移除 min-height:300px + flex:1 + 移动端媒体查询; .code-body 改 overflow-x:auto
4. useResponsiveLayout.ts: 移除 findScrollable + scrollContainer, 直接监听 container scroll
5. t049 spec: A-BDD-3/4/5 修正 window.scrollTo → .content-area scrollTop + .header-tags → .meta-tags-bar
6. DESIGN.md: §9 新增 Scroll Architecture 小节

### 自查：vitest 单测

### 自查结果
- vitest useResponsiveLayout.spec.ts: 4/4 通过 ✓
- 全量 vitest: 83 文件 1129 通过 1 skipped 0 失败 ✓
- vue-tsc --noEmit: 零错误 ✓
- npm run build: 成功 ✓
- 所有改动文件内容与 P2 方案 A 一致 ✓

### 改动文件清单（6 个文件）
1. frontend-v3/src/components/MarkdownViewer.vue — scoped style 移除 height/overflow/padding
2. frontend-v3/src/styles/markdown.css — 移除全局 padding + 移动端媒体查询
3. frontend-v3/src/styles/code.css — .code-viewer 移除 min-height/flex + 移动端查询; .code-body 改 overflow-x:auto
4. frontend-v3/src/composables/useResponsiveLayout.ts — setupScrollHide 移除 findScrollable
5. frontend-v3/e2e/t049-mobile-header-diagram-sanitize.spec.ts — A-BDD-3/4/5 选择器+滚动修正
6. DESIGN.md — §9 新增 Scroll Architecture 小节
