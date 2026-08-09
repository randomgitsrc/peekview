---
phase: P1
task_id: T091-mobile-detail-visual-polish
type: problems
parent: P0-brief.md
trace_id: T091-P1-20260810
status: draft
created: 2026-08-10
agent: analyst
---

# P1-requirements — T091 移动端详情页视觉打磨

> 本任务的 4 处修复方案已在会话内与用户逐条讨论定型（详见 P0-brief.md），P1 不重新探索候选方案，只做「已定型方案 → 规范 BDD」的转译，并识别是否有 P0-brief 未覆盖的隐含需求。BDD 编号从 BDD-1 重新开始（不接续 T090 的 BDD-1~12）。

## 1. 需求复述

T090（v0.18.1）上线后用户实机走查发现移动端详情页视觉观感差。orchestrator 用 Playwright CDP 截图 + DOM 实测复核，确认并与用户拍板了 4 处具体修复：

1. **meta-tags-bar**（`EntryMetaTagsBar.vue`）：padding 从 8px/12px 改为 16px/16px；去掉 `overflow-x: auto` 强制单行横向滚动，改为 `flex-wrap: wrap` 自然换行。
2. **markdown-body 移动端边距**（`MarkdownViewer.vue`）：mobile 断点（≤640px）由 `margin:0; padding:0` 改为 `margin:0; padding: var(--space-4)`（16px），与 `.content-area` 已有的 8px 水平 padding 叠加为总留白 24px。
3. **底部操作栏 padding 不对称 bug**（`EntryDetailMobileBar.vue`）：`padding-bottom: env(safe-area-inset-bottom, 0px)` 直接覆盖了 `padding: var(--space-2) var(--space-3)` 设的 8px 下边距（而非叠加），导致无安全区设备下 padding-bottom 实测为 0px、与 padding-top 8px 不对称。修复为基准值降到 `var(--space-1)`（4px）+ `calc(var(--space-1) + env(safe-area-inset-bottom, 0px))` 相加。
4. **底部操作栏按钮风格统一**：Copy（当前 `.bottom-btn.primary`，文字+蓝底）改为纯图标 `.icon-btn`（对齐桌面端 `EntryDetailHeader.vue` 的 Copy 按钮视觉），额外加 `min-width/min-height: 44px`；Wrap（当前 `.bottom-btn`，纯文字）改为图标 toggle `.toggle-btn`（对齐 `source-toggle` 同款模式，`wrapEnabled` 绑定 `active` class），图标用 `lucide-vue-next` 的 `WrapText`（已核实该包存在此图标）。

**范围扩展**：上述公共骨架（content-area/meta-tags-bar/底部操作栏）被全部 9 种 viewer（Markdown/Code/CSV/TSV/JSON/YAML/XML/Image/Html/SVG/Mermaid/PlantUML，其中 CSV+TSV 共用 TableView、JSON+YAML+XML 共用 TreeView、SVG 复用 CodeViewer 判定路径）共用，T090 当时只截图验证过 Markdown+Code 两种，本任务 P6 验收范围必须扩大到全部 9 种，Image/Html 两个滚动架构例外（`height:100%; overflow:hidden`）需重点关注。

同时需要同步修订 DESIGN.md 3-4 处文字描述（L221-223/L267/L218-219，可选 L158-160），使文档与代码改动后的行为一致。

## 2. 隐含需求识别

