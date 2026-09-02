---
phase: P4
task_id: TPV0095
type: review
parent: P4-implementation.md
trace_id: TPV0095-P4-review-lead-20260902
status: approved
created: 2026-09-02
agent: review
---

# P4 专家组组长汇总 — TPV0095 team-visibility（review）

> 评审对象：`P4-implementation.md`（三批并行：mcp + frontend + backend，共享单文件分节落盘）
> 验收基线：`P1-requirements.md`（43 BDD + [SCOPE+] BDD-44 = 44 条验收线）
> 角色声明：本文件为专家组组长**汇总轮**，只汇总三位评审的判定，不发表新意见（组长规则 1）。
> 环境隔离：`[PROD_NOT_TOUCHED]`（全程只读 task 目录内评审/实现文件，未触碰生产 :8080 / ~/.peekview/ / pipx）

## 一、评审一结论摘要 — eng（`P4-review-eng.md`，backend + mcp 域）

**Status: approved**（无 BLOCKER；`[PROD_NOT_TOUCHED]`）

- **approved 理由**：原 r0 **rejected**（BLOCKER-1 share cookie 越权读 + BLOCKER-2 owner 读成员发布 entry 主路径不一致）→ r1 **needs-revision**（R1/R2 残留）→ r2 **approved**。R1（api `?share=` 分支 owner 404 → 200：entries.py:249-263 / files.py:380-400 双解析）与 R2（owner 星标成员发布 entry：star_service.py:371-382 `_build_star_item` 双解析补 owner 项）经隔离 tmp DB 实测核验通过。
- **方案 A owner 语义 10 表面矩阵实测全绿**（get/All/?team=me/?team={slug}/raw/?share=/cookie plain GET/download/files-content//stars/?starred=true × alice(owner) 200 vs carol(非成员) 404；anon ?share= 200 不变），无越权死角、无泄露、无新增不一致。
- **回归**：team+share 51 + star 36 + cookie/share/entry 111 passed；全量 1164 passed（1 预存 env-fail 已登记 known-failures）。
- **非阻断缺口（INFORMATIONAL）**：方案 A owner 语义对偶（成员发布 + owner 读 + /stars 一致性）尚无落仓回归用例——建议 P5 补权限矩阵用例或记 backlog；判定助手多处分形态有漂移风险（R3 backlog）。无新 [DESIGN_GAP] / [SCOPE+]。

## 二、评审二结论摘要 — design-review（`P4-review-design.md`，frontend 域）

**Status: approved**（无 BLOCKER；`[PROD_NOT_TOUCHED]`）

- **approved 理由**：原 needs-revision（rev1：F1 testid 同页重复 + F2 登出未 reset team store，违反 P2 §5.5-②）→ rev1 复审 **needs-revision**（F1 组件层修复正确 + F2 修复正确，但引出新 F3：P3 e2e BDD-38 chip 用例锚点孤儿化→静默 no-op）→ rev2 复审 **approved**（F3 修复核验通过）。
  - F1（`team-chip-{slug}` 同页双元素）→ row 按钮独立 testid `teams-chip-{slug}`，EntryListView.vue:57；
  - F2（登出未调 teamStore.reset()）→ auth.ts `logout()` + `peekview:auth-expired` 内建 `useTeamStore().reset()`（单点覆盖全部登出入口，无 import 环，无 spec 回归）；
  - F3（e2e 锚点孤儿化）→ `e2e/team-visibility.spec.ts` :106-107 锚点改 `teams-chip-proj-a`（1 行 selector，BDD-38 URL 表达实跑覆盖恢复）。
- **BDD-38~44 全部 approved**（5-tab 互斥/URL 恢复收敛/teams 管理页/toggle 守卫+badge/detail 三态/移动端+a11y），DESIGN_GAP×5 + SCOPE+×2 判定全部合理。
- **建议项 S1-S6 留 P6 视觉/键盘复核或技术债登记**（focus-visible 一致性 / UserMenu 布局 hack / pending 首次 load / owner=me+team 并存 / TeamsView 多卡成员列表 / .status-tag.team 视觉形），不阻断。
- 组件单测 110 files / 1338 passed + typecheck exit 0。

## 三、评审三结论摘要 — cso（`P4-review-cso.md`，安全域，三端）

**Status: approved**（无 CRITICAL / HIGH / BLOCKER；`[PROD_NOT_TOUCHED]`）

- **approved 理由**：STRIDE 矩阵全维度通过；dispatch-context 评审重点 7 项全部 ✅。
  - 全局 key 精确比对升级（`_is_global_api_key_auth` 请求时精确 == master key）——原「形似即放行」HIGH 降为无，三通道无绕过；
  - 防枚举彻底（404 化 + `?team=` 零信号 + username 添加 404，无 403 oracle）；
  - **BLOCKER-1 复验通过**（carol 登录 cookie + share cookie 双通道 plain GET/download/?share= 全 404，anon 外部访问者 200 保留，non-team private share 零回归）；
  - **BLOCKER-2/R1/R2 复验通过**（owner 全读面 200 + /stars 与 ?starred=true 两表面一致）；
  - store 守卫三层防线（UI 隐藏 + store 拒绝 + 服务端 D3 clamp）——客户端可绕过但服务端不可绕过，无安全缺口；
  - 数据泄露面（team 字段仅 owner/成员/全局 key 附，share 访问者置 None）与越权路径（star/download/files/raw/render/reads/teams 管理）全 ✅。
