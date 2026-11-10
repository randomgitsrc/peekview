# P2-review-design 进度（plan-design-review / TPV0102）

## 形态分派（已完成）
- P1 `ui_render_shape: layout` + P2 §5「渲染形态: layout」→ 一致。
- 加载**布局组**（移动端考虑 / 组件完整性）+ **交互组**（交互状态覆盖率 / 交互设计细节 / 可访问性）+ **视觉组**（视觉设计）。
- **不启用**渲染正确性与时序维度。

## 维度 1/7 — 交互状态覆盖率：8/10
BDD 点名的 6 个状态**全部有 UI 表现**：进行中（disabled+inFlight）/ 失败（回滚+error toast）/ 二次确认 / Team 子菜单 / 无团队不渲染 / 0 文件空态。
扣分依据（实测）：
- **团队列表加载失败态缺失**：`stores/team.ts:22-35` 的 `loadMyTeams()` catch 里只置 `error`，`teamsLoaded` 仍 false、`allTeams` 为空 → 菜单不渲染 Team 入口，**与 BDD-17「无团队」表现完全相同**。P2 §3.7 只写"已加载则跳过"，§5 交互 checklist 的 empty 项也只写"无团队 → 不渲染 Team 入口"，未区分"加载失败"。
- **二次确认取消态缺失**：`ConfirmDialog.vue:44-50` 的 `cancel()` 只关弹窗，P2 §3.5 未写取消后菜单是否重开、焦点去向。
- 菜单 loading 态 P2 显式声明"无（乐观更新）"→ 合理，不计扣分。

## 维度 2/7 — AI Slop 风险：6/10（分数越高＝留白越少）
具体值给得很足（颜色变量 / 字号 / 间距 / DOM 结构 / 6 条视觉契约），但存在**自相矛盾与不可实现**的留白：
- `VisibilityMenu` props 声明为 `{entry, teams, variant}`（§3.5:434），后文却写"`props.disabled`（父组件传入 inFlight）"（§3.5:438）——**props 里没有 disabled**。
- `visibility-confirm` testid（§3.8:511）落在 `ConfirmDialog` 实例容器，但 `ConfirmDialog.vue` 全文**无 data-testid 且根为 Teleport**，无 attrs 透传路径（既有测试靠 `.confirm__btn--destructive` 类名定位，见 `t093-star-manage.test.ts:116`）→ 该 testid **无法实现**。
- `applyPatch()` / `restore()`（§3.5:452,459）为未定义伪函数，签名与回滚字段范围未给。
- `gap: 2px`（§5:586）与 `padding: 2px 6px`（§5:585）与同节声明"间距节奏全部走 var(--space-*) 刻度，不写字面像素"（§5:587）**自相矛盾**。
- tooltip `z-index: 30`（§3.4:379）不在 DESIGN.md §4 Z-Index Scale 刻度（10/100/200/210/300）上，且低于移动端 sticky header 的 50。

## 维度 3/7 — 移动端考虑：5/10
- 两档 viewport 均说明（1280×800 / 390×844）+ VC-1/VC-4 针对移动 ✓。
- **违反 DESIGN.md §9「Overflow menus: dropdown on desktop, bottom sheet on mobile」**：`VisibilityMenu` 只有 `variant?: 'icon' | 'inline'`（§3.5:434），**无移动端 sheet 形态**；P2 §1.2 还把 `OverflowMenuSheet` 列为不改动项。既有 `EntryDetailMobileBar.vue:50` 正是用 `variant="sheet"`，先例明确。
- **VC-4 门槛 24px < DESIGN.md §9「Touch targets: minimum 44px」**：P2 新增契约反而把低于设计系统的值固化进验收。
- 移动端 `EntryMetaTagsBar` 位于 `.content-area`（`EntryDetailContent.vue:23-24`），而 `.content-area { overflow-y: auto }` → 下拉浮层溢出被裁剪/撑出滚动条，P2 未处理。
- **tooltip CSS 与 checklist 矛盾**：§3.4:378-380 为 `left: 0` + `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`；§5:552 却称"tooltip max-width:320px 且**右对齐**防止横向溢出"。`left:0` 不是右对齐，`nowrap`+`ellipsis` 会截断三段文本（BDD-02 要求三段全含）。

