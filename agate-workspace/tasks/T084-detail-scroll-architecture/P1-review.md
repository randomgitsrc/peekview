---
phase: P1
task_id: T084-detail-scroll-architecture
type: review
parent: P1-requirements.md
trace_id: T084-P1-review-20260731
status: approved
created: 2026-07-31
agent: requirements-review
---

# P1 需求基线复审 — T084 详情页滚动架构统一

## 评审方法

复审轮：逐条验证上一轮 needs-revision 的 5 项修改是否到位，并复核修订未引入新问题。交叉读取 P1-requirements.md 修订内容与实际代码（EntryDetailHeader.vue L67 `v-if="isMobile"`、markdown.css L2-3 padding 声明、DiagramBlock.vue `.diagram-viewer` 高度），确认修订事实声明准确。

## 上一轮 needs-revision 逐条验证

### 修订项 1: BDD-06（逻辑矛盾）— 已修复 ✅

上一轮问题：桌面端不渲染 meta-tags-bar（`EntryDetailHeader.vue` L67 `v-if="isMobile"`），Then "meta-tags-bar 不受影响"在桌面端无意义。

修订内容（P1 L115-118）：
- Given 桌面端（>640px）详情页
- When 页面渲染完成并检查 DOM
- Then `.meta-tags-bar` 元素不在 DOM 中（`document.querySelector('.meta-tags-bar')` 返回 null），且 `metaTagsHidden` 响应式状态保持初始值 false（scroll-hide 逻辑未触发）

验证：Then 现有两个精确二值条件——① `document.querySelector('.meta-tags-bar')` 返回 null（DOM 不存在，与 L67 `v-if="isMobile"` 一致）② `metaTagsHidden` 保持 false（scroll-hide 未触发）。两个条件均可明确 PASS/FAIL。逻辑矛盾已消除。

### 修订项 2: BDD-07（不可二值判定）— 已修复 ✅

上一轮问题："标题顶部距 content-area 顶部约 80px"中"约"无明确容差。

修订内容（P1 L125）：
- Then 对应标题可见且不被 sticky header 遮挡（标题顶部距 `.content-area` 顶部的偏移量在 `80px ± 5px` 范围内，即 `75px ≤ offsetTop ≤ 85px`）

验证：容差范围明确为 `80px ± 5px`，并给出等价不等式 `75px ≤ offsetTop ≤ 85px`。`offsetTop` 是可测量的数值，二值判定无歧义。80px 对应 markdown.css L4 `scroll-margin-top: 80px`，数值来源有据。

### 修订项 3: BDD-08（不可二值判定）— 已修复 ✅

上一轮问题："不超过一层 padding 的宽度"缺少明确基准，无法二值判定。

修订内容（P1 L129-132）：
- Given 移动端详情页打开一个 markdown 文件
- When 检查 `.content-area` 和 `.markdown-body` 的 computed padding
- Then `.content-area` 的 `paddingTop` 为 `0px`（`getComputedStyle(.content-area).paddingTop === '0px'`），padding 仅由 `.markdown-body` 单层承担

验证：Then 现在是精确的 computed style 断言 `getComputedStyle(.content-area).paddingTop === '0px'`，可二值判定。明确了 padding 归属决策：content-area padding 归零，markdown-body 单层承担。"padding 仅由 `.markdown-body` 单层承担"是描述性说明，判定依据是前半句的精确条件。

### 修订项 4: IR-GAP-1（packages 遗漏 + IR-4 不完整）— 已修复 ✅

上一轮问题：① packages 列表遗漏 `frontend-v3/src/styles/markdown.css` ② IR-4 未说明 markdown.css 中也有 `.markdown-body` padding 声明。

修订内容验证：
- packages 列表（P1 L209）：已补充 `frontend-v3/src/styles/markdown.css` ✅
- IR-4（P1 L48-58）：已完整记录三处 padding 声明——① MarkdownViewer.vue L130-131 scoped `padding: 2rem` ② markdown.css L2 全局 `padding: var(--space-5)` ③ markdown.css L3 移动端 `padding: 1.25rem`。并新增"额外约束"段落（L58）明确要求 P2 需决定是否同步清理 markdown.css 全局声明 ✅

代码交叉验证：markdown.css L2 确实是 `padding: var(--space-5)`，L3 确实是 `@media (max-width: 640px) { .markdown-body { padding: 1.25rem; } }`，与 P1 声明一致。

### 修订项 5: IR-GAP-2（DiagramBlock 覆盖性声明缺失）— 已修复 ✅

上一轮问题：P1 未声明 DiagramBlock 及子渲染器不受影响，缺少覆盖性论证。

修订内容（P1 L32）：IR-1 新增覆盖性声明段落——"DiagramBlock 及其子渲染器（MermaidRenderer/SvgRenderer/PlantUmlRenderer）不受本次改动影响。`.diagram-viewer` 有 `overflow: hidden; height: 400px` 固定高度，子渲染器的 `height: 100%` 参考的是 `.diagram-viewer` 的 400px，不依赖 content-area 高度，不抢纵向滚动，无需改动。"

验证：声明完整，覆盖了 DiagramBlock + 3 个子渲染器，给出了不抢滚动的技术依据（固定 400px 高度 + overflow:hidden），结论明确（无需改动）。P2 architect 无需重复排查。

## BDD 评审（全量复核）

