---
phase: P1
task_id: TPV0090-cli-remote-xdist-fix
type: review
parent: P1-requirements.md
trace_id: TPV0090-P1-review-20260813
status: draft
---

# P1 派发上下文 — requirements-review

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
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
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

`risk_level`/`phases`/`packages`/`domains` 写在文件头 **frontmatter**（`---` 分隔块），不写正文。
**可直接复制的完整样例**：
```yaml
---
phase: P1
task_id: TAG0001           # 替换为实际任务编号
type: problems
parent: P0-brief.md
trace_id: T001-P1-20260101 # {task_id}-P1-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low             # low / medium / high，必填
phases: [P1, P4, P5, P6, P8]   # list of P\d+，必填
packages: [pkg-a]           # list，必填
domains: [backend, frontend]  # list，必填
# 可选字段：override / implicit_coupling / coupling_checklist / internal_only /
# internal_only_reason / 跳过风险 / design_trivial / follows_existing_pattern
# ── v2.0 refactor 任务类型声明（可选，缺省 = 功能任务）──
# change_type: refactor   # 当前仅支持 refactor；枚举非法值由 frontmatter schema 拦截
# ── v2.0 标记"已解决/已确认"状态（可选，仅标记存在时写）──
# need_confirm_resolved: []   # list[str]：已解决的 NEED_CONFIRM 项描述（逐条匹配正文）
# suggest_resolved: []        # list[str]：已采纳的 SUGGEST 项描述
# scope_resolved: []          # list[str]：已解决的 SCOPE+ 项描述
---
```

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

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


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
<!-- AGATE_CARD_END -->

## 目标

独立评审 `P1-requirements.md`，产出 `P1-review.md`（agent≠main）。重点核查：BDD 可二值判定、隐含需求覆盖、跨条一致性、裁剪合理性、P1 纯净性。

## 背景（只读，勿改需求基线）

任务：修复 `test_cli_remote.py` 在 `pytest -n auto`（16 workers）并发下失败。根因：模块级 fixture 各 worker 抢同一 :18888 端口 + 等待循环不检测子进程死亡不打印 stderr。需求基线已由 analyst 产出（4 BDD）。

**关键客观事实（analyst 已查证 + 主 Agent 实测，评审时可复核）**：
1. fixture `scope="module"` 在 xdist 下每个 worker 各跑一份 → 16 worker 抢同一端口
2. 单跑 17/17 全绿；-n auto 下 4~9 failed 随轮次漂移；CI 串行（ci.yml:38）不受影响
3. Makefile test-quick = `pytest tests/ -n auto --tb=short`

## 评审重点（按 requirements-review.md 检查清单）

1. **BDD 可二值判定**：BDD-1「连续 3 次 -n auto 零失败」是否可判定（次数是否足够？）？BDD-4「模拟 server 子进程死亡」在 pytest 里怎么构造？
2. **隐含需求覆盖**：I1-I8 逐维度（数据/前端/多端/边界/兼容）是否覆盖？有没有漏（如端口占用残留、xdist 分组机制、Makefile 改动影响）？
3. **BDD 跨条一致性**：BDD-1（并发全绿）与 BDD-3（单跑不回归）是否矛盾？BDD-4（快速失败）与 BDD-1/2 的关系？
4. **P1 纯净性**：有无掺入 P2 才该有的方案设计？（§4 SUGGEST 提到 B+C 组合——是否算设计混入？）
5. **裁剪合理性**：P3 不可跳（零现成覆盖）、P6 不可裁（本地实测）理由是否充分？P1_simplified 声明是否合理？

## 约束

1. **只审不写**——不直接修改 P1-requirements.md，产出评审意见
2. 产出写 `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-review.md`
3. Header `status:` 初始 `draft`，评审完改为 `approved` / `needs-revision` / `rejected`
4. **必须引用 BDD 编号锚点**——结论不能是裸 approved，逐条标注 BDD-NN + 覆盖维度（数据✓/前端✓/多端✓/边界✓/兼容✓）
5. 无问题也要列出全部 BDD 覆盖维度表（gate 检查锚点存在性）
6. 环境隔离：只读，不得改任何代码；可跑 pytest 验证（勿碰生产）
7. 每读一个输入文件追加 progress 到 `P1-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-requirements.md`（评审对象）
2. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P0-brief.md`（任务背景）
3. `backend/tests/test_cli_remote.py`（fixture + 用例）
4. `Makefile`（:163-166 test-quick）
5. `.github/workflows/ci.yml`（:38 串行）

## 产出规格

P1-review.md 必须含：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent
- `## BDD 评审`：逐条 BDD-NN 判定 + 覆盖维度标注
- `## 隐含需求覆盖`：逐维度覆盖/遗漏
- `## 裁剪评审`
- `## 结论`：approved / needs-revision / rejected

## 返回

File: <路径> + Status: <approved|needs-revision|rejected>
