---
phase: P1
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: analyst
trace_id: T086-P1-20260807
created: 2026-08-07
---

# P1 派发指引 — analyst

## 目标

为 T086（admin/settings 信息架构收敛）建立需求基线：AdminView 的用户管理内容合并进 SettingsView 作为第 4 个 tab（`?tab=user-manager`），删除独立 `/admin` 路由（不做 redirect，旧书签 404），UserMenu 给 admin 角色显式加入口。产出 P1-requirements.md（BDD 验收条件 + 隐含需求 + 裁剪声明）。

## 约束

- 后端零改动（`/api/v1/admin/*` 全部保留），P1 不得引入后端改动项
- 用户已拍板三点，不要重新论证是否要做，只需把它们转成可验证的 BDD：
  1. 完全合并（AdminView 内容迁成 UserManagerTab.vue，作为 settings 第 4 个 tab）
  2. 删除 `/admin` 路由，不做 redirect，旧书签 404
  3. tab 可见性：`isAdmin` 才显示 user-manager tab；非 admin 手敲 `?tab=user-manager` 时 SettingsView 守卫回退 profile
- 必须覆盖的隐含需求维度（P0-brief 已识别，需转成 BDD）：路由守卫迁移（路由级 requiresAdmin → tab 级 isAdmin）、E2E 迁移（admin.spec.ts 27 用例基于 `/admin` + data-testid）、移动端呈现（settings 现有 tab 在移动端如何展示，user-manager tab 需一致）、旧书签 404 场景、是否有其他地方硬编码 `/admin` 链接
- domains 至少声明 frontend；backend 声明为不受影响（不要漏判成 backend 需要改）

## 上游关联

parent: P0-brief.md（本任务的任务简报，含代码审计结果和用户已拍板决策，见"用户决策（已拍板）"节）

## 输入文件（按顺序读取）

1. `docs/tasks/T086-admin-settings-consolidation/P0-brief.md`（必读，含现状审计表格 + 改动清单方向）
2. `frontend-v3/src/router.ts`（路由定义：`/settings` 18-25 行、`/admin` 27-31 行、`requiresAdmin` guard 92-95 行附近；实际行号以当前文件为准）
3. `frontend-v3/src/views/SettingsView.vue`（现有 tab 机制：activeTab computed 读 route.query.tab、validTabs 数组、无效 tab 回退 profile 逻辑）
4. `frontend-v3/src/views/AdminView.vue`（要迁移的用户管理内容：列表/禁用启用/删除/重置密码/角色变更）
5. `frontend-v3/src/components/UserMenu.vue`（当前只有 Settings/Logout，需评估 admin 入口怎么加）
6. `frontend-v3/e2e/admin.spec.ts`（现有 27 个用例基于 `/admin` 路由 + data-testid，需在 BDD 中体现迁移覆盖）
7. `AGENTS.md`（项目约定，尤其权限模型一节：Anonymous/Authenticated/Admin 三层）

## 客观查证信息（已由主 Agent 核实，直接引用不需重新验证）

- settings 已是 `?tab=` 机制（profile/security/apikeys 三个现有 tab），合并机制上不需要改造容器
- admin 入口目前在 UI 里完全没有暴露，只能手敲 URL 访问 —— 这是当前真实存在的 UX 缺陷，不是本任务引入的新问题
- 已有 redirect 先例：`/settings/apikeys` → `/settings?tab=apikeys`（router.ts:22-25），但本任务的 `/admin` **不做**类似 redirect（用户已拍板 404）
- 后端 `/api/v1/admin/*` 全部 `require_admin`，本任务不改后端

## 裁剪倾向（P0 已给出，P1 据此判断是否采纳）

- P2 可简化：`follows_existing_pattern`，单候选方案
- P3 保留：tab 守卫逻辑 + isAdmin 可见性需要红灯
- P6 不可省：UI 改动必须 Playwright 截图（admin 登录看到 tab / 非 admin 看不到 tab / 移动端呈现）
- P7 保留：多文件改动（router / SettingsView / UserMenu / UserManagerTab 新建 / AdminView 删除 / E2E 迁移）
- risk_level 参考：medium（动路由守卫 + E2E + 权限边界，但不碰后端）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. 更新 .state.yaml phase=P1 → P2
5. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
6. git commit -m "wf({Txxx}-P1): {摘要}"

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
<!-- AGATE_CARD_END -->
