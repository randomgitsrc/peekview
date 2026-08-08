---
phase: P1
task_id: T090-mobile-detail-ux-polish
type: problems
parent: P0-brief.md
trace_id: T090-P1-20260808
status: draft
created: 2026-08-08
revised: 2026-08-09
agent: analyst
---

# P1-requirements — T090 移动端详情页 UX 打磨

> 本次为第 1 轮修订（针对 P1-review.md status: needs-revision 提出的 5 处缺口定向修补）：①BDD-2 补跨 viewer 范围收窄声明 ②BDD-6 拆分为 markdown 场景（BDD-6）与非 markdown/html 场景（新增 BDD-7，覆盖 wrap 按钮），原 BDD-7/8/9/10 依次顺延为 BDD-8/10/11/12，并新增 BDD-9 覆盖极小屏可读性 ③BDD-8（原 BDD-7）数值表述从硬锁 ≤10px 降级为相对基线缩减比例，10px 降级为参考值 ④BDD-11（原 BDD-9）消除"一致"与"不低于"并存的歧义，改为相等判定 ⑤section 2 边界风险 4 项逐一收口（1 项转化为 BDD-9，3 项显式声明不新增验证 + 理由）。其余部分（BDD-1/3/4/5、[CORRECTION]、[BASELINE_CHANGE]、裁剪说明、domains/packages）原样保留。
>
> 第 2 轮修订（针对 P1-review.md 第 2 轮复核提出的 2 处剩余缺口定向修补，P1 retry 上限内最后一次修订）：①BDD-8 删除与"≥75%缩减"公式矛盾的"如 11px、12px 即视为通过"具体示例数值（方向 A），仅保留比例公式本身，避免公式与自带示例互相矛盾 ②边界风险收口第 4 项（iOS 虚拟键盘 safe-area）理由改口：承认该风险确由本任务引入的 `position: fixed` 方案导致（与 [CORRECTION] 一致，不再声称"无耦合"），但受限于当前 CDP/Playwright 环境无法真实复现 iOS 原生虚拟键盘交互，标记为已知限制/后续人工真机验证跟踪项，并在能力需求声明中新增对应条目（方向 A）。其余部分（BDD-1/2/3/4/5/6/7/9/10/11/12、[CORRECTION]、[BASELINE_CHANGE]、裁剪说明、domains/packages）原样保留。

## 1. 需求复述

移动端详情页存在三处独立的体验问题，均集中在详情页公共组件（header/内容区/markdown 视图），需要在不推翻 T084/T085 已定的 `.content-area` 单一滚动容器架构（DESIGN.md L270-275）前提下逐一修复：

1. **meta-tags-bar 滚动跳变**：`EntryDetailHeader.vue` 的 `.meta-tags-bar` 通过 `max-height` 折叠实现"上滑隐藏、下滑重现"（`useResponsiveLayout.ts` 的 `setupScrollHide`），折叠会改变文档流高度导致 `.content-area` 内容整体位移（跳变）。目标：把 metadata 条改为随内容自然嵌入文档流，上滑时随内容一起划出视口，不做独立的显示/隐藏切换。影响面覆盖所有 viewer（详情页公共组件）。
2. **底部操作栏可见性不稳定**：用户体感"有时显示有时不显示"。目标：操作栏在移动端持续固定于视口底部可见，且不与浏览器自身地址栏冲突/被遮挡（safe-area 兼容）。
3. **markdown 移动端边距过大**：当前移动端三层叠加约 40px 左右总留白，桌面端体验良好。目标：移动端缩减到当前的 1/4 甚至更小。

## 2. 隐含需求识别

