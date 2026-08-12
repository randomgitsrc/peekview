---
phase: P7
task_id: T080-admin-user-management
trace_id: T080
type: consistency
parent: P6-acceptance.md
status: draft
agent: consistency-reviewer
created: 2026-08-06
---

# T080 P7 — 一致性审查报告

## 审查范围

P1-requirements.md + P2-design.md + P4-implementation.md + P5-test-results/unit.md + P5-test-results/e2e.md + P6-acceptance.md + P4-review.md + P4-review-review.md + P4-review-design-review.md + P4-review-cso.md。

审查方式：双向交叉检查（设计→实现 + 实现→设计），逐条配对 DESIGN_GAP + SCOPE+ 闭环 + 跨文件一致性 + 未决项清零。关键断言已 grep 实际代码确认。

## [PROD_NOT_TOUCHED]

全程只读代码 + grep 验证 + 写产出文件，未启动服务、未写实现代码、未触碰 :8080 / ~/.peekview/。

## 方向1：设计→实现（P2 逐项对照实现）

| P2 设计项 | P4 实现 | 状态 |
|-----------|---------|------|
| §1 UserBase +disabled_at/disabled_by/disabled_reason | models.py 审计字段新增 | [OK] |
| §1 UserResponse +disabled_at/disabled_by | models.py UserResponse 扩展 | [OK] |
| §1 新增 UserListResponse {items,total,page,per_page} | models.py UserListResponse | [OK] |
| §1 DisableUserRequest schema (reason max_length=500) | models.py DisableUserRequest | [OK] |
| §2 migration 幂等（PRAGMA check + ALTER TABLE） | database.py:100-110 | [OK] |
| §3 _check_self_operation helper | admin_service.py | [OK] |
| §3 _check_last_active_admin helper（is_admin AND is_active） | admin_service.py:351 `if user.is_admin and user.is_active:` — grep 确认 | [OK] |
| §3 disable_user/enable_user/promote_user/demote_user | admin_service.py 4 新方法 | [OK] |
| §3 list_users 改返回 UserListResponse | admin_service.py + api/admin.py response_model | [OK] |
| §3 delete_user 补 LastAdmin 保护 | admin_service.py:452 _check_last_active_admin | [OK] |
| §3 delete_user 清理 disabled_by FK（P4 重试 #2 CRITICAL 2 修复） | admin_service.py:468 `sa_update(User).where(User.disabled_by == user_id).values(disabled_by=None)` — grep 确认 | [OK] |
| §4 4 个 POST toggle 端点 + require_admin | api/admin.py 4 端点 | [OK] |
| §5 delete_self 移除 confirm_username 旁路（决策 A） | api/auth.py grep confirm_username → 无匹配（exit 1）— 确认移除 | [OK] |
| §5 admin 计数加 is_active=True（决策 B） | api/auth.py count 查询含 is_active | [OK] |
| §6 CLI user disable/enable 子命令 | cli.py 新增 | [OK] |
| §6 CLI demote 补 LastAdmin 保护 | cli.py:1620-1628 count check | [OK] |
| §6 CLI disable 补 LastAdmin 保护（P4 DESIGN_GAP #3 决策 D） | cli.py:1654-1662 count check | [OK] |
| §7 router.ts /admin route（在 /:slug 前） | router.ts:27-31 — grep 确认 requiresAdmin | [OK] |
| §7 beforeEach requiresAdmin 守卫（waitForAuthInit 之后） | router.ts:92 `if (to.meta.requiresAdmin)` | [OK] |
| §7 AdminView.vue 用户列表+分页+OverflowMenu+ConfirmDialog | AdminView.vue 新建 | [OK] |
| §7 PasswordResetDialog.vue 新建（input+show/hide+≥8+alertdialog+focus） | PasswordResetDialog.vue 新建 | [OK] |
| §7 api/client.ts admin API 方法组 | client.ts 7 方法 | [OK] |
| §7 types/index.ts User +disabledAt + UserListResponse | types/index.ts + api/types.ts | [OK] |
| §7 BaseBadge disabled/admin variant | BaseBadge.vue | [OK] |
| §7 Toast aria-live 按 variant 动态（error=assertive） | Toast.vue item 级 aria-live | [OK] |
| §7 ConfirmDialog 文案 spec（删除/禁用两组） | AdminView.vue ConfirmDialog 用法 | [OK] |
| §7 OverflowMenu disabled prop 绑定 pendingOp（P4 重试 #2 MUST-FIX 4 修复） | AdminView.vue:41 `:disabled="!!pendingOp"` — grep 确认 | [OK] |
| §7 --space-7 CSS 变量（P4 重试 #2 MUST-FIX 5 修复） | AdminView.vue:305,311 `var(--space-7)` — grep 确认；`space-8` 无匹配 | [OK] |
| §7 AdminView 移除 "public" badge（P4 重试 #2 MUST-FIX 3 修复） | grep `status="public"` AdminView.vue → exit 1（无匹配）— 确认移除 | [OK] |

