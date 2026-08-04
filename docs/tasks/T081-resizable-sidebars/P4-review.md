---
phase: P4
task_id: T081-resizable-sidebars
type: review
parent: P4-implementation.md
trace_id: T081-P4-20260804
status: approved
created: 2026-08-04
agent: design-review
---

# P4 设计评审：详情页侧边栏可拖拽调整宽度

## 评审对象

- 文件：
  - `frontend-v3/src/composables/useSidebarResize.ts`（新建，111 行）
  - `frontend-v3/src/components/EntryDetailContent.vue`（修改）
  - `frontend-v3/src/styles/variables.css`（修改）
  - `frontend-v3/src/styles/layout.css`（修改）
- 上游：P2-design.md（方案设计）+ P2-review.md（3 个 ISSUE 修订要求）+ P3-test-cases.md（测试用例）
- 实现声明：P4-implementation.md

## 评审结论

**status: approved**

实现符合 P2-design.md 方案设计 + P2-review.md 3 个 ISSUE 修订要求。发现 1 个 MINOR 竞态问题（onMouseUp 取消 rAF 导致最后一次宽度未持久化）和 3 个 INFO 级偏离，均非 BLOCKER，不阻断推进。MINOR 问题建议在 P5 技术验证或 P6 验收阶段定向修复。

## P2-review ISSUE 逐条确认

### ISSUE-1: overflow-y: auto 丢失（MINOR）— ✅ 已解决

**上轮问题**：移除 scoped `.file-sidebar`/`.toc-sidebar` 规则块后，`overflow-y: auto` 丢失。

**源码验证**：

- `EntryDetailContent.vue` scoped 样式中 `.file-sidebar`/`.toc-sidebar` 规则块**已完全移除**（`rg "\.file-sidebar|\.toc-sidebar" EntryDetailContent.vue` 无匹配）
- `rg "width: 200px|width: 240px" EntryDetailContent.vue` 无匹配（硬编码宽度已移除）
- `layout.css:104` `.file-sidebar` 含 `overflow-y: auto` ✅
- `layout.css:129` `.toc-sidebar` 含 `overflow-y: auto`（原有，未丢失）✅
- `layout.css:101` `.file-sidebar` `width: var(--sidebar-width)` ✅
- `layout.css:125` `.toc-sidebar` `width: var(--toc-width)` ✅

策略正确：scoped 整个规则块移除，overflow-y: auto 迁移到 layout.css，宽度统一到 CSS 变量。

### ISSUE-2: aside 缺少 position: relative（MINOR）— ✅ 已解决

**上轮问题**：handle 用 `position: absolute`，aside 无 `position: relative`，handle 定位会偏移。

**源码验证**：

- `layout.css:105` `.file-sidebar` 含 `position: relative` ✅
- `layout.css:130` `.toc-sidebar` 含 `position: relative` ✅
- `.resize-handle` 使用 `position: absolute`（layout.css:168），aside 是定位祖先 ✅

策略正确，两个 aside 均已添加 position: relative，handle 贴边定位正确。

### ISSUE-3: BDD-13 滚动阻止机制（INFO）— ✅ 已解决

**上轮问题**：原设计写 "pointer-events: none on content-area" 不精确，已澄清为 user-select: none + cursor: col-resize。

**源码验证**：

- `layout.css:203-206` `body.resize-active { user-select: none; cursor: col-resize }` ✅
- `useSidebarResize.ts:64` startDrag 中 `document.body.classList.add('resize-active')` ✅
- `useSidebarResize.ts:49` onMouseUp 中 `document.body.classList.remove('resize-active')` ✅
- `useSidebarResize.ts:97` cleanup 中 `document.body.classList.remove('resize-active')` ✅

机制实现正确：拖拽期间 body 添加 resize-active class，CSS 设置 user-select: none 防止文字选中。

## 评审维度逐项

### composable 模式遵循

- `loadWidth()`/`saveWidth()` 模式参照 `useViewMode.ts`（localStorage getItem + Number.isFinite + clamp 校验）✅
- rAF 节流 + 事件监听器注册/清理参照 `useResponsiveLayout.ts`（cancelAnimationFrame + removeEventListener）✅
- cleanup 防重入（cleanedUp flag）✅

### CSS 变量统一

- scoped 硬编码 `width: 200px`/`width: 240px` 已移除 ✅
- layout.css 使用 `var(--sidebar-width)`/`var(--toc-width)` ✅
- composable 通过 `document.documentElement.style.setProperty` 设置 inline style 覆盖 ✅