## 维度 4/7 — 组件完整性：6/10
`VisibilityMenu` 契约**不完整到 implementer 必须追问**（4 处硬缺口）：
1. **props 缺 `disabled`**：§3.5:434 只列 `entry/teams/variant`，§3.5:438 却要求 `props.disabled` 由父组件传入 → BDD-24 的实现依据缺失。
2. **emits 只有 `select`，无 `confirm-cancel`/`open-change`**：二次确认取消后菜单状态无法回到父层。
3. **内部状态未列**：`isOpen` / `isTeamSubmenuOpen` / `pendingTarget`（等待确认的目标）/ `isConfirming` 四态均未声明，仅散落在正文叙述里。
4. **`variant: 'icon' | 'inline'` 与移动端形态冲突**：见维度 3，缺 `sheet`。
`TimeDisplay.vue` 契约较完整（props `dateStr`、DOM 结构、CSS、tooltip 文本三段），但：
- `data-testid="time-display"`（§3.8:504）声明在根，而 §3.4:369 的根 `<span class="time-display">` **未写该属性** → 清单与模板不一致。
- 四处调用点（`EntryCard:43` / `EntryListRow:19` / `EntryDetailHeader:62` / `EntryMetaTagsBar:4`）现有 `:title` 与 `relativeTime` prop 的移除/替换未逐点列出（§6.4 第 8 项只笼统写"改传 absolute"）。

## 维度 5/7 — 可访问性 / 键盘可达：7/10
- BDD-30 **真覆盖**（非空泛）：§3.5:439 与 §5:557-562 明确 `Escape`→`close()`→`triggerRef.focus()`、`Tab` 关闭、`document` 监听成对增删，且**逐条对标** `OverflowMenu.vue:113-156` 实测实现（我已核对该文件 123-126 行 `close()` 确有 `triggerRef.value?.focus()`，139-146 行确有 Escape/Tab 分支）→ 该维度核心判据达标。
- 扣分依据：
  - **焦点可见缺失**：新增触发按钮用 `card-action-btn`（28×28，`EntryCard.vue:225`）/ `action-btn`（`EntryListRow.vue:447`）——两者**均无 `:focus-visible` 规则**（我 grep 确认：EntryCard/EntryListRow 只有 `.card-title`/`.meta-username`/`.tag-overflow`/`.star-exempt-help`/`.force-delete`/`.confirm__btn` 六处有）。DESIGN.md §10 强制"All interactive elements must have visible focus indicators"。P2 未补。
  - **`aria-haspopup`/`aria-expanded` 被显式排除**（§1.2:127 归 roadmap）→ 读屏用户无法感知菜单开合。BDD-30 未要求，故不判 BLOCKER，但属本任务自建的 a11y 缺口。
  - **子菜单键盘路径未定义**：§5:562 只写"菜单项为 `<button>`，Tab 可逐项遍历"；Team 子菜单的展开键（Enter/→/click）与展开后 `aria-expanded` 未写 → BDD-18 的键盘路径空白。
  - **`ConfirmDialog` 焦点回归未定义**：`cancel()`/`confirm()` 后焦点去向未写（既有组件不处理，见 `ConfirmDialog.vue:44-50`）。

## 维度 6/7 — 视觉设计：6/10
- 布局一致性（1/2）：§5 给了四区结构与浮层关系，但**未处理详情页头部视觉密度**（P0 已登记风险 R9）。实测 `EntryDetailHeader.vue:66-73` 的 `meta-row` 已有 owner 链接 / 时间 / Archived|Expired / Expires / 阅读数 / 可见性标签 / tags 七类元素且 `flex-wrap: wrap`；P2 只把只读 `status-tag` 换成同尺寸 inline 菜单（`font-size:10px; padding:1px 6px`），**未给出密度度量断言**（VC-5/VC-6 都不覆盖 meta-row 换行后高度变化）→ 视觉影响未闭环。
- 颜色与对比度（2/3）：§5:579-582 全部沿用既有变量、零新增色，方向正确。但：
  - 引用的是**primitive** `--c-*` 变量（`--c-surface`/`--c-text`/`--c-error`），而 DESIGN.md §12 Do's 明确"Use semantic alias tokens (`--bg-*`/`--text-*`/`--border-*`/`--accent-*`) in component code. Primitive tokens (`--c-*`) are for defining semantic aliases in variables.css only"。既有组件虽大量用 `--c-*`（历史债），但 P2 是**新增代码**，直接照抄与设计系统明文冲突。
  - WCAG AA 结论"风险为零"未给实测依据；`--c-text-tertiary` 在暗色 `#6a7682` on `--c-surface` `#121822` 的对比度约 4.0:1（**低于 4.5:1**），而卡片元信息（含新时间主显）正用该色 → §5:581 的"已满足 WCAG AA"对 tertiary 文本不成立。