**方向1 结论**：P2 设计全部落地，无遗漏。P4 重试 #2 的 5 个 BLOCKER 修复均已 grep 确认。

## 方向2：实现→设计（代码变更对照设计，找僵尸需求/废弃约束）

| P4 实现项 | P2 设计来源 | 状态 |
|-----------|-------------|------|
| api/auth.py delete_self 改造 | P2 §5（决策 A+B） | [OK] 在设计内 |
| OverflowMenu.vue 新增 disabled prop | P2 §7 line 402 明确要求 + P4 review MUST-FIX 4 | [OK] 在设计内 |
| Toast.vue aria-live 改造 | P2 §7 Toast aria-live spec | [OK] 在设计内 |
| api/types.ts UserApiResponse 扩展 | P2 §7 types/index.ts 镜像（实现拆分 api/types.ts 属实现细节） | [OK] 在设计内 |
| AdminView disabledAt 展示（formatDisabledAt） | P2 §7 SHOULD-FIX（P4 review SHOULD-FIX 2） | [OK] 在设计内 |
| PasswordResetDialog Escape 关闭 | P2 §7 未显式要求，P4 review SHOULD-FIX 3 | [OK] 增强项，未超出范围 |
| AdminView data-testid 属性（P5 E2E 修复） | P2 未声明，P5 E2E 选择器对齐需求 | [OK] 测试契约修复，非功能变更 |

**方向2 结论**：无僵尸需求、无废弃约束、无 [EXTENSION] 超出 P2 范围的实现。所有 P4 实现项均可追溯到 P2 设计或 P4 review 修复项。

## DESIGN_GAP 配对（P4 §DESIGN_GAP → P7 转抄 + REVIEWED）

### [DESIGN_GAP: BDD-06 与 BDD-10 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

- **P4 原始标记行**（P4-implementation.md §[DESIGN_GAP]）：
  > [DESIGN_GAP: BDD-06 与 BDD-10 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]
  >
  > BDD-06（sole admin self-disable）预期 400（self-op），BDD-10（same scenario）预期 409（LAST_ADMIN）。两者设置相同（1 admin, self-disable），预期不同。
- **决策**：决策 C — LastAdmin 检查在 self-op 之前。BDD-06 测试预期从 400 改为 409。
- **P1 同步**：P1-requirements.md BDD-06 Then 已标注"注：sole admin 自操作时 LastAdmin 保护优先，返回 409 (LAST_ADMIN)；多 admin 场景下自操作返回 400 (VALIDATION_ERROR)"。
- **P6 验收**：BDD-06 PASS，BDD-10 PASS。
[DESIGN_GAP_REVIEWED: 已解决] — 配对结论。LastAdmin-first 语义统一，P1/P4/P6 三方一致。

### [DESIGN_GAP: test_admin_cannot_delete_self 与 BDD-23 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

- **P4 原始标记行**（P4-implementation.md §[DESIGN_GAP]）：
  > [DESIGN_GAP: test_admin_cannot_delete_self 与 BDD-23 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]
  >
  > test_admin_cannot_delete_self（T011 旧测试，1 admin self-delete）预期 400（self-op），BDD-23（T080 新测试，same scenario）预期 409（LAST_ADMIN）。
- **决策**：决策 C — LastAdmin 检查在 self-op 之前（与 disable/demote 一致）。test_admin_cannot_delete_self 测试预期从 400 改为 409。同类修复 test_t082_errors.py。
- **P6 验收**：BDD-23 PASS。
[DESIGN_GAP_REVIEWED: 已解决] — 配对结论。旧测试对齐新语义，delete/disable/demote 三者 LastAdmin-first 一致。

### [DESIGN_GAP: BDD-24 与 BDD-17/18 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]

- **P4 原始标记行**（P4-implementation.md §[DESIGN_GAP]）：
  > [DESIGN_GAP: BDD-24 与 BDD-17/18 测试预期矛盾] — [DESIGN_GAP_REVIEWED: 已解决]
  >
  > BDD-24（CLI disable sole admin）预期拒绝（exit≠0），BDD-17/18（CLI disable sole admin，first user auto-admin）预期成功（exit=0）。两者实际场景相同（1 admin user via CLI）。
