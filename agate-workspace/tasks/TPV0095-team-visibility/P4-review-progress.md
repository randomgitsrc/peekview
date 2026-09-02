# P4-review-progress — cso 安全评审（TPV0095 team-visibility）

> trace: TPV0095-P4-cso-20260902 · 只读评审 · [PROD_NOT_TOUCHED]

## 已读
- [x] dispatch-context-cso.md（评审重点 7 项）
- [x] cso 角色定义（STRIDE + 分级 + Header status 规则）
- [x] P1 BDD-1~15/21/22/27~30/36 安全线（权限/防枚举/share/校验契约）
- [x] P2 §3 权限收敛 + §3.3 teams API 404 + D1-D5 不变量 + §9/§11 完成标志
- [x] P4-implementation.md（backend/frontend/mcp 三批 + DESIGN_GAP 标注）

## 待读/进行
- [ ] git diff 461936ad..HEAD：_shared.py（全局 key 精确比对升级）
- [ ] backend api/entries.py / files.py / services（entry/share/star/team）
- [ ] frontend store 守卫 toggleVisibility / EntryCard/Row toggle 隐藏
- [ ] mcp team_id schema / listTeams

## 评审记录
（追加）

### 后端已核（追加）
- _shared.py 全局 key：请求时 config 精确比对（收紧），裸 Authorization 兼容；current_user 短路移除 → header 覆盖 cookie。
- entries.py get_entry share 分支 + files.py resolve_entry_raw share 分支：登录非成员 + ?share= → 404；cookie 分支 _check_share_cookie 无同判别（潜在不一致，待定级）。
- entry_service can_read/team_visible_expr/update D3 clamp/D4 revoke/_resolve_team_for_user(422 统一)。
- share_service 三接口 403→404；star_service 加 team 可见项。
- team_service/teams.py：无权一律 404；get_team is_admin 参数存在但路由不传（admin 不接管 ✓）。

### eng review 追加（TPV0095-P4-review-eng-20260902，[PROD_NOT_TOUCHED]）
- **实测复现 BLOCKER-1（CRITICAL 越权读）**：隔离 tmp DB，anon+合法 share token → 200 种 cookie；同 client 登录 carol（非成员）后 plain GET（带 cookie 无 ?share=）→ **200 全文**；对照 carol+?share= → 404（判别只覆盖 query 分支）、carol 无 cookie → 404。`_check_share_cookie`（entries.py:37-70，返回 :60-70）与 `_resolve_entry` cookie fallback（files.py:164-177）在 service.get_entry 判定前直接放行 → 绕过「登录非成员+team entry→404」（BDD-2/23）。P3 测试未覆盖「client 持 cookie」形态（fixture 无 cookie → 全 404 绿）。
- **实测复现 BLOCKER-2（CRITICAL 读不一致）**：alice(owner) 建 team、bob(member) 发布 E2 到该 team（owner_id=bob）。alice get E2 → 404、team=me → 缺、All → 缺、raw → 404；但 ?team=proj-a → 200 含 E2。can_read（entry_service.py:74-86）只判 entry.owner_id / team_members 行，未覆盖 team.owner_id==user；list_entries ?team=slug 过滤（:550-566）判 team owner 放行 → 不一致。BDD-1「team entry 对 owner 与成员可见」在成员发布对偶下不成立；需 P1/P2 裁定 owner 是否读成员发布内容并全路径对齐（A. owner 纳入团队读权 / B. owner 纯管理、过滤同口径）。
- INFORMATIONAL：database.py:220-228 raw fallback teams 表缺 slug UNIQUE（metadata idx_teams_slug unique 未在 _run_migrations 补）——旧库升级后无 DB 层 slug 唯一兜底；team_service _member_count N+1（低危）。
- DESIGN_GAP 判定：share 判别方向合理但只覆盖 ?share= 分支 → BLOCKER-1；全局 key 精确比对合理 ✓；空文件 download 200 合理 ✓；P3 机械修复合理（零断言改动）✓。
- **产出 P4-review-eng.md：status: rejected**（BLOCKER-1 越权读 + BLOCKER-2 owner 读不一致）。

