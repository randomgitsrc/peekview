---
phase: P2
task_id: T090-mobile-detail-ux-polish
type: design
parent: P1-requirements.md
trace_id: T090-P2-20260809
status: draft
created: 2026-08-09
agent: architect
---

# P2-design — T090 移动端详情页 UX 打磨

## 0. 声明字段

```yaml
candidate_count: 6   # 三个问题点各 2 个候选，正文逐一列出
packages: [frontend-v3]
domains: [frontend]
ui_affected: true
gate_commands:
  P3: "make test-frontend"
  P5: "make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/t090-mobile-detail-ux-polish.spec.ts make debug-test"
  project_module: "src/"
env_constraints:
  debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）。本任务纯前端 CSS/组件改动，P3/P4 阶段可用 Playwright CDP（:18800）对静态构建产物做行为验证，不强制启动 debug backend；P5/P6 的 E2E gate 走 make debug-test（Playwright 自带浏览器，非 CDP），需要 debug backend"
  isolation_check: "make debug-verify-isolation（若生产 :8080 在线）；否则 sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 手动验证。本任务不改后端/数据库，isolation check 非核心风险点，仅按标准流程保留"
files_to_read:
  - path: frontend-v3/src/composables/useResponsiveLayout.ts
    why: 删除 setupScrollHide/metaTagsHidden；保留 isMobile/isDesktop/handleResize
  - path: frontend-v3/src/components/EntryDetailHeader.vue:71-84,109-134,144-146,192-194
    why: 删除 mobile meta-tags-bar 模板块 + 对应 CSS + metaTagsHidden prop
  - path: frontend-v3/src/components/EntryDetailContent.vue:1-61,127-157,219-222
    why: 新增 EntryMetaTagsBar 挂载点（main 内第一个子节点）+ isMobile inject + relativeTime prop + content-area 底部 padding 改造
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue:1-2,80-88
    why: position:fixed 改造 + z-index + safe-area padding + data-testid
  - path: frontend-v3/src/views/EntryDetailView.vue:5-32,79-98,119-156,201-222,249-256
    why: 移除 metaTagsHidden/setupScrollHide 引用；EntryDetailContent 新增 relative-time prop 传递；.entry-detail 保持 min-height:100vh 不变（已验证不需要改）
  - path: frontend-v3/src/components/MarkdownViewer.vue:124-136
    why: mobile 断点 margin/padding 归零，改为 0
  - path: frontend-v3/src/components/OverflowMenuSheet.vue:130-144
    why: follows_existing_pattern 参照——position:fixed+env(safe-area-inset-bottom)已验证可用写法
  - path: frontend-v3/src/styles/variables.css:1-11
    why: 新增 --mobile-bar-height token（bottom bar 高度，供 content-area padding-bottom 计算复用同一数值）
  - path: frontend-v3/src/composables/entryDetailKeys.ts
    why: 复用既有 IsMobileKey/ZenModeKey provide/inject 常量（新组件 EntryMetaTagsBar.vue 需要 inject ZenModeKey 吗？不需要——meta bar 已挂载在 content-area 内部，zen-mode 隐藏 content 区整体不隐藏 content-area 本身，仅 header/bottom-bar 隐藏；需确认 zen-mode 是否要求 meta bar 也隐藏，见正文 [DESIGN_GAP 提示]）
  - path: frontend-v3/src/components/BaseTag.vue
    why: 新组件 EntryMetaTagsBar.vue 渲染 tags 列表需要复用此组件（与原 mobile meta-tags-bar 一致）
  - path: frontend-v3/e2e/t084-scroll-architecture.spec.ts
    why: 同类历史任务（T084）的 E2E 测试写法参照，viewport 断点/滚动断言模式可复用
minimal_validation:
  assumption_1: "position:fixed;bottom:0 元素 + env(safe-area-inset-bottom) 在移动 viewport 下能稳定贴合视口底部，不受滚动位置、也不受可视高度变化（模拟地址栏收起/展开）影响"
  assumption_2: "100dvh 相比 100vh 在当前可用验证环境下能提供可验证的额外收益"
  method: "Playwright CDP（Chrome 151.0.7922.76，:18800）+ Emulation.setDeviceMetricsOverride 模拟 iPhone 尺寸 390 宽、高度依次 844→800→700（代理地址栏收起/展开导致的可视高度变化）。测试页 /tmp/.../scratchpad/t090-viewport-test.html：.bar{position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,20px)} + .vh-box{height:100vh} + .dvh-box{height:100dvh} + 3000px 可滚动内容。脚本 t090-validate.ts 依次测量 scrollY=0/1000(中)/3852(底) 三个滚动位置下 bar 的 getBoundingClientRect，以及三次 viewport 高度变化（844/800/700）下 bar 位置与 vh/dvh 盒子高度"
  result: "confirmed (assumption_1) | inconclusive (assumption_2)"
  note: |
    assumption_1 confirmed：三次不同 scrollY 下 bar.bottom 恒等于 window.innerHeight（844），bar 位置完全不受滚动影响；
    三次 viewport 高度变化（844→800→700）下 bar.bottom 立即等于新的 innerHeight，无需任何 JS 干预即自动贴合当前可视区域底部。
    结论：仅靠 position:fixed 本身即可解决 P1-[CORRECTION] 定位的根因（min-height:100vh 导致的伪固定底部栏被顶出视口），不依赖 viewport 单位选择。

    assumption_2 inconclusive：CSS.supports('height','100dvh') === true（Chrome 151 语法受支持），但 CDP 的
    Emulation.setDeviceMetricsOverride 是整体重写 viewport 尺寸（非模拟真实地址栏收起/展开动画下"最大视口不变、可视视口收缩"的差异化行为），
    本次验证中 100vh 与 100dvh 测得高度在三次变化中始终相等，无法在当前自动化环境下复现两者的真实差异。
    结论：不能证明 100dvh 相比 100vh 有可验证的增量收益，且 assumption_1 已证明该增量对 BDD-4/5 并非必需 → 按 YAGNI 不采用（详见候选方案 2-A vs 2-B 权衡）。
    此为已知限制，与 P1 [ios-real-device-keyboard-interaction] 同类——真实移动地址栏行为差异需要真机验证，已知限制不阻断本任务推进。

## 1. 影响域分析

### 改什么
- `frontend-v3/src/composables/useResponsiveLayout.ts`：删除 `setupScrollHide`、`metaTagsHidden`（整个滚动方向触发的显示/隐藏机制废弃）
- `frontend-v3/src/components/EntryDetailHeader.vue`：删除 mobile `.meta-tags-bar` 模板块（原 L71-84）+ 对应 CSS（原 L192-194）+ `metaTagsHidden` prop
- **新增** `frontend-v3/src/components/EntryMetaTagsBar.vue`：从 Header 中抽出的 mobile meta 信息条，改为随内容流渲染的普通组件
- `frontend-v3/src/components/EntryDetailContent.vue`：`.content-area` 内新增 `EntryMetaTagsBar` 挂载点（`main` 的第一个子节点）；新增 `relativeTime` prop；`inject(IsMobileKey)`；mobile 断点 `padding-bottom` 改为兼容底部栏净空的计算值
- `frontend-v3/src/components/EntryDetailMobileBar.vue`：`.mobile-bottom-bar` 改为 `position: fixed; bottom:0; left:0; right:0`，加 `padding-bottom: env(safe-area-inset-bottom, 0px)`、`z-index`、`min-height: var(--mobile-bar-height)`、`data-testid`
- `frontend-v3/src/views/EntryDetailView.vue`：移除 `metaTagsHidden`/`setupScrollHide` 相关引用（onMounted 里的 querySelector('.content-area') + setupScrollHide 调用、destructure、传给 Header 的 prop）；`EntryDetailContent` 新增 `:relative-time="relativeTime"` 传参
- `frontend-v3/src/components/MarkdownViewer.vue`：mobile 断点 `.markdown-body` 的 `margin`/`padding` 归零
- `frontend-v3/src/styles/variables.css`：新增 `--mobile-bar-height` token
- `DESIGN.md`：L218-219、L263、L268-275、新增 markdown mobile 间距条目（见第 3 节）

### 不改什么
- `.content-area` 作为唯一滚动容器的架构（DESIGN.md L270-275）——不引入第二个滚动容器，不改变任何 viewer 的 `overflow-y`/`height:100%`
- `.content-area` 桌面端 padding、mobile 端水平 padding 的数值（`var(--space-3) var(--space-2)`）——非 markdown 专属改动，保持给所有 viewer 共用的基线不变
- `EntryDetailMobileBar.vue` 内已有按钮集合与功能逻辑（file-tree/toc/source-toggle/wrap/copy/overflow）——只改定位机制，不改交互
- `entryDetail.ts` 的 `canWrap`/`isMultiFile` 等计算逻辑——不修改，仅作为 BDD-6/7 场景区分依据读取
- 桌面端 `.detail-header`/`.meta-row`（desktop header 内的 meta 信息展示）——桌面端滚动隐藏机制本就不生效，不涉及本次改动
- `.entry-detail { min-height: 100vh }`——minimal_validation 已证明 fixed 定位不依赖此值，故不改动（YAGNI，见候选方案 2-A vs 2-B）
- 640px 断点判定逻辑（`isMobile`/`isDesktop` computed）——P1 边界风险收口已声明不在本次改动范围
- OverflowMenu.vue 本身（含其内部 `data-testid="overflow-menu-trigger"`）——只是作为参照模式，不修改该组件

### 风险在哪
- **组件拆分引入的数据传递链变长**：`EntryMetaTagsBar` 需要 `currentEntry`（已在 Content 的 props 里）+ `relativeTime`（需要新增一条传参链路：`EntryDetailView.vue` → `EntryDetailContent.vue` → `EntryMetaTagsBar.vue`）。传递链变长本身不是复杂逻辑，但如果 P4 遗漏某一环会导致 mobile 相对时间显示为空——需要 P6 verification 逐一验证
- **zen-mode 选择器耦合**：`EntryDetailView.vue` 的 `.zen-mode :deep(.meta-tags-bar)` 选择器依赖 class 名 `meta-tags-bar` 在新组件根节点上保留，若 P4 实现时改了 class 名会导致 zen-mode 下 meta bar 未被隐藏（回归）
- **content-area 底部 padding 与 bottom bar 高度失配**：若 `--mobile-bar-height` token 值与 bar 实际渲染高度不一致（如未来按钮换行/字体缩放导致 bar 变高），会出现内容被遮挡或多余空白——已通过在 `.mobile-bottom-bar` 显式声明 `min-height: var(--mobile-bar-height)` 做单一数据源约束来源缓解，但不是强绑定（bar 若因内容溢出撑高仍可能超出 min-height）
- **zen-mode 下 content-area 底部多余留白**：bottom bar 隐藏后（zen-mode），如果 content-area 的底部 padding-bottom 补偿值不联动清零，会在 zen 模式下留下不必要的空白——需要显式的 zen-mode CSS override（见第 2 节问题 2 设计细节）
- **loading/error/empty 状态下 content-area 底部同样存在多余留白，但接受为已知限制，不做联动清零**：`.content-area` 新增的 `padding-bottom` 是纯 CSS 媒体查询规则，不依赖 JS 状态；而 `EntryDetailMobileBar.vue` 的渲染条件是 `v-if="isMobile && currentEntry"`（`currentEntry` 为 null 时，即 loading/error/empty 三种状态下，bar 不渲染）。这意味着这三种状态下 content-area 仍预留了 bar 的底部净空，产生一段不必要的空白——旧的 flex 布局下无此问题（bar 不渲染时 flex 也不占位）。取舍结论：**接受**这个次要留白，不引入 `v-if` 联动清除 padding 的方案。理由：(1) loading/error/empty 是短暂或低频状态，视觉上多几十像素的底部空白不影响可用性，不产生遮挡等阻断性问题；(2) 若要联动清除，需要把 `currentEntry` 是否存在这一状态从 `EntryDetailMobileBar.vue` 传导到 `EntryDetailContent.vue` 的 CSS 层（新增 prop/computed class），引入的耦合复杂度与收益不成比例；(3) BDD 未要求这一点。与 zen-mode 场景的本质区别是：zen-mode 是用户主动触发的高频、持续状态，视觉洁净度要求更高，值得为其写显式 override；loading/error/empty 是过渡态，不值得同等投入
- **底部栏按钮组合宽度：正常场景不会触发换行，已量化验证**：`min-height: var(--mobile-bar-height)` 只做单向高度约束，不能防止内容溢出撑高。用 `EntryDetailMobileBar.vue` 实际按钮集合估算最坏情形——如多文件 + markdown + source-toggle + copy + overflow 五个控件，或多文件 + 代码类 + wrap + copy + overflow：单个 icon 按钮 44px、文字按钮（Wrap/Copy）约 70-90px，5 个控件 + 4 个 `--space-2`(8px) 间隙 + 左右 `--space-3`(12px)×2 内边距，合计落在 300-340px 区间，小于 BDD-9 规定的最小验证宽度 375px（英文默认字号下），**正常场景不会触发换行**。真正会触发的场景（浏览器文字缩放/超大字体无障碍设置导致按钮文字换行）属于更极端的可访问性场景，BDD 未覆盖，`min-height` 单向约束确实无法防止这种情况下内容被压缩或高度溢出——接受为已知限制，不新增自动化验证，与本任务 P1 已登记的 iOS 虚拟键盘/真机地址栏行为差异属同类处理方式（显式承认风险来源 + 说明为何不新增验证）
- **markdown-body 归零后与 code/table/tree 等非 markdown viewer 的视觉差异感**：markdown 现在只剩 content-area 的 8px 水平内边距，比其他 viewer（同样只有 8px，无额外层）视觉上更一致了（反而消除了原本 markdown 比其他 viewer 边距更大的不一致），预期是正向影响，非风险，但需 P6 视觉截图确认没有意外的"过窄"观感（BDD-9 已覆盖极小屏溢出/截断检查）

### 可访问性影响

本次改动的本质是 CSS 定位方式变化（滚动隐藏 → 常规文档流；伪固定 → 真 `position: fixed`），不涉及新增/删除可交互元素、不改变元素的 `tabindex`/`role`/`aria-*` 属性。逐一核实评审指出的两点：

**1. meta-tags-bar 从 header 移入 content-area 后的 DOM 顺序/Tab 顺序变化**

已读 `EntryDetailView.vue:5-83` 模板确认改动前后的模板层级顺序：`EntryDetailHeader`（含 `.mobile-sticky-header`）→ `EntryDetailBanners` → `EntryDetailContent`（`<main class="content-area">`）→ `EntryDetailMobileBar` → `EntryDetailDialogs`，这一顶层顺序本身不变。变化的只是 `.meta-tags-bar` 这一小节内部的挂载点：改动前，它是 `EntryDetailHeader.vue` 内部最后一个子节点（`.mobile-sticky-header` 之后，紧邻 `EntryDetailContent` 之前）；改动后，它是 `EntryDetailContent.vue` 的 `<main>` 内部第一个子节点（同样紧邻 `.mobile-sticky-header` 之后，位于其余正文内容之前）。

**判断：Tab 顺序/朗读顺序在改动前后处于同一相对位置（header 控件之后、正文内容之前），无实质变化。** 理由：Tab 顺序由文档线性顺序决定，"作为 header 的最后一个兄弟节点"与"作为 main 的第一个子节点"在改动前后都恰好落在"header 结束、正文开始"这同一个衔接点上，AT 用户遍历到 meta-tags-bar 的时机不变。唯一的语义层面变化是：meta-tags-bar 从 `banner`（header）landmark 移入 `main` landmark——这实际上是**更准确**的语义归属（标签/所有者/时间是内容的元数据，本就该归属 main 而非页面级 chrome），对屏幕阅读器按 landmark 导航的用户是中性偏正向的调整，不构成负面影响。

**2. `.mobile-bottom-bar` 改为 `position: fixed` 后视觉位置与 DOM 位置不一致导致的 Tab 焦点跳转体验**

已读 `EntryDetailMobileBar.vue:81-87` 确认改动前 `.mobile-bottom-bar` 无 `position` 声明（普通文档流块级元素，随 `.entry-detail` 的 `min-height: 100vh` 撑高被动"伪固定"在可视区域附近，这正是 P0-brief 报告的 bug 根因）；改动后加 `position: fixed; bottom: 0`。**`position` 属性只改变元素的视觉渲染位置，不改变其在 DOM 树/可访问性树中的顺序**——`.mobile-bottom-bar` 在模板中仍是 `EntryDetailContent` 之后、`EntryDetailDialogs` 之前的同一个兄弟节点，Tab 顺序不受 `position: fixed` 影响，改动前后完全一致。

**判断：无负面影响，且有轻微正向改善。** 理由：改动前，`.mobile-bottom-bar` 虽然在正常布局下大致处于视口底部附近，但在内容超出视口高度需要滚动的长文档场景下，键盘用户需要先滚动查看才能确认 Tab 焦点落点的可视位置（不滚动到底部,聚焦到 bar 内按钮时焦点可能在视口外不可见）；改动后 `position: fixed` 保证该区域**始终**在视口内可见，键盘用户 Tab 到这些按钮时焦点框始终可见，不需要额外滚动定位——这是一个已被广泛采用的移动端固定工具栏无障碍模式（焦点可见性优先于严格的视觉顺序一致性），不引入新的可访问性问题。视觉位置（贴底）与 DOM 位置（紧随 content 之后、dialogs 之前）不一致本身并非可访问性反模式——只要 Tab 顺序符合逻辑阅读顺序（先看到/操作正文，再操作底部工具栏），视觉贴边只是一种"常驻可见"的呈现优化，不要求视觉顺序与 DOM 顺序像素级对齐。

**结论**：两处改动均**不引入可访问性回归**，`.meta-tags-bar` 迁移额外带来 landmark 归属更准确的轻微正向调整，`.mobile-bottom-bar` 固定化带来焦点始终可见的轻微正向调整。本任务不新增 `aria-*` 属性或额外的可访问性专项测试，现有 BDD（跨 viewer 回归、极小屏检查）已足以覆盖，不需要新增 accessibility 专项验收项。

## 2. 候选方案

### 问题点 1 — meta-tags-bar 嵌入内容流的位置

#### 候选 1-A：内联迁移到 EntryDetailContent.vue
把原 `.meta-tags-bar` 的模板 + CSS 整体剪切，直接粘贴进 `EntryDetailContent.vue` 的 `<main class="content-area entry-content">` 内部，作为 `v-if="isMobile && currentEntry"` 的第一个子节点。数据（owner/relativeTime/readStats/isPublic/tags）复用 `EntryDetailContent` 已有的 `currentEntry` prop（tags/isPublic/owner 都在 Entry 对象里），仅需新增 `relativeTime` 一个 prop。
- 优点：改动文件数最少（2 个：Content.vue 加、Header.vue 删），不引入新组件文件，diff 最直观
- 缺点：`EntryDetailContent.vue` 当前已是全项目最复杂的组件之一（240 行，橋接 8 种 viewer 类型的分支渲染），再塞入约 15 行 meta 展示模板 + 独立 CSS block，会让这个"内容路由"组件承担与其核心职责（按文件类型选择 viewer）无关的展示逻辑，违反单一职责，后续如果 meta 展示逻辑再变化（如需要加字段）会进一步膨胀这个已经很重的文件

#### 候选 1-B：抽取为独立组件 `EntryMetaTagsBar.vue`，挂载在 content-area 内（已选择）
新建 `frontend-v3/src/components/EntryMetaTagsBar.vue`，把原 mobile meta-tags-bar 的模板 + CSS 完整迁移进去（含自己的 `useRouter`/`navigateToTag`），对外暴露 `currentEntry`/`relativeTime` 两个 props。`EntryDetailContent.vue` 引入该组件，在 `<main>` 内部以 `v-if="isMobile && currentEntry"` 渲染（与既有 `EntryDetailMobileBar.vue` 的 `v-if="isMobile && currentEntry"` 条件保持一致的既有写法）。
- 优点：`EntryDetailContent.vue` 保持职责单一（只做 viewer 路由 + 文件抽屉），meta 展示逻辑被封装为一个可独立理解/测试的小组件，符合项目现有惯例（`BaseTag`/`ShareDialog`/`OverflowMenuSheet` 均是类似粒度的单一职责组件）；BDD-3"不做独立显示/隐藏切换"这一不变量可以在组件级别被直接验证（组件本身没有任何 hidden/toggle 逻辑，纯展示）
- 缺点：多一个文件、多一层 props 传递（`relativeTime` 需要 `EntryDetailView.vue → EntryDetailContent.vue → EntryMetaTagsBar.vue` 三层传递，原来只需 `EntryDetailView.vue → EntryDetailHeader.vue` 两层），改动面比候选 1-A 略大（3 个文件）

**选择理由**：`EntryDetailContent.vue` 已经是项目里复杂度最高的组件之一（承担 8 种 viewer 类型分支），候选 1-A 会进一步加重它的职责；候选 1-B 用一个小组件换取更清晰的边界，符合项目里已有的"小型单一职责展示组件"惯例（BaseTag/OverflowMenuSheet 等）。多一层 props 传递是可接受的代价（只有 1 个新增字段，不是复杂对象）。

**实现细节（P4 必读）**：
1. `EntryMetaTagsBar.vue` 根节点必须保留 `class="meta-tags-bar"`（`EntryDetailView.vue` 的 `.zen-mode :deep(.meta-tags-bar)` 选择器依赖这个 class 名隐藏 zen-mode 下的 meta 条，改名会导致 zen-mode 回归）
2. 不做"满宽出血"（negative margin 抵消 content-area padding）处理——`EntryMetaTagsBar` 保留自己原有的 `padding: var(--space-2) var(--space-3)`，叠加 content-area 的 8px，视觉上比原来略微多缩进一点，这是可接受的次要视觉变化（无 BDD 约束这一点），避免引入负 margin 技巧增加复杂度
3. `EntryMetaTagsBar` 不需要 `inject(ZenModeKey)` 自己隐藏——zen-mode 的隐藏统一由父级 `EntryDetailView.vue` 的 `:deep()` 选择器处理（与原 `.meta-tags-bar` 自身既有做法一致：`EntryDetailHeader.vue:72` 现状只有 `v-show="isMobile"`，没有内部 zenMode 判断，完全靠外部 `:deep()` 隐藏），不要在组件内部重复加 `v-show="!zenMode"` 判断（避免两套隐藏机制并存。注：`.mobile-sticky-header`/`.mobile-bottom-bar` 实际上都同时带有内部 `v-show="!zenMode"` 且叠加父级 `:deep()`，是另一处两套机制并存的既有写法，不是本条要参照的先例，这里明确以 `.meta-tags-bar` 自身的单一机制做法为准）

### 问题点 2 — 底部操作栏定位机制

#### 候选 2-A：仅 position:fixed（已选择）
`.mobile-bottom-bar` 改为 `position: fixed; bottom: 0; left: 0; right: 0; z-index: 50` +
`padding-bottom: env(safe-area-inset-bottom, 0px)` + `min-height: var(--mobile-bar-height)`（新 token，定义在 `variables.css`，值 `64px`，对应 44px 触控高度 + 上下 `var(--space-2)`×2=16px + 1px border-top，取整）。`.entry-detail` 的 `min-height: 100vh` **不变**。`.content-area` 在 mobile 断点新增 `padding-bottom: calc(var(--mobile-bar-height) + env(safe-area-inset-bottom, 0px))`，为 fixed 后脱离文档流的 bottom bar 让出净空，避免遮挡最后一段内容；zen-mode 下需要 override 回退为普通 `var(--space-3)`（因为 zen-mode 隐藏了 bottom bar，不再需要净空）。**落点与选择器（P4 必读，不需自行设计）**：`.content-area` 的 `padding-bottom` 定义在 `EntryDetailContent.vue` 的 scoped style 里，但 `zen-mode` class 挂在 `EntryDetailView.vue` 根节点 `.entry-detail` 上，两者跨组件——沿用该文件已有的 `:deep()` 模式，在 `EntryDetailView.vue:251-254` 现有 zen-mode 选择器块内**追加一条独立规则**（`padding-bottom` 与该块已有的 `display: none` 属性不同，不能合并进同一个逗号分隔选择器列表，需单独一条）：
```css
.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }
```
（该文件当前 L251-254 是 `.entry-detail.zen-mode :deep(.detail-header), .entry-detail.zen-mode :deep(.mobile-sticky-header), .entry-detail.zen-mode :deep(.mobile-bottom-bar), .entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }`——已核实为当前源码原文，新规则追加在这个块之后即可，不修改已有内容。）
- 优点：minimal_validation 已实测证明——bar 在滚动全过程 + 三种不同可视高度（844/800/700 模拟地址栏收起展开）下均正确贴合视口底部，不需要额外的 viewport 单位处理；改动面小（只改 bar 自身 CSS + content-area 一个 padding-bottom 属性）；直接复用 `OverflowMenuSheet.vue` 已验证过的 `position:fixed + env(safe-area-inset-bottom)` 模式（follows_existing_pattern）
- 缺点：`content-area` 的 padding-bottom 净空是一个硬编码常量（`--mobile-bar-height`），如果未来 bar 内容变化导致实际渲染高度超出这个 token 值（如按钮换行），会出现遮挡——用 `min-height` 声明尽量约束但不是强绑定

#### 候选 2-B：position:fixed + `.entry-detail` 改用 100dvh
在候选 2-A 基础上，额外把 `.entry-detail { min-height: 100vh }` 改为 `min-height: 100dvh`（并保留 `100vh` 作为不支持 dvh 浏览器的 fallback，CSS 级联顺序：先写 `min-height:100vh` 再写 `min-height:100dvh`，不支持的浏览器忽略后者）。
- 优点：`caniuse` 与本次验证均确认 `100dvh` 语法被现代浏览器广泛支持（`CSS.supports` 返回 true），对 `.entry-detail` 整体高度的动态视口跟踪更"面向未来"，可能在真实移动地址栏收起/展开的动画过程中（而非离散的高度跳变）让整体页面背景色/布局边界更平滑
- 缺点：minimal_validation 的 assumption_2 明确是 inconclusive——当前 CDP 环境无法证明这个改动对 BDD-4/BDD-5（bar 本身的可见性/不被遮挡）有任何增量收益，因为 assumption_1 已经证明 bar 的正确定位完全不依赖 `.entry-detail` 的 min-height 单位选择（fixed 元素直接锚定视口，不受父元素高度影响）；额外改动 `.entry-detail` 意味着多一处需要在真机上验证的未知行为面（`100dvh` 在真实 iOS Safari 地址栏收起/展开动画期间的边缘表现，本次验证环境无法复现，属于 P1 已登记的已知限制范畴）

**选择理由**：minimal_validation 已用实测数据证明"仅 position:fixed"足以解决 BDD-4/BDD-5 的核心问题（bar 自动贴合当前可视区域底部，不受滚动/可视高度变化影响）。候选 2-B 引入的 `100dvh` 改动没有可验证的增量收益，反而多引入一个无法在当前环境验证、真机行为存疑的改动面。按 YAGNI 原则选候选 2-A，不做未经验证收益支撑的改动。

### 问题点 3 — markdown 移动端边距缩减

#### 候选 3-A：`.markdown-body` mobile 断点 margin/padding 归零，完全依赖 content-area（已选择）
`MarkdownViewer.vue` 的 `@media (max-width: 640px) { .markdown-body { margin: 0; padding: 0; } }`（覆盖当前的 `margin: 0 var(--space-4); padding: var(--space-4)`）。移动端左右总留白完全由 `.content-area` 的 mobile padding（`var(--space-2)`=8px）单独决定，不再叠加。
- 优点：数学上唯一能在**不改动 `.content-area`**（P1 明确要求不能破坏其他 viewer 依赖的 content-area padding）的前提下满足 BDD-8"≥75%缩减"门槛的方案——当前基线每侧 40px（8+16+16），若保留 markdown-body 任何非零额外层（哪怕最小 token `--space-1`=4px），总量变为 12px，缩减比例仅 70%，达不到 75% 门槛；归零后总量 8px，缩减 80%，达标且有余量。改动范围仅限 `MarkdownViewer.vue` 一个文件的一条媒体查询规则，不涉及跨组件耦合
- 缺点：markdown 视图从此完全没有"专属"的移动端间距概念，如果未来某个 markdown 专属排版需求出现（如需要比其他 viewer 更宽或更窄的间距），需要重新引入一层——但这是 YAGNI 层面可接受的取舍，P1 没有此类需求

#### 候选 3-B：`.content-area` 按 viewer 类型条件应用更小的 mobile padding（仅 markdown 时生效）
`EntryDetailContent.vue` 根据 `isMarkdown && !sourceViewMode` 给 `<main>` 加一个条件 class（如 `content-area--dense`），该 class 在 mobile 断点下把水平 padding 从 `var(--space-2)`(8px) 降到 `var(--space-1)`(4px)，`MarkdownViewer.vue` 的 `.markdown-body` mobile 断点相应设为 `margin:0; padding: 0`（同候选 3-A 归零），两层叠加共 4px。
- 优点：理论上可以让 markdown 与其他 viewer 的移动端水平内边距独立可调（如果未来 code/table 需要保留 8px 而 markdown 想要更小的 4px），不需要再动 `.markdown-body`
- 缺点：需要往 `.content-area`（所有 viewer 共用的容器）里引入"按渲染的 viewer 类型切换 CSS"的条件耦合，这与 P1 范围收窄声明强调的"（滚动隐藏）逻辑与 viewer 类型无关"的设计取向相反方向——虽然这里讨论的是 padding 不是滚动逻辑，但同样是往一个公共容器组件里注入 viewer-type-aware 的分支，增加了 `EntryDetailContent.vue` 的条件复杂度，且当前没有任何 BDD 要求"markdown 和其他 viewer 的 mobile 水平边距必须不同"——候选 3-A 已经能达标，3-B 的额外灵活性是投机性的（YAGNI 违反）

**选择理由**：候选 3-A 用最小改动面（1 个文件、1 条媒体查询）达成 BDD-8 门槛，且不违反 P1 明确的"不破坏其他 viewer 依赖 content-area padding"约束。候选 3-B 提供的"viewer 类型独立可调"能力当前无 BDD 需求支撑，属于投机性设计，按 YAGNI 排除。

## 3. DESIGN.md 修订文字（[BASELINE_CHANGE] 落实）

### 3.1 L218-219 替换（Scroll-Hide Meta Bar → Meta Tags Bar 随内容流嵌入）

现有文字：
```
### Scroll-Hide Meta Bar
- On mobile detail page, metadata/tags bar hides on scroll-down, reappears on scroll-up.
```

替换为：
```
### Meta Tags Bar (Mobile)
- On mobile detail page, the metadata/tags bar (`EntryMetaTagsBar`) is a normal in-flow element rendered as the first child of `.content-area`, scrolling together with the viewer content. Visibility is determined purely by scroll position in the document flow — no independent show/hide toggle bound to scroll direction.
```

### 3.2 L263 修订（fixed bottom bar 补充定位机制与 safe-area 说明）

现有文字：
```
- Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile.
```

替换为：
```
- Detail page: file tree → dropdown selector on mobile; TOC → right drawer on mobile; primary actions → fixed bottom bar on mobile (`position: fixed; bottom: 0`, `padding-bottom: env(safe-area-inset-bottom, 0px)` for safe-area compatibility; `.content-area` reserves matching bottom clearance via `--mobile-bar-height`).
```

### 3.3 L268-275（Scroll Architecture）删除失效的 scroll-hide 描述行

现有文字（L275）：
```
- Scroll-hide behavior (`useResponsiveLayout.setupScrollHide`) binds directly to `.content-area`'s scroll event — no child element traversal needed.
```

删除此行（`setupScrollHide` 已废弃）。其余 L270-274（`.content-area` 唯一滚动容器约束、viewer 不得声明 overflow-y/height:100%、CodeViewer 例外、HtmlViewer/ImageViewer 例外、`scroll-margin-top`）保持不变。

### 3.4 新增：markdown 移动端间距条目

在 `### Meta Tags Bar (Mobile)` 小节之后（即原 L219 之后）新增一个小节：
```
### Markdown Body Spacing (Mobile)
- Desktop: `.markdown-body` uses `padding: var(--space-5)` (24px), centered with `max-width: 900px`.
- Mobile (≤640px): `.markdown-body` has no additional margin/padding of its own — horizontal inset comes solely from `.content-area`'s mobile padding (`var(--space-2)`, 8px), avoiding the triple-layer stacking (content-area + margin + padding) that previously produced ~40px of total inset per side.
```

