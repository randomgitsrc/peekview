---
phase: P4
task_id: TPV0095
type: review
parent: P4-implementation.md
trace_id: TPV0095-P4-cso-20260902-r2
status: approved
agent: cso
reviewed_domain: security
production_status: PROD_NOT_TOUCHED
severity: none-critical-high
blocking: false
---

# P4 安全评审（cso）— TPV0095 team-visibility（backend + frontend + mcp 三端）

> 状态标记：[PROD_NOT_TOUCHED]（只读评审 + 隔离 tmp sqlite `create_app` 实测；未触碰生产 :8080 / ~/.peekview/ / pipx peekview；未改代码）
> 评审基线：P1 BDD-1~15/21/22/27~30/36（安全线）+ P2 §3 权限收敛/D1-D5 + §3.3 teams API 404 + dispatch-context-cso 评审重点 7 项
> 评审对象：工作树 P4 实现（P4 未 commit，实审 diff 461936ad..working）+ eng 评审链 BLOCKER-1/2/R1/R2 修复后代码
> 前置交叉引用：eng review r0（rejected：BLOCKER-1 cookie 越权读 + BLOCKER-2 owner 读不一致）→ r1（needs-revision：R1/R2 残留）→ r2（**approved**，方案 A owner 语义 10 表面矩阵实测全绿）。本 cso 在 r2 修复后代码上独立复评全部安全面。
> 实测方法：隔离 `create_app` + ASGITransport httpx，多客户端 cookie/auth 通道分离（注册/登录关闭 captcha，rate-limit off，DB/data 全 tmp）。

## 结论摘要

| 维度 | 判定 |
|---|---|
| can_read authz（member/owner/admin/anon 矩阵 + owner 语义） | ✅ approved |
| 防枚举（404 化 + ?team= 零信号 + username 添加 404） | ✅ approved |
| 全局 key 精确比对升级（绕过风险评估） | ✅ approved（无新增绕过） |
| share cookie 越权修复验证（BLOCKER-1 复验） | ✅ 已修复（双通道实测 404） |
| store 守卫（前端 toggle） | ✅ approved（UI 隐藏 + store 拒绝 + 服务端 D3 clamp 三层） |
| mcp team_id schema / list_teams | ✅ approved |
| 数据泄露（team 字段只在 owner/成员/全局 key 附；share 访问者不附） | ✅ approved |
| 越权路径（star/download/files/raw/render/reads/teams 管理） | ✅ approved |

无 CRITICAL / HIGH / BLOCKER。残余 LOW×2 + INFO×3（详见 §4），不阻断发布。

## 1. STRIDE 矩阵

