# P4 review-design 进度（design-review 子 Agent）

## [1] 输入与基线（完成）
- 已读：角色定义 design-review.md、P4-dispatch-context-design-review.md（含 AGATE_CARD）、DESIGN.md §3/§4/§6/§7/§9/§10/§12、P2-design.md §3.4/§3.5/§3.6/UI 设计节、P2-review.md（C-1~C-23，含 P6 两条禁令）、P4-implementation.md（5 节全部）、P1 BDD-01/02/03/22/23/25/30
- 基线：HEAD 20fd76b3；`git status --porcelain` 44 项已存快照至 `.agate-tmp/GIT_BASELINE.txt`

## [2] 实跑验证（完成，全部通过）
- `npx vitest run` → **119 files / 1456 passed / 0 failed / 4 skipped**，exit 0
- **`Errors` 行检查：无**（`grep -n "^ *Errors"` 零命中；`unhandled` 0 命中；`Vitest caught` 0 命中）→ 主 Agent 修的 `EntryDetailView.vue:219` 残留已确认清零（全量日志落 `.agate-tmp/vitest-full.log`）
- `make typecheck` → ✓ type check passed（exit 0）
- `make lint` → All checks passed（ruff，exit 0）

## [3] 4 个新建文件逐行审查（完成）
- `TimeDisplay.vue`(57 行)：`data-testid` 根+tooltip 字面存在、`role="tooltip"`、`visibility` 隐藏（非 opacity）、`z-index:10`、移动端右对齐+换行、`pointer-events:none` —— **P2 §3.4 六条实现约束全中**
  - ⚠️ 发现：`.time-display__tip` 桌面 `white-space: nowrap` + `max-width:320px`，按 en-US 实测文本（`3d ago · 11/10/2026, 05:43:00 PM GMT+08:00 · Asia/Shanghai` ≈57 字符，font-family 继承 `.card-meta-text` 的 mono，12px ≈410px）→ **文本溢出自身背景框 ~90px**（无 overflow 裁剪）。P2 警告的"断言绿而体验红"在此以另一形态复现
- `VisibilityMenu.vue`(428 行)：a11y 齐全（`aria-label` 三态源 `visibilityStatusLabel` / `aria-haspopup` / `aria-expanded` / 子菜单项也有 haspopup+expanded / Escape 先关子菜单再关菜单 / `close()` 内 `triggerRef.focus()` / 三处 `:focus-visible` 2px accent）；移动端 44×44 媒体查询只作用 `.visibility-toggle` ✅（未污染既有 28px 类）
  - ⚠️ `.visibility-toggle--icon{padding:0}` → 桌面触发按钮**宽仅 16px**（高被 flex stretch 撑到 28px），与右侧 28×28 删除按钮宽度不一致；P2 组件一致性表第 2 行明写「icon 变体复用 28×28 视觉规格」
  - ⚠️ inline 变体未沿用 `status-tag` 的 `font-size:10px; padding:1px 6px` + 背景 chip（P2 明写"为保持替换前后视觉权重不变而刻意沿用"）；现为 14px 纯文本按钮，且比所在 `.meta-row`(12px) 更大，破坏该行字号层级
  - ⚠️ `Teleport :disabled="variant !== 'sheet'"` → icon/inline **不** Teleport；列表模式最后一行 dropdown 可能被 `.entry-panel{overflow:hidden}` 裁剪；grid 下 `.card-actions{z-index:1}` 无 open 态抬升，dropdown 可能被下一行卡片（同为 position:relative）覆盖
- `visibility-options.ts` / `visibility-target.ts`：`currentTeamSlug` 派生、`t.slug !==` 比对、无 `Team.id`；`toPatchPayload` public/private 两字段同传、team 只传 `team_id`；`needsConfirm` 仅 public —— 与 P2 §3.5 逐条一致
- 4 个新文件**零紫色/violet/渐变/硬编码 hex**（grep `#[0-9a-f]|6366f1|8b5cf6|linear-gradient` → rc=1）→ AI Slop 检查通过