| 维度 | 识别结果 | 为什么必须 |
|---|---|---|
| 数据 | 无数据模型/存量数据受影响 | 三处改动均为纯前端展示/交互层，无 API/DB 改动 |
| 前端 | 三处均为显式的展示与交互变化 | `domains: [frontend]`，涉及 `EntryDetailHeader.vue` / `EntryDetailContent.vue` / `EntryDetailMobileBar.vue` / `useResponsiveLayout.ts` / `MarkdownViewer.vue` |
| 多端（MCP/CLI/API） | 无需同步 | 纯前端 UI 改动，MCP/CLI/后端 API 不涉及移动端布局 |
| 架构约束保留 | 必须保留 `.content-area` 作为唯一滚动容器（DESIGN.md L270-275, T084/T085 决策） | meta-tags-bar 嵌入内容流的实现不能引入第二个滚动容器或改变 viewer 组件的 `overflow-y`/`height:100%` 约束，否则与 T084/T085 已验证的架构冲突 |
| 边界 | 极小屏幕（≤375px，如 iPhone SE）markdown 边距缩减后是否仍可读；空 tags/无 owner 时 meta 信息区是否仍合理占位；横屏移动设备 viewport 宽度可能越过 640px 阈值进入"desktop"分支，需与桌面行为保持一致而非产生第三种混合态；iOS 虚拟键盘弹出时 safe-area-inset 计算是否仍正确 | 这些是用户原话未提及但技术上必须验证的边界情况，遗漏会导致小屏幕/横屏用户体验回归。**收口结果见下方「边界风险收口」小节**（4 项逐一给出 BDD 或显式不验证声明，不留中间态） |
| 兼容 | 现有 `.zen-mode :deep(.mobile-bottom-bar) { display:none }`（Zen 模式隐藏底部栏）必须继续生效；`EntryDetailMobileBar.vue` 现有按钮集合（file-tree/toc/source-toggle/wrap/copy/OverflowMenu sheet）功能必须保持不变，只改定位机制 | Zen 模式和按钮功能是本任务范围外的既有行为，改动定位/CSS 不应破坏这些逻辑 |

#### 边界风险收口

1. **极小屏幕（≤375px）markdown 边距缩减后可读性**：判断值得在本任务验收范围内验证（本任务直接改动 markdown 边距，是该改动引入的直接风险）→ 已补 **BDD-9**（375px viewport 下验证无水平溢出、无文字截断）。
2. **空 tags/无 owner 时 meta 信息区占位**：本次范围内不新增验证。理由——本任务只改变 `.meta-tags-bar` 的滚动呈现机制（从独立 `max-height` 显示/隐藏切换改为随文档流嵌入），不改变 `.meta-tags-bar` 内部子元素（tags/owner 等字段）的排布逻辑或空值占位样式；空值占位处理是该组件既有行为，与本次改动的滚动机制无耦合，不属于本次改动引入的新风险。
3. **横屏移动设备跨 640px 阈值进入 desktop 分支的过渡态**：本次范围内不新增验证。理由——640px 断点判定逻辑（`isMobile` 计算）是既有代码，本任务不改变断点阈值或判定方式，只改变断点两侧各自分支内部的呈现细节（移动端滚动嵌入/底部栏 fixed 化/边距缩减）；断点切换点本身的过渡行为（如何从一侧变为另一侧）不受本次改动影响，不属于本次改动引入的新风险。
4. **iOS 虚拟键盘弹出时 safe-area-inset 计算**：本次范围内不新增自动化验证，但该风险确由本任务引入，不是"与本次改动无关"。理由——[CORRECTION] 已明确指出问题 2 的修复方案正是把 `EntryDetailMobileBar.vue` 从"flex 尾部伪固定"改造为真正的 `position: fixed; bottom: 0` + `env(safe-area-inset-bottom)`（对应 BDD-4/BDD-5）；iOS Safari 上"虚拟键盘弹出时 `position: fixed` 元素与 safe-area/visualViewport 联动异常"是该平台的已知问题类别，且**只在元素变为 `position: fixed` 之后才会暴露**——改动前的 flex 尾部排列（无 `position: fixed`）不存在这一问题类别。因此这一风险属于本任务 `position: fixed` 方案可能引入的已知限制，不能用"无耦合"来豁免。不新增验证的真实原因是环境能力限制：当前 CDP/Playwright 自动化无法真实触发 iOS 原生虚拟键盘弹出、无法复现 `visualViewport` resize 与 safe-area-inset 的真实联动行为（详见能力需求声明新增的 `ios-real-device-keyboard-interaction` 条目）。该项标记为已知限制/后续人工真机验证跟踪项，P6 验收阶段不强制覆盖该场景，但验收报告须显式记录为"未覆盖、需人工真机跟踪验证"，不得声称已验证不存在风险。

