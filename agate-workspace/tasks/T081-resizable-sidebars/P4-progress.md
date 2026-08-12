
## P4 implementer: 输入文件读取完成

### 已读取文件
1. implementer.md — 角色定义（最小实现、不扩范围、DESIGN_GAP 标注）
2. P4-dispatch-context-implementer.md — 派发指引（5 个产出文件、实现要求 1-4）
3. P0-brief.md — 环境约束（debug :8888、vitest 1.6.1、宽度双源冲突）
4. P2-design.md — 方案设计（composable + CSS 变量驱动、files_to_read、min/max 表）
5. P3 测试代码 useSidebarResize.spec.ts — 12 个测试用例（BDD-01~07, 12~16, cleanup, saveWidth）
6. useViewMode.ts — localStorage load/save 模式参照
7. useResponsiveLayout.ts — rAF 节流 + 事件监听器管理参照
8. EntryDetailContent.vue — 目标修改文件（scoped 硬编码 width: 200px/240px 在 line 174/177）
9. variables.css — :root line 31-32 有 --sidebar-width/--toc-width
10. layout.css:90-169 — .file-sidebar/.toc-sidebar 全局样式 + @media 断点

### 关键发现
- 测试 BDD-01: left side, startDrag(clientX=260), mousemove(+50) → 期望 310px（startWidth + delta）
- 测试 BDD-02: right side, startDrag(clientX=1000), mousemove(-30) → 期望 270px（startWidth - delta）
- 测试 BDD-05: localStorage '350' → loadWidth() 返回 350 + setProperty 到 CSS var
- 测试 BDD-06: localStorage 'abc' → 回退 defaultPx(260)
- 测试 BDD-07: localStorage '9999' → 超范围回退 defaultPx(240)
- 测试 BDD-12: startDrag 添加 body.resize-active, mouseup 移除
- 测试 BDD-14/15: 双击 reset 到 defaultPx
- 测试 cleanup: cleanup 后 startDrag 不生效
- 测试 saveWidth: clamp 后写入 localStorage
- 测试 BDD-16: handle 元素 role=separator, aria-orientation=vertical, tabindex=0

### 实现计划
1. 新建 useSidebarResize.ts（composable）
2. 修改 EntryDetailContent.vue（移除 scoped 硬编码 + 添加 handle + 引入 composable）
3. 修改 variables.css（新增 min/max 变量）
4. 修改 layout.css（overflow-y + position relative + resize-handle 样式 + 响应式隐藏）
5. 自跑 vitest 确认测试通过

[PROD_NOT_TOUCHED]

## design-review 评审进度

- [x] 读取 P4-dispatch-context-design-review.md
- [x] 读取 design-review.md 角色定义
- [x] 读取 P0-brief.md（env_constraints + known_risks）
- [x] 读取 P2-design.md（方案设计 + 修订说明）
- [x] 读取 P2-review.md（3 个 ISSUE 修订要求）
- [x] 读取 P4-implementation.md（实现声明）
- [x] 读取 useSidebarResize.ts（111 行 composable）
- [x] 读取 EntryDetailContent.vue（template + script + scoped style）
- [x] 读取 variables.css（新增 min/max 变量）
- [x] 读取 layout.css（resize-handle + position:relative + overflow-y:auto + zen-mode + 移动端）
- [x] 读取 useViewMode.ts + useResponsiveLayout.ts（参照模式对比）

## design-review 发现记录

### ISSUE 逐条确认

- ISSUE-1 (overflow-y: auto 移除 scoped 硬编码 + 补 layout.css):
  - EntryDetailContent.vue scoped 中 .file-sidebar/.toc-sidebar 规则块已移除（grep "width: 200px|240px" 无匹配）
  - layout.css:104 .file-sidebar 有 overflow-y: auto ✅
  - layout.css:129 .toc-sidebar 有 overflow-y: auto（原有）✅
  - 结论：✅ 已解决

- ISSUE-2 (.file-sidebar / .toc-sidebar 补 position: relative):
  - layout.css:105 .file-sidebar 有 position: relative ✅
  - layout.css:130 .toc-sidebar 有 position: relative ✅
  - 结论：✅ 已解决

