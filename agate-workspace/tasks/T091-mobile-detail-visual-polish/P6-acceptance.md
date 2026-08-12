---
phase: P6
task_id: T091-mobile-detail-visual-polish
type: acceptance
parent: P1-requirements.md
agent: verifier
retry: 1
---

# P6-acceptance — T091 移动端详情页视觉打磨（重新验收，P4 修复 meta-tags-bar 全局 CSS 冲突之后）

## 背景

上一轮 P6 验收发现真实缺陷：`EntryMetaTagsBar.vue` 的 scoped `flex-wrap` 规则未显式声明 `overflow-x`/`white-space`，被 `frontend-v3/src/styles/layout.css:466-478` 的遗留全局同名规则（`overflow-x: auto; white-space: nowrap`）级联覆盖，导致 `.content-area` 可滚动场景下 meta-tags-bar 高度坍缩到 33px、第二行标签被裁切丢失（BDD-2、BDD-9 FAIL，11/13 PASS）。已按协议规范回退 P6→P5→P4（`agate-retreat-to.sh`，归档在 `.archived/20260809-175444-P6/`），implementer 定向修复（`EntryMetaTagsBar.vue` 新增 `overflow-x:visible; white-space:normal;`），design-review approved，P5 重新全量验证通过（vitest 1215/0 + E2E 50/0）。

本轮为**完整重新走 13 条 BDD**，不复用上一轮任何 PASS/FAIL 结论，所有截图/DOM 测量均为本轮新产出（上一轮遗留在 `frontend-v3/docs/tasks/T091-mobile-detail-visual-polish/evidences/` 目录下的 24 张截图是修复前坍缩状态，本轮未使用）。

## 环境

- debug backend `127.0.0.1:8888`，`make build-frontend` 已确认包含本轮修复（`grep overflow-x:visible` 命中 `backend/peekview/static/assets/zsh-DLFQ99l2.css`）
- Chrome CDP `127.0.0.1:18800`，`connectOverCDP` 模式，390×844（mobile, iPhone 14 类比例）/ 1280×800（desktop）
- 11 个测试 entry 全部通过 `GET /api/v1/entries/{slug}` 200 确认存在：markdown-test / python-entry-service / csv-employees / tsv-server-metrics / json-api-config / yaml-docker-compose / xml-maven-pom / svg-standalone / mermaid-charts / plantuml-arch / html-csp-test
- markdown-test 的可滚动状态通过 `?firstFileId=18`（`rich-markdown.md`，长文件）触发，已核实该 fileId 对应文件名，`.content-area` 的 `scrollHeight=18544 > clientHeight=788`，真实处于可滚动场景（不是上一轮 E2E 落在默认 `architecture.svg` 的覆盖盲区）
- [PROD_NOT_TOUCHED]：全程只操作 `127.0.0.1:8888`（debug backend + `/tmp/peekview-debug/peekview.db`），未触碰生产 `:8080`/`~/.peekview/`

## 证据总览

- `P6-evidence/dom-measurements.json` — BDD-1/2/3/4/6/7/8/9/10/11/12/13 的 DOM 数值测量（本轮新截图流程实时采集）
- `P6-evidence/bdd9-clipcheck-10viewers.json` — 10 viewer 下 meta-tags-bar 子元素级裁切检测（每个 tag/chip 元素是否超出容器可视边界）
- `P6-evidence/bdd10-image-zoom-swipe-assertions.json` — BDD-10 图片查看器缩放前后滑动手势的 DOM 断言（用于解释截图去重后的证据链）
- `P6-evidence/screenshots/`（20 张，md5 全部互不相同，已去重）
- `docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml` — vision-analyst 独立视觉分析报告（19 张截图逐一结构化分析）

