## P1 analyst progress

- 已读 analyst.md（角色定义）、P1-dispatch-context-analyst.md（派发指引）、P0-brief.md（4处已定型方案+9种viewer覆盖+known_risks）
- 已读 T090 P1-requirements.md（了解 BDD-1~12 既有覆盖范围，含 meta-tags-bar 跳变修复/底部栏固定/markdown 边距缩减，本任务是其上一层的视觉打磨修正，编号从 BDD-1 重新开始）
- 已读源码：EntryMetaTagsBar.vue（当前 padding 8px 12px + overflow-x:auto，已确认待改）、MarkdownViewer.vue（.markdown-body mobile margin:0;padding:0，待改为 padding:16px）、EntryDetailMobileBar.vue（已确认 padding-bottom: env(...) 直接覆盖而非叠加的 bug，present in code exactly as P0-brief 描述；Copy 当前是 .bottom-btn.primary 文字+蓝底，Wrap 是纯文字 .bottom-btn，均待改）、EntryDetailHeader.vue L36-38/163-166（桌面端 .icon-btn 视觉定义已确认，作为 Copy 图标化对齐基准）
- 已读 DESIGN.md L100-290：确认 L218-219（Meta Tags Bar Mobile）已是"随文档流嵌入"描述但未提换行；L221-223（Markdown Body Spacing Mobile）当前文字"no additional margin/padding"与新方案冲突需改；L267（fixed bottom bar 描述）文字里的 `padding-bottom: env(...)` 写法与代码 bug 完全一致，需改为 calc() 叠加形式；L270-278 Scroll Architecture 确认 HtmlViewer/ImageViewer 例外（height:100%;overflow:hidden）
- 已用 grep 核实：EntryDetailContent.vue L227-233 `.content-area` 移动端 padding 为 var(--space-3) var(--space-2)（12px 8px），与 P0-brief"保留 8px 水平 padding"一致；EntryMetaTagsBar 在 L24 已是 .content-area 内第一个子节点（in-flow），HtmlViewer/ImageViewer 紧随其后同级渲染，height:100% 相对 .content-area——存在 P0-brief known_risks 提到的潜在遮挡/裁切风险，已计划纳入 Image/HTML 各自独立 BDD
- 已确认 lucide-vue-next 存在 WrapText 图标（grep 验证），--space-1~4 token 值（4/8/12/16px），--mobile-bar-height: 64px
- 开始撰写 P1-requirements.md（13 条 BDD，覆盖 6 类要求）
- 已写入 P1-requirements.md：13 条 BDD（BDD-1~13，连续不跳号），视觉断言占比 9/13≈69%（≥60%门槛）；domains=[frontend] packages=[frontend-v3] risk_level=medium phases=P1~P8全保留；capability_requirements 声明 browser-vision + mobile-viewport-emulation，均 status:available；2 条 [SUGGEST]（非阻塞）+ [NO_NEED_CONFIRM]
- 自检完成，P1 analyst 任务结束

## P1 requirements-review progress

- 已读角色定义（requirements-review.md）、dispatch-context（5 项重点检查）、P0-brief.md、P1-requirements.md
- 已用 grep/Read 核实源码：EntryMetaTagsBar.vue（padding 8px/12px + overflow-x:auto 现状确认）、EntryDetailMobileBar.vue（padding-bottom env() 覆盖 bug 现状确认）、MarkdownViewer.vue L131-135（mobile margin:0;padding:0 现状确认）、EntryDetailContent.vue L23-56（meta-tags-bar 与 HtmlViewer/ImageViewer 同级兄弟节点关系确认）、HtmlViewer.vue/ImageViewer.vue（height:100%;overflow:hidden 确认）、DESIGN.md L100-290（L218-223/L267/L270-278 全部核对）
- 重点检查 1（视觉断言占比）：发现 analyst 自评"9/13≈69%"存在方法论错误——BDD-1 被误计入视觉断言分子（实质是 scrollWidth<=clientWidth 的纯 DOM 断言，截图仅为佐证），真实占比在 46%~61.5% 区间，逼近/跌破 60% 门槛
- 重点检查 2（BDD-2 判定锚点）：判定不够具体，唯一一条纯主观 vision-engine 判定且无 DOM 数值兜底，存在假通过风险，需打回补充
- 重点检查 3（BDD-10/11 技术描述）：DOM 关系与 height:100% 机制描述经源码核实准确；但 Then 子句量化标准不足 + 验证方法未显式声明，需补充
- 重点检查 4（数值转译）：全部核实一致，无抄错
- 重点检查 5（两条 SUGGEST）：均合理，零风险，可直接采纳
- 额外发现：BDD-9 的 Given 子句（7 entry）与脚注扩展范围（+3 entry = 10 entry）不一致，存在 P6 遗漏风险
- 产出 P1-review.md，status: needs-revision，逐条 BDD 判定 + 覆盖维度标注 + 隐含需求覆盖 + 裁剪评审均已给出，5 项重点检查逐一引用 BDD 编号/源码行号核实
- 自检完成，P1 requirements-review 任务结束

