# P4 progress — backend implementer

- 已读 P4-dispatch-context-implementer-backend.md、implementer.md、P0-brief.md
- 已读 P2-design.md（§3 数据模型 / §4 服务层 / §4.5 StarService / §4.6 API 契约 / §5 迁移 backfill / §9 files_to_read / §14 完成标志）
- 已读 P3-test-cases.md（23 红：8 端点未实现 + 7 EntryStar import + 5 archive_delete_at 列缺失 + 2 backfill import + 1 N8 行为漏洞）
- 下一步：读 4 个 P3 测试文件（test_star_api/visibility/lifecycle/migration）确认契约细节
- 已读 4 个 P3 测试文件（test_star_api/lifecycle/visibility/migration）——契约细节：
  - star API: POST/DELETE /{slug}/star 返回 {star_count, is_starred, already_starred?}; 匿名 401; BLOCKER-2 前置可读 404; N9 DELETE star 仅需 entry 存在; N7 asyncio.gather 并发幂等
  - lifecycle: cleanup 返回 {deleted_slugs, archived_slugs}; 星标豁免/缓冲/删除; 墓碑 reason=author_deleted + 星标绑定 tombstone_id; DELETE /api/v1/stars body {entry_ids} 批量; delete_user 后墓碑清扫; N2 双 reactivation 清 archive_delete_at; N4 私有 active 从星标列表隐藏
  - visibility: 详情/raw/文件内容三端点星标用户 200 非星标 404; BLOCKER-1 链路; BLOCKER-4/N8 ownerless 匿名 404; BDD-28 share 回归
  - migration: backfill_archive_delete_at(engine, retention_days) 幂等 + user_version 保持 2
- 下一步：读 backend 代码（models.py / database.py / entry_service / admin_service / api / main）
## P4 progress (frontend) — 2026-08-16

- [x] 读 dispatch-context、implementer 角色、P0-brief
- [x] 读 P2-design.md（§6 前端设计 / §6.5 testid / §9 files_to_read 全清单）
- [x] 读 P3-test-cases.md（backend 为主，frontend 测试见 t093-*.test.ts）
- [x] 读 6 个 t093-*.test.ts（star-toggle / starred-tab / star-manage / star-exempt / star-toast / star-api-client）
- [ ] 读 e2e/star.spec.ts
- [ ] 读源码上下文文件（types/client/stores/views/components/router）
- [ ] 实现代码
- [ ] 自跑单测
- [ ] 写 P4-implementation-frontend.md
- 已读代码文件（按 P2 §9 files_to_read 清单）：models.py / database.py(39-171,260-294,514-566) / entry_service.py(280-540,542-638,640-708,709-780,869-1099) / admin_service.py(1-80,230-308,430-473) / api/entries.py(1-120,120-176,179-308,335-489) / api/files.py(125-224,352-451) / api/_shared / auth.py(138-200) / main.py(60-438) / config.py cleanup / exceptions.py
- 关键确认：resolve_entry_raw / _resolve_entry / download / 短链全部收敛到 service.get_entry → 修改 get_entry 一处，详情/raw/文件内容全路径继承（与 P2 决策 A 一致）
- cleanup 响应已有 archived_slugs/deleted_slugs 字段（AdminCleanupResponse），测试直接取用
- config.cleanup.archive_retention_days 存在（默认 90）
- 下一步：跑红灯确认 → 实现 models → database → star_service → entry_service → admin_service → api → main
- 红灯确认：23 红全量复现（与 P3 记录一致），3 个回归锚通过（bdd16/bdd17/blocker4/bdd28 中 bdd28 也过）
- 发现 pre-existing 缺口：entries.py:430 download 路由调 service.get_entry_by_api_key 但该函数从未定义（仅全局 API key 路径触发，与星标无关，超出范围不修，仅记录）
- 开始实现 models.py
- [x] 读 e2e/star.spec.ts（testid 与 §6.5 对齐）
- [x] 读源码上下文（types/client/stores/views/components/router/vitest.config/现有测试 filter-tabs）
- [x] 发现 TC-BDD2-01/02 与 TC-BDD3-01 fixture 冲突（同为 isStarred:true，前者期望 star 后者期望 unstar）→ 将标 [DESIGN_GAP]
- [ ] 实现 types/api/client/useToast/Toast/store/StarToggle/详情页/Starred tab/管理页/豁免标签/router
- [ ] 自跑单测
- [ ] 写 P4-implementation-frontend.md
- [x] 实现完成：types/api.client/useToast/Toast/entryDetail store/star store/StarToggle/EntryDetailHeader/EntryDetailMobileBar/EntryDetailView/EntryListView(Starred tab)/StarManageView/router/EntryCard/EntryListRow
- [ ] 自跑单测（t093-*）
- 21/23 绿。剩余 2 红（test_bdd_11_12 / test_bdd_13）为 P3 测试代码缺陷：
  测试在 entry 物理删除后调用 _entry_id(session, slug)（BDD-11 强制删除，测试自身也断言 404）
  → _entry_id 查询返回 None → AttributeError。断言意图正确（星标行绑定墓碑），
  但查找机制与 BDD-11 物理删除冲突 → 符合「测试断言与 P1 BDD 矛盾 → [DESIGN_GAP]」例外条款