## [4] 9 个改动文件 diff 审查（完成）
- `EntryCard.vue`/`EntryListRow.vue`：空占位 span 与 `.card-action-btn--team-hint` 已删净；`>=2` 分支固定 `files`；两处补 `:focus-visible`
  - ⚠️ `@media (hover:hover)` 下 `.card-actions`/`.entry-actions{opacity:0}` 仅有 `:hover` 揭示，**无 `:focus-within`** → 新补的 focus 环在桌面键盘导航时**不可见**（P2 布局 checklist 声称"键盘用户由 :focus-within 保证可达"，代码未落）
- `EntryDetailHeader.vue`/`EntryMetaTagsBar.vue`：`.status-tag` 三态样式与模板已原位移除，仅剩 Archived/Expired；`data-testid="visibility-toggle"` 定位可用
- `EntryDetailContent.vue`：`empty-no-files` / `empty-select-file` 两分支互斥 ✅
- `useEntryDetailActions.ts`：`Make Public/Private` 与 `Currently *` 全删；四态 toast 齐全（含 revokedShares warning）；`visibilityDisabled` 派生
- `EntryListView.vue`：`resize` add/remove 成对；`isVisibilityPending` 容错；四态 toast 在视图层（store 内无 toast ✅ C-7）
- `useRelativeTime.ts`：`FULL_DATE_OPTIONS` 逐字段（无 dateStyle 共存）、`shortOffset`/`longOffset`、无效→`''`/`—`/`Invalid date`、未来→`in N…`
- `EntryDetailView.vue`：**289 行**（`t082` 门槛 <300，余量 11 行）→ 可维护性风险成立，非本次阻塞

## [5] 断言取代抽查（完成，结论：覆盖点未丢）
- `t031-entry-card.spec.ts` / `t031-entry-list-row.spec.ts`：改为「开菜单再点项」且断言 `target.kind`，**并保留 `expect(pushMock).not.toHaveBeenCalled()`**；文件头注释登记取代来源 ✅
- `tpv0095-entry-card-team.spec.ts` / `-list-row-team`：用例改名 + 断言翻转，且 `toBeGreaterThanOrEqual(0)`/`toBeGreaterThan(0)` 这类**恒真/弱断言被收紧**为 `toHaveLength(1)` ✅
- `tpv0095-entry-list-store-team.spec.ts`：改名 + 改 mock 目标为 `updateEntry`，顶部注释登记 ✅
- `filter-tabs.test.ts` / `expired-warning.test.ts`：`title` → 主显文本 + tooltip 文本双断言（覆盖点扩了不是缩了）+ mock 补 `absolute` ✅
- `e2e/team-visibility.spec.ts`：拆掉 `if (count>0)` 守卫改前置 `toHaveCount(1)` ✅（C-12）
- **未发现"红了就删"**：10 处更新全部是「改定位/翻转值/收紧断言」，无删除覆盖点

## [6] 11 条 DESIGN_GAP 评估（完成）
- 可接受：`useRelativeTime.update()` setup 同步、`VisibilityItem` 窄类型、spec 改名、`changeVisibility` 载荷带 entry、`isVisibilityPending` 容错、可选 prop 默认值、`confirm-cancel` 不上抛
- ⚠️ **DESIGN_GAP 记述与代码相反**：第 3 条称「Teleport 对 icon/inline 也启用」，实测 `VisibilityMenu.vue:22` 为 `:disabled="variant !== 'sheet'"` → icon/inline **未** Teleport。记述失真，且实际行为带裁剪/遮挡风险（见 [3]）
- ⚠️ `teamsFailed` 重试风暴：既有 store 行为，接受，P6 若观察到再立条目

