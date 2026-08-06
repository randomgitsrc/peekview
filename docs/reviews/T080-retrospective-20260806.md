# T080 Admin 用户管理 — agate 全流程复盘

> 任务：T080-admin-user-management（admin 用户管理三端 + 审计字段 + LastAdmin 保护）
> 版本：0.16.0 → v0.17.0（minor）
> 会话时间：2026-08-05 ~ 2026-08-06（commit 跨度 P1→P8 = 3h40m）
> 复盘日期：2026-08-06
> 复盘人：主 Agent（orchestrator）

---

## 1. 客观记录

### 1.1 时间线（git commit）

| 阶段 | commit 时间 | 间隔 | 关键事件 |
|------|------------|------|---------|
| P0 | （会话前，08-05）| — | brief 四字段 + env 自检，无独立 commit（含在 P1 commit）|
| P1 | 08-06 03:46:34 | — | 24 BDD + 8 CONFIRMED，requirements-review **retry#1** approved |
| P2 | 08-06 04:08:39 | 22min | 候选方案 A，plan-design-review **retry#1** approved |
| P3 | 08-06 04:28:19 | 20min | 24 BDD 1:1 映射，21 红灯 |
| P4 | 08-06 05:55:45 | **87min** | 三端实现，4 DESIGN_GAP，5 review BLOCKER（2 CRITICAL + 3 MUST-FIX），**retry#3** approved |
| P5 | 08-06 06:21:17 | 26min | pytest 1068 + vitest 1217 + E2E 27/27 |
| P6 | 08-06 07:04:02 | 43min | 24/24 PASS + vision 证据，**verifier 429 崩溃**，主 Agent 接管修格式 |
| P7 | 08-06 07:14:32 | 10min | 一致性检查，**gate 拦截 DESIGN_GAP 行首格式**，主 Agent 修 |
| P8 | 08-06 07:26:55 | 12min | bump v0.17.0 + tag + READY 清理（注：两个 bump commit，f0c7b40e@07:19 + c0472105@07:20 amend 补 CHANGELOG）|

**总 commit 跨度**：3h40m（03:46 → 07:27）
**重试次数**：7 次（P1×2, P2×2, P4×3）

### 1.2 subagent 派发统计

| 阶段 | subagent 数 | 角色 | 失败/崩溃 |
|------|------------|------|----------|
| P1 | 2 | analyst, requirements-review | 0 |
| P2 | 2 | architect, plan-design-review | 0 |
| P3 | 1 | test-designer | 0 |
| P4 | 5 角色 / 8 dispatch | implementer×4(初始+3retry), review/design-review/cso×1, review-lead×1 | 0 |
| P5 | 1 | verifier | 0 |
| P6 | 1 | verifier（含 vision） | **1（429 API 崩溃）** |
| P7 | 1 | consistency-reviewer | 0 |
| P8 | 1 | releaser | 0 |
| **合计** | **14 角色 / 21 dispatch** | — | **1 崩溃** |

### 1.3 gate 拦截记录

| 阶段 | gate 拦截原因 | 处置 |
|------|-------------|------|
| P1 | NEED_CONFIRM 6 项未决 → 问用户 | 主 Agent + 用户决策 6 项 |
| P1 retry#1 | review 6 个实质问题 | analyst 修订 |
| P2 retry#1 | BDD-12 ConfirmDialog 无 input | architect 补 PasswordResetDialog spec |
| P4 retry#1 | 4 DESIGN_GAP（测试矛盾）| 主 Agent 决策 C/D/E |
| P4 retry#2 | 5 评审 BLOCKER（2 CRITICAL + 3 MUST-FIX：is_active/FK/badge/pendingOp/space-8）| implementer 修 |
| P4 retry#3 | E2E 选择器契约偏差（**P5 E2E 失败回退 P4**，非 P4 gate 拦截）| implementer 加 data-testid |
| P6 | provenance：dispatch-context 预判格式 + vision YAML 结构 + vision 引用括号 | 主 Agent 接管修 3 处 |
| P7 | DESIGN_GAP_REVIEWED 不在行首 | 主 Agent 修格式 |
| P8 | 无（一次过）| — |

