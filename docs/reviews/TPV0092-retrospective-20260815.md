# TPV0092 mcp-get-entry-fetch — agate 全流程复盘

> 任务：TPV0092-mcp-get-entry-fetch（MCP get_entry 直接读取任意 PeekView 链接）
> 版本：peekview v0.19.0 → v0.20.0（minor）+ @peekview/mcp-server v0.10.0 → mcp-v0.11.0（minor，双包发布）
> 立项：2026-08-12（仅立项不实施）；实施：2026-08-15（用户确认启动）
> 复盘日期：2026-08-15
> 复盘人：主 Agent（orchestrator）
> 依据：本会话原始记录 + git commit 时间戳（`git log --date=format` 直接读取，非回忆）+ 用户中途切会话（ses_064fa2166ffeYeaNBCDwGKzDJJ / ses_fff661819ffe5dgGXP30oirHDd）后续接本会话

---

## 0. 概览

| 维度 | 数值 |
|------|------|
| 总墙钟（P1 commit → READY） | 05:23:43 → 09:30:35（约 4h07m，含多次人工介入等待） |
| subagent 派发总数 | 约 19 次 task 调用（dispatch-context 文件 17 个：P1×3、P2×2、P3×3、P4×5、P5×1、P6×1、P7×1、P8×1；额外调用含 P6 verifier 卡死重派 + 各评审复审轮） |
| subagent 卡死 | 1 次（P6 verifier 启动 :8889 卡死，用户终止） |
| gate 首次不通过 | 2 次（P4 hash mismatch×2 同源；P6 前 subagent 卡死） |
| 评审打回 | 2 次（P1 requirements-review needs-revision；P4 cso needs-revision） |
| 真实缺陷（实现/测试） | 5 个（P3 体积断言、P3 旧契约×2 文件、.gitignore 误伤、响应体无上限 MEDIUM） |
| 发现的预存问题 | 2 个（backend backup flaky、Mobile FileTree e2e 3 failed → DEBT0005） |
| 基础设施新增 | 3 项（make debug-extra 三件套、dev-server.sh PORT 参数化、debug-seed PORT=） |
| 最终 BDD 验收 | 26/26 PASS |

**核心结论**：任务功能目标全部达成（26/26 BDD + 双包发布），agate 评审机制有效抓到了 3 个真实问题（安全隐含缺 BDD、响应体 DoS、测试契约遗漏）。**但本任务最大的教训不是产品代码，而是"运行环境管理"**：P6 verifier 因在 bash 工具里裸启动后台服务而卡死（用户终止），暴露出 dispatch 指引缺失 + 环境准备时机错误 + 多实例基础设施缺失三个连环管理问题。此外还有 3 个次生问题（P4 hash mismatch、.gitignore 误伤、旧代码实例）值得记录。

---

## 1. 客观时间线（commit 时间戳 + 会话事件）

| 阶段 | commit/事件时间 | 关键事件 |
|------|----------------|---------|
| P0 | 2026-08-12 | 立项（仅立项不实施，设计待多轮讨论） |
| P0 | 08-15 02:00 | 用户确认启动；环境自检快速版 1-3 + CDP 全 PASS；debug :8888 启动 |
| P1 | 05:23:43 | analyst 产出 26 BDD（domains=backend/mcp/security，risk=medium）→ requirements-review **needs-revision**（2 条安全隐含缺 BDD：share token 不打印、fetch 超时）→ rev1 补 BDD-25/26 → 复审 approved → commit |
| P2 | 05:35:02 | architect 候选 A（MCP 匿名直读 raw）/候选 B（后端代理，否决）→ minimal_validation curl 实测（302 丢 query/?share= 缺失/?purify= 被忽略）→ plan-eng-review approved（0 阻塞，3 非阻塞建议 + DEBT0004 净化双实现漂移）→ commit |
| P3 | 05:49:17 | test-designer 双端 40 用例（后端 12 + MCP 28）覆盖 26 BDD → check-tdd-red exit 0 真红灯（后端 4 + MCP 28 B 类）→ commit |
| P4 | 06:30:08 | implementer 双端实现 → 上报 2 测试问题（DESIGN_GAP 体积断言数学不可满足 + SCOPE_GAP mcp-integration 旧契约）→ P3 retry1/retry2 修复 + 补 mcp-e2e 旧契约 → **双专家评审**：review approved（0 CRITICAL）+ cso **needs-revision**（MEDIUM：fetchEntryRaw 响应体无上限 DoS）→ implementer retry1 修 20MB 上限 + files 非空 → cso 复审 approved → 组长汇总 approved → **P4 gate hash mismatch 卡住**（review-lead 文件有 2 个 AGATE_CARD 块）→ 修复重复块 → commit（state 与产出同 commit，TPV0094 教训已吸收） |
| P5 | 06:33:34 | verifier 全绿（后端 1091，1 flaky backup 重命名竞态隔离重跑排除 + MCP 268 + typecheck + ruff）→ commit |
| **P6 卡死** | ~06:38 | verifier 启动 :8889 用 setsid 裸启动后台 uvicorn → **shell 卡死**，用户终止 |
| P6 基础设施 | 09:18~09:41 | 主 Agent 亲自备环境：新增 `make debug-extra`/`debug-extra-stop`/`debug-extra-status` + dev-server.sh PORT 参数化（**改动在备环境阶段即完成于工作树，commit 稍后落库**——验收 commit 09:18:49、基础设施 commit 09:24:25）→ 启动 :8889 成功（走 make→dev-server.sh 不卡）→ 创建 API key/分享/base64 entry → 发现 :8888 是旧代码（P4 前启动）→ debug-restart → 重派 verifier（**dispatch 明确禁止 subagent 启动服务**）→ 26/26 PASS |
| P7 | 09:24:46 | consistency-reviewer BLOCKER=0，DESIGN_GAP 配对闭环 → commit |
| P8 | 09:27~09:30 | releaser P8-release（双包 minor）→ bump-version v0.20.0 + bump-mcp-version mcp-v0.11.0 + CHANGELOG 两节 + tags → P5 gate 重跑全绿 → READY 收尾（停服务/清数据）→ DONE |
| 复盘/沉淀 | 09:41~09:43 | 用户问数据隔离 → 核查发现 debug-extra-stop 8888 误操作保护缺失 + debug-seed 未支持多实例 → 修复 → AGENTS.md/debug-workflow.md 沉淀多实例知识 |