## P1 修订 retry1 — 进度记录

### 修复点 1: BDD-1 分类纠正（完成）
把 BDD-1 Then 子句改写为明确的 DOM 数值断言表述，删除暗示"截图+DOM 双重验证"的措辞，显式声明"本条为 DOM 断言，不计入视觉断言统计"。

### 修复点 2: BDD-2 补 DOM 辅助判定阈值（完成）
核算依据：`EntryMetaTagsBar.vue` 新 padding `var(--space-4) var(--space-4)`（`variables.css` `--space-4: 16px`）→ 垂直内边距固定 32px；组件未覆写 line-height，继承 `base.css` `body{line-height:1.5}`，`--font-xs: 12px` 文本单行行高 ≈18px；理论单行高度 ≈50px；取80%作为跨浏览器保守下限 → 阈值 40px，仍显著超过基线约17px（超出135%+）。已写入 BDD-2 Then 子句作为 (a) DOM 辅助判定，与 (b) vision-engine 主观判定并列，二者同时满足才 PASS。

### 修复点 3: BDD-10/11 补验证方法声明 + 判定标准具体化（完成）
When 子句显式加入"用 vision-engine 分析首屏截图 + 滑动后截图"（与 BDD-2/3/5/7/9/13 写法一致）。"不可用尺寸"给出操作化判定：vision-engine 报告须明确指出可视区域高度相较预期占屏比例是否有肉眼可辨塌陷，并补充 DOM 辅助判定（offsetHeight 差值应可解释为约等于 meta-tags-bar 高度，而非远超）。"滚动冲突/抖动"给出具体滑动手势序列（区域中点垂直上滑约200-300px）+ 两张截图比对重影/跳变的操作化标准。BDD-10/11 改法一致。

### 修复点 4: BDD-9 补全 Given 范围（完成）
Given 子句直接列出全部 10 个 entry（含 svg-standalone/mermaid-charts/plantuml-arch），标题由"7 种"改为"10 种"。原脚注保留为解释性说明（为何 SVG/Mermaid/PlantUML 与 Image/Html 分组不同），并显式声明"验收范围以 Given 列出的 10 个 entry 为准，不得只跑 7 个"。

### 视觉断言占比重新统计（完成）
显式声明 vision-engine 作为核心判定方法的 BDD：2/3/5/7/9/10/11/13 = 8 条；纯 DOM 数值断言（含 BDD-1，本轮已纠正措辞）：1/4/6/8/12 = 5 条。真实占比 8/13 ≈ 61.5%，超过 60% 门槛，统计口径为"正文 Then/When 子句显式声明 vision-engine 作为判定方法之一"，无宽容计入项，经得起逐条复核。

## P1 requirements-review progress — 第 2 轮复核（retry1）

