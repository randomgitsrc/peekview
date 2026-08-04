## P1 analyst 进度记录

### 读取 P0-brief.md
- 任务：详情页侧边栏可拖拽调整宽度，localStorage 持久化，移动端不适用
- 已知风险：宽度双源冲突、mousemove 与滚动冲突、zen mode 交互、双击 reset
- 裁剪倾向：P2 简化、P3 保留、P6 不可跳

### 读取 EntryDetailContent.vue（实际路径 components/ 不是 views/）
- scoped 硬编码：`.file-sidebar { width: 200px }` (line 174), `.toc-sidebar { width: 240px }` (line 177)
- 覆盖了 layout.css 的 `var(--sidebar-width)` / `var(--toc-width)`
- 额外发现：scoped drawer 样式 z-index 200/201 与 layout.css drawer z-index 100/101 冲突（但 drawer 不是本任务范围）
- 三栏布局：file-sidebar (aside) + content-area (main, flex:1) + toc-sidebar (aside)
- 侧边栏用 v-if 条件渲染：file-sidebar 需 isFileTreeOpen && isMultiFile；toc-sidebar 需 isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0

### 读取 variables.css
- `--sidebar-width: 260px` (line 31), `--toc-width: 240px` (line 32) 在 :root 定义
- 这些是本任务要动态控制的 CSS 变量

### 读取 layout.css
- `.file-sidebar { width: var(--sidebar-width); flex-shrink: 0 }` (line 99-104)
- `.toc-sidebar { width: var(--toc-width); flex-shrink: 0 }` (line 121-128)
- `@media (min-width: 1024px)` 控制侧边栏 display: block (line 146-162)
- zen-mode: `.zen-mode .file-sidebar, .zen-mode .toc-sidebar { display: none }` (line 601-608)
- drawer z-index: overlay 100, panel 101

### 读取 useViewMode.ts
- localStorage 模式：`peekview-` 前缀，load/save 函数，值校验
- T081 应遵循此模式创建 useSidebarResize composable

### 读取 useResponsiveLayout.ts
- isMobile = viewportWidth <= 640
- isDesktop = viewportWidth > 640
- 但 CSS @media (min-width: 1024px) 控制侧边栏显示——注意 isDesktop(>640) 与侧边栏可见(>=1024) 不一致
- resize handle 只在 >=1024px 显示

### 读取 DESIGN.md
- §4 Layout: `--sidebar-width` / `--toc-width` 在 variables.css 定义
- §4 Z-Index Scale: drawer overlay 100, drawer panel 101, modal backdrop 200, modal content 210
- §9 Responsive: Desktop >= 1024px 全多栏布局
- §6 Zen Mode: `f` 进入，`Escape` 退出，隐藏所有 chrome
- §10 Accessibility: 所有交互元素必须有可见 focus 指示器

### 隐含需求识别
1. 拖拽时 user-select 禁用——否则文字被选中
2. mousemove 事件性能——需 requestAnimationFrame 或 passive 监听
3. resize handle 的 z-index 需高于侧边栏但不干扰 drawer/modal
4. 侧边栏条件渲染（v-if）时 handle 也不应显示
5. localStorage 值校验——非法值（NaN、超范围）回退默认
6. CSS 变量统一——必须先移除 scoped 硬编码才能让 JS 动态控制
7. 双击 reset 是否纳入——P0 列为风险，需明确
8. accessibility：handle 需 keyboard 可操作（aria, focus）
9. min/max 边界 clamp——防止拖到 0 或占满屏幕
10. 侧边栏可见性与 handle 可见性联动——条件渲染时 handle 也隐藏

