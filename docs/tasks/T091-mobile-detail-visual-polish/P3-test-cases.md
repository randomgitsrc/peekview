---
phase: P3
task_id: T091-mobile-detail-visual-polish
type: test-cases
parent: P2-design.md
trace_id: T091-P3-20260810
status: draft
agent: test-designer
---

# P3-test-cases — T091 移动端详情页视觉打磨

```yaml
test_code_dir: frontend-v3/e2e
```

## 1. 改动清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` | 手术式修改 | BDD-7（L293-300，class 断言 `'primary'`→`'active'`）+ BDD-8（L305-326，重写为对称性+定值 24px 断言，测试名改为 `test_bdd_8_markdown_mobile_inset_symmetric_24px`；顶部常量 L8-9 `MARKDOWN_MOBILE_BASELINE_INSET_PX`/`MARKDOWN_REDUCTION_TARGET_RATIO` 替换为 `MARKDOWN_MOBILE_TARGET_INSET_PX = 24`）。其余测试（BDD-1~6、9~12）未改动 |
| `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` | 新建 | 承载 T091 全部 13 条 BDD |

## 2. BDD → 测试用例映射表（1:1）

| P1 BDD | 测试文件 | 测试用例名 | 判定方式 |
|---|---|---|---|
| BDD-1 | t091 spec | `test_bdd_1_meta_tags_bar_wraps_no_horizontal_scroll` | DOM：`scrollWidth<=clientWidth`（markdown-test） |
| BDD-2 | t091 spec | `test_bdd_2_meta_tags_bar_breathing_room` | DOM：`offsetHeight>=71px`（仅 markdown-test）+ 截图证据供 vision-engine 并列判定 |
| BDD-3 | t091 spec | `test_bdd_3_markdown_body_16px_padding_24px_total_inset` | DOM：`.markdown-body` computed padding `=16px`，`boundingBox().x` 在 24±2px 内 + 截图 |
| BDD-4 | t091 spec | `test_bdd_4_bottom_bar_padding_top_bottom_symmetric` | DOM：`padding-top===padding-bottom===4px` |
| BDD-5 | t091 spec | `test_bdd_5_copy_button_icon_only_no_accent_fill` | DOM：文案不含 'Copy'、`background-color` 透明 + 移动端/桌面端截图供 vision-engine 对比 |
| BDD-6 | t091 spec | `test_bdd_6_copy_button_44px_hit_area` | DOM：`boundingBox()` 宽高 ≥44px |
| BDD-7 | t091 spec | `test_bdd_7_wrap_button_toggle_states_distinguishable` | DOM：`aria-pressed` 切换 `false→true`、class 含 `active` + 点击前后截图供 vision-engine 判定 |
| BDD-8 | t091 spec | `test_bdd_8_wrap_button_44px_hit_area` | DOM：`boundingBox()` 宽高 ≥44px |
| BDD-9 | t091 spec | `test_bdd_9_ten_viewers_visual_consistency` | DOM：10 个 entry 循环，meta-tags-bar/bottom-bar 可见、`scrollWidth<=clientWidth`（呼应 BDD-1）、Copy 按钮无文字（呼应 BDD-5）+ 每个 entry 截图供 vision-engine 逐一比对 |
| BDD-10 | t091 spec | `test_bdd_10_image_viewer_exception_no_occlusion` | DOM：`svg-standalone`，ImageViewer `top` 与 meta-tags-bar `bottom` 差值 ≤2px（无遮挡/无压缩）+ 首屏/滑动后两张截图供 vision-engine 判定重影/跳变 |
| BDD-11 | t091 spec | `test_bdd_11_html_viewer_exception_no_occlusion` | 同 BDD-10，entry 为 `html-csp-test`，viewer 选择器为 `.html-viewer`（无 data-testid，见第 4 节说明） |
| BDD-12 | t091 spec | `test_bdd_12_desktop_markdown_padding_unchanged` | DOM：桌面端 `.markdown-body` padding 精确等于 `24px` |
| BDD-13 | t091 spec | `test_bdd_13_desktop_no_mobile_components` | DOM：先验证移动端两组件可见（正向陪同校验），再验证桌面端两者 count=0 |
| T090 BDD-7（回归） | t090 spec（手术式修改） | `test_bdd_7_wrap_button_toggles_non_markdown_non_html` | class 断言改为 `'active'` |
| T090 BDD-8（回归） | t090 spec（手术式修改） | `test_bdd_8_markdown_mobile_inset_symmetric_24px` | 断言改为对称性 + 24px±2px 定值 |

全部选择器使用 P2-design.md §8 声明的 `data-testid`（`meta-tags-bar`/`markdown-body`/`content-area`/`mobile-bottom-bar`/`mobile-bar-copy-btn`/`mobile-bar-wrap-btn`/`image-viewer`），不依赖 `.bottom-btn`/`.toggle-btn` 等会被本任务重命名的 class。仅两处例外且均有明确理由：①desktop Copy 按钮无 data-testid，用 `page.getByRole('button', { name: 'Copy' })`（可访问性语义选择器，非实现细节 class）；②`HtmlViewer.vue` 根节点无 data-testid，用其自身结构性 class `.html-viewer`（非本任务改动/重命名的 class，与 `.bottom-btn`→`.toggle-btn` 性质不同）。