### eng review 复审 r1（TPV0095-P4-review-eng-20260902-r1，[PROD_NOT_TOUCHED]）
- **BLOCKER-1 修复核验 ✅**：entries.py:37-52 `_share_cookie_allowed_for_user` + :83-86 `_check_share_cookie` 判别 + files.py:172-178 `_resolve_entry` cookie fallback 同款。实测：carol+cookie plain GET/download → 404；anon+token → 200；alice(owner)+cookie → 200（回落正常访问）。
- **BLOCKER-2 修复核验 ✅（主路径）**：team_membership.py:33-47 `team_owner_exists`；entry_service.py:62-72 team_visible_expr OR(owner)；can_read 加 is_team_owner；get_entry 非 archived 解析传入。实测：alice owner 对 bob 发布的 E2 get/All/team=me/team=slug/raw/content/download 全 200。
- **R1（CRITICAL 残留）**：api 层 ?share= 分支（entries.py:249-256/files.py:381-388）仍只查 team_membership → alice(owner) ?share= on 成员发布 E2 → 404，bob(成员) 同 token → 200；cookie/query 两通道 owner 行为也不一致。需补 team_owner_exists 或抽共享判定助手。
- **R2（CRITICAL 残留）**：star_service._build_star_item（:371-380）仍 membership-only → alice star E2 后 /stars 缺、?starred=true 含（两星标表面不一致）；implementer 已自标 [SCOPE+]（P4-implementation.md:277）。
- **R3（INFORMATIONAL）**：team entry 可读判定四处重复（_share_cookie_allowed_for_user / entries+files share 分支 / star_service / can_read），建议收敛单点防第五处漂移。
- 回归：team 6 文件 pytest 33 passed（3.06s）；全量仅 1 环境性失败（沙箱 ~/.peekview 只读，预存）。
- **复审产出 P4-review-eng.md：status: needs-revision**（BLOCKER-1/2 主场景修复通过、无越权读；R1/R2 方案 A 语义传播不完整，补齐即可 approved）。

### eng review 终审 r2（TPV0095-P4-review-eng-20260902-r2，[PROD_NOT_TOUCHED]）
- **R1 修复核验 ✅**：entries.py:238 import team_owner_exists + share 分支（:249-263）双解析 is_team_member/is_team_owner 入正常访问条件；files.py resolve_entry_raw share 分支（:380-400）同款。实测 alice(owner)+?share= on 成员发布 E2 → 200；carol ?share= → 404；anon ?share= → 200（外部语义不变）；cookie/query 通道 owner 一致化。
- **R2 修复核验 ✅**：star_service.py:14 import + _build_star_item（:371-382）双解析 owner 项。实测 alice star E2 → /stars 与 ?starred=true 均含（两表面一致）。
- **方案 A 10 表面矩阵实测全绿**（成员发布 E2）：alice get/All/team=me/team=slug/raw/?share=/cookie/download/files-content//stars/?starred=true 全 200 或含；carol 对应全 404/不含；anon ?share= 200。
- 回归：team+share 51 passed + star 36 passed + share_cookie/access/security/lifecycle/entry/raw 111 passed（部分重叠）；全量仅 1 预存 env-fail。
- 缺口（INFORMATIONAL，不阻断）：方案 A owner 语义（成员发布+owner 读对偶 + /stars 一致性）无落仓回归测试，建议补权限矩阵用例；R3 判定助手收敛记 backlog。
- **终审产出 P4-review-eng.md：status: approved**。

---

# P4-review-progress — design-review 前端实现评审（TPV0095 frontend 批，追加节）

> trace: TPV0095-P4-design-review-20260902 · 只读评审 · [PROD_NOT_TOUCHED]（未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未跑 npm run dev；未改任何代码）