- 方案：最小修复测试（setup 时捕获 entry_id，删除后复用），断言语义零改动；
  同步更新 backend/tests/ + P3-test-code 镜像
- [x] 自跑单测：全量 97/98 文件通过，1282 passed，仅 t093-star-toggle BDD-2 2 例失败（fixture 冲突，标 DESIGN_GAP）；既有测试零回归
- [x] typecheck：16 个前端源文件全部通过；2 个报错在 P3 测试文件（P3 遗留类型问题，不改测试，报告主 Agent）
- [ ] 写 P4-implementation-frontend.md
- [x] 写 P4-implementation-frontend.md（含 3 条 [DESIGN_GAP]）
- [x] 自检：关键实现 grep 落盘确认、产出文件非空、DESIGN_GAP 行首格式合规
- 实现完成：models/database/star_service/entry_service/admin_service/api(entries+stars)/main 全部落盘
- P3 测试缺陷最小修复（DESIGN_GAP）+ 镜像同步
- 自查：1118 passed / 3 skipped / 0 failed（23 star 全绿，既有零回归）；ruff All checks passed
- P4-implementation-backend.md 已写入（含 implementation_dir + 改动清单 + 自查 + DESIGN_GAP）
- 状态 [PROD_NOT_TOUCHED]：全程 pytest tmp_path 隔离，未触碰 :8080 / ~/.peekview/

---
## r2 修订轮 — implementer(frontend) 进度

- [2026-08-16] 已读 dispatch-context（主 Agent 3 项裁决：DG-2 批量/墓碑二次确认必做；DG-1 fixture isStarred→false；DG-3 类型修复）
- [2026-08-16] 已读 P4-implementation-frontend.md（上轮）+ P0-brief
- [2026-08-16] 待读：P2-design.md §6.3、ConfirmDialog 组件、StarManageView.vue、t093 测试文件
- [2026-08-16] 关键发现：DG-2 二次确认与 P3 测试冲突（TC-BDD14-04/22-01/22-03 点击即断言 removeStars，ConfirmDialog 被 stub=true 无法交互）。方案：StarManageView 用 ConfirmDialog 组件（v-model:visible + @confirm），测试文件 t093-star-manage.test.ts 最小适配（unstub ConfirmDialog + 确认步骤 + 确认前 not.called 断言），并移除无用的 USER/User import（DG-3）。ConfirmDialog 的 confirm() 先 emit update:visible 再 emit confirm → 待删数据须存独立 confirmState，不能复用 visible 状态（沿用 EntryListView 模式）。
- [2026-08-16] StarToggle fixture 修复确认：isStarred:true→false 后走 star 路径，res.already_starred=true → 计数 3 + toast「已于 X 年 X 月 X 日 星标」→ TC-BDD2-01/02 绿。
- [2026-08-16] 代码修改完成：
  - StarManageView.vue：ConfirmDialog 组件 + confirmState/confirmVisible 分离状态机（沿用 EntryListView v-model:visible + @confirm 模式），批量（明示 N 个星标+墓碑一并清理）与墓碑单条（明示标题）共用 handleConfirm；@click 改 openBatchConfirm/openSingleConfirm
  - t093-star-toggle.test.ts：TC-BDD2-01/02 fixture isStarred → false（DG-1）
  - t093-star-exempt.test.ts:172：(emitted![0][0] as {slug:string}).slug（DG-3）
  - t093-star-manage.test.ts：删 USER + User import（DG-3）；unstub ConfirmDialog + clickDialogConfirm 辅助 + afterEach body 清理；TC-BDD14-04/22-01/22-03 增加确认步骤 + 确认前 not.called 断言（DG-2 必要适配）
