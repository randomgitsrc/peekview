# P2 Progress — T084 detail-scroll-architecture

## 角色与阶段
- role: architect
- phase: P2
- trace_id: T084-P2-20260731

## 执行记录

### 初始化
- 读取 dispatch-context-architect.md ✓
- 读取 architect.md 角色定义 ✓
- 读取 P0-brief.md ✓
  - 核心问题：多层 overflow:auto 导致滚动容器不明确
  - 目标：.content-area 唯一滚动容器，viewer 不抢滚动
  - 约束：不改后端/MCP/DB，桌面/移动一致，零测试回归，DESIGN.md 补充 Scroll Architecture
  - env_constraints: make debug :8888, make test-frontend, make typecheck, make build-frontend


### 读取 P1-requirements.md ✓
- 14 BDD（BDD-01~14），8 IR（IR-1~8）
- risk_level: medium, domains: [frontend]
- 关键 IR：
  - IR-1: HtmlViewer/ImageViewer 保持 height:100%（撑满 content-area），不改为自然高度
  - IR-2: CodeViewer 保留 overflow-x: auto（横向滚动）
  - IR-3: t049 E2E 用 window.scrollTo 测 scroll-hide，需同步修正
  - IR-4: padding 归属决策 + markdown.css 全局 padding 同步处理
  - IR-5: CodeViewer 短代码视觉空旷 → BDD 不覆盖主观空旷
  - IR-6: setupScrollHide 简化，去掉 findScrollable
  - IR-7: footnote 锚点跳转也受益
  - IR-8: DESIGN.md §9 补充 Scroll Architecture
- [NO_NEED_CONFIRM]，所有 IR 技术方向明确
- phases: [P1,P2,P3,P4,P5,P6,P7,P8] 全走

### 读取 EntryDetailContent.vue ✓
- L158: .detail-content { display: flex; flex: 1; overflow: hidden; } ← 外层不滚动（正确）
- L160: .content-area { flex: 1; overflow-y: auto; outline: none; padding: var(--space-4); } ← 唯一滚动容器 + 有 16px padding
- L161: 移动端 .content-area padding: var(--space-3) var(--space-2) ← 移动端也有 padding
- content-area 是 <main class="content-area entry-content">，直接包含 viewer 组件

### 读取 useResponsiveLayout.ts ✓
- L26-59: setupScrollHide(container)
  - L27-37: findScrollable 遍历子元素找 overflowY=auto/scroll 且 scrollHeight>clientHeight 的
  - L39-42: 找不到则 fallback 到 container 本身
  - L44-52: onScroll 方向感知（下滚>10px 隐藏，上滚显示）
  - L53: addEventListener('scroll', onScroll, {passive:true})
  - L55-58: 返回 cleanup 函数
- 问题确认：findScrollable 在 onMounted 时因异步渲染找不到可滚动子元素 → fallback 到 .content-area → 但 .content-area 不滚动（子元素抢了）→ scroll 事件不触发
- 简化方向：去掉 findScrollable，直接监听 container（.content-area）的 scroll 事件


### 读取 MarkdownViewer.vue ✓
- L124-128 scoped: .markdown-viewer { height: 100%; overflow: auto; } ← 抢滚动！
- L130-134 scoped: .markdown-body { padding: 2rem; max-width: 900px; margin: 0 auto; }
- L137-143 全局 style: .markdown-body :is(h1..h6) { scroll-margin-top: 80px; }
- L79-86: footnote 链接用 scrollIntoView({ behavior: 'smooth', block: 'start' })
- 改动点：L125-127 .markdown-viewer 从 height:100%+overflow:auto → 去掉（不抢滚动）
- 改动点：L131 .markdown-body padding: 2rem → 需决策（与 content-area padding 二选一）

### 读取 code.css ✓
- L2-11: .code-viewer { display:flex; flex-direction:column; min-height:300px; flex:1; overflow:hidden }
- L14-18: 移动端 .code-viewer { min-height: 0 } （允许收缩）
- L47-51: .code-body { overflow: auto; flex: 1; min-height: 0 } ← 抢纵向滚动！
- L81-90: .code-body :deep(pre) { flex:1; overflow-x: auto } ← 横向滚动保留（正确）
- L139-147: fallback .code-body pre { overflow-x: auto } ← 横向滚动保留
- 改动点：L48 .code-body 从 overflow:auto → overflow-x: auto（保留横向，去掉纵向）
- 改动点：L9 .code-viewer min-height:300px → 需决策（短代码空旷问题）
- 改动点：L10 .code-viewer flex:1 → 需决策（自然高度 vs 撑满）