- 字体与间距（2/3）：字号层级引用 DESIGN.md 一致（13px mono = Meta/Caption 档）。但**自相矛盾**：§5:585-586 写 `padding: 2px 6px`、`gap: 2px`（字面像素、非 4px 倍数），同节 :587 又写"间距节奏全部走 `var(--space-*)` 刻度，不写字面像素"；且 `2px` 违反 DESIGN.md §4「Base Unit 4px，除 1px 边框外均为 4 倍数」与 §12 Don't。
- 组件一致性（1/2）：`ConfirmDialog` 复用 ✓、Lucide 图标 ✓、`--radius-md`/`--shadow-md` ✓。但：
  - **新增菜单与 `OverflowMenuDropdown` 样式重复**（P2 §2.2 自认"样式/行为重复，可接受"）——未说明是复用 `.overflow-dropdown` 样式还是重写；DESIGN.md §6「Overflow Menus: Use OverflowMenu component」→ 新建平行实现偏离系统规范，需显式理由（P2 给了理由，但未给"视觉如何保持一致"的机制）。
  - **`z-index: 30` 偏离 DESIGN.md §4 Z-Index Scale**（10/100/200/210/300），且 < 移动端 sticky header 的 `z-index: 50`（`EntryDetailHeader.vue:161`）→ 移动端 tooltip 会被头部盖住。

## 维度 7/7 — 交互设计细节：6/10
- 输入态反馈（2/4）：本任务无文本输入（P2 明确声明，合理）。状态选择类的反馈写得具体（三态 toast / 失败回滚 / disabled）。扣分：
  - **取消二次确认后的反馈空白**（同维度 1）。
  - **toast 文案与既有不一致**：P2 §3.5:99 定 `Made public` / `Now private` / `Shared with Team <name>`，而现状是 `Entry made public` / `Entry made private`（`EntryListView.vue:640`、`useEntryDetailActions.ts:52`）→ 无迁移说明，且 §6.4 未登记 toast 文案断言的更新面（现有测试若断言旧文案会静默红）。
  - **`revokedShares` 反馈丢失**：现 `toggleVisibility` 有"`N share link(s) revoked`" warning toast（`entryList.ts:66-70`），P2 的 `setVisibility` 伪码**未保留**该分支 → 行为回退（升 public 自动撤销分享链接是后端既有行为，`entry_service.py:856-859`）。
- 键盘可达与焦点（2/3）：Escape/Tab/focus 回归达标（见维度 5）；扣分：焦点可见缺失 + 子菜单键盘路径空白 + 无焦点陷阱（`Tab` 直接关闭而非在菜单内循环，与 `OverflowMenu` 一致故不计重罚）。
- 过渡与禁用态（2/3）：`disabled` + `aria-disabled` 有；**过渡未定义**——菜单开合无 transition（P2 §5:613 明确"无 transition 动画"），但 DESIGN.md §8 有 `--transition-fast` 惯例且既有 `OverflowMenuDropdown` 也无过渡（一致性 OK，故轻扣）；**禁用态的视觉表现未写**（只写 `disabled` 属性，未写禁用时颜色/透明度）。

