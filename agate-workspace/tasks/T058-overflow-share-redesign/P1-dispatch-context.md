---
phase: P1
task_id: T058
type: dispatch-context
created: 2026-07-17
agent: main
---

# T058 P1 Dispatch Context

## AGATE Card

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：agate/phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
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

## 任务上下文

### 现有组件清单（analyst 需了解的代码现状）

1. **OverflowMenu.vue** — 当前实现：`variant: 'dropdown' | 'sheet'`，内部 `v-if` 切换桌面/移动端
   - 接口：`OverflowMenuItem { label, icon?, hint?, href?, target?, rel?, variant?, divider?, action? }`
   - 问题：视觉 token 不遵循 DESIGN.md §6、light 模式背景透明、菜单项对齐混乱

2. **ShareManagementPanel.vue** — 当前实现：页面底部全宽通栏
   - 被 EntryDetailView.vue 引用，通过 `showShareDialog` ref 控制显示
   - 问题：视觉侵占主内容区、信息密度低、交互粗糙、创建/管理入口割裂

3. **share.ts store** — Pinia store，提供 `fetchShares/createShare/revokeShares`
   - 类型：`ShareInfo { id, tokenPrefix, expiresAt, maxViews, viewCount, createdBy, createdAt, revokedAt }`
   - 类型：`ShareCreateResult { id, tokenPrefix, shareUrl, expiresAt }`

4. **EntryDetailView.vue** — 引用 OverflowMenu + ShareManagementPanel
   - `showShareDialog` ref 控制分享面板显示
   - OverflowMenu 的"Share"菜单项 action 设为 `showShareDialog.value = true`

### P0-brief 关键决策（analyst 不应质疑，已由 PM 确定）

- OverflowMenu 从 DESIGN.md 规范出发完整重写（不是修补）
- 分享交互统一入口：分享按钮 + badge 显示活跃链接数
- 桌面端用 Popover（280px），移动端用 Bottom Sheet
- ShareManagementPanel.vue 删除，新建 ShareDialog.vue + ShareDialogContent.vue
- Desktop Dropdown 和 Mobile Bottom Sheet 拆为独立子组件

### verification_env

```yaml
ui_affected: true
gate_requires_playwright: true
debug_env: "make debug-start (:8888, /tmp/peekview-debug/)"
vision_available: true
```
