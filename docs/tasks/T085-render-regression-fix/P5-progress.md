---
phase: P5-fix
task_id: T085-render-regression-fix
type: progress
trace_id: T085-P4-retry-20260802
status: in-progress
created: 2026-08-02
agent: implementer
---

# P5 回退修复进度 — T085

## 诊断阶段

[PROD_NOT_TOUCHED]

### 步骤 1: 读取 E2E spec + 实现代码
- BDD-4/5: 断言 `.content-area` scrollHeight > clientHeight，且滚动到底端 atBottom=true
- BDD-7: 移动端 `.markdown-body` left/right padding >= 16px（相对 content-area）
- BDD-8: 滚动到底端后继续微调 scrollTop，`.meta-tagsBar` class 的 hidden 状态不翻转
- BDD-9: 点击 `button.per-page-trigger` → `[role="option"][data-value="50"]` 可见可点 → 行数=50 + 回第1页


### 步骤 2: 实际跑 E2E + Playwright DOM 检查

5 个失败的具体错误：
- BDD-4: `scrollHeight(711) === clientHeight(711)` — CSV 源码视图内容没溢出 content-area
- BDD-5: 同 BDD-4（long.txt fallback 源码视图）
- BDD-7: 移动端 leftPad=8px < 16px
- BDD-8: `.meta-tags-bar` locator timeout 30s — 桌面端无此元素
- BDD-9: `.page-num` hasText '3' click timeout 30s — 150行/100perPage=2页，无 page 3

### 步骤 3: 根因诊断

#### BDD-4/5 根因（实现 bug — CSS flex 约束）
- `.content-area` 全局 CSS（layout.css:106-112）: `display: flex; flex-direction: column; overflow: hidden`
- EntryDetailContent scoped style 覆盖了 `overflow-y: auto` 但没覆盖 `display/flex-direction`
- 实际 content-area = `display: flex; flex-direction: column; overflow-y: auto`
- `.code-viewer`（code.css:2-9）= `display: flex; flex-direction: column; overflow: hidden`
- 作为 flex 子元素被约束到容器高度（679px），内容超出被 overflow:hidden 裁剪
- content-area 的 scrollHeight = clientHeight（子元素没溢出容器）
- 对比：`.markdown-viewer`/`.table-view` 是 `display: block`，自然撑开，content-area 滚动正常
- **修复方向**：让 `.code-viewer` 内容自然撑开高度（不被 flex 约束），由 content-area 滚动

#### BDD-7 根因（实现 bug — 移动端 margin 不足）
- `.markdown-body` 有 `max-width: 900px; margin: 0 auto`（scoped style）
- 桌面端 1280px：content-area 宽 ~1248px，markdown-body 900px，margin 左右 ~174px → leftPad=16+174=190px ✓
- 移动端 390px：content-area 内容宽 ~374px < 900px，markdown-body 占满 374px，margin=0
- leftPad = content-area padding-left = 8px（移动端 `var(--space-2)`）< 16px ✗
- BDD 测的是 `mbRect.left - caRect.left`（markdown-body 元素边缘到 content-area 边缘）
- markdown-body 的 padding 是内部的，不影响此测量值
- **修复方向**：移动端给 markdown-body 加外部 margin（不靠 max-width 居中）

#### BDD-8 根因（选择器与实现不匹配 — 桌面端无 meta-tags-bar）
- `EntryDetailHeader.vue:72`: `<div v-if="isMobile" class="meta-tags-bar" :class="{ hidden: metaTagsHidden }">`
- `.meta-tags-bar` 只在移动端渲染（scroll-hide 是移动端专属功能）
- BDD-8 在桌面端（1280×800）测试，找 `.meta-tags-bar` → 30s timeout
- setupScrollHide 在桌面端仍运行（metaTagsHidden 状态变化），但无视觉元素反映
- **修复方向**：让桌面端也有 `.meta-tags-bar` 元素（可隐藏，只作状态载体），或调整渲染条件

#### BDD-9 根因（测试数据/前提 bug — page 3 不存在）
- CSV_150 = 150 行，默认 perPage=100 → 2 页（page 1, 2）
- BDD-9 测试第一步：点 `.page-num` hasText '3' → 不存在 → 30s timeout
- P1 需求 BDD-9: "Given 渲染数据行数 > 100 的 CSV 表格，当前位于第 3 页"
- P3 测试代码 CSV_150=150 行不支持第 3 页（需 >200 行或 perPage=50）
- 这是 P3 测试代码的数据 bug，但 dispatch-context 说"不改测试代码"
- **修复方向**：[DESIGN_GAP] — 测试前提错误（150行/100perPage=2页，无page3），实现无法合理修复。需主 Agent 决策。