- ISSUE-3 (BDD-13 滚动阻止机制 user-select: none + resize-active class):
  - layout.css:203-206 body.resize-active { user-select: none; cursor: col-resize } ✅
  - composable startDrag: body.classList.add('resize-active') (line 64) ✅
  - composable onMouseUp: body.classList.remove('resize-active') (line 49) ✅
  - composable cleanup: body.classList.remove('resize-active') (line 97) ✅
  - 结论：✅ 已解决

### 评审重点逐条

- composable 遵循 useViewMode.ts / useResponsiveLayout.ts 模式：
  - loadWidth/saveWidth 模式参照 useViewMode ✅
  - rAF 节流 + 事件监听器管理参照 useResponsiveLayout ✅
  - 但 P3 契约声明返回 currentWidth: Ref<number>，实际未返回（偏离 P3 契约，但不影响功能）→ INFO

- CSS 变量统一（scoped 硬编码移除，用 var(--sidebar-width)）✅

- resize handle 在 aside 内部（v-if 联动）✅
  - file-sidebar: handle 在 <aside> 内部末尾 (EntryDetailContent.vue:11-19)
  - toc-sidebar: handle 在 <aside> 内部开头 (EntryDetailContent.vue:65-73)

- 移动端 @media 断点正确 ✅
  - @media (max-width: 1023px) { .resize-handle { display: none } } (layout.css:197-201)
  - 与侧边栏 display:none 断点一致

- zen mode 兼容 ✅
  - .zen-mode .resize-handle { display: none } (layout.css:208-210)
  - 另外侧边栏本身 zen-mode display:none，handle 随 aside 消失

- 键盘可访问性（role/tabindex/focus-visible）：
  - role="separator" ✅
  - aria-orientation="vertical" ✅
  - tabindex="0" ✅
  - :focus-visible outline 2px solid var(--c-accent) ✅
  - ⚠️ 但 P2-design.md:122-124 声明 keydown: ArrowLeft/ArrowRight → 宽度 ±8px，实现中无 keydown 处理器
  - 这是一个 DESIGN_GAP（实现偏离设计），但 P3 测试 BDD-16 只测 focus 可达性不测键盘调整

## design-review 补充发现

### [INFO] min/max CSS 变量未使用
- variables.css:33-36 定义了 --sidebar-width-min/max, --toc-width-min/max
- 但 composable 配置硬编码 minPx:160/maxPx:500/minPx:150/maxPx:400
- 这些 CSS 变量是死代码（无任何引用）
- 影响：无功能影响，但 min/max 值有两处定义源（CSS 变量 + composable 配置），未来修改可能不同步

### [MINOR] onMouseUp 取消 rAF 导致最后一次 mousemove 宽度未持久化
- useSidebarResize.ts:50-52: onMouseUp 中 `if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }`
- 这会取消最后一次 mousemove 注册的 rAF，导致 setCssVar 未执行
- 随后 readCurrentWidth 读取的是倒数第二次 mousemove 设置的 CSS var 值（过时）
- saveWidth 保存的是过时值到 localStorage
- 实际影响：拖拽结束后刷新页面，宽度可能比拖拽结束时的视觉宽度少一帧的 delta（通常 <8px）
- 测试未捕获原因：测试中 dispatchMouseMove 同步 flushRaf()，rAF 在 mouseup 前已执行
- 修复建议：onMouseUp 中不 cancel rAF，而是同步执行最后一次 setCssVar，或直接用最后一次 clamped 值 saveWidth

### [INFO] P3 契约 currentWidth: Ref<number> 未实现
- P3-test-cases.md:199 声明 UseSidebarResizeReturn 含 currentWidth: Ref<number>
- 实际 composable 未返回 currentWidth（只返回 startDrag/loadWidth/saveWidth/onDoubleClick/cleanup）
- 影响：无功能影响（组件未使用 currentWidth），但偏离 P3 接口契约

### [INFO] P2-design keydown 键盘箭头调整未实现
- P2-design.md:122-124 声明 keydown: ArrowLeft/ArrowRight → 宽度 ±8px
- 实现中无 keydown 处理器（composable + template 均无）
- BDD-16 只测 focus 可达性，不测键盘箭头调整，所以测试通过
- 影响：键盘用户无法用箭头键调整宽度（只能 Tab 聚焦 handle，但聚焦后无操作）
- 这是 DESIGN_GAP（实现偏离设计），但 P1 BDD 未将其列为验收条件
