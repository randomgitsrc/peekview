# 子 Agent 派发协议

> workflow-v4 核心文件，解决"主 Agent 不派发、自己一路走到底"的问题

---

## 问题诊断

v2 说"主 Agent 写入 P1 输出到子 Agent 2 上下文"——这对 LLM 是**不可执行的描述**。"写入上下文"具体是什么操作？没说。LLM 面对模糊指令，会选阻力最小的路径：自己继续做。

v3 的派发协议把这句话翻译成**明确的工具调用 + 精确的输入输出规范**。

---

## 派发的三条铁律

### 铁律 1：用 task 工具派发，动词是"派发"不是"执行"

主 Agent 到了某个阶段，**不自己产出文件**，而是调用 task 工具启动一个 subagent。

```
❌ 错误理解："P2 阶段我要产出 P2-design.md" → 主 Agent 自己写
✅ 正确理解："P2 阶段我要派发一个 architect subagent 去产出 P2-design.md"
```

### 铁律 2：prompt 只传文件路径，不传文件内容

```
❌ 错：把 P1-requirements.md 的全文复制进 subagent 的 prompt
✅ 对：prompt 写"读取 docs/tasks/T002/P1-requirements.md"
```

subagent 在自己独立的上下文里读文件。主 Agent 的上下文永远不碰这些文件的全文。**这是上下文隔离的核心。**

### 铁律 3：subagent 只返回"路径 + 一句话摘要"

```
❌ 错：subagent 把 P2-design.md 全文返回给主 Agent
✅ 对：subagent 返回 "已产出 docs/tasks/T002/P2-design.md，方案采用 schema version 表 + 迁移脚本目录，3 个迁移步骤"
```

主 Agent 只拿摘要做门槛判断，需要细节时让下一个 subagent 自己去读文件。

---

## subagent 返回校验（处理 subagent 自身失败）

subagent 可能崩溃、超时、不产出文件、或不遵守"只返回摘要"。主 Agent 收到返回后必须校验，不能假设 subagent 一定成功。

```
subagent 返回后，主 Agent 校验：
  1. 约定的产出文件是否真的存在？
      不存在 → 派发失败，计入重试，带"未产出文件"原因重派
  2. 返回是否是"路径+摘要"格式？
      返回了文件全文 → 直接判失败重试，要求 subagent 重新只返回摘要
  3. 产出文件是否含合法 Header（phase/task_id/parent/trace_id）？
      没有或不完整 → 门槛不通过，计入重试
  4. 产出文件内容是否非空且有实质内容？
      空文件或半截内容（写一半崩了）→ 视为失败，重试
  5. 独立验证 subagent 的声明：
      主 Agent 必须亲自执行 gate 命令验证门槛，不能仅凭 subagent
      返回的摘要或产出文件中的声明判定通过。
      例：P5 subagent 说 "failed=0" → 主 Agent 跑 pytest -q
          确认 exit 0 且 failed 行确实为 0，才算通过。

任一校验失败 → 计入重试计数，超限则 PAUSED。
```

**关键：主 Agent 永远不信任 subagent 的口头返回，以自己执行的命令结果为准。**

---

## 标准派发流程（每个阶段）