### 读取 markdown.css ✓
- L2: .markdown-body { padding: var(--space-5); } ← 全局 padding（20px），被 scoped 2rem 覆盖
- L3: @media (max-width:640px) { .markdown-body { padding: 1.25rem; } } ← 移动端全局 padding（20px）
- L4: .markdown-body h1,h2,h3 { scroll-margin-top: 80px; } ← 全局也有 scroll-margin-top
- 关键发现：markdown.css L2 的 padding 和 MarkdownViewer scoped L131 的 padding 是两层
  - scoped .markdown-body padding:2rem (32px) 因 data-attribute 优先级高于全局
  - 如果移除 scoped padding，全局 var(--space-5) (20px) 会生效 → 非预期行为变化
  - 必须同步处理：要么清理 markdown.css L2-3 的 padding，要么在 scoped 中显式覆盖


### 读取 EntryDetailHeader.vue ✓
- L67: <div v-if="isMobile" class="meta-tags-bar" :class="{ hidden: metaTagsHidden }"> ← 移动端才渲染
- L179: .meta-tags-bar { display:flex; ... transition: opacity var(--transition-fast); }
- L180: .meta-tags-bar.hidden { max-height:0; padding:0; overflow:hidden; border-bottom:none; opacity:0; }
- meta-tags-bar 通过 max-height + opacity 过渡隐藏，不是 display:none
- 桌面端不渲染 meta-tags-bar（v-if="isMobile"），BDD-06 验证 DOM 中不存在
- isMobile 通过 inject(IsMobileKey) 获取（来自 useResponsiveLayout）

### 读取 HtmlViewer.vue ✓
- L189-194: .html-viewer { display:flex; flex-direction:column; height:100%; overflow:hidden; } ← 不抢纵向滚动（正确）
- L268-272: .html-frame-container { flex:1; position:relative; overflow:hidden; }
- L301-308: .html-frame { width:100%; height:100%; border:none; overflow:auto; } ← iframe 内部滚动（sandbox 隔离，正确）
- IR-1 确认：HtmlViewer 保持 height:100%，不改为自然高度（iframe 无内容撑开会塌陷）
- 不需要改动