**截图去重说明**（遵循协议"多条 PASS 共享同一证据文件"处理方式）：
- 3 张桌面端截图（BDD-12/13/BDD-5桌面参照）在采集时为同一静态页面状态下连续截取，逐字节相同，保留 1 份（`desktop_1280x800_bdd12_markdown_padding.png`），BDD-13/BDD-5 复用同一文件
- BDD-7 的 off 态与 BDD-5/6 的 Copy 图标截图为同一未点击状态下的同一页面，保留 1 份（`mobile_390x844_bdd5_bdd6_copy_icon.png`），BDD-7 的 on 态另有独立截图（`mobile_390x844_bdd7_wrap_on.png`），两态本身互不相同
- BDD-10 的 unzoomed firstscreen/afterswipe 两张截图逐字节相同：经 DOM 断言核实（`bdd10-image-zoom-swipe-assertions.json`），`svg-standalone` 走 `ImageViewer`，其 `.image-container` 默认态 `overflow-x/y:hidden`（未放大不可滚动），即便点击放大后 `.image-zoomed` 态 `scrollHeight(613)===clientHeight(613)` 仍不产生可滚动溢出——这张 SVG 图片本身的渲染尺寸从未超出容器，滑动手势对此图片天然不产生任何可见变化，是该测试图片的真实边界情况而非漏测。删除重复的 afterswipe 截图，保留 firstscreen 一张 + 一张放大态参照（`mobile_390x844_bdd10_image_zoomed_state.png`，与 firstscreen 视觉不同），BDD-10 的"无重影/跳变"结论改为以 DOM 断言（`scrollTop`/`barRectTop` 滑动前后完全一致）为主要判据，与截图互为佐证

## BDD 逐条对照（13/13）

### meta-tags-bar：padding 16px + 换行不横向滚动

- PASS BDD-1: meta-tags-bar 在 `.content-area` 真实可滚动场景（markdown-test?firstFileId=18，scrollHeight=18544>clientHeight=788）下 `scrollWidth(364) === clientWidth(364)`，无横向滚动；`overflowX: visible`，`whiteSpace: normal`，均已从上一轮的 `auto`/`nowrap` 恢复正确覆盖 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd1_bdd2_markdown_scrollable.png)

- PASS BDD-2: 双子条件均满足。(a) DOM 辅助判定：meta-tags-bar `offsetHeight=89px`（上一轮同场景坍缩值为 33px），大于 P1 规定的 71px 下限阈值。(b) vision-engine 主观判定：截图显示两行布局，四周留白清晰（约12-24px），4个标签（markdown/测试/渲染/文档）文字完整可读，无贴边压缩、无裁切、无省略号截断；本 Agent 独立查看同一截图确认与 vision 报告一致 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd1_bdd2_markdown_scrollable.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

### markdown-body 移动端边距

- PASS BDD-3: `.markdown-body` computed padding-left/right 均为 16px（`var(--space-4)`），叠加 `.content-area` 的 8px 水平 padding，总留白 24px；vision-engine 确认正文左边缘与 meta-tags-bar 标签左边缘视觉对齐，不贴边 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd3_markdown_padding.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

### 底部操作栏 padding 对称性

- PASS BDD-4: `.mobile-bottom-bar` computed `padding-top=4px`，`padding-bottom=4px`，两者数值相等（`var(--space-1)` 基准值，无安全区设备下 `env(safe-area-inset-bottom,0px)` 求值为 0，叠加式 `calc()` 未破坏对称性） (P6-evidence/dom-measurements.json)

### Copy/Wrap 按钮图标化

- PASS BDD-5: 移动端 Copy 按钮 class 为 `icon-btn`（非 `bottom-btn primary`），截图确认无蓝色实心背景填充，仅显示纯图标；与桌面端 `EntryDetailHeader.vue` 的 Copy 图标（同为无背景线框风格）视觉一致 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd5_bdd6_copy_icon.png, screenshots/desktop_1280x800_bdd12_markdown_padding.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

- PASS BDD-6: Copy 按钮 `boundingBox()` = `{width: 44, height: 44}`，达到 44×44px 最小触控热区要求（CSS `min-width/min-height: 44px` 已生效） (P6-evidence/dom-measurements.json)

- PASS BDD-7: Wrap 按钮点击前 class=`toggle-btn`（灰色图标，无背景高亮），点击后 class=`toggle-btn active`（蓝色 `var(--c-accent)` 图标）；本 Agent 独立裁剪放大两张截图的 Wrap 图标区域确认颜色由深灰变为亮蓝，两态视觉可清晰区分 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd5_bdd6_copy_icon.png, screenshots/mobile_390x844_bdd7_wrap_on.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