### 1.4 质量结果

- 24/24 BDD PASS（P6 验收）
- pytest 1068 passed / 1 预存 ruff env 失败（known-failures）
- vitest 1217 passed
- typecheck + lint clean
- E2E 27/27 passed
- 1 预存失败登记（test_t073 ruff env，与 T080 无关）
- PROD_NOT_TOUCHED 全程隔离

---

## 2. 问题分析

### 2.3 环境与工具原因

#### 问题 C：P6 verifier 单点崩溃导致流程中断（环境/工具因素，管理层面表现为单点依赖）

**现象**：P6 verifier 在修 vision 引用格式时遭遇 429 API 错误崩溃（"Request rejected (429) · authorization failed"），任务终止。主 Agent 接手修复剩余格式问题（vision YAML 结构重构 + 引用括号拆分）。

**机理**：P6 是 self-authored gate，verifier 同时产出验收报告和证据文件——一旦 subagent 崩溃，所有未保存的格式修正丢失，主 Agent 必须从 transcript 接力。本任务主 Agent 能接手是因为问题只剩格式（gate 脚本的精确正则要求），但若崩溃发生在验收实跑阶段，证据可能丢失。

**根因（双因素）**：
- **环境/工具层**：第三方 API 限流（429）。本机 Claude Code 走讯飞 MaaS 代理（非 Anthropic 官方），限流策略可能是 token 速率或并发数。P6 verifier 单次 dispatch 承载 24 BDD × 多证据类型 × 多 gate 格式约束，prompt 大 + 工具调用多（截图脚本 + vision 调用 + gate 脚本核对），容易触发速率限制。假设：单次 dispatch 的累积 token 量或工具调用频率超过 MaaS 代理的窗口限制。
- **管理层**：P6 验收工作集中在一个 verifier subagent，无断点续做机制——崩溃即丢失中间状态。

**处置建议**：
- P6 拆分为两步：verifier 产出验收报告 + 证据（不改代码），主 Agent 跑 gate 脚本修格式（格式问题属 gate 维护，不违反"主 Agent 不亲自产出"铁律——格式修正是 gate 维护而非阶段产出）
- 或 P6 verifier 分阶段落盘，每完成一组 BDD 就写文件，崩溃后可从断点续做
- 减小单次 dispatch 范围（如 BDD 分批验收）规避限流
- vision YAML 结构应在 verifier 角色文件里明确给出（`vision_analysis.summary.blocker_count` 嵌套结构），而非让 verifier 猜测然后被 gate 拦截

#### 问题 A：P1 NEED_CONFIRM 决策点过多（6 项），阻塞流程序列化

**现象**：P1 analyst 产出 6 个 NEED_CONFIRM，gate 拦截。主 Agent 用 AskUserQuestion 分两轮问用户（4+2），用户逐一决策后才推进。这是整个流程中唯一阻塞用户的地方。

**机理**：agate 规定 P1 有未决 NEED_CONFIRM 不可推进（gate exit 1）。但 analyst 角色的设计倾向"拿不准就标记"（角色文件原文："拿不准就标记，不擅自决定"），导致即使每项都有明确倾向，仍标记 NEED_CONFIRM 等人确认。6 项中有 5 项用户选了"推荐"（analyst 倾向），1 项（审计字段）用户选了与倾向相反的"纳入"。

**根因**：NEED_CONFIRM 机制缺乏分级——"有明确倾向但求确认"和"真无方向需人定夺"被同等对待，都阻塞。analyst 不敢自行决策合理但有倾向的问题，把决策成本全部上抛。

**处置建议**：
- agate 可引入"倾向性确认"分级：analyst 声明 `[NEED_CONFIRM倾向: 推荐 X，理由 Y]`，主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必每项问用户
- 本任务用户已明确"所有决策自行判断不再询问"——后续任务按此执行，主 Agent 直接采纳 analyst 倾向（破坏性变更除外）

#### 问题 B：P4 重试 3 次，retry 预算消耗过快

**现象**：P4 经历 3 次重试（retry#1 修 DESIGN_GAP、retry#2 修评审 BLOCKER、retry#3 修 E2E 选择器），P4 MAX=3 刚好用满。一次重试失败就要回 P3 或 PAUSED。