### resize handle 在 aside 内部（v-if 联动）

- `EntryDetailContent.vue:11-19` file-sidebar handle 在 `<aside class="file-sidebar">` 内部末尾 ✅
- `EntryDetailContent.vue:65-73` toc-sidebar handle 在 `<aside class="toc-sidebar">` 内部开头 ✅
- aside 的 `v-if` 条件消失时 handle 一起消失，无需额外逻辑 ✅

### 移动端 @media 断点

- `layout.css:197-201` `@media (max-width: 1023px) { .resize-handle { display: none } }` ✅
- 与侧边栏 `@media (min-width: 1024px) { display: block }`（layout.css:149-165）断点一致 ✅

### zen mode 兼容

- `layout.css:208-210` `.zen-mode .resize-handle { display: none }` ✅
- `layout.css:649-656` `.zen-mode .file-sidebar, .zen-mode .toc-sidebar { display: none }` — handle 随 aside 一起消失 ✅
- 双重保险（handle 自身 zen-mode 隐藏 + 父 aside 隐藏）✅

### 键盘可访问性

- `role="separator"` ✅（EntryDetailContent.vue:13, 67）
- `aria-orientation="vertical"` ✅
- `tabindex="0"` ✅
- `aria-label` ✅
- `:focus-visible { outline: 2px solid var(--c-accent) }` ✅（layout.css:192-195）
- ⚠️ P2-design.md:122-124 声明 keydown ArrowLeft/ArrowRight → 宽度 ±8px，**实现中无 keydown 处理器**（见 DESIGN_GAP）

### z-index 冲突

- `.resize-handle` z-index: 50（layout.css:173）< drawer-overlay z-index: 100 < drawer z-index: 101 ✅
- 无冲突，handle 不会遮挡 drawer

### AI Slop 检查

- 无紫色/violet 渐变 ✅
- 无泛化文案 ✅
- 颜色使用 `var(--c-accent)` 主题变量 ✅
- 间距使用 `var(--space-*)` 变量 ✅

## 发现的问题

### [MINOR] onMouseUp 取消 rAF 导致最后一次 mousemove 宽度未持久化

```
[INTERACTION] 拖拽结束后 localStorage 保存的宽度可能滞后一帧
  文件：useSidebarResize.ts:50-55  问题：onMouseUp 中 cancelAnimationFrame(rafId) 取消了最后一次
        mousemove 注册的 rAF，导致 setCssVar 未执行。随后 readCurrentWidth 读取的是倒数第二次
        mousemove 设置的 CSS var 值（过时），saveWidth 保存过时值到 localStorage。
  影响：拖拽结束后刷新页面，宽度可能比拖拽结束时的视觉宽度少一帧的 delta（通常 <8px）。
        视觉上无感知（CSS var 已被前面的 rAF 设置为接近值），但 localStorage 持久化值有偏差。
  测试未捕获原因：测试中 dispatchMouseMove 同步 flushRaf()，rAF 在 mouseup 前已执行。
  Fix：onMouseUp 中不 cancel rAF，而是同步执行最后一次 setCssVar，或直接用最后一次计算的
       clamped 值 saveWidth。例如：
       ```ts
       function onMouseUp(): void {
         dragging = false
         document.removeEventListener('mousemove', onMouseMove)
         document.removeEventListener('mouseup', onMouseUp)
         document.body.classList.remove('resize-active')
         if (rafId !== null) {
           cancelAnimationFrame(rafId)
           rafId = null
         }
         const finalWidth = readCurrentWidth(config)  // ← 可能是过时值
         saveWidth(finalWidth)
       }
       ```
       建议改为在 onMouseMove 中记录最后一次 clamped 值，onMouseUp 直接 saveWidth(lastClamped)。
```

**定级**：MINOR（非 BLOCKER）。视觉宽度正确（CSS var 已设置），仅 localStorage 持久化值有 ≤1 帧偏差。建议 P5/P6 阶段定向修复。

### [INFO] min/max CSS 变量未使用

```
[VISUAL] variables.css 新增的 min/max 变量是死代码
  文件：variables.css:33-36  问题：定义了 --sidebar-width-min/max, --toc-width-min/max，但
        composable 配置硬编码 minPx:160/maxPx:500/minPx:150/maxPx:400，CSS 变量无任何引用。
  影响：无功能影响，但 min/max 值有两处定义源（CSS 变量 + composable 配置），未来修改可能不同步。
  Fix：要么在 composable 中读取 CSS 变量值（getComputedStyle），要么移除 variables.css 中的死变量。
```

