# P1 Progress Log — T090

- [read] analyst.md, P1-dispatch-context-analyst.md, P0-brief.md 完成初读
- [read] DESIGN.md L100-300: 确认 L219 scroll-hide meta bar 规则、L263 "primary actions → fixed bottom bar on mobile"（当前未实现）、L268-275 Scroll Architecture（.content-area 唯一滚动容器，viewer 不得声明 overflow-y:auto/height:100%，HtmlViewer/ImageViewer 例外）、L113 通用 padding 32px desktop/16px mobile（非 markdown 专属）
- [read] useResponsiveLayout.ts: setupScrollHide 绑定 container(=.content-area) scroll 事件，纯 JS 逻辑更新 metaTagsHidden ref（无 max-height 逻辑本身，max-height 折叠在 CSS 层，见 EntryDetailHeader.vue）。isMobile 阈值 <=640px 与 DESIGN.md 断点一致
- [CRITICAL FINDING] P0-brief.md 关于底部操作栏的论断有误："代码库里没有找到真正意义上的移动端固定底部操作栏组件"不准确。存在 frontend-v3/src/components/EntryDetailMobileBar.vue，class="mobile-bottom-bar"，v-if="isMobile"，包含 file-tree/toc/source-toggle/wrap/copy/OverflowMenu(sheet variant) 全部操作按钮。EntryDetailView.vue 渲染顺序：Header → Banners → Content → EntryDetailMobileBar → Dialogs（同级，非嵌套在 .content-area 内）
- [关键] .mobile-bottom-bar CSS（EntryDetailMobileBar.vue L81-88）无 position 属性（非 fixed/sticky），仅 display:flex + border-top，依赖外层 flex 布局定位在视口底部，而非 CSS position 固定。需要继续核实 .entry-detail 和 .content-area 的高度/overflow 策略以确认这是否是"看起来固定实际是 flex 布局尾部元素"的机制，及为何用户体验为"有时显示有时不显示"
- [关键结构确认] .entry-detail (EntryDetailView.vue L250) = flex column, min-height:100vh。.detail-content (EntryDetailContent.vue L220) = flex:1, overflow:hidden；.content-area = flex:1, overflow-y:auto（唯一滚动容器，符合 DESIGN.md L270）。EntryDetailMobileBar 渲染在 .content-area 之后、作为 .entry-detail 的同级 flex 子项（非嵌套在 content-area 内），自然处于视口底部——但定位机制是"flex 布局排最后 + min-height:100vh"，不是 CSS position:fixed。
- [根因判断] "有时显示有时不显示"很可能是经典移动端 100vh 问题：min-height:100vh 在移动浏览器地址栏收起/展开时计算基准不稳定（不同浏览器 100vh 取值可能是最大/最小可视高度），导致 flex 排列在最后的 mobile-bottom-bar 有时被推出可视区域外（需要额外滚动才能看到），有时可见。这与 P0-brief 假设的"组件不存在需要新建"不同——组件已存在，问题是定位机制不稳（缺 position:fixed + safe-area 处理）。此发现将改写 P1 对问题2的 BDD 范围判断，倾向为"修复现有组件定位机制"而非"新建组件"
- [读取完成] OverflowMenuSheet.vue L130-144 确认 .bottom-sheet { position:fixed; bottom:0; padding-bottom: env(safe-area-inset-bottom, 0px); } 既有 safe-area 先例，可作为 follows_existing_pattern
- [读取完成] MarkdownViewer.vue L125-136 + variables.css 确认间距数值：markdown-body 桌面 padding=var(--space-5)=24px；移动端(@media max-width:640px) margin=var(--space-4)=16px + padding=var(--space-4)=16px；加上 EntryDetailContent.vue content-area 移动端 padding=var(--space-2)=8px（左右），三层合计约 40px，与 P0-brief 描述一致
- [写作中] 开始撰写 P1-requirements.md，10 条 BDD，problem2 定为 [SUGGEST]（非阻塞，因发现 EntryDetailMobileBar.vue 已存在，问题是定位机制非组件缺失）
- [完成] P1-requirements.md 写入完成，自检通过：10 条 BDD (BDD-1~BDD-10)，Header 齐全，[BASELINE_CHANGE] 已标注在隐含需求识别章节前的问题1描述中并在需求复述提及 DESIGN.md L219；已改为在正文明确标注，见下条修正
- [修正] 补充显式 [BASELINE_CHANGE: ...] 括号格式标注（此前遗漏），已写入并区分 L219(baseline change) vs L263(实现追平文档非变更)
- [完成] 最终自检：10 条 BDD, Header 齐全, [BASELINE_CHANGE] 已标注, [SUGGEST]+[NO_NEED_CONFIRM] 已标注, domains/packages/risk_level/phases/capability_requirements 齐全