**机理**：P4 的 retry 上限是 3，但本任务的 3 次重试解决的问题性质不同：
- retry#1：P1 BDD 矛盾（LastAdmin vs self-op 优先级）—— 实质是 P1 需求不完整
- retry#2：P4 评审发现的实现 bug（is_active 缺失、FK 未清理、UI 问题）—— 实质是 P4 实现质量问题
- retry#3：P3 测试 spec 与 P4 实现的契约偏差（选择器命名不一致）—— 实质是 P3/P4 协同问题

**根因**：三类不同性质的问题（需求/实现/契约）共用 P4 retry 预算。P1 的 BDD 矛盾本应在 P1 review 时发现（reviewer 确实发现了 BDD-06/10 矛盾但当时聚焦 confirm_username 旁路），但决策延后到 P4 才做。P3/P4 选择器契约偏差是 P3 test-designer 凭空命名 class（`.admin-user-list`）而 P4 implementer 用了不同命名（`.user-list`），两者无协同机制。

**处置建议**：
- P1 review 应更严格审查 BDD 间的逻辑一致性（同场景不同预期），不仅看单条 BDD 可判定性
- P3 test-designer 与 P4 implementer 应共享选择器契约——P3 spec 用 `data-testid`（稳定标识）而非 class 命名，或在 P2 design 固化选择器清单
- agate 可考虑"retry 预算分类"：需求矛盾回退到 P1 不计 P4 retry，契约偏差不计 retry（属协同问题非实现错误）

### 2.2 技术原因（agent 协议遵循 / LLM / 环境 / 工具）

#### 问题 D：P4 implementer 产出 4 个 DESIGN_GAP，暴露 P1 需求矛盾

**现象**：P4 实现时发现 4 个测试预期矛盾：
1. BDD-06 vs BDD-10（同场景：sole admin self-disable，预期 400 vs 409）
2. test_admin_cannot_delete_self vs BDD-23（同场景：sole admin self-delete，预期 400 vs 409）
3. BDD-24 vs BDD-17/18（CLI disable 最后一个 admin，预期拒绝 vs 成功）
4. BDD-01 rate limit（创建 26 用户触发 429）

**机理**：这些问题都是 P1 BDD 设计的内在矛盾——self-op 保护（400）和 LastAdmin 保护（409）在 sole admin 自操作时重叠，analyst 没意识到冲突。BDD-24/17-18 是 CLI 测试 setup 问题（首用户 auto-admin 导致场景重叠）。BDD-01 是测试数据规模撞 rate limit。

**根因**：
- **LLM 分析盲区**：analyst 写 BDD 时逐条合理，但没做跨条一致性检查（BDD-06 和 BDD-10 是同场景不同预期，这种矛盾需全局视角才能发现）
- **P1 review 未充分**：requirements-review 首轮发现 6 个问题并打回，但聚焦在 confirm_username 旁路和自操作覆盖，没发现 BDD-06/10 的同场景矛盾
- **测试数据设计**：BDD-01 假设 25 用户但没考虑 register rate limit，是测试设计未考虑环境约束

**流程问题（P4 修改 P1 文档）**：P4 retry#1 时，implementer 修改了 P1-requirements.md 的 BDD-06 Then（补"sole admin 自操作时 LastAdmin 保护优先，返回 409"注释）。这是下游改上游文档——agate 流程上 P1 是需求基线，后续阶段应只读不应改。修改 P1 应触发 P1 重新 review 或至少主 Agent 确认。本任务主 Agent 决策了 LastAdmin 优先（决策 C）并指示 implementer 同步到 P1，属主 Agent 授权的回写，但流程上应显式声明"P1 基线变更"而非隐式修改。建议 agate 增加"P1 文档变更需主 Agent 显式批准 + 标 [BASELINE_CHANGE]"机制。

**处置建议**：
- P1 analyst 应对同场景 BDD 做交叉检查（sole admin 自操作场景下，self-op 和 LastAdmin 保护优先级必须显式声明）
- P1 review 增加一致性审查维度："同 Given 不同 Then 的 BDD 是否有矛盾"
- 测试数据设计应考虑环境约束（rate limit），用 fixture 直接插 DB 绕过

