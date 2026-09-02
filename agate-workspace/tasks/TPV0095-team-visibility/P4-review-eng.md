---
phase: P4
task_id: TPV0095
type: review
parent: P4-implementation.md
trace_id: TPV0095-P4-review-eng-20260902-r2
status: approved
agent: review
---

# P4 实现评审（复审 r2 终审）— TPV0095 team-visibility（backend + mcp 域）

> 复审对象：R1/R2 残留修复（api 层 `?share=` 分支 + star_service `_build_star_item` 补 team_owner_exists）
> 状态标记：[PROD_NOT_TOUCHED]（只读评审 + 隔离 tmp DB 全矩阵实测，未触碰生产 :8080 / ~/.peekview/ / pipx）
> 结论：**approved** — R1/R2 修复正确，方案 A owner 语义已在全部读/列表表面传播（10 表面实测全绿）；无新引入问题。team/share/star/entry 相关 198 passed（51 team+share + 36 star + 111 cookie/entry 子集，部分重叠），全量 1164 passed（1 预存 env-fail，known-failures 登记）。

## 复审判定总览

| 项 | 结论 |
|---|---|
| R1（api `?share=` 分支 owner 404 vs 成员 200） | ✅ 已修复（实测 alice(owner)+?share= → 200） |
| R2（owner 星标成员发布 entry：/stars 缺 vs ?starred=true 含） | ✅ 已修复（实测两表面均含） |
| 方案 A owner 语义全路径传播 | ✅ 10 表面矩阵全绿（见下） |
| 新引入问题 | 无（cookie/query 通道 owner 行为一致化、carol 防枚举面保持 404、anon share 语义不变） |
| 回归 | team 51 + star 36 + cookie/share/entry 111（子集重叠）全 passed；全量仅 1 环境性失败 |

## 一、R1 修复核验（通过）

修复落点（实读确认）：
- `entries.py:238` import 加 `team_owner_exists`；`get_entry` share 分支（:249-263）`is_team_member`/`is_team_owner` 双解析（entry.team_id 非空才查），正常访问条件 `is_admin or owner or is_team_member or is_team_owner`。
- `files.py:380-400` `resolve_entry_raw` share 分支同款（双解析 + owner 项入正常访问条件）。
- 语义：`?share=` 分支 docstring 明示「team owner counts as team-scope reader（方案 A, mirrors can_read）」——owner 对成员发布 team entry 的 share 通道行为与主读路径一致。

实测（隔离 tmp DB，bob 发布 E2 到 alice 的 team，alice 非 entry owner 非成员行）：
- alice(owner) `?share=` E2 → **200**（此前 404）；bob(entry owner/member) `?share=` → 200；alice `+cookie` plain GET → 200；carol `?share=` → 404；anon `?share=` → 200（share 对外语义不变）。
- cookie/query 两通道 owner 行为一致化（R1 关联问题闭合）。

## 二、R2 修复核验（通过）

修复落点（实读确认）：
- `star_service.py:14` import 加 `team_owner_exists`；`_build_star_item`（:371-382）`is_team_member`/`is_team_owner` 双解析，可见性条件 `public or own or archived or member or owner`。

实测（隔离 tmp DB）：alice star E2 → `/api/v1/stars` **含** e2-member 且 `?starred=true` **含**（两表面一致，此前 /stars 缺）；bob(成员) 两表面行为不变。方案 A 星标闭环（star POST 经 get_entry 放行 → 列表可见）完整。

## 三、方案 A owner 语义 10 表面矩阵（实测全绿）

成员 bob 发布 file-bearing E2 到 alice(owner) 的 team proj-a：

| 表面 | alice(owner) | carol(非成员) |
|---|---|---|
| get /entries/{slug} | 200 | 404 |
| All 列表 | 含 E2 | 不含 |
| ?team=me | 含 E2 | 不含 |
| ?team={slug} | 含 E2 | （BDD-10 零信号空，另测） |
| raw | 200 | 404 |
| ?share= | 200 | 404 |
| cookie plain GET | 200 | 404 |
| download | 200 | （404，早轮实测） |
| files-content | 200 | （404，早轮实测） |
| /stars（star 后） | 含 E2 | （不含，早轮 BDD-15） |
| ?starred=true | 含 E2 | （不含，早轮实测） |

anon ?share= → 200 不变（share 对外部访问者语义未破坏）。get/All/team=me/team=slug/raw/?share=/cookie/download/files-content//stars/Starred tab 全路径无 owner 死角、无 carol 越权。✅

## 四、回归与新增测试缺口（INFORMATIONAL，不阻断）

- pytest：team+share 6 文件 **51 passed**；star 套件 **36 passed**；share_cookie/access/security/lifecycle + entry_lifecycle/service + raw_share_purify **111 passed**（与 team/star 有子集重叠）；合计覆盖本次修复相关面，零回归。
- 全量（implementer 记录）：1164 passed / 3 skipped / 1 env-fail（沙箱 ~/.peekview 只读，known-failures 预存）。
- **缺口（不阻断，建议 P3 补或记 backlog）**：方案 A owner 语义（owner 读成员发布 team entry 全路径 + /stars 一致性）尚无**落仓回归测试**——现仅 implementer 临时脚本（14/14，已删）+ 本评审矩阵实测覆盖；既有 P3 用例场景均以 alice 为 entry owner（owner 发布），未含「成员发布 + owner 读」对偶。建议补一条权限矩阵用例（成员发布 E2 → owner 全路径 200 + carol 404 + /stars 与 ?starred=true 一致），防未来回归。同 R3（判定助手收敛）记 backlog 即可。
- 无新 [DESIGN_GAP] / [SCOPE+]：R1/R2 修复严格沿用方案 A 判定形态（team_owner_exists 复用），无自主歧义。

## 五、结论

R1/R2 修复正确，方案 A「owner=团队可见范围成员」语义已传播到全部读/列表表面（api share 分支、cookie 通道、star_service /stars），10 表面隔离实测全绿，carol 防枚举面与 anon share 外部访问语义保持，无新越权/泄露/不一致。team/share/star/entry 相关测试零回归。

**Status: approved**

> 附：BLOCKER-1（share cookie 越权读）与 BLOCKER-2（owner 读成员发布 entry 主路径不一致）经 r1 复审已确认修复（carol+cookie → 404、owner 主路径全 200），本终审确认 R1/R2 残留闭合——三轮修复共覆盖：cookie 判别（entries/files）、can_read/team_visible_expr owner 项（entry_service）、api share 分支 owner 项（entries/files）、star_service owner 项。整体 P4-review-eng 结论：**approved**。