```
主 Agent 执行：

0. 任务启动（仅首次，任务刚收到时）

   主 Agent 首先必须写 P0-brief.md，然后再派发任何 subagent。
   这是主 Agent 作为 PM 的判断输出，P1 analyst 以此为输入做需求质疑和 BDD。

   P0-brief.md 结构（主 Agent 亲自填写）：
   ```yaml
   task: {一句话描述这个任务是什么}
   known_risks:
     - {已知风险1，如：涉及 schema 变更}
     - {已知风险2，如：跨越 N 个改动端}
   env_constraints:
     debug_env: {项目的测试/调试环境路径/命令，从项目约定读取}
     # 不写 prod_env：生产环境不在 v4 开发流程范围内
   pruning_tendency: {保守/激进 + 一句话理由}
   phase_hint: [P1, P2, ..., P8]  # 主 Agent 预判，P1 analyst 可调整，但须经主 Agent 确认
   ```

   P0-brief 完成后，第一步输出只允许两种内容之一：
   a) 派发 P1 analyst（传入 P0-brief.md 路径作为主要输入）
   b) 判断为微/小任务并声明「直接执行」的理由

   任何其他输出（分析方案、直接改代码）视为违规。

   —— T005/T006 教训：主 Agent 把「提炼问题定义」也委托给了 subagent，
      P1 analyst 拿到的是用户原始需求文档，缺少主 Agent 对环境约束、风险、裁剪倾向的判断注入。
      P0-brief 是主 Agent 作为 PM 的思考文件，不可省略。

1. 读状态
   读 docs/tasks/active-tasks.md → 确认当前任务和阶段
   读 docs/tasks/Txxx/ → 确认上一阶段产出文件存在

2. 选角色
   按阶段从 assets/execution-roles/ 选执行角色
   （P1→analyst, P2→architect, P3→test-designer, P4→implementer, P5→verifier）

3. 派发 subagent（task 工具）
   传入：
     - 角色定义文件路径（assets/execution-roles/xxx.md）
     - 输入文件路径（上一阶段产出，不传内容）
     - 输出要求（产出哪个文件 + Header 规范 + 门槛）
     - 返回要求（只返回路径 + 摘要）

4. 接收返回
   只读 subagent 的摘要，不读产出文件全文

5. 门槛检查
   读产出文件的 Header / 关键字段，判断门槛是否通过
   （可判定条件，见下）

6. 更新状态
   更新 active-tasks.md 的阶段和状态
   门槛通过 → 进入下一阶段（回到步骤 1）
   门槛失败 → 重试（重试计数 +1，超限则停下报告）
```

---

## 派发 prompt 模板

主 Agent 调用 task 工具时，prompt 用这个结构（详见 `assets/templates/dispatch-prompt.md`）：

```
你是 {阶段} 阶段的 {角色名} 子 Agent。

## 你的角色定义
读取并遵循：docs/process/workflow-v4/assets/execution-roles/{role}.md

## 项目约定（必读）
- {project_conventions_file}（项目约定、命名规范、目录结构）
- docs/tasks/{Txxx}/P0-brief.md（本任务的环境约束和风险声明）

## 环境隔离（强制，所有阶段适用）
本任务的环境约束见 P0-brief.md 的 env_constraints 字段。
- 调试/验证必须使用 P0-brief 的 debug_env 声明的测试环境，严禁直接操作生产环境
- 开发全程不应接触生产环境；若意外接触，立即停止并标注 [PROD_TOUCHED] 报告主 Agent

## 输入（自己读取，不要等我提供内容）
- docs/tasks/{Txxx}/P0-brief.md（主 Agent 的任务简报和风险声明）
- docs/tasks/{Txxx}/{上一阶段产出文件}
- docs/process/workflow-v4/README.md（流程规范）

## 任务
{这个阶段要做什么，一两句话}

## 输出
产出文件：docs/tasks/{Txxx}/{本阶段产出文件}
必须包含 Header：
  phase: {Pn}
  task_id: {Txxx}
  parent: {上一阶段文件名}
  trace_id: {Txxx}-{Pn}-{日期}

## 门槛（什么算完成）
{可判定的完成条件}

## 返回给我
只返回两行：
  1. 产出文件路径
  2. 一句话摘要（不超过 30 字）
不要返回文件全文。
```

**[PROD_TOUCHED] 标记说明**：任何 subagent 若在执行过程中意外接触了生产环境（写入、读取真实数据、触发外部调用），立即在产出文件标注：
```
[PROD_TOUCHED] 接触了生产环境：{描述具体行为}
影响范围：{估计}
是否可逆：{是/否}
```
主 Agent 看到 [PROD_TOUCHED] → 立即暂停流程 → PAUSED → 报告人工处置。

---

## 可判定门槛规范

门槛必须是**主 Agent 亲自跑命令可验证的明确值**，不能是模糊判断或仅依赖 subagent 产出文件字段。