## UI 层 ≥2 候选 + 权衡 判定（角色定义的硬要求）
- **决策点 B（菜单载体）**：B1 新建 / B2 扩展 `OverflowMenu` —— **非稻草人**。B2 的真实代价已核实：`OverflowMenuItem`（`OverflowMenu.vue:79-89`）确为平铺模型（仅 `label/icon/hint/href/variant/divider/action`），无子菜单字段；实际调用方 3 处（`EntryDetailHeader.vue:53`、`EntryDetailMobileBar.vue:50`、`settings/UserManagerTab.vue:38`，P2 写"5 处"偏多但量级方向对）。B1 的代价（与 `OverflowMenuDropdown` 样式重复）也被自认。**判定：候选与权衡成立**。
- **决策点 C（tooltip 形态）**：C1 原生 title / C2 自定义 DOM / C3 CSS `::after` —— **非稻草人**，三者均有实测结论（V6：C1 `getByText` 命中 0；C3 命中 0 且 `textContent` 不含；C2 唯一可断言；附加 `opacity:0` 的 `isVisible()` 仍 true）。C1 是现状形态（真实基线而非陪衬）。**判定：候选与权衡成立，选 C2 合理**。
- **布局维度未满足 ≥2 候选**：可见性入口在详情页头部/移动元信息条的**落位**只有"只读标签 → inline 菜单"一个候选（§1.1 D8），未比较「保留只读标签 + 新增独立图标按钮」「仅收敛进 overflow 菜单」等替代。视觉维度同理（配色只有"全部沿用既有变量"一个候选，虽理由充分）。**按角色定义严格口径属应补项**，但 BDD-23 的落位约束较强（必须出现在头部 + 元信息条），判为**次要缺口**，不单独构成打回理由。

## architect 两项裁决（§12）— 我的结论
1. **详情页 overflow 的 `Make Public`/`Make Private`：同意移除（选项 a）**。理由：入口单一化避免两处语义分叉（overflow 项无法表达 Team 态，对 team entry 显示 `Make Public` 会误导）；且 `mount-detail` 批同时含 `useEntryDetailActions.ts` 与 `EntryDetailHeader.vue`，不存在"详情页零可见性入口"的中间窗口。**前置条件**：§6.4 第 9 项必须把 `e2e/t052-header-redesign.e2e.spec.ts:108-112` 与 `src/__tests__/t052-header-redesign.test.ts:100` 的更新写成**显式条目**（现状已列，但 `t052-header-redesign.test.ts:100` 实测只是 `const item: OverflowMenuItem = { label: 'Make Private', ... }` 的字面量断言，**与组件行为无关**，无需改——§6.4 把它列为待更新项属**误判**，应删除该行，避免 P4 做无意义改动）。
2. **`visibility-toggle` 沿用（不改名）**。理由：`EntryCard.vue:8` / `EntryListRow.vue:98` 已用该 testid，沿用只需翻转 TPV0095 的断言值，改名则要动两处组件 + 5 处断言 + 1 处 E2E。**但 P2 存在硬矛盾必须修**：§3.8 表内同时声明 `visibility-menu-trigger`（:506）与"沿用 `visibility-toggle`"（:514）指向**同一元素**——二选一，保留 `visibility-toggle`，从 §3.8 表删除 `visibility-menu-trigger` 行。

## 关于 §5 多出的「渲染正确性 / 动效时序 checklist」
**不应删，也不属 AI Slop**：两节均写有 `**维度不适用**` + 具体理由（:609 / :613）。architect 规范明确要求"不适用的维度显式声明'维度不适用'"——显式声明正是**避免**留白的做法。判定：**保留**。

## 完成（终）
- `P2-review-design.md` 已写入（42878 字节）。
- status: **needs-revision**（20 项缺陷，5 项高级别，无 CRITICAL；架构选择 B1/C2/A2 均正确，可原地修正）。
- 两维主分：视觉设计 **6/10**、交互设计细节 **6/10**（其余：交互状态覆盖率 8、AI Slop 风险 6、移动端 5、组件完整性 6、可访问性 7）。
- 两项裁决已给结论：① overflow 的 Make Public/Private **移除**（附前置修正：`§6.4` 第 9 项误列 `t052-header-redesign.test.ts:100`，该行是字面量断言与组件无关，应删）② `visibility-toggle` **沿用**（须删 `§3.8` 的 `visibility-menu-trigger` 重复行）。
- 已核验 `git status --porcelain`：相对基线的唯一新增为本文件与 P2-review-design.md（其余为并行 plan-eng-review 产出）。
- [PROD_NOT_TOUCHED]

---

## 复审轮（第 2 轮）进度记录

状态：核心核验已全部完成（D-1~D-5 + 2 裁决 + D-6/7/9/10 抽查 + 上轮通过项复查），正在覆盖写 `P2-review-design.md`。

