## P3 progress - frontend test-designer
[PROD_NOT_TOUCHED] 未触碰任何生产资源
- 已读 dispatch-context：前端覆盖 BDD-1/2/3/6/14/18/19/20/21/22/23/24/25/26；E2E spec 名 e2e/star.spec.ts；需 data-testid 稳定定位；P3-test-cases.md 声明 test_code_dir
- 已读 test-designer 角色文件：BDD→测试 1:1；测试名引用 BDD 编号；ui_affected 必须有 E2E 用例；T079 vitest mock hoisting 反模式（vi.mock 回调只含字符串字面量）
- 下一步：读 P1-requirements.md
- 已读 P1-requirements.md：14 条前端可测 BDD（1/2/3/6/14/18/19/20/21/22/23/24/25/26），另有 BDD-4/5（匿名/多用户计数）为 backend 可测、BDD-4 前端可能涉及（匿名星标按钮引导登录）——dispatch-context 未列入前端范围，聚焦 14 条
- 下一步：读 P2-design.md
- 已读 P2-design.md：§6.5 data-testid 清单（star-toggle/star-count/mobile-star-toggle/tab-starred/stars-tab-*/tombstone-card/star-exempt-label/force-delete/star-toast-action/stars-empty-* 等 18 个）；§6.1 双文案 Toast + Toast action；§6.2 Starred tab 互斥语义；§6.3 filter 语义表；§6.4 豁免标签 footer 条件；gate_commands P3_frontend=make test-frontend、P5_e2e=E2E_SPEC=e2e/star*.spec.ts
- 下一步：读 P0-brief.md + 现有测试模式
- 已读 P0-brief.md：high risk；P3 不可跳（零现成覆盖）；严禁触碰 :8080/~/.peekview/
- 下一步：探查现有测试模式（vitest 单测 + e2e spec + api/client.ts）
# P3 progress — test-designer (backend)

## 输入读取进度
- [x] P3-dispatch-context-test-designer-backend.md（覆盖要点/约束/门槛）
- [x] test-designer.md 角色定义（BDD→测试 1:1、红灯要求、test_code_dir 声明）
- [x] P0-brief.md（风险 high、schema 变更、P3 不可跳）
- [x] P1-requirements.md（28 BDD；后端可测 1/2/3/4/5/7/8/9/10/11/12/13/15/16/17/27/28）
- [x] P2-design.md（EntryStar/EntryTombstone/archive_delete_at、star_service、cleanup 重写、backfill 数据幂等、BLOCKER-1/2/3/4、N1/N2/N4/N7/N9）
- [x] conftest.py（autouse tmp_path 隔离、app/client fixtures、rate limit 禁用）
- [x] factories.py（EntryFactory/FileFactory/create_test_user）
- [x] test_api.py / test_admin_stats_cleanup.py / test_archived_visibility.py / test_entry_lifecycle.py（测试模式）
- [x] test_database.py（init_db/迁移测试模式）
- [x] models.py（无 EntryStar/EntryTombstone/archive_delete_at → 当前缺失即红灯源）
- [x] database.py（_run_migrations/backfill_fts_content 幂等模式、FTS_VERSION=2）
- [x] entry_service.py（get_entry:341-349 archived 权限、delete_entry/delete_entry_by_api_key、update_entry 双 reactivation）
- [x] admin_service.py（cleanup_expired:240-308、delete_user:450-473）
- [x] main.py（DI app.state、create_app、raw 短链 302）
- [x] auth.py（get_current_user/require_auth 401）
- [x] api/entries.py（路由模式；star 端点不存在 → 404 红灯）
- [x] api/files.py（_resolve_entry 收敛到 get_entry；raw/content/download 同源继承）
- [x] share_service.py（create_share 对 archived 拒绝创建；verify_share_token/cookie 不查归档状态 → BDD-28 回归锚）
- [x] config.py（archive_retention_days=90、cleanup.interval_seconds）

