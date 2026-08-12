=== Progress file init ===
## P2 修正开始

### 评审意见摘要
- B1 (BLOCKER): zen 进入时焦点可能落在被隐藏元素内，需重定向到 .content-area
- B2 (BLOCKER): 屏幕阅读器用户无法感知 zen 状态变化，需 aria-live 通知
- S1: 补充 loading/error/empty 状态下 zen 行为声明
- S2: 补充 zen + slug watch 侧边栏可见性分析
- S3: 声明 Esc + ConfirmDialog 交互
- S4: mobile-actions CSS 规则必要性说明

### 代码验证
- .sr-only 已存在于 base.css:116（position:absolute + clip:rect + 1px 尺寸），可直接复用
- .content-area 是 <main> 元素（EntryDetailView.vue:107），需 tabindex=-1 才能接收 focus()
- 工程评审非阻塞项：shouldHandleZenShortcut 重复调用、LoginDialog 援引不精确、onUnmounted import

### 修正计划
1. B1: 在 §2.4 handleZenKeydown 中添加焦点重定向逻辑 + §2.3 中 .content-area 添加 tabindex=-1
2. B2: 在 §2.1 添加 aria-live 区域设计 + template 中添加 sr-only span
3. S1-S4: 在相应位置补充声明
4. 采纳工程评审非阻塞项：简化 handleZenKeydown 重复调用

### 修正完成

**B1 焦点重定向**：
- 新增 `redirectFocusIfHidden()` 函数：进入 zen 时检查 activeElement 是否在 `.detail-header, .file-sidebar, .toc-sidebar, .mobile-actions` 内，若是则 focus 到 `.content-area`
- `.content-area` 的 `<main>` 添加 `tabindex="-1"` 使其可接收 programmatic focus
- 退出 zen 时无需重定向（恢复可见后 Tab 自然导航）

**B2 aria-live 通知**：
- 新增 `zenAriaText` ref + `updateZenAria(zen: boolean)` 函数
- template 中添加 `<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>`
- 进入时播报 "Zen mode on. Press f or Escape to exit."，退出时播报 "Zen mode off."
- 复用项目已有 `.sr-only` class（base.css:116）

**S1-S4 建议项全部采纳**：
- S1: §2.9 声明 loading/error/empty 下允许触发 zen
- S2: §2.9 声明 zen + slug watch 侧边栏可见性链路
- S3: §2.4 声明 Esc + ConfirmDialog 交互为期望行为
- S4: §2.3 说明 mobile-actions CSS 规则为防御性声明

**工程评审非阻塞项采纳**：
- 简化 handleZenKeydown 中 shouldHandleZenShortcut 重复调用
- 修正 LoginDialog 援引（不在 EntryDetailView 中）
- 声明 onUnmounted import 需新增

status: revised