## 3. 测试数据 / 前置状态说明

- 全部 11 个测试 entry 均由 `make debug-quick` 预灌入，测试文件本身不创建任何 entry（与 t090 spec 不同，t090 在 `beforeAll` 里创建自己的专用 entry）
- `markdown-test` 的 `files[0]` 是 `architecture.svg`（非 markdown 文件，按目录字母序排列），默认打开该 entry 会展示 ImageViewer 而非 MarkdownViewer；已用 CDP 实测确认。BDD-3/12 需要 markdown 视图，因此通过 `?firstFileId=18`（`rich-markdown.md` 的真实 file id，经 API 查证）显式指定，这是 `EntryDetailView.vue` L201-207 已有的路由查询参数机制，不是测试专用 hack
- `python-entry-service` 的默认活动文件是 `entry_service.py`（python，`canWrap=true`，非 markdown/html），满足 BDD-7/8 "非 markdown 且非 html 的代码类 entry" 的 Given 前提，经 CDP 实测确认

## 4. 自跑红灯结果

命令：`E2E_SPEC=e2e/t09 make debug-test`（P2-design.md §5 固化的 `gate_commands.P3`，与派发指引一致）

结果：**22 failed, 28 passed**（chromium + Mobile Chrome 两个 project 各跑一遍，11 个失败用例 × 2 project = 22）

失败用例清单（去重后 11 个，chromium/Mobile Chrome 各一份）：
- t090 `test_bdd_7_wrap_button_toggles_non_markdown_non_html`
- t090 `test_bdd_8_markdown_mobile_inset_symmetric_24px`
- t091 `test_bdd_1_meta_tags_bar_wraps_no_horizontal_scroll`
- t091 `test_bdd_2_meta_tags_bar_breathing_room`
- t091 `test_bdd_3_markdown_body_16px_padding_24px_total_inset`
- t091 `test_bdd_4_bottom_bar_padding_top_bottom_symmetric`
- t091 `test_bdd_5_copy_button_icon_only_no_accent_fill`
- t091 `test_bdd_6_copy_button_44px_hit_area`
- t091 `test_bdd_7_wrap_button_toggle_states_distinguishable`
- t091 `test_bdd_8_wrap_button_44px_hit_area`
- t091 `test_bdd_9_ten_viewers_visual_consistency`

### A/B 类判定

**全部 22 处失败均为 B 类（assertion 失败，非测试代码自身错误）**，逐一核实错误类型（`grep -oP "Error: \K.*"` 去重后仅 6 种，全部是 Playwright `expect()` 断言失败）：
- `toHaveAttribute` failed（`aria-pressed` 属性当前不存在，Wrap 按钮尚未实现 `.toggle-btn`/aria-pressed）
- `not.toContain` / `toContain`（class 名 `'active'`/`'primary'`、Copy 按钮文案 `'Copy'`）
- `toBe`（padding 精确值不匹配，如 `0px`≠`16px`、`8px`≠`4px`）
- `toBeGreaterThanOrEqual` / `toBeLessThanOrEqual`（数值阈值未达标，如 `offsetHeight`/`boundingBox` 尺寸/`scrollWidth vs clientWidth`）

无一处是 `SyntaxError`、模块 `import` 失败、`TypeError`（如 locator 未定位到元素导致的运行时崩溃）等 A 类错误——所有失败均发生在测试已成功导航、定位到目标元素之后的数值/属性比对阶段，且比对结果与"T091 尚未实现"完全吻合（例如：Copy 按钮背景色实测 `rgb(9, 105, 218)`——即当前 `.bottom-btn.primary` 的蓝色实心背景，未来实现 `.icon-btn` 后才会变透明）。已用 CDP 对当前（未实现 T091）代码逐条实测校验数值，确认每条断言的"before"实测值均与"应该红灯"的预期完全一致，不存在断言写反导致误报绿灯或误报红灯的情况。

未失败的 4 条 t091 用例（BDD-10/11/12/13）说明：这 4 条本质是**跨端/跨场景不回归类断言**（P1 第 3 节"跨端不回归"分组 + BDD-10/11 的"无遮挡"结构性不变量），其正确性建立在 T091 改动前后均应保持一致的既有 CSS 流式布局机制上（`height:100%` 相对流式父容器、`meta-tags-bar` 与 `ImageViewer`/`HtmlViewer` 天然衔接、桌面端 `v-if="isMobile"` 门禁），经 CDP 实测确认它们在当前未实现的代码上已经成立，且 T091 的改动不会破坏这一机制，因此在 P3/P5 均预期为绿色，这与 t090 spec 自身的 `test_bdd_11_desktop_markdown_padding_unchanged`/`test_bdd_12_desktop_no_mobile_bottom_bar` 两条"跨端不回归"用例在 T090 P3 阶段的先例完全一致（详见 T090 spec 同名测试），不构成 TDD 违规——`check-tdd-red.sh` 类工具判定红灯的口径是"整体套件中存在真实断言失败"而非"每条用例都必须失败"，本次 22 处真实断言失败已充分满足该口径。