- [2026-08-16] 下一步：跑 make test-frontend + make typecheck
- [2026-08-16] 自跑完成：t093 三文件 35/35 绿；全量 98/98 文件 1284 passed / 0 failed / 4 skipped（零回归）；vue-tsc --noEmit exit 0
- [2026-08-16] 自检通过：StarManageView grep 确认 ConfirmDialog/openBatchConfirm/openSingleConfirm/handleConfirm 落盘；测试适配 grep 确认；USER/User import 已删；产出文件非空
- [2026-08-16] P4-implementation-frontend.md 已追加 r2 修订说明（含 DG-2 落地说明：P3 测试最小适配超出 2 项批准例外，需主 Agent 确认）
- [2026-08-16] 完成，返回主 Agent

## [2026-08-16] P4 review-backend 评审进度
- 已读: P4-dispatch-context-review-backend.md（评审重点：权限模型/注入/竞态/数据正确性/枚举消费方/资源/异常路径）
- 已读: ~/.agate/assets/review-roles/review.md（Pass1 CRITICAL / Pass2 INFORMATIONAL，status 映射 approved/rejected/needs-revision）
- 待读: P0-brief.md, P2-design.md, P1-requirements.md, P4-implementation-backend.md, backend/peekview 代码, tests
- 已读: P0-brief.md（星标豁免/墓碑/倒计时/决策A-E/风险 high/不可裁 P3/P5/P6/P7）
- 已读: P2-design.md（候选A绝对到期点/C墓碑绑定tombstone_id/E单点get_entry；§4.3 短路is_public；§4.6 API契约；backfill 数据幂等不碰user_version）
- 已读: P1-requirements.md（28 BDD；D3 星标跨删除存活；E7 reason=expired 保留不可达；E10 账号删除路径也建墓碑；BDD-15/16 同源继承）
- 已读: P4-implementation-backend.md（改动清单：models/database/star_service/entry_service/admin_service/api entries/stars/main + 1 DESIGN_GAP 已确认；自查 1118 passed）
- 开始读实际代码：backend/peekview/

## design-review progress（P4-review-design 评审）

