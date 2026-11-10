---
phase: P4
task_id: TPV0102
type: review
parent: P4-implementation.md
trace_id: TPV0102-P4-review-design-20261110
status: approved
created: '2026-11-10'
agent: design-review
review_scope: ui
ui_render_shape: layout
review_round: 2
dimensions_checked: AI_Slop Typography Spacing 交互状态 可访问性 视觉契约
findings_total: 12
findings_blocking: 0
findings_suggest: 4
prod_touched: false
---

# P4 前端实现评审（第 2 轮复审）— Explore 卡片列表体验修正（design-review）

> **被评审对象**：4 个新建 + 13 个改动前端文件（P4 rev1 + rev2 修复，工作树未 commit）
> **判定基准**：独立读源码 + 独立实跑（E2E / vitest / typecheck / lint）+ **真实浏览器 DOM 度量与反向对照**；不采信 `P4-implementation.md` 自述
> **P6 两条禁令已遵守**：① 本文件**不**断言任何「对比度已满足 WCAG AA」——`--c-text-tertiary` 实测暗 3.84:1 / 亮 3.04:1，低于 AA 4.5:1，属既有债 SUGGEST（P2 §7）；② 既有 `card-action-btn` / `action-btn` 的 **28×28 不判为缺陷**（P2 §7.1 S2「本任务不改」）。VC-4 只对**新增** `VisibilityMenu` 触发按钮的移动端 44px 作断言
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 1. 结论

**status: approved**

**上轮 4 个阻塞项（F-1~F-4）全部闭合，本轮 3 处额外测试语义改动全部判为「修正错误断言」而非「降低验证强度」。**

- **F-1**（列表末行下拉被裁）：改为「去掉 `.entry-panel{overflow:hidden}` + 首末行自理 13px 圆角」，**实测裁剪消失**（浮层溢到容器外 43px 仍完整可命中），反向对照（临时还原 `hidden`）立刻退化到 47% 可见且 `Team` 项不可命中 → 该修复是**真修**且有回归用例 `vc08` 兜底。圆角/边框**未坏**（截图 + 角点像素命中 `list-content` 确认圆角生效）。
- **F-2**（桌面焦点环被 `opacity:0` 抹掉）：补 `:focus-within`，**真按 Tab 实测** `opacity 0→1`，反向对照（注入 `:focus-within{opacity:0!important}`）回落到 0。
- **F-3**（tooltip 文本溢出背景框）：`white-space: normal` 落到基础规则，**实测** 盒子 207×64、文本 152×48、右溢出 **-47px**（文本在框内）。
- **F-4**（`EntryListRow.spec.ts` 静默失效断言）：守卫已删、改 `[data-testid]` 路径并断到 `target.kind === 'private'`，文件头登记取代来源，**逐条 verbose 实跑 15/15 passed**。

**3 处额外测试改动判定**：bdd25 = **修正（不可达判据）+ 留一处软缺口**；bdd04 = **修正且净增强**；vc06 = **修正，桌面原强度实测仍在执行**。均**不构成降低验证强度到需打回的程度**。

| # | 级别 | 类型 | 一句话 |
|---|---|---|---|
| **F-1** | ✅ 已闭合 | [INTERACTION] | 无裁剪祖先、浮层越容器 43px 仍可命中；反向对照对裁剪敏感 |
| **F-2** | ✅ 已闭合 | [INTERACTION] | 真 Tab 实测 `opacity 0→1` + 焦点环 `2px rgb(9,105,218)`；反向对照归零 |
| **F-3** | ✅ 已闭合 | [VISUAL] | `white-space: normal`，文本在框内（右溢出 -47px） |
| **F-4** | ✅ 已闭合 | [TEST] | 守卫删除，断言实跑覆盖点恢复（15/15，verbose 逐条确认） |
| **F-7** | ✅ 已闭合 | [DOC] | `[DESIGN_GAP]` 第 3 条记述已与代码一致（icon/inline 不 Teleport，改由父容器解除裁剪） |
| **T-1** | ✅ 判为「修正错误断言」 | [TEST] | bdd25：`empty-select-file` 对有文件 entry **确不可达**（源码 + 实测双证）；文案改常量对照，主 Then 保留 |
| **T-2** | ✅ 判为「修正错误断言」（**净增强**） | [TEST] | bdd04：同 slug 锚定，消除双请求竞态，时区判定口径与原来完全一致 |
| **T-3** | ✅ 判为「修正错误断言」 | [TEST] | vc06：矩形二维不相交 = 几何上「不重叠」；**桌面分支实测仍执行原断言且成立** |
| **F-10** | 建议 | [VISUAL] | `.card-meta-text` 换行后**分隔点悬空**（`@alice ·` / `· 3 files` 各占一行首尾）——本轮 rev2 修复的连带视觉瑕疵 |
| **F-11** | 建议 | [TEST] | vc05（第 4 处改动，rev2 已披露）：`sameRow \|\| wrappedToOwnRow` 在当前布局下判别力低（桌面 20/20 卡全部走 wrapped 分支） |
| **F-12** | 建议 | [INTERACTION] | 详情页 `.entry-detail{overflow:hidden}` 仍是 `inline` 变体浮层的潜在裁剪祖先（当前实测无裁剪，仅登记风险） |
| **F-8/F-9** | 建议（沿用） | [DOC]/[VISUAL] | `EntryDetailView.vue` 289 行余量 11；sheet 内中英混排——本轮未要求修，维持原判 |

**未构成缺陷（已核实，明确不计入）**：移动端新增触发按钮 44×44 达标 ✅；无 AI Slop（4 个新文件 hex/violet/gradient 零命中）✅；无 `Team.id` 违规 ✅；Escape + 焦点回归 ✅；既有 28×28 不在范围 ✅；对比度不自行背书 ✅；`EntryDetailView.vue` 仍 289 行、本轮未加逻辑 ✅。

---

## 2. 实跑验证（全部本人执行）

