# 各阶段产出文件模板

> 每个任务目录 docs/tasks/{Txxx}/ 下的标准文件

## 通用 Header（所有文件必须有）
```yaml
---
phase: {P1-P8}
task_id: {Txxx}
type: {problems|design|review|test-cases|...}
parent: {上一阶段文件名，P1 时是外部需求来源}
trace_id: {Txxx}-{Pn}-{YYYYMMDD}
status: {draft|approved|rejected|done}
created: {YYYY-MM-DD}
---
```

## 各阶段文件清单

| 阶段 | 文件 | 关键 Header 字段 |
|------|------|-----------------|
| P0 | P0-brief.md | 主 Agent 亲自填写（非 subagent 产出）：task/known_risks/executor_env/env_constraints/pruning_tendency |
| P1 | P1-requirements.md | 含 BDD 验收条件 + `packages:` `domains:` 初判 + 裁剪说明；无未决 `[NEED_CONFIRM]`（门槛）|
| P2 | P2-design.md | **必须声明 `packages:` `domains:` `ui_affected:` `gate_commands:`；确认/细化 P0-brief 的 `env_constraints`** |
| P2 | P2-review.md | **status: approved/rejected**（门槛）|
| P3 | P3-test-cases.md | 声明 `test_code_dir: {实际路径}`；每用例对应一条 BDD；UI 任务含 E2E 用例 |
| P3 | {test_code_dir}/ | 测试代码目录（项目自定义，如 `backend/tests/`）|
| P4 | P4-implementation.md | 声明 `implementation_dir: {实际路径}` |
| P4 | {implementation_dir}/ | 代码目录（项目自定义，如 `src/` 或 `backend/app/`）|
| P5 | P5-test-results/unit.md | 标注 `failed: N`（仅供参考，gate 以主 Agent 跑 pytest 为准）|
| P5 | P5-test-results/e2e.md | UI 任务必须：Playwright 实跑结果 + 截图路径 |
| P6 | P6-acceptance.md | P1 每条 BDD 有实跑结果；UI 条件含截图；无未决 `[NEED_CONFIRM]`（门槛）|
| P7 | P7-consistency.md | 无 `[BLOCKER]` 标记（门槛）|
| P8 | P8-release.md | 每个 package 的版本 bump + CHANGELOG |

## 路径占位符

P3/P4 的代码路径由产出文件显式声明，不使用固定目录名：

- P3-test-cases.md 必须声明：`test_code_dir: backend/tests/`
- P4-implementation.md 必须声明：`implementation_dir: {项目实际源码路径}`

派发 prompt 引用这些声明而非固定路径，避免模板硬编码项目特定路径。

## 门槛字段说明

主 Agent 不依赖 subagent 产出文件字段判定门槛，而是**亲自跑命令验证**：

- P1 → 主 Agent 确认有 BDD 条件 + 无未决 `[NEED_CONFIRM]`
- P2-review.md `status` → subagent 评审产出的结论
- P3 → 主 Agent 跑 `scripts/check-tdd-red.sh` 验证（UI 任务查 Playwright 用例存在）
- P5 → 主 Agent 跑 `pytest -q` 验证（UI 任务实跑 Playwright/E2E）
- P6 → 主 Agent 确认 P1 每条 BDD 有实跑结果 + 无未决 `[NEED_CONFIRM]`
- P7 → 主 Agent grep `[BLOCKER]` 验证
- P8 → 主 Agent 为每个 package 跑发布检查命令验证

## P0-brief.md 结构（主 Agent 任务简报，亲自填写）

P0-brief 是主 Agent 作为 PM 在派发任何 subagent 之前写的判断文件。
不是 subagent 的产出，是主 Agent 的职责——把产品需求翻译为工程视角、注入风险判断。

**核心原则：开发全程在测试环境进行。** 生产环境不在 workflow-v4 的编排范围内——
生产部署属于发布步骤（`make publish` 之后的运维范畴），不属于 P1-P8。

