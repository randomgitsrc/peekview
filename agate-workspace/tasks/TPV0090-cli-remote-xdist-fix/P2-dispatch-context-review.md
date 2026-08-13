---
phase: P2
task_id: TPV0090-cli-remote-xdist-fix
type: review
parent: P2-design.md
trace_id: TPV0090-P2-review-20260813
status: draft
---

# P2 派发上下文 — review（backend 方案评审）

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
6. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
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
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

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

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

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

## 目标

评审 `P2-design.md`（方案设计），产出 `P2-review.md`。gate 硬性要求 P2-review.md 存在 + approved + agent≠main（P2 评审不可裁剪）。

## 设计概要（已被 architect 选定）

修复 `test_cli_remote.py` 在 `-n auto` 并发下失败。**选型：候选 1（worker 动态端口 + poll 死亡检测 + teardown 强化）**：

```python
worker = os.environ.get("PYTEST_XDIST_WORKER")
port = 18888 + int(worker[2:]) if worker else 18888  # gw0..gw15 → 18888..18903
```

- 每 worker 一个独占端口（18888+worker_index），端口竞争从机制上消除
- 等待循环每轮先 `proc.poll()`，死亡立即 raise + 报错含 rc + stderr 摘要（BDD-4）
- teardown：`terminate()` → `wait(5)` → 超时 `kill()` 兜底（I6）
- 无 xdist（单跑/CI）回退 18888，与修复前行为逐位一致（I5）

**否决了候选 2（xdist_group）**：minimal_validation 实测默认 `dist=load` 下分组不 honor，必须改全局 `--dist=loadgroup`（违反 P1 §7 硬约束不改 pyproject.toml）。**否决候选 3（Makefile 拆跑）**：BDD-1 裸命令 `-n auto` 仍复现竞争。

**SCOPE+**：packages 从 [test_cli_remote.py, Makefile] 收敛为 [test_cli_remote.py]（Makefile 零改动），已回写 P1-requirements.md SCOPE_RESOLVED。

## 评审重点

1. **方案正确性**：端口推导 `int(worker[2:])` 对 `gw0`..`gw15` 是否正确？有无边界（worker 名非 gwN 格式？worker 数超端口范围）？
2. **minimal_validation 可信度**：4 项实测（xdist_group 不 honor / PYTEST_XDIST_WORKER 唯一端口 / poll 快速失败 / 无 -n 无副作用）方法是否扎实？结论是否支持选型？
3. **BDD 覆盖**：4 条 BDD 是否都被方案满足？BDD-4 时间界量化（≤1s，P3 断言 <5s）是否合理？
4. **约束遵守**：P1 §7（不改 pyproject.toml / ci.yml / Makefile / 业务代码）是否全部满足？I1-I8 逐项核对？
5. **SCOPE+ 合理性**：packages 收敛是否合理？（P1 原含 Makefile 是因方案 C 可能改，选型后确实零改动）
6. **风险**：PYTEST_XDIST_WORKER 命名依赖、端口范围、残留进程（I6）是否充分评估？

## 约束

1. **只审不写**——不修改 P2-design.md
2. 产出写 `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P2-review.md`
3. Header `status:` 初始 `draft`，评审完改为 `approved` / `needs-revision` / `rejected`
4. **必须引用具体锚点**（方案章节号/函数名/BDD 编号），不能裸 approved
5. 有 BLOCKER/CRITICAL 必须明确标出 → rejected
6. 环境隔离：只读，不改任何代码；可跑 pytest 验证（backend/.venv）；严禁触碰 :8080 生产与 ~/.peekview/
7. 每读一个输入文件追加 progress 到 `P2-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P2-design.md`（评审对象）
2. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-requirements.md`（4 BDD + I1-I8 + §7 约束）
3. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-review.md`（3 观察项）
4. `backend/tests/test_cli_remote.py`（fixture :19-59）
5. `backend/pyproject.toml`（:50 pytest-xdist 声明 + addopts）

## 产出规格

P2-review.md 必须含：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent（agent: review）
- 方案正确性核查（逐项）
- BDD 映射核查
- 约束遵守核查（P1 §7 + I1-I8）
- SCOPE+ 合理性
- BLOCKER/CRITICAL 清单（无则显式「无 BLOCKER」）
- 结论：approved / needs-revision / rejected

## 返回

File: <路径> + Status: <approved|needs-revision|rejected>