| 命令 | 结果 |
|---|---|
| `( make debug-quick; sleep 3600 )` 后台托底 → `curl :8888/health` | **200**（每次用前探活） |
| `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`（第 1 次） | **61 passed / 3 skipped / 0 failed**（39.5s），exit 0，`=== ✓ 所有 E2E 测试通过 ===` |
| 同上（第 2 次复跑，验稳定性） | **61 passed / 3 skipped / 0 failed**（41.7s），exit 0 —— 两次一致，无 flaky |
| `cd frontend-v3 && npx vitest run --reporter=dot` | **119 files / 1456 passed / 4 skipped / 1460 total / 0 failed**，exit 0 |
| **`Errors` 行 / `unhandled` / `Vitest caught` 检查** | **全部零命中**（`grep -nE "^ *Errors"` 无输出；`grep -cE "unhandled\|Vitest caught"` = **0**）→ 主 Agent 修的 `authState?.value` 无残留 |
| `make typecheck` | ✓ type check passed |
| `make lint` | All checks passed（ruff） |
| `wc -l EntryDetailView.vue` | **289**（`t082-error-format.spec.ts` 断言 `< 300`；本轮未增行） |

日志落 `.agate-tmp/vitest-rev1.log`（gitignore，收尾已删探针脚本，日志随 `.agate-tmp` 保留供主 Agent 复核）。

**DOM 度量方法**：自写 Playwright 脚本连真实 `:8888`（不连 CDP、不碰 `:8080`），1280×900 / 390×844 双档 + `en-US`/`zh-CN` 双 locale + `Asia/Shanghai` 时区。每个关键结论都配**反向对照**（临时注入相反 CSS 观察结论是否翻转），以避免「读代码得出的想当然」。

---

## 3. 四个阻塞项的闭合核验（逐条给证据）

### 3.1 F-1 —— 已闭合（备选② 是合理工程取舍，且视觉代价经实测为零）

**代码**：`EntryListView.vue:1154-1168`（`.entry-panel` 去 `overflow`，新增首/末行 `border-radius: 13px`）；`VisibilityMenu.vue:22`（`:disabled="variant !== 'sheet'"` 未变）。

**实测（1280×900，列表 20 行，滚到文档底部，最后一行开菜单）**

| 度量 | 实测 | 判定 |
|---|---|---|
| 裁剪祖先（菜单→`documentElement`，`overflow != visible`） | `[]`（零个） | 裁剪面消失 ✅ |
| 浮层 `bottom` vs `.entry-panel` `bottom` | **782 vs 739**（越出容器 **43px**） | 旧代码此区必被裁 ✅ |
| 浮层是否在视口内 | 是 | ✅ |
| `Public` / `Team` 两项 `elementFromPoint` 命中自身 | 均 `true` | 可点 ✅ |
| **反向对照**：临时把 `.entry-panel` 设回 `overflow:hidden` | 可见高 **39/82 = 47%**，`Team` 项 `hitSelf=false` | **证明该用例/断言对裁剪敏感**，不是恒绿 ✅ |

补充（比末行更强的口径）：**中间行**开菜单三项全命中；**卡片网格**中任意卡片的菜单也全命中（`menuBottom 295 < cardBottom 341`，不外溢）。

**圆角/边框是否真的没坏 —— 截图 + 像素级确认**

| 项 | 实测 |
|---|---|
| `.entry-panel` | `border-radius: 14px`，`border: 1px rgba(0,0,0,0.13)`，`overflow: visible` |
| 首行 / 末行 | `border-top-left/right` = `border-bottom-left/right` = **13px** |
| 几何关系 | 行 `x=57`、宽 `1166`；面板 `x=56`、宽 `1168` → 左右各内缩 **1px**（正好是面板 border 宽度）⇒ 13px vs 14px 圆角同心，无露白、无溢出 |
| 角点像素命中 | 面板左下/右下极角像素命中 `list-content`（面板背景在角外不绘制）⇒ 圆角真实生效 |
| 末行 hover（`--c-surface-lower`）截图 | 背景随行自身 13px 圆角收边，无方形溢出 |
| 末行 `border-bottom` 与面板 border | 行底 `738` / 面板底 `739` → 两条 1px 线相邻（与修复前一致，非新引入） |
| loading 骨架态（6 个 `.skeleton-row`，无圆角/无背景） | 无背景泄漏，角落干净 |

**关于「为什么选②而不是①」的理由是否成立 —— 独立复验成立**

我另写 VTU 探针（`.agate-tmp/teleport-probe.spec.ts`，跑完即删）实测 VTU **2.4.10**：

```
icon 变体（不 Teleport）：wrapper.find('[data-testid="visibility-menu"]') → true
sheet 变体（Teleport）  ：viaWrapper=false, viaDoc=true
```

→ 「`wrapper.find` 不穿透 Teleport」属实。`visibility-menu.spec.ts` 及 `t031-entry-card` / `t031-entry-list-row` 等共 7 个 spec 全用 `wrapper.find('[data-testid="visibility-item-*"]')` 定位菜单项，选① 确需同时改写这 7 个文件。**在 F-1 的缺陷本体（用户看不到也点不到）已被彻底消除、且新增 `vc08` 做回归兜底的前提下，选② 是合理的工程取舍，不判为缺陷。**

> 附带收益：修复后 `[DESIGN_GAP]` 第 3 条的记述与代码一致（F-7 闭合），且这一取舍本身也已作为新 `[DESIGN_GAP]` 登记在 `P4-implementation.md:330`。

### 3.2 F-2 —— 已闭合（真键盘路径 + 反向对照）

**代码**：`EntryCard.vue:226` `@media (hover:hover)` 内新增 `.entry-card:focus-within .card-actions{opacity:1}`；`EntryListRow.vue:453` 同构 `.entry-list-row:focus-within .entry-actions{opacity:1}`。

**实测（1280×900，真按 `Tab` 键，5 次 Tab 落入卡片触发按钮）**