### [CORRECTION] 对 P0-brief 问题 2 现状描述的修正

P0-brief 认为"代码库里**没有**找到真正意义上的移动端固定底部操作栏组件"。经核实这一判断不准确：

- `frontend-v3/src/components/EntryDetailMobileBar.vue` 确实存在，`class="mobile-bottom-bar"`，`v-if="isMobile"`，包含 file-tree / toc / source-toggle / wrap / copy / `OverflowMenu(variant="sheet")` 全部操作按钮（EntryDetailView.vue 渲染顺序：Header → Banners → Content → **EntryDetailMobileBar** → Dialogs，与 Content 同级，非嵌套在 `.content-area` 内）。
- 但该组件 CSS（`EntryDetailMobileBar.vue` L81-88）**没有 `position: fixed`**，仅靠 `.entry-detail`（`min-height: 100vh` 的 flex column）把它排在最后一个 flex 子项来"看起来固定在底部"。
- 根因判断：`min-height: 100vh` 在移动浏览器地址栏收起/展开时的可视高度计算不稳定（经典 `100vh` 问题），导致这个"伪固定"的底部栏有时被推出可视区域外（需要额外滚动才可见），这正是用户描述的"有时显示有时不显示"。
- 结论：问题 2 的真实工作范围是**修复 `EntryDetailMobileBar.vue` 现有组件的定位机制**（改为真正的 `position: fixed; bottom: 0` + `env(safe-area-inset-bottom)`），**不是从零新建组件**。已有 `OverflowMenuSheet.vue` L130-144（`.bottom-sheet { position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0px); }`）作为项目内既有实现模式（`follows_existing_pattern` 候选）。

此修正已通过 [SUGGEST] 标注在第 4 节，不阻塞推进（见下）。

### [BASELINE_CHANGE] DESIGN.md L219 现有滚动隐藏规则将被替换

[BASELINE_CHANGE: DESIGN.md:219（"On mobile detail page, metadata/tags bar hides on scroll-down, reappears on scroll-up"）现有滚动隐藏规则将被本任务替换为"metadata 嵌入内容流、随滚动自然划走，不做独立显示/隐藏切换"方案，方向相反。理由——用户反馈 `max-height` 折叠导致内容区跳变，体验差；该规则由 T084/T085 阶段引入，本次是显式推翻，非静默覆盖。BDD-3 是该基线变更对应的验收条件。P2 设计阶段须同步修订 DESIGN.md 该条文字表述。]

区别说明：DESIGN.md L263（"primary actions → fixed bottom bar on mobile"）**不是** baseline change——这条规则本来就已声明，只是当前实现（`EntryDetailMobileBar.vue` 缺 `position: fixed`）与文档意图不一致，本任务是让代码追平既有文档声明，不是推翻或反转规则方向。

## 3. BDD 验收条件

### 问题点 1 — meta-tags-bar 嵌入内容流，消除滚动跳变

#### BDD-1: Markdown 视图移动端上滑无跳变
- Given 移动端 viewport（≤640px）下打开一个正文内容超过一屏的 markdown entry
- When 用户在正文区域连续向上滑动
- Then 页面可视内容随滚动操作连续位移，不出现因 header 区域高度突变导致的一次性跳变位移