#### 问题 E：P4 评审发现 3 个真实 bug（is_active/FK/UI）

**现象**：P4 评审三角色（review/design-review/cso）发现 5 个 BLOCKER：
1. `_check_last_active_admin` 缺 `and user.is_active`（与设计决策 B 不符）
2. `delete_user` 未清理 disabled_by FK（删曾禁用其他用户的 admin 会 500）
3. AdminView "public" badge 语义错（entry 可见性术语误用作用户状态）
4. pendingOp 声明但未绑定 OverflowMenu disabled
5. `--space-8` CSS 变量不存在

**机理**：
- **bug 1**：implementer 在 admin_service.py 实现了 `_check_last_active_admin`，但漏了 `is_active` 条件——而 CLI（cli.py）的实现却有 `is_active`。同一逻辑两处实现分叉。这是 implementer 内部不一致，非设计歧义。
- **bug 2**：审计字段 disabled_by 是 FK，但 implementer 没考虑删除 admin 时该 FK 的级联。P2 design 提了审计字段但没提 FK 清理策略——设计缺口。
- **bug 3-5**：前端实现细节问题（badge 语义、状态绑定、CSS 变量名），P2 spec 写了但 implementer 执行偏差。

**根因**：
- **implementer 一致性**：同一 helper 逻辑在 service 层和 CLI 层分叉，说明 implementer 未对照已有实现
- **P2 设计缺口**：审计字段的 FK 约束 + 删除策略未在 P2 明确，implementer 自行决定（标了 DESIGN_GAP 但 FK 问题没标）
- **前端 spec 执行偏差**：P2 spec 明确了 OverflowMenu disabled、--space-7 等，但 implementer 用了 --space-8、没绑定 pendingOp——执行不严

**处置建议**：
- P4 implementer 应对照已有实现（CLI 的 is_active 逻辑）确保一致性
- P2 design 应明确 FK 约束 + 删除策略（审计字段的级联清理）
- 前端实现应严格对照 P2 spec 的组件 props/CSS 变量，偏差标 DESIGN_GAP

#### 问题 F：P6 gate 格式拦截频繁（vision YAML 结构 + 引用括号 + dispatch-context 预判）

**现象**：P6 verifier 产出后，gate 脚本多次拦截：
1. `check-p6-provenance.sh` 报 "dispatch-context 含 2 处验收结论预判"——主 Agent 原始 dispatch-context 约束节写了行首 `- PASS 必须有证据引用` / `- FAIL>0 → 回 P4`（在 AGATE_CARD 块外），被正则 `^\s*- (PASS|FAIL)\b` 匹配。verifier 发现后将措辞改为"每条通过必须有"/"失败数>0"规避。
2. vision YAML 结构不符——verifier 写顶层 `blocker_count: 0`，gate 脚本读 `vision_analysis.summary.blocker_count`
3. vision 引用括号——verifier 写 `(screenshots/x.png, vision: y.yaml)`，gate 要求 `(screenshots/x.png) (vision: y.yaml)` 独立括号
4. DESIGN_GAP_REVIEWED 不在行首（P7 同类问题）

**机理**：gate 脚本用精确正则匹配，但 verifier 对格式要求的理解来自角色文件（描述性），而非 gate 脚本源码（精确正则）。verifier 写的格式"看起来对"但不符合正则。问题 1 的 dispatch-context 预判检测会剥离 AGATE_CARD 块（卡片内的 `- PASS` 模板文本不触发），但主 Agent 在约束节写的指令行（块外）会触发——这是主 Agent 写 dispatch-context 时的格式失误，非 agate 模板缺陷。

**根因**：
- **gate 格式契约不透明**：gate 脚本的正则是"硬法律"，但 verifier 角色文件只给"描述性说明"，两者有 gap
- **主 Agent dispatch-context 格式失误**：约束节用了行首 `- PASS`/`- FAIL`（与 BDD 验收行格式撞），应避免在 dispatch-context 用此格式
- **vision YAML 结构未在角色文件明确**：verifier 不知道 gate 读 `vision_analysis.summary.blocker_count`

