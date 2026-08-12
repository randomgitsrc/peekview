# P4 dispatch-context: implementer

## 目标

实现 P2-design.md 方案，让 P3 的 21 个红灯测试变绿（不改测试）。覆盖后端 API + service + migration + CLI + 前端路由 + AdminView + PasswordResetDialog + API client。

## 约束

- 严守 P2 方案，不擅自扩大范围
- 让 P3 测试变绿，不改测试迁就实现
- 8 个 CONFIRMED 决策全部落地
- 按 P2-design.md files_to_read 清单读代码，不盲目搜索
- 最小实现原则：写最简单代码让测试通过，不加额外功能、不重构无关代码
- 严禁触碰生产环境（:8080 / ~/.peekview/），调试用 :8888（make debug）
- 严禁 `pip3 install --break-system-packages -e .`，开发用 venv（make test-quick 自动用 venv）
- 严禁 uvicorn 直接启动，用 make debug
- 改前端后必须 make build-frontend 重建 static（若需 debug 验证）
- 测试用例若与 BDD 矛盾 → 标 [DESIGN_GAP]，不改测试
- 严禁用 `--no-verify`

## 上游关联

- P2-design.md：候选方案 A + files_to_read + gate_commands + ui_interaction_points
- P3-test-cases.md：24 BDD 测试映射 + test_code_dir
- P3 测试代码：backend/tests/test_t080_*.py + frontend-v3/src/__tests__/t080-admin-route-guard.test.ts + frontend-v3/e2e/admin.spec.ts

## 输入文件

按 P2-design.md files_to_read 清单（见 P2-design.md §8），核心：
1. `backend/peekview/api/admin.py` — 端点模式参照，新增 4 toggle 端点 + list_users response_model
2. `backend/peekview/services/admin_service.py:307-359` — list_users/delete_user/reset_password，新增 toggle + helper
3. `backend/peekview/models.py:101-145,640-648,755-756` — User 模型 + UserResponse + 新增 UserListResponse
4. `backend/peekview/database.py:39-157` — migration 模式
5. `backend/peekview/auth.py:164-217` — get_current_user + require_admin 复用
6. `backend/peekview/api/auth.py:231-251` — delete_self confirm_username 旁路移除（决策 A）
7. `backend/peekview/exceptions.py:237-252` — LastAdminError/ForbiddenError/ValidationError 复用
8. `backend/peekview/cli.py:1480-1620` — user 命令组，新增 disable/enable + demote 补 LastAdmin
9. `frontend-v3/src/router.ts:60-88` — /admin route + beforeEach 守卫
10. `frontend-v3/src/stores/auth.ts:11-17` — isAdmin + authState
11. `frontend-v3/src/api/client.ts:94-126` — transformUser + listEntries 分页模式
12. `frontend-v3/src/types/index.ts:43-49,103-110` — EntryListResponse 模板 + User 接口
13. `frontend-v3/src/components/OverflowMenu.vue:76-119,132-139` — OverflowMenuItem 接口 + variant
14. `frontend-v3/src/components/ConfirmDialog.vue:1-61` — PasswordResetDialog 参照
15. `frontend-v3/src/views/EntryListView.vue` — loading/error/empty 状态模式参照
16. `frontend-v3/src/components/Pagination.vue` — 分页组件复用
17. `frontend-v3/src/components/BaseBadge.vue` — 新增 disabled/admin variant
18. `frontend-v3/src/composables/useResponsiveLayout.ts` — isMobile
19. `frontend-v3/src/composables/useToast.ts` — toast
20. P3 测试文件（看测试断言理解预期行为）

## 客观查证信息

- 21 红灯：BDD-01/02/03/04/05/06/07/08/09/10/11x2/13(list结构)/16/17/18/19/22/23/20 + BDD-11 现有 test_auth 更新
- BDD-12/BDD-21 后端已绿（reset-password + self-delete 现有），前端 E2E 红灯
- admin 计数 = COUNT(is_admin=True AND is_active=True)（决策 B）
- delete_self confirm_username 旁路移除（决策 A，破坏性变更）
- list_users 改返回 {items,total,page,per_page}（决策 4）
- 审计字段 disabled_at/disabled_by/disabled_reason + migration（决策 1）
- 前端 PasswordResetDialog 新建（BDD-12 BLOCKER 修复）

## 特别关注（实现顺序建议）

后端先（让 pytest 红灯变绿）：
1. models.py：UserBase 加 disabled_at/disabled_by/disabled_reason + UserResponse 扩展 + 新增 UserListResponse
2. database.py：migration 加审计字段
3. admin_service.py：_check_last_active_admin + _check_self_operation helper + disable_user/enable_user/promote_user/demote_user + list_users 改返回结构 + delete_user 补 LastAdmin
4. api/auth.py：delete_self 移除 confirm_username 旁路 + admin 计数加 is_active
5. api/admin.py：新增 4 toggle 端点 + list_users response_model 改 UserListResponse
6. cli.py：user disable/enable + demote 补 LastAdmin
7. 跑 `cd backend && .venv/bin/python -m pytest tests/test_t080_*.py tests/test_admin_user_api.py -q` 自查绿灯

前端后（让 vitest + E2E 红灯变绿）：
8. types/index.ts：User 接口扩展 + UserListResponse 类型
9. api/client.ts：admin API 方法组（listUsers/disableUser/enableUser/promoteUser/demoteUser/resetPassword/deleteUser）
10. router.ts：/admin route（meta.requiresAdmin，在 /:slug 前）+ beforeEach 守卫（waitForAuthInit 之后检查）
11. components：BaseBadge 新增 disabled/admin variant + PasswordResetDialog.vue 新建
12. views/AdminView.vue：列表 + 分页 + OverflowMenu + ConfirmDialog + PasswordResetDialog + loading/error/empty + in-flight 禁用
13. 跑 `cd frontend-v3 && ./node_modules/.bin/vitest run src/__tests__/t080-admin-route-guard.test.ts` 自查
14. `make typecheck` 自查

## 产出路径

- 代码改动：直接改 backend/peekview/ + frontend-v3/src/ 下文件
- `docs/tasks/T080-admin-user-management/P4-implementation.md`（含 implementation_dir 声明 + 改动清单 + [DESIGN_GAP] 如有）

## 产出要求

- Header: phase=P4, task_id=T080-admin-user-management, trace_id=T080, type=implementation, parent=P3-test-cases.md, status=draft, agent=implementer
- implementation_dir 声明
- 改动清单（文件 + 改动摘要）
- [DESIGN_GAP] 标注如遇测试与 BDD 矛盾
- [SCOPE+] 标注如发现新隐含需求
- 自查结果（测试绿灯情况，但不声称 P5 已过）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。
1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. 预跑 check-gate.sh P4（确认暂存区有代码文件）
5. 更新 .state.yaml phase=P4 → P5
6. git add docs/tasks/{Txxx}/ + 代码文件（含 .state.yaml，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P4): {摘要}"

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`docs/tasks/Txxx/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `docs/tasks/Txxx/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.sh 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 派发 verifier subagent 执行 gate_commands.P5，主 Agent 验 gate（检查产出 + failed 计数 + N5 最小校验）。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | —（plan-eng-review 在 P2 已派）| — |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.sh 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前**必须**为每个 subagent 的 dispatch-context 分配上述隔离参数。当前无 gate 脚本检查（已知缺口），但未分配导致运行时冲突（端口占用/数据库锁）时计为重试，不算环境问题。

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（无触发评审角色时此项自动满足）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **先更新 .state.yaml 再 commit**：state 和产出在同一 commit 里——不要先 commit 产出再单独 commit state
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->