| 阶段 | 门槛 | 怎么判定（主 Agent 亲自执行）|
|------|------|--------------------------|
| P1→P2 | 需求基线建立 | P1-requirements.md 存在 + 有 Header + 含 ≥1 条 BDD 条件 + 无未决 `[NEED_CONFIRM]` |
| P2→P3 | 方案已批准 | P2-review.md 的 Header `status: approved` + P2-design.md 声明 packages/domains/ui_affected |
| P3→P4 | TDD 真红灯 | `scripts/check-tdd-red.sh` exit 0（UI 任务额外确认 Playwright 用例存在）|
| P4→P5 | 实现完成 | P4-implementation/ 下文件非空 + `git log --oneline -1` 确认 P4 commit |
| P5→P6 | 技术验证通过 | `pytest -q` exit 0 AND failed==0（亲手跑）+ 若 ui_affected：Playwright/E2E 实跑通过 |
| P6→P7 | BDD 验收通过 | P6-acceptance.md 中 P1 每条 BDD 都有实跑结果 + 无未决 `[NEED_CONFIRM]`（UI 条件须截图）|
| P7→P8 | 一致性通过 | `! grep -qF '[BLOCKER]' P7-consistency.md`（已知限制：定性分析，P5 回归测试兜底）|
| P8→READY | 发布准备完成 | **每个** P2 声明的 package 的发布检查命令 exit 0 + `git diff` 确认各包 version bump + CHANGELOG |

**反例（禁止用作门槛）：**
- ❌ "unit.md 里 failed: 0"（信 subagent 写的数字）
- ❌ "P8-release.md 存在"（文件存在不等于已发布）
- ❌ "P6 里 subagent 写了 ✅"（信 subagent 自我报告，见下方 C7 规则）
- ❌ "UI 代码看起来对"（UI 必须实跑 Playwright，不接受目测）
- ❌ "方案足够好" / "测试差不多了"

**A1 原则**：gate 判定是主 Agent 运行命令得到的客观事实，不是 subagent 文件里的声明。

**C7 规则（subagent 自我报告不可信）**：subagent 产出里的"检查结果""✅/通过"等自评，**仅供参考，绝不作为 gate 判定依据**。gate 一律以主 Agent 亲自跑命令的结果为准。T005 教训：P8 subagent 把 `1 failed` 标成 ✅，主 Agent 若信了就放行了缺陷。

**packages 动态注入（B4/B6）**：派发 P8 subagent 时，主 Agent 必须先读 P2-design.md 的 `packages:` 声明，把"需要 bump 哪些包"明确写进 prompt，并据此从 `gate_commands:` 字段生成各包的 gate 命令集。不能用固定的单包命令——不同项目的发布命令不同，必须从 P2 声明读取。

**P5/P6 gate 命令固化（B7）**：P5/P6 的 gate 命令必须从 P2-design.md 的 `gate_commands:` 字段读取，不得在派发 prompt 里自行修改或降级。
- subagent 要求跳过命令 / 换更简单的命令 → `[SCOPE_GAP]`，不通过
- 命令本身跑不通（能力缺口）→ `[CAPABILITY_GAP]` 交人决策，不得自行降级为目测
- T004 教训 B7：P6 子代理连续失败后，主 Agent 要求「不用 Playwright，纯命令行验证」—— 这是主 Agent 降级了 P2 已固化的验收标准，属于违规。

**SCOPE+ / SCOPE_GAP 扫描**：每次 subagent 返回后，主 Agent 扫描产出是否含 `[SCOPE+]`（新隐含需求 → 增补 P1 基线 + 定向回补）或 `[SCOPE_GAP]`（prompt 漏了 P2 已声明的改动 → 修正 prompt 重派）。

---

## 重试与上限

```
门槛失败时：
  retry_count += 1
  if retry_count <= MAX_RETRY (见 state-machine.md 重试上限表):
      带着失败原因重新派发同阶段 subagent
      （prompt 里加上"上次失败原因：xxx，请修正"）
  else:
      触发 L2 上溯（见 state-machine.md 评审迭代机制）
      上溯后重新开始该阶段
```

重试计数也落盘（写进 `.state.yaml`），避免主 Agent 忘记重试了几次。

---

## Subagent 安全

### 硬超时保护

1. **硬超时**：`task` 工具设 generous timeout（默认 10 分钟），防止无限等待
2. **进展标记**：派发 prompt 中要求 subagent 每隔若干关键操作输出进度标记
   `[progress] N/M files processed` 到 stdout，让平台日志可追溯
3. **存活检查**：真正的存活监控（心跳、文件增长检测）需平台原生支持并发后补，当前为已知限制

### 升级机制（[UPGRADE] 标记）

subagent 可在产出文件中标注 `[UPGRADE]` 并附建议：

```
> [UPGRADE] 建议拆分为 Txxx-a / Txxx-b，原因：需求范围过大，单任务不可行
```

