---
phase: P1
task_id: T090-mobile-detail-ux-polish
type: review
parent: P1-requirements.md
trace_id: T090-P1-review-20260808
status: approved
created: 2026-08-08
revised: 2026-08-09
agent: requirements-review
---

# P1-review — T090 移动端详情页 UX 打磨（第 3 轮复核，最终轮）

> 本轮范围：仅复核第 2 轮提出的 2 处剩余缺口（BDD-8 数值公式与自带示例矛盾、iOS safe-area 理由与 [CORRECTION] 矛盾）是否解决。其余部分前两轮已评审通过，保持不变，本轮不重复挑剔。因本轮判定为 approved，按角色要求补齐全部 12 条 BDD 的编号锚点 + 覆盖维度清单。

## 2 处缺口复核结论

### 缺口 1：BDD-8 数值公式与自带示例矛盾 — 已解决

第 2 轮指出的矛盾：原文举例"如 11px、12px 即视为通过"，但按"相对基线 40px 缩减 ≥75%"的公式实算，11px/12px 对应缩减比例分别为 72.5%/70%，均不满足 ≥75%，公式与自带示例互相矛盾。

复核本轮文本（`P1-requirements.md` L112）：
> "Then 左右两侧间距之和相对当前基线（约 40px）缩减 ≥ 75%（即降至约 10px 或更小）。10px 为参考值，不是精确验收硬线……验收以'相对基线缩减 ≥75%'这一比例判定为准，P2 设计阶段自行核算最终选定数值是否满足该比例即可，不需要额外走 baseline-change 流程"

- 已用 grep 核实全文不再出现"11px""12px"字样（仅保留"10px"）。
- 唯一保留的数值示例"约 10px 或更小"与公式自洽验算：40 - 40×75% = 10，即"缩减 ≥75%"精确对应"降至 ≤10px"，两者互为等价表述，不再是"公式算出不达标却被举例称为通过"的矛盾状态。
- Section 1 的"缩减到当前的 1/4 甚至更小"（40×1/4=10px）与本条"约10px 或更小"目标描述也保持一致，三处（section 1 目标 / BDD-8 公式 / BDD-8 示例数值）不再互相矛盾。
- P2 设计阶段可执行性验证：给定任意最终选定的数值 X，判定 `(40-X)/40 ≥ 0.75` 即 `X ≤ 10`，公式清晰可算，不依赖对示例数值的额外解读。

**结论：缺口 1 已解决，BDD-8（`#### BDD-8:` L109）现为可二值判定条件，公式与文本内部无矛盾。**

### 缺口 2：iOS safe-area 边界风险收口理由与 [CORRECTION] 矛盾 — 已解决

第 2 轮指出的矛盾：边界风险收口第 4 项原文以"与本任务引入的 `position: fixed` 定位机制无直接耦合关系"为由豁免验证，但文档自身 [CORRECTION] 段落明确说明问题 2 的修复方案正是把 `EntryDetailMobileBar.vue` 改为 `position: fixed; bottom: 0`，两处自相矛盾。

复核本轮文本（`P1-requirements.md` L43，边界风险收口第 4 项）：
> "iOS 虚拟键盘弹出时 safe-area-inset 计算：本次范围内不新增自动化验证，**但该风险确由本任务引入，不是"与本次改动无关"**。理由——[CORRECTION] 已明确指出问题 2 的修复方案正是把 `EntryDetailMobileBar.vue` 从'flex 尾部伪固定'改造为真正的 `position: fixed; bottom: 0` + `env(safe-area-inset-bottom)`（对应 BDD-4/BDD-5）；iOS Safari 上'虚拟键盘弹出时 `position: fixed` 元素与 safe-area/visualViewport 联动异常'是该平台的已知问题类别，且**只在元素变为 `position: fixed` 之后才会暴露**……因此这一风险属于本任务 `position: fixed` 方案可能引入的已知限制，不能用'无耦合'来豁免。不新增验证的真实原因是环境能力限制：当前 CDP/Playwright 自动化无法真实触发 iOS 原生虚拟键盘弹出、无法复现 `visualViewport` resize 与 safe-area-inset 的真实联动行为……该项标记为已知限制/后续人工真机验证跟踪项，P6 验收阶段不强制覆盖该场景，但验收报告须显式记录为'未覆盖、需人工真机跟踪验证'，不得声称已验证不存在风险。"