**处置建议**：
- gate 脚本的正则应在角色文件里用代码块明确给出（如"PASS 行必须匹配 `^\s*- PASS\b`，vision 引用必须独立括号 `(vision: ...)`"）
- 主 Agent 写 dispatch-context 约束节时避免行首 `- PASS`/`- FAIL`（改用"通过/失败"或加引号）
- vision YAML 的期望结构应在 verifier 角色文件给完整模板

#### 问题 G：E2E 选择器契约偏差（P3 spec vs P4 实现）

**现象**：P3 test-designer 写的 admin.spec.ts 用 `.admin-user-list`/`.admin-user-row`，P4 implementer 的 AdminView.vue 用 `.user-list`/`.user-row`。E2E 跑不起来，P5 才发现。

**机理**：P3 test-designer 凭空命名 class（spec 先于实现写），P4 implementer 用了不同 class 命名。两者无共享契约——class 命名是约定，但 P3/P4 各自决定。

**根因**：TDD 模式下测试先写，但测试用的选择器与后续实现的 class 命名无协同机制。class 命名易变（重构改 class 不改 test），data-testid 更稳定。

**处置建议**：
- P2 design 应固化测试选择器契约（用 data-testid，class 命名不进测试）
- P3 test-designer 用 `data-testid` 而非 class 选择器
- 或 P4 implementer 实现后回写 P3 spec 对齐选择器（但这违反 TDD 测试不改原则，所以 data-testid 是更好方案）

### 2.4 环境与工具原因（续）

#### 问题 H：test_t073 ruff env 预存失败

**现象**：pytest 全套 1 failed：`test_t073_bdd09_10_ruff_regression` 因 hermes venv 无 ruff 模块失败。

**机理**：测试用 `python3 -m ruff` 调用，但 shell 的 `python3` 解析到 hermes venv（无 ruff），而 `make lint` 用系统 python3（有 ruff）。

**根因**：环境 python3 解析不一致（hermes venv 劫持 python3）。

**处置**：已登记 known-failures.md（WARNING 级，不阻断）。根治需修正 python3 解析或测试用 `ruff` 直接调用而非 `python3 -m ruff`。

#### 问题 I：debug-stop 未真正停止服务

**现象**：P8 releaser 发现 `make debug-stop` 报停止了，但 :8888 仍在运行（PID 残留）。主 Agent 手动 `pkill -9` 才清理。

**机理**：`make debug-stop` 通过 PID 文件杀进程，但若进程已换或 PID 文件过期，可能杀不干净。

**处置建议**：`make debug-stop` 加 `pkill -f "uvicorn.*8888"` 兜底，或 READY 检查时主 Agent 强制 pgrep 确认。

#### 问题 J：known-failures.md 被滥用为草稿本（流程问题）

**现象**：known-failures.md 第二个条目"T080 E2E 失败（非预存，记录待修复）"明确写着"非预存失败，不在此登记为 known-failure，仅记录供主 Agent 决策"——但仍被写入了该文件。

**机理**：known-failures.md 的语义是"预存失败登记"（P5 之前就存在的失败，与当前任务无关）。P5 verifier 发现 E2E 选择器失败后，把它写进 known-failures.md 作为"记录待修复"——但这混淆了"预存失败"和"本任务引入的失败"。

**根因**：verifier 没有合适的"当前任务失败记录"位置，把 known-failures.md 当草稿本用。agate 缺少"当前任务失败待修"的独立记录机制。

**影响**：污染 known-failures 语义，后续任务 reviewer/gate 可能误判该失败为预存（实际 P4 retry#3 已修复）。

**处置建议**：
- 已修复：E2E 选择器问题在 P4 retry#3 已解决（data-testid），known-failures.md 第二条应删除（已过期）
- agate 应明确 known-failures.md 只登预存失败，当前任务失败用 P5-test-results/ 记录或 retreat-history.md

---

## 3. 好的方面（保持）