---
# requirements-review 评审记录 (agent=requirements-review)

- [read] 读取角色定义 requirements-review.md、dispatch-context、P1-requirements.md、P0-brief.md、DESIGN.md(L100-280)、EntryDetailMobileBar.vue 全文
- [验证 CORRECTION] 逐行核实 EntryDetailMobileBar.vue L81-88 `.mobile-bottom-bar` CSS：确认无 position 属性（仅 display:flex/align-items/gap/padding/background/border-top），[CORRECTION] 关于"组件已存在但缺 position:fixed"的说法完全站得住。交叉核实 EntryDetailView.vue L250 `.entry-detail{display:flex;flex-direction:column;min-height:100vh}` 及渲染顺序（Header→Banners→Content→EntryDetailMobileBar→Dialogs），证实"伪固定"机制判断正确
- [验证 DESIGN.md 引用] grep 确认 L219(Scroll-Hide Meta Bar 规则)、L263(fixed bottom bar on mobile)、L270-271(sole scroll container 约束) 行号与 P1-requirements 引用完全一致，无引用失真
- [验证数值链路] 逐层核对 EntryDetailContent.vue L221-222、MarkdownViewer.vue L125-136、variables.css：确认移动端 8+16+16=40px 三层叠加基线准确。但发现桌面端 markdown-body 有 `max-width:900px; margin:0 auto`（auto margin 随视口宽度变化，非固定值），BDD-9 用固定 token 值(--space-5=24px)做"不低于"判断（而非 BDD-7 式总和测量）是合理的方法论差异（因为桌面 auto-margin 不可做总和固定值比较），非方法论缺陷；但 BDD-9 Then 子句同时写"与改动前一致"又写"不低于24px基线"——两种判定标准不等价（一个要求相等，一个只要求下限），构成表述内部歧义，判定含糊
- [验证 BDD-6 wrap 覆盖] 追踪 canWrap 计算逻辑（entryDetail.ts L18-23）：`language==='markdown'` 时 canWrap=false。BDD-6 Given 明确是"多文件 markdown entry"，意味着该场景下 wrap 按钮根本不会渲染（v-if="canWrap"）。而 section 2 兼容维度明确列出 wrap 是必须保持不变的按钮之一。核查全部 10 条 BDD，无一条能真正触达 wrap 按钮的点击验证——这是一个具体、可复现的覆盖缺口
- [验证 BDD-2 跨 viewer 覆盖理由] 检索 P1-requirements 全文及 BDD-2 前后文，未找到"其余 viewer(Table/Tree/Image/HTML) 共用同一 header/meta-tags-bar，无需逐个验证"这类范围收窄的显式声明句子（该理由存在于 P0-brief 但未被复述进 P1-requirements 的 BDD 附近论证）
- [验证边界维度下游处理] section 2 边界行列出 4 项（≤375px 可读性/空 tags 占位/横屏跨 640px 阈值/iOS 键盘 safe-area），逐一检查 BDD-1~10 和 capability_requirements：均未被任何 BDD 覆盖，capability_requirements 也未对这些具体边界项做 available/supplementable/GAP 声明——识别了但未落地验证点或范围收窄说明
- [判断 BDD-7 px 数值] 核对 P0-brief 用户原话"缩减到 1/4 甚至更小，你看看怎么合适"——是委托设计判断的表述，非精确数值指令。BDD-7 在 P1 阶段把"你看看怎么合适"直接锁定为硬性 ≤10px 且未声明"相对缩减≥75%"与"绝对≤10px"何者为准，存在权威性歧义与过早锁定设计参数的风险
- [结论] 综合判定 status: needs-revision（核心结构可用，[CORRECTION]/[BASELINE_CHANGE]/裁剪判断均站得住，但 BDD-2/6/7/9 存在具体、可复现的缺口需 analyst 修订后再评审）

