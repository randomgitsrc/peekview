---
phase: P1
task_id: T052-entry-detail-header-redesign
type: problems
parent: P0-brief.md
trace_id: T052-P1-20260710
status: draft
created: 2026-07-10
agent: analyst
---

# P1 需求基线：Entry Detail header 重新设计

## 1. 需求复述

| # | 需求 | 原始来源 | 调用端 | 备注 |
|---|------|---------|--------|------|
| R1 | 桌面 header 从 4 行压缩到 2 行（~78px），labeled buttons（34px）改为 icon-only（32px） | P0-brief | EntryDetailView.vue template + layout.css | title-row + meta-row 两行 |
| R2 | 桌面新增 Files toggle 和 TOC toggle 按钮，分别是 multi-file 和 markdown 条件显示，点击打开/关闭侧边面板 | P0-brief / DESIGN-SPEC §2.2 | EntryDetailView.vue title-row | 当前 desktop 没有这两个按钮 |
| R3 | 桌面 More▾ 下拉菜单收纳次要操作（Download/Pack/Raw/Delete） | P0-brief | OverflowMenu.vue | 当前 header 中 labeled buttons 外露 |
| R4 | Meta 行用「│」竖线分隔"身份+时间"和"互动+标签"两组 | P0-brief / DESIGN-SPEC §2.2 | EntryDetailView.vue meta-row | 当前用 · 分隔全部平铺 |
| R5 | 移动端底部栏 48px，布局 [Files(N)] [flex:1] [动态按钮] [...] | P0-brief / DESIGN-SPEC §3.4 | EntryDetailView.vue bottom-bar | Files 回到底部栏左侧 |
| R6 | 底部栏按文件类型变化：.md→[TOC]；文本/代码→[Wrap][Copy]；二进制/图片→[...] | P0-brief / DESIGN-SPEC §3.4 | EntryDetailView.vue bottom-bar | isMarkdown / isBinary / isMultiFile 控制 |
| R7 | ThemeToggle 从 FAB 移到 overflow bottom sheet 中，使用 Lucide SVG（非 emoji） | P0-brief | ThemeToggle.vue + OverflowMenu.vue | 桌面端保留在 title-row；移动端在 sheet 顶部 |
| R8 | Overflow 内容桌面/移动端相同（desktop=dropdown, mobile=bottom sheet） | P0-brief / DESIGN-SPEC §2.4/§3.5 | OverflowMenu.vue | 需 variant prop |
| R9 | 移动端 sticky header 52px（毛玻璃），meta-tags-bar 随滚动隐藏 | P0-brief / DESIGN-SPEC §3.2/§3.3 | EntryDetailView.vue | Intersection Observer |
| R10 | Lucide SVG 替换原有 emoji 图标 | P0-brief | ThemeToggle.vue + OverflowMenu.vue | moon/sun/globe/download 等 |

## 2. 隐含需求识别

### D1. OverflowMenuItem 接口扩展

- **描述**：当前 `OverflowMenuItem` 接口的 `icon` 字段为 `string`（接收 emoji 字符串），缺少 `hint` 字段（右对齐提示文字，如"Currently Public""Permanently""5 files"）。
- **为什么必须**：新设计 all overflow items 都有 hint 文字（DESIGN-SPEC §2.4/§3.5），且图标从 emoji 改为 Lucide SVG。需要接口变更。
- **影响**：`OverflowMenu.vue` 接口定义 + `EntryDetailView.vue` 中 `overflowItems` computed 逻辑。

### D2. Desktop sidebar 交互模式未定（P0-brief 已知风险）

- **描述**：Files/TOC toggle 按钮点击后，sidebar 面板的交互行为（左/右位置、overlay 还是 push、能否同时打开 files 和 toc、是否复用移动端 280px drawer 样式）未定义。
- **为什么必须**：P2 architect 需要先决策这些交互模式，P4 才能实现。P0-brief 已注明"P2 需补设计"。
- **影响**：`P2-design.md` 必须包含 `minimal_validation` 块。

### D3. OverflowMenu.vue 需要 dual-mode 支持

- **描述**：当前只支持 dropdown（`position: absolute; bottom: 100%`），需要扩展支持 bottom sheet（自底弹出 + overlay + drag handle + 圆角顶）。
- **为什么必须**：DESIGN-SPEC §2.4 要求桌面 dropdown，§3.5 要求移动端 bottom sheet，内容相同但渲染形式不同。
- **影响**：`OverflowMenu.vue` template/scoped CSS 需新增 `variant="dropdown" | "sheet"` prop。