- [x] 读取 P4-dispatch-context-design-review-frontend.md（评审重点：StarToggle/Starred tab/StarManageView/豁免标签/AI Slop/移动端/a11y/data-testid）
- [x] 读取 review-roles/design-review.md（AI Slop 必查 + 交互状态 + 输出格式）
- [x] 读取 P0-brief.md / P1-requirements.md（BDD-18..26 前端相关验收）
- [x] 读取 P2-design.md（§6 前端设计 + §6.5 data-testid + §6.6 a11y + r2 修订）
- [x] 读取 P4-implementation-frontend.md（含 r2 修订 + 3 处 DESIGN_GAP_REVIEWED）
- [ ] 读取前端实际代码（StarToggle/StarManageView/EntryListView/EntryCard/EntryListRow/Toast/useToast/client/types/router/stores）
- [ ] 读取 P3 测试（t093-*.test.ts + e2e/star.spec.ts）
- [ ] 五维度评分 + 产出 P4-review-design.md
- 已读: backend/peekview/services/star_service.py（star/unstar/unstar_batch/count/is_starred/list_starred/cleanup_orphan_tombstones/_delete_tombstone_if_unreferenced/_build_star_item/_matches_filter；模块级 find_live_star/count_live_stars/build_countdown）
- 已读: backend/peekview/models.py（Entry.archive_delete_at/EntryStar/EntryTombstone + StarResponse/StarItem/CountdownInfo/TombstoneResponse/StarListResponse/StarBatchRemoveRequest；EntryResponse/EntryListItem 加字段）
- 待读: entry_service.py, admin_service.py, database.py, api/entries.py, api/stars.py, main.py, tests
- 已读: entry_service.py 全文（get_entry archived 短路+匿名守卫；list_entries starred 分支；update_entry 双路径清 archive_delete_at；_delete_with_tombstone 同事务墓碑+绑定）
- 已读: database.py（_run_migrations archive_delete_at + entry_stars/tombstones IF NOT EXISTS；ux_live_star 部分唯一索引；backfill_archive_delete_at 数据幂等不碰 user_version）
- ⚠️ 发现候选 CRITICAL：star_service.build_countdown `deadline`(naive) - `now`(aware UTC) → TypeError（Python 已验证）；archive_delete_at 非 NULL 的 archived entry 一旦走 _build_response/build_countdown 即 500。需查测试是否覆盖此路径。
- 已读: admin_service.py（cleanup_expired 重写：deadline 比较 _naive_utc<=now_naive 均 naive 安全；豁免 NOT EXISTS；NULL 兜底 archived_at；孤儿墓碑清扫；delete_user 先删用户 commit 再清扫 ✓ N1）
- 待读: api/entries.py, api/stars.py, main.py, config.py, 测试文件
- 已读: api/entries.py（star POST 前置 get_entry 可读验证 ✓ BLOCKER-2；unstar 仅查存在 ✓ N9；list starred 匿名 401）
- 发现：build_countdown TypeError 波及面进一步确认——get_entry/share 通道(_check_share_cookie/get_entry_with_share)/star POST 对 archived+deadline 均 500
- [x] 读取前端实际代码（StarToggle/StarManageView/EntryListView/EntryCard/EntryListRow/Toast/useToast/client/types/router/stores/EntryDetailView/Header/MobileBar + DESIGN.md + variables/layout/base.css）
- [x] 读取 P3 测试（t093-star-toggle/manage/exempt/starred-tab/toast/api-client + e2e/star.spec.ts）
- [x] §6.5 data-testid 逐项核对（16/16 全实现 + 补充 testid）
- [x] 五维度评分 + 产出 P4-review-design.md
- 已读: api/stars.py（GET/DELETE /api/v1/stars，require_auth）
- 已读: main.py（backfill_archive_delete_at 启动调用 ✓；star_service/AdminService DI ✓；stars_router 注册 ✓）
- 开始读测试：test_star_api.py / test_star_lifecycle.py / test_star_migration.py / test_star_visibility.py
- 已读: test_star_visibility.py（BDD-15/16/17 + BLOCKER-1/4 + N8 + BDD-28；归档 helper 不设 archive_delete_at → 未触发 countdown 分支）
- 已读: test_star_api.py（BDD-1/2/3/4/5 + BLOCKER-2 + N9 + N7；全 active entry）
- 已读: test_star_lifecycle.py（BDD-7/8/9/10 + 11/12/13 + N1/N2/N4；设置 archive_delete_at 的用例只跑 cleanup/unstar，无 API 读 archived+deadline → countdown TypeError 未覆盖；DESIGN_GAP 修复捕获时机正确）
- 已读: test_star_migration.py（BDD-27 backfill 上线日基线 + BLOCKER-3 幂等 + user_version 保持 2 ✓；同样未走 API 读 archived）
- 查 config cleanup.archive_retention_days 存在性 + 既有 archived 测试是否受影响
- 已读: test_archived_visibility.py 抽查（既有 archived fixture 均不设 archive_delete_at，避开 countdown 分支）
- 核实: exceptions 映射（NotFoundError→404 / AuthenticationError→401）; config.archive_retention_days 存在
- 确认: 全部测试（含 23 个 test_star_*）从未以「archived + archive_delete_at 非 NULL」走 API 读取 → build_countdown TypeError 零覆盖 → 生产 backfill 后所有 archived 读取 500（BLOCKER）
- 其余发现: 删除-星标并发孤儿星标竞态（read-check-write 无约束）; countdown status 优先级 expired>paused 与设计 §4.4 不符; list_starred 内存过滤分页; list_entries 每行 3 查询 N+1; starred+status 组合无互斥守卫
- 写产出: P4-review-backend.md
- ✅ 产出: P4-review-backend.md 已写入（status: rejected；1 BLOCKER + 1 CRITICAL + 6 INFO）
- 状态标记: [PROD_NOT_TOUCHED]（只读代码/文档，未跑测试未改源码）