#### BDD-2: Code viewer 上滑行为与 markdown 一致（跨 viewer 覆盖）
- Given 移动端 viewport 下打开一个纯代码文件（走 CodeViewer 渲染）的 entry，正文内容超过一屏
- When 用户在正文区域连续向上滑动
- Then 页面可视内容同样随滚动操作连续位移，不出现跳变，与 BDD-1 markdown 场景表现一致，不因 viewer 类型不同而有差异

> **范围收窄声明**：`EntryDetailHeader.vue` 及其 `.meta-tags-bar` 是详情页公共组件，所有 viewer（Markdown/Code/Table/Tree/Image/HTML/PlantUML/Mermaid）共用同一份 header 实现和同一套滚动隐藏/嵌入逻辑（该逻辑绑定在 `.content-area` 的 scroll 事件上，不判断当前渲染的是哪种 viewer）。因此 meta-tags-bar 的跳变问题与滚动嵌入修复方案本质上与 viewer 类型无关，BDD-1（markdown）+ BDD-2（code）两种有代表性的 viewer 组合已足以验证跨 viewer 一致性，其余 viewer（Table/Tree/Image/HTML/PlantUML/Mermaid）复用同一路径，不逐个建 BDD。

#### BDD-3: metadata 信息完全由文档流位置决定可见性，不做独立显示/隐藏切换
- Given 移动端 viewport 下打开任意 entry
- When 用户向上滑动使 metadata 区域离开可视区域，随后向下滑动
- Then metadata 区域的出现/消失完全由其在文档流中的滚动位置决定（滚动到该位置才可见/离开该位置才不可见），不存在由滚动方向单独触发、与位置无关的显示/隐藏切换逻辑

### 问题点 2 — 底部操作栏稳定可见（safe-area 兼容）

#### BDD-4: 移动端操作栏在正文滚动过程中始终固定于视口底部
- Given 移动端 viewport 下打开一个正文内容超过一屏的 entry
- When 用户将正文滚动到顶部、中间、底部三个位置
- Then 底部操作栏在视口中的屏幕坐标保持不变（不随正文滚动而移动或消失）

#### BDD-5: 移动端操作栏不被浏览器地址栏遮挡
- Given 移动端 viewport 下，分别模拟两种不同的可视高度（代表浏览器地址栏展开与收起两种状态）打开同一 entry
- When 页面渲染完成
- Then 两种可视高度下，底部操作栏整体均完全落在可视区域内且可点击，不存在部分区域被裁切或遮挡的情况

#### BDD-6: 底部操作栏 markdown 场景既有按钮功能保持不变
- Given 移动端 viewport 下打开一个多文件、含至少一个标题的 markdown entry
- When 用户依次点击底部操作栏中存在的 file-tree / toc / source-toggle / copy / overflow 按钮
- Then 各按钮触发的功能与改动前一致（对应抽屉/切换/复制/更多菜单正常打开且内容正确）

> **场景说明**：经核实 `frontend-v3/src/stores/entryDetail.ts` L18-24，`canWrap` 计算逻辑为 `language === 'markdown'`（或 `'html'`、二进制、无 activeFile）时 `canWrap = false`；`EntryDetailMobileBar.vue` L27 的 wrap 按钮 `v-if="canWrap"`，故 markdown entry 下 wrap 按钮不渲染，本条 Given 不覆盖 wrap；同理 `EntryDetailMobileBar.vue` L10 的 toc 按钮要求 `isMarkdown`，与 wrap 互斥的场景条件无法在同一 Given 内共存。wrap 按钮的验证见 BDD-7。

#### BDD-7: 底部操作栏 wrap 按钮功能保持不变（非 markdown/html 场景）
- Given 移动端 viewport 下打开一个多文件、非 markdown 且非 html 的代码类 entry（如 `.py` 文件；该条件下 `canWrap` 为 true，wrap 按钮渲染）
- When 用户点击底部操作栏的 wrap 按钮
- Then wrap 按钮正确切换代码换行开启/关闭状态，功能与改动前一致

### 问题点 3 — markdown 移动端边距缩减

