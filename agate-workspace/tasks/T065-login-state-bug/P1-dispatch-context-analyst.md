---
phase: P1
generated_by: agate-inject-card.sh + 主 Agent
task_id: T065
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P1-requirements.md——登录状态 bug 的需求基线，含 BDD 验收条件、domains/packages/risk_level/phases/capability_requirements 声明

### 约束
- **第一步必须实跑复现**：用 make debug-seed 的 alice 账号（密码 testpass123）在 http://127.0.0.1:8888 实际操作，确认两个症状的真实性
- **不要 git diff T060**——T060 从未碰 LandingView.vue，那是无关 commit
- **症状①（不跳转）可能无法复现**——代码里 watcher 存在（LandingView.vue:206），若实跑能跳转则诚实记录"无法复现"，不可硬造根因
- **症状②（Sign in 不消失）已确认真实**——LandingView.vue:19 无 authState 绑定
- **两个症状可能同根**：若跳转失效，用户停在 landing 自然看到没绑定的 Sign in。复现后先厘清因果
- **P0/P1 职责边界**：P0 已有的决策内容（纠正 T060 回归框架、症状界定）直接引用不重写；P0 的验收基线转化为 BDD 格式；P0 没覆盖的隐含需求由 P1 独立产出
- **与 T067 边界**：T065 只修 landing 页 Sign in + 登录跳转；T067 修详情页框架（含详情页 Sign in）。不要在 T065 里改详情页
- **UI 改动 P6 不可裁**——P6 需 Playwright 实跑截图验证

### 上游关联
- P0-brief.md 已纠正"T060 回归"框架为"既有设计缺口"
- 跳转 watcher 存在于 LandingView.vue:206（git blame: 2026-06-28 commit 33a8fe15c）
- Sign in 按钮无 authState 绑定（LandingView.vue:19）

### 输入文件
- docs/tasks/T065-login-state-bug/P0-brief.md（主 Agent 的任务简报和风险声明）
- frontend-v3/src/views/LandingView.vue（:19 Sign in 按钮, :206 跳转 watcher）
- frontend-v3/src/stores/auth.ts（authState computed, login/register/logout/fetchMe）
- frontend-v3/src/components/LoginDialog.vue（登录对话框逻辑）
- AGENTS.md（项目约定、铁律）
</dispatch_guide>

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
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）

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

<objective_info>
- debug backend: http://127.0.0.1:8888 (PID 2627662, /tmp/peekview-debug/)
- seed data: alice/bob/carol (password testpass123), 9 entries
- LandingView.vue:19 → `<button class="btn btn-ghost btn-sm" @click="showLogin = true">Sign in</button>` (无 v-if/authState)
- LandingView.vue:206 → `watch(authState, (state) => { if (state === 'authenticated') router.replace('/explore') })` (watcher 存在)
- auth.ts authState: computed(() => { if (!user.value) return 'unauthenticated'; return user.value.isActive ? 'authenticated' : 'suspended' })
- LoginDialog.vue: 登录成功后调 authStore.login() → fetchMe() → user ref 更新 → authState computed 应触发
</objective_info>
