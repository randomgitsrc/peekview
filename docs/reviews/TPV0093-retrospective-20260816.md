# TPV0093 star-lifecycle 复盘 — 编排执行事故与修复（2026-08-16）

## 1. 概述

TPV0093（星标功能与内容生命周期管理）完整走完 agate P0-P8，28 BDD 全 PASS，发布 v0.21.0。任务本身功能目标全部达成，但执行过程中发生 **3 次 subagent 卡死**（用户两次中止）、**P5 覆盖缺口导致 2 个实现 bug 漏到 P6**、**P6 验证脚本 5 处逻辑错误**。本次复盘以 opencode session 记录（`~/.local/share/opencode/opencode.db`，主会话 `ses_fff661819ffe5dgGXP30oirHDd` + 70+ 子会话）为客观依据，识别问题、定位机理、给出可执行建议。

**核心结论**：卡死事故是「subagent 无命令超时兜底」+「主 Agent 派发时未设硬超时约束」+「并行派发加剧资源竞争」三重叠加；P5 覆盖缺口是「测试与实现同源（同 bug 自证）」+「验证脚本质量问题」叠加。均非 agate 协议缺陷，但暴露了 agate 协议在 subagent 运行时管控上的空白。

## 2. 客观事实（session 记录证据）

### 2.1 卡死事件时间线

| # | 时间 | 事件 | 证据（session 记录） |
|---|------|------|---------------------|
| E1 | 8/16 15:54 | **P5 第一次并行派发两个 verifier** → 双双卡死，用户中止 | backend verifier：`make test-quick` 1125 passed 成功（[35]）后**继续重跑**（[40] 发现 1 failed 偶发）→ [47] pytest 挂 44s+ 无输出 → [52] `make test-quick` start=1786867045604 end=1786878370024（**约 188 分钟 / 3.1 小时**）被 abort。frontend verifier：vitest 全量 1288 通过（[93]）→ for 3 次（[98] run1 failed / run2 passed / run3 passed，即 4 次累计 1 败）发现 TC-BDD20-02 flaky → 深入诊断 StarManageView（[103]）→ [104] `cat vitest.config.*` start=1786867079975 end=1786878370032（**约 188 分钟 / 3.1 小时**）被 abort |
| E2 | 8/16 19:07 | **P5 串行版 frontend verifier**（E2E 环节）→ 卡死，用户中止 | 串行版 dispatch-context 已加 timeout 约束，但 subagent 内部 bash 命令 timeout 未设（或设 600s 仍不够）；卡在 `E2E_SPEC=e2e/star.spec.ts make debug-test`（CDP 挂起，run-e2e-tests.sh 无 timeout 兜底） |
| E3 | 8/16 19:30 | **P4 回退 implementer（login helper 修复）自验 E2E** → 卡死，用户中止 | implementer 自跑 `make debug-test`（timeout 300s）但脚本无 timeout 兜底 → CDP 挂起无限等 |

### 2.2 卡死根因（session 证据）

- **subagent 无命令超时兜底**：E1 中 frontend verifier 的 [104] `cat vitest.config.*` 是一个 <1s 的快命令，却挂了 3 小时——subagent 的 bash 工具在命令执行时无强制 timeout，命令挂起则整个 subagent 挂起；backend verifier 的 [52] `make test-quick` 同样无限等待。
- **subagent 偏离任务约束**：E1 backend verifier 在 make test-quick **成功后**不落盘返回，而是继续重跑（因 [40] 发现 xdist 偶发 1 failed）；E1 frontend verifier 在发现 TC-BDD20-02 flaky 后**不报告**而进入自由诊断模式。dispatch-context 明确写了"只跑命令+落盘、超时报告"，但面对 flaky 时 subagent 自然倾向诊断而非报告。
- **并行派发加剧资源竞争**：backend `pytest -n auto`（16 workers）+ frontend vitest 同时跑 → CPU/IO 竞争 + 双倍卡死风险。
- **E2E 基础设施无 timeout**：`run-e2e-tests.sh` 的 `npx playwright test` 直接跑，CDP 连接挂起时无任何保护（E2/E3 根因）。

### 2.3 P5 覆盖缺口 → P6 发现 2 个实现 bug

P5 全绿（backend 1125 + frontend 1288 + E2E 10 passed）但 P6 验收首轮发现：