主 Agent 看到 `[UPGRADE]` → 停止自动流程 → PAUSED 交人工决策。

### P1 范围把关

P1 完成后可选评审（触发条件：任务优先级 P0/P1、架构变更、跨越 3+ 模块）：

派发 `office-hours`（YC 合伙人）评审 P1 产出：
- 问题定义是否准确
- 范围是否合理
- AC 是否可验证

### 不可逆操作保护协议（通用）

**基本原则：开发全程在测试环境进行，生产环境不在 v4 范围内。**

任何阶段，只要涉及以下操作，必须触发 `[NEED_CONFIRM]` 硬中断，等人确认后才可执行：

- **批量数据删除**：即使在测试环境，批量 DELETE / DROP TABLE / 清空也需人工确认范围
- **数据 schema 迁移**：测试环境的迁移逻辑需人工确认后再执行
- **不可逆的外部调用**：发送邮件/通知、扣费、第三方 API 写操作（应在测试环境用 mock）

`[NEED_CONFIRM]` 输出格式（T005/T006 教训）：
```
[NEED_CONFIRM] 不可逆操作待确认

操作类型：{删除/迁移/写入/...}
影响范围：{列出将被影响的数据/文件/资源，尽量具体}
是否已备份：{是（备份路径）/ 否（原因）}
建议操作：{具体要执行的命令或步骤}

请确认执行，或说明调整方案。
```

**严禁在未收到人工确认的情况下执行上述操作。**
备份先于删除——若无法备份，必须在 [NEED_CONFIRM] 中说明原因，等人决策。

### [CAPABILITY_GAP] 处理协议

P1 产出的 `capability_requirements` 中，`status: GAP` 的条目触发此协议：

**主 Agent 处理步骤**：
1. 暂停进入 P2，输出 `[CAPABILITY_GAP]` 报告给人：
   ```
   [CAPABILITY_GAP] 任务 {Txxx} 在 P1 检测到能力缺口：
   - need: {能力名称}
   - why: {为什么需要}
   - 当前环境：无可用补充路径
   - 建议选项：
     A) 注入 {skill名称} / 连接 {@agent名称}
     B) 降级验收标准（说明降级后的影响）
     C) 换具备该能力的模型
   ```
2. 等人选择后继续

**三态判断（不要只看主力模型能力）**：
- `available`：Agent 自身 OR 已注入 skill OR 可调用外部 agent → 不触发，流程自走
- `supplementable`：当前没有但有已知补充路径 → 在后续 prompt 中指引获取，不触发
- `GAP`：主力模型 + 环境均无补充路径 → 触发 `[CAPABILITY_GAP]`

**supplementable 能力的传递规则（A3 修复）**：
P1 产出 `capability_requirements` 后，主 Agent 在派发后续阶段时必须：
1. 读 P1-requirements.md 的 `capability_requirements`，提取 `status: supplementable` 的条目
2. 在该阶段的派发 prompt 里注入能力获取指引，例如：
   ```
   ## 能力补充说明
   本任务 P6 验收需要 browser-vision 能力。
   可用方式：派发 vision-analyst（docs/process/workflow-v4/assets/execution-roles/vision-analyst.md）
   ```
3. 若能力在 P3/P4 阶段就需要（如 Playwright viewport 配置），提前在对应阶段 prompt 里注入
如未注入，subagent 不知道补充方式，supplementable 等效退化为 GAP。

**注意**：`supplementable` 不是 `GAP`。
T004 教训 B8：P6 需要 vision，主力模型没有，但环境里有 playwright-vision skill 可注入。
如果 P1 就识别出这是 `supplementable` 并提示「需要注入 playwright-vision skill」，
就不会跑到 P6 才撞墙，也不会触发 B7（主动要求跳过 Playwright）。

**什么时候 supplementable 升级为 GAP**：
人无法或不愿提供补充路径 → 人主动标记为 GAP → 此时才降级验收标准。
主 Agent 不得自行决定降级。

---

## 平台适配

### OpenCode

用 `task` 工具派发，`subagent_type` 指定角色。

**自定义角色用 markdown 文件方式定义**（放在 OpenCode 的 agent 目录，文件名即角色名）。

⚠️ **已知坑（issue #29616）**：用 `opencode.jsonc` 里 `mode: "subagent"` 定义的自定义 agent 可能无法被 task 工具调起来（subagent_type 枚举硬编码只有 explore/general）。**优先用 markdown 文件方式定义自定义角色**，并在实际环境先做最小验证：定义一个测试角色，让主 Agent 派发它，确认能调起来。