#### BDD-8: 移动端 markdown 正文左右总留白相对基线大幅缩减
- Given 移动端 viewport（≤640px）下打开一个 markdown entry
- When 测量正文可见文字区域左边缘到视口左边缘、右边缘到视口右边缘的水平间距
- Then 左右两侧间距之和相对当前基线（约 40px）缩减 ≥ 75%（即降至约 10px 或更小）。10px 为参考值，不是精确验收硬线——用户原话"缩减到 1/4 甚至更小，你看看怎么合适"是委托设计判断的语气，非精确数值指令；具体最终数值由 P2 设计阶段结合可读性/触控热区等因素权衡确定，验收以"相对基线缩减 ≥75%"这一比例判定为准，P2 设计阶段自行核算最终选定数值是否满足该比例即可，不需要额外走 baseline-change 流程

#### BDD-9: 极小屏幕（375px 宽）markdown 正文边距缩减后无溢出/无截断
- Given 移动端 viewport 宽度为 375px（如 iPhone SE）下打开一个正文含长段落文字的 markdown entry
- When 页面渲染完成
- Then 页面内容不产生水平方向溢出（页面内容宽度不超过 375px viewport 宽度，不出现横向滚动条），且正文文字完整可见，不出现因边距缩减导致的文字截断或与视口边缘重叠

### 跨端不回归

#### BDD-10: 桌面端 meta-tags-bar/header 滚动行为不变
- Given 桌面端 viewport（>640px）下打开任意 entry
- When 用户滚动正文内容
- Then 桌面端 header/meta-row 的展示行为与改动前一致（滚动隐藏逻辑本就只在移动端生效，桌面端不应新增或损失任何行为）

#### BDD-11: 桌面端 markdown 边距不变
- Given 桌面端 viewport（>640px）下打开一个 markdown entry
- When 测量正文可见文字区域左右留白（即 `.markdown-body` 的 padding token 值）
- Then 桌面端 `.markdown-body` 的 padding token 保持为 `--space-5`（24px）不变，与改动前完全相等。判定标准为"相等"而非"不低于"，二者不并存：本任务范围仅针对移动端，桌面端不应产生任何数值改动（`margin: 0 auto` 产生的动态外边距不在本条判定范围内，其本就随视口宽度变化，非本任务改动对象，也非本条验证目标）

#### BDD-12: 桌面端不出现移动端专属的固定底部操作栏
- Given 桌面端 viewport（>640px）下打开任意 entry
- When 页面渲染完成
- Then 视口底部不出现 `mobile-bottom-bar`；操作按钮保持在顶部 header 区域，行为与改动前一致

## 4. 待确认清单

[SUGGEST: 问题 2（底部操作栏）核实后确认为"修复 `EntryDetailMobileBar.vue` 现有组件的定位机制"，而非新建组件。理由：代码库中 `EntryDetailMobileBar.vue` 已完整实现底部操作栏（含 file-tree/toc/source-toggle/wrap/copy/overflow 全部按钮），仅缺 `position: fixed` + safe-area 处理，用 `min-height:100vh` 的 flex 布局兜底导致移动浏览器地址栏收起/展开时出现"有时可见有时不可见"。已有 `OverflowMenuSheet.vue` 的 `position: fixed; bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0px)` 作为项目内既有模式可参考（`follows_existing_pattern` 候选）。不涉及破坏性变更（不删除现有功能，只改定位方式），不涉及业务方向判断，若用户无异议按此方向推进。]

[NO_NEED_CONFIRM]（除上述 [SUGGEST] 项外，无其他遗留的方向性待确认事项；[SUGGEST] 不阻塞推进）