| bug | 根因 | 为何 P5 没抓到 |
|-----|------|---------------|
| BUG-1 backend：list_entries 单列 select 解包崩溃（`for (rid,) in starred_rows` 对 ScalarResult 解包 int）→ **所有带用户上下文的列表 API 500** | P4 INFO-2/F8 修复引入 | 测试只覆盖 star_count 未覆盖单列解包路径——**测试与实现同源**（P3 测试没写列表+is_starred 断言，P4 实现引入了新错误，P5 跑的是"自证"测试） |
| BUG-2 frontend：remaining_days 浮点数未取整（"剩余 2.999875 天"） | P4 实现直接渲染后端浮点 | P3 测试用 mock 整数 remainingDays，未覆盖浮点真实值 |

### 2.4 P6 验证脚本 5 处逻辑错误（非实现缺陷）

| # | 脚本错误 | 根因 |
|---|---------|------|
| S1 | BDD-28 share 在归档后创建 → 404 | `create_share` 拒绝 archived 上新建（P1 已确认既有行为）；脚本应在归档前建 share |
| S2 | BDD-13 用 `DELETE /{slug}/star` 移除墓碑引用 → 墓碑不删 | entry 已物理删除，slug 路由 404（既有行为）；前端墓碑卡片走批量端点 |
| S3 | BDD-22 勾选 1 个墓碑却断言移除后 =0 | 有 2 个墓碑只勾 1 个，断言应勾全部或断言减 1 |
| S4 | BDD-25 用匿名请求查 archived entry 存在性 → 404 误判 FAIL | 匿名对 archived 404 是决策 A 正确行为；应用 owner token |
| S5 | verify-ui login() 前未 clearCookies → CDP Chrome cookie 残留 → 登录按钮不出现 | CDP Chrome 共享实例残留上次登录 cookie |

## 3. 问题识别

1. **P-1（高）subagent 命令无超时兜底**：subagent bash 工具执行命令时无强制 timeout，命令挂起 = subagent 挂起 = 主 Agent 无感知（progress 心跳在命令执行中不写）。
2. **P-2（高）subagent 面对非预期结果偏离任务约束**：遇 flaky/偶发失败时倾向自由诊断而非按约束"超时报告/落盘返回"。
3. **P-3（中）并行派发未评估资源竞争**：两个资源密集型 verifier（pytest 16 workers + vitest）并行 → 竞争 + 双倍卡死风险。agate 并行是"条件触发、非强制"，未做风险评估即并行。
4. **P-4（中）P5 覆盖缺口**：测试与实现同源（P3 测试未覆盖列表+is_starred 路径），P5 跑"自证"测试 → 实现 bug 漏到 P6。
5. **P-5（中）验证脚本质量**：P6 脚本 5 处逻辑错误（对象语义不熟 + cookie 残留），依赖主 Agent 逐条诊断修正。
6. **P-6（低）E2E 基础设施无 timeout**：run-e2e-tests.sh 的 playwright 命令无 timeout 包裹（本次已修复）。

## 4. 机理分析

### 4.1 管理原因

- **M-1 派发时未做运行时管控设计**：dispatch-context 约束了"做什么/不做什么"，但未约束"命令超时如何处置"（第一次并行派发完全没写 timeout；串行版写了 timeout 参数但 subagent 内部命令 timeout 未硬编码）。主 Agent 把"subagent 能自控"当默认假设，被 3 次卡死证伪。
- **M-2 并行决策缺风险评估**：P5 按包拆分并行是 agate 允许的，但 backend/frontend 都是 CPU 密集型测试任务，并行无收益（互不依赖但共享 CPU），却引入资源竞争。正确决策是串行。
- **M-3 对 subagent 执行中途的监控缺失**：主 Agent 只能等 subagent 返回（Task 工具阻塞），subagent 卡死时主 Agent 无中断/心跳机制——只能等用户手动中止。这暴露了"Task 工具无超时参数"的平台限制（agate 协议层面也无此能力）。
- **M-4 历史教训未内化**：TPV0092 已发生 P6 verifier 卡死（用户中止，主 Agent 自己也卡死一次，根因"后台进程 fd 继承"），教训已记录但**未沉淀为"派发必带超时"的强制检查项**——本次 P5 卡死是同一类问题复发。

### 4.2 技术原因

- **T-1 run-e2e-tests.sh 无 timeout**：`npx playwright test` 直接跑，CDP 连接挂起时无限等待（E2/E3 根因）。
- **T-2 playwright.config 无全局套件超时**：单测试 timeout 60s 无法保护"CDP 连接挂起"阶段（连接挂起不属于任何测试）。
- **T-3 pytest -n auto（16 workers）flaky 高发**：test_admin_backup 并发偶发失败（P5 遇到 1 次、P8 又遇到 1 次）——xdist 下共享资源测试的已知问题，未登记 known-failures。
- **T-4 frontend vitest TC-BDD20-02 跨文件污染 flaky**：subagent 复现 4 次累计 1 败（[93] 首次全量通过 + [98] for 3 次中 run1 失败）但未根治（本次未定位根因，仅规避）。
- **T-5 star.spec.ts login() helper 竞态**：`AuthButton` 条件渲染（authState=loading 时不渲染）导致 count=0 跳过登录——P3 测试代码缺陷，P5 首轮 E2E 才暴露。

