---
phase: P2
task_id: TPV0093-star-lifecycle
type: design
parent: P2-review-eng.md
trace_id: TPV0093-P2-20260816-r2
status: ready
---

# P2 派发上下文 — architect（修订轮 r2）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.py P2（脚本化检查）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P2，不要提前写 P3——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P2): {摘要}"（phase=P2，P2 产出含 P2-design.md + P2-review.md）
7. P2 commit 完成后进入 P3：**phase 推进 P3 随 P3 产出 commit 一起**（P3-test-cases.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

`candidate_count`/`packages`/`domains`/`ui_affected` 写在文件头 **frontmatter**（`---` 分隔块），
不写正文；`gate_commands:`/`files_to_read:`/`env_constraints:`/`minimal_validation:` 留正文。
**可直接复制的完整样例**：
```yaml
---
phase: P2
task_id: TAG0001           # 替换为实际任务编号
type: design
parent: P1-requirements.md
trace_id: T001-P2-20260101 # {task_id}-P2-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2                # int ≥1，必填
packages: [pkg-a]                 # list，必填
domains: [backend, cli]           # list，必填
ui_affected: false                # bool，必填
---
```

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## dispatch_plan 机器字段（可选，TAG0014）

> 本字段是 P2 对**后续阶段编排方案**的机器声明（评估 + 编排模式，见 dispatch-protocol「派发编排机制」），由 architect 在"批次设计"节（execution-roles/architect.md）产出，P2 gate 校验其合法性。

方案含多个独立子任务（多包/多模块/high 复杂度）时，P2-design.md frontmatter 应声明 `dispatch_plan:`（单行 flow YAML，与 candidate_count 同级，**不入 frontmatter-check schema**，缺省不校验）：

```yaml
# ── v2.0 派发编排字段（可选）──
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: pkg-a, complexity: medium}, {id: pkg-b, complexity: low}]}
```

字段契约（gate 校验口径）：
- `mode` ∈ {single, static-batch, parallel, recon-then-split, serial}——编排模式（单发/静态拆批/并行/先理解后拆/串行链）
- `parallel_limit` 可选，≥1 整数——并行上限（缺省 3）
- `batches` 可选——mode ∈ {static-batch, parallel} 时每批须含 `id` + `complexity` ∈ {low, medium, high}；批数 ≤ parallel_limit
- 缺字段 / 坏 YAML → P2 gate 跳过校验，行为等同现状（向后兼容，不误拦）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.py 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| backend | 任意 | plan-eng-review（P2 方案评审） |
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

> **去重说明**：同一任务命中多行且触发同一评审角色时，去重只派发一次（如 backend + high 均命中 plan-eng-review，只派 1 个 plan-eng-review，不重复派发）。

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.py P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

## gate 规则