---

## 2. 关键事件详细分析

### 2.1 P6 verifier 卡死（本任务最大事故）

**现象**：verifier 被派发后，用 `setsid ... uvicorn ... &` 在 bash 工具里裸启动 :8889 后台进程，shell 卡死无响应，用户终止。

**链**：dispatch-context 只给了"手动启动 :8889"的指引（`PORT=8889 ... python3 -m uvicorn`），没禁止 subagent 启动服务 → subagent 按指引执行 → 后台进程继承 bash 工具 fd → 工具等待管道 EOF → 卡死。

**根因**：
- 管理：环境准备（:8889）应在派发前由主 Agent 完成，而不是让 verifier 自己起
- 管理：dispatch-context 未声明"禁止 subagent 启动/停止服务"（项目 AGENTS.md 有"后台进程禁止裸启动"铁律，但 P6 dispatch 未引用）
- 技术：bash 工具对后台长驻进程的 fd 继承问题（setsid/nohup/Popen 均卡——实测）
- agate：P6 卡片/verifier 角色没有"环境由主 Agent 备好"的机制约束；P2 env_constraints 描述 :8889 启动方式时未注明"主 Agent 执行"

**正确做法（已沉淀）**：后台长驻服务一律走 `make → scripts/dev-server.sh`（`&` + PID 文件 + 健康检查等待，正确 detach）。项目有成熟机制（dev-server.sh），但缺"多实例"入口——补上 `make debug-extra PORT=` 后问题消失。

### 2.2 P4 gate hash mismatch（操作失误）

**现象**：`P4-dispatch-context-review-lead.md` 卡片内容与 CLI 输出 hash 不一致，pre-commit 拦截。

**根因**：我 Write review-lead 内容时已含 AGATE_CARD 占位符，之后又用 `printf` 追加了一对占位符 → 文件有 2 对 AGATE_CARD → 注入脚本生成重复块 → sed 提取的 hash 含两块内容 ≠ 期望。

**归类**：管理（主 Agent 操作失误——对 inject-card 机制的占位符来源不熟）。

**agate 侧**：hash 校验机制本身有效（防漂移），且错误信息给出了修复提示——机制没问题，是我没按"一次注入"的惯例操作。

### 2.3 P3 测试代码 2 处缺陷（评审/验证抓到）

- **体积断言数学不可满足**（`test_raw_purify_strips_base64_image`：断言整响应 <126 字节，但元数据就 375 字符）——P4 implementer 发现上报（DESIGN_GAP），P3 retry1 修复（content 级断言 + 84KB 大 fixture）
- **旧契约遗漏**（`mcp-integration.test.ts` + `mcp-e2e.test.ts` 仍用 `{slug}`，schema 已改 `{ref}`）——P4 上报 SCOPE_GAP，P3 retry1/retry2 修复

