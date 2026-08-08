---
phase: P3
task_id: T090-mobile-detail-ux-polish
type: test-cases
parent: P2-design.md
trace_id: T090-P3-20260809
status: draft
created: 2026-08-09
agent: test-designer
---

# P3-test-cases — T090 移动端详情页 UX 打磨

```yaml
test_code_dir: frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts
```

> 单元测试范围说明：`useResponsiveLayout.ts` 保留导出（`isMobile`/`isDesktop`/`handleResize`）未新增专门单测——已核实这些逻辑被 `frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts`、`t067-detail-framework.spec.ts`、`t031-entry-detail-view.spec.ts`、`AuthButton.spec.ts` 等既有组件级测试间接覆盖（未变化），符合 dispatch-context「不需要新增关于已删除功能的单元测试」的指引。`useResponsiveLayout.spec.ts` + `useResponsiveLayout.boundary.spec.ts` 两个既有文件（T084/T085 遗留）完整覆盖的是本任务将要**删除**的 `setupScrollHide`/`metaTagsHidden`，P4 实现阶段删除这两个导出时需一并删除/改写这两个文件（否则 TS 编译失败），此为 P4 待办，不在 P3 新增测试范围内。

本任务 `ui_affected: true`，12 条 BDD 全部设计为 Playwright E2E（`frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts`），覆盖移动端 (390×844)、极小屏 (375×812)、桌面端 (1280×800) 三种 viewport，markdown + code 两类 viewer，单文件 + 多文件两类 entry。

## BDD → 测试用例映射表

| BDD | P1 描述 | 测试用例（test 名） | Viewport | Entry |
|---|---|---|---|---|
| BDD-1 | Markdown 移动端上滑无跳变 | `test_bdd_1_markdown_mobile_scroll_no_jump` | 390×844 | t090-long-markdown |
| BDD-2 | Code viewer 上滑行为与 markdown 一致 | `test_bdd_2_code_mobile_scroll_no_jump` | 390×844 | t090-long-code |
| BDD-3 | metadata 可见性完全由文档流位置决定，非方向触发 | `test_bdd_3_meta_bar_visibility_position_driven_not_direction_driven` | 390×844 | t090-long-markdown |
| BDD-4 | 底部操作栏在滚动全程屏幕坐标不变 | `test_bdd_4_bottom_bar_fixed_across_scroll_positions` | 390×844 | t090-long-markdown |
| BDD-5 | 底部操作栏不被两种可视高度下的地址栏遮挡 | `test_bdd_5_bottom_bar_not_occluded_two_viewport_heights` | 390×844→390×700 | t090-long-markdown |
| BDD-6 | 底部操作栏 markdown 场景按钮功能保持不变 | `test_bdd_6_bottom_bar_markdown_buttons_functional` | 390×844 | t090-md-multifile |
| BDD-7 | 底部操作栏 wrap 按钮功能保持不变（非 markdown/html） | `test_bdd_7_wrap_button_toggles_non_markdown_non_html` | 390×844 | t090-py-multifile |
| BDD-8 | markdown 移动端左右总留白相对基线缩减 ≥75% | `test_bdd_8_markdown_mobile_margin_reduced_75_percent` | 390×844 | t090-long-markdown |
| BDD-9 | 375px 极小屏无水平溢出/无文字截断 | `test_bdd_9_375px_no_horizontal_overflow_no_text_clip` | 375×812 | t090-long-markdown |
| BDD-10 | 桌面端 meta-tags-bar/header 滚动行为不变 | `test_bdd_10_desktop_meta_bar_scroll_behavior_unchanged` | 1280×800 | t090-long-markdown |
| BDD-11 | 桌面端 markdown 边距不变（`--space-5`=24px） | `test_bdd_11_desktop_markdown_padding_unchanged` | 1280×800 | t090-long-markdown |
| BDD-12 | 桌面端不出现移动端固定底部操作栏 | `test_bdd_12_desktop_no_mobile_bottom_bar` | 1280×800 | t090-long-markdown |

12 条 BDD ↔ 12 个测试用例，1:1 映射，无遗漏、无合并。

## 测试数据（beforeAll 通过 debug backend HTTP API 创建，未用 CLI，符合 AGENTS.md 铁律第 6 条）