| 威胁类别 | 面 | 评审结论 | 严重性 |
|---|---|---|---|
| **Spoofing（身份伪造）** | `_is_global_api_key_auth` 升级：请求时 `config.server.api_key` **精确比对**（X-API-Key / Bearer 非 JWT 非 pv_ / 裸 Authorization 三通道），`pv_` 用户级 key 永不 global | 修复前「形似非 pv_ 即 global」启发式 + 启动快照 → 任意非 pv_ 字符串即可绕过 owner 判定；现改为 master key 精确比对。mw 未配置时裸 Authorization 需精确等于 master key，无「形似即放行」 | ✅ 已修复（原 HIGH → 无） |
| | cookie/JWT 身份 vs 全局 key header | header 优先于 cookie（auth.py 三层 + entries/files 均先查 header）——请求时配置读取 + 精确比对无注入点（`app.state.config` 仅测试内 mutate，生产配置静态） | ✅ 无 |
| **Tampering（篡改）** | update D3 clamp：`is_public=true` + team 附着 → 落库强制 false（实测 200 但 is_public=false + team 保留） | PATCH 剥离 team 需显式 `team_id=None`（team_id_set sentinel 区分），D4 撤销 share 仅在真实转 public 时触发 | ✅ 无 |
| | create/update `team_id` 非空 → `_resolve_team_for_user` 422 统一（不区分存在性/成员/匿名），绝不静默忽略 | 匿名 + team_id → 422；member 口径（owned/joined 皆可）一致 | ✅ 无 |
| **Repudiation** | 读写审计走既有 read_tracking（entries/files 路径记录 reader）；本任务未引入新写权面 | — | ✅ 无 |
| **Information Disclosure（信息泄露）** | team 字段只对 owner/member/admin/全局 key 附；share 访问者 cookie/query 响应 `team_id/team` 置 None（_check_share_cookie + get_entry_with_share） | 实测 member get/raw team 非 null；anon/share 访问者 team=null | ✅ 无 |
| | 非成员探测：get/raw/content/download/render/star/reads 一律 404（非 403） | carol 全 404；匿名 list 不含；`?team=` anon/carol/不存在全 200 空 items（BDD-10 零信号实测） | ✅ 无 |
| | 详情溢出菜单 team entry "Make Public" 文案误导（isPublic=false 显示 Make Public） | 点击被 store 守卫拦（toast+return false），**不构成越权**；服务端 D3 双保险。仅文案/UX 误导 | LOW |
| **Denial of Service（拒绝服务）** | teams `?team=` slug 解析 + team_visible_expr 两 EXISTS 子查询；索引 idx_entries_team_id / idx_team_members_user_id 齐备（新库 + 迁移）；BDD-26 EXPLAIN 断言 | 新增读路径查询量级 O(1) EXISTS，无逐行子查询；分页 N+1 未新增 | ✅ 无 |
| | teams 管理接口无独立 rate limit（仅 require_auth 登录门槛） | 与 share/apikey 管理同类（登录即限），非本任务放大 | INFO |
| **Elevation of Privilege（提权）** | can_read = is_public OR admin OR owner OR team member OR team owner（方案 A owner 语义） | member 发布 + owner 读对偶：get/All/team=me/team=slug/raw/content/download 全 200（实测） | ✅ 无 |
| | **share cookie 越权（原 BLOCKER-1）**：登录非成员 + share cookie 直读 team entry | `_share_cookie_allowed_for_user` + `_check_share_cookie` 判别 + files.py `_resolve_entry` cookie fallback + download 同款。实测 carol（登录 cookie + share cookie）plain GET/download → 404；?share= → 404；anon 外部访问者 → 200（保留）；non-team private share 零回归（bob → 200 + team=null） | ✅ 已修复 |
| | team owner 语义传播（原 BLOCKER-2/R1/R2）：entries get_entry share 分支 + files resolve_entry_raw + star_service._build_star_item 双解析 team_owner_exists | 实测 alice（owner 非 member 行）全读面 200；/stars 与 ?starred=true 两表面一致 | ✅ 已修复 |
| | teams 管理写权仅 owner：rename/delete/member add/remove 非 owner 404 | admin **不接管**（实测 admin rename/delete/detail → 404；admin 读 team entry 200） | ✅ 无 |
| | 写权判定（update/delete）owner/admin 不变（不进 can_read）；团队 entry 成员不可 update/delete 他人发布 | 与设计 §0.2-1 一致；write owner 判定不含 team owner（成员发布的 entry 仅发布者+admin 可写） | ✅ 无（设计边界） |

## 2. 评审重点逐项结论（dispatch-context 7 项）

1. **authz bypass / 提权（can_read_entry + teams owner 判定 + admin 不接管）**：✅ 通过。can_read 收敛 get_entry 非 archived 分支 + team_visible_expr（member OR owner）覆盖 list/starred；teams 路由无权一律 404；admin 读可见但无管理权（实测）。
2. **防枚举（404 化彻底性 + ?team= 零信号）**：✅ 通过。share 三接口 403→404；teams 9 路由无权/不存在/username 不存在 → 404 统一；?team= anon/非成员/不存在 → 200+空 items 同构（实测 6 组响应一致）；`?team=me` 匿名 200 空。无 403 残留 oracle（grep + 实测）。
3. **全局 key 精确比对升级（_is_global_api_key_auth）**：✅ 通过，无绕过。请求时精确 `==` master key；移除「非 pv_ 即 global」宽松判定；`current_user` 短路移除使 header 覆盖 cookie。绕过风险评估：X-API-Key/Bearer/裸 Authorization 三通道均需精确匹配配置值，无「形似」路径；pv_ 用户级 key 仅等效 JWT 身份（member 权限），实测 carol 无关者 pv_ 不可读 team entry。配置注入点：读取 `app.state.config.server.api_key`，无用户可控写入路径（测试内 mutate 仅测试隔离）。
4. **输入验证（team_id 注入/非法、username、slug 冲突）**：✅ 通过。team_id 仅 slug 形态（service `_resolve_team_for_user` 查 Team.slug，非拼接 SQL）；create/update 422 统一文案不泄露；name/slug 校验（空/超长/owner 内重名 400）；add_member username 404 与无权同语义；slug `-N` 冲突重试。
5. **数据泄露（team 字段响应仅 owner/成员/全局 key 附；share 访问者不附）**：✅ 通过。EntryResponse/ListItem/StarItem/EntryRaw 的 team 字段：list_entries 页级 team_map 只对可见项附加（可见性由查询条件保证）；share 访问者 cookie/query 两通道 team 置 None（实测 team=null）。raw 全局 key 分支解析 team（全局 key 可读一切 → 附 team 属正常）。
6. **越权路径（star 通道、download/files/raw/render/reads）**：✅ 通过。star 需先 get_entry（不可读 404 → 不可自授权）；unstar 已星标直删（读权门槛不延伸，与既有语义一致）；carol star team entry → 404（实测）；download 走 get_entry + cookie 判别；files content/render/download `_resolve_entry` cookie fallback 已加 `_share_cookie_allowed_for_user`；reads owner/admin 判定 404（实测）。
7. **store 守卫（前端 toggleVisibility teamId 拒绝可绕过性）**：✅ 通过。三层防线：① EntryCard/EntryListRow `v-if="!entry.teamId"` 隐藏 toggle（delete 保留）；② store `toggleVisibility` 顶部 `if (entry.teamId) toast+return false`（EntryListView + detail overflow 共用此 store）；③ **服务端 D3 clamp**：即使绕过 UI 直发 PATCH `is_public=true`（如 `api.toggleEntryVisibility`），team 附着时落库仍强制 is_public=false + team 保留（实测）。→ 客户端守卫可绕过但服务端不可绕过，无安全缺口；detail 溢出菜单 item 文案误导（LOW，见下）。