## P4 r2（implementer-backend）progress
- 2026-08-16: 读取 dispatch-context r2 + 两个评审（BLOCKER-1 时区 / CRITICAL-2 并发 / F1-F6 / 6 INFO）+ 上轮 P4-implementation-backend.md，开始修复。
- [PROD_NOT_TOUCHED] 全程只读代码与测试文件，未触碰生产 :8080 / ~/.peekview/。

## r3 修订轮（frontend implementer）— 2026-08-16
- 已读 dispatch-context r3（5 项 needs-revision）+ P4-review-design.md + 上轮实现文档 + 后端 star_service.py（对齐 INFO-1 语义）
- 关键发现：后端 `_matches_filter` 的 expiring 分支 = `status != "expired" and 0 < remaining_days < 7`（**含 paused 豁免条目**）；`build_countdown` 当前 `remaining_days<=0 → expired` 优先于 is_starred（INFO-1 后端未修，但前端以 `_matches_filter` 语义对齐：expiring 只排除 expired）
- 修复方案确认：R1 StarToggle to→/explore?starred=1；R2 .star-toggle min 44px；R3 :title+aria-label 动态人数；R4 isExpiring 加 status!=='expired'；R5 各新增元素 :focus-visible；N1 alertdialog；N2 豁免中语境；N3 HelpCircle 换 emoji；N4 setFilter 清 tags；N6 hover 底色 --c-border
- 修复完成：StarToggle.vue（R1 to→/explore?starred=1、R2 min 44px、R3 :title+动态 aria-label、R5 focus-visible、N6 hover --c-border）、StarManageView.vue（R4 status!=='expired' 守卫、N2 豁免中语境、R5 七处 focus-visible）、EntryCard/EntryListRow（N3 HelpCircle、N1 alertdialog、R5 focus-visible）、Toast.vue（R5 action focus）、EntryListView.vue（N4 starred 清 tags）
- 测试补：t093-star-manage TC-BDD20-05 + TC-BDD21-04（expired 守卫）；t093-star-toggle TC-BDD2-03（action.to='/explore?starred=1'）
- 自查结果：t093 47/47 绿；全量 98/98 文件，1287 passed / 0 failed / 4 skipped（新增 3 用例）；typecheck exit 0
- 2026-08-16: 完成全部代码修复——BLOCKER-1（naive/aware 时区）+ INFO-1（paused 优先）+ CRITICAL-2 Fix B（孤儿星标清扫 admin+service 双兜底）/Fix C（star() 服务层校验）+ F2（DELETE star oracle→has_star 先查 + get_entry 回退）+ F3（max_length=500）+ F4（stars 路由限速）+ F6（TOCTOU 文档化）+ INFO-2/F8（list_entries 批量 star_count/is_starred）+ INFO-4（starred×status 互斥）+ INFO-6（list_starred username 批量）。
- 2026-08-16: 新增 7 个回归测试 backend/tests/test_star_review_fixes.py（BLOCKER-1 读取 / INFO-1 / CRITICAL-2 清扫+服务层 / F2 oracle / F3 上限）。
- 2026-08-16: 全量测试 1125 passed, 3 skipped, 0 failed（上轮 1118 → +7，零回归）；ruff All checks passed。已更新 P4-implementation-backend.md（r2 节）。
- 2026-08-16: P4 review r2（backend 复核轮）：BLOCKER-1（star_service.py:89 now 归一化 naive UTC + test_blocker1 读取 200/countdown 回归测试）✓ 闭合；CRITICAL-2（Fix B 孤儿清扫 admin:329-334 + service:316-321 双兜底、Fix C star() 入口校验 :125-126 + 测试）✓ 闭合；F2（api/entries.py:457-464 has_star 先查 + get_entry 回退，oracle 消除 + 测试）✓ 闭合；F3（models.py:617 max_length=500 + 测试）✓ 闭合；INFO-1/2/4/6 + F4 代码核实闭合。引入新问题检查：dict(Row) 批量语义 venv 实测通过，无新 BLOCKER/CRITICAL。status: approved。

