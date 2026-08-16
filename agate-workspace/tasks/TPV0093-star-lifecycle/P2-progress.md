# P2 progress — TPV0093 star-lifecycle（architect r2 修订轮）

## 2026-08-16 r2 修订

- [x] 读取 dispatch-context（3 BLOCKER + N1-N7 + 6 design revision + 4 补充建议）
- [x] 读取 P2-review-eng.md（rejected）+ P2-review-design.md（needs-revision）
- [x] 读取上轮 P2-design.md、P1-requirements.md、P0-brief.md
- [x] 代码核实：
  - entry_service.py:341 is_public 前置检查先于 :344-349 archived 分支 → BLOCKER-1 属实
  - database.py:172 FTS_VERSION=2，backfill_fts_content 用 PRAGMA user_version（:538/548）→ BLOCKER-3 属实（复用 user_version 会双向污染）
  - admin_service.py:450-473 delete_user：delete_entry 循环（:462-464）在 session.delete(user)（:472）之前；星标 CASCADE 在 commit 时生效 → 墓碑清扫必须放 user 删除之后
  - update_entry 双 reactivation：expires_in 路径（:588-594）+ status 参数路径（:604-605）→ N2 属实
  - client.ts:43-92 transformListItem/transformEntry → N4（design-4）属实，需补新字段映射
  - EntryDetailMobileBar.vue mobile-bottom-bar + OverflowMenu sheet + data-testid 按钮模式 → 移动端落点确认
  - EntryListView.vue owner-tabs（:20-36）→ Starred tab 加入点确认
- [ ] 修订 P2-design.md（覆盖写回）
- [x] 修订 P2-design.md（覆盖写回）
- [x] 自检：frontmatter 四字段（candidate_count=6/packages/domains/ui_affected）+ dispatch_plan 不变 + BDD 映射更新（P3 新增 13 条链路用例）+ grep 关键修订落盘（短路/BLOCKER-1/2/3/IntegrityError/E2E_SPEC/mobile-star-toggle/transformListItem）

## 2026-08-16 r2 plan-design-review 复核

- [x] 读取 dispatch-context（6 项 design revision + 4 补充建议 + 检查新问题）
- [x] 读取修订后 P2-design.md（r2）+ 上轮 P2-review-design.md（needs-revision）
- [x] 代码核实：
  - EntryDetailHeader.vue：desktop actions-area(:21-50) 有 toggle-btn/aria-pressed/aria-label/toggle-badge 模式；mobile-sticky-header(:3-10) 无 actions 区 → design-1 双落点必要且落点准确
  - EntryDetailMobileBar.vue：mobile-bottom-bar + data-testid 按钮 + toggle-btn/toggle-badge + OverflowMenu sheet(:42) → design-1 落点属实
  - useToast.ts(:13-21) 无 action 能力、Toast.vue 无 action 按钮 → design-3 扩展可行且可选参数零回归合理
  - variables.css:57 --c-error 存在（#ff7b72）→ design-5 语义色 token 属实
  - ConfirmDialog.vue role=alertdialog(:7) + 焦点管理(:45-50) → design-5 复用属实
  - EntryCard.vue:55 footer `isOwner||isExpiredButActive` + :57 archived BaseBadge → design-4（补充建议3）条件扩展与互斥属实
  - EntryListView.vue：setFilter(:340, 两参)/restoreFromURL(:458)/onBeforeRouteUpdate(:486)/emptyStateHeading(:282) 行号精确 → 补充建议4 点名属实
  - client.ts:43-92 transformListItem/transformEntry 现无 star_count/is_starred/countdown 映射 → design-4 必需属实
  - BaseBadge.vue 变体（public/private/shared/archived/expired/disabled/admin+default），private 用 var(--c-error) → "8 变体之一对齐"表述成立
- [x] 结论：6 项 + 4 建议全部闭合，无新增 BLOCKER → approved

## 2026-08-16 r2 plan-eng-review 复核