**定级**：INFO（非 BLOCKER）。P2-design.md:23 声明"新增 min/max 变量"，实现按声明添加了，但未实际使用。可在后续清理。

### [INFO] P3 契约 currentWidth: Ref<number> 未实现

```
[INTERACTION] composable 返回值偏离 P3 接口契约
  文件：useSidebarResize.ts:104-110  问题：P3-test-cases.md:199 声明 UseSidebarResizeReturn 含
        currentWidth: Ref<number>，实际未返回（只返回 startDrag/loadWidth/saveWidth/onDoubleClick/cleanup）。
  影响：无功能影响（组件未使用 currentWidth），但偏离 P3 接口契约。
  Fix：如需遵循契约，添加 const currentWidth = ref(defaultPx) 并在 setCssVar 时同步更新；或在 P3 契约中移除该字段声明。
```

**定级**：INFO（非 BLOCKER）。组件未依赖 currentWidth，功能完整。

### [DESIGN_GAP] P2-design keydown 键盘箭头调整未实现

```
[INTERACTION] 键盘箭头调整宽度未实现
  文件：useSidebarResize.ts + EntryDetailContent.vue  问题：P2-design.md:122-124 声明
        "keydown: ArrowLeft/ArrowRight → 宽度 ±8px（参照 ARIA separator 规范）"，
        但实现中无 keydown 处理器（composable + template 均无 @keydown 绑定）。
  影响：键盘用户可 Tab 聚焦 handle（BDD-16 通过），但聚焦后按箭头键无反应。
        ARIA separator 规范建议键盘可调整，缺失影响可访问性完整性。
  Fix：在 composable 中添加 onKeyDown(e: KeyboardEvent) 方法，ArrowLeft/Right 调整 ±8px 并 setCssVar + saveWidth；
       在 template 中绑定 @keydown="fileResize.onKeyDown($event)"。
```

**定级**：INFO（非 BLOCKER）。P1 BDD-16 只声明"键盘可聚焦"，未声明"键盘可调整宽度"。BDD-16 测试通过。但 P2-design 明确声明了此能力，实现缺失是设计偏离。建议在 P6 验收前补全或更新 P2-design 声明。

## BDD 覆盖完整性

P3 测试矩阵 16 条 BDD，composable 单测覆盖 BDD-01~07, 12~16（11 条），E2E 覆盖 BDD-08~11（4 条）。实现满足所有 BDD 验收条件。

## DESIGN_GAP_REVIEWED

- P4-implementation.md 声明"无 DESIGN_GAP"——实际有 1 个：keydown 键盘箭头调整未实现（P2-design.md:122-124）。此 GAP 为 INFO 级，不阻断推进。
- P4-implementation.md 声明"无 SCOPE+"——确认无范围外改动。

## 环境隔离

[PROD_NOT_TOUCHED]

评审过程仅读取源码文件，未启动服务、未操作数据库、未触碰生产环境。

## 评审维度评分（0-10）

| 维度 | 评分 | 说明 |
|------|------|------|
| P2-design 遵循度 | 8/10 | 核心方案完全遵循，keydown 键盘调整缺失（INFO） |
| P2-review ISSUE 修复 | 10/10 | 3 个 ISSUE 全部正确解决 |
| 代码规范 | 9/10 | 遵循 useViewMode/useResponsiveLayout 模式，min/max 变量死代码（INFO） |
| 交互状态覆盖 | 9/10 | hover/focus-visible/dblclick/drag 全覆盖，键盘箭头缺失（INFO） |
| 移动端/zen-mode | 10/10 | 断点正确，双重隐藏保险 |
| 可访问性 | 8/10 | role/tabindex/aria/focus-visible 全覆盖，keydown 箭头缺失 |

## 总结

实现质量良好，核心功能（拖拽调整宽度 + localStorage 持久化 + clamp + 双击 reset + 移动端/zen-mode 隐藏）完整实现。P2-review 3 个 ISSUE 全部正确解决。发现 1 个 MINOR 竞态问题（onMouseUp rAF 取消导致持久化值滞后 ≤1 帧）和 3 个 INFO 级偏离，均非 BLOCKER。建议 P5/P6 阶段定向修复 MINOR 竞态问题，INFO 级问题可酌情处理。