## [7] 主产出落盘（完成）
- `P4-review-design.md` 已写：frontmatter `status: needs-revision` / `agent: design-review`；`check-frontmatter.py` exit 0；字段回读 status=needs-revision、agent=design-review
- **9 项发现 = 4 阻塞 + 5 建议**：
  - F-1[阻塞] icon 变体未 Teleport + `.entry-panel{overflow:hidden}` → 列表最后一行 dropdown 被裁 99/118px（实测仅 17% 可见，elementFromPoint 返回 BODY）
  - F-2[阻塞] `@media(hover:hover)` 只有 `:hover` 无 `:focus-within` → 新补焦点环在桌面键盘路径不可见（P2 UI 设计明写"由 :focus-within 保证可达"）
  - F-3[阻塞] tooltip 桌面 `nowrap`+`max-width:320px` → 文本溢出背景框 63px（实测 Range 383px vs 盒 320px）；VC-1 恒绿抓不到
  - F-4[阻塞] `EntryListRow.spec.ts:105-112` 断言静默失效（选择器已删 + `exists()` 守卫 + 零注释登记）——10 处取代中唯一丢覆盖点者
  - F-5..F-9[建议] icon 触发宽 16px 不齐 28px / inline 变体 14px 破坏 meta-row 12px 层级 / DESIGN_GAP#3 记述与代码相反 / EntryDetailView 289 行余量 11 / sheet 中英混排
- 已验证未构成缺陷：移动端 44px ✅、AI Slop ✅、Team.id ✅、Escape+焦点回归 ✅、既有 28px 不判 ✅、对比度不背书 ✅
- DESIGN_GAP 计数校正：实为 12 条（前端 10 条评完，9 可接受 / 第 3 条不可接受；docs 2 条范围外）
- 断言取代抽查 9 文件：8 合格（含 2 处弱断言**收紧**为精确断言、1 处新增守卫用例），1 不合格（F-4）

## [8] 只读纪律核验（完成）
- scratch 探针 `probe-metarow.html` 已删除；DOM 度量实际走浏览器内存注入（`about:blank`），**未在 `frontend-v3/src/` 建任何文件**
- `git status --porcelain` 与基线 diff：仅新增 4 个任务目录文件（本文件 progress / `P4-review-design.md` / 后端评审 2 个），**代码区零改动**
- [PROD_NOT_TOUCHED]：未触碰 :8080、未访问 ~/.peekview/、未启后端