| 维度 | 识别结果 | 为什么必须 |
|---|---|---|
| 数据 | 无数据模型/存量数据受影响 | 4 处改动均为纯前端 CSS/图标替换，无 API/DB 改动 |
| 前端 | 4 处均为显式展示/交互变化 | `domains: [frontend]`，涉及 `EntryMetaTagsBar.vue`/`MarkdownViewer.vue`/`EntryDetailMobileBar.vue` 三个文件 + `DESIGN.md` |
| 多端（MCP/CLI/API） | 无需同步 | 纯前端移动端布局改动，不涉及后端/MCP/CLI |
| 架构约束保留 | 必须保留 `.content-area` 作为唯一滚动容器（DESIGN.md L270-275），meta-tags-bar 仍是其内第一个子节点，不引入第二个滚动容器 | 已核实 `EntryDetailContent.vue` L24 `EntryMetaTagsBar` 已是 `.content-area` 内第一个子元素（T090 的既有实现），本任务只改其 CSS，不改结构位置 |
| Image/Html 滚动架构例外交互 | `HtmlViewer.vue`/`ImageViewer.vue` 均为 `height:100%; overflow:hidden`，紧随 meta-tags-bar 同级渲染在 `.content-area` 内——height:100% 相对的是 `.content-area` 的可视高度，meta-tags-bar 占用的额外高度会使这两种 viewer 的实际可用区域被压缩或被推出视口，此前从未被截图验证过 | P0-brief known_risks 已明确点出但未给出实现方案，P1 必须把这一交互纳入独立可验证的 BDD（不能假设与其余 7 种 viewer 表现一致），否则 P4/P6 可能遗漏 |
| 边界 | 44×44 触控热区最小值（DESIGN.md L265）适用于新增的 Copy `.icon-btn`；空 tags/无 owner 场景不受本次改动影响（meta-tags-bar 内部子元素排布逻辑未改，只改容器 padding/wrap 方式） | Copy 按钮新增本地 `.icon-btn` 是本次改动直接引入的新样式，触控热区必须显式验证；空值占位是既有行为，本次不改，不需要新增验证 |
| 兼容 | 桌面端不应受影响：`EntryMetaTagsBar` 仅在 `v-if="isMobile"` 时渲染（`EntryDetailContent.vue` L24），`EntryDetailMobileBar.vue` 整体 `v-if="isMobile"`，`MarkdownViewer.vue` 的 16px padding 改动限定在 `@media (max-width: 640px)` 内 | 三处改动均由既有的 `isMobile`/媒体查询守卫，理论上不影响桌面端，但仍需显式回归验证（防止断点判定或选择器书写错误导致意外泄漏到桌面端） |

**范围外事项确认（不纳入本次 BDD）**：
- `BaseButton` 两档尺寸（40px/34px）均不满足 44px 触控线——本次 Copy/Wrap 均改走图标风格天然 44×44，不涉及 `BaseButton`，此缺口记入 roadmap，不在本任务验收范围内。
- `.icon-btn`/`.toggle-btn` 全项目多处独立 scoped 实现未统一——本任务只保证 `EntryDetailMobileBar.vue` 内新增的本地 `.icon-btn` 自身 44×44 达标，不做跨组件统一，超出本任务范围。

## 3. BDD 验收条件

### meta-tags-bar：padding 16px + 换行不横向滚动

#### BDD-1: meta-tags-bar 内容超长时自然换行，不产生横向滚动
- Given 移动端 viewport（≤640px）下打开一个 tag 数量较多、且 `@username + 时间 + 阅读数 + Public/Private + 全部标签` 总内容宽度超过视口宽度的 entry
- When 页面渲染完成
- Then meta-tags-bar 的内容自动换到多行显示，其自身宽度不超过可视区域宽度；判定依据为纯 DOM 数值断言：`scrollWidth <= clientWidth` 为真——该布尔值已完整决定"是否存在横向滚动条"，不需要、也不依赖任何额外的视觉判断。截图仅作人工复核时的辅助佐证（不构成独立判定依据，截图本身不提供 DOM 测量之外的信息）。**本条为 DOM 断言，不计入视觉断言统计**（与 BDD-4/6/8/12 同属"纯 DOM 判定"类别，区别仅在于历史版本曾误用截图佐证措辞，本轮已纠正）

#### BDD-2: meta-tags-bar 留白改善后视觉呼吸感可辨识
- Given 移动端 viewport 下打开 `markdown-test` entry，分别使用改动前后两版页面
- When 用 vision-engine 对比两张移动端截图，并测量 meta-tags-bar 的 `offsetHeight`
- Then 子句包含两个并列子条件，二者同时满足才判 PASS，任一 FAIL 则整体 FAIL：
  - **(a) DOM 辅助判定**：meta-tags-bar 实际渲染高度（`offsetHeight`）不小于 **71px**。阈值来源（非理论公式反推）：主 Agent 用 Playwright CDP 在 `markdown-test` entry 的移动端页面上，通过 `page.addStyleTag` 实时注入本任务目标 CSS（`padding:16px 16px; overflow-x:visible; flex-wrap:wrap`），直接实测容器渲染高度为 **89px**（`markdown-test` 标签数量较多，`flex-wrap:wrap` 生效后自然换成多行，实测值因此显著高于单行理论估算——此前按"padding+单行行高"公式推算的 ~40-50px 已被证明与实测不符，故本轮不再沿用该公式，改为直接锚定实测数）。判定阈值取实测值 89px 的约 80% 作为保守下限（89px × 0.8 ≈ 71.2px，取整 71px），为不同设备/浏览器渲染差异、字体度量误差留出安全边际；71px 仍显著超过 P0-brief 记录的改动前基线约 17px（超出逾 3 倍，即约 4.2×），两者在正常渲染下不会产生混淆区间。**适用范围说明**：容器高度是内容相关的（标签数量越多、换行行数越多，高度越高），本阈值是专为 `markdown-test` 这一具体测试 entry 标定的下限，不代表对所有 entry 的统一固定期望值；但作为"显著高于旧基线、且不脱离本次实测锚点"的验收下限，已足以判定本条 BDD 的 PASS/FAIL。
  - **(b) vision-engine 主观判定**：修改后版本中 meta-tags-bar 的文字/标签内容与其容器四周之间存在清晰可辨识的留白间隙，不再贴边压缩、条状区域不再被压扁到极窄高度（对照基线约 17px）；该子结论为 vision-engine 二值判定（存在明显改善 = PASS，仍贴边/局促 = FAIL）
  - DESIGN.md L218-219 需同步补充"内容按需换行、不做强制单行横向滚动"的文字说明并与实际渲染表现一致