- **决策**：决策 D — CLI user_disable 加 LastAdmin 检查（参照 user_demote 模式）。BDD-17/18 测试 setup 调整为先创建 admin 用户再创建普通用户。
- **P6 验收**：BDD-17 PASS，BDD-18 PASS，BDD-24 PASS。
[DESIGN_GAP_REVIEWED: 已解决] — 配对结论。CLI disable 与 demote/delete 统一 LastAdmin 保护，BDD-17/18 setup 修正后无矛盾。

### [DESIGN_GAP: BDD-01 rate limit 环境问题] — [DESIGN_GAP_REVIEWED: 已解决]

- **P4 原始标记行**（P4-implementation.md §[DESIGN_GAP]）：
  > [DESIGN_GAP: BDD-01 rate limit 环境问题] — [DESIGN_GAP_REVIEWED: 已解决]
  >
  > BDD-01 创建 26 个用户（1 admin + 25 normal），但 /api/v1/auth/register 端点有 10/minute rate limit。测试在单次运行中创建 26 个用户触发 429。
- **决策**：决策 E — BDD-01 测试改用直接插 DB 创建 25 个普通用户（_create_user_direct helper），绕过 register rate limit。Admin 用户仍通过 API 注册。
- **P6 验收**：BDD-01 PASS（screenshots/bdd-01-desktop.png + bdd-01-mobile.png + vision-reports/bdd-01.yaml）。
[DESIGN_GAP_REVIEWED: 已解决] — 配对结论。测试手段调整，不影响功能验收有效性。

**DESIGN_GAP 配对总数**：P4 声明 4 个，P7 转抄 4 个，全部 [DESIGN_GAP_REVIEWED: 已解决]。

## SCOPE+ 闭环

- **P1-requirements.md**：无 [SCOPE+] 标记。P1 §4 待确认清单 8 项全部 [CONFIRMED]。
- **P2-design.md §[SCOPE+] 检查**：声明"无。P2 设计中未发现 P1 未预见的必须做的事。"
- **P4-implementation.md §[SCOPE+]**：声明"无。所有改动均在 P2-design.md 范围内。"

[SCOPE_RESOLVED: 无 SCOPE+ 增补]。P1→P2→P4 全链路无新隐含需求增补，基线稳定。

## 跨文件一致性

### P2§packages vs P8 release 范围

- **P2 声明 packages**（P2-design.md §声明字段）：`backend/peekview`（主包）+ `frontend-v3`（前端独立构建产物，不独立发版）。
- **P8 release 范围**：P8 产出文件尚未生成（P7 是 P8 前置）。VERSIONS.json 当前 peekview=0.16.0, mcp_server=0.10.0。T080 改动仅涉及 backend/peekview + frontend-v3，不涉及 packages/mcp-server（P1 §1 明确"MCP 不暴露 admin 能力"）。
- **一致性**：[OK]。P8 bump 范围应仅 peekview 主包版本（backend/peekview + frontend-v3 static 重建），MCP 版本不变。

### P1§BDD vs P6 验收结果

- **P1 BDD 数量**：24 条（BDD-01 ~ BDD-24），grep `^#### BDD-` 计数 = 24。
- **P2 BDD 覆盖映射表**：24 条（P2 §BDD 覆盖映射），grep `^| BDD-` 计数 = 24。
- **P6 PASS 数量**：24 条，grep `^- PASS BDD-` 计数 = 24。
- **数量匹配**：[OK] 24 = 24 = 24。
- **内容抽检**：
  - BDD-01（列表分页）→ P6 PASS，截图 bdd-01-desktop.png + bdd-01-mobile.png + vision-reports/bdd-01.yaml
  - BDD-12（重置密码）→ P6 PASS，截图 bdd-12-reset-dialog-desktop.png + vision-reports/bdd-12.yaml
  - BDD-14/15（路由守卫）→ P6 PASS，截图 + assertion.log + vision-reports
  - BDD-24（CLI disable LastAdmin）→ P6 PASS，bdd-24-cli.log
- **内容一致性**：[OK]。BDD 编号、描述、验收证据三方对应，无错位。

### P4§impl-path vs P2 方案设计

- **P4 改动清单**（P4-implementation.md §改动清单）：14 个文件（后端 6 + 前端 8）。
- **P2 packages 声明**（P1 §6 packages + P2 §影响域分析）：backend/peekview 6 文件 + frontend-v3 6 文件 + exceptions.py（可能复用）+ stores/auth.ts（已存在）。
- **差异分析**：
  - P4 实际改 api/auth.py — P2 §5 详细设计了 delete_self 改造，属设计内。
  - P4 实际改 OverflowMenu.vue（新增 disabled prop）— P2 §7 line 402 明确要求 OverflowMenu 触发器 :disabled，P4 review MUST-FIX 4 触发，属设计内。
  - P4 实际改 api/types.ts — P2 §7 声明 types/index.ts 扩展，api/types.ts 是前端类型拆分的实现细节（transformUser 的响应类型），属设计内。
  - P2 列 exceptions.py（可能复用 LastAdminError）— P4 未改 exceptions.py（LastAdminError 已存在，直接复用），合理。
  - P2 列 stores/auth.ts（路由守卫消费 isAdmin，已存在）— P4 未改（已存在且无需改动），合理。