| 度量 | 卡片（grid） | 列表（row） |
|---|---|---|
| 焦点前 `.card-actions` / `.entry-actions` opacity | `0` | `0`（同构） |
| Tab 聚焦后 | **`1`** | **`1`** |
| `:focus-visible` | `true` | `true` |
| 焦点环 | `2px solid rgb(9,105,218)` | 同 |
| 卡片 `:focus-within` | `true` | — |
| `:hover` 是否参与（排除「其实是被鼠标 hover 了」） | **`false`** | — |
| **反向对照**：注入 `.entry-card:focus-within .card-actions{opacity:0 !important}` | 稳定后回落 **`0`**；移除后恢复 `1` | — |

> 复跑提示（给后续评审）：`opacity` 有 `transition: opacity var(--transition-fast)`，采样必须等动画结束（首轮我在聚焦后立即读数拿到过渡中间值 `0`，加 400ms 等待后为 `1`）。这不是缺陷，是采样时机问题——记录下来避免下一轮误判。

### 3.3 F-3 —— 已闭合

**代码**：`TimeDisplay.vue:32` 基础规则 `white-space: normal`（`:24` 的 `nowrap` 只作用于 `.time-display__main` 主显），`max-width: 320px` 保留；`@media (max-width:640px)` 只留 `left:auto; right:0`。

**实测（1280×900，en-US，Asia/Shanghai，悬停时间）**

| 度量 | 上轮（缺陷态） | 本轮实测 |
|---|---|---|
| `white-space` | `nowrap` | **`normal`** ✅ |
| 盒子 | 320×28（文本 383px） | **207×64** |
| 文本（`Range.getBoundingClientRect`） | 383px | **152×48** |
| 文本右溢出盒子 | **+63px** | **-47px**（框内） ✅ |
| 文本下溢出盒子 | — | **-8px**（框内） ✅ |
| `visibility` | `hidden`→`visible` | 悬停生效 ✅ |

修复方向正确：换行后盒子高度自适应，`top: calc(100% + var(--space-1))` 与 `z-index: 10` 无需改动；主显仍是 `nowrap`（`bdd01` 的「不含 ago」判定不受影响）。

### 3.4 F-4 —— 已闭合（覆盖点回来且真的在执行）

**代码**：`EntryListRow.spec.ts:112-119`。

```ts
it('emits changeVisibility when visibility menu item clicked', async () => {
  const wrapper = createWrapper({ isOwner: true })
  await wrapper.find('[data-testid="visibility-toggle"]').trigger('click')
  await wrapper.find('[data-testid="visibility-item-private"]').trigger('click')
  const emitted = wrapper.emitted('changeVisibility')
  expect(emitted).toBeTruthy()
  expect((emitted![0][0] as { target: { kind: string } }).target.kind).toBe('private')
})
```

- **守卫已删**：无 `if (btn.exists())`；选择器指向存在的 `data-testid`（非旧 `.visibility-btn` / `[data-action="toggle-visibility"]`）。
- **覆盖点回来且加强**：从「事件发生过」（恒真）收紧到「载荷语义 `target.kind === 'private'`」。
- **登记齐全**：文件头 7 行注释说明「原用例被 TPV0102 有意取代」+ 新事件名 + 覆盖点未删除 + 旧守卫的问题。
- **实跑**：`npx vitest run src/components/__tests__/EntryListRow.spec.ts --reporter=verbose` → **15/15 passed**，逐条用例名可见 `emits changeVisibility when visibility menu item clicked` 为 ✓。
- 未被过度波及：同文件 `emits delete ...` 仍保留 `if (btn.exists())` 守卫，但 `[data-action="delete"]` 与 `.delete-btn` 在 `EntryListRow.vue:103-104` **仍存在** ⇒ 该守卫当前是「冗余但有效」，非静默失效（区别于 F-4 原情形）。**此项不计缺陷**，仅记录：下一轮若删 `delete-btn` 类需同批处理。

---

## 4. 3 处「额外测试语义改动」逐条判定（本轮核心）

### 4.1 bdd25 —— 判为「**修正错误断言**」（不可达判据），附一处软缺口

**第一步：根因是否成立 —— 我独立验了两遍，成立。**

源码（`stores/entryDetail.ts:44-56`）：

```ts
currentEntry.value = entry
activeFile.value = null
fileContent.value = ''
if (entry.files.length > 0) {
  const targetFile = fileId != null
    ? entry.files.find(f => f.id === fileId) ?? entry.files[0]   // 找不到也回落 files[0]
    : entry.files[0]                                            // 不传也取 files[0]
  activeFile.value = targetFile
  ...
}
```

- 只要 `files.length > 0`，`activeFile` **必被置为非空**（两条分支都兜到 `files[0]`，无 `null` 出口）。
- `selectFile(file)` 只赋 `file` 从不置 `null`；唯一的置空点是 `loadEntry` 开头的过渡态与 `clearEntry()`（离开详情页）。
- 渲染分支（`EntryDetailContent.vue:68-74`）：`v-else-if="currentEntry && currentEntry.files.length === 0"` → `empty-no-files`；`v-else` → `empty-select-file`。**`empty-select-file` 可达条件 = `currentEntry` 存在且 `files.length > 0` 且 `activeFile` 为空**，而第三个条件在上述路径下恒不成立 ⇒ **对有文件的 entry 不可达**。
- 运行期佐证：E2E 里 3 文件 entry 该 testid `count = 0`（implementer 报告，与本轮 `bdd25` 绿灯一致）；我另在详情页实测 `.meta-row` 存在、`activeFile` 已选（FILES 列表首项高亮），未出现「未选中」态。

⇒ **原断言「有文件 entry 应显示 `empty-select-file`」永远不可能通过**，属 P1/BDD-25 后半条的**判据瑕疵**，不是实现缺陷。**撤除它是正确处置，不是降强度。**（BDD-25 的 Then 前半条「0 文件 entry 显示专用空态」由 `expect(noFiles).toBeVisible()` + 文案非空 保留，强度未动。）

**第二步：替换后的强度 —— 主 Then 保住了，但有一处可修软的缺口（F-11 之外的单列项）**

新断言 = ① `noFilesText !== EMPTY_SELECT_FILE_TEXT`（`spec.ts:470`）② 有文件 entry `content-area` 可见 + `empty-no-files` `count=0`（`:477-478`）。②是**新增的正向互斥验证**（原断言没有），①是「可区分」的唯一落点。