### markdown-body 移动端边距

#### BDD-3: markdown 正文移动端补回 16px padding，总留白 24px
- Given 移动端 viewport（≤640px）下打开一个 markdown entry
- When 测量 `.markdown-body` 的 computed padding 值，并用 vision-engine 观察正文文字与视口边缘的间距
- Then `.markdown-body` 的 padding 计算值为 16px（`var(--space-4)`），叠加 `.content-area` 已有的 8px 水平 padding，正文文字左/右边缘到视口边缘的总间距为 24px；vision-engine 确认正文不再贴边显示，与 meta-tags-bar 的左边缘（16px 自身 padding + 8px content-area = 24px）视觉对齐；DESIGN.md L221-223 需同步改为反映新的 16px padding 数值，不再保留"no additional margin/padding of its own"的旧描述

### 底部操作栏 padding 对称性（真 bug 修复）

#### BDD-4: 无安全区设备下底部操作栏 padding-top 与 padding-bottom 数值相等
- Given 移动端 viewport 下打开任意 entry，且设备/浏览器不提供安全区高度（`env(safe-area-inset-bottom)` 求值为 0px）
- When 测量 `.mobile-bottom-bar` 的 computed `padding-top` 与 `padding-bottom` 数值
- Then 两者数值相等（均为 4px，`var(--space-1)`），不存在 padding-bottom 被 `env()` 覆盖为 0 而与 padding-top 不对称的情况；DESIGN.md L267 需同步把 `padding-bottom: env(safe-area-inset-bottom, 0px)` 的描述改为 `calc(基础值 + env(...))` 的叠加形式，消除文档描述与 bug 写法一致的问题

### Copy/Wrap 按钮图标化

#### BDD-5: Copy 按钮改为纯图标，视觉对齐桌面端 `.icon-btn`
- Given 移动端 viewport 下打开一个支持 Copy 操作的 entry
- When 用 vision-engine 对比移动端 Copy 按钮与桌面端 `EntryDetailHeader.vue` 的 Copy 按钮截图
- Then 移动端 Copy 按钮不再显示"Copy"文字标签，仅显示图标本体，无蓝色实心背景填充；按钮的视觉呈现方式（无边框、图标居中、hover/默认态配色逻辑）与桌面端 `.icon-btn` 一致，不存在移动端独有的强调色块背景

#### BDD-6: Copy 按钮触控热区达到 44×44px 最小值
- Given 移动端 viewport 下打开任意 entry
- When 测量底部操作栏 Copy 按钮元素的 `offsetWidth`/`offsetHeight`（或等效可点击区域尺寸）
- Then 该按钮的可点击区域宽度和高度均不小于 44px

#### BDD-7: Wrap 按钮改为图标 toggle，开/关两态视觉可区分
- Given 移动端 viewport 下打开一个非 markdown 且非 html 的代码类 entry（`canWrap` 为 true，Wrap 按钮渲染，图标为 `WrapText`）
- When 用 vision-engine 对比 Wrap 按钮点击前（未激活）与点击后（激活）两张截图
- Then 两态之间存在肉眼可辨识的视觉差异（如图标颜色/背景高亮变化，对齐 `source-toggle` 按钮同款 `.toggle-btn` 的 active 态呈现逻辑），用户能够仅凭视觉判断当前 Wrap 是开启还是关闭状态