## 已读（分文件块）
- [x] P4-dispatch-context-design-review.md + design-review 角色 + review.md 前端专项 + plan-design-review 无（文件不存在→按 role+review.md 维度）
- [x] P1 BDD-38~44 + §3.13/§5 扫描 D1-D7（改 DOM 定位）；P2 §5.1-5.8 + §5.7 testid 表 + UI 设计 checklist
- [x] P4-implementation.md frontend 批 + P4-progress.md（前端实现/自测记录）
- [x] 代码 diff（工作树 HEAD..P4，P4 未 commit）：EntryListView.vue / searchUrl.logic.ts / entryList.ts / BaseBadge / FilterChip / EntryCard / EntryListRow / EntryDetailHeader / EntryMetaTagsBar / UserMenu / router.ts / DESIGN.md；新文件 teams.ts store + TeamsView.vue；types/api client teams 全套
- [x] P3 spec：entry-list-view-teams / search-url-team / entry-card-team / entry-list-row-team / user-menu-teams / detail-visibility-tag（10 组件 spec 全确认）
- [x] e2e：team-visibility.spec.ts / teams-page.spec.ts（testid 锚一致）
- [x] 回归面：searchUrl.logic.spec.ts（toEqual 精确对象无 team/view 键）；UserMenu.spec（.dropdown-item 精确 2 项）；t093-starred-tab.test.ts（4 tab 锁）；auth.ts（logout 无 reset 钩子）；router.ts beforeEach 守卫；variables.css token 核对

## 评审核查记录（逐项）
1. 5-tab 互斥：tabDefs/isTabActive 单一来源；teams 互斥命中 BDD-38（teams 激活时 All/Mine/Archived/Starred 均 false）✓
2. URL 恢复：applyUrlToState 单一收敛（setup 同步执行 + auth watch + route update 共用）✓；parseRestoreQuery 无 app 调用点（dead export，全键合法无回归）✓
3. teams 页：双入口 + owner 全操作 + 三错误互异（后端文案）✓；live region/delete confirm ✓
4. toggle 守卫：store 守卫 + 两视图隐藏 + delete 保留 ✓（EntryCard/Row 同 testid）
5. badge：team 变体 + 不叠加 private ✓（EntryCard v-else 链 / EntryListRow isOwner 门控 + P2 声明）
6. detail 三态 .status-tag（非 BaseBadge 载体）→ DESIGN_GAP 判定（见下）
7. 移动端 a11y：role=tablist/aria-selected/方向键 + overflow-x + min-height:44px ✓（高度非硬 44，P6 实测点，非 BLOCKER）
8. AI Slop / 视觉：全 token、无紫色渐变、无 emoji/hex 新增 ✓
9. data-testid：§5.7 清单 vs 实现逐项核对 —— 不一致 1 处：team-chip-{slug} 落在 .teams-chip-row 内与 FilterChip 的 team-chip-{slug} 重复（同页两元素同 testid）
10. 一致性隐患（非 BLOCKER）：teamsLoaded 为 false 的慢加载窗口下主动点 team chip 会先发 team=me 再补一次；pending URL team 恢复后无二次 load（slug 合法时靠 chips 触发、非法时 URL 未清）

## 裁定
- DESIGN_GAP×5 全部合理；SCOPE+×2 全部合理
- 无 BLOCKER；1 个 needs-fix 级问题（team-chip-{slug} 双位置同 testid 冲突）+ 5 个建议项 → status: needs-revision（轻量修正可快速转绿，非 rejected）

[PROD_NOT_TOUCHED]

## 定稿
- P4-review-design.md 已产出，Header status: **needs-revision**
- 判定依据：无 BLOCKER（非 rejected）；DESIGN_GAP×5 + SCOPE+×2 全合理；needs-fix ×2（F1 team-chip-{slug} 同页双 testid 冲突；F2 登出未 reset team store 违反 P2 §5.5-② 跨账号残留）+ 建议项 S1-S6 → needs-revision（定向小修后可转 approved）

---

# rev1 复审追加（design-review F1/F2 修复核验）

> trace: TPV0095-P4-design-review-20260902-rev1 · [PROD_NOT_TOUCHED]（只读）