### 4.3 agate 机制原因

- **A-1 P5 external-output-gate 信任链无运行时保护**：P5 卡片说"主 Agent 派发 verifier subagent 执行 gate_commands.P5"，信任链 = subagent 隔离 + CI backstop。但 subagent 卡死时无任何机制兜底（无心跳、无超时、无中断）。agate 协议假设 subagent 会"正常返回"，对"卡死"场景无处理路径。
- **A-2 分阶段落盘（progress 心跳）对"卡在命令"无效**：progress 在"读完文件/完成步骤"后写，subagent 卡在 bash 命令执行中时不会写 progress——心跳机制失效。
- **A-3 gate_commands.P5 声明了命令但未声明"预期时长/超时"**：P2 固化了命令，但没固化"这条命令最多跑多久、超时怎么办"——verifier 只能猜。
- **A-4 P6 "verifier 脚本由主 Agent 执行" 机制有效**：P6 卡片明确"P6 verifier 交付的验证脚本应由主 Agent 执行"——本次 P6 全程主 Agent 亲跑，零卡死，验证了该机制的可靠性（对比 P5 subagent 执行三连卡死）。

### 4.4 agent 执行 agate 遵守情况

**主 Agent（本会话）**：

| 维度 | 遵守 | 证据 |
|------|------|------|
| P0-P8 全流程 | ✅ | 每阶段产出 + gate 全跑 + commit |
| dispatch-context 先写后派 + 注入卡片 | ✅ | 每次派发前写文件 + agate-inject-card.py |
| gate 亲自跑 | ✅ | check-gate/check-tdd-red/check-p6-* 全主 Agent 执行 |
| P6 脚本主 Agent 执行 | ✅ | P6 卡片要求，全程亲跑 |
| **P5 并行派发决策** | ❌ | 未评估资源竞争即并行（agate 允许但非最优） |
| **派发时命令超时约束** | ❌ | 第一次 P5 派发无 timeout 约束（后续修正） |
| **subagent 卡死监控** | ❌ | 无中断机制，依赖用户手动中止 |

**Subagent**：

| 角色 | 遵守 | 问题 |
|------|------|------|
| P1 analyst / requirements-review（4 个）| ✅ 高质量 | 评审发现 REV-1..4 真实缺口 |
| P2 architect / eng / design / lead（8 个）| ✅ 高质量 | 3 轮迭代闭合 4 BLOCKER |
| P3 test-designer（2 个）| ✅ 完成 | 测试代码缺陷（login 竞态/浮点 mock 整型）留待后续 |
| P4 implementer / review / cso / design（12 个）| ✅ 高质量 | 4 轮评审闭合；cso 无 Write 工具（2 次返回全文由主 Agent 落盘——平台限制） |
| **P5 verifier（3 次派发）** | ❌ **偏离约束** | ①成功后不落盘返回（继续重跑）②遇 flaky 不报告（自由诊断）③命令无 timeout ④backend 访问生产库路径（只读 stat 但违反"严禁触碰"精神） |
| P6 verifier（1 个）| ✅ 遵守 | "只写脚本不跑长命令"约束有效（dispatch-context 明确） |
| P7 consistency-reviewer / P8 releaser | ✅ 遵守 | 正常完成 |

**关键对比**：P6 verifier 完全遵守（因为 dispatch-context 明确"只写脚本不跑长命令 + 主 Agent 执行"），P5 verifier 完全失控（因为 dispatch-context 说"跑命令"但没给超时/异常处置路径）——**约束的明确度直接决定 subagent 行为**。

## 5. 处理措施（已实施）