## 3. 跨面一致性 / 回归核验

- **7 读路径 × actor 矩阵**（BDD-2/5 语义）：member/owner get/list/raw/content/render/download 200；carol 全 404；anon 见 public 仅。download 空文件改 200（BDD-5 fileless member download）——无越权面（空 zip 不含内容）。实测补齐 content/download。
- **share 生命周期**（BDD-13）：share token 不受成员变动/team 删除影响（test_share_team 覆盖，实测同）。
- **owner 语义回归测试缺口**：方案 A 修复（member 发布 + owner 读对偶 + /stars 一致性 + carol cookie 通道）依赖 eng r2 全矩阵实测，**无落仓回归用例**（eng 终审同判 INFORMATIONAL）。建议 P5 补权限矩阵用例固化（非阻断）。
- **判定助手收敛**：team entry 可读判定现 4~5 处共享同形态（`_share_cookie_allowed_for_user` + entries/files share 分支 + star_service + can_read/expr），未来新增读端点有漂移风险（eng R3 backlog）。
- 全量回归：`make test-quick` = 1164 passed / 3 skipped / 1 预存 env-fail（`test_cli_remote` 沙箱 `~/.peekview` 只读，known-failures 登记，与本任务无关）。

## 4. 残余发现

| # | 级别 | 位置 | 描述 |
|---|---|---|---|
| L1 | LOW | `backend/peekview/api/teams.py` + useEntryDetailActions | detail 溢出菜单对 team entry 仍显示 "Make Public"（isPublic=false 的误导文案，P2 §0.2-8 声明不改菜单项、靠 store 守卫拒绝）。点击 → store 守卫 toast+return false，**不越权**。建议 P6 文案复核或改为对 teamId 隐藏该项 |
| L2 | LOW | `database.py _run_migrations` raw teams 表 | 旧库升级迁移段建 `teams` 表**未补 `idx_teams_slug UNIQUE`**（metadata `idx_teams_slug` unique 仅新库 create_all 生效）。旧库升级后无 DB 层 slug 唯一兜底——`team_service` slug `-N` 冲突重试仅靠应用层 IntegrityError 探测 + 预检，多数场景自愈；属**完整性降级非越权**（无权限旁路）。建议后续补 `CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug)` |
| I1 | INFO | `_shared.py`/entries/files/star_service | team 可读判定多处共享形态（`team_membership_exists`+`team_owner_exists` 组合），第四处起的漂移风险已由 eng R3 指出；建议收敛单点助手（backlog） |
| I2 | INFO | `team_service._member_count` / list `_summary` | member_count 每行 COUNT 查询（列表页 owned/joined 小规模，N+1 低危）；BDD-26 只锁 entries/team_members 主路径索引 |
| I3 | INFO | 测试覆盖 | owner 语义对偶修复 + carol cookie 通道无独立落仓回归用例（eng r2 全矩阵为手工实测）；teams 管理接口无独立 rate limit（与既有 share/apikey 管理一致） |

无 CRITICAL / HIGH / BLOCKER。

## 5. 定稿

- **Header status: approved**（无 CRITICAL/HIGH/BLOCKER；原 BLOCKER-1/2 已由 eng 评审链 r0→r1→r2 修复并经本 cso 独立实测复核）
- 残余 L1/L2 为 LOW（建议项，不阻断发布）；I1-I3 为 INFO（技术债/回归用例建议，记 backlog）
- [PROD_NOT_TOUCHED]：评审全程只读 + 隔离 tmp sqlite create_app 实测，未触碰生产 :8080 / ~/.peekview/ / pipx peekview