| slug | 内容 | 用途 |
|---|---|---|
| `t090-long-markdown` | 单文件，60 个 heading + 段落的长 markdown | BDD-1/3/4/5/8/9/10/11/12 |
| `t090-long-code` | 单文件，150 行 python（fenced code） | BDD-2 |
| `t090-md-multifile` | 2 个 markdown 文件（index.md 含标题、notes.md） | BDD-6（`isMultiFile`+`isMarkdown`+`tocHeadings`触发 file-tree/toc/source-toggle/copy/overflow 全部按钮渲染） |
| `t090-py-multifile` | 2 个 python 文件（main.py、utils.py） | BDD-7（`canWrap`=true 场景，`entryDetail.ts` L18-24 已核实 markdown/html 时 `canWrap=false`，故 wrap 场景需要非 markdown 非 html 的代码类 entry） |

## 关键测试设计说明

### BDD-1/2/10：滚动"无跳变"的可编程判定（P2 dispatch-context 要求，不用主观描述）
以 `[data-testid="meta-tags-bar"]`（BDD-1/2，移动端）或 `[data-testid="markdown-body"]`（BDD-10，桌面端无 meta-tags-bar）为哨兵元素，在 `content-area` 的 scrollTop 按固定步长递增时，采样哨兵元素 `getBoundingClientRect().top` 的变化量，断言每一步的屏幕位移量与 scrollTop 增量之差 ≤2px（线性关系）。若存在因 header/meta-bar 折叠导致的文档流高度突变（当前 bug 根因），会在某一步产生远超 2px 的位移量偏差，测试将失败。

选用 `meta-tags-bar` 作为 BDD-1/2 的共同哨兵，是因为该组件按 P2 设计对所有 viewer 类型统一挂载（不区分 markdown/code），天然满足"跨 viewer 一致"的验证需求，且它本身正是当前跳变 bug 的直接肇因（header 内 `max-height` 折叠），修复后应随内容流稳定移动，是最直接的探针。

### BDD-3：位置驱动 vs 方向驱动的区分
核心测试手法：让页面通过两条不同路径（一路纯下滑、一路下滑超过后再上滑回退）到达**同一个** `scrollTop=300`，断言两次到达时 `meta-tags-bar` 的 `className`/`display`/`opacity`/`maxHeight` 完全相同，且 `className` 不含 `hidden` 字样。旧实现（`setupScrollHide` 按滚动方向翻转 `metaTagsHidden`）在这个测试下会产生不同的 `className`（`.hidden` 类是否存在取决于最后一次滚动方向，而非当前位置），因此本测试能有效区分"位置驱动"与"方向驱动"两种机制。

### BDD-4/5：底部栏稳定性
BDD-4 用 `boundingBox()` 在滚动 0/中/底三个位置采样，断言 x/y 坐标完全相等（`position: fixed` 不受滚动影响的直接验证）。BDD-5 用 `page.setViewportSize` 模拟两种可视高度（844→地址栏收起、700→地址栏展开，对应 P2 minimal_validation 已实测的方法），断言底部栏的 `y` 与 `y+height` 均落在对应视口高度内（不被裁切/推出视口）。

### BDD-6/7：按钮功能验证的选择器策略（严格遵循 P2 data-testid 清单，不用 class 名）
P2 清单内的目标元素（`mobile-bar-*-btn`、`overflow-menu-trigger`、`meta-tags-bar`、`mobile-bottom-bar`、`content-area`、`markdown-body`）全部用 `data-testid` 选择器。对于清单外、仅用于验证按钮点击**副作用**的中间态元素（文件抽屉/TOC 抽屉/更多菜单弹层/复制成功提示），项目里没有对应 data-testid，为避免使用易失效的 class 选择器，改用语义化定位：
- 抽屉：`page.getByText(/^Files ·/)` / `page.getByText(/^Table of Contents ·/)`（抽屉头部固定文案）
- source-toggle：既有 `aria-pressed` 属性（`EntryDetailMobileBar.vue:21` 已声明 `:aria-pressed="sourceViewMode"`）
- copy：`page.getByRole('status')`（`Toast.vue` 已有 `role="status"`）
- overflow：`overflow-menu-trigger` 的 `aria-expanded` 属性 + `page.getByRole('menu')`（`OverflowMenuSheet.vue` 根节点 `role="menu"`）