### BDD 验收条件设计
- BDD-01: 拖拽 file-sidebar handle 改变左栏宽度
- BDD-02: 拖拽 toc-sidebar handle 改变右栏宽度
- BDD-03: 宽度 clamp 到 min/max 范围
- BDD-04: 刷新后宽度从 localStorage 恢复
- BDD-05: 非法 localStorage 值回退默认
- BDD-06: 移动端(<1024px)不显示 resize handle
- BDD-07: zen mode 下 handle 隐藏
- BDD-08: 侧边栏条件渲染关闭时 handle 不显示
- BDD-09: 拖拽期间内容区文字不被选中
- BDD-10: 双击 handle 重置默认宽度
- BDD-11: resize handle 有 keyboard 可操作能力
- BDD-12: 拖拽不触发内容区滚动

## requirements-review 进度

### 读取输入文件
- [x] P1-dispatch-context-requirements-review.md — 派发指引已读，明确评审重点
- [x] requirements-review.md — 角色定义已读，明确检查清单和输出格式
- [x] P0-brief.md — 任务简报已读，了解环境约束和已知风险
- [x] P1-requirements.md — 被评审文件已读，16 条 BDD + 10 条隐含需求

### 源码验证（对照 P1 声明）
- [x] EntryDetailContent.vue:174,177 — scoped 硬编码 200px/240px 确认
- [x] variables.css:31-32 — CSS 变量 --sidebar-width:260px / --toc-width:240px 确认
- [x] layout.css:99-104 — .file-sidebar width:var(--sidebar-width) 确认
- [x] layout.css:146-162 — @media (min-width:1024px) 侧边栏 display:block 确认
- [x] layout.css:601-608 — zen-mode display:none 确认
- [x] EntryDetailContent.vue:4 — v-if="isFileTreeOpen && isMultiFile" 确认
- [x] EntryDetailContent.vue:55 — v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0" 确认
- [x] useViewMode.ts — load/save + 验证模式确认
- [x] useResponsiveLayout.ts:21 — isMobile = viewportWidth <= 640（注意：与 CSS 1024px 断点不同）

### 评审发现
1. BDD 编号格式：使用 `#### BDD-NN:` 标准格式，连续不跳号（BDD-01 到 BDD-16）✓
2. BDD 二值可判定性：每条 BDD 的 Then 子句都有明确可测条件 ✓
3. BDD-01/02 Then 子句绑定 "实际宽度比拖拽前增加 50px/30px（误差 ±2px）" — 可测量，非主观 ✓
4. BDD-03/04 绑定具体数值（500px/150px）— 可判定 ✓
5. BDD-16 Then 子句 "显示可见的 focus 指示器（focus ring）" — 略偏主观，但有 "focus ring" 可视化检查锚点
6. 隐含需求 IM-1 到 IM-10 覆盖全面，包括 user-select、rAF 节流、localStorage 校验、z-index、条件渲染、可访问性、min/max clamp、双击 reset
7. 维度检查覆盖：数据✓ 前端✓ 多端✗(纯前端，正确) 边界✓ 兼容✓
8. 裁剪合理性：P1 不可裁✓，P2 简化合理✓，P3 保留有理由✓，P6 不可跳✓
9. P1 纯净性：未掺入解决方案设计（只定义问题，未指定具体实现方式）✓
10. risk_level: low — 与 P0-brief 裁剪倾向一致（follows_existing_pattern）✓
11. capability_requirements 三态：全部 available ✓
12. [NO_NEED_CONFIRM] — 无未决确认项 ✓
13. [PROD_NOT_TOUCHED] — 环境隔离正确 ✓

### 潜在问题（非阻塞性）
- 断点差异：useResponsiveLayout.ts isMobile<=640 vs CSS @media 1024px。P1 BDD-08 用 <1024px 作为 handle 不显示的条件，与 CSS 一致。但实现时需注意 JS 侧的 handle 显示条件应基于 ≥1024px 而非 isMobile。这是 P2/P4 的实现考量，P1 需求层面正确。
- BDD-16 "可见的 focus 指示器" 略偏主观，但 "focus ring" 是可接受的视觉检查锚点。不阻塞。