缺口：`EMPTY_SELECT_FILE_TEXT = 'Select a file to view'`（`spec.ts:53`）是**从组件复制过来的第二个真相源**。若日后有人把 `EntryDetailContent.vue:73` 的文案改成与 `:69` 的「此 entry 无文件」相同，**常量不漂移，bdd25 仍然绿**——「两种文案可区分」这条不变式失去机械保护。

- 该分支在**真实浏览器路径**上确实不可达，所以 E2E 无法用 DOM 直接验；
- 但**单测可达**：`EntryDetailContent` 的 `activeFile` 是 prop，`mount({ currentEntry: {files:[…]}, activeFile: null })` 就能渲染 `empty-select-file` 并读真实文本，与 `empty-no-files` 文案比对。成本约 10 行。
- **判定**：不阻塞（当前两文案确实不同，且主 Then 有独立断言），登记为 **F-11a（建议，P7/P8 落 DEBT 或 P5 顺手补测）**。理由是「静默失效」的风险方向与上轮 F-4 同类，只是概率低得多。

### 4.2 bdd04 —— 判为「**修正错误断言**」，且**净增强**

**原写法**：页面第一张卡的显示时间 vs `GET /api/v1/entries?per_page=1` 的 `items[0].created_at`。这是**两个独立请求**，各自按服务端当前排序取「第一条」；`fullyParallel: true` + 同 spec 内多个用例并发造 entry 时，两者可能落在不同 entry（implementer 实测差 1 秒）。**flaky 是结构性的，不是偶发。**

**新写法**（`spec.ts:363-406`）：现造一条 entry（`summary` 含 `Date.now()` 唯一），页面用 `entryLocator(page, summary)` 锚到该卡，`created_at` 用 `getEntryJson(slug)` 按**同一 slug** 取。

**强度核对**（BDD-04 要验的是「`Asia/Shanghai` 下显示 +8 小时」）：

| 维度 | 原写法 | 新写法 | 判定 |
|---|---|---|---|
| 时区固定 | `test.use({ locale:'zh-CN', timezoneId:'Asia/Shanghai' })` | 同 | 保留 |
| 主显必须含 `GMT+8` | `expect(mainText).toContain('GMT+8')` | 同 | 保留 |
| 墙上时间 = UTC + 8h | 浏览器内 `Intl.DateTimeFormat(Asia/Shanghai)` 求 `HH:MM:SS` 后 `toContain` | 同（一字未改） | 保留 |
| NaN 防护 | `not.toContain('NaN')` | 同 | 保留 |
| **数据同源** | 两个请求各自取第一条（可能不同源） | **同一 slug**，DOM 与 API 指向同一条 | **增强** ✅ |

**「现造 entry 是否引入别的问题」——已查，没有**：

1. **时区计算不依赖创建时刻**：主显是**绝对时间**（`TimeDisplay` 的 `.time-display__main`，实测 `11/11/2026, 01:26:12 AM GMT+8`），不是相对时间 ⇒ 不受「刚创建 3 秒内」影响。
2. **新 entry 不会因排序而不在第一屏**：`entryLocator` 按 `hasText: summary` 过滤 `.entry-card, .entry-list-row`，与排序无关。
3. **`created_at` 格式**：API 返回 `Z` 后缀 UTC ISO（实测 `"2026-11-10T17:26:12.672066Z"`，来自 `timefmt.utc_iso_z`）；spec 内 `raw.replace(' ', 'T').replace(/Z?$/, 'Z')` 对该格式幂等，无双重后缀。
4. **清理**：`createEntry` 内部 `trackEntry(slug, token)`，`afterEach` 无条件 DELETE（接受 200/204/404）⇒ 不残留数据。

**判定：这是「修正错误断言」（消除结构性 flaky），且断言强度净增强。**

### 4.3 vc06 —— 判为「**修正错误断言**」，桌面原强度实测**仍在执行**

**代码**（`spec.ts:1050-1085`）：先二维不相交 `overlapX <= 0 || overlapY <= 0`；再 `isTwoColumn = getComputedStyle(row).gridTemplateColumns.split(' ').length > 1`，`if (isTwoColumn)` 时执行**原断言** `actionsBox.x >= titleBox.x + titleBox.width - 1`。

**① 「桌面保留原强度」是否真的保留 —— 实测确认有分支且真在跑**

| 视口 | `gridTemplateColumns` | `splitLen` | `isTwoColumn` | 原断言是否执行 | 原断言结果 |
|---|---|---|---|---|---|
| 1280×900 | `876.438px 241.562px` | 2 | **`true`** | **执行** | `actionsBox.x(1151) >= titleBox.x+width-1(956)` → **成立** |
| 390×844 | `308px` | 1 | `false` | 跳过 | `overlapX 76 / overlapY -81` → 二维不相交成立 |

实测数字：桌面 title `x=81 w=876`、actions `x=1151 w=48`，`overlapX = -194`；移动 title `x=41 w=308`、actions `x=235 w=76`，`overlapX=+76` **但** `overlapY=-81`（纵向分离）。

⇒ **桌面分支是活的**（不是「写了分支但永不触发」）：`grid-template-columns` 解析值是空格分隔的长度列表，两列必得 `splitLen=2`。**「桌面保留原强度」成立。**

**② 二维不相交是否等价于「视觉不重叠」—— 等价，不会放过斜向重叠**

对**轴对齐矩形**，`intersectX = min(ax2,bx2) - max(ax1,bx1) > 0` 当且仅当两矩形 x 区间相交，`intersectY` 同理，而矩形相交 ⟺ **两个方向都相交**（`intersectX>0 && intersectY>0`）。所以 `!(intersectX>0 && intersectY>0)` 即 `intersectX<=0 || intersectY<=0`，**与「矩形不相交」严格等价**——不存在「斜向重叠被放过」的情形（斜向重叠的矩形必然在两个轴上都有交叠）。

**③ 为何原断言在单列下是假红（不是实现缺陷）**