- **残余**：LOW×2（L1 detail 溢出菜单 "Make Public" 误导文案 / L2 旧库迁移 teams 表缺 `idx_teams_slug UNIQUE` 完整性降级非越权）+ INFO×3（I1 判定助手收敛 / I2 member_count N+1 低危 / I3 owner 语义回归用例缺口 + teams 无独立 rate limit），均不阻断发布，记 backlog。
- 全量回归 1164 passed / 3 skipped / 1 预存 env-fail（与本任务无关，known-failures 登记）。

## 四、专家组分歧检查

三位评审对 `P4-implementation.md` 判定**一致**：均为 `approved`、均无 BLOCKER / CRITICAL / HIGH、均 `[PROD_NOT_TOUCHED]`、均确认各自评审链（eng r0→r1→r2、design rev1→rev2、cso 独立复评）修复闭环且无新引入问题。**无专家组分歧**，不触发人工仲裁。

## 五、组长汇总判定

按组长规则逐条适用：

1. 任一评审标 BLOCKER / status=rejected → **不满足**（三位评审均无 BLOCKER、均 approved）
2. 评审分歧 → **不满足**（判定一致）
3. 全票无 BLOCKER → **成立**

→ **汇总 status: approved**。`P4-implementation.md` 可进入 P4 gate 与 P5。评审链修复已全部闭环（BLOCKER-1/2 → eng r0→r2；F1/F2/F3 → design rev1→rev2；cso 独立实测复核）；残余 LOW/INFO 与建议项 S1-S6、owner 语义回归用例缺口不阻断本 gate，按评审建议分别记 backlog / P5 补用例 / P6 视觉复核。

## 六、引用锚点

### BLOCKER 修复闭环列表

| 项 | 域 | 评审链 | 修复落点 | 闭合证据 |
|---|---|---|---|---|
| BLOCKER-1（share cookie 越权读：登录非成员 + share cookie 直读 team entry） | backend | eng r0 提出 → r1 确认修复 | entries.py/files.py `_check_share_cookie` + `_share_cookie_allowed_for_user` + `_resolve_entry` cookie fallback + download 同款 | eng r2 实测 carol+cookie plain GET/download → 404；cso 复验双通道 404、anon 200、non-team share 零回归 |
| BLOCKER-2（owner 读成员发布 team entry 主路径不一致） | backend | eng r0 提出 → r1 确认修复 | entry_service can_read/team_visible_expr owner 项（方案 A：owner = 团队可见范围成员） | eng r1 实测 owner 主路径全 200 |
| R1（api `?share=` 分支 owner 404 vs 成员 200 不一致） | backend | eng r1 提出 → r2 确认修复 | entries.py:249-263 / files.py:380-400 share 分支 is_team_owner 双解析 | eng r2 实测 alice(owner)+?share= → 200，cookie/query 双通道一致化 |
| R2（owner 星标成员发布 entry：/stars 缺 vs ?starred=true 含） | backend | eng r1 提出 → r2 确认修复 | star_service.py:371-382 `_build_star_item` team_owner_exists 双解析 | eng r2 实测两表面均含 e2-member；cso 复验一致 |
| F1（`team-chip-{slug}` 同页双元素 testid 冲突） | frontend | design rev1 提出 → rev2 确认修复 | EntryListView.vue:57 row 按钮独立 `teams-chip-{slug}` | rev2 实测 row 与 FilterChip 互异同存；自检 spec 断言 |
| F2（登出未调 teamStore.reset()，跨账号 myTeams 残留） | frontend | design rev1 提出（违反 P2 §5.5-②）→ rev2 确认修复 | auth.ts `logout()` + `peekview:auth-expired` 内建 `useTeamStore().reset()` | rev2 实测无环、无 spec 回归、reset 语义完整 |
| F3（F1 修复致 P3 e2e BDD-38 chip 锚点孤儿化 → 静默 no-op） | frontend | design rev1 提出 → rev2 确认修复 | `e2e/team-visibility.spec.ts` :106-107 锚点 `team-chip-proj-a` → `teams-chip-proj-a` | rev2 核验首载即命中元素，BDD-38 URL 表达实跑覆盖恢复 |

三轮修复共覆盖：cookie 判别（entries/files）、can_read/team_visible_expr owner 项（entry_service）、api share 分支 owner 项（entries/files）、star_service owner 项、前端 testid 去重、登出 store reset、e2e 锚点对齐。BLOCKER 清单当前为空。

### BDD 覆盖

- 44 条 BDD（BDD-1~43 + [SCOPE+] BDD-44）在 P4 实现与评审中全部落锚：
  - backend 权限/teams API/防枚举/share/star/生命周期/迁移/校验/竞态/兼容与性能（BDD-1~34）→ eng 评审 approved（team+share 51 + star 36 + cookie/share/entry 111 passed，全量 1164 passed）与 cso STRIDE/7 重点全 ✅；
  - MCP（BDD-35~37）→ eng 评审覆盖（mcp 批 277 passed，team-visibility 10/10 转绿）；
  - 前端 UI（BDD-38~44）→ design 评审逐条 approved（8/8），组件单测 1338 passed + e2e 锚点修复闭环。
- **非阻断缺口（评审一致标记）**：方案 A owner 语义对偶（成员发布 + owner 读全路径 + /stars 一致性）依赖评审实测矩阵，**无落仓回归用例**（eng INFORMATIONAL + cso I3）——建议 P5 补权限矩阵用例固化，防未来回归。

## 附：环境隔离声明

[PROD_NOT_TOUCHED]