### D4. ThemeToggle 两种渲染形态

- **描述**：桌面 title-row 需要 standalone icon button（32×32），移动端 overflow sheet 中需要作为列表项（带 label+hint）。
- **为什么必须**：同一组件需要在不同场景以完全不同 HTML 结构渲染。
- **影响**：`ThemeToggle.vue` 需支持 `variant` prop 或由 OverflowMenu 直接内联。

### D5. Meta 行时间格式未定

- **描述**：meta-row 中的时间显示格式，当前使用相对时间（"3h ago"），DESIGN-SPEC 沿用了相对时间。但 P0-brief noted "有分歧"。
- **为什么必须**：影响 meta-row 的显示内容和 width 计算。
- **影响**：标记 `[NEED_CONFIRM]`，主 Agent 需确认。

### D6. 移动端 scroll-hide 机制变更

- **描述**：当前隐藏 `.header-tags`（CSS max-height transition + scroll 事件），新设计需要隐藏 `.meta-tags-bar`（包含 user+status+tags），且用 Intersection Observer 触发。
- **为什么必须**：行为不同，CSS 和 JS 逻辑都需要重写。meta-tags-bar 在内容区顶部，不在 header 内。
- **影响**：`EntryDetailView.vue` template + `<script>` 中的 scroll listeners。

### D7. Desktop Files sidebar 当前无条件显示

- **描述**：当前 `showFileSidebar` 直接等于 `isMultiFile`（DESIGN-SPEC §2.2 仅 multi-file 显示）。新设计需要有 toggle 开关能力——默认关，点击 Files button 才开。
- **为什么必须**：当前 sidebar 永远显示，新设计需要 toggle。
- **影响**：`EntryDetailView.vue` template 中 `showFileSidebar` computed 逻辑变更 + 新增 `isFileTreeOpen` ref。

### D8. Share 按钮行为变化

- **描述**：当前 Share 按钮只在 overflow menu 中（仅 owner），新设计中 Share 作为独立 icon button 在 title-row 显示（owner only）。
- **为什么必须**：Share 从二次操作提升为主要操作，需要位置和行为变更。
- **影响**：`EntryDetailView.vue` template 中 desktop title-row 的 Share button。

### D9. Make Public/Private 从 desktop header 移除

- **描述**：当前 Make Public/Private 是 desktop header 中的 labeled button，新设计中移至 More▾ dropdown。
- **为什么必须**：减少 header 视觉重量，仅保留通用操作在 title-row。
- **影响**：`EntryDetailView.vue` template 中 header-actions-row 需移除 Visibility toggle labeled button。

### D10. Overflow 删除已有 labeled buttons（Download / Wrap / Copy / Raw / Pack / TOC / Delete / Share + visibility）

- **描述**：当前 desktop header-actions-row 中有这些 labeled buttons，新设计将其中大部分移到 More▾ dropdown 或改为 icon-only。
- **为什么必须**：从 4 行→2 行必须清理当前所有 labeled buttons。
- **影响**：`EntryDetailView.vue` template 中 desktop `header-actions-row` 区块大部分内容需要删除或改为 icon-only。

### D11. 溢出内容提示 label 国际化（非必需，不阻塞）

- **描述**：Overflow item hint 文字（"Currently Public""Create share link""Permanently"）目前仅英文。当前产品无 i18n 支持。
- **为什么必须**：无 i18n 需求，但 hint 文字的来源（计算属性？静态字符串？）需要在 P2 决定。
- **影响**：标注 `[NEED_CONFIRM]` — 是否硬编码为英文。

### D12. 前端单测需要更新 [SCOPE_RESOLVED: lucide-vue-next install + header-layout.test.ts 作废]

- **描述**：当前可能有测试依赖旧 header DOM 结构（selector、element existence）。
- **为什么必须**：破坏性 DOM 变更可能导致现有 vitest 测试失败。
- **影响**：P3 test-designer 需识别受影响的测试并更新。

### D13. 响应式行为一致性

- **描述**：当前使用 1024px 和 768px 断点。新设计需确保在 768-1023px 区间的行为明确定义（当前视为 desktop，新设计是否保持？）。
- **为什么必须**：断点行为影响 header/mobile-actions 的显示/隐藏。
- **影响**：`layout.css` 和 `EntryDetailView.vue` scoped CSS 中的 media queries。

### D14. OverflowMenu hint 文字需要响应 entry/file 状态

