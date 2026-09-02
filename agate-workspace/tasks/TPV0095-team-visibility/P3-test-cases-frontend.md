---
phase: P3
task_id: TPV0095-team-visibility
type: test-cases
parent: P2-design.md
trace_id: TPV0095-P3-test-designer-frontend-20260902
status: draft
agent: test-designer (frontend 批)
batch: frontend
scope: BDD-38~44
---

# P3 测试用例清单 — TPV0095 frontend 域（BDD-38~44）

> 本文件是 frontend 批的用例清单片段，由主 Agent 与 backend/mcp 批合并为 P3-test-cases.md。
> 依据：P1-requirements.md §3.13（BDD-38~44）+ P2-design.md §5（前端设计 + §5.7 data-testid 清单 + §5.8 detail 三态）。
> 环境隔离：[PROD_NOT_TOUCHED] — 仅写测试文件 + 本文档，未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未跑 npm run dev。

## 被测对象（尚未实现 → 红灯）

| 待实现（P4） | 说明 |
|---|---|
| `EntryListView.vue` explore 第 5 tab（Teams）+ `tab-teams` | BDD-38 |
| team chips（`team-chip-{slug}`，FilterChip 承载）+ URL `team`/`view` 维度 | BDD-38/41 |
| 单一「团队不可用」态（`team-unavailable` + `team-unavailable-clear`）与空态区分（`teams-empty` / `team-empty`） | BDD-41 |
| `BaseBadge.vue` team 变体 + `label` 参数化（`data-testid="badge-team"`） | BDD-39/44 |
| `EntryCard.vue` / `EntryListRow.vue`：badge 优先级 `teamId ? team : (isPublic?public:private)`；toggle 按钮 team entry 隐藏 + tooltip；统一 `visibility-toggle` testid | BDD-39/40 |
| `stores/entryList.ts` `toggleVisibility` teamId 守卫 | BDD-40 |
| `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue` 状态标签三态（team → 「仅团队可见 · {teamName}」，不显示 Private） | BDD-44 |
| `views/searchUrl.logic.ts` `parseRestoreQuery`/`mergeQuery` 扩展 team/view；四维互斥 restore（All 激活含 `!currentTeam`） | BDD-38 |
| `stores/team.ts`（myTeams 快照）、`router.ts` /teams 路由、`TeamsView.vue`、`UserMenu.vue` Teams 入口、explore Teams tab 内「管理团队」链接 | BDD-41/42 |
| 移动端 tab 栏横向滚动 + tab 触达 ≥44px + tablist/aria-selected 语义 | BDD-43 |

## test_code_dir 声明

```
test_code_dir:
  component_specs:
    - frontend-v3/src/views/__tests__/tpv0095-entry-list-view-teams.spec.ts      # BDD-38/41/43（视图 5-tab + 不可用态 + a11y）
    - frontend-v3/src/views/__tests__/tpv0095-search-url-team.spec.ts              # BDD-38/41（searchUrl.logic team/view 扩展）
    - frontend-v3/src/components/__tests__/tpv0095-base-badge-team.spec.ts         # BDD-39/44（BaseBadge team 变体 + label）
    - frontend-v3/src/components/__tests__/tpv0095-entry-card-team.spec.ts         # BDD-39/40（EntryCard badge/toggle）
    - frontend-v3/src/components/__tests__/tpv0095-entry-list-row-team.spec.ts     # BDD-39/40（EntryListRow badge/toggle）
    - frontend-v3/src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts       # BDD-40（store 守卫 toggleVisibility）
    - frontend-v3/src/stores/__tests__/tpv0095-team-store.spec.ts                  # BDD-41/42（team store 动作清单）
    - frontend-v3/src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts   # BDD-44（detail 三态标签载体：入口组件需含 team 语义渲染）
  e2e_specs:
    - frontend-v3/e2e/team-visibility.spec.ts      # BDD-38/39/40/41/43
    - frontend-v3/e2e/teams-page.spec.ts           # BDD-42（含输入态逐态 Playwright 断言 + 三文案互异）
```

