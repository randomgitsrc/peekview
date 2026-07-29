---
phase: P1
generated_by: agate-inject-card.sh + 主 Agent
task_id: T076
role: analyst
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

产出 `docs/tasks/T076-entry-card-interaction/P1-requirements.md`：质疑 T076 需求、识别隐含依赖、用 BDD（Given/When/Then）建立验收基线，并声明 domains/packages/risk_level/phases/capability_requirements。

### 约束

- 纯前端改动（Vue 3 + TypeScript），后端 API 已支持 tag 过滤，**不改后端**
- 必须遵循 `DESIGN.md` 设计系统（CSS 变量、spacing、typography、radius）
- EntryCard 和 EntryListRow 两个组件都要覆盖（同源结构问题）
- 移动端：tag 点击跳转正常；tag-overflow tooltip 在 touch 下可用
- 范围边界（P0 已声明"不做"）：tag 共现/知识图谱、tag 自动补全、tag 颜色编码——不要纳入 BDD
- risk_level 预判 low（UI 重构，不改业务逻辑、无安全/数据/权限），但请你独立复核后声明
- 键盘可访问性（`<a>` 天然可 tab 聚焦）和"卡片点击区域变小"是 P0 已识别的体验权衡点，BDD/待确认清单应覆盖

### 上游关联

P0 由主 Agent 亲自撰写（无上游 subagent）。关键判断见 P0-brief.md：
- 痛点：整 card-body 是 `<a>` 导致 hover 全下划线 + 右键复制链接错乱 + Tags 不可点击
- 方案方向：card-body 改 `<div>`，title/username/tag 各自独立 `<a>`，tag 跳 `/?tags=xxx`

### 输入文件

- `docs/tasks/T076-entry-card-interaction/P0-brief.md`（任务简报、范围 A/B/C/D、不做清单、已知风险、验证标准）
- `AGENTS.md`（项目约定、铁律、技术要点）
- `DESIGN.md`（前端设计系统）
- 按需读现状组件理解当前结构：`frontend-v3/src/components/EntryCard.vue`、`EntryListRow.vue`、`BaseTag.vue`、`frontend-v3/src/views/EntryListView.vue`、`frontend-v3/src/router.ts`
</dispatch_guide>

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
- 环境状态：debug backend 运行于 http://127.0.0.1:8888（隔离 DB /tmp/peekview-debug/），版本 peekview=0.11.2 / mcp=0.10.0；CDP Chrome 150 可用（Playwright + vision 验收能力完整）
- 关键标识（前端文件，均存在）：
  - frontend-v3/src/components/EntryCard.vue
  - frontend-v3/src/components/EntryListRow.vue
  - frontend-v3/src/components/BaseTag.vue
  - frontend-v3/src/views/EntryListView.vue
  - frontend-v3/src/router.ts（页面路由是 /:slug，不是 /entries/:slug）
- 查证结果（后端 tag 过滤已就绪，无需后端改动）：
  - backend/peekview/api/entries.py:194 `tags: str | None = Query(None)`，:209 `tag_list = tags.split(",")` → GET /api/v1/entries?tags=a,b 已支持
  - frontend-v3/src/api/client.ts:111 `tags: params?.tags?.join(',')` → 前端 API client 已有 tags 入参，缺的是 EntryListView 读 URL query + UI 指示
- Explore 页路由：/explore（entry 列表页），tag 过滤目标 URL 形如 /?tags=python（P0 约定，需你确认路由实际指向并在 BDD 中用正确路径）
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