- **描述**：hint 文字是动态的：Download hint = 当前文件扩展名（`".md"`），Pack hint = 文件数（`"5 files"`），Make Private hint = 当前状态（`"Currently Public"`）。
- **为什么必须**：hint 不是静态字符串，需要 computation。
- **影响**：`overflowItems` computed 中每项 hint 的计算逻辑。

### D15. 移动端 Files 按钮的 file count badge 需要实时响应

- **描述**：当前 mobile-actions 只静态放了 Files(X)，新设计 badge 数字需要从 `currentEntry.files.length` 计算。
- **为什么必须**：已存在 `isMultiFile` 但 badge 数字需要显式从 entry 获取。
- **影响**：`EntryDetailView.vue` template 绑定。

### D16. 桌面 More▾ 下拉方向

- **描述**：当前 OverflowMenu dropdown 在 trigger 下方。More▾ 在 title-row 底部，新设计应向下展开（`top: 100%`），而非当前向上（`bottom: 100%`）。
- **为什么必须**：DESIGN-SPEC §2.4 显示 overflow 出现在 More▾ 按钮下方。
- **影响**：`OverflowMenu.vue` CSS positioning。

## 3. BDD 验收条件

### B1: 桌面 header 高度压缩到 ~78px
Given 用户以 ≥1024px 视口打开 entry 详情页
When 页面渲染完成
Then header 元素的高度 ≤ 80px

### B2: 桌面 title-row icon-only 按钮为 32×32
Given 桌面视口
When 渲染 entry 详情页 header
Then title-row 中的 action buttons（Copy/Share/Files/TOC/ThemeToggle）均为 32×32 尺寸

### B3: Files toggle 按钮仅 multi-file 条目标题行显示
Given 条目有 >1 个文件
When 桌面 header 渲染
Then Files toggle 按钮可见

Given 条目只有 1 个文件
When 桌面 header 渲染
Then Files toggle 按钮不存在

### B4: TOC toggle 按钮仅 markdown 有 heading 时显示
Given 当前文件类型为 markdown 且 tocHeadings.length > 0
When 桌面 header 渲染
Then TOC toggle 按钮可见

Given 当前文件类型非 markdown 或 tocHeadings.length === 0
When 桌面 header 渲染
Then TOC toggle 按钮不存在

### B5: Files/TOC toggle 按钮有 active 态
Given Files/TOC sidebar 当前打开
When 对应的 toggle 按钮渲染
Then 按钮具有 active CSS class（蓝色高亮）
And 点击后 sidebar 关闭，active 移除

### B6: Meta 行用竖线分隔两组信息
Given 桌面 header 渲染
When 查看 meta-row
Then "身份+时间"组和"互动+标签"组之间有一条竖线分隔符（`│` 或 CSS border）

### B7: 桌面 More▾ dropdown 收纳正确操作列表
Given 用户是 entry owner，条目为 multi-file
When 点击 More▾ 按钮
Then dropdown 包含：Make Private / Share / Download / Download as Pack / Raw content / Table of Contents / Delete entry

Given 用户是访客
When 点击 More▾ 按钮
Then dropdown 不包含 Make Private / Share / Delete entry

### B8: 移动端底部栏 48px
Given 视口 < 1024px
When 页面渲染
Then 底部栏高度为 48px，布局为 [Files(N)] [flex:1] [动态按钮] [...]

### B9: 移动端底部栏按文件类型动态变化
Given 当前文件类型为 .md
When 底部栏渲染
Then 显示 [TOC]（primary）和 [...] 按钮，不显示 [Wrap][Copy]

Given 当前文件类型为文本/代码且 isMarkdown===false 且 isBinary===false
When 底部栏渲染
Then 显示 [Wrap] 和 [Copy]（primary）和 [...] 按钮

Given 当前文件类型为二进制/图片（isBinary===true）
When 底部栏渲染
Then 只显示 [...] 按钮

### B10: 移动端 sticky header 52px 毛玻璃
Given 视口 < 1024px
When 页面渲染
Then sticky header 高度 52px，背景带 `backdrop-filter: blur(16px)`

### B11: 移动端 meta-tags-bar 随滚动隐藏
Given 视口 < 1024px
When 页面刚加载
Then meta-tags-bar 可见

When 用户向下滚动使 sticky header 出现
Then meta-tags-bar 渐隐（opacity transition）

### B12: ThemeToggle 移动端在 overflow bottom sheet 中
Given 视口 < 1024px
When 点击底部栏 [...] 按钮
Then bottom sheet 打开，顶部第一个分组包含 Dark theme 切换项（Lucide moon/sun icon）