`EntryListRow.vue:490-493` 在 `@media (max-width:640px)` 把 `.entry-list-row` 改为 `grid-template-columns: 1fr`，`.entry-actions` 落到**第二行**。此时两者共占同一列宽，横向**必然重叠**；原断言只比 `x`，等价于断言「必须横向分离」，在单列布局下**恒假红**。P2 §812 也写明「移动 390×844：`entry-list-row` 改为单列」，即单列是**设计要求**。P2 的 VC-6 原文是「列表右侧动作区不压标题」——单列下无「右侧」，正确语义就是「两块可见区域不相交」。

**判定：修正错误断言。桌面强度实测保留，移动端改用几何上更强（二维而非单维）的判据。**

### 4.4 附带：第 4 处测试改动 `vc05`（rev2 已披露，非隐藏改动）

派发指引的清单只列 3 处，但 `git diff` 显示 `vc05`（`spec.ts:1013-1047`）也被改了：`Math.abs(userBottom - timeBottom) <= 2` → `sameRow || wrappedToOwnRow`，并追加「折行仍不溢出（`scrollWidth <= clientWidth + 1`）」。该改动已在 `P4-implementation.md` rev2-fix「A 的连带回归」与 `P4-progress.md:56` **主动披露**，不算隐瞒。

**实测其判别力**

| 视口 | 卡片元信息行 | `sameRow` | `wrapped` | 走哪条分支 |
|---|---|---|---|---|
| 1280×900 / en-US | 20 张卡 **20 张** = 2~3 行 | 全 `false` | 全 `true` | **全部走 wrapped** |
| 1280×900 / zh-CN | 20 张卡 **9 张** 换行 | 混合 | 混合 | 部分 sameRow |
| 390×844 | 358px 卡，1 行 | `true` | `false` | sameRow |

- 原因（几何事实，非实现错误）：卡宽 280px − padding ⇒ 可用 246px；`@alice` 42.9 + 点 3 + 主显 **207.3** + gap 已超 246px ⇒ en-US 下换行不可避免。原断言 `<=2px` 在 280px 卡下**本就不可满足**（与 bdd25 同类：不可达判据）。
- 但替换后 `wrappedToOwnRow`（`timeBox.y >= userBox.y + userBox.height - 1`）在「时间另起一行」时**只要时间在上方元素之下就通过**，不约束 x 对齐。en-US 桌面 100% 走该分支 ⇒ **该用例在主流环境下判别力低**。

**判定**：属**修正不可满足断言**（原断言几何上不可成立），但**修正得偏松**；不阻塞，登记 **F-11**。低成本改进（约 3 行，P5 或 P7 顺手做）：

```ts
const sameRow = Math.abs(userBox.y + userBox.height - (timeBox.y + timeBox.height)) <= 2
// 折行时改为「与用户名左对齐」（仍是有意义的几何约束，非恒真）
const alignedWhenWrapped =
  Math.abs(timeBox.x - userBox.x) <= 2 &&
  timeBox.x + timeBox.width <= metaRight + 1
expect(sameRow || alignedWhenWrapped, `…`).toBe(true)
```

实测支持该收紧：换行时 time `x=73` 与 `@alice` 组 `x=73` **完全左对齐**，收紧后仍绿、且能在「时间被缩进/错位」时真红。

> **P2/P1 判据瑕疵登记（供 P7）**：VC-5 的原始度量（`<=2px` 基线）在 280px 卡片宽 + 207px 绝对时间下**不可满足**；BDD-25 后半条在有文件 entry 上**不可达**。两者都是 P1/P2 阶段的判据问题，需在 P7 记录并回填（本次不阻塞 P4）。

---

## 5. 六项检查清单复核（上轮结论是否仍成立）

### 5.1 AI Slop —— ✅ 仍通过

4 个新建文件 `grep -nE "#[0-9a-fA-F]{3,6}|6366f1|8b5cf6|violet|linear-gradient"` → **rc=1（零命中）**。文案仍为具体名词（`Public`/`Private`/`Team`/`此 entry 无文件`）。Explore 保持 1–4 列响应式网格（1280px 实测 4 列，280px minmax）；详情头部左对齐 + `flex-wrap`。卡片保留差异化（团队徽标 / 归档透明度 / 星标豁免 / 过期徽标）。
`TimeDisplay.vue:41` 的 `box-shadow: 0 4px 16px rgba(0,0,0,0.16)` 与 `border-radius:6px` 仍是字面值，但逐字复刻既有 `.tooltip` / `OverflowMenuDropdown` 值，**属对齐先例，不扣**。

### 5.2 Typography —— ✅ 通过（F-6 沿用上轮建议，本轮未要求修）

| 检查 | 结论 |
|---|---|
| 字号层级 | `TimeDisplay` 主显继承上下文（卡片/列表 13px mono、详情 12px）✅；菜单项 `--font-sm`(14px)、sheet 标题 `--font-md`(16px)、tooltip `--font-xs`(12px) —— 与 `DESIGN.md` §3（Body 14 / Caption 13 / Meta 12）一致 ✅ |
| 行高 / 字间距 | 未新增 `line-height`/`letter-spacing`，全部继承 ✅ |
| 移动端最小 16px | 菜单项 14px 与 `DESIGN.md` §3 Body 及既有 `OverflowMenuSheet` 一致；本任务未引入更小字号、未新增输入框（16px 规则原意为防 iOS 聚焦缩放）⇒ **符合项目既有约定，不计缺陷** |
| **F-10（建议·新）** | 卡片元信息行换行后**分隔点悬空**（详见 §7） |

### 5.3 Spacing —— ✅ 移动端 44px 达标（实测量化）