- **一致性**：[OK]。P4 实现路径与 P2 方案设计吻合，差异均为实现细节或合理省略。

### P5 测试结果 vs P6 验收

- **P5 unit.md**：pytest 1068 passed / 1 failed（预存 ruff env）/ 2 skipped；vitest 1217 passed / 0 failed；typecheck clean。
- **P5 e2e.md**：首轮 E2E 失败（选择器契约偏差），P4 重试 #3 修复后 27 passed / 0 failed。
- **P6 acceptance**：24/24 PASS，0 FAIL。
- **一致性**：[OK]。P5 的预存失败（test_t073 ruff env）已登记 known-failures.md（WARNING 级，不阻断）。P5 E2E 选择器偏差已在 P4 重试 #3 修复，P6 验收全部通过。

### P4 review BLOCKER 修复闭环

- **首轮 3 评审**：review=rejected（2 CRITICAL）、design-review=needs-revision（3 MUST-FIX）、cso=needs-revision（2 MEDIUM，与 review CRITICAL 同源）。
- **P4 重试 #2 修复**：5 个 BLOCKER 全部修复 + 3 个 SHOULD-FIX 一并修复。
- **P4-review.md（review-lead）**：status=approved，逐项 grep 确认修复落地。
- **一致性**：[OK]。BLOCKER 修复闭环，review-lead approved。

## 未决项清零

- **[NEED_CONFIRM] 残留**：grep 全阶段产出 → exit 1（无匹配）。[OK] 清零。
- **[BLOCKER] 残留**：grep 全阶段产出 → exit 1（无匹配）。[OK] 清零。
- **[DEVIATION-CRITICAL] 残留**：grep 全阶段产出 → exit 1（无匹配）。[OK] 清零。
- **[NO_NEED_CONFIRM] 存在性**：P1-requirements.md:215 + P6-acceptance.md:102 均含 `[NO_NEED_CONFIRM]`。[OK] 存在。

## 非阻断 follow-up 项（记录，不阻塞 P7）

以下来自 P4-review.md §未阻断问题，已登记为 follow-up，不影响 P7 通过：

1. delete_user TOCTOU 跨 session（INFORMATIONAL）— 现有模式，SQLite 写串行化兜底
2. client.py delete_self 残留 confirm_username + code 匹配大小写（LOW）— 死代码
3. delete_self TOCTOU 双 session 间隙（LOW）— 双重检查兜底
4. reset-password 返回明文密码（LOW）— 现有行为非 T080 引入
5. 移动端 media query 含 no-op 规则（NICE-TO-HAVE）— 死代码无害
6. displayName 未展示（NICE-TO-HAVE）— P2 spec 建议项

## 一致性审查结论

| 检查项 | 结果 |
|--------|------|
| 方向1（设计→实现） | [OK] P2 设计全部落地，无遗漏 |
| 方向2（实现→设计） | [OK] 无僵尸需求/废弃约束/[EXTENSION] |
| DESIGN_GAP 配对 | 4/4 [DESIGN_GAP_REVIEWED: 已解决] |
| SCOPE+ 闭环 | [SCOPE_RESOLVED: 无 SCOPE+ 增补] |
| P1§BDD vs P6§PASS | 24 = 24，内容一致 |
| P2§packages vs P8 release | [OK] backend/peekview + frontend-v3，MCP 不变 |
| P4§impl-path vs P2 设计 | [OK] 吻合，差异为实现细节 |
| P4 review BLOCKER 修复 | 5/5 修复，review-lead approved |
| [NEED_CONFIRM] 残留 | 0 |
| [BLOCKER] 残留 | 0 |
| [DEVIATION-CRITICAL] 残留 | 0 |
| [NO_NEED_CONFIRM] 存在 | 是（P1 + P6） |

**BLOCKER=0, CRITICAL=0, DESIGN_GAP 未配对=0**

P1-P6 全阶段产出跨文件一致性审查通过，无 BLOCKER，无 DEVIATION-CRITICAL，4 个 DESIGN_GAP 全部 REVIEWED 配对，SCOPE+ 闭环。可推进 P8。