**D-1 已闭合**：§3.5:475-503 三张表齐全。props 6 行含 `disabled`（`:484`）+ `teamsFailed`（`:486`），并显式删除 `currentTeamSlug`（`:485`）；emits 2 行含 `confirm-cancel`（`:493`）；内部状态 5 行表（`isOpen` / `isTeamSubmenuOpen` / `pendingTarget` / `isConfirming` / `triggerRef`，`:497-503`），转换列写明。支撑 BDD-24 的链路完整（`disabled` → `disabled` + `aria-disabled`，:511）。

**D-2 已闭合**：§3.8:635 明写"不设 `visibility-confirm` testid"并给不可实现的实测理由（Teleport 根 + 全文件无 data-testid），改 `page.locator('.confirm-dialog')`。我复核 `ConfirmDialog.vue:1-30` 确认根是 `<Teleport to="body">`、`.confirm-dialog`（:6）在 Teleport 内部、全文件 0 处 `data-testid`；既有 `ConfirmDialog.spec.ts:155` 确实用 `q('.confirm-dialog')` 类名定位 → 该替代路径有先例，可实现。

**D-3 已闭合**：§3.5:549-552 `setVisibility` 含 `updated.revokedShares > 0` → warning toast；§6.2:793 补 `entry-list-visibility.spec.ts` 的 >0 / 0-or-undefined 两条单测；§5:698 success 项改四态。核实现状 `stores/entryList.ts:64-68` 确有该 toast、`api/client.ts:135` 的 `transformEntry` 确有 `revokedShares: entry.revoked_shares ?? undefined` → 字段通路成立。

**D-4 已闭合**：§3.5:483 `variant: 'icon' | 'inline' | 'sheet'`；`:516` sheet 走 `Teleport to="body"` 规避 `.content-area{overflow-y:auto}` 裁剪（我复核 `EntryDetailContent.vue:227` 确有该 overflow）。`EntryDetailMobileBar.vue:50` 的 `<OverflowMenu variant="sheet">` 先例我实测存在，`OverflowMenuSheet.vue:1` 也是 `Teleport to="body"` → 形态与先例一致。
但**新增一处缺陷**：`sheet` 的切换机制写"由父组件传入，或组件内按 `useMediaQuery` 自动切换"——项目**无 `useMediaQuery`**（grep 0 命中），Explore 页也无 `isMobile`（`provide(IsMobileKey)` 仅 `EntryDetailView.vue:159` 一处）。故卡片/列表两处在 390px 下由谁切 sheet **未定**，P4 需自行发明。

**D-5 已闭合**：§5:742 VC-4 已改 `toBeGreaterThanOrEqual(44)`；§5:747-749 拆成"本任务新增/接管的按钮 ≥44px"+"既有 28×28 按钮不在本任务范围（§7.1 S2 登记）"。方向正确、不再向下对齐。

**裁决 1 已正确采纳**：§6.4 表内**已无** `t052-header-redesign.test.ts:100` 行；第 9 项只留 E2E `:108-112` + `:114`（§6.4:827），并在 `:831-836` 给出范围裁定块。我独立复核 `__tests__/t052-header-redesign.test.ts:99-105` 确认该行确是 `const item: OverflowMenuItem = { label: 'Make Private', icon: 'globe' }` + `isLucideName` 断言，与组件行为无关 → 不列入待改正确。E2E `:109`/`:114` 我也实测确认存在且会被移除项打断。

**裁决 2 已正确采纳**：§3.8 表（`:624-633`）**已无** `visibility-menu-trigger` 行，触发按钮只保留 `visibility-toggle`（`:628`）；`:508` 还加了"不得另命名"的反向约束。§6.4 第 5 项（`:823`）已改为"改为定位菜单入口按钮（`[data-testid="visibility-toggle"]`）"，与 D8 的"替换"语义一致 → 矛盾已二选一解决。我复核 `tpv0095-detail-visibility-tag.spec.ts:111-112` 的 `.status-tag` 定位确实需要改。

**D-6 已闭合**：§5:710-719 改为 4 行实测对比度表 + "风险为零的上一版判断不成立" + 债务归属 + §7.1 S1 登记。我独立用 WCAG 2.x 公式重算 `variables.css:50-51/114-115` 取值，得 3.84 / 3.04 / 7.26 / 5.25，与 P2 四行数字完全一致。