#### BDD-8: Wrap 按钮触控热区达到 44×44px 最小值
- Given 移动端 viewport 下打开一个 `canWrap` 为 true 的 entry
- When 测量底部操作栏 Wrap 按钮元素的可点击区域尺寸
- Then 该按钮的可点击区域宽度和高度均不小于 44px

### 9 种 viewer 覆盖一致性

#### BDD-9: 10 种常规 viewer 下 meta-tags-bar/正文边距/底部栏按钮风格截图核对一致
- Given 移动端 viewport 下依次打开 `markdown-test`（Markdown）、`python-entry-service`（Code）、`csv-employees`（CSV）、`tsv-server-metrics`（TSV）、`json-api-config`（JSON）、`yaml-docker-compose`（YAML）、`xml-maven-pom`（XML）、`svg-standalone`（SVG）、`mermaid-charts`（Mermaid）、`plantuml-arch`（PlantUML）共 **10 个**测试 entry
- When 用 vision-engine 对每个 entry 截取的移动端页面截图逐一比对
- Then 10 种 viewer 下 meta-tags-bar 的换行/留白表现（对应 BDD-1/BDD-2）、正文/内容区左右留白表现、底部操作栏按钮风格（图标化 Copy/Wrap，对应 BDD-5/BDD-7）均一致，不因 viewer 类型不同而产生观感差异

> **说明（解释性，不影响验收范围）**：SVG/Mermaid/PlantUML 三种走 `DiagramBlock`/常规文档流渲染，不属于 DESIGN.md L273 记载的滚动架构例外（`height:100%; overflow:hidden`），其 meta-tags-bar/边距/按钮风格表现路径与其余 7 种常规 viewer 理论上一致，这是它们被并入 BDD-9 而非像 Image/Html 那样独立开条（BDD-10/11）的原因。但**验收范围本身以上方 BDD-9 Given 子句列出的 10 个 entry 为准**，P6 verifier 必须实跑全部 10 个，不得因这条说明而只跑 7 个。

#### BDD-10: Image viewer（滚动架构例外）下 meta-tags-bar 表现独立验证
- Given 移动端 viewport 下打开 `image-gallery` 或 `product-screenshots` entry（走 `ImageViewer`，`height:100%; overflow:hidden`，紧随 meta-tags-bar 同级渲染于 `.content-area` 内）
- When 用 vision-engine 分析首屏截图（页面首次渲染完成、未做任何滑动操作时截取）+ 滑动后截图（在图片内容区域中点位置执行一次垂直向上滑动手势，滑动距离约 200-300px、模拟单指上滑约三分之一到一半屏高，动作完成且页面无进行中动画时截取第二张图）
- Then 以下三点均满足才 PASS，任一不满足即 FAIL：
  - **首屏完整性**：首屏截图中 meta-tags-bar 完整可见，不被 ImageViewer 内部区域遮挡或裁切
  - **可用尺寸**：图片查看区域保持可用尺寸，不因 meta-tags-bar 占用额外高度而被压缩——操作化判定为 vision-engine 报告须明确指出"ImageViewer 可视区域高度相较（假设无 meta-tags-bar 时的）预期占屏比例，是否存在肉眼可辨的塌陷"；同时 DOM 辅助判定：ImageViewer 根节点 `offsetHeight` 与 `.content-area` 的 `clientHeight` 之差应可解释为"恰好等于或小幅小于 meta-tags-bar 的 `offsetHeight`"，而非出现远超 meta-tags-bar 高度的额外缺失（远超即视为异常压缩）
  - **无滚动冲突/抖动**：vision-engine 比对首屏截图与滑动后截图，检查 meta-tags-bar 与 ImageViewer 衔接处是否出现重影（同一元素在两张截图中出现可辨识的双重轮廓）或跳变（内容位置变化明显不符合单次滑动手势应有的连续位移）；观察到重影或跳变判 FAIL，未观察到判 PASS；滑动后 meta-tags-bar 应按文档流位置正常划出可视区域（不再出现在滑动后截图内，或仅部分残留且位置符合单次滑动位移量）