## 5. 裁剪说明

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
跳过风险: 无阶段跳过。理由——三处改动跨多个公共组件（EntryDetailHeader.vue/EntryDetailContent.vue/EntryDetailMobileBar.vue/useResponsiveLayout.ts/MarkdownViewer.vue）且涉及 DESIGN.md 决策变更（L219 baseline change）与浏览器兼容性已知坑点（100vh/safe-area），medium risk 下 P2/P3/P6/P7/P8 均不具备裁剪条件，P1 analyst 判断全阶段保留，与 P0-brief 裁剪倾向一致
follows_existing_pattern: [frontend-v3/src/components/OverflowMenuSheet.vue]
```

## 6. 范围声明

```yaml
domains: [frontend]
packages: [frontend-v3]
```

涉及文件（供 P2/P7 交叉核对）：
- `frontend-v3/src/components/EntryDetailHeader.vue`（meta-tags-bar 结构与 CSS）
- `frontend-v3/src/composables/useResponsiveLayout.ts`（setupScrollHide 逻辑，可能需要移除/改造）
- `frontend-v3/src/components/EntryDetailContent.vue`（content-area padding，滚动容器）
- `frontend-v3/src/components/EntryDetailMobileBar.vue`（底部操作栏定位机制）
- `frontend-v3/src/views/EntryDetailView.vue`（组件编排、zen-mode 隐藏规则）
- `frontend-v3/src/components/MarkdownViewer.vue`（markdown-body 间距）
- `frontend-v3/src/stores/entryDetail.ts`（`canWrap` 计算逻辑 L18-24，BDD-6/BDD-7 场景区分依据；本次修订核实来源，非本次改动目标文件）
- `DESIGN.md`（L219 scroll-hide 规则替换、L263 底部栏声明与实现对齐、L268-275 滚动架构约束保留确认、markdown-body 移动端间距新规则补充）

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收三处改动均为视觉/交互行为（滚动跳变消除、底部栏固定可见性、边距缩减量化），纯代码审查无法判定，需要截图/DOM measurement 验证
    available:
      - "vision-analyst（agate 内置执行角色，首选）"
      - "playwright-cdp skill（已注入，可配合截图验证）"
      - "vision-engine skill（图像分析，可补充）"
    status: available

  - need: mobile-viewport-emulation
    why: BDD-1~12 均需要移动端 viewport（≤640px）与桌面 viewport（>640px）对比验证；BDD-5 需要模拟浏览器地址栏展开/收起对应的两种可视高度做静态对比；BDD-9 额外需要 375px 极小屏宽度做边界验证
    available:
      - "playwright-cdp skill（CDP device emulation 支持自定义 viewport 宽高，可用两组固定高度代理地址栏展开/收起两种状态做静态验证，不要求复现真实地址栏收起/展开的动画过程；375px 宽度同样可用固定 viewport 设置验证）"
    status: available

  - need: ios-real-device-keyboard-interaction
    why: 边界风险收口第 4 项（iOS 虚拟键盘弹出时 fixed 底部栏与 safe-area-inset/visualViewport 联动是否正常）需要真实 iOS 设备触发原生虚拟键盘弹出交互才能验证；该风险由本任务引入的 `position: fixed` 方案导致（见 [CORRECTION]），非无关风险，但 CDP mobile viewport emulation 不模拟真实虚拟键盘弹出对 visualViewport 的影响，无法在当前自动化环境中复现
    available:
      - "真机人工验证（人工使用真实 iOS 设备打开页面、触发虚拟键盘弹出，目测确认底部操作栏是否仍完整可见、是否与 safe-area 联动异常，作为已知限制的后续跟踪项，不阻塞本次自动化验收流程）"
    status: supplementable
```

说明：BDD-5 刻意设计为"两种固定可视高度下的静态验证"而非"复现真实浏览器地址栏收起/展开动画"，因为后者在当前 CDP 环境下不可复现（真实动画触发依赖原生浏览器 UI 行为）。这一范围收窄已通过 BDD 本身的 Given 子句体现，不构成能力缺口（不标记 GAP）。iOS 虚拟键盘交互同理受限于 CDP 环境，但因存在真机人工验证这一已知补充路径，标记为 `supplementable` 而非 `GAP`，不阻塞流程推进。