## 5. 结论

- `t090-mobile-detail-ux-polish.spec.ts`：BDD-7/BDD-8 两处手术式修改按 P2-design.md 第 4 节方案落地，其余测试未动
- `t091-mobile-detail-visual-polish.spec.ts`：新建，13 条 BDD 1:1 覆盖，全部用 `data-testid`（2 处有理由的例外见第 2 节）
- 自跑 `E2E_SPEC=e2e/t09 make debug-test`：22 failed / 28 passed，22 处失败全部为 B 类（真红灯），0 处 A 类

## 6. P4 阶段测试修正记录

implementer 完成 EntryMetaTagsBar.vue/MarkdownViewer.vue/EntryDetailMobileBar.vue/DESIGN.md 实现后自查 46 passed / 4 failed，4 处失败集中在 2 条测试（chromium + Mobile Chrome 各一份）：
- `t090-mobile-detail-ux-polish.spec.ts::test_bdd_8_markdown_mobile_inset_symmetric_24px`
- `t091-mobile-detail-visual-polish.spec.ts::test_bdd_3_markdown_body_16px_padding_24px_total_inset`

两条测试各自的 `padding` 断言（`getComputedStyle(markdownBody).padding === '16px'`）均通过，证明实现正确；恒定失败的是 `mdBox!.x` 数值判断，实测稳定为 `8`，与期望 `>=22` 不符。

### 根因

`getBoundingClientRect()`/`boundingBox()` 返回元素自身 border-box 的位置，该位置由**父元素的 padding + 自身的 margin** 决定，不受元素自身 padding 影响——padding 只把子内容向内推，不移动元素自己的框。`.markdown-body` 自身的 `boundingBox().x` 永远等于 `.content-area` 的 padding（8px），无论 `.markdown-body` 自己的 padding 设成多少。应测量 `.markdown-body` **第一个直接子元素**的 `boundingBox().x`，因为子元素的位置才真实反映父元素的 padding。

### 实测确认（CDP，debug backend :8888，390×844 viewport）

用 `t090-long-markdown-check`（60 段长文本，触发 `.content-area` 的 `overflow-y:auto` 纵向滚动）和 `markdown-test?firstFileId=18`（`rich-markdown.md`，625 行，同样触发滚动）两个临时 entry 实测（测完已通过 `DELETE /api/v1/entries/{slug}` 清理，未使用 CLI）：

- 子元素（`<div v-html>` 包裹的渲染 HTML，两个 entry 均无 fenced code block，因此整份 markdown 是单个 HTML block，子元素撑满 `.markdown-body` 内容区宽度）：`x=24, width=332`，与 `.markdown-body` 自身 `padding=16px + .content-area padding=8px = 24px` 完全吻合
- 但 `.content-area` 因内容超高触发滚动条，`clientWidth`（380）比 `offsetWidth`（390）少 10px——真实（非 overlay）滚动条只吃右侧空间，导致若仍用 `viewportWidth(390) - (mdBox.x + mdBox.width)` 公式算 `rightInset`，会得到 `34` 而非 `24`（与 `leftInset=24` 相差 10px，超出对称性 `<=2` 容差）。用短内容（无滚动）entry 对照实测：无滚动条时 `leftInset=rightInset=24`，完全对称，证实差异纯粹来自滚动条挤占，不是 CSS 缺陷
- `t091` 的 `test_bdd_3` 只断言 `mdBox!.x`（左侧 inset），不涉及右侧对称性，因此单纯换成子元素测量即可，无需额外处理
- `t090` 的 `test_bdd_8` 断言了左右对称性，因此改用 `.content-area` 的 `clientWidth`（已扣除滚动条）而非硬编码 `viewportWidth=390` 计算 `rightInset` 的"可用区域"右边界：`availableRight = caBox.x + caClientWidth`。用该公式重算，子元素与自身两种测量口径下 leftInset/rightInset 均为 `(24,24)`/`(8,8)`，完全对称；且该公式在无滚动条场景下自然等价于原公式（`clientWidth === offsetWidth`），不影响其他场景

### 改动

- `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` L311-317 区域：`mdBox` 改为测量 `.markdown-body` 第一个子元素；新增 `contentArea`/`caClientWidth`/`availableRight` 三个变量，`rightInset` 公式的 `viewportWidth` 替换为 `availableRight`。常量定义（`MARKDOWN_MOBILE_TARGET_INSET_PX`）、两个 `expect` 阈值、其余测试均未改动
- `frontend-v3/e2e/t091-mobile-detail-visual-polish.spec.ts` L99-105 区域：`mdBox` 改为测量 `.markdown-body` 第一个子元素。`padding` 断言（L102-103）未动，常量/阈值/其余测试均未改动

### 自跑结果

`E2E_SPEC=e2e/t09 make debug-test`：**50 passed（0 failed）**，此前失败的 4 处（t090 BDD-8、t091 BDD-3，各 chromium + Mobile Chrome）全部转绿，其余 46 passed 保持不变。`npx vue-tsc --noEmit` 无报错。