| 检查 | 结论 |
|---|---|
| 间距 scale | 新增样式主体走 `var(--space-*)` ✅。字面值仅 `.visibility-toggle{padding:2px 6px}`（复刻 `status-tag`）、`.visibility-sheet-close{32×32}`（复刻 `sheet-close-btn`）、`.visibility-item{min-height:36px;padding:8px 12px}`（复刻 `.overflow-item`）—— **对齐既有先例，不扣** |
| **移动端 44px（VC-4）** | ✅ **实测 390×844：新增 `visibility-toggle` = 44×44**；同卡既有删除按钮 = 28×28（**不在本任务范围，不判缺陷**）。`:422-427` 的媒体查询只作用于 `.visibility-toggle`，未写到 `.card-action-btn` / `.action-btn` 上 ✅ |
| sheet 项触达 | `.visibility-panel--sheet .visibility-item{min-height:48px}` ✅ |
| **F-5（上轮建议·未修）** | icon 变体触发按钮实测 **16×28**（相邻删除按钮 28×28），宽度差 12px，右上角不齐。**维持建议级**（非本轮修复范围、不影响可用性） |

### 5.4 交互状态 —— ✅ 四态齐（F-2 已修）

| 态 | 实现 | 结论 |
|---|---|---|
| hover | `.visibility-toggle:hover` / `.visibility-item:hover` / `.visibility-sheet-close:hover` | ✅ |
| focus | `:focus-visible` ×3 + **新增** `.entry-card:focus-within` / `.entry-list-row:focus-within` | ✅ **F-2 已闭合（实测 0→1）** |
| active | 无独立 active 态 | ✅ 不扣：既有 `.icon-btn`/`.overflow-trigger` 亦无，`DESIGN.md` 未要求；点击即关菜单，active 不可感知 |
| disabled | `.visibility-toggle:disabled` / `.visibility-item:disabled`（`opacity:.5` + `not-allowed`）+ `aria-disabled` | ✅ 与 P2「沿用既有 `.icon-btn:disabled`」一致 |
| `outline: none` 有替代 | 新增代码**零处** `outline: none` / `outline: 0` | ✅ |
| loading / error / empty | loading：骨架态实测 6 行 `.skeleton-row` 正常渲染、角落无背景泄漏 ✅；error：失败整体 rollback + toast ✅；empty：`empty-no-files` / `empty-select-file` 两分支保留（后者不可达，见 T-1）✅ | ✅ 四态齐 |

### 5.5 可访问性 —— ✅ 全项到位

`aria-label`（`:aria-label="\`Visibility: ${statusLabel}\`"`，三态源自纯函数 `visibilityStatusLabel`）✅；`aria-haspopup` ✅；`aria-expanded`（触发按钮 + Team 子菜单项）✅；`role="tooltip"` 字面在 `TimeDisplay.vue:4` 且 `data-testid` 由组件自持 ✅；Escape 两级关闭（先子菜单后整菜单）✅；**焦点回归（BDD-30）** `close()` 内 `triggerRef.value?.focus()` + 二次确认取消路径 `nextTick(...)` ✅；`Tab` 关闭 ✅；外部点击关闭（`onMounted`/`onUnmounted` 成对增删监听）✅；无 `outline:none` ✅；全 `<button type="button">` 无 `div role="button"` ✅；无 transition/animation ⇒ `prefers-reduced-motion` 无违反面 ✅。方向键导航 / 完整 ARIA 菜单角色树按 P1 §9 显式排除（留 roadmap），不计缺陷。
**焦点环路径已实证可见**（§3.2），这是本轮相对上轮的关键变化。

### 5.6 视觉契约（VC-1~VC-8）—— ✅ 代码侧与 E2E 侧均通

| # | 契约 | 复核结论 |
|---|---|---|
| VC-1 | tooltip 不横向溢出 viewport | ✅ 且**不再掩盖问题**（F-3 已修，文本在框内；1280 与 390 双档均不越 viewport） |
| VC-2 | 菜单不遮挡触发按钮 | ✅ 详情桌面 `menuTop 96 >= trigBottom 92`；390 sheet 走底部浮层 |
| VC-3 | 卡片元信息行不溢出 | ✅ 1280 下 20/20 卡 `scrollWidth <= clientWidth+1`；390 下 358px 卡 1 行不溢出 |
| VC-4 | **新增**触发按钮移动端 ≥44px | ✅ 实测 44×44；`test.skip(!isMobile, 'VC-4 只断言移动端…既有 28×28 不断言')` 口径正确 |
| VC-5 | 时间与 @username 基线对齐 | ⚠️ 见 §4.4（F-11）：原判据在 280px 卡宽下不可满足，现判据偏松但非恒真 |
| VC-6 | 列表右侧动作区不压标题 | ✅ §4.3 实测：桌面原断言执行且成立，移动二维不相交 |
| VC-7 | 详情 `meta-row` 高度 ≤ 2 行 | ✅ 实测 1280 下 `meta-row` = **26px**，`lineHeight 18px` → `26 <= 18*2+1=37` ✅ |
| **VC-8（本轮新增）** | 列表末行浮层不被容器/视口裁剪 | ✅ `spec.ts:1118-1180`：① 裁剪祖先为空断言 ② 滚到底后浮层在视口内 ③ 逐项 `elementFromPoint` 命中自身。**实测通过**，且我独立复现了①②③ 与反向对照（§3.1） |

---

## 6. `[DESIGN_GAP]` 复核（现 13 条；上轮「12 条」的差异已消解）

> `P4-implementation.md` 现 **13 条**：前端 **11 条**（frontend-shared 4 + mount-explore 3 + mount-detail 3 + rev1-fix 1）+ docs 2 条。本评审范围 = 前端 11 条；docs 2 条（版本号写作、`####` 四级标题）属文档域，不在 design-review 范围。