逐点核对第 2 轮要求的三项：
1. **是否改口承认风险确由 `position: fixed` 方案引入（不再说"无耦合"）**：是。原文已删除"无直接耦合关系"表述，改为显式承认"该风险确由本任务引入""不能用'无耦合'来豁免"，与 [CORRECTION] 描述的技术方案（改为 `position: fixed`）完全一致，不再自相矛盾。
2. **是否准确解释"不新增自动化验证"的真实原因是 CDP/Playwright 环境无法复现 iOS 原生键盘交互（而非风险本身不存在）**：是。原文明确区分"风险存在"与"无法自动化验证"两件事——风险被承认存在，不验证的原因归因于环境能力限制（"当前 CDP/Playwright 自动化无法真实触发 iOS 原生虚拟键盘弹出"），并要求 P6 验收报告显式记录为"未覆盖、需人工真机跟踪验证"而非"已验证无风险"，逻辑闭环无漏洞。
3. **`capability_requirements` 是否新增对应条目，status 及理由是否站得住**：是。已核对 `P1-requirements.md` L186-190 新增条目：
   ```yaml
   - need: ios-real-device-keyboard-interaction
     why: ……该风险由本任务引入的 position: fixed 方案导致（见 [CORRECTION]），非无关风险，但 CDP mobile viewport emulation 不模拟真实虚拟键盘弹出对 visualViewport 的影响，无法在当前自动化环境中复现
     available:
       - "真机人工验证（……作为已知限制的后续跟踪项，不阻塞本次自动化验收流程）"
     status: supplementable
   ```
   `status: supplementable` 判断正确（不是 `GAP`）：存在明确可执行的替代验证路径（真机人工验证），只是当前自动化环境覆盖不到，符合三态判断中"有替代路径可补充"的定义，不构成阻塞流程推进的能力缺口。

**结论：缺口 2 已解决，理由链条（风险存在 → 不新增自动化验证的真实原因 → capability_requirements 兜底声明）三段均自洽，与 [CORRECTION] 无矛盾。**

## BDD 评审（12 条全量锚点，approved 判定完整覆盖）

- BDD-1（`#### BDD-1:` L66，Markdown 视图移动端上滑无跳变）：判定可二值（"连续位移"vs"一次性跳变"均为可观测行为）+ 覆盖维度：数据 N/A（已在 section 2 声明纯前端展示层无数据影响）/ 前端✓（滚动交互行为定义）/ 多端 N/A（已声明无 MCP/CLI/API 涉及）/ 边界✓（内容超一屏场景）/ 兼容：由 BDD-10 覆盖桌面端不回归，本条不重复
- BDD-2（`#### BDD-2:` L71，Code viewer 跨 viewer 一致性）：判定可二值 + 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界✓（同 BDD-1 场景条件）/ 兼容✓（跨 viewer 类型一致性正是本条目的，范围收窄声明说明其余 viewer 复用同一路径不逐个建 BDD，理由成立）
- BDD-3（`#### BDD-3:` L78，metadata 完全由文档流位置决定可见性）：判定可二值（"是否存在与位置无关的独立显示/隐藏切换"为明确事实判断）+ 覆盖维度：数据 N/A / 前端✓（交互逻辑定义，对应 [BASELINE_CHANGE] 替换 DESIGN.md L219）/ 多端 N/A / 边界✓（上滑+下滑两方向）/ 兼容 N/A（本条是新行为定义，兼容性回归由 BDD-10 单独覆盖）
- BDD-4（`#### BDD-4:` L85，操作栏视口底部固定）：判定可二值（屏幕坐标是否变化可测量）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界✓（顶/中/底三滚动位置）/ 兼容 N/A（由 BDD-12 覆盖桌面端不出现该行为）
- BDD-5（`#### BDD-5:` L90，操作栏不被地址栏遮挡）：判定可二值（是否被裁切/遮挡可观测）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界✓（两种可视高度模拟地址栏展开/收起）/ 兼容✓（跨浏览器地址栏行为差异正是问题 2 的核心诉求，capability_requirements 中已声明该验证为静态高度代理而非真实动画复现，范围收窄合理不构成 GAP）
- BDD-6（`#### BDD-6:` L95，底部栏 markdown 场景按钮功能不变）：判定可二值（各按钮触发的功能是否与改动前一致）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界：与 BDD-7 已分离处理 canWrap/isMarkdown 互斥场景，无遗留边界空隙 / 兼容✓（功能回归测试）
- BDD-7（`#### BDD-7:` L102，底部栏 wrap 按钮功能不变）：判定可二值 + 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界✓（`canWrap` 条件边界，已用代码实测核实 L18-24 逻辑与 Given 条件吻合）/ 兼容✓（功能回归测试）
- BDD-8（`#### BDD-8:` L109，markdown 边距相对基线缩减 ≥75%）：判定可二值（本轮复核已确认公式与示例数值自洽，见上文缺口 1 结论）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界：数值下界由 BDD-9（375px 极小屏）补充验证可读性边界，无缺口 / 兼容 N/A（新行为要求，非回归条款，回归由 BDD-11 覆盖）
- BDD-9（`#### BDD-9:` L114，375px 极小屏无溢出/无截断）：判定可二值（是否产生水平溢出/文字截断均为明确可观测事实）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界✓（本条本身即边界场景，覆盖 section 2 边界风险收口第 1 项）/ 兼容✓（跨设备尺寸兼容性）
- BDD-10（`#### BDD-10:` L121，桌面端 header 滚动行为不回归）：判定可二值 + 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界：>640px 断点本身作为该条 Given 条件 / 兼容✓（回归测试核心目的，呼应 section 2 边界风险收口第 3 项"横屏跨阈值不新增验证"的理由——桌面分支行为本就应与改动前一致）
- BDD-11（`#### BDD-11:` L126，桌面端 markdown 边距不变）：判定可二值（本轮复核确认"相等"判定已消歧，见第 2 轮已解决的缺口，本轮未涉及不重复评审）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界：token 值精确判定（`--space-5` 24px）/ 兼容✓（回归测试）
- BDD-12（`#### BDD-12:` L131，桌面端不出现移动端专属固定底部栏）：判定可二值（元素是否出现于视口底部可观测）+ 覆盖维度：数据 N/A / 前端✓ / 多端 N/A / 边界：>640px 断点 / 兼容✓（回归测试，与 BDD-4 互补构成完整的移动/桌面二分覆盖）