## P1 修订第 1 轮（analyst-retry1）2026-08-08

- 读取 dispatch-context-analyst-retry1.md 的 5 处修复目标，读取 P1-review.md 理解每处证据
- 核实 canWrap 逻辑：实际位于 `frontend-v3/src/stores/entryDetail.ts` L18-24（非 `useEntryDetailComputed.ts`，也非顶层 `entryDetail.ts`），逻辑为 `!activeFile || isBinary || language==='markdown' || language==='html'` 时 canWrap=false，其余为 true。确认 review 指出的"markdown entry 下 wrap 按钮不渲染"结论成立
- 同时核实 `EntryDetailMobileBar.vue` L10（toc 按钮需 `isMarkdown && tocHeadings.length>0`）与 L27（wrap 按钮需 `canWrap`）互斥——markdown 场景无法同时验证 toc 与 wrap，故采用"拆分为两条独立 BDD"方案（dispatch 选项②），而非改 Given 语言类型（选项①会丢失 toc 覆盖）
- Header 已加 `revised: 2026-08-08` + 修订摘要段落
- BDD-2 已插入范围收窄声明段落
- BDD-6 拆分：BDD-6（markdown entry，file-tree/toc/source-toggle/copy/overflow）+ 新增 BDD-7（非 markdown/html entry，wrap 按钮）
- 原 BDD-7（margin ≤10px）顺延为 BDD-8，数值表述降级为相对基线缩减比例，10px 降级为参考值
- 新增 BDD-9：极小屏（375px）markdown 边距缩减后无溢出/无截断，对应边界风险①
- 原 BDD-8/9/10 顺延为 BDD-10/11/12；BDD-11（原 BDD-9）消除歧义，改为"padding token 与改动前完全相等"单一判定
- section 2 边界风险 4 项收口：①→BDD-9；②③④→显式声明本次范围内不新增验证 + 理由
- section 6 文件清单补充 `stores/entryDetail.ts`（canWrap 逻辑核实来源）
- 自检发现并修复一处 bug：插入「边界风险收口」小节时误将其嵌入 section 2 markdown 表格中间（在"边界"行与"兼容"行之间），破坏表格语法；已修正为放在表格结束（兼容行）之后
- 最终自检：BDD-1~12 编号连续无跳号；BDD-1/3/4/5、[CORRECTION]、[BASELINE_CHANGE]、裁剪说明、domains/packages 原样保留（未改动）

## P1 复核第 2 轮（requirements-review-retry1）2026-08-09

- 读取 dispatch-context-requirements-review-retry1.md 的逐项复核清单（5 处缺口 + 额外核对项），读取上轮 P1-review.md 理解原始证据
- 逐条实测核实：
  1. BDD-2 范围收窄声明——已核实新增引用块（L74），理由已从 P0-brief 复述进正文，缺口闭合
  2. BDD-6/BDD-7 拆分——重新读取 `entryDetail.ts` L18-24（`canWrap` 逻辑）+ `EntryDetailMobileBar.vue` L10/L27（toc/wrap 按钮 v-if 条件），确认 BDD-6(markdown,不含wrap)/BDD-7(非markdown/html代码文件,专测wrap) 的 Given 与实际渲染条件完全吻合，均为真实可达场景，缺口闭合
  3. BDD-8 数值降级——发现新问题：原文示例"如 11px、12px 即视为通过"与文中给出的"≥75%缩减"公式（基线约40px）矛盾，按公式计算 11px/12px 实际只有 72.5%/70% 缩减，不满足 ≥75%，示例与公式自相矛盾，判定不可靠——**未完全成立**
  4. BDD-11 消歧——已核实"相等"单一判定标准替代"一致/不低于"并存表述，缺口闭合
  5. 4 项边界风险收口——极小屏(BDD-9)/空tags/横屏阈值 3 项理由站得住；iOS虚拟键盘safe-area 1 项理由与本文档自身 [CORRECTION] 段落描述的技术方案（引入 position:fixed）矛盾，判定为敷衍带过、不站得住——**未完全成立**