> e2e/teams-page.spec.ts 为 P2-design §6 gate 键 `P5_e2e_b`/`P6_e2e_b` 消费对象；e2e/team-visibility.spec.ts 为 `P5_e2e_a`/`P6_e2e_a` 消费对象（`E2E_SPEC` 单 spec 传参，不做逗号多 spec）。

## BDD ↔ 用例映射（1:1）

| BDD | 验收条件（P1） | 测试用例（编号引用 BDD） | 载体 | testid（P2 §5.7） |
|---|---|---|---|---|
| BDD-38 | explore 5 互斥 tab，仅当前激活高亮；Teams tab 激活时 All 不高亮（All 激活判定含 !currentTeam）；URL 反映 `?view=teams`/`?team={slug}` | `bdd38_explore_5_tabs_mutually_exclusive`：登录态渲染 5 tab（All/Mine/Teams/Archived/Starred），任意时刻至多 1 tab 带 active 类；Teams 激活时 All 无 active | 组件 spec（视图）+ E2E | `tab-all`/`tab-mine`/`tab-teams`/`tab-archived`/`tab-starred` |
| BDD-38 | 点 Teams tab → URL `view=teams`；点 team chip → URL `team={slug}` | `bdd38_teams_tab_url_view_teams`：激活 Teams → loadEntries 收到 team=me / URL 含 view=teams（store spy） | 组件 spec（视图） | `tab-teams` |
| BDD-38 | 点具体 team chip 过滤 | `bdd38_team_chip_sets_url_and_filter`：选中 chip → URL 含 `team={slug}`，chip 显示可移除 | 组件 spec（视图） | `team-chip-{slug}` |
| BDD-39 | team entry 卡片显示「仅团队可见 · {teamName}」badge；不叠加 private badge（两视图统一） | `bdd39_team_entry_badge_no_private_*`（EntryCard + EntryListRow 两套）：teamId 非空 → 渲染 badge-team 文案含团队语义；同时断言无 private/public 徽标并存 | 组件 spec | `badge-team` |
| BDD-39 | badge 用现有色板 token，禁新增 hex/emoji | `bdd39_badge_no_new_hex_or_emoji`：badge 容器 style/class 不出现在设计的 token 集合之外（class 断言 `badge-team`；文案不含 emoji 范围字符） | 组件 spec | `badge-team` |
| BDD-40 | team entry 卡片隐藏 toggle 按钮（含 tooltip 提示） | `bdd40_team_entry_hides_visibility_toggle_*`（两视图）：teamId 非空 + isOwner → 全 DOM 中 `visibility-toggle` count=0；同卡 delete 仍存在 | 组件 spec | `visibility-toggle` |
| BDD-40 | store 层 toggleVisibility 对 teamId entry 拒绝 | `bdd40_store_toggle_rejects_team_entry`：team entry → toggleVisibility 返回 false 且不发 API；条目 isPublic 不变 | 组件 spec（store） | — |
| BDD-40 | UI 与 store 双保险 | `bdd40_entry_list_view_guard_consistent`：视图 toggle handler 对 team 项不调 store（store spy 未调用） | 组件 spec（视图） | — |
| BDD-41 | `?team={slug}` 且 slug ∉ myTeams（不存在/非成员）→ 统一「团队不可用」态 + 清除 CTA | `bdd41_unavailable_state_for_unknown_team_*`：URL team=未知/非成员 → 渲染 `team-unavailable`；点击清除 → 过滤清除、URL 恢复 | 组件 spec + E2E | `team-unavailable` / `team-unavailable-clear` |
| BDD-41 | 不调 listEntries（不可用态判定依赖 myTeams settle） | `bdd41_unavailable_does_not_call_list`：未知 team → entry store loadEntries 未被调用（team=me 聚合正常调用） | 组件 spec（视图） | — |
| BDD-41 | 成员但无内容 → 「该团队暂无内容」（`team-empty`）；我无任何 team 聚合 → 「暂无团队内容」（`teams-empty`） | `bdd41_empty_states_distinct`：三态文案两两可区分 | 组件 spec（视图） | `team-empty` / `teams-empty` |
| BDD-41 | FilterChip dismiss aria-label 参数化 | `bdd41_team_chip_aria_label`：团队 chip dismiss aria-label 含「移除团队过滤」与团队名 | 组件 spec（FilterChip 复测） | — |
| BDD-42 | UserMenu 含 Teams 项且可达 /teams | `bdd42_user_menu_teams_entry`：UserMenu 渲染含 Teams 项且导航到 /teams | 组件 spec（UserMenu） | `user-menu-teams-item` |
| BDD-42 | explore Teams tab 内「管理团队」链接存在且指向 /teams | `bdd42_manage_teams_link_dom`：explore 登录态可见管理团队链接 href=/teams | 组件 spec（视图） | `teams-manage-link` |
| BDD-42 | 路由 /teams 存在 + 守卫（未登录 → /） | `bdd42_teams_route_registered`：router 路由表含 /teams（守卫逻辑 P6 实跑） | 组件 spec（router 静态断言） | — |
| BDD-42 | owner 在 /teams 新建成功显示于「我拥有的」分区 | `bdd42_create_team_shown_in_owned`：createTeam 成功后 owned 分区含新卡（team store 联动） | 组件 spec（team store 动作 + 视图待 P6） | `teams-owned` / `team-create-form` / `team-name-input` |
| BDD-42 | 成员添加失败三类（username 不存在 / 已是成员 / 无权）三文案两两互异 | `bdd42_member_add_error_copy_distinct`：三种失败文案捕获后两两不等（store 层 error 传播）；断言互异不锁字面 | 组件 spec（team store） | `team-error` |
| BDD-42 | 删除 team 有确认对话框（含「内容将转为仅自己可见」后果提示）；退出需确认后从「我加入的」消失；owner 不显示退出按钮 | `bdd42_delete_confirm_and_leave_flow`：删除触发确认；离开动作调 leaveTeam 并从 joined 消失；owner 无退出按钮（组件 spec 覆盖 store/判断逻辑，DOM 层 P6 e2e 实跑） | 组件 spec（team store + E2E） | `teams-joined` / `teams-owned` |
| BDD-43 | 移动端 5-tab 可横向滚动（overflow-x）、tab 触达高度 ≥44px、tablist/aria-selected 语义 | `bdd43_mobile_tablist_overflow_min_height`：tab 容器 overflow-x 样式 / tab 高度 ≥44px / role=tablist + tab aria-selected（jsdom 断言 class+attr；滚动视觉由 P6 截图） | 组件 spec（视图，样式与语义断言）+ E2E（Mobile project） | `tab-all`…`tab-starred` |
| BDD-44 | detail 头部状态标签对 team entry 显示 team 语义（含「团队」/team 名），不显示「Private」；private 仍 Private、public 仍 Public | `bdd44_detail_status_tag_team_semantics`：team entry（isPublic=false + teamId）→ EntryDetailHeader 状态标签含「团队可见 ·」team 名、不含 Private；private（无 teamId）→ Private；public → Public（三态可区分） | 组件 spec（detail 载体组件：EntryDetailHeader/EntryMetaTagsBar 或等价渲染入口） | —（detail 标签按 §5.8 落 BaseBadge team 变体 → `badge-team`） |

## 红灯确认记录（P3 自检，实测 2026-09-02）

组件 spec 10 文件 vitest run 自跑：**24 failed | 13 passed（37），0 SyntaxError**——红灯全部为 B 类（被测未实现/缺模块）：
- search-url-team / base-badge-team / entry-card-team / entry-list-row-team / entry-list-store-team / user-menu-teams / filter-chip-team / detail-visibility-tag / entry-list-view-teams：断言级失败（缺字段/变体/容器/testid/守卫）。
- team-store：`@/stores/team` 模块不存在 → import 失败（B 类，P4 新增模块）。
- 13 passed = 现状行为基线（public/private 正例、非 team toggle、匿名重定向路径结构等），证明 spec 挂接正确。
- e2e 两 spec：esbuild 语法/结构通过；P3 期 /teams 页面与 teams API 未实现 → 运行失败属预期红灯。未声称跑绿。
- 状态标记：[PROD_NOT_TOUCHED]