**D-7 已闭合**：§3.4:406-413 CSS 已去掉 `text-overflow: ellipsis`，桌面 `left:0`、`@media(max-width:640px)` 改 `left:auto;right:0;white-space:normal`；`:426` 给长度估算与"断言绿而体验红"的理由。与 §5:681 的 checklist 不再矛盾。

**D-9 已闭合**：§3.5:579-589 三级处置（`teamsFailed` prop + 禁用项文案 + 视图传值 + 语义声明"降级不满足 BDD-17 Given"）；`visibility-options.ts` 签名（`:445`）返回 `teamsFailed`；R11（`:156`）、§7.1 S3、§6.2 单测均已登记。我复核 `stores/team.ts:22-35` catch 分支确实只置 `error`、不置 `teamsLoaded` → 原缺陷成立且处置对症。

**D-10 已闭合**：§3.5:510 取消路径完整（清 `pendingTarget` + `emit('confirm-cancel')` + `isOpen=true` 重开 + `nextTick` 后 `triggerRef.focus()`），并给了 `ConfirmDialog.vue:38-42` 焦点落 body 的理由；§6.2:791 补对应单测。

**上轮通过项复查（未被破坏）**：§2.2 B1/B2 与 §2.3 C1/C2/C3 候选与双向权衡仍在（`:211-231`、`:247-273`）；§2.2b 新增入口落位取舍表（3 个被排除替代）；§5 的「渲染正确性 checklist / 动效时序 checklist」两节仍在且各有 `**维度不适用**` + 具体理由（`:753-759`）；BDD-30 的 `OverflowMenu` 对标仍准确（我复核 `OverflowMenu.vue:123-126 close()` 含 `triggerRef.value?.focus()`、`:139-146` 含 Escape/Tab 两分支、`:148-156` onMounted/onUnmounted 成对增删）；`## UI 设计` 仍为裸标题（`:657`，gate 正则 `^#{2,3}\s+UI 设计` 可命中）。

**[PROD_NOT_TOUCHED]**

## 复审轮（第 2 轮）落盘完成

- `P2-review-design.md` **已覆盖写**（复审轮，frontmatter 加 `review_round: 2`）。
- **status: needs-revision**。
- **D-1~D-5 全部真闭合**（5/5，逐条独立复验源码，非采信自述）。
- **2 项裁决均正确采纳**：`t052...test.ts:100` 已从 §6.4 删除（只留 E2E `:108-112` + `:114`）；`visibility-menu-trigger` 已从 §3.8 删除，§6.4#5 已统一为"替换"语义。
- **D-6/7/9/10 抽查 4/4 闭合**；D-6 的对比度四数字我独立用 WCAG 公式重算，逐位一致。
- **上轮通过项复查未被破坏**：B1/B2 + C1/C2/C3 候选与双向权衡、§2.2b 落位表、§5 两节「维度不适用」、BDD-30 对 `OverflowMenu.vue:123-156` 的对标、`## UI 设计` 裸标题（`:657`）。
- **本轮新增 5 项缺口**（N-1~N-5，均中/低级别，无高级别）：
  - N-1 中（高影响）`teams.find(t => t.id === teamId)` / `team = {id,slug,name}` —— 前后端 Team 均无 `id`，`tsc` 报错 + BDD-18 无派生路径（改正：用 `entry.team?.slug`）
  - N-2 中 `variant="sheet"` 切换主体悬空（无 `useMediaQuery`、Explore 页无 `isMobile`、prop 链无 `variant`）
  - N-3 中 VC-4 的 44px 与 `:732` 的 28×28 规格自相矛盾，全文无实现侧 44px 规则
  - N-4 中 `inline`/`icon` 变体的可见文案与 `aria-label` 均未定义（全文 0 处 `aria-label`）
  - N-5 低 §6.4#5 行号 `:75` 实为 `:111-112`，受影响 3 条断言而非 1 条
- **两维主分对比**：视觉设计 **6 → 8**、交互设计细节 **6 → 8**；其余：交互状态覆盖率 8→9、AI Slop 风险 6→7、移动端 5→7、组件完整性 6→7、可访问性 7→8。
- 已核验 `git status --porcelain`：相对基线唯一新增为本次任务目录下的产出文件（无对被评审文件的修改）。
- [PROD_NOT_TOUCHED]