## 核验记录
- [x] diff 核验 F1：EntryListView.vue :57 row 按钮 → `teams-chip-{slug}`；:40 FilterChip 保留 `team-chip-{slug}` → 同页双 testid 互异，冲突消除
- [x] diff 核验 F2：stores/auth.ts logout() :49-55 + peekview:auth-expired :72-78 内建 useTeamStore().reset()；import 无环（auth→team→api）；reset 清 owned/joined/loading/teamsLoaded/error
- [x] 新自检 spec ×2 实测：tpv0095-review-fix.spec.ts + tpv0095-review-fix-entry-list.spec.ts = 4 passed
- [x] 回归核验：entry-store-auth.spec.ts（15 用例含 auth-expired×3）实测全绿；team-store.spec + entry-list-view-teams.spec 全绿（20 passed 合计）
- [x] e2e 波及核验：teams-page.spec.ts 无 chip 锚 → 不受影响；**team-visibility.spec.ts :106-107 BDD-38 chip 用例锚 `team-chip-proj-a` 孤儿化**（首次加载 /explore?view=teams 只有 row `teams-chip-*`，FilterChip 选中后才出现 → .catch+if(count>0) 静默跳过 → BDD-38 URL 表达实跑覆盖丢失）→ **新 F3 needs-fix**

## rev1 定稿
- F2 修复正确 ✅；F1 组件层修复正确 ✅
- 新 F3（e2e 锚点 1 行：team-chip-proj-a → teams-chip-proj-a）→ 维持 needs-revision
- P4-review-design.md Header status 更新为 needs-revision（rev1 复审节已追加）

---

# rev2 复审追加（design-review F3 修复核验 → approved）

> trace: TPV0095-P4-design-review-20260902-rev2 · [PROD_NOT_TOUCHED]（只读）

## 核验记录
- [x] diff 核验 F3：team-visibility.spec.ts :106-107 锚点 `team-chip-proj-a` → `teams-chip-proj-a`（1 行 selector，主 Agent 最小修复）
- [x] 语义核验：首载 view=teams → teams-chip-row row 按钮（teams-chip-proj-a）即存在 → click → selectTeamChip → URL ?team=proj-a → waitForURL 命中；不再静默 no-op，BDD-38 URL 表达覆盖恢复
- [x] 残余核对：全 e2e 无其它首载错误 chip 锚点；:9 注释 team-chip-{slug} 为 §5.7 原义（FilterChip 选中态）非锚点引用，无害
- [x] 汇总：F1+F2+F3 三修复全部正确；DESIGN_GAP×5 + SCOPE+×2 合理；无 BLOCKER/needs-fix → approved

## rev2 定稿
- P4-review-design.md Header status: **approved**（rev2 复审节已追加）
- 建议项 S1-S6 维持 P6 视觉/键盘复核或技术债（不阻断）

### cso 复评追加（TPV0095-P4-cso-20260902-r2，[PROD_NOT_TOUCHED] 只读）
- 后端 BLOCKER-1/2 + R1/R2 修复已实读核验：
  - _share_cookie_allowed_for_user + _check_share_cookie 判别（entries.py:37-97）+ files.py _resolve_entry cookie fallback 同款（:172-178）+ download/_check_share_cookie(current_user) → 登录非成员 cookie 通道 404 ✓
  - entries.py get_entry ?share= 分支双解析 member+owner（:251-268）；files.py resolve_entry_raw share 分支同款（:379-401）
  - entry_service can_read 加 is_team_owner + team_visible_expr OR(team.owner)（:62-101）；get_entry 非 archived 双解析（:422-429）
  - list_entries team=slug 过滤 team_row.owner_id 放行 ✓（owner 视角 ?team= 与 All 一致）
  - star_service _build_star_item 双解析（:371-387）✓（/stars 与 ?starred=true 一致）
- write 路径复核：update D3 clamp（team 附着时 is_public=true 强制 false，:846-856）+ team→public 需显式 team_id=None（D4 revoke :862-865）✓；create 匿名强制 public（:252-253）+ team_id 非空 → _resolve_team_for_user 422（统一文案，匿名短路 422）✓
- 需补：entryDetail/详情溢出菜单 team entry "Make Public" 文案（store 守卫拦截但文案误导）；MCP listTeams / zod team_id；EntryCard/ListRow toggle 隐藏 + badge；teams store logout reset