如果自定义角色确实调不起来，退路：用内置的 general subagent，把角色定义文件路径写进派发 prompt 让它读取遵循（角色行为靠 prompt 注入而非平台机制）。

### Claude Code

用 Agent Teams（2026-02 起）或 Task 工具派发。lead agent spawn teammate agent，各自独立上下文，通过消息传递协调。角色定义可以放 `.claude/agents/` 下的 markdown。

### Codex

用 spawn_agent / send_input / wait / close_agent 工具套件。`agents.max_depth` 默认 1（允许直接子 agent，禁止深层嵌套）。自定义 agent 在 `[agents]` 配置。Codex 只在被明确要求时才 spawn subagent，所以派发指令要明确。

---

## 完整派发示例（T002 P2 阶段）

```
主 Agent：

1. 读 active-tasks.md → T002 在 P2 阶段
2. 确认 docs/tasks/T002/P1-requirements.md 存在 ✓
3. 选角色：architect（P2 执行角色）
4. 调用 task 工具：
   subagent_type: architect（或 general + 注入角色文件）
   prompt:
     你是 P2 阶段的 architect 子 Agent。
     角色定义：读取 docs/process/workflow-v4/assets/execution-roles/architect.md
     输入：读取 docs/tasks/T002/P1-requirements.md 和 P1-requirements.md
     任务：为数据库迁移问题设计方案
     输出：docs/tasks/T002/P2-design.md（含 Header）
     门槛：方案覆盖 P1 列出的所有问题
     返回：只返回文件路径 + 一句话摘要
5. subagent 返回："docs/tasks/T002/P2-design.md，采用 schema_version 表 + 顺序迁移脚本"
6. 派发评审 subagent（plan-eng-review 角色）→ 产出 P2-review.md
7. 读 P2-review.md 的 Header status
   - approved → 更新 active-tasks.md，T002 进入 P3
   - rejected → 重试 architect（retry_count=1），通过文件路径回流评审意见（见下）
```

### 评审打回后的意见回流（重要）

rejected 重试时，architect 必须知道"上次为什么被打回"，否则会产出同样的东西再次被打回，空转到 retry 耗尽。

**评审意见通过文件路径回流（不是主 Agent 读全文塞 prompt）：**

```
rejected 时，主 Agent 的重试派发 prompt 里加一行：
  "上一轮方案被评审打回。评审意见见 docs/tasks/Txxx/P2-review.md，
   请先读取该文件了解被打回的具体原因，再修正方案。"
```

- architect 自己读 P2-review.md（评审意见在文件里，符合"只传路径"原则）
- 主 Agent 不碰评审全文，上下文不被污染
- architect 角色定义的"输入"在重试时额外包含上一轮的 review 文件

这样评审→执行的反馈闭环真正打通，重试不再是空转。

---

## 任务完成小结

**触发时机：P8 gate 通过、状态进入 READY 时。强制输出，不可跳过。**
（T002 教训：主 Agent 完成任务后未向 PM 汇报，PM 需自己翻 git log 才能知道发生了什么）

主 Agent 从各阶段 gate check 的命令输出拼出小结，不读文件全文：

```
[{task_id}] DONE — {task_name} {version}

改动：{files_summary from git diff --stat}
验证：{test_results from gate checks}
说明：{one-line design summary}
```

示例：
```
[T002] DONE — 数据库迁移机制修复 v0.1.53

改动：exceptions.py +18 / database.py +51 / cli.py +7 / main.py +2
验证：14/14 migration tests + 486 regression tests
说明：Server 独���迁移，CLI schema 兼容检查
```

---

## PAUSED 报告模板

```markdown
[PAUSED] {task_id} 需用户介入

任务背景：{task_name}
当前阶段：{phase}
失败原因：连续 {retry_count} 轮 {phase} 评审发现 {issue_summary}

已尝试的解决方案：
  {attempted_solutions}

需要用户决策：
  - [ ] {option_1}
  - [ ] {option_2}
  - [ ] {option_3}

请回复选项或直接说明。
```

---

*派发协议是 v4 解决上下文爆炸的核心，配合 state-machine.md 和 loop-orchestration.md 使用*