## P4 r2（design-review frontend 复核轮 r2）progress
- 2026-08-16: 读取 dispatch-context r2（复核 5 项闭合）+ 上轮 P4-review-design.md（needs-revision 5 项）+ P4-implementation-frontend.md（r3 节）。
- R1 闭合：StarToggle.vue:70 `to:'/explore?starred=1'`；router.ts /explore 无重定向（仅 '/' 重定向）；EntryListView restoreFromURL(:480-481) 读 starred=1 → currentStarred=true → tab-starred active(:38)；TC-BDD2-03 断言 action.to ✓
- R2 闭合：StarToggle.vue:130-131 `.star-toggle` min-width/min-height 44px + justify-content:center(:121)，与 MobileBar toggle-btn 44px 一致 ✓
- R3 闭合：StarToggle.vue:6-7 动态 `:title`（N 人认为值得收藏）+ 动态 `:aria-label`（已收藏，N 人…/收藏该内容）✓
- R4 闭合：StarManageView.vue:176-181 isExpiring 加 `status !== 'expired'` 守卫；后端 `_matches_filter` expiring=`status!="expired" and 0<remaining<7` 含 paused；TC-BDD20-05/TC-BDD21-04 新增 ✓（残留：前端缺 `0<remainingDays` 下界，仅 all-tab 标签边缘）
- R5 闭合：15 处 :focus-visible 全落地（StarToggle:140-143 / StarManageView:359-362,388-391,416-419,451-454,495-498,547-550,580-583 / EntryCard:397-400,432-435,476-479 / EntryListRow:346-349,374-377,419-422 / Toast:99-102）✓
- N1-N6 附带处理核实：alertdialog+aria-labelledby(EntryCard:76/EntryListRow:63)、豁免中语境(StarManageView:100)、HelpCircle 替换 emoji、setFilter 清 tags(EntryListView:354)、N5 记录 DEBT、hover --c-border ✓
- **新发现 CRITICAL（跨层契约不匹配）**：后端 `StarItem`（models.py:585-602）无顶层 `id` 字段（仅 `entry_id`），墓碑字段嵌套于 `tombstone` 对象；前端 `transformTombstone`（client.ts:205-215）读 `item.id`/`item.title`/`item.deleted_by`/`item.deleted_at`/`item.reason` 均为 undefined，`transformListItem` 对 entry 星标项读 `entry.id` 亦 undefined → StarManageView starId/starKey/checkbox/removeStars 全链路失效（entry_ids:[undefined] → 后端 .in_([None]) 零匹配）。python 实测 StarItem 字段清单确认无 id。前端单测 mock 形状与后端真实响应不一致，故 1287 passed 无法暴露。
- 写产出: P4-review-design.md（r2 覆盖写回）

## r4 修订轮 — implementer(frontend) 进度（2026-08-16）

- 已读 dispatch-context(r4) + implementer 角色 + P4-review-design.md(C1/R4-note/2 minor)
- 已核实后端真实契约（models.py:585-602 StarItem + star_service.py:337-411）：
  - entry 项：type/entry_id/slug/summary/status/is_public/owner_id/username/starred_at/star_count/is_starred/expires_at/archived_at/countdown/tombstone(null)——无顶层 id
  - tombstone 项：type/entry_id/slug/summary(=title)/starred_at + tombstone{id/entry_id/slug/title/cover/deleted_by/deleted_at/reason} 嵌套
  - CountdownInfo: status/remaining_days(float)/archive_delete_at
- 前端现状确认：client.ts transformTombstone 读扁平 item.*、listStars 复用 transformListItem 读 item.id → 全 undefined（C1 实锤）
- 修复方案（C1）：api/types.ts 改嵌套契约类型；client.ts transformTombstone 从 item.tombstone.* 取 + id=item.entry_id；listStars entry 分支单独 transform（不复用 transformListItem）；StarManageView isExpiring 补 remainingDays>0（R4-note）；t093-star-manage.test.ts 改真实契约形状 mock + 真实 client（mock axios.get/delete）集成用例；t093-star-toast.test.ts 路径字面同步