1. **gate 机制有效拦截**：P1 NEED_CONFIRM、P2 BDD-12 缺口、P4 实现 bug、P6 格式问题都被 gate 拦截，没流向下游。gate 是有效的质量门。
2. **三角色并行评审**（P4）：review + design-review + cso 并行，比串行快 3 倍。cso 和 review 独立发现同一 is_active bug 交叉验证（design-review 未参与该 bug 发现，但发现了 3 个前端 MUST-FIX）。三角色覆盖维度互补。
3. **主 Agent 亲自跑 gate 验证**：不信 subagent 自报，P3 红灯、P5 测试、P6 gate 都主 Agent 亲跑——这是 agate 核心原则，本任务严格遵守。
4. **DESIGN_GAP 机制有效**：P4 implementer 标 DESIGN_GAP 而非擅自改测试，主 Agent 决策后定向修复——机制设计正确。
5. **PROD_NOT_TOUCHED 全程隔离**：debug :8888 隔离，生产库 mtime 未变，无任何生产触达。
6. **known-failures 登记**：预存失败（ruff env）显式登记，债务可见可追踪。
7. **vision-engine + playwright-cdp 链路稳定**：P6 截图 + vision 分析全链路工作，8 张截图 md5 唯一，vision blocker_count=0。

---

## 4. 处置措施（已落地 + 待落地）

### 已落地（本任务）
- 4 DESIGN_GAP 全部 REVIEWED 配对（P7）
- 3 评审 BLOCKER 全部修复（P4 retry#2）
- E2E 选择器用 data-testid 对齐（P4 retry#3）
- 预存失败登记 known-failures.md（P5）
- debug 服务清理 + 临时脚本清理（P8 READY）

### 待落地（agate 协议/脚本改进建议）
1. **P1 NEED_CONFIRM 分级**：引入"倾向性确认"，主 Agent 可采纳 analyst 倾向（非破坏性）
2. **P3/P4 选择器契约**：P2 design 固化 data-testid 清单，P3 spec 用 data-testid
3. **P6 gate 格式契约透明化**：角色文件用代码块给 gate 正则，dispatch-context 模板不含 `- PASS/FAIL` 行
4. **vision YAML 结构模板**：verifier 角色文件给完整 YAML 模板（`vision_analysis.summary.blocker_count`）
5. **P6 拆分**：verifier 产出 + 主 Agent 修格式（格式问题不派 subagent）。注：此建议与 agate 铁律"主 Agent 不亲自写代码或产出"存在张力——但格式修正（sed/grep 调整 PASS 行格式）属 gate 维护（让产出符合 gate 正则），非阶段产出（不创造验收结论或证据），可视为 gate 维护例外。边界：主 Agent 只修格式不改 PASS/FAIL 判定。
6. **retry 预算分类**：需求矛盾回 P1 不计 P4 retry，契约偏差不计 retry
7. **make debug-stop 兜底**：加 `pkill -f "uvicorn.*8888"` 确保清理

---

## 5. 数据汇总

| 指标 | 值 |
|------|-----|
| commit 跨度 | 3h40m |
| subagent 总数 | 14 角色 / 21 dispatch |
| subagent 崩溃 | 1（P6 verifier 429）|
| retry 总次数 | 7 |
| DESIGN_GAP | 4（全部 REVIEWED）|
| 评审 BLOCKER | 5（2 CRITICAL + 3 MUST-FIX，全部修复）|
| BDD 总数 | 24 |
| BDD PASS | 24/24 |
| 预存失败 | 1（ruff env，登记 known-failures）|
| 生产触达 | 0（PROD_NOT_TOUCHED）|
| 版本 | 0.16.0 → 0.17.0 |

---

## 6. 结论

T080 全流程走完 P0-P8，24/24 BDD 验收通过，v0.17.0 发布。gate 机制有效拦截了所有质量问题（需求矛盾、实现 bug、格式不符），没流向下游或生产。主要损耗在 P4 的 3 次重试（需求矛盾 + 实现 bug + 契约偏差）和 P6 的格式拉锯（gate 正则不透明 + verifier 崩溃）。建议按 §4 待落地项改进 agate 协议，可显著降低同类任务的 retry 次数和格式拉锯时间。