### B13: ThemeToggle 桌面端在 title-row 中
Given 视口 ≥ 1024px
When 页面渲染
Then title-row 最右侧显示 32×32 theme button（Lucide moon/sun icon，非 emoji）

### B14: Overflow 内容桌面/移动端一致
Given 同一 entry 同一用户角色（owner/guest）
When 比较 desktop dropdown 和 mobile bottom sheet 的 item 列表
Then 两者内容完全一致（仅渲染形式不同）

### B15: Lucide SVG 图标替换所有 emoji
Given 渲染 entry detail 页面的全部 header/overflow 区域
When 检查所有图标元素
Then 无 emoji 字符用作图标（所有图标为 Lucide SVG）

### B16: Share 按钮在桌面 title-row 独立显示（owner only）
Given 当前用户为 entry owner 且条目为 private
When 桌面 header 渲染
Then title-row 中独立显示 Share icon button

Given 当前用户非 owner
When 桌面 header 渲染
Then title-row 不显示 Share icon button

## 4. 待确认清单

| ID | 待确认项 | 背景 | 影响面 |
|----|---------|------|--------|
| NC1 | Meta 行时间格式：相对时间（"3h ago"）还是绝对时间（"2026-07-10"）？DESIGN-SPEC 沿用相对时间，P0-brief noted "有分歧" | P0-brief 已知风险 | P2/P4 |
| NC2 | Desktop sidebar 交互模式：Files/TOC sidebar 是 overlay 还是 push？左/右位置？能否同时打开？是否复用移动端 280px drawer 样式？ | P0-brief 已知风险，注明 P2 补设计 | P2 |
| NC3 | Overflow hint 文字是否硬编码英文？当前产品无 i18n，但需要明确方向 | 隐含需求 D11 | P2/P4 |
| NC4 | 桌面端 Copy 按钮是否始终显示？当前仅 `canCopy` 时显示。新设计仍保留条件显示或始终显示？ | DESIGN-SPEC 未明确条件 | P2/P4 |

## 5. 裁剪说明

```yaml
complexity: medium
risk_level: low
domains: [frontend]
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
pruning:
  P1: "已执行（本文件）"
  P2: "不可裁剪。需要设计 sidebar 交互、overflowMenu dual-mode 架构、svg icon 策略"
  P3: "不可裁剪。5+ 文件改动 + OverflowMenuItem 接口变更 + 大量 DOM 结构变化需测试覆盖"
  P4: "实现"
  P5: "技术验证"
  P6: "不可裁剪。UI 重设计需要视觉验收（Playwright 截图）"
  P7: "不可裁剪。≥5 个文件改动，需检查多文件一致性和接口对齐"
  P8: "前端 build + 发布准备"
single_agent_mode: false
```

## 6. 范围声明

```yaml
domains:
  - frontend      # Vue template/CSS/script 修改
packages:
  - peekview      # 前端 bundled with PyPI package（含 frontend-v3/）
risk_level: low   # UI only，无数据/schema/auth 变更
```

## 7. [SCOPE+] 增补记录

| ID | 来源 | 发现 | 解决 |
|----|------|------|------|
| S1 | P2-design.md §6 | 需要安装 `lucide-vue-next` npm 包（P1 未覆盖 DESIGN.md §7 约定） | [SCOPE_RESOLVED] P4 需先 `npm install lucide-vue-next` |
| S2 | P2-design.md §6 | 现有 `header-layout.test.ts` 断言旧 DOM 结构，全部作废 | [SCOPE_RESOLVED] P3 测试设计师需重写或替换 |

## 8. 能力需求声明

```yaml
capability_requirements:
  - need: browser-testing
    why: P6 验收需要 Playwright 截图验证 桌面/mobile 各状态的 header 渲染
    available:
      - "playwright-cdp skill（Chrome CDP :18800）"
      - "vision-helper subagent（截图分析）"
      - "vision-analyzer skill（备用）"
    status: available

  - need: vue-tsc typecheck
    why: CI 强制 vue-tsc --noEmit 门禁，接口变更需要类型检查通过
    available:
      - "npx vue-tsc --noEmit（本地运行）"
    status: available

  - need: vitest runner
    why: 前端单测需要更新后运行确认不破坏
    available:
      - "cd frontend-v3 && ./node_modules/.bin/vitest run"
    status: available

  - need: ruff lint
    why: 后端门禁（不影响本任务，仅触及 frontend）
    available:
      - "cd backend && python3 -m ruff check peekview/ tests/"
    status: available
```