## 4. data-testid 清单

| 元素 | 文件 | data-testid | 用途 |
|---|---|---|---|
| 底部操作栏根节点 | `EntryDetailMobileBar.vue` `.mobile-bottom-bar` | `mobile-bottom-bar` | BDD-4/5/12：定位/可见性/桌面端不出现校验 |
| meta 信息条根节点 | `EntryMetaTagsBar.vue`（新组件根 div，同时保留 `class="meta-tags-bar"`） | `meta-tags-bar` | BDD-1/2/3：跳变/嵌入文档流校验 |
| 内容滚动容器 | `EntryDetailContent.vue` `<main class="content-area entry-content">` | `content-area` | BDD-1/2/4/5/9：滚动位置/measure 基准元素 |
| markdown 正文容器 | `MarkdownViewer.vue` `.markdown-body` | `markdown-body` | BDD-8/9/11：留白测量目标元素 |
| 底部栏 wrap 按钮 | `EntryDetailMobileBar.vue` | `mobile-bar-wrap-btn` | BDD-7：wrap 切换 |
| 底部栏 copy 按钮 | `EntryDetailMobileBar.vue` | `mobile-bar-copy-btn` | BDD-6：copy 功能 |
| 底部栏 file-tree 按钮 | `EntryDetailMobileBar.vue` | `mobile-bar-filetree-btn` | BDD-6：抽屉打开 |
| 底部栏 toc 按钮 | `EntryDetailMobileBar.vue` | `mobile-bar-toc-btn` | BDD-6：抽屉打开 |
| 底部栏 source-toggle 按钮 | `EntryDetailMobileBar.vue` | `mobile-bar-source-toggle-btn` | BDD-6：切换 |
| 底部栏 overflow 触发按钮 | `OverflowMenu.vue`（既有） | `overflow-menu-trigger`（已存在，无需新增，直接复用） | BDD-6：more 菜单打开 |