## [rev1/round2] $(date '+%F %T') 实跑启动 + 基线
- debug 服务 :8888 health=200（make debug-quick 后台 job 托底）
- E2E（E2E_SPEC=tpv0102...spec.ts）已后台启动
- git status 基线：代码区 35 个 M + 4 个新前端文件（?? TimeDisplay.vue 等），任务目录 20 个 ?? —— 与上轮一致，未新增 scratch
- 已核实 bdd25 根因：`stores/entryDetail.ts:49-53` 在 `entry.files.length>0` 时恒置 activeFile=files[0]（含 fileId 找不到时回落 files[0]）⇒ `EntryDetailContent.vue:72` 的 `empty-select-file`(v-else) 对「有文件 entry」不可达
- E2E 实跑完成：**61 passed / 3 skipped / 0 failed**（39.5s，:8888 debug backend，exit 0）—— 含 vc08（rev1 新增的 VC-8 裁剪用例）
- vitest 全量已后台启动
- vitest 全量（重跑并落 .agate-tmp/vitest-rev1.log）：**119 files / 1456 passed / 4 skipped / 0 failed**，exit 0，`Errors`/`unhandled`/`Vitest caught` **零命中**
- `make typecheck` ✓、`make lint` ✓（ruff）
- F-1 实测（1280×900，列表模式 20 行，滚到文档底部，最后一行开菜单）：裁剪祖先 `[]`（无 overflow≠visible）；浮层 bottom 782 > .entry-panel bottom 739（**溢到容器外 43px**）；视口内；Public/Team 两项 elementFromPoint 命中自身。**反向对照**：临时注入 `overflow:hidden` → 可见高 39/82=47%，Team 项命中失败 ⇒ 断言对裁剪敏感
- F-1 圆角核验：panel radius 14px / border 1px；首末行 radius 13px、行 x=57 vs panel x=56（左右各内缩 1px）；末行角部截图干净；skeleton 行透明无圆角但无背景泄漏
- F-2 实测：Tab 聚焦前后 `.card-actions` opacity 0→1；焦点环 `2px solid rgb(9,105,218)`、`:focus-visible`=true
- F-3 实测：`white-space=normal`；盒子 207×64、文本 152×48、右溢出 -47px（文本在框内）
- F-4 实测：`EntryListRow.spec.ts` 15/15 passed（verbose 逐条过），无 `if(exists())` 守卫，断言 `target.kind === 'private'`
- bdd25 根因复核成立（不可达）；bdd04 锚定同 slug 强度等价；vc06 桌面分支实测 gtc="876px 241px"→isTwoColumn=true→原断言仍执行且成立（旧断言会 pass），移动 gtc="308px"→跳过
- 另外发现 vc05 也被放宽（不在本轮 3 处清单内，属 rev2-fix A 的连带）：`sameRow || wrappedToOwnRow`——同线仍有 <=2px 基线约束，跨线时接受
- 新发现 F-10（视觉）：`.card-meta-text` flex-wrap 后分隔点悬空（桌面 1280 每张卡都出现「@alice ·」换行「· 3 files」），截图确认

## [rev1/round2] 收尾
- 复跑 E2E（第 2 次）→ 61 passed / 3 skipped / 0 failed（41.7s）⇒ 无 flaky
- **判定结果**：
  - F-1 已闭合（裁剪祖先 []；浮层越容器 43px 仍可命中；反向对照 47% 可见 + Team 项不可命中；圆角 13 vs 14px 同心、角点像素命中 list-content、截图干净）
  - F-2 已闭合（真 Tab：opacity 0→1，:hover=false 排除假象，反向对照归零）
  - F-3 已闭合（white-space=normal，文本右溢出 -47px）
  - F-4 已闭合（守卫删除，target.kind==='private'，verbose 15/15）
  - F-7 已闭合（DESIGN_GAP #3 记述与代码一致）
  - **T-1 bdd25 = 修正错误断言**（不可达判据，源码+实测双证）+ 软缺口 F-11a（文案常量复制）
  - **T-2 bdd04 = 修正且净增强**（同 slug 锚定；无 flaky；时区口径一字未改；created_at 为 Z 后缀 UTC ISO 实测确认）
  - **T-3 vc06 = 修正，桌面原强度实测在跑**（1280 gtc 两列→isTwoColumn=true→原断言执行且成立；移动 gtc=308px 单列→跳过；二维不相交对轴对齐矩形与「不相交」严格等价）
  - 附带第 4 处 vc05（rev2 已披露）→ 修正不可满足判据但偏松（en-US 桌面 20/20 走 wrapped）⇒ F-11 建议
- 新建议项：F-10（卡片元信息换行分隔点悬空，截图确认）、F-11（vc05 偏松）、F-11a（bdd25 常量）、F-12（.entry-detail overflow:hidden 潜在裁剪祖先，当前无裁剪）
- **status: approved**（4 阻塞全闭合 + 3 处测试改动均判为修正，无一实质降强度到需打回）
- 收尾：探针脚本/PID 已清；frontend-v3 无 scratch；git status 53 项与开跑基线一致（仅本文件 + 本 progress 变更内容）
- ⚠️ 遗留：`:8888` 仍在监听（`make debug-stop` 报成功但服务在 PID namespace 外，无法定位终止）。已 kill 托底后台 job（bash-167cdceae3884416）。需主 Agent 处置。