1. **run-e2e-tests.sh 加 timeout 600 包裹**（`timeout "$E2E_TIMEOUT" npx playwright test`，默认 600s 可覆盖，exit 124 明确报错）——根治 E2E 挂起无限等（E2/E3 根因）。
2. **star.spec.ts login() 彻底修复**：等待登录按钮出现且**不吞错误**（登录失败 → 测试失败）+ 登录后确认 Sign in 消失——根治 P5 E2E flaky。
3. **P6 验证全程主 Agent 亲跑**（timeout 控制）+ 串行派发——零卡死。
4. **P6 验证脚本内置 hard timeout**（verify-ui.ts `setTimeout` 240s exit 2）。
5. **P6 脚本 5 处逻辑错误修正**（share 归档前创建 / 墓碑批量端点 / 勾选全部 / owner token / clearCookies）。
6. **2 个实现 bug 回 P4 修复**（list_entries set 解包 + 倒计时 Math.ceil 取整）+ 补列表请求测试。
7. **make debug-quick 重启加载新代码**（P4 代码变更后 E2E 前置）。

## 6. 建议意见（可操作）

### 6.1 对 agate 协议（建议提交改进）

- **A-1 建议：gate_commands 增补"预期时长"字段**。P2 声明命令时同时声明 `timeout_seconds`（如 `P5_e2e.timeout: 600`），verifier 派发时主 Agent 从 P2 读取并硬编码到 subagent 命令。低侵入，P2 gate 校验可选。
- **A-2 建议：dispatch-prompt 增补"命令超时兜底"标准节**。模板级加入："每个 bash 命令必须设 timeout 参数（≤ 预期时长×1.5）；命令超时 → 立即停止、写 progress '命令超时'、返回主 Agent；遇非预期失败（flaky/偶发）→ 记录现象后返回主 Agent 判定，禁止自行深入诊断"。作为所有派发的强制默认。
- **A-3 建议：P5 卡片明确"资源密集型测试任务建议串行"**。并行是条件触发，补一条："backend 全量 pytest（xdist）与 frontend 全量 vitest 属高资源消耗命令，P5 默认串行；需并行时评估 CPU/IO 竞争"。
- **A-4 建议：progress 心跳语义扩展**。分阶段落盘补充："每执行一个 bash 命令**前**写一条 progress（如 `[HH:MM] 开始执行: make test-quick`）"——主 Agent 可据 progress 时间戳判断 subagent 是否卡在命令中（当前只在命令后写，卡住时无信号）。

### 6.2 对 PeekView 项目

- **P-1 建议：登记 known-failures**：`test_admin_backup` xdist 并发偶发（P5/P8 各遇 1 次）+ `TC-BDD20-02` 跨文件污染 flaky（复现 4 次累计 1 败）——两条 flaky 登记 + 后续根治（xdist 串行分组 or 隔离）。
- **P-2 建议：playwright.config 增全局超时**：`globalTimeout` 或脚本外层 timeout（已由 run-e2e-tests.sh 兜底，可再加 `--timeout` 双保险）。
- **P-3 建议：P3 测试设计补"列表+is_starred"断言**（本次 BUG-1 漏网根因）——测试必须覆盖响应字段的**全部新增路径**，不只主路径。
- **P-4 建议：P6 验证脚本复用 E2E star.spec.ts 的 login() 修复**（clearCookies + 不吞错误）——已在 verify-ui.ts 落地。

### 6.3 对主 Agent 编排

- **P-5 建议：派发 checklist 固化**（每次派发前过）：①是否资源密集型（是→串行）②命令是否有 timeout（写进 dispatch-context + prompt）③subagent 是否可能偏离（写"异常处置：报告不诊断"）④是否需进度心跳（写"命令前写 progress"）。
- **P-6 建议：验证类命令默认主 Agent 亲跑**（P4 自查 + P6 已验证有效；P5 协议要求 verifier，但可让 verifier 只"设计验证方案+写脚本"，命令由主 Agent 执行——需与 agate 对齐）。

## 7. 亮点（保留）

- agate 评审机制全程有效：P1 抓安全缺口（share 通道）、P2 抓 4 BLOCKER（时区/权限/迁移）、P4 cso 抓 slug oracle/批量上限、P6 抓 2 实现 bug——多层防线有效。
- P6 "verifier 脚本由主 Agent 执行"机制零卡死（对比 P5 subagent 执行三连卡死）——**机制可靠性被实证**。
- 用户中止后主 Agent 快速诊断根因（login 竞态 + 无 timeout）并按授权修复基础设施，后续阶段零复发。
- 回退流程正确：P6 FAIL → 诊断 → 回 P4 修复（BUG-1/2）→ 补测试 → 重验 28/28 PASS。

---

**复盘依据**：opencode session 记录（主会话 `ses_fff661819ffe5dgGXP30oirHDd` + 70+ 子会话，`~/.local/share/opencode/opencode.db`）+ 任务产出文件（`agate-workspace/tasks/TPV0093-star-lifecycle/`）+ git 提交历史（P1-P8 + bump v0.21.0）。