```yaml
## P0-brief.md
task: "一句话描述任务（工程视角，不是产品语言）"

known_risks:
  - "涉及数据 schema 变更（需要在测试环境充分验证迁移逻辑）"
  - "跨越 3 个改动端（API+CLI+客户端）"
  - "修改权限/认证逻辑（安全敏感）"

executor_env:
  platform: "opencode"          # opencode | claude-code | codex | claude-project
  has_task_tool: true           # 能否派发 subagent（false = 单 Agent 模式）
  has_local_runtime: true       # 有完整本地环境（npm/python/playwright/测试框架）
  network: "full"               # full | restricted（restricted 时 npm install 等可能失败）

env_constraints:
  debug_env: "项目的测试/调试环境命令或路径（从项目约定读取，如 CLAUDE.md）"
  # 注意：不写 prod_env。生产环境不在开发流程范围内。
  # 若 subagent 接触了生产环境（[PROD_TOUCHED]），说明它走错路了，立即停止。

pruning_tendency: "保守 — 涉及 schema 变更，建议走完整 P1-P8"
# 或："激进 — 单文件 typo 修复，直接做"

phase_hint: [P1, P2, P3, P4, P5, P6, P8]  # 主 Agent 预判；P3 默认保留，跳过须有理由
# has_task_tool=false 时所有阶段由主 Agent 直接执行，subagent 派发步骤自动降级
```

**P0-brief 的核心价值**：每个 subagent 都在独立上下文里启动，不知道项目约定和环境约束。
P0-brief 是把这些约束注入每次派发的桥梁——所有 subagent 的 prompt 都要包含 P0-brief.md 路径。

## P1-requirements.md 结构（需求基线）

```markdown
## 1. 需求复述
（用结构化语言重写原始需求）

## 2. 隐含需求识别
- 隐含需求 A：... | 为什么必须：...
- 隐含需求 B：... | 为什么必须：...

## 3. BDD 验收条件
- AC1: Given ... When ... Then ...
- AC2: Given ... When ... Then ...

## 4. 待确认清单
- [NEED_CONFIRM] 问题描述 + 几种可能的理解

## 5. 裁剪说明
phases: [P1,P2,P4,P5,P6,P8]
- 跳过 P3 理由：...
- 跳过 P7 理由：...

## 6. 范围声明
packages: [pkg-a]
domains: [backend, frontend]

## 7. 能力需求声明
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 UI 交互
    available:
      - playwright-vision skill（已注入）
    status: available          # available / supplementable / GAP

  - need: external-network
    why: 验证 CDN 加载
    available: []
    status: GAP
    [CAPABILITY_GAP: external-network] — 建议降级为 mock 验证

## SCOPE+ 增补区（后续阶段回写）
- [SCOPE+ from P2] 新需求 + 对应 BDD
```

**能力三态说明**：
- `available`：环境中已有（Agent 自身 / 已注入 skill / 可调用外部 agent）→ 自走
- `supplementable`：当前没有但有已知补充路径 → 在 prompt 里指引，不阻塞
- `GAP`：无任何补充路径 → 标 `[CAPABILITY_GAP]`，主 Agent 暂停问人

判断 status 时**先看环境**（已注入的 skills、可调用的 agent），不只看主力模型自身能力。

## P6-acceptance.md 结构（验收报告）

```markdown
## 验收结果（逐条对照 P1 的 BDD）

### AC1: entry 不指定过期时间默认 15 天
- ✅ 创建 entry 不填过期 → 实测 15 天后过期（evidences/p6-ac1.png）
- ✅ MCP publish_files 不传 expires → 实测同样生效

### AC2: ...
- ❌ 实测结果与预期不符：... → 触发回 P4

## 验收小结
BDD 通过 X/Y，UI 截图 N 张，NEED_CONFIRM M 个
```