- 已读 dispatch-context-requirements-review-retry1.md（5 项逐一复核清单）、修订后 P1-requirements.md、上轮 P1-review.md
- 用 grep/Read 独立核实源码数值：`variables.css`（`--space-2:8px --space-3:12px --space-4:16px --font-xs:12px`）、`base.css` L16（`body{line-height:1.5}`）、`EntryMetaTagsBar.vue`（改动前 padding 8px/12px、`.status-tag{font-size:10px;padding:1px 6px}`）、`EntryDetailContent.vue`/`HtmlViewer.vue`/`ImageViewer.vue`（DOM 兄弟关系、height:100% 机制，本轮未改动，沿用上轮核实结论）
- 复核 1（BDD-1 措辞）：RESOLVED，When/Then 正文不含 vision-engine，显式声明"不计入视觉断言统计"
- 复核 2（BDD-2 40px 阈值）：**未通过**——用同一推算公式反推"改动前"状态得理论 34px（16px padding+18px 行高），与 P0-brief 实测基线 17px 相差约 2 倍，analyst 未提及/未处理此已知偏差；进一步发现 17px 与 `.status-tag` 子元素按同公式算出的高度（10×1.5+1+1=17）精确吻合，不能排除基线测量对象（子元素 vs 整条容器）不一致。"取 80%"有文字说明但未针对具体偏差来源校准，仍是未经验证的经验系数。判定 needs-revision，要求 analyst 用 debug 环境实测校准或如实标注不确定性
- 复核 3（BDD-10/11 可操作化）：RESOLVED，When 显式含 vision-engine，滑动手势/截图时机/重影跳变比对依据均已具体化，可用尺寸判定改为可执行的 DOM 相对判据
- 复核 4（BDD-9 覆盖 10 entry）：RESOLVED，Given 直接列出 10 个 entry，已核实 `scripts/seed-data/` 下 10 个目录均存在
- 复核 5（视觉断言占比独立核算）：RESOLVED，逐条核对 When/Then 正文是否含 vision-engine 字样，独立得出分子=8（BDD-2/3/5/7/9/10/11/13）分母=13，8/13≈61.5%，与 analyst 自报数字一致；同时指出若 BDD-2 因复核 2 的问题被迫改写去掉 vision-engine，占比会跌到 7/13≈53.8% 跌破门槛，凸显复核 2 问题的重要性
- 覆写 P1-review.md，status: needs-revision（4/5 项修复确认，1 项 BDD-2 DOM 阈值推算依据未通过独立校核，需针对性再修）
- 自检完成，第 2 轮 requirements-review 任务结束

## P1 Retry 2（analyst，本轮）

- 读取 dispatch-context-analyst-retry2.md：确认唯一待修项是 BDD-2 的 DOM 阈值，主 Agent 已用 Playwright CDP 在 markdown-test entry 上通过 addStyleTag 实测目标 CSS 后的容器高度为 89px（非理论公式）。
- 诊断根因摘要：上轮 40px 阈值基于"padding 32px + 单行行高 18px"公式反推，被 reviewer 指出反推回改动前应得 ~34px、与 P0-brief 记录的 17px 基线不符，公式站不住；真实原因是 markdown-test 标签数量较多，flex-wrap:wrap 生效后为多行布局，实测 89px 远高于单行理论值。
- 修订方式：选择"绝对值打折"写法（非相对倍数）。明确 BDD-2 使用的测试 entry 为 markdown-test；阈值改为 71px（89px × 0.8 ≈ 71.2px 取整），并写明该阈值专用于 markdown-test，不代表所有 entry 的统一固定值；同时保留"71px 仍超过 17px 基线约 4.2 倍"的交叉验证说明，确保与实测数据不矛盾。
- 仅修改 BDD-2 的 Then (a) DOM 辅助判定子条件的正文与 Given 的 entry 指定；BDD-2 的 (b) vision-engine 主观判定、DESIGN.md 同步说明，以及 BDD-1/3-13 全部保持原样未动。
- 视觉断言占比统计表（BDD-2 归类为视觉断言）不受本轮改动影响，未改动该节。

## P1 requirements-review progress — 第 3 轮复核（retry2，P1 最终轮）

- 读取 dispatch-context-requirements-review-retry2.md（复核清单仅 3 项，聚焦 BDD-2 阈值来源）、本轮修订后 P1-requirements.md、第 2 轮 P1-review.md（问题背景）。
- 复核 1（71px=89px×0.8 推导合理性）：**通过**——判定性质变化的关键在于本轮阈值来源从"未经校准的理论公式"换成了"主 Agent 用 addStyleTag 实测的真实值"，测量条件（目标 CSS）与最终实现一致；80% 折扣理由具体（设备/浏览器/字体渲染差异安全边际），不是打在一个已知有偏差的数字上；71px vs 17px 基线的"逾3倍/约4.2倍"两种表述互相自洽，非上轮式的测量对象混淆。
- 复核 2（entry 锚定）：**通过**——Given 与 Then(a) 末尾"适用范围说明"均明确限定 `markdown-test`，显式排除套用到其他 entry 的风险。
- 复核 3（其余 12 条 BDD 未动）：**通过**——逐条核对 BDD-1/9/10/11 正文与第 2 轮评审引用原文逐字一致；交叉核对 analyst 本轮 progress 记录（仅改 BDD-2(a)）与独立核对结果一致；视觉断言占比 8/13≈61.5% 未变。
- 覆写 P1-review.md，status: **approved**，给出完整 13 条 BDD 编号锚点覆盖（BDD-2 详细展开，其余 12 条简要"保持不变"确认）。
- 自检完成，第 3 轮（P1 最后一轮）requirements-review 任务结束，P1 阶段可推进至 P2。