### 分级口径自查修正

N-1 与 N-3 由「中（高影响）」上调为**高级别**——判据与我上轮给 D-1/D-2/D-5 定"高"时一致：**P4 照 spec 写必然失败，且失败发生在下游阶段**（N-1 = `vue-tsc` 编译错、CI 强制；N-3 = P2 冻结的视觉契约与实现规格互相矛盾，P6 必红且契约冻结后不可改）。不因"本轮是复审、倾向放行"而降低口径。

故本轮 5 项新缺口的分级为：**2 高级别（N-1 / N-3）+ 2 中级别（N-2 / N-4）+ 1 低级别（N-5）**，status 维持 **needs-revision**。

`agate-frontmatter-check.py`（FILE=本文件）复跑 **exit 0**。

## [round3] 启动 2026-11-10T19:06:43+08:00
- 读取角色定义、dispatch-context rev2、上轮评审（312 行）
## [round3] 核验进度（时间盒内逐项落盘）
- N-1 已核：`visibility-options.ts` 入参 `currentTeamSlug`（:447）；`teams.filter(t => t.slug !== currentTeamSlug)`（:457）；`entry.team?.slug ?? null`（:455）；全文 `t.id ===` 仅 2 处（:453 否定陈述、:1385 修订对照）→ 合法。后端 `TeamSummary`/`TeamRef` 与前端 `Team`/`TeamRef` 均无 id（models.py:747-752/947-952、types/index.ts:9-18 实测）→ N-1 闭合。
- N-2 已核：`useResponsiveLayout.ts` 实测存在（`isMobile = viewportWidth <= 640`，rAF 节流）；`EntryDetailView.vue:133 import / :156 解构 / :217 add / :227 remove` 成对；`UserManagerTab.vue:87` 用法；`EntryListView.vue:262` import 确实无 `onBeforeUnmount`（设计称需补，属实）→ N-2 闭合。
- N-3 已重判：§5:863-878 扩为 4 行「新 vs 既有」表（行 1 = 新按钮移动端 44×44 VC-4 断言 / 行 2-3 沿用既有尺寸不断言 / 行 4 既有 28×28 本任务不改）+ 写死 `@media (max-width:640px){ .visibility-toggle{min-height:44px;min-width:44px} }` → P4 照 spec 写可达 44px，**改判闭合**。
- N-4 已核：三子表存在（:553-559 可见文案 / :561-579 aria-label / :581-591 菜单项文案+testid）+ :593-601 自查表；现状文案 `EntryDetailHeader.vue:68-72`、`EntryMetaTagsBar.vue:7-11` 逐字对上；`OverflowMenuSheet.vue:16/17` 先例对上（`OverflowMenu.vue` aria-label 实际在 :15，设计写 :14，差 1 行）→ 闭合。
- N-5 已核：§6.4#5 改 `:111-112`；`statusTagText()` 实测在 :111-112，被 `:135/:143/:148` 三条消费 → 闭合。
- 新发现（非阻塞）：详情页 `VisibilityMenu` 的 `select` 落地主体未定义；§3.5:668 称详情页不走 store 与 §6.4#10 把 `useEntryDetailActions.ts:52` toast 当“改文案”冲突 → 记 SUGGEST/P4 硬约束。

## [round3] 完成
- 覆盖写 `P2-review-design.md`（status: approved，review_round: 3）
- N-1~N-5 逐条证据落 §2 / §3（N-3 改判闭合，含改判理由）
- 复查「不应被破坏」落 §4（12 项全通过）
- 新发现 4 项 SUGGEST（S-1 toggleVisibility 处置 / S-2 详情页 select 落地 / S-3 isOwner prop 链 / S-4 两处行号与表行口径），均附 P4 默认路径，不阻塞
- 评分：视觉 8/10（持平）、交互 8/10（持平）；AI Slop 7→9、移动端 7→9、可访问性 8→9、交互状态覆盖率 9→9、组件完整性 7→8
- 只读核验：git status --porcelain 仅本文件 + progress 为新增；未触碰 :8080 / ~/.peekview/ [PROD_NOT_TOUCHED]
- frontmatter-check exit 0；check-gate P2 exit 1 唯一原因 P2-review.md 不存在（预期）