### cso 复评实测（TPV0095-P4-cso-20260902-r2，[PROD_NOT_TOUCHED]；tmp sqlite 隔离 create_app）
- **cookie+auth 双通道越权实测**：member 发布 team entry（owner=alice/member=bob，carol 无关）
  - carol（登录 cookie+share cookie）plain GET → **404**；carol login+share cookie download → **404**；carol ?share= → **404**；anon+share cookie plain GET → 200（外部语义保留）；member bob + share cookie + bearer → 200
  - non-team private entry：bob（登录+share cookie）→ 200 + share_context.team=null（team 不泄露）；anon raw+cookie → 200（share 语义零回归）
- **owner 语义（方案 A 对偶）**：alice（team owner 非成员行）对 bob 发布 entry get/team-filter/team=me/raw 全 200；carol 全 404；admin 200
- **D3 clamp 实测**：entry owner PATCH is_public=true（team 附着）→ 200 但 is_public=false + team 保留
- **7 路径**：member/owner content+download 200；carol content/download 404
- **teams 管理**：carol rename/detail → 404；bob detail → 200
- **BDD-10 零信号**：anon/carol × team=exists/missing/me → 全 200 空 items；carol All 列表不含 team entry
- **全局 key**：user-level pv_ key（成员）→ team entry 200；master key（X-API-Key / 裸 Authorization）raw/get 200；mw 开启时 wrong key 401（`PEEKVIEW_SERVER__API_KEY` 启动配置下 middleware 全量 401 拒绝 — P2-era main.py 同构，非本任务引入）
- **迁移**：旧库（无 teams/team_id）init_db(run_migrations=True) 两次幂等 — 探测脚本遇 status enum 存储细节（存量 active 需 ACTIVE 大小写）非迁移问题；BDD-17 P3 用例覆盖（make test-quick 1164 passed）
- **残余发现**：
  - LOW：_run_migrations raw teams 表缺 `idx_teams_slug UNIQUE`（metadata create_all 有、旧库升级后无 DB 层兜底；team_service 靠 -N 重试自愈，仅降级不越权）
  - LOW：detail 溢出菜单 team entry 仍显示 "Make Public"（isPublic=false 文案），点击被 store 守卫拦（toast+return false）——文案误导非越权
  - INFO：team entry 可读判定 4 处共享形态（_share_cookie_allowed_for_user + 两 share 分支 + star_service + can_read/expr）有漂移风险（eng R3 同判，backlog）
  - INFO：owner 语义对偶修复（方案 A）+ carol cookie 通道无独立落仓回归测试（eng 同判）

### cso 复评实测补充（r2 续，[PROD_NOT_TOUCHED]）
- 非团队 private entry share cookie 回归：bob（登录+share cookie）→ 200 + share_context.is_share_access=true + **team=null**（不泄露）；anon raw+cookie → 200
- share 管理端点：carol list shares team entry → 404（owner 判定）；carol reads team entry → 404
- admin 不接管：admin get team entry 200（读），rename/delete/detail team → 404（管理权仍 owner-only）
- anon All 列表不含 team entry（含 pub）；anon ?team= → 空；member All 含；member get/raw team 字段非 null 且 is_public=false
- **结论汇总**：BLOCKER-1（cookie 越权读）、BLOCKER-2/R1/R2（owner 语义传播）修复经静态 + 实测双通道核验通过；残余均为 LOW/INFO（文案误导、迁移唯一索引降级、判定漂移风险、回归测试缺口），无 CRITICAL/HIGH/BLOCKER → **status: approved**

## cso 定稿
- P4-review-cso.md 产出，Header status: **approved**
- 最高严重级别：无 CRITICAL/HIGH（修复前 BLOCKER-1/2 已由 eng 链修复并复核）
- 记录：LOW×2 + INFO×3（详见评审文件）
