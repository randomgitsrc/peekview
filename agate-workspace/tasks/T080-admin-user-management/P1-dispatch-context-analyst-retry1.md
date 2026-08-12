# P1 dispatch-context: analyst (重试 #1 — 修订)

## 目标

根据 P1-review.md（status: needs-revision）的 5 个实质问题 + 1 个次要问题，修订 P1-requirements.md。这是 P1 第 1 次重试（P1 MAX=3）。

## 约束

- 只改 P1-requirements.md，不重写
- 修订后 BDD 编号保持连续（新增 BDD 顺延编号 BDD-20 起，或插入后重排——保持连续即可）
- 修订后仍无 [NEED_CONFIRM]，6 个 CONFIRMED 决策保留
- 严禁触碰生产环境

## 上游关联

- P1-review.md：评审意见，5 个实质问题 + 1 个次要问题
- P1-requirements.md：待修订（当前 19 条 BDD）
- 主 Agent 已对 2 个决策点拍板（见下方"已决断"）

## 已决断（主 Agent + 用户确认，2026-08-06）

**决策 A（对应问题 #1）**：移除 delete_self 的 confirm_username 旁路。最后一个 admin 绝对拒绝删除（无论是否 confirm username）。统一 demote/disable/delete 三者绝对拒绝。这是破坏性变更（改变现有 delete_self 行为），需在 P1 声明。

**决策 B（对应问题 #3）**：LastAdmin 保护的 admin 计数规则 = `is_admin=True AND is_active=True`。禁用的 admin（is_active=False）不计入活跃 admin 数。2 admin 场景：A 禁用 B 后，B 不算活跃 admin，系统只有 1 个活跃 admin（A），此时不能再禁用/demote/delete A。

## 输入文件

1. `docs/tasks/T080-admin-user-management/P1-review.md` — 评审意见（6 个问题）
2. `docs/tasks/T080-admin-user-management/P1-requirements.md` — 待修订
3. `backend/peekview/api/auth.py` — delete_self 的 confirm_username 旁路（第 240-249 行，核实移除影响）

## 需修订项（来自 P1-review.md）

### 问题 #1：BDD-11 与 delete_self confirm_username 旁路冲突 [必须修]
- 决策 A 已定：移除旁路，绝对拒绝
- 修订：BDD-11 改为"最后一个 admin 不能被删除（绝对拒绝，含自删和 admin 删别人）"。在 §4-2 决策声明"移除 delete_self 的 confirm_username 旁路，统一绝对拒绝"作为破坏性变更标注。§2.4 或 §2.5 兼容维度声明此变更。

### 问题 #2：自操作保护 BDD 覆盖不全 [必须修]
- §2.4 声明 disable/demote/delete 三操作防自操作，但仅 BDD-06 覆盖自 disable
- 修订：补 BDD 覆盖自 demote（多 admin 场景，admin demote 自己被拒）+ 自 delete（admin delete 自己被拒）。或显式声明 BDD-09/BDD-11 同时覆盖自操作保护（调整 Given/When 明确双语义）。推荐补独立 BDD（语义清晰）。

### 问题 #3："禁用是否算失去 admin"边界未定义 [必须修]
- 决策 B 已定：admin 计数 = is_admin AND is_active
- 修订：§2.4 明确定义计数规则。补 BDD 覆盖 2 admin 禁用边界：2 admin（A、B），A 禁用 B → 成功（A 仍活跃）；此时 B 不算活跃 admin，A 成为最后一个活跃 admin，再禁用/demote/delete A → 拒绝。

### 问题 #4：CLI disable 的 LastAdmin 保护缺 BDD [必须修]
- 修订：补 BDD"CLI disable 最后一个活跃 admin 被拒绝"。

### 问题 #5：BDD-19 标题/内容不匹配 [建议修]
- 修订：BDD-19 标题改为"CLI demote 补 LastAdmin 保护"（内容是 demote，promote 不需保护）。

### 问题 #6（次要）：§4-5 表述准确性 [建议修]
- 修订：§4-5 改为"API 端点 ResetPasswordRequest 已有 min_length=8 校验（models.py:756），确认对齐 CLI"。

## 特别关注

- BDD 编号连续：修订后总 BDD 数会增加（补自 demote/自 delete/2 admin 禁用边界/CLI disable LastAdmin），保持编号连续不跳号
- 决策 A 是破坏性变更：移除 delete_self confirm_username 旁路，现有用户若依赖此行为会受影响——在 §2.5 兼容维度声明
- 决策 B 的计数规则要写进 §2.4，所有 LastAdmin 相关 BDD（BDD-09/10/11 + 新增）的 Given/When 隐含此规则
- 修订后 [NO_NEED_CONFIRM] 声明保留，6 个 CONFIRMED 保留，新增的 2 个决策（A/B）作为 [CONFIRMED] 补充

## 产出路径

`docs/tasks/T080-admin-user-management/P1-requirements.md`（覆盖修订）

## 产出要求

- Header 不变（phase=P1, status=draft, agent=analyst）
- BDD 编号连续，格式 `#### BDD-NN:`
- 6 个原 CONFIRMED + 2 个新 CONFIRMED（决策 A/B）
- [NO_NEED_CONFIRM] 声明保留
- 修订完成后返回修订摘要（哪些 BDD 新增/修改）

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
<!-- AGATE_CARD_END -->