#### BDD-11: Html viewer（滚动架构例外）下 meta-tags-bar 表现独立验证
- Given 移动端 viewport 下打开 `html-csp-test` entry（走 `HtmlViewer`，`height:100%; overflow:hidden`，紧随 meta-tags-bar 同级渲染于 `.content-area` 内）
- When 用 vision-engine 分析首屏截图（页面首次渲染完成、未做任何滑动操作时截取）+ 滑动后截图（在 HTML 内容区域中点位置执行一次垂直向上滑动手势，滑动距离约 200-300px、模拟单指上滑约三分之一到一半屏高，动作完成且页面无进行中动画时截取第二张图）
- Then 以下三点均满足才 PASS，任一不满足即 FAIL：
  - **首屏完整性**：首屏截图中 meta-tags-bar 完整可见，不被 HtmlViewer 内部区域遮挡或裁切
  - **可用尺寸**：HTML 内容查看区域保持可用尺寸，不因 meta-tags-bar 占用额外高度而被压缩——操作化判定为 vision-engine 报告须明确指出"HtmlViewer 可视区域高度相较（假设无 meta-tags-bar 时的）预期占屏比例，是否存在肉眼可辨的塌陷"；同时 DOM 辅助判定：HtmlViewer 根节点 `offsetHeight` 与 `.content-area` 的 `clientHeight` 之差应可解释为"恰好等于或小幅小于 meta-tags-bar 的 `offsetHeight`"，而非出现远超 meta-tags-bar 高度的额外缺失（远超即视为异常压缩）
  - **无滚动冲突/抖动**：vision-engine 比对首屏截图与滑动后截图，检查 meta-tags-bar 与 HtmlViewer 衔接处是否出现重影（同一元素在两张截图中出现可辨识的双重轮廓）或跳变（内容位置变化明显不符合单次滑动手势应有的连续位移）；观察到重影或跳变判 FAIL，未观察到判 PASS；滑动后 meta-tags-bar 应按文档流位置正常划出可视区域（不再出现在滑动后截图内，或仅部分残留且位置符合单次滑动位移量）

### 跨端不回归

#### BDD-12: 桌面端 markdown-body padding 不受影响
- Given 桌面端 viewport（>640px）下打开一个 markdown entry
- When 测量 `.markdown-body` 的 computed padding 值
- Then 桌面端 `.markdown-body` 的 padding 计算值保持为 `var(--space-5)`（24px）不变，与改动前完全相等（判定标准为"相等"而非"不低于"）

#### BDD-13: 桌面端不出现移动端专属组件
- Given 桌面端 viewport（>640px）下打开任意 entry
- When 页面渲染完成，用 vision-engine 检视桌面端截图
- Then 视口内不出现 `mobile-bottom-bar`（图标化的 Copy/Wrap 按钮不会出现在桌面端）；`EntryMetaTagsBar` 组件不渲染（meta 信息仍通过桌面端既有的 `EntryDetailHeader.vue` `.meta-row` 呈现，不受本次改动影响）

### 视觉断言占比统计

统计口径：仅当一条 BDD 的 When/Then 子句**正文显式声明** `vision-engine` 作为判定方法之一，才计入视觉断言分子；纯 DOM/CSS 数值断言（即使附带"截图佐证"措辞）不计入，理由是截图在这些条目里不提供 DOM 测量之外的独立判定信息（BDD-1 本轮已按此口径纠正分类，见上方 BDD-1）。

| 分类 | BDD 编号 | 数量 |
|---|---|---|
| 视觉断言（正文显式声明 vision-engine） | BDD-2, 3, 5, 7, 9, 10, 11, 13 | 8 |
| DOM/CSS 数值断言（含带截图佐证但非独立判据的条目） | BDD-1, 4, 6, 8, 12 | 5 |

**真实占比：8/13 ≈ 61.5%**，超过 60% 门槛（P0-brief known_risks 要求"BDD 必须包含可截图验证的视觉呼吸感类条件，不能只写数值断言"）。此数字为本轮修订后的最终统计，替代上一轮自评的 9/13≈69%（该数字因误将 BDD-1 计入视觉断言分子而虚高，已在评审中核实并更正）。

## 4. 待确认清单

[SUGGEST: DESIGN.md L158-160 Icon Buttons 一节建议本次一并补充"带持久状态的图标按钮用 `.toggle-btn`，无状态一次性动作用 `.icon-btn`，带文字标签的用 `BaseButton`"判断准则。理由——本次 bug 根因之一正是 Copy/Wrap 未遵循这条隐含准则而自建了 `.bottom-btn`，显式写入文档可防止同类问题复发；属于纯文档补充，不改变任何代码行为，不涉及业务方向判断，风险为零。若无异议按此方向纳入，不需要额外用户确认。]

[SUGGEST: content-area 的 8px 水平 padding 与 DESIGN.md L113"16px mobile"通用容器规则字面冲突，建议本次在 DESIGN.md 补充一句"detail page content-area 是刻意的例外覆盖"以消除字面矛盾。理由——用户已明确保留 8px 不改（P0-brief 已确认），此改动仅为文档层面消除歧义，不改变任何代码行为，不涉及业务方向判断。若无异议按此方向纳入，不需要额外用户确认。]