## 5. 实现完成的标志

- `useResponsiveLayout.ts` 不再导出 `setupScrollHide`/`metaTagsHidden`；`EntryDetailHeader.vue` 不含任何 `.meta-tags-bar` 相关模板/CSS/prop
- 新增 `EntryMetaTagsBar.vue`，被 `EntryDetailContent.vue` 以 `v-if="isMobile && currentEntry"` 渲染为 `<main class="content-area">` 的第一个子节点，根节点保留 `class="meta-tags-bar"` 且带 `data-testid="meta-tags-bar"`
- `.mobile-bottom-bar` 的 CSS 含 `position: fixed; bottom: 0; left: 0; right: 0`、`padding-bottom: env(safe-area-inset-bottom, 0px)`、`z-index`、`min-height: var(--mobile-bar-height)`；`data-testid="mobile-bottom-bar"`
- `.content-area` mobile 断点含 `padding-bottom: calc(var(--mobile-bar-height) + env(safe-area-inset-bottom, 0px))`
- `EntryDetailView.vue` 的 zen-mode `:deep()` 块（原 L251-254 之后）新增一条独立规则 `.entry-detail.zen-mode :deep(.content-area) { padding-bottom: var(--space-3); }`，且原有 `display: none` 那条选择器列表未被误改
- `.markdown-body` mobile 断点 `margin: 0; padding: 0`；桌面端 `padding: var(--space-5)` 保持不变
- `DESIGN.md` L218-219/L263/L275 按第 3 节文字更新，新增 Markdown Body Spacing 小节
- `make test-frontend` 全绿；`E2E_SPEC=e2e/t090-mobile-detail-ux-polish.spec.ts make debug-test` 覆盖 BDD-1~12 全部 12 条并通过（含 markdown + code 两种 viewer、mobile/desktop 双视口、375px 极小屏、两种模拟可视高度）
- `npx vue-tsc --noEmit` 通过（CI 强制）