**根因**：
- 技术：P3 测试设计时 fixture 数据与断言量级不匹配；P3 只更新了单测文件清单，漏了 integration/e2e 文件
- agate：check-tdd-red 只跑 gate_commands.P3（单测），integration/e2e 契约变化在 P3 红灯阶段不会暴露（itIfReady 跳过）；P4 review 发现 integration，e2e 直到 P4-review 才被 review 专家抓到（I-2）——**P3 的"测试代码目录"声明没有强制覆盖全部受影响测试文件**

### 2.4 .gitignore lib/ 误伤 MCP 源码

**现象**：`packages/mcp-server/src/lib/`（新增 entryRef.ts/purify.ts）被 `.gitignore:13` 的 `lib/`（Python setuptools 构建目录规则）忽略，P4 commit 时发现文件不在 git status。

**根因**：
- 技术：`.gitignore` 的 `lib/` 是无前缀全局规则，匹配任意目录名；P2 设计把新文件放 `src/lib/` 未预见到
- agate：P2 files_to_read 不会检查 .gitignore 冲突；P4 gate 只检查"暂存区有代码文件"，不检查"新增文件是否被 ignore"——**P4 阶段没有"新增文件完整性"校验**（implementer 若不主动 git status 检查就会漏）

### 2.5 cso MEDIUM：响应体无上限 DoS（评审价值）

**现象**：cso 审计发现 `fetchEntryRaw` 对响应体无大小上限——攻击者可让 MCP 拉超大响应体内存 DoS。

**归类**：技术（P2 设计时未考虑响应体上限，只设计了超时/协议白名单/响应校验）——**cso 评审抓到并修复（20MB 上限 + Content-Length 预检 + 流式兜底）**，这是 P4 双专家评审机制的直接价值。

### 2.6 :8888 旧代码实例（环境管理）

**现象**：P6 实测 raw ?purify= 不生效——因为 :8888 是环境自检（P0 时）启动的实例，P4 代码改动后没重启。

**根因**：管理——代码变更后未重启调试实例（P4→P6 期间 :8888 一直在跑旧代码）。P6 前主 Agent 备环境时应先 restart。

---

## 3. 三维度归因

### 3.1 技术原因

| # | 问题 | 根因 | 修复/预防 |
|---|------|------|----------|
| T1 | 后台进程卡死 bash 工具 | 后台进程继承工具 fd（setsid/nohup/Popen 均验证） | 一律走 make→dev-server.sh；AGENTS.md 已沉淀 |
| T2 | P3 体积断言与数据矛盾 | fixture 迷你 base64 + 整响应断言量级不匹配 | 断言改 content 级 + 大 fixture；P3 自检规则（断言与数据矛盾=测试 bug）有效但 P3 未自查出 |
| T3 | 旧契约遗漏（integration/e2e） | P3 测试清单只覆盖单测文件 | 契约变更任务 P3 应 grep 全部 get_entry 调用点 |
| T4 | .gitignore lib/ 误伤 | 无前缀 `lib/` 规则匹配 src/lib/ | git add 前 `git status` 检查新增文件；.gitignore 加例外 |
| T5 | 响应体无上限 | P2 设计未考虑 DoS 面 | cso 评审抓到 → 20MB 上限 |
| T6 | 旧代码实例 | 代码变更后未重启调试实例 | 环境准备阶段先 debug-restart |

### 3.2 管理原因

| # | 问题 | 根因 | 修复/预防 |
|---|------|------|----------|
| M1 | **环境准备时机错误** | P6 dispatch 让 verifier 自己启动 :8889（未备好再派发） | 主 Agent 派发前完成全部环境准备；dispatch 声明"环境已备好，禁止启动服务" |
| M2 | dispatch-context 指引不足 | 未禁止 subagent 启动服务、未引用 AGENTS.md 后台进程铁律 | P6 dispatch 模板加"环境已备、禁止启动/停止服务"标准句 |
| M3 | 多实例基础设施缺失 | 项目只有单实例 debug 能力，跨 host 测试临时手工起 | 新增 make debug-extra 三件套（已落地） |
| M4 | P4 hash mismatch | Write 内容带占位符 + printf 追加 → 双块 | 操作惯例：dispatch-context 写完后统一 inject-card 一次，不手动追加占位符 |
| M5 | 文档沉淀不及时 | AGENTS.md/debug-workflow.md 未在基础设施落地时同步更新 | 用户提醒后补齐（已 commit）——教训：基础设施改动应同步文档 |
| M6 | 旧代码实例未重启 | 环境生命周期管理缺环节 | 环境准备 checklist：代码变更后 restart |

### 3.3 agate 原因

