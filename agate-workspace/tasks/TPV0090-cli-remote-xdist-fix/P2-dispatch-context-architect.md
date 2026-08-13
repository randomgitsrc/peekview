---
phase: P2
task_id: TPV0090-cli-remote-xdist-fix
type: design
parent: P1-requirements.md
trace_id: TPV0090-P2-architect-20260813
status: draft
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

产出 `P2-design.md`：修复 `test_cli_remote.py` 在 `pytest -n auto` 并发下失败的**方案设计**。候选方案 ≥2 + 权衡 + 选择理由 + 四字段 + minimal_validation。

## 已确认事实（P1 查证 + 本次会话实测，勿重查）

1. **根因**：fixture `scope="module"`（test_cli_remote.py:19-59）在 xdist 下**每个 worker 各跑一份** → 16 worker 同时 Popen 监听 :18888 → **端口竞争**。评审实测 -n auto 失败是 `Connection refused`（非 "Server failed to start"）——直接佐证端口竞争
2. **现象**：单跑 17/17 全绿；-n auto 下 4~9 failed 随轮次漂移；CI 串行（ci.yml:38 无 -n auto）不受影响
3. **fixture 缺陷**：等待循环不检测 `proc.poll()`（子进程死亡时傻等 15s）、不打印 stderr（诊断缺失）；cleanup `proc.terminate()` + `wait(timeout=5)`
4. **Makefile test-quick**（:163-166）：`pytest tests/ -n auto --tb=short`

## 修复候选（P1 已列，P2 需选型 + 权衡）

- **方案 A**：等待窗口加长（30→60 次）——1 行，治标
- **方案 B**：检测子进程死亡（`proc.poll()` + 立即报错打印 stderr）——治标，提升诊断（BDD-4 必需）
- **方案 C**：该文件串行/分组——治本（进程级集成测试不适合并发）：
  - C1：`pytestmark = pytest.mark.xdist_group("cli_remote")`（需要 pytest-xdist ≥3.1 的 xdist_group 支持 + 其他模块不要和它同组）
  - C2：Makefile 对该文件排除 xdist（拆两次 pytest 调用，一次 -n auto 跑其余 + 一次串行跑该文件）
  - C3：fixture 改 function scope + 每 worker 动态端口——但会失去"共享 server"效率，且改动大
- **组合**：B+C（BDD-4 需要 B 的快速失败诊断；BDD-1/2/3 需要 C 的确定性）

## 关键设计问题（P2 必须回答）

1. **方案 C 选型**：xdist_group（C1）vs Makefile 拆跑（C2）？对比：
   - C1：`pytestmark = pytest.mark.xdist_group("cli_remote")` 让该文件所有用例在同一 worker 串行执行——**但多个模块若同组会合并**，本项目只有这一个模块用该组名 → 等效该文件在单 worker 串行。需要验证 pytest-xdist 版本支持（pyproject.toml:50 `pytest-xdist>=3.0.0`——xdist_group 是 3.1 加的！）
   - C2：Makefile 拆两次 pytest 调用（`-n auto` 跑 tests/ 排除该文件 + 串行跑该文件）——改动 Makefile + pytest 参数，更显式但 Makefile 变复杂
   - 版本核实：`cd backend && .venv/bin/python -m pytest --version` 看 xdist 版本（3.x）
2. **BDD-4 实现**：`proc.poll()` 检测——server 启动阶段死亡时立即 terminate + raise，错误含 `proc.stderr` 摘要。时间阈值（P1-review 观察①：BDD-4 "立即失败"需量化——如 poll 检测频率 0.25s，死亡后 ≤1s 内失败）
3. **I6 清理**：teardown 强化——`proc.terminate()` 后 `wait(timeout=5)` + 确认端口释放（P1-review 观察②：补 teardown 回收断言）
4. **gate_commands**：P3/P5 跑 test_cli_remote + 全量；P5_e2e 不需要（ui_affected: false）
5. **测试策略**：P3 新增 fixture 级测试（模拟 server 启动慢/死亡/端口冲突场景，支撑 BDD-4；BDD-1/2/3 靠真实 -n auto 运行验证）

## P2 最小验证（必须执行，结果写入 P2-design.md）

方案 C1 依赖 pytest-xdist 的 xdist_group 支持 → 必须做 minimal_validation：
- `cd backend && .venv/bin/python -m pytest --version` 确认 xdist 版本（3.1+ 才有 xdist_group）
- 用 10 行最小 fixture 验证 xdist_group 效果（若版本支持）
- 验证方案 B 的 poll 检测逻辑（10 行脚本模拟 server 死亡场景）

## 约束

1. 产出 `P2-design.md`，frontmatter 含 candidate_count / packages / domains / ui_affected
2. 正文含四字段：gate_commands / files_to_read / env_constraints / minimal_validation
3. `candidate_count` 与正文候选方案数一致
4. packages = [backend/tests/test_cli_remote.py, Makefile]（P1 已定；若 C1 则不含 Makefile）
5. domains = [backend]
6. ui_affected: false（纯测试基础设施，无 UI）
7. risk_level=low（P1 已定）
8. 环境隔离：只读代码，不改任何文件；可跑 pytest 验证；严禁触碰 :8080 生产与 ~/.peekview/
9. 每读一个输入文件追加 progress 到 `P2-progress.md`
10. 产出写 `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P2-design.md`

## 输入文件

1. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-requirements.md`（4 BDD + I1-I8）
2. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-review.md`（3 观察项）
3. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P0-brief.md`（env_constraints）
4. `backend/tests/test_cli_remote.py`（fixture :19-59 + 17 用例）
5. `Makefile`（:163-166 test-quick）
6. `backend/pyproject.toml`（:50 pytest-xdist 版本声明 + addopts）
7. `.github/workflows/ci.yml`（:38 串行）

## 验证手段

- `cd backend && .venv/bin/python -m pytest --version`（xdist 版本核实）
- `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -n auto -q --tb=no`（复现）
- `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -q --tb=no`（单跑基线）
- 10 行脚本验证 poll 检测 / xdist_group

## 产出规格

P2-design.md 必须含：
- frontmatter：phase/task_id/type/parent/trace_id/status/created/agent + candidate_count/packages/domains/ui_affected
- 候选方案 ≥2 + 权衡表 + 明确选择
- gate_commands（P3/P5）
- files_to_read（控制 P4 上下文，精挑）
- env_constraints
- minimal_validation（实测结果）

## 返回

路径 + 一句话摘要（候选方案数、选择、minimal_validation 结论）。