BDD 编号连续性复核：grep 核实 `#### BDD-1:` 至 `#### BDD-12:` 各出现一次，编号 1-12 连续不跳号、不重号，与第 2 轮核对结论一致（本轮未改变编号结构）。

## 隐含需求覆盖（section 2 表格 + 边界风险收口 4 项，前两轮已确认，本轮复核未发现劣化）

- 数据维度：覆盖（已声明无数据模型/存量数据受影响，纯前端展示层改动，理由充分）
- 前端维度：覆盖（domains: [frontend]，列出受影响组件 EntryDetailHeader/EntryDetailContent/EntryDetailMobileBar/useResponsiveLayout/MarkdownViewer，与 BDD 引用的文件路径一致）
- 多端维度：覆盖（已声明 MCP/CLI/后端 API 不涉及移动端布局，理由成立）
- 架构约束维度：覆盖（显式声明保留 `.content-area` 单一滚动容器，对齐 T084/T085 决策，不引入第二滚动容器）
- 边界维度：4 项风险逐一收口——①极小屏可读性→转化为 BDD-9 ②空 tags/无 owner 占位→理由成立（滚动机制与内部排布正交）③横屏跨阈值→理由成立（断点判定逻辑未改动）④iOS safe-area→本轮复核确认理由已改口成立（见上文缺口 2 结论）。4 项均无遗留中间态。
- 兼容维度：覆盖（Zen 模式隐藏规则、既有按钮功能集合均声明保持不变，并有 BDD-6/BDD-7/BDD-10/BDD-11/BDD-12 对应回归验证条件）

## 裁剪评审

- `phases: [P1, P2, P3, P4, P5, P6, P7, P8]`：无阶段跳过。理由：跨多个公共组件 + 涉及 DESIGN.md L219 baseline change + 涉及浏览器兼容性已知坑点（100vh/safe-area），medium risk 下均不满足任一阶段的裁剪触发条件。与 P0-brief 裁剪倾向（P2 不可裁、P3 不建议跳过）一致，理由充分。
- `risk_level: medium`：与实际风险匹配——涉及跨组件回归面（header/content/mobile-bar 均是详情页公共组件）+ DESIGN.md 决策变更 + 浏览器兼容性已知坑点，不属于单文件小改动，不属于 high risk 的破坏性/安全类变更，medium 定级合理。
- `capability_requirements` 三态判断：browser-vision/mobile-viewport-emulation 均判定 `available`（已有 playwright-cdp skill + vision-analyst 支撑，理由充分）；`ios-real-device-keyboard-interaction` 判定 `supplementable`（本轮复核确认理由成立，见上文缺口 2 结论），无遗留 `GAP` 阻塞流程推进的能力缺口。

## P1 纯净性核对（前两轮已确认，本轮未发现新增违反）

未发现掺入 P2 solution design 或实现细节的段落——BDD 均描述用户可观测的行为结果（"是否跳变""是否遮挡""缩减比例是否达标"），未规定具体 CSS 实现方式（如未强制指定用 `position: sticky` 还是 `position: fixed` 的具体 CSS 属性名写入 BDD 判定条件本身，相关技术方案讨论限定在 [CORRECTION]/[BASELINE_CHANGE] 说明性段落，不构成 BDD 判定条件的一部分）。

## 结论

**status: approved**

第 3 轮（最终轮）复核确认第 2 轮提出的 2 处缺口均已定向修复：①BDD-8 删除与公式矛盾的"11px/12px"具体示例，仅保留"约 10px 或更小"这一与"≥75%缩减"公式精确等价（40×25%=10）的自洽表述；②边界风险收口第 4 项理由改口，明确承认风险确由本任务引入的 `position: fixed` 方案导致（与 [CORRECTION] 一致），不新增自动化验证的真实原因归因于 CDP/Playwright 环境无法复现 iOS 原生键盘交互（而非风险不存在），并在 `capability_requirements` 新增 `ios-real-device-keyboard-interaction` 条目（`status: supplementable`，理由站得住）。

BDD-1 至 BDD-12 编号连续、语义可二值判定，隐含需求覆盖（数据/前端/多端/边界/兼容五维度）无遗漏，裁剪合理，P1 纯净性无违反。批准进入 P2 设计阶段。