- 修复完成（C1 + R4-note + 2 minor）：
  - api/types.ts：StarListItemResponse 改为独立契约类型（entry_id 顶层、无 id/tags）+ TombstoneNestedResponse 嵌套 + TombstoneItemResponse.tombstone 嵌套
  - client.ts：transformTombstone 从 item.tombstone.* 取 5 字段、id=item.entry_id；listStars 新增 transformStarEntry 单独 transform（不复用 transformListItem，entry_id→id）；补 StarListItemResponse import
  - StarManageView.vue：isExpiring 补 remainingDays > 0（与后端 0<remaining_days<7 逐字对齐）
  - t093-star-manage.test.ts：改真实契约形状（raw snake_case + entry_id + 嵌套 tombstone），mock 从整 client 换成真实 client + mock axios.get/delete（raw→transform→store→渲染全链路覆盖）；断言改从 axios.delete config 读 entry_ids（批量移除 entry_id 传递验证）；新增 TC-BDD20-06（paused+0 天不落 expiring）
  - t093-star-toast.test.ts：`/?starred=1` → `/explore?starred=1`（4 处字面同步）
- 自查：t093 定向 31/31 绿；全量 98/98、1288 passed/0 failed/4 skipped（+1 = TC-BDD20-06）零回归；vue-tsc exit 0
- 无 [DESIGN_GAP] / [SCOPE+]

## r3 复核（design-review，2026-08-16）— C1 闭合确认

- C1-① transformTombstone（client.ts:205-216）改从 item.tombstone.* 取 title/deleted_by/deleted_at/reason，id=item.entry_id —— 与后端 tombstone 分支（star_service.py:343-359 `entry_id=star.entry_id` + 嵌套 TombstoneResponse）逐字段一致 ✓
- C1-② transformStarEntry（client.ts:218-238）id=item.entry_id —— 与后端 entry 分支（:374-389 `entry_id=entry.id`）一致 ✓
- C1-③ 类型（api/types.ts:162-198）StarListItemResponse 独立契约 + TombstoneNestedResponse 嵌套 —— 与 models.py StarItem:585-602/TombstoneResponse:572-582 逐字段核对一致 ✓
- C1-④ t093-star-manage.test.ts 真实 client + mock axios.get/delete（raw snake_case+entry_id+嵌套 tombstone）+ 断言 axios.delete config entry_ids（TC-BDD14-04:101 / TC-BDD22-01:1&101）✓
- unstar_batch 命中链核实：删除时星标行保留原 entry_id 仅绑 tombstone_id（entry_service.py:906-908）→ 前端传 entry_id 命中 `EntryStar.entry_id.in_()`（star_service.py:205-210）✓
- R4-note：isExpiring 补 remainingDays>0（StarManageView.vue:180），与后端 0<r<7 逐字对齐；TC-BDD20-06 在 ✓
- 2 minor：toast 测试 4 处 `/explore?starred=1` 全同步 ✓；桌面 44px 保持（主 Agent 已接受）✓
- 新问题：无 BLOCKER/CRITICAL；2 条信息性观察（active tab 客户端公式对 paused+0 理论差异但为死代码；reason='expired' 分支后端当前仅发 author_deleted，前端有默认兜底）
- 结论：approved

## P4 回退修复（implementer-retreat, 2026-08-16）

- 已读：dispatch-context-retreat + implementer.md + P0-brief + star.spec.ts + EntryListView.vue
- 根因验证（读码确认，与主 Agent 诊断一致）：
  - EntryListView.vue:9 `<AuthButton v-if="authState === 'anonymous'">` → Sign in 按钮仅在 authState 解析为 anonymous 后渲染
  - login()（star.spec.ts:36-48）：`signInBtn.count()` 在 authState=loading 时返回 0 → btn 取 loginBtn（也 count 0）→ `isVisible()` false → 跳过登录
  - 页面停留匿名态 → tab-starred 不渲染 → BDD-18 waitForSelector 超时；BDD-1/6 flaky 同源（authState 解析快慢）
- 修复方案：login() 在 count 前先 `waitFor({state:'visible', timeout:10000})` 等待登录按钮出现（union selector: Sign in/Login），确保 authState 解析完成；其余逻辑不变