| # | DESIGN_GAP | 本轮判定 | 说明 |
|---|---|---|---|
| 1 | `useRelativeTime.update()` setup 内同步调用 | ✅ 可接受 | 全量 vitest **0 failed 且 `Errors`/`unhandled` 零命中**，stderr 的 Vue 无实例告警不影响断言 |
| 2 | `VisibilityMenu.item` 用窄类型 `VisibilityItem` | ✅ 可接受 | 同时满足 P2「Team 入口不带 onSelect」与 P3「`JSON.stringify` 不含 `teamSlug`」 |
| **3** | Teleport 只对 sheet 启用；icon/inline 裁剪由父容器解除 | ✅ **已闭合（F-7）** | 记述已改为与代码一致（`P4-implementation.md:123`）；且**行为侧已有实证**（§3.1）与回归用例 `vc08` |
| 4 | `store-team.spec` 首用例改名 | ✅ 可接受 | 规避名实不符，文件头已登记 |
| 5 | `changeVisibility` 载荷带 `entry` | ✅ 可接受 | 免父层按 slug 反查，避免与列表刷新竞态 |
| 6 | `isVisibilityPending(slug)` 容错读 `inFlight` | ✅ 可接受 | 既有视图 spec 的 store mock 缺键；容错不新增行为分支 |
| 7 | `teamsFailed` 由 `team.error !== null` 派生 + 失败后每次重试 | ⚠️ 接受但需跟踪 | `stores/team.ts` catch 只置 `error` 不置 `teamsLoaded`（既有行为）。**P6 若观察到请求风暴另立条目**，不由本评审阻塞 |
| 8 | 详情页 `storeToRefs` 加 `?? []` / `?? null` / `?? false` | ✅ 可接受 | 与 `EntryListView.vue:308-315` 同仓先例一致 |
| 9 | Header / MetaTagsBar 新 prop 全给默认值 | ✅ 可接受 | `T079-entry-detail-header.spec.ts` 直传旧 props；生产路径显式下发不依赖默认值 |
| 10 | `EntryMetaTagsBar` 未接 `@confirm-cancel` | ✅ 可接受 | 取消后的重开 + 还焦点由 `VisibilityMenu.vue:216-221` 自身完成；emit 保留且有 P3 spec 覆盖 |
| **11（新）** | F-1 采备选②而非① | ✅ **可接受** | VTU 2.4.10 `wrapper.find` 不穿透 Teleport（我独立复验成立，§3.1）；② 的视觉代价实测为零；缺陷本体已消除 + `vc08` 兜底 |

**小结**：11 条前端 `[DESIGN_GAP]` **全部可接受**（上轮唯一的不可接受项第 3 条已闭合）。

---

## 7. 建议项（本轮**不阻塞**，不要求 P4 修）

### F-10 [VISUAL] 卡片元信息行换行后分隔点悬空

- 文件：`EntryCard.vue:27-37`（模板：`.meta-group` 内首/尾各一个 `.meta-dot`）+ `:301-310`（`.card-meta-text{flex-wrap: wrap}`）
- 现象（1280×900，en-US，20 张卡中 20 张）：元信息被切成 3 行，且**行首/行尾各挂一个孤立点**：

  ```
  @alice ·
  11/11/2026, 01:26:12 AM GMT+8
  · 3 files
  ```

  zh-CN 下 9/20 张卡出现同类现象（`@alice · 2026/11/11 GMT+8 01:26:12` / `· 3 files`）。截图已确认（`.agate-tmp/grid-1280.png`、`card-single.png`，随收尾清理）。
- 成因：分隔点被放进 `.meta-group` 内部，换行时点随组一起走 ⇒ 组落到新行时点成为**行首**；上一行的组尾点成为**行尾**。
- 性质：**纯视觉瑕疵，不影响可读性与交互**；是 rev2 修 A（VC-3 溢出）时的连带产物，且根因包含 P2 的设计决定（卡片主显完整绝对时间 = 207px，与 246px 可用宽几乎吃满）。
- **Fix（任选，约 2~5 行）**：
  1. 让「文件数」组不带点、把点作为**时间元素的后缀**（`<span class="meta-dot">` 移到 `TimeDisplay` 之后、同一 nowrap 组内）——换行时点跟时间走；
  2. 或 `@media` 内对 `flex-wrap: wrap` 场景弃用点分隔，改 `column-gap: var(--space-2); row-gap: 2px`（视觉分离靠间距）；
  3. 或（更彻底，属 P2 层面）卡片主显改用更短格式（如 `11/11 01:26`）——超出本任务范围，建议 P7/P8 记 DEBT。
- **不阻塞理由**：不影响信息可达、不违反任何 P1 BDD、VC-3 的机械断言仍绿。

### F-11 [TEST] vc05 的 `wrappedToOwnRow` 偏松（详见 §4.4）

- 文件：`e2e/tpv0102-explore-card-list-ux.spec.ts:1033-1038`
- 现状：en-US 桌面 20/20 卡走 `wrapped` 分支 ⇒ 主流环境下几乎不检查任何几何约束。
- **Fix**：折行分支改为「与用户名左对齐 + 不越右边界」（实测收紧后仍绿，见 §4.4 代码片段）。
- **不阻塞理由**：原判据在 280px 卡宽下不可满足（不可达判据，同 bdd25 性质），现判据仍能捕获「时间跑到用户名上方 / 错位缩进」类回归；根治需回到 P2 的 VC-5 措辞。

### F-11a [TEST] bdd25 的「两文案可区分」依赖复制常量（详见 §4.1）

- 文件：`e2e/…spec.ts:53`（`EMPTY_SELECT_FILE_TEXT` 常量）vs `EntryDetailContent.vue:73`
- **Fix**：补一条 `EntryDetailContent` 单测（`activeFile: null` + `currentEntry.files.length > 0`），断言渲染出 `empty-select-file` 且文本 ≠ `empty-no-files` 文本。约 10 行。

### F-12 [INTERACTION] 详情页 `.entry-detail{overflow:hidden}` 是 `inline` 变体浮层的潜在裁剪祖先

- 文件：`frontend-v3/src/styles/layout.css:2-7`
- 事实：修复 F-1 时 `.entry-panel` 的 `overflow:hidden` 被移除，但**详情页仍有** `.entry-detail{height:100dvh; overflow:hidden}`；`inline` 变体（桌面详情 `meta-row`）不 Teleport ⇒ 该容器仍是裁剪祖先（实测：`clippers = ["entry-detail:hidden"]`）。
- **当前无缺陷**：1280×900 实测浮层 `top 96 / bottom 214`，三项 `elementFromPoint` 全命中，`menuBelowTrigger=true`，视口内。
- 风险场景：若后续把菜单放入可滚动子容器或窗口高度极小（< 300px）时，浮层底部可能被 `.entry-detail` 裁掉。
- **建议（不阻塞）**：P6 在 1280×600 或 1024×768 补一次目视确认；若出现裁剪，按 F-1 同法处置（父容器解除或改 Teleport）。