### BDD-01: MarkdownViewer 内容超出视口时由 content-area 滚动
- **判定：PASS（可二值判定）**
- Then 用 `.content-area` scrollTop 增大 + `.markdown-viewer` scrollTop 保持 0 做二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-02: CodeViewer 内容超出视口时由 content-area 滚动
- **判定：PASS（可二值判定）**
- Then 用 scrollTop 对比做二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-03: CodeViewer 保留横向滚动
- **判定：PASS（可二值判定）**
- Then 用 scrollLeft 增大做二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-04: 移动端向下滚动隐藏 meta-tags-bar
- **判定：PASS（可二值判定）**
- Then "高度坍缩为 0 或 opacity 为 0"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### BDD-05: 移动端向上滚动恢复 meta-tags-bar
- **判定：PASS（可二值判定）**
- Then "恢复可见（高度和 opacity 恢复正常）"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-06: 桌面端不渲染 meta-tags-bar 且 scroll-hide 不触发
- **判定：PASS（可二值判定）** — 上一轮 needs-revision 已修复
- Then 两个精确二值条件：① `document.querySelector('.meta-tags-bar')` 返回 null ② `metaTagsHidden` 保持 false
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-07: 点击 TOC 标题锚点滚动到正确位置
- **判定：PASS（可二值判定）** — 上一轮 needs-revision 已修复
- Then `75px ≤ offsetTop ≤ 85px`，明确容差范围，可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-08: 移动端 markdown 内容只有一层 padding
- **判定：PASS（可二值判定）** — 上一轮 needs-revision 已修复
- Then `getComputedStyle(.content-area).paddingTop === '0px'`，精确 computed style 断言，可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✗ 兼容✓

### BDD-09: HtmlViewer iframe 仍正确撑满
- **判定：PASS（可二值判定）**
- Then iframe 高度等于 `.content-area` clientHeight，可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-10: ImageViewer 图片仍正确显示
- **判定：PASS（可二值判定）**
- Then "不因滚动架构改动而塌陷或溢出"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-11: 现有前端单测全部通过
- **判定：PASS（可二值判定）**
- Then "0 failed"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-12: 类型检查零错误
- **判定：PASS（可二值判定）**
- Then "0 errors"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-13: 前端构建成功
- **判定：PASS（可二值判定）**
- Then "构建成功，产物输出到 `backend/peekview/static/`"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

### BDD-14: DESIGN.md 包含 Scroll Architecture 决策
- **判定：PASS（可二值判定）**
- Then "包含「Scroll Architecture」小节"可二值判定
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓

## 隐含需求覆盖

### 数据维度：覆盖
- IR-1（HtmlViewer/ImageViewer height:100% 依赖）+ DiagramBlock 覆盖性声明 ✅
- IR-4（padding 归属）含三处 padding 声明完整记录 + markdown.css 同步约束 ✅

### 前端维度：覆盖
- IR-2（CodeViewer 横向滚动保留）✅
- IR-5（短代码视觉空旷）✅
- IR-6（setupScrollHide 简化）✅
- IR-7（footnote 锚点）✅

### 多端维度：覆盖
- IR-3（t049 E2E 测试 window.scrollTo 问题）✅

### 边界维度：部分覆盖（可接受）
- BDD-04 覆盖"超过 10px"阈值边界
- 空内容场景未显式声明，但属正确行为（不滚动→不触发 scroll-hide），不影响正确性，不构成遗漏

### 兼容维度：覆盖
- IR-8（DESIGN.md 补充）✅
- BDD-11/12/13 回归保障 ✅

## 裁剪评审

P1 声明 `phases: [P1, P2, P3, P4, P5, P6, P7, P8]`（无裁剪），理由逐条合理：

- P2 不可裁：涉及 4 组件 + 1 composable + 2 CSS 文件（code.css + markdown.css）+ DESIGN.md → **合理**
- P3 保留：setupScrollHide 逻辑变化有可测试行为 → **合理**
- P5 保留：vitest + vue-tsc + build 全绿验证 → **合理**
- P6 不可裁：UI 交互改动必须 Playwright 实跑 → **合理**
- P7 保留：多文件改动需交叉核对（IR-GAP-1 已证明 markdown.css 需纳入）→ **合理**
- P8 保留：产出文件 + bump-version → **合理**

**risk_level: medium** — 合理。4 组件 CSS/布局联动，不改后端/DB/schema/安全。

**capability_requirements** — browser-vision (available) + frontend-test-runner (available)，三态判断正确。

## P1 纯净性

**合格。** P1 定义问题和验收条件，未深入解决方案设计。IR-6 的 setupScrollHide 简化方向是复述 P0-brief 约束，IR-1 的 height:100% 保持是约束声明，均属隐含需求的技术约束说明，非方案设计越界。修订未引入新的纯净性问题。

## 评审结论

**Status: approved**

上一轮 needs-revision 的 5 项修改全部到位：

1. **BDD-06**：改为 `document.querySelector('.meta-tags-bar')` 返回 null + `metaTagsHidden` 保持 false，逻辑矛盾消除（L115-118）
2. **BDD-07**：改为 `75px ≤ offsetTop ≤ 85px`，容差明确（L125）
3. **BDD-08**：改为 `getComputedStyle(.content-area).paddingTop === '0px'`，精确 computed style 断言（L129-132）
4. **IR-GAP-1**：packages 补充 markdown.css（L209），IR-4 补充三处 padding 声明 + markdown.css 同步约束（L48-58）
5. **IR-GAP-2**：IR-1 补充 DiagramBlock 及子渲染器不受影响声明（L32）

14 条 BDD（BDD-01 至 BDD-14）全部可二值判定，编号连续，格式标准，每条单条 Given-When-Then。8 个隐含需求覆盖全面（数据✓ 前端✓ 多端✓ 边界✓部分 兼容✓）。裁剪合理，risk_level 匹配。修订未引入新问题。
