> **所有 P1-P8 阶段统一强制本文件存在**——commit 前暂存区必须含至少一个当前阶段的 dispatch-context 文件。该文件是 subagent 的核心信息源，禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。

---
phase: P1
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P1-requirements.md：明确 archived 条目可见性策略 + 登录/退出/auth 过期后列表刷新的需求基线，含 BDD 验收条件。

### 约束
- 后端权限模型已有 404-not-403 模式（防 slug 枚举），任何变更必须保持此不变量
- archived 条目当前对匿名用户完全不可见、对非 owner 完全不可见——这是安全边界，不可放松
- 修改 list_entries 默认查询行为可能影响 API 兼容性——需评估是否为 breaking change
- 前端 authState watcher 当前仅处理 ?owner=me 特例——修复需在多处协调（LoginDialog、auth store、EntryListView、401 interceptor）
- 退出后 filterPrivateEntries() 是客户端过滤，不重新请求 API——需决定是改为重载还是保持客户端过滤
- debug 环境：make debug（:8888, /tmp/peekview-debug/），严禁触碰生产 :8080

### 上游关联
- P0-brief 识别了 4 个问题（A: archived 混入 All/Mine, B: 登录不刷新, C: 退出不重载, D: auth 过期无刷新）
- 权限一致性要求已在 P0-brief 详述

### 输入文件
- docs/tasks/T060-archived-visibility-auth-refresh/P0-brief.md（主 Agent 的任务简报和风险声明）
- backend/peekview/services/entry_service.py（list_entries 方法，行 362-535，关注 status 过滤逻辑行 391-416）
- backend/peekview/api/entries.py（list endpoint，行 190-223）
- frontend-v3/src/views/EntryListView.vue（tab 切换 + authState watcher，行 36-52, 328-334, 379-384, 444-455）
- frontend-v3/src/stores/auth.ts（login/logout 动作，行 28-36, 48-51, 63-67）
- frontend-v3/src/stores/entry.ts（filterPrivateEntries + loadEntries，行 175-178）
- frontend-v3/src/components/LoginDialog.vue（登录成功后回调，行 187-215）
- frontend-v3/src/api/client.ts（401 interceptor，行 19-28）
- AGENTS.md（项目铁律和架构）
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
- 环境状态：debug backend :8888 可用（make debug），生产 :8080 严禁触碰
- 关键标识：API GET /api/v1/entries?status=archived，前端路由 /?owner=me&status=archived
- 查证结果：
  - entry_service.py list_entries 无 status 参数时：认证用户 own archived 混入（行 406-411: `(status != ARCHIVED) | (owner_id == current_user_id)`）
  - entry_service.py list_entries status=archived 时：匿名返回空（行 401-403），非 admin 非 owner 强制 owner_id 过滤（行 397-399）
  - EntryListView authState watcher 仅处理 ?owner=me URL 特例（行 444-455）
  - handleLogout 仅调 filterPrivateEntries() 客户端过滤（行 379-384）
  - 401 interceptor 无 filterPrivateEntries 调用
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