**agate 本身机制问题**：
| # | 机制缺口 | 影响 | 建议 |
|---|---------|------|------|
| A1 | P6 派发无"环境由主 Agent 备好"的约束 | verifier 自行启动服务 → 卡死 | dispatch 模板加环境准备职责声明（或 P6 卡片加"环境准备是主 Agent 责任"） |
| A2 | check-tdd-red 只跑 gate_commands.P3（单测） | integration/e2e 契约变化 P3 红灯不暴露 | P3 卡片建议：契约变更任务 test-designer 应 grep 全部调用点/文件 |
| A3 | P4 gate 只查"暂存区有代码文件" | 新增文件被 .gitignore 忽略时无感知 | 可选：P4 增加"新增文件完整性"检查（git status 未跟踪的 src 文件告警）——或作为 P4 自查项 |
| A4 | P2 env_constraints 无"实例生命周期管理"维度 | :8889 启动方式描述给了 subagent 错误信号 | env_constraints 可注明"启动命令由主 Agent 执行" |
| A5 | 双包 bump 流程（bump-version + bump-mcp-version 两次 git add -A） | 若未及时提交中间产出会混入 | 本次实际 OK（P8 产出已在 bump 前就绪）——建议注意顺序 |

**agent 遵循 agate 情况**：
- **遵循良好**：每阶段产出/评审/gate/commit 规范；P1 评审打回 → rev1 补 BDD → 复审（迭代正确）；P4 双专家并行 + 组长汇总（机制用对）；P5→P4 测试修复轮（test-designer 修测试代码，角色边界正确）；P7 DESIGN_GAP 配对闭环；P8 双包发布 + READY 收尾
- **遵循偏差**：
  - ① P6 dispatch 违反"环境准备是主 Agent 职责"的隐含要求（给了 subagent 启动指引）——这是主 Agent 的 dispatch 设计失误，不是 subagent 违规
  - ② P4 前 .state.yaml 更新已吸取 TPV0094 教训（state 与产出同 commit）——**同类错误的跨任务学习有效**
  - ③ inject-card 占位符操作失误（双块）——主 Agent 对工具机制理解不熟
  - ④ P3 test-designer 未自查出体积断言问题（P3 自检规则存在但执行不彻底）

---

## 4. 改进建议（可落地）

1. **【dispatch 模板】P5/P6 派发统一加标准句**：「环境已由主 Agent 备好（列出清单）；**禁止 subagent 执行任何启动/停止/重启服务的命令**（make debug-* / uvicorn / setsid / nohup / Popen）；验收脚本内临时 mock 服务器除外（需自行管理生命周期并自动关闭）」——写入 agate dispatch-prompt 模板或项目 project.md
2. **【基础设施】多实例能力已落地**（make debug-extra 三件套 + debug-seed PORT= + dev-server.sh PORT 参数化），AGENTS.md/debug-workflow.md 已沉淀——未来跨 host 测试直接复用
3. **【P3 强化】契约变更任务的测试设计**：test-designer 应 grep 全仓库的旧契约调用点（不只单测文件），integration/e2e 一并更新；断言 fixture 与量级自检（P3 自检规则执行更严）
4. **【P4 强化】新增文件完整性自查**：implementer 完成后 `git status --short` 检查是否有未跟踪/被 ignore 的新增源文件（防 .gitignore 误伤类问题）
5. **【环境管理】环境准备 checklist**：P6 前主 Agent 确认——服务运行的是最新代码（需要时 debug-restart）、所需数据/凭据已创建、派发前环境就绪
6. **【文档】基础设施改动同步沉淀**：新增 make target/脚本改动 → 同步 AGENTS.md 常用命令 + debug-workflow 速查表（本任务 M5 教训）

---

## 5. 结论

TPV0092 功能上完全成功（26/26 BDD、双包发布、安全设计完整——凭据隔离/SSRF 四层防护/响应体上限），agate 评审机制全程有效（P1 抓安全缺口、P4 cso 抓 DoS、review 抓契约遗漏、P7 闭环）。

**但过程管理的教训集中在"运行环境"**：P6 verifier 卡死（M1/M2/T1）是最大事故，根因是主 Agent 未提前备环境 + dispatch 未禁止 subagent 启动服务 + 项目缺多实例基础设施。三者都已修复/沉淀。

**值得肯定的**：
- P4 双专家并行评审机制用对（review + cso 各司其职，cso 抓到实现层安全缺口）
- TPV0094 教训（state 与产出同 commit）在 P4 直接应用成功
- 卡死后快速转向：加基础设施（make debug-extra）而非继续手工折腾（用户指点的正确路径）
- 复盘沉淀：AGENTS.md/debug-workflow.md 已固化多实例知识与后台进程教训

---

*复盘依据：本会话完整记录（P1-P8 + 后续核查）+ git commit 时间戳 + 用户中途切会话后续接。未使用记忆/推断作为事实来源。*
