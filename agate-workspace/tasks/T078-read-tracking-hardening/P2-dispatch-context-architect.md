---
phase: P2
task_id: T078-read-tracking-hardening
type: dispatch-context
parent: P1-requirements.md
trace_id: T078-P2-20260803
status: active
created: 2026-08-03
agent: orchestrator
---

# P2 派发指引 — architect

## 目标

产出 P2-design.md：设计 T078 读取追踪强化的技术方案，含候选方案、files_to_read、gate_commands。

## 约束

- P1-requirements.md 的 34 条 BDD 是设计目标
- P0-brief.md 的 4 个 phase 是范围约束
- 纯后端任务，ui_affected: false
- risk=medium，不可裁剪 P2
- minimal_validation：纯代码逻辑（SQLModel + SQLite），无外部系统依赖

## 上游关联

P1 产出 34 条 BDD，覆盖：
- Phase 1 探针修复（BDD-01~06）：window_key 加 action、share channel 统一、files.py channel 走 _detect_channel、discover 可查、测试修正
- Phase 2 聚合表（BDD-07~20）：entry_read_stats 写时更新、by_action/by_source 维度、unique_readers 精度、来源分类、admin stats
- Phase 3 迁移（BDD-21~24）：source 列迁移、回填、90 天清理
- Phase 4 删除策略（BDD-25~26）：删 entry 保留聚合统计
- 边界（BDD-27~34）：空值、并发、备份恢复、discover 不入聚合表、search/social/other 分类

## 输入文件

1. docs/tasks/T078-read-tracking-hardening/P1-requirements.md — 34 条 BDD（必读，设计目标）
2. docs/tasks/T078-read-tracking-hardening/P0-brief.md — 任务简报
3. backend/peekview/services/read_tracking_service.py — 现有实现（record_read / get_read_stats / get_read_events）
4. backend/peekview/api/_shared.py — _record_read_async 调用入口
5. backend/peekview/api/entries.py — 探针放置点（_detect_channel / list_entries / get_entry / download_zip）
6. backend/peekview/api/files.py — 探针放置点（download_file / get_file_content / get_entry_raw）
7. backend/peekview/models.py — EntryRead / ReadStatsResponse / AdminStatsResponse
8. backend/peekview/services/entry_service.py — _cleanup_reads
9. backend/peekview/services/admin_service.py — cleanup_expired / get_stats / backup / restore
10. backend/peekview/database.py — _run_migrations（迁移模式参考）
11. backend/peekview/config.py — PeekCleanup（配置模式参考）

## 客观查证信息

### 现有代码结构

- record_read() 在 read_tracking_service.py，签名：record_read(entry_id, entry_owner_id, action, channel, reader_id, reader_ip)
- _record_read_async() 在 _shared.py，从 app_state 获取 read_tracking_service
- _detect_channel() 在 entries.py:36，只看 X-PeekView-Source header + share= query param
- files.py 三处 channel 判断内联（不走 _detect_channel）
- _cleanup_reads() 在 entry_service.py:782，删 entry 时调，只删 entry_reads
- cleanup_expired() 在 admin_service.py:192，目前只清理过期 entry
- backup() 在 admin_service.py:304，整库 SQLite backup
- _run_migrations() 在 database.py:39，ALTER TABLE 模式

### 关键设计决策（P0 已定）

1. window_key 加 action：`f"{eid}:{fingerprint}:{channel}:{action}:{window_ts}"`
2. 删 entry 保留聚合统计：_cleanup_reads 只删 entry_reads，不删 entry_read_stats
3. discover 不入聚合表：entry_id=None 的 discover 事件只在 admin stats 从原始表查
4. total_count 含 self_read，unique_readers 排除 self_read（语义不变）
5. get_file_content action 保持 "read"（不改）

## 关键设计问题（architect 必须回答）

1. **聚合表写时更新策略**：record_read() 已有 window_key 去重（同一分钟同一人同一 action+channel 合并 count+1）。聚合表更新时机：是每次 record_read 都更新，还是 window_key 命中 existing 时只更新 count 不更新聚合表（因为聚合表已经记过这个 window）？设计要避免重复计数。

2. **_detect_channel 提取位置**：从 entries.py 提取到 _shared.py 共享，files.py 三处调用。architect 确认提取后的签名和行为。

3. **source 分类函数位置**：_classify_source(referer, host) 放在 read_tracking_service.py 还是 _shared.py？record_read() 签名加 source 参数还是加 referer 参数（内部分类）？

4. **reader_fingerprints 存储**：逗号分隔字符串 + in 检查。architect 确认字段格式和更新逻辑（追加 + 去重）。

5. **迁移回填**：启动时检查 entry_read_stats 为空且 entry_reads 有数据 → 回填。architect 设计回填 SQL（GROUP BY entry_id + JSON 聚合）。

6. **90 天清理**：整合进 cleanup_expired()。architect 确认清理顺序（先聚合后清理）和 cutoff 逻辑。

## 门槛

- P2-design.md 候选方案 ≥2 + 权衡 + 选择理由（或 design_trivial/follows_existing_pattern 附理由时 1 个）
- 四字段：packages / domains / ui_affected / gate_commands
- files_to_read 清单
- minimal_validation 声明
- gate_commands.P5 = "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"

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
4. 预跑 check-gate.sh P2（脚本化检查）
5. 更新 .state.yaml phase=P2 → P3
6. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P2): {摘要}"

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
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.sh 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review / office-hours |

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
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.sh P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.sh 自动读取测试运行器）
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