- 额外核对：grep 全文 BDD-N 引用，确认编号 1-12 连续不跳号、无残留旧编号交叉引用；比对上轮 review 引用原文，确认 BDD-1/3/4/5/10/12（10/12 为原 BDD-8/10 顺延，内容未改）、[CORRECTION]、[BASELINE_CHANGE]、裁剪说明、domains/packages 均原样保留未被破坏
- 覆写 P1-review.md：status: needs-revision（trace_id 保持不变，新增 revised: 2026-08-09），5 处缺口中 3 处修复成立+2处仍需第3轮定向修补（BDD-8数值示例矛盾、边界风险第4项理由不成立），均给出具体可执行的修复方向
- 注：本轮为第 2 次评审，若第 3 轮修订仍不过将触发 PAUSED（P1 retry MAX=3），已在返回结论中明确提示

## P1 修订第 2 轮（analyst-retry2）2026-08-09

- 读取 dispatch-context-analyst-retry2.md 的 2 处修复目标 + 给出的方向选项，读取 P1-review.md 第 2 轮复核理解具体矛盾证据
- 用 bash 实算验证 BDD-8 矛盾：base=40px，≥75%缩减对应 ≤10px；11px 实际缩减 72.5%，12px 实际缩减 70%，均不满足 ≥75%，确认 review 指出的矛盾成立
- 修复点 1（BDD-8）：采用方向 A（推荐）——删除"如 11px、12px 即视为通过"具体示例数值，仅保留"相对基线缩减 ≥75%（约 10px 或更小）"比例公式本身，不再举可能站不住的具体数字。section 1"缩减到当前的 1/4 甚至更小"表述与 1/4=75% 缩减本就一致，无需改动
- 修复点 2（边界风险第4项 iOS safe-area）：采用方向 A（推荐）——改口承认该风险确由本任务 `position: fixed` 方案引入（与 [CORRECTION] 一致），理由从"无耦合"改为"环境能力限制无法真实复现 iOS 原生虚拟键盘交互"，新增 capability_requirements 条目 `need: ios-real-device-keyboard-interaction`，status: supplementable（真机人工验证为已知补充路径，不阻塞流程、不触发 CAPABILITY_GAP）
- 覆写 P1-requirements.md（同路径），header revised 更新为 2026-08-09，文件开头修订摘要追加第 2 轮说明段落
- 自检：BDD-1~7/9~12 及 section 1/[CORRECTION]/[BASELINE_CHANGE]/裁剪说明/domains/packages 均未改动，逐行比对原文一致；仅 BDD-8 一句 Then 子句 + 边界风险收口第4项段落 + capability_requirements 新增一条被修改

## P1 复核第 3 轮（requirements-review-retry2，最终轮）2026-08-09

- 读取 dispatch-context-requirements-review-retry2.md（本轮为 P1 retry 上限内最后一轮，MAX=3），读取角色定义、P0-brief.md、上轮 P1-review.md 理解 2 处缺口的具体证据
- 读取本轮 P1-requirements.md 全文，重点核对 BDD-8（L109-112）与边界风险收口第4项（L43）+ capability_requirements 新增条目（L186-190）
- 缺口1（BDD-8）核实：grep 全文确认"11px""12px"字样已删除，仅保留"约10px或更小"，与"≥75%缩减"公式精确等价（40×25%=10），三处（section1目标/BDD-8公式/BDD-8示例）自洽无矛盾，判定已解决
- 缺口2（iOS safe-area）核实：逐句核对边界风险收口第4项文本，确认已改口承认风险确由 position:fixed 方案引入（不再称"无耦合"），不新增自动化验证的真实原因明确归因于 CDP/Playwright 环境无法复现 iOS 原生键盘交互，capability_requirements 新增 `ios-real-device-keyboard-interaction` 条目（status: supplementable，有真机人工验证作为替代路径，理由站得住），判定已解决
- 覆写 P1-review.md：status: approved，按角色要求（approved 判定需完整锚点覆盖）补齐全部 BDD-1~12 逐条编号引用 + 数据/前端/多端/边界/兼容五维度覆盖标注，另附隐含需求覆盖、裁剪评审、P1纯净性核对
- 自检：BDD编号1-12连续无跳号（grep核实）；缺口1/2均有具体文本引用+数值验算支撑；未对本轮范围外内容（BDD-1/3/4/5/10/12、BDD-6/7互斥场景、BDD-11消歧等前两轮已确认项）提出新质疑，仅在"未改动部分确认"段落简要确认
- 结论：批准进入 P2 设计阶段