### 读取 ImageViewer.vue ✓
- L156-161: .image-viewer { display:flex; flex-direction:column; height:100%; overflow:hidden; } ← 不抢纵向滚动（正确）
- L254-261: .image-container { flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
- L263-267: .image-container.image-zoomed { overflow:auto; } ← 放大时容器自己滚动
- IR-1 确认：ImageViewer 保持 height:100%，不改为自然高度
- 注意：image-zoomed 模式下 overflow:auto 是图片放大查看的内部滚动，不是内容滚动，保持不变
- 不需要改动


### 读取 DESIGN.md §9 ✓
- L218-219: §Scroll-Hide Meta Bar — "On mobile detail page, metadata/tags bar hides on scroll-down, reappears on scroll-up."
- L249-267: §9 Responsive Behavior — 有 Breakpoints + Rules，但无 Scroll Architecture 小节
- L263: "Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile."
- 需补充：§9 新增 Scroll Architecture 小节，声明 .content-area 唯一纵向滚动容器

### 读取 EntryDetailView.vue (L130-209) ✓
- L138: const { isMobile, isDesktop, metaTagsHidden, handleResize, setupScrollHide } = useResponsiveLayout()
- L181-197: onMounted async
  - L185: await entryDetailStore.loadEntry(...)
  - L190: await nextTick()
  - L195-196: const content = document.querySelector('.content-area'); if (content) onUnmounted(setupScrollHide(content as HTMLElement))
  - 关键：setupScrollHide 在 loadEntry + nextTick 之后调用，但 Shiki/Mermaid 异步渲染可能还未完成
  - 简化后：直接绑 .content-area 的 scroll 事件，不需要等内容渲染完成

### 读取 TocNav.vue ✓
- L26-31: scrollTo(id) → document.getElementById(id).scrollIntoView({ behavior:'smooth', block:'start' })
- scrollIntoView 的滚动容器由浏览器自动向上查找最近的 overflow:auto/scroll 祖先
- 当前：最近的可滚动祖先是 .markdown-viewer（overflow:auto）→ 在 .markdown-viewer 内滚动 → scroll-margin-top 参考系错误
- 改后：.markdown-viewer 不再 overflow:auto → 最近可滚动祖先是 .content-area → scroll-margin-top:80px 正确生效

## 关键发现汇总

### CSS 层级全景（已验证）
1. .detail-content → overflow:hidden（不滚动，正确）
2. .content-area → overflow-y:auto; padding:var(--space-4)（唯一应滚动容器，但有 16px padding）
3. .content-area 移动端 → padding:var(--space-3) var(--space-2)（12px 8px）
4. .markdown-viewer scoped → height:100%; overflow:auto（抢滚动！需移除）
5. .markdown-body scoped → padding:2rem; max-width:900px; margin:0 auto（32px padding）
6. .markdown-body 全局 markdown.css L2 → padding:var(--space-5)（20px，被 scoped 覆盖）
7. .markdown-body 全局移动端 L3 → padding:1.25rem（20px，被 scoped 覆盖）
8. .code-viewer → min-height:300px; flex:1; overflow:hidden; display:flex; flex-direction:column
9. .code-body → overflow:auto; flex:1; min-height:0（抢纵向滚动！需改为 overflow-x:auto）
10. .code-body :deep(pre) → overflow-x:auto（横向滚动，保留）
11. .html-viewer → height:100%; overflow:hidden（不抢滚动，正确，保持不变）
12. .image-viewer → height:100%; overflow:hidden（不抢滚动，正确，保持不变）
13. .diagram-viewer → overflow:hidden; height:400px（固定高度，不受影响）

### padding 决策分析
- 当前双层：content-area 16px + markdown-body 32px = 48px（移动端：12px+20px=32px... 实际移动端 scoped 2rem=32px 覆盖全局 1.25rem=20px，所以移动端是 8px+32px=40px）
- 方案 A：content-area padding:0，padding 由 viewer 负责
  - markdown-body 保持 padding（但需统一 scoped 和全局）
  - code-viewer 需加 padding（当前没有）
  - html-viewer 不需 padding（iframe 撑满）
  - image-viewer 不需 padding（图片居中）
- 方案 B：content-area 保留 padding，viewer 内部 padding:0
  - 但 markdown-body 的 max-width:900px; margin:0 auto 居中需要 padding 来留白
  - code-viewer 也需要 padding
  
### CodeViewer 短代码决策
- 当前：min-height:300px; flex:1 → 短代码也撑满
- 改为自然高度后：短代码只占一小块
- 选项 1：min-height:100%（撑满 content-area，短代码不空旷）—— 但 content-area 去掉 padding 后 height 参考 padding-box
- 选项 2：去掉 min-height，接受空旷（P0 说的风险）
- P1 IR-5 说 BDD 不覆盖主观空旷 → 倾向选项 2（自然高度），但 code-viewer 的 flex:1 需保留还是去掉？
  - flex:1 在 .content-area（非 flex 容器）中不生效——content-area 是 main 标签，display 默认 block
  - 实际上 .code-viewer 的 flex:1 是给 .code-body 用的（code-body 是 code-viewer 的 flex 子元素）
  - .code-viewer 本身在 .content-area 中是 block 元素，flex:1 无效
  → 结论：.code-viewer 的 flex:1 和 min-height:300px 可以安全移除/修改，不影响 flex 布局


### 读取 CodeViewer.vue ✓
- L2: <div class="code-viewer"> ← 根元素
- L12-18: <div ref="codeBodyRef" class="code-body" v-html="highlightedCode" /> ← 代码内容
- L121-123: <style scoped> @import '@/styles/code.css'; ← 所有样式在 code.css 中
- 结构：.code-viewer > .code-body (v-html)
- .code-viewer 是 .content-area 的直接子元素
- .content-area 是 <main>，display 默认 block（不是 flex）
- → .code-viewer 的 flex:1 在 .content-area 中不生效（父非 flex 容器）
- → .code-viewer 的 min-height:300px 作为 block 元素的 min-height 生效
- → .code-body 的 flex:1 在 .code-viewer（display:flex; flex-direction:column）中生效

### 关键假设确认：.content-area 的 display
- EntryDetailContent.vue L160: .content-area { flex: 1; overflow-y: auto; outline: none; padding: var(--space-4); }
- .content-area 没有声明 display → 默认 block（<main> 标签）
- .content-area 的 flex:1 是在 .detail-content（display:flex）中生效
- .content-area 本身不是 flex 容器 → 子元素 .code-viewer 的 flex:1 无效
- 结论确认：.code-viewer 的 flex:1 可以安全移除


### 最小验证执行
- 方法：创建 10 行 HTML 测试页验证子元素 overflow:auto + height:100% 是否抢走父元素滚动
- 测试页路径：/tmp/opencode/t084-scroll-test.html
- 执行：尝试通过 Playwright CDP 连接 Chrome 验证
- 结果：CDP WebSocket 连接成功但 Playwright connectOverCDP 超时（Chrome 在线但连接不稳定）
- 降级方案：基于 CSS 规范分析确认假设
  - CSS Overflow Module Level 3 §3.1: 一个元素的 overflow 值不为 visible 时，该元素成为 scroll container
  - 当子元素声明 overflow:auto + height:100%，子元素是独立 scroll container
  - 子元素内部滚动不会触发父元素的 scroll 事件（scroll 事件只在元素自身的 scrollTop 变化时触发）
  - 这是 CSS 标准行为，不是浏览器特定实现
- 结论：假设 confirmed（基于 CSS 规范），浏览器验证因 CDP 连接问题未能完成，但 CSS 行为是规范定义的


### 读取 t049 E2E 测试 ✓
- A-BDD-3 (L56-70): scroll down hides header tags
  - L62: window.scrollTo(0, 100) ← 用 window 滚动
  - L65: page.locator('.header-tags') ← 旧选择器（T079 之前组件名）
  - 问题：1) .header-tags 选择器已过时（现在是 .meta-tags-bar）2) window.scrollTo 不会触发 .content-area 的 scroll 事件
