# P2 Progress — T085 architect

## 输入文件读取记录

### 1. P2-dispatch-context-architect.md
- 5 缺陷 + P1 确认修复方向
- 约束：只设计不实现；ui_affected: true；domains: frontend；risk: medium
- gate_commands 已指定（vitest dot / vue-tsc / build / E2E render-regression.spec.ts）
- 门槛：四字段 + 候选方案≥2 + files_to_read + minimal_validation + env_constraints

### 2. P0-brief.md
- 根因分析确认：P1 SVG 调度链 / P2 code-body flex 丢失 / P3 markdown padding 丢失 / P4 scroll-hide 无边界保护 / P5 原生 select + E2E selectOption 盲区
- env: make debug-quick :8888 / [PROD_NOT_TOUCHED]
- 已知风险：5 修复可能互相影响（content-area padding + overflow + scroll-hide + select 联动）

### 3. P1-requirements.md
- 11 BDD（BDD-1~11）
- IM-1 关键：SVG 调度修复后 toggle 按钮行为——isRichRenderable 含 isXml，若不排除 SVG 会留死按钮。P1 已确认方向：SVG 走 ImageViewer，切换按钮对 SVG 隐藏
- IM-5：per-page 必须真实点击，禁用 selectOption()
- IM-6：现有 84 E2E 断言不破坏

### 4. useEntryDetailComputed.ts
- isXml = language === 'xml'（第24行）
- isRichRenderable = isCsv||isTsv||isJson||isYaml||isXml||isMarkdown（第25-27行）——含 isXml，SVG 会被截获
- isImage 已正确识别 svg：guessMimeType === 'image/svg+xml'（第28-34行）
- 确认：需新增 isSvg computed + isRichRenderable 排除 SVG + 调度链排除 SVG

### 5. EntryDetailContent.vue
- 调度链第40行：`v-else-if="isCsv || isTsv || isJson || isYaml || isXml"` —— SVG 在此被截获（isXml=true）
- 第45行：`v-else-if="isImage"` —— SVG 应到此处
- content-area CSS（第174行）：`flex:1; overflow-y:auto; padding: var(--space-4)` —— 无 overscroll-behavior
- 移动端（第175行）：`padding: var(--space-3) var(--space-2)` = 12px/8px
- showSourceView = sourceViewMode || parseError（第150行）

### 6. code.css
- .code-body 第38-39行：空规则（T084 移除了 flex:1/min-height:0/overflow:auto）
- .code-viewer 第5-8行：overflow:hidden; display:flex; flex-direction:column
- 确认 P0 根因：flex 容器内 .code-body 无高度约束 → 内容被 overflow:hidden 裁剪

### 7. MarkdownViewer.vue
- scoped style（第124-128行）：.markdown-body { max-width:900px; margin:0 auto } —— 无 padding（T084 移除）
- 确认 P0 根因：padding 丢失

### 8. markdown.css
- 全局 .markdown-body 样式，无 padding 声明（第2行 max-width:none 覆盖了 scoped 的 900px）
- 确认：需恢复 padding

### 9. useResponsiveLayout.ts
- setupScrollHide（第26-43行）：`current > lastScrollTop && current > 10` → hidden=true；`current < lastScrollTop` → hidden=false
- 无底端/顶端边界保护 —— 确认 P0 根因
- 无 overscroll-behavior 依赖

### 10. TableView.vue
- per-page select（第61-65行）：原生 `<select class="per-page-select">`，50/100/500
- onPerPageChange（第165-168行）：取值 + page=1
- .per-page-select CSS（第278-285行）：padding var(--space-1) var(--space-2) —— 触达目标不达标（<<44px）
- 移动端（第300-302行）：width:100%

### 11. Pagination.vue
- 纯按钮分页，无 select，接口：page/perPage/total + update:page
- 确认：Pagination 本身不需改

### 12. DESIGN.md §6/§9/§10
- §6：Content Viewers 列出 CodeViewer/MarkdownViewer/ImageViewer 等，无 select 规范
- §9 Scroll Architecture：content-area 唯一纵向滚动容器；Viewer 不得声明 overflow-y:auto 或 height:100%（HtmlViewer/ImageViewer 例外）
- §9：Touch targets minimum 44px
- §10 a11y：focus indicators / semantic HTML / aria-label

### 13. E2E spec BDD-19/20
- BDD-19（第139-145行）：toHaveValue('100') —— 只验证初始值
- BDD-20（第147-155行）：selectOption('50') —— 程序化设置，绕过真实点击
- 确认 P0 根因：E2E 盲区

### 14. ImageViewer.vue
- 用 guessMimeType 拿 mime → data:mime;base64 加载（第119-120行）
- SVG 走此路径完全可行（image/svg+xml）
- height:100%; overflow:hidden（§9 例外，合理）
- 大文件策略 5MB/10MB —— SVG 通常不触发

### 15. OverflowMenuDropdown.vue
- 现有下拉菜单模式：position:absolute + 列表 + click outside 关闭
- 可作为自定义 select 的参考模式（follows_existing_pattern）

### 16. EntryDetailView.vue
- isRichRenderable 传给 Header/MobileBar 控制 toggle 按钮（第25/91行）
- sourceViewMode 切文件时重置为 false（第176-178行）
- 确认 IM-1：isRichRenderable 必须排除 SVG，否则 toggle 按钮对 SVG 仍显示

## 最小验证

### 验证 1：guessMimeType('.svg') 返回值
- 结果：`image/svg+xml`（mime.ts:3 确认）
- 结论：isImage computed 已能识别 SVG，无需改 isImage

### 验证 2：SVG 走 ImageViewer 的 data URI 加载可行性
- 逻辑：ImageViewer.loadImage() → api.getFileAsBase64 → `data:image/svg+xml;base64,...` → <img src>
- 浏览器原生支持 data URI SVG 渲染（纯代码逻辑，无外部系统依赖）
- 结论：confirmed

### 验证 3：.code-body flex:1 + min-height:0 在 flex 容器中的高度传递
- 纯 CSS flex 布局逻辑：flex 子元素 min-height:0 允许收缩至内容以下，flex:1 填充剩余空间
- content-area overflow-y:auto 滚动因子 = content-area 自身
- 结论：纯代码逻辑，无外部系统依赖

### 验证 4：overscroll-behavior:none 对滚动抖动的作用
- 浏览器 CSS 标准属性，阻止 overscroll 弹跳传递
- 结论：纯 CSS 标准属性，无外部系统依赖

### 验证 5：原生 select 在 CDP Chrome 中真实点击无法弹出
- P0-brief 已确认用户反馈 + E2E selectOption 绕过
- 根因可能是：select 被覆盖层/pointer-events 拦截，或 CDP 环境原生 select 弹出行为异常
- 方案：改自定义组件绕过原生 select 限制
- 结论：方案不依赖原生 select 行为，无需额外验证
