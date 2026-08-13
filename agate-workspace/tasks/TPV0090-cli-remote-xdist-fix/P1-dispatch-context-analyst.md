---
phase: P1
task_id: TPV0090-cli-remote-xdist-fix
type: requirements
parent: P0-brief.md
trace_id: TPV0090-P1-analyst-20260813
status: draft
---

# P1 派发上下文 — analyst

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

产出 `P1-requirements.md`（需求基线）：`test_cli_remote.py` 在 `pytest -n auto` 并发下失败修复的 BDD 验收条件 + frontmatter 机器字段。必须含 ≥1 条 BDD（Given/When/Then），无未决 NEED_CONFIRM。

## 任务背景（已客观验证，非猜测）

`backend/tests/test_cli_remote.py` 是 CLI remote 模式的进程级集成测试（起真实 peekview server :18888 + 起 CLI 子进程）。

**本次会话已复现确认**：
| 运行方式 | 结果 |
|---------|------|
| 单跑该文件（无 xdist） | 17/17 全绿 |
| `-n auto`（16 workers） | **4 failed**（test_list_* 系列，随轮次漂移） |
| CI（ci.yml:38 串行，无 -n auto） | 不受影响 |

## 代码事实（已读，勿重查）

**fixture** `backend/tests/test_cli_remote.py:19-59`（scope="module"）：
1. `tmp_path_factory.mktemp` 建临时数据目录
2. `subprocess.Popen([sys.executable, "-m", "peekview", "serve", "--port", "18888"], ...)` 起 server，env 设 PEEKVIEW_STORAGE__* + PEEKVIEW_SERVER__PORT=18888
3. 等待循环：`for _ in range(30): requests.get(url/health, timeout=1)` 成功 break；ConnectionError 时 sleep(0.5)；**30 次 × ~0.5s ≈ 15s 窗口**；超时 `proc.terminate()` + `raise RuntimeError("Server failed to start")`
4. **不检测 `proc.poll()`**（子进程死亡时傻等 15s），**不打印 stderr**（诊断缺失）
5. cleanup：`proc.terminate()` + `proc.wait(timeout=5)`

**关键根因**：fixture `scope="module"` 在 xdist 下**每个 worker 各跑一份** → 16 个 worker 同时 Popen 监听 :18888 → **端口冲突**（多个 server 抢同一端口，后启动的 bind 失败）→ 部分 worker 的 server 起不来 → 该 worker 内依赖 fixture 的用例连锁失败（test_list_* 因为 create_test_entries autouse fixture 也依赖 server_url）。

**Makefile test-quick**（:163-166）：`cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`

## 修复候选（P2 需选型，P1 只做需求基线不选型）

- 方案 A：等待窗口加长（30→60 次）——1 行，治标（负载极高仍可能不够）
- 方案 B：检测子进程死亡（`proc.poll()` + 立即报错打印 stderr）——治标，提升诊断
- 方案 C：该文件串行/分组（`pytestmark = pytest.mark.xdist_group("cli_remote")` 或 Makefile 排除 xdist）——治本（进程级集成测试不适合并发）
- 可能最优 B+C 组合

## 约束

1. **BDD 必须描述可观察行为**，不是实现细节（例：「`make test-quick` 全绿且 test_cli_remote 零失败」，不是「fixture 用 poll()」）
2. **domains**：backend（测试基础设施）
3. **packages**：backend/tests/test_cli_remote.py（+ 可能 Makefile/CI 配置，由你判断）
4. **risk_level**：low（P0-brief 已定；纯测试基础设施，无业务代码/schema/权限改动）
5. **phases**：默认全走；P3 不可跳（零现成覆盖——问题本身是测试基础设施 bug，修复无现成测试可验证）；P6 需本地实测 -n auto 全绿 + 单跑不回归
6. **capability_requirements**：P6 需要本地 pytest -n auto 实测（能力 available，本次已复现）
7. **无 [NEED_CONFIRM]** 或全部转为 [SUGGEST]；无法自决的写 [NEED_CONFIRM] 列表，主 Agent 会人工处理
8. **标记格式**（TPV0091 教训）：`[NO_NEED_CONFIRM]` 和 `[SUGGEST: ...]` 必须**行首无反引号**（gate 正则匹配 `^\s*-?\s*\[NO_NEED_CONFIRM\]` / `^\s*-?\s*\[SUGGEST:`）
9. **环境隔离**：只读代码，不得修改任何文件（P1 是分析产出阶段）。复现可跑 pytest（勿停 debug、勿碰生产）
10. 产出写 `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P1-requirements.md`
11. 每读完一个输入文件，把发现追加到 `P1-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0090-cli-remote-xdist-fix/P0-brief.md`（任务简报，env_constraints/known_risks）
2. `backend/tests/test_cli_remote.py`（fixture + 17 用例）
3. `Makefile`（:163-166 test-quick 的 -n auto）
4. `.github/workflows/ci.yml`（:38 串行确认）
5. `backend/pyproject.toml`（pytest addopts / xdist 配置）
6. `AGENTS.md`（铁律）

## 验证手段（可用）

- 复现：`cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -n auto -q --tb=no`
- 单跑基线：`cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -q --tb=no`

## 产出规格

P1-requirements.md 必须包含（frontmatter 见 P1 阶段卡片样例）：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent + risk_level/phases/packages/domains
- BDD 验收条件（`#### BDD-NN:` 编号锚点格式，Given/When/Then）
- capability_requirements（available/supplementable/GAP 三态）
- 无未决 [NEED_CONFIRM]（有则写列表；无则行首 `[NO_NEED_CONFIRM]`）

## 返回

路径 + 一句话摘要（BDD 条数、domains、有无 NEED_CONFIRM）。