## 测试设计要点（红灯语义）
- 顶层不 import EntryStar/EntryTombstone（避免整文件 collection error 难排查）→ 函数内 import（B 类项目内 import 失败 = 真红灯）
- 新 API 端点缺失 → HTTP 404 vs 期望 200/401 → 真红灯
- 回归锚（当前绿，合理）：BDD-16/17、BDD-28、BLOCKER-4(ownerless archived 匿名 404)
- BLOCKER-2 用例：函数内先断言 owner 星标 200（当前 404 → 红）再断言非 owner 404，避免整体假绿
- 时间构造：archive_delete_at 用 naive UTC 远过去/远未来，与 cleanup now_naive 字符串比较对齐（不依赖 freezegun）
- 已读现有测试模式：filter-tabs.test.ts（mount EntryCard + stub）/ entry-store-auth.spec.ts（pinia + vi.mock '@/api/client' 字面量）/ t080（mount 视图 + memory router + stub）/ entry-lifecycle.test.ts（组件未实现时测 API contract）/ t079 e2e（BASE_URL 保护 + login helper + serial）
- 已读 client.ts（transformListItem/transformEntry 现无 star 字段）、types/index.ts（Entry 无 starCount）、EntryListView.vue（owner-tabs 3 个 tab，无 Starred）、EntryCard.vue（footer 条件 isOwner||isExpiredButActive，无豁免标签）、EntryDetailHeader/MobileBar、useToast（无 action 能力）、router.ts（无 /stars）
- 结论：P4 新建 StarToggle.vue / StarManageView.vue / stores/star.ts / client star 方法 / Entry 字段；现有组件加 data-testid。P3 红灯 = import 失败（B类）+ 断言失败（B类）
- 下一步：检查 Toast.vue/playwright.config.ts，然后写测试
- 已写 6 个单测文件 + 1 个 E2E spec：
  - t093-star-toggle.test.ts（BDD-1/2/3/6/23）
  - t093-starred-tab.test.ts（BDD-18/19）
  - t093-star-manage.test.ts（BDD-14/20/21/22/26）
  - t093-star-exempt.test.ts（BDD-24/25）
  - t093-star-toast.test.ts（design-3 action 扩展）
  - t093-star-api-client.test.ts（design-4 transform + API 方法）
  - e2e/star.spec.ts（核心链路，P6 实跑）
- 下一步：运行 vitest 确认红灯 + 已有测试保持绿
- P3 完成：
  - 红灯确认：npx vitest run src/__tests__/t093- → 6 文件 21 失败/6 通过，全部 B 类（StarToggle.vue/StarManageView.vue import 失败 + 断言失败）；6 通过为负向回归锚（匿名无 tab/无星标无标签/无 action 零回归）
  - 全量回归：92 文件 1238 通过/4 skipped，仅 6 个新 t093 文件失败，已有测试保持绿
  - 修复 2 个测试代码 bug：mount(import()) → await import().default（Promise 不能直接 mount）；__APP_VERSION__ 需 vi.stubGlobal（参照 landing-auth.spec.ts 先例）
  - 产出：P3-test-cases.md（192 行，40 个 TC-BDD 用例 + 5 条 E2E）+ P3-test-code/frontend/（7 文件副本，frontend-v3 下可运行原件同内容）
  - [PROD_NOT_TOUCHED] 全程未触碰 :8080 / ~/.peekview/；未实跑 E2E（P3 阶段）

## 完成状态
- [x] 4 个测试文件写入 backend/tests/（test_star_api/visibility/lifecycle/migration）+ 镜像到 P3-test-code/backend/
- [x] P3-test-cases.md 写入（含 test_code_dir 声明）
- [x] 红灯确认：全量 1095 passed（既有零回归）+ 23 failed（全部新测试，B 类真红灯）+ 3 skipped
- [x] 回归锚 4 绿：BDD-16/17、BLOCKER-4、BDD-28（既有行为，P4 重构后必须保持）
- [x] ruff 全清
- [x] [PROD_NOT_TOUCHED] 未触碰生产 :8080 / ~/.peekview/（conftest autouse tmp_path 隔离）