BDD-7（wrap）验证按钮 `class` 属性从不含 `primary` 变为含 `primary`（模板 `:class="[..., wrapEnabled && 'primary']"` 决定，非样式选择器而是状态断言，用 `getAttribute('class')` 读取后做子串匹配，不是用 class 做元素定位）。

### BDD-8：留白缩减比例的量化断言
不写死"≤10px"这类硬编码目标值（P1 修订已声明该值仅为参考），而是用公式 `(基线40px − 实测总留白) / 基线40px ≥ 0.75` 做比例判定，与 P1-requirements BDD-8 验收文字完全对齐，P2 最终选定的具体数值（候选 3-A 归零后为 8px，缩减 80%）会自然通过该公式，不需要每次数值调整都改测试。

### BDD-9：极小屏边界
`document.documentElement.scrollWidth <= 375` 判定无横向滚动条；`markdown-body` 的 `boundingBox()` x 范围完全落在 [0, 375] 内判定无溢出/无被裁切出视口。

### BDD-11：桌面端不回归
直接断言 `getComputedStyle(markdown-body).padding === '24px'`（`--space-5` 的实际计算值），而非"不低于"，与 P1 第 2 轮修订"消除相等与不低于并存歧义"的要求一致。

## 自检结果（红灯确认）

启动 `make debug-quick`（:8888，隔离数据目录 `/tmp/peekview-debug/`），执行 `BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/t090-mobile-detail-ux-polish.spec.ts --project=chromium` 实跑确认。

**发现并修正 1 处测试设计缺陷**：首次实跑 12/12 中 11 条红、1 条（BDD-12）**假绿**——`test_bdd_12_desktop_no_mobile_bottom_bar` 原设计只有一条 `toHaveCount(0)` 负向断言，在 `data-testid="mobile-bottom-bar"` 尚未在代码库任何地方实现时，"桌面端数量为 0"这个断言在移动端同样为 0（因为该 testid 根本不存在），因此在实现前就会**恒真通过**，不是有效红灯。修正方式：在断言桌面端不存在之前，先切到移动端 viewport 断言该元素确实 `toBeVisible()`（正向前置断言），把"桌面端不出现"与"该元素在移动端真实存在"绑定为同一测试，使其在实现前必然因移动端正向断言失败而红、在正确实现后才能真正转绿。修正后重跑单独确认：`test_bdd_12_desktop_no_mobile_bottom_bar` 现为红（`TimeoutError: waiting for locator('[data-testid="mobile-bottom-bar"]')`，B 类）。

**最终确认结果（12/12 全部红灯，均为 B 类）**：

| 测试 | 红灯原因（实跑捕获） | 类型 |
|---|---|---|
| BDD-1/2 | `locator('[data-testid="content-area"]')` evaluate 超时（该 testid 未实现） | B |
| BDD-3 | 同上（依赖 `content-area`/`meta-tags-bar` testid） | B |
| BDD-4/5 | `locator('[data-testid="mobile-bottom-bar"]')` 未找到 | B |
| BDD-6 | `mobile-bar-filetree-btn` 等按钮 testid 未实现 | B |
| BDD-7 | `expect(locator).toBeVisible()` 失败——`[data-testid="mobile-bar-wrap-btn"]` 未找到（页面快照确认按钮本体以纯文本 "Wrap" 存在，仅缺 testid，非组件缺失） | B |
| BDD-8/9 | `[data-testid="markdown-body"]` 未找到 | B |
| BDD-10/11 | 同上（桌面端 `markdown-body`/`content-area`） | B |
| BDD-12 | 修正后：移动端 `[data-testid="mobile-bottom-bar"]` 未找到（正向前置断言先失败） | B |

未见任何 A 类错误（无 TypeScript 编译失败、无 import 失败、无测试代码语法错误）——`npx tsc --noEmit` 对该文件独立编译通过，且 12 个 test 均能正常执行到断言/超时阶段（不是在测试启动前就崩溃）。

`make debug-quick` 环境验证过程中额外发现一处与本任务测试设计相关的必要修正：`beforeAll` 中最初用后端 API 不存在的顶层 `content` 字段创建单文件 entry（`CreateEntryRequest` 模型无此字段，仅有 `files: FileCreate[]`），会静默创建出 `files: []` 的空 entry，导致页面停在 "Select a file to view" 空态、间接产生非预期红灯（掩盖真实红灯原因）。已改为 `files: [{filename, content}]` 正确格式并重新验证。