### 沿用上轮的建议（本轮未要求修，维持原判）

- **F-5**：icon 变体触发按钮实测 16×28，与相邻 28×28 不齐（建议补 `width:28px`）。
- **F-6**：详情 `inline` 变体 14px 落在 12px 的 `.meta-row` 里，为该行最大字号（P2 例外声明要求沿用 `status-tag` 的 `10px / 1px 6px`）。
- **F-8**：`EntryDetailView.vue` **289 行**（余量 11，`t082` 门槛 `<300`），本任务净增编排逻辑方向与拆分目标相反 → **建议 P7/P8 建 TECH-DEBT**（下沉出口 `useEntryDetailComputed` / `useEntryDetailActions` 已存在）。
- **F-9**：sheet 内中英混排（标题「可见性」+ 项 `Public`/`Private`/`Team` + 「团队列表加载失败」）；项目无 i18n、既有组件同样硬编码中文 ⇒ 不计缺陷。

---

## 8. 门槛自检

| 项 | 结果 |
|---|---|
| 本文件存在且非空 | ✅ |
| frontmatter `status` / `agent=design-review` | ✅ `status: approved`、`agent: design-review` |
| F-1~F-4 逐条「已闭合 + 证据」 | ✅ §3.1 / §3.2 / §3.3 / §3.4（均含实测数据与反向对照） |
| **3 处测试改动逐条明确判定** | ✅ §4.1 bdd25 = 修正（附 F-11a）／§4.2 bdd04 = 修正且净增强／§4.3 vc06 = 修正且桌面强度实测保留；另附第 4 处 vc05 的独立判定（§4.4） |
| 6 项检查清单逐项有结论 | ✅ §5.1 AI Slop / §5.2 Typography / §5.3 Spacing / §5.4 交互状态 / §5.5 可访问性 / §5.6 视觉契约 |
| 实跑 E2E | ✅ **61 passed / 3 skipped / 0 failed**（两次复跑一致，39.5s / 41.7s） |
| 实跑 vitest 全量 + `Errors` 行检查 | ✅ **119 files / 1456 passed / 4 skipped / 0 failed**；`Errors`/`unhandled`/`Vitest caught` **零命中** |
| 实跑 typecheck / lint | ✅ 均 exit 0 |
| `EntryDetailView.vue` 未被本轮改动 | ✅ 仍 **289** 行 |
| `[DESIGN_GAP]` 全部评估且 #3 已闭合 | ✅ §6（11 条前端全部可接受） |
| 结论与返回摘要 status 一致 | ✅ 均为 `approved` |
| 每条问题给「文件:行号 + Fix」 | ✅ F-10/F-11/F-11a/F-12 及沿用项均含定位与 Fix |
| **禁令①（不写「对比度已满足 AA」）** | ✅ 全文零处；文件头显式声明 `--c-text-tertiary` 实测 3.84:1 / 3.04:1 **低于 AA 4.5:1** |
| **禁令②（不把既有 28×28 判为缺陷）** | ✅ 全文零处；F-5 只说「新增 icon 触发按钮 16px **与** 28px 删除按钮不齐」，未要求改既有 28px；§5.3 明确标注既有 28×28 不在范围 |
| 只读纪律 | ✅ 未运行任何写类 agate 工具（`agate-inject-card` / `agate-md-field-set` / `agate-state-set` / `agate-task-init` 一律未用）；未执行任何破坏性 git 命令；未编辑/删除被评审文件 |
| scratch 纪律 | ✅ 探针脚本只落 `.agate-tmp/`（已 gitignore），**收尾已全部删除**；`frontend-v3/` 下的临时探针目录用完即删，`find frontend-v3 -name "*probe*"` 零命中 |
| `git status --porcelain` 与开跑前一致 | ✅ 仅多出 `P4-review-design.md` / `P4-review-design-progress.md`（本角色的允许写入物）；代码区与开跑前基线的 40 项完全相同（35 M + 5 新文件），**零新增改动** |
| 环境隔离 | ✅ **[PROD_NOT_TOUCHED]** —— 全程未访问/写入 `~/.peekview/`、未连 `:8080`（探活得 `000`），只连 `:8888` debug 实例 |
| 遗留进程说明 | ⚠️ `make debug-stop` 报「服务已停止」但 `:8888` 仍在监听（该进程在我的 PID namespace 之外，`/proc` 仅可见 5 个 PID，无法定位/终止）。**已 kill 我起的托底后台 job**，残留监听需主 Agent 复核处置 |

---

## 9. 转 P7 的记录清单（非缺陷，供一致性检查回填）

1. **P1 BDD-25 后半条在产品路径上不可测**（`empty-select-file` 对有文件 entry 不可达）——判据瑕疵，建议 P7 回填 P1 或转「文案不变式由单测保护」。
2. **P2 VC-5 的度量在 280px 卡片宽下不可满足**（`@alice` + 207px 绝对时间 > 246px 可用宽）——建议 P7 修订 VC-5 措辞为「同一视觉行内基线对齐；折行时左对齐」。
3. **F-10 卡片元信息换行时分隔点悬空** —— 若不在 P5 顺手修，建 DEBT 条目（根因含 P2 的「卡片主显完整绝对时间」决定）。
4. **F-8 `EntryDetailView.vue` 289 行余量 11** —— 建议 TECH-DEBT（下沉出口已存在）。
5. **F-11a bdd25 文案不变式依赖复制常量** —— 建议补 `EntryDetailContent` 单测。
6. **F-12 `.entry-detail{overflow:hidden}` 潜在裁剪祖先** —— P6 建议加小视口目视确认。
7. **上轮记录的 `[DESIGN_GAP]` 计数差异已消解**：现为 13 条（前端 11 + docs 2），其中第 3 条已闭合。