```bash
check-gate.py P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.py 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] P2-review.md 存在且 status: approved（agent≠main）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->

## 增量模式说明

- 上轮产出：`agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`
- 上轮评审：`P2-review-eng.md`（rejected：3 BLOCKER + N1-N7）+ `P2-review-design.md`（needs-revision：6 项）
- 上轮派发上下文：`P2-dispatch-context-architect.md`（目标/约束沿用，本次只做修订）
- 已登记 DEBT0006（backup/restore 不导入新表，[SCOPE+] 已知限制——architect 无需处理，仅知悉）

## 修复目标（评审 BLOCKER/needs-revision 逐条闭合）

### 工程评审 3 BLOCKER（必须闭合）

1. **BLOCKER-1**：get_entry 权限扩展不完整——`is_public` 前置检查（entry_service.py:341）先于 archived 分支，拦截 archived+private+星标读取。修订 §4.3：archived 条目短路 is_public 检查（status==ARCHIVED 时判定仅由「状态+星标」组成）；P3 补「公开→星标→转私有→归档」链路用例。
2. **BLOCKER-2**：star 端点缺可见性授权——任意登录用户可对 archived 私有 slug 自授权星标（绕过决策 A 防枚举）。修订 §4.6/§4.5：star 路由必须先经 get_entry 验证「当前用户可读该 entry」，不可读（404）即拒绝建星标；最低限度：非公开 entry 仅 owner/admin 可星标。语义写入 API 契约。
3. **BLOCKER-3**：迁移版本门控与 FTS_VERSION 冲突——user_version 已被 FTS 占用（FTS_VERSION=2），star backfill 条件 `user_version < 1` 在存量生产库永不执行（BDD-27 违反）+ 双向污染。修订 §5：**不要复用 user_version**——改用数据幂等 backfill：`UPDATE entries SET archive_delete_at = :launch_ts + :retention_days WHERE status='archived' AND archive_delete_at IS NULL`（每次启动幂等重跑，天然满足上线日起算）；或独立 migrations 表。P3 补「存量库 user_version=2 → 升级 → backfill 生效」用例。

### 工程评审非阻塞（修正）

- **N3**：candidate_count 与正文不一致（frontmatter=4，正文 A-F 6 个）——统一为 6（或改正文表述为 3 对真替代）
- **N6**：P5_e2e 固化 `E2E_SPEC=e2e/star*.spec.ts` 作用域进 gate_commands 声明
- **N7**：star 并发重复 INSERT 幂等——P4 需 catch IntegrityError → `{created:false}` 分支（写入 §4.5 设计）
- **N1/N2/N4/N5**：在设计中显式固化（delete_user 清扫顺序约束 / update_entry 双 reactivation 路径 / list_starred 私有 active 隐藏的文档化提示 / 时区 naive UTC 一致）

### 设计评审 6 项（必须闭合）

1. **移动端星标按钮落点**（§6.1）：EntryDetailMobileBar.vue 底部栏加 star 按钮（或 OverflowMenu sheet）+ 对应 testid（如 `mobile-star-toggle`）
2. **管理页三态 + Starred tab 状态**（§6.3/§6.2）：StarManageView 各分类空态/加载态/错误态 + Starred tab 空态文案 + 批量按钮禁用条件（无勾选）+ 移除前确认
3. **E1 跳转查看入口**（§6.1/BDD-2）：二选一——扩展 Toast action 能力，或把跳转入口放悬停 tooltip 内嵌链接，明确选其一
4. **client.ts 新字段映射**（§2.1）：显式声明 transformListItem/transformEntry 补 star_count/is_starred/countdown 映射（files_to_read 增补 client.ts:43-92 行号）
5. **可访问性显式说明**（§6 补 a11y 节）：星标按钮 aria-pressed/aria-label（沿用 header toggle-btn 模式）；红色标签语义色 token（如 var(--c-error)）+ 对比度；墓碑"看原因"用 button 可键盘到达；❓ 可点击（触屏兜底）；checkbox aria-label
6. **已归档条目 Toast 文案**（§6.1/BDD-23）：区分两种 copy——即将归档"将于 X 月 X 日归档" / 已归档"该内容已归档，星标后可长期保存"

### 设计评审补充 spec 建议（采纳）

- Starred tab 只含活 entry 不含墓碑（墓碑仅管理页）显式声明
- §6.3 filter 语义表固化（all/active/expiring/expired ↔ BDD-20 四分类，expired 含墓碑）
- §6.4 豁免标签 footer 渲染条件扩展 + 与 BaseBadge 互斥
- §6.2 Starred tab 与 setFilter/restoreFromURL/onBeforeRouteUpdate/emptyStateHeading 耦合触点点名

## 约束（沿用上轮）

- 只改 P2-design.md，不新建文件
- 环境隔离：只读代码，不跑测试、不修改源码
- 修订后自检：frontmatter 四字段 + candidate_count 与正文一致 + dispatch_plan 不变 + BDD 覆盖映射更新（如新增链路）
- [SCOPE+] backup/restore 已裁定为已知限制（DEBT0006），不要扩大范围

## 产出

`agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`（修订版）

## 门槛

- 3 BLOCKER + 6 design revision + N3/N6/N7 + 补充 spec 建议全部闭合
- 修订处可被评审对应到；candidate_count 与正文一致
