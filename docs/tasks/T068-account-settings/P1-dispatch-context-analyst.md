---
phase: P1
task_id: T068-account-settings
role: analyst
created: 2026-07-23
---

# P1 派发指引 — analyst

## 目标

建立 T068 account-settings 的需求基线。产出 P1-requirements.md，含 BDD 验收条件、隐含需求、裁剪声明。

## 约束

- 新增后端端点 PATCH /api/v1/auth/me（display_name 编辑，参照 POST /auth/change-password 模式）
- 新增前端 /settings 页面（单页 tab：Profile / Security / API Keys）
- 现有 /settings/apikeys → 302 重定向到 /settings?tab=apikeys
- API Keys tab 迁入现有 ApiKeyListView.vue 功能（创建/撤销/清理过期/空状态/错误状态）
- auth guard：未登录 → 重定向到 landing
- ui_affected: true → P6 需 Playwright 截图验证
- 项目铁律：不加注释

## 上游关联

- T011 (user-management): 已交付后端 user management 能力（GET /me, DELETE /me, POST /change-password）
- T065 (login-state-bug): authState 响应式已修好，非硬依赖但体验更一致

## 明确不含

- 注销账号（级联删除危险，有 CLI peekview user delete）
- 管理员用户管理页（独立需求）
- 改 username（系统身份标识）
- 头像/邮箱/OAuth/2FA/通知/账单（User 模型无这些字段）
- 忘记密码/密码重置流程（无邮箱字段）

## 输入文件（必读）

1. docs/tasks/T068-account-settings/P0-brief.md — 任务简报（五字段齐全，含详细设计决策）
2. backend/peekview/api/auth.py — 现有 auth 端点（:186 GET /me, :199 DELETE /me, :228 POST /change-password）
3. backend/peekview/models.py — User 模型（:106 display_name 字段, max_length=64）
4. frontend-v3/src/router.ts — 路由（:30 /settings/apikeys 路由）
5. frontend-v3/src/views/ApiKeyListView.vue — 现有 API Key 页面（迁入源）
6. frontend-v3/src/stores/auth.ts — authStore（user ref + fetchMe + authState）

## 特别注意

- change-password 是否 invalidate 当前 token？P1 须确认（影响 BDD：改密码后是否需要重新登录）
- auth guard 当前 /settings/apikeys 无显式守卫——新 /settings 必须补
- 移动端设置页须响应式（tab 改为垂直分区或手风琴）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：agate/phase-cards/P1-requirements.md
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

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（五字段齐全）

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

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式不固定，主 Agent 自行判定）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）

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
<!-- AGATE_CARD_END -->