- PASS BDD-8: Wrap 按钮 `boundingBox()` = `{width: 44, height: 44}`，达到 44×44px 最小触控热区要求 (P6-evidence/dom-measurements.json)

### 9 种 viewer 覆盖一致性

- PASS BDD-9: 10 个测试 entry（markdown/code/csv/tsv/json/yaml/xml/svg/mermaid/plantuml）全部重新截图 + DOM 复测，meta-tags-bar `offsetHeight` 全部为 89px，`overflowX: visible`，`whiteSpace: normal`；子元素级裁切检测（`bdd9-clipcheck-10viewers.json`）确认全部 10 个 viewer 的 `clippedChildren: 0`（无任何 tag/chip 元素超出容器可视边界）。重点复核上一轮受影响的 5 个（code/csv/tsv/xml/plantuml）：本轮 DOM 与视觉证据均确认已恢复正常，xml viewer 此前被 Search 输入框压住裁切的现象未再出现，8个标签完整可见、与下方 Search 框之间留白正常 (P6-evidence/dom-measurements.json, P6-evidence/bdd9-clipcheck-10viewers.json, screenshots/mobile_390x844_bdd9_markdown.png, screenshots/mobile_390x844_bdd9_code.png, screenshots/mobile_390x844_bdd9_csv.png, screenshots/mobile_390x844_bdd9_tsv.png, screenshots/mobile_390x844_bdd9_json.png, screenshots/mobile_390x844_bdd9_yaml.png, screenshots/mobile_390x844_bdd9_xml.png, screenshots/mobile_390x844_bdd9_svg.png, screenshots/mobile_390x844_bdd9_mermaid.png, screenshots/mobile_390x844_bdd9_plantuml.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

- PASS BDD-10: Image viewer 例外场景（svg-standalone，实际路由到 `ImageViewer`，`height:100%;overflow:hidden`）。首屏完整性：meta-tags-bar `offsetHeight=89` 完整可见，`.image-viewer` 未遮挡它。可用尺寸：`.content-area.clientHeight(788) - imgViewer.offsetHeight(623) = 165`，经独立 DOM 结构复测拆解（`t091_p6_investigate.ts`）确认完全可解释——`.content-area` 自身 `paddingTop:12px + paddingBottom:64px = 76px`（与 meta-bar 无关的既有布局预留）+ meta-tags-bar `89px` = 165px，恰好吻合，不存在额外的、无法解释的压缩量。无滚动冲突/抖动：DOM 断言确认无论未放大还是点击放大后，`.image-container` 均因该 SVG 图片渲染尺寸未超出容器而不产生可滚动溢出（`scrollHeight===clientHeight`），滑动前后 `scrollTop`/meta-tags-bar `barRectTop` 完全一致（68px 不变），因此不存在重影/跳变的可能性——已用截图佐证（放大态截图与首屏视觉不同，证明并非截图采集失败） (P6-evidence/dom-measurements.json, P6-evidence/bdd10-image-zoom-swipe-assertions.json, screenshots/mobile_390x844_bdd10_image_firstscreen.png, screenshots/mobile_390x844_bdd10_image_zoomed_state.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

- PASS BDD-11: Html viewer 例外场景（html-csp-test，`HtmlViewer`，`height:100%;overflow:hidden`）。首屏完整性：meta-tags-bar `offsetHeight=89` 完整可见。可用尺寸：同 BDD-10 结构，`.content-area.clientHeight(788) - htmlViewer.offsetHeight(623) = 165`，同样可用 `12px+64px(content-area自身padding) + 89px(meta-bar)` 完全解释。无滚动冲突/抖动：首屏与滑动后两张截图对比，meta-tags-bar 完整可见、位置/留白一致，无重影无跳变；滑动后截图中 iframe 内容出现蓝色文字选中态，经核实为鼠标拖拽模拟滑动手势在 iframe 内触发的 text-selection 副作用（非真实触摸事件），是截图采集方式导致的 artifact，不影响 meta-tags-bar 本身的评估结论 (P6-evidence/dom-measurements.json, screenshots/mobile_390x844_bdd11_html_firstscreen.png, screenshots/mobile_390x844_bdd11_html_afterswipe.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

### 跨端不回归

- PASS BDD-12: 桌面端（1280×800）`.markdown-body` computed padding-left/right/top 均为 24px（`var(--space-5)`），与改动前数值完全相等，未受移动端改动影响 (P6-evidence/dom-measurements.json, screenshots/desktop_1280x800_bdd12_markdown_padding.png)

- PASS BDD-13: 桌面端 DOM 查询确认 `.mobile-bottom-bar` 不存在（`false`）、`.meta-tags-bar` 不存在（`false`）、`.meta-row`（桌面端既有 header 内元信息行）存在（`true`）；vision-engine 独立确认截图中未见独立深色 meta-tags-bar 区块，也未见移动端风格底部固定操作栏，元信息以水平行呈现在 Header 正下方、三栏主体上方 (P6-evidence/dom-measurements.json, screenshots/desktop_1280x800_bdd12_markdown_padding.png, vision: docs/tasks/T091-mobile-detail-visual-polish/P6-vision-20260810-retry1.yaml)

## DESIGN.md 文档同步核实

本 Agent 独立 grep 核对，以下描述已与代码行为一致：
- L221-222：meta tags bar 换行说明（"Content wraps naturally...rather than forcing a single line with horizontal scroll"）与 BDD-1/2 实测行为一致
- L225-226：markdown-body mobile padding 16px + 总留白 24px 说明与 BDD-3 实测一致
- L270：底部操作栏 `padding-bottom: calc(...)` 叠加式说明与 BDD-4 实测一致（对称 4px/4px）
- L159-162：`.icon-btn`/`.toggle-btn` 判断准则（无状态动作用 `.icon-btn`，持久状态用 `.toggle-btn`）与 BDD-5/7 的 Copy/Wrap 实现一致

## vision-analyst 结论绑定

`ui_affected: true`，全部 8 条视觉断言 BDD（2/3/5/7/9/10/11/13）均有至少一条 PASS 基于 vision-analyst 报告。`blocker_count: 0`，无需追查根因。vision-analyst 报告的 info 级 anomaly（代码/CSV 内容超宽截断、图片查看器留白偏多、HTML 滑动截图文本选中）均与 meta-tags-bar 缺陷无关，本 Agent 已在上方对应 BDD 条目逐条核实说明，不构成 FAIL 依据。

## 本 Agent 独立复核记录

除引用 vision-analyst 报告外，本 Agent 额外独立执行以下复核，未盲信 subagent 自报：
1. 直接查看 `mobile_390x844_bdd1_bdd2_markdown_scrollable.png`、`mobile_390x844_bdd9_xml.png`、`mobile_390x844_bdd9_csv.png`、`mobile_390x844_bdd9_plantuml.png`、`mobile_390x844_bdd10_image_firstscreen.png`、`mobile_390x844_bdd11_html_firstscreen.png`、`mobile_390x844_bdd11_html_afterswipe.png`、`desktop_1280x800_bdd12_markdown_padding.png` 共8张截图，确认视觉表现与 vision-analyst 报告一致，尤其确认此前 xml/csv/plantuml 受影响的 viewer 标签均完整无裁切
2. 对 BDD-7 的两张底部工具栏截图做局部裁剪放大（4x），确认 Wrap 图标颜色确实从深灰变为亮蓝，视觉差异真实可辨（非 vision-analyst 单方面判断）
3. 独立编写 DOM 结构分析脚本，对 BDD-10/11 的"165px 差值是否远超 meta-bar 高度"疑点做了逐层拆解验证（`.content-area` 自身 padding 12px+64px 是既有布局预留，与本次改动无关），排除了误判风险
4. 对代码文件（`EntryMetaTagsBar.vue`/`EntryDetailMobileBar.vue`/`MarkdownViewer.vue`/`DESIGN.md`）逐一 grep 确认实现与验收断言一致

## 三条预检脚本

见主 Agent 后续独立执行记录（本文件由 verifier 产出后由主 Agent 运行 gate 脚本，verifier 自身不代表 gate 结果）。

**Summary**: 13/13 PASS, 0 FAIL
