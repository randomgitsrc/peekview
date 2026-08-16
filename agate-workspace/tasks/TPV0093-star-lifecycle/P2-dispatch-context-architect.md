---
phase: P2
task_id: TPV0093-star-lifecycle
type: design
parent: P1-requirements.md
trace_id: TPV0093-P2-20260816
status: ready
---

# P2 派发上下文 — architect

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

## 目标

把 P1 需求基线（28 BDD）转化为可实现的技术方案：候选方案 ≥2 + 权衡 + 选择理由；影响域（改/不改/风险）；`candidate_count`/`packages`/`domains`/`ui_affected` 四字段；`gate_commands` 固化（P3/P5/P6 验证契约）；`files_to_read` 上下文地图；`minimal_validation` 最小验证；`dispatch_plan` 派发编排（high 复杂度必拆批）。

## 上游关联

- `P1-requirements.md`（28 BDD + frontmatter：risk=high / phases 全走 / packages=[backend/peekview, frontend-v3] / domains=[backend, frontend, security]）
- `P0-brief.md`（环境约束、known_risks、四决策点 A/B/C/D）
- `docs/specs/peekview-star-function-20260812.md`（V2.0 需求文档）

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0093-star-lifecycle/P1-requirements.md`
2. `agate-workspace/tasks/TPV0093-star-lifecycle/P0-brief.md`
3. `docs/specs/peekview-star-function-20260812.md`
4. 现有代码（设计必须基于实际代码，不得凭空设计）：
   - `backend/peekview/models.py`（Entry/User；新表 EntryStar/EntryTombstone/倒计时状态字段加这里）
   - `backend/peekview/database.py`（迁移机制 `_run_migrations`/backfill 模式）
   - `backend/peekview/services/entry.py` + `services/entry_service.py`（get_entry 权限判定、get_entry_with_share、delete 路径）
   - `backend/peekview/services/admin.py`（cleanup_expired、delete_user）
   - `backend/peekview/api/entries.py`（_check_share_cookie）、`api/files.py`（_resolve_entry share 兜底）、`api/` 其他路由（详情/raw/文件内容权限）
   - `backend/peekview/config.py`（archive_retention_days、cleanup.interval_seconds）
   - `frontend-v3/src/views/`（EntryDetail、Explore/EntryListView tabs、EntryList 卡片）
   - `frontend-v3/src/stores/` + `api/client.ts`（store 模式、API client 模式）
   - `frontend-v3/src/types/`（Entry 接口扩展）

## 设计重点（P1 已定稿的约束，直接采用）

- **决策 A 权限**：archived 读取从 owner/admin 扩展为 owner/admin/星标用户（登录用户通道）；share 是独立授权通道不受影响（BDD-28）；非星标 404 防 slug 枚举（BDD-15/16）
- **决策 B 墓碑**：独立 EntryTombstone 表；创建条件=删除时 ≥1 星标（SUGGEST 1）；清理=随最后引用移除（SUGGEST 2）；deleted_by 非强 FK（D8：username 快照/非 FK/ON DELETE SET NULL）
- **决策 C 前端**：Explore [Starred] tab + 星标管理页（独立增强页：分类/批量/墓碑/红色倒计时）
- **决策 D 存量**：存量 archived 倒计时从上线日起算（迁移/backfill）
- **倒计时暂停/恢复**：P0 known_risk 点名——需设计"剩余秒数快照/暂停点"存储，避免重复计算漂移（D4）
- **星标记录跨 entry 删除存活**（D3）：EntryStar 引用键不能依赖 entry FK 级联删除
- **清理路径**：cleanup_expired 需查 star 表 + 暂停状态；reason=expired 保留型枚举不产出（E7）
- **多端继承**：MCP/CLI 无代码改动（M2/M3，评审已核实代码）——但服务层改动后 P5 需回归验证

## 环境约束（沿用 P0-brief）

- debug_env: make debug-quick（:8888 隔离）；迁移走 database.py 机制
- 严禁触碰 :8080 生产 / ~/.peekview/
- lint: make lint && make typecheck

## 产出

`agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`

frontmatter 含：`candidate_count` / `packages` / `domains` / `ui_affected`（+ 可选 `dispatch_plan`）；正文含：候选方案权衡 / 影响域 / `gate_commands` / `files_to_read` / `env_constraints` / `minimal_validation` / 批次设计。

## 门槛

- 候选方案 ≥2（真方案 + 真替代，非稻草人）+ 权衡 + 选择理由
- 四字段齐全；`ui_affected: true`（前端多页）→ `gate_commands.P5_e2e` 必填
- **high 复杂度必拆批**：frontmatter 声明 `dispatch_plan:`（mode ∈ {static-batch, parallel, recon-then-split, serial}；batches 含 id+complexity；批数 ≤ parallel_limit）——后端（schema/服务/API）+ 前端（多页）为独立批次
- `minimal_validation`：涉及权限/生命周期/迁移——需说明验证方式（纯代码逻辑须写明依赖函数；涉及删除路由/接口须验证兜底分支）
- `files_to_read` 只列实现确实要参考的（大文件标行号）
- 发现新隐含需求 → 标 `[SCOPE+]`