- [x] 读取 dispatch-context（3 BLOCKER + N1-N7 复核目标）
- [x] 读取修订后 P2-design.md + 上轮 P2-review-eng.md
- [x] 代码核实：
  - entry_service.py:341/344-349（is_public 前置 → 短路修复闭环）；:346-347 显式匿名守卫
  - database.py:172 FTS_VERSION=2 + backfill_fts_content:538/548 user_version + main.py:218 → BLOCKER-3 闭合
  - admin_service.py:450-473 delete_user 顺序 + auth.py:251 delete_self 同路径 → N1
  - entry_service.py:588-594/604-605 update_entry 双路径 → N2
  - entry_service.py:1019-1061 get_entry_with_share 不查 archived → BDD-28 成立
  - database.py:273-294 _setup_indexes 部分唯一索引模式存在；DEFAULT_PRAGMAS foreign_keys=ON
  - client.ts:43-92 transform 映射、EntryCard.vue:55-57 footer/BaseBadge、EntryListView.vue:458/486/282/340、EntryDetailMobileBar 双落点、router.ts:8-46
- [x] 新发现 BLOCKER-4：§4.3 archived 分支伪代码丢 :346-347 显式匿名守卫 → ownerless(owner_id=NULL) archived 匿名可读回归（None != None 短路）→ needs-revision，1 行守卫可修 + P3 补 ownerless 变体用例
- [x] 结论：3 BLOCKER 闭合 + N1-N7 落实确认，新增 BLOCKER-4 → status: needs-revision

## r3 修订（architect，2026-08-16）
- 已读 dispatch-context r3 + P2-review-eng.md r2（BLOCKER-4 建议 + N8/N9）+ P2-design.md r2 + P0-brief + P1-requirements（决策 A-E）
- 代码核实：entry_service.py:341（is_public 检查）+ :344-349（archived 分支显式匿名守卫 `current_user_id is None and not is_admin` → 404）——BLOCKER-4 判定属实（ownerless archived + 匿名 None==None 短路）
- 修订计划：§4.3 archived 分支恢复显式匿名守卫（评审建议形式）+ else 分支收紧 `(current_user_id is None or entry.owner_id != current_user_id)`（N8）+ §7 补两用例（BLOCKER-4/N9）+ §14 完成标志补记 + trace_id r3
- 修订完成：BLOCKER-4（§4.3 匿名守卫，评审建议形式）+ N8（else 分支收紧）+ §7 P3 两用例（BLOCKER-4/N9）+ §14 完成标志锚定 + trace_id→r3；frontmatter 四字段不变、candidate_count=6、dispatch_plan 不变，已 grep 验证落盘
- 自检通过

## 2026-08-16 r3 plan-eng-review 复核

- [x] 读取 dispatch-context（复核目标 4 项）+ P2-design.md r3 + P2-review-eng.md r2（BLOCKER-4/N8/N9）
- [x] 代码核实：entry_service.py:341 is_public 前置 + :344-349 archived 分支 + :346-347 显式匿名守卫 + delete_entry :752-753 ownerless 注释（owner_id=NULL 数据类存在）
- [x] BLOCKER-4 闭合：§4.3 archived 分支恢复显式匿名守卫（`if not is_admin and current_user_id is None: raise NotFoundError`），与评审建议形式一致；不变式文字保持
- [x] N8 落实：else 分支收紧为 `(current_user_id is None or entry.owner_id != current_user_id)`
- [x] P3 用例闭合：§7 补「ownerless archived 匿名 404」（BLOCKER-4）+「转私有后取消星标仍 200」（N9）；§14 完成标志锚定
- [x] 新问题检查：无——匿名恒 404 与现有 :346-347 等价，_has_live_star 无 None 入参风险，BLOCKER-1 短路保留
- [x] 结论：4 项复核目标全闭合，无新增 BLOCKER → status: approved，覆盖写回 P2-review-eng.md