- A-BDD-4 (L72-89): scroll up restores header tags
  - L78: window.scrollTo(0, 100) then L82: window.scrollTo(0, 0) ← 同样用 window
  - L85: page.locator('.header-tags') ← 同样过时选择器
- A-BDD-5 (L107-119): desktop scroll has no effect on header tags
  - L113: window.scrollTo(0, 200) ← 桌面端测试
  - L117: page.locator('.header-tags') ← 过时选择器
- IR-3 确认：t049 的 A-BDD-3/4/5 都用 window.scrollTo + .header-tags 选择器，两个都有问题
  - 需同步修正：.header-tags → .meta-tags-bar；window.scrollTo → .content-area scrollTop
  - 但这些是 E2E 测试（P6 验收用），不是单测，P5 gate 不会跑这些

### 现有单测检查
- 需确认是否有 useResponsiveLayout 的单测
- 需确认是否有 MarkdownViewer/CodeViewer 的单测


### 现有单测检查 ✓
- useResponsiveLayout 没有独立单测文件
- t031-entry-detail-view.spec.ts L109-116: vi.mock('@/composables/useResponsiveLayout') ← mock 了整个 composable
  - setupScrollHide: vi.fn(() => () => {}) ← mock 为空函数
  - metaTagsHidden: ref(false) ← mock 为固定值
- t067-detail-framework.spec.ts L122-129: 同样 mock 了 useResponsiveLayout
- T079-entry-detail-header.spec.ts L82: metaTagsHidden: false ← 作为 prop 传入
- t082-error-format.spec.ts L24: 'EntryDetailContent.vue' ← 只在文件名列表中引用
- 结论：
  1. useResponsiveLayout 没有独立单测 → 简化 setupScrollHide 不会破坏现有单测
  2. 现有单测都 mock 了 useResponsiveLayout → 改 composable 内部逻辑不影响单测
  3. MarkdownViewer.spec.ts 和 CodeViewer.spec.ts 存在 → 需检查是否涉及 CSS/overflow 断言
  4. P3 可为 setupScrollHide 简化逻辑新增单测

## 方案设计准备完成，开始写 P2-design.md


### markdown.css 全局 padding 安全分析
- .markdown-body 只在 MarkdownViewer.vue L4 使用（class="markdown-body"）
- 没有其他 Vue 组件使用 markdown-body class
- markdown.css 是全局样式表，但 .markdown-body 选择器只匹配 MarkdownViewer 的根内容 div
- 结论：移除 markdown.css L2-3 的 padding 安全，不会影响其他页面


### 自检 P2-design.md 门槛
1. 候选方案 ≥2 + 权衡 + 选择理由 ✓
   - 方案 A（content-area 统一 padding）vs 方案 B（viewer 自行负责 padding）
   - 各有优缺点/风险/工作量分析
   - 选择理由 4 条
2. 四字段 ✓
   - packages: [frontend-v3]
   - domains: [frontend]
   - ui_affected: true + ui_interaction_points 列表
   - gate_commands: P3/P5/P5_typecheck/P5_build/P5_e2e
3. files_to_read 清单 ✓ — 11 个文件，每个附 why
4. minimal_validation 块 ✓ — assumption/method/result/note
5. env_constraints ✓ — debug_env/isolation_check/prod_not_touched
6. 实现完成的标志 ✓ — 10 条可判定标准

### 门槛验证
- [x] 候选方案 ≥2（方案 A + 方案 B）
- [x] 候选方案含权衡/选择理由
- [x] packages 字段声明
- [x] domains 字段声明
- [x] ui_affected: true + 交互点列表
- [x] gate_commands 齐全（P3/P5/P5_e2e 都有）
- [x] files_to_read 清单（控制 P4 上下文）
- [x] minimal_validation 块（浏览器 scroll 行为验证，CDP 超时降级为 CSS 规范分析）
- [x] env_constraints（确认 P0-brief 约束）
- [x] 实现完成的标志（供 P3/P5 使用）