[NO_NEED_CONFIRM]（除上述两条不阻塞的 [SUGGEST] 外，无遗留需人拍板的方向性待确认事项；4 处实现方案与数值均已在会话内定型，P1 未发现 P0-brief 未覆盖的新的业务方向性问题）

## 5. 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
跳过风险: 无阶段跳过。理由——代码改动本身局限于 4 个文件（EntryMetaTagsBar.vue/MarkdownViewer.vue/EntryDetailMobileBar.vue + DESIGN.md），但 P6 验收范围扩大到全部 9 种 viewer + 2 个滚动架构例外场景（Image/Html，此前从未截图验证过 meta-tags-bar 与 height:100%;overflow:hidden 区域的交互表现），不确定性和工作量明显高于"只改 4 处"的表面评估；P0-brief 裁剪倾向已明确"不建议因为代码改动小而低估 risk_level 或裁掉 P6"，P1 判断全阶段保留，与 P0-brief 一致
follows_existing_pattern: [frontend-v3/src/components/EntryDetailHeader.vue, frontend-v3/src/components/EntryDetailMobileBar.vue]
```

Copy 图标化对齐 `EntryDetailHeader.vue` 的 `.icon-btn`（L36-38/163-166）既有模式；Wrap 图标 toggle 对齐 `EntryDetailMobileBar.vue` 自身已有的 `source-toggle`/`.toggle-btn`（L18-27/100-113）既有模式，`design_trivial` 与 `follows_existing_pattern` 均适用，P2 architect 可据此简化候选方案探索。

## 6. 范围声明

```yaml
domains: [frontend]
packages: [frontend-v3]
```

涉及文件（供 P2/P7 交叉核对）：
- `frontend-v3/src/components/EntryMetaTagsBar.vue`（padding 16px/16px、`overflow-x:auto` → `flex-wrap:wrap`）
- `frontend-v3/src/components/MarkdownViewer.vue`（`.markdown-body` mobile 断点补回 16px padding）
- `frontend-v3/src/components/EntryDetailMobileBar.vue`（padding-bottom 叠加修复；Copy 改 `.icon-btn`；Wrap 改 `.toggle-btn` + `WrapText` 图标）
- `frontend-v3/src/components/EntryDetailHeader.vue`（只读参照，Copy `.icon-btn` 视觉基准，本次不改动此文件）
- `frontend-v3/src/components/EntryDetailContent.vue`（只读参照，确认 `.content-area` 8px 水平 padding 与 `EntryMetaTagsBar` in-flow 挂载位置，本次不改动此文件）
- `frontend-v3/src/components/ImageViewer.vue` / `HtmlViewer.vue`（只读参照，滚动架构例外 `height:100%;overflow:hidden`，本次不改动这两个文件，仅验证其与 meta-tags-bar 的交互表现）
- `DESIGN.md`（L221-223 markdown-body 描述、L267 fixed bottom bar 描述、L218-219 meta tags bar 换行说明，可选 L158-160 icon button 判断准则、可选 L113/content-area 例外说明）

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收核心手段——meta-tags-bar 留白改善、Copy/Wrap 图标视觉一致性、Wrap active 态可区分、Image/Html 例外场景遮挡判定等均为视觉断言，纯 DOM 测量无法判定，需要截图 + vision 分析
    available:
      - "vision-analyst（agate 内置执行角色，首选）"
      - "playwright-cdp skill（已在本次调研中验证 :18800 Chrome CDP 可达，用于截图）"
      - "vision-engine skill（图像分析，本次调研中已验证可用）"
    status: available

  - need: mobile-viewport-emulation
    why: 全部 13 条 BDD 均需要移动端 viewport（≤640px）与桌面 viewport（>640px）对比验证，且需要切换 9 个不同测试 entry（BDD-9/10/11）
    available:
      - "playwright-cdp skill（CDP device emulation 支持自定义 viewport 宽高）"
    status: available
```

说明：本次 known_risks 中提到的"iOS 虚拟键盘 safe-area 联动"问题属于 T090 已收口的已知限制（T090 P1-requirements.md 已标记为 `supplementable`，真机人工验证跟踪项），本任务不改动底部栏的 `position: fixed` 定位机制本身（只改 padding 基准值与叠加方式），不重复引入或加剧该已知限制，不在本任务能力需求声明中重复列出。
