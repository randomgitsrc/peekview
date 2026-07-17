---
date: 2026-07-17
author: orchestrator (main agent)
type: retrospective
scope: T055 + T056 + T058 迭代复盘
status: revised
reviewed_by: plan agent (2026-07-17)
---

# T055/T056/T058 迭代复盘

## 1. 任务概览

| 任务 | 内容 | 改动规模 | 结果 |
|------|------|----------|------|
| T055 | admin-backup-export | backend 5 files | v0.9.0（未独立发布） |
| T056 | prometheus-metrics | backend 3 files | v0.9.0（bump 执行但 tag 缺失） |
| T058 | overflow-share-redesign | frontend 12 files | v0.9.0（本会话完成 P5-P8） |

三个任务在 v0.6.2 基线上累积，跳版发布为 v0.9.0。T055 和 T056 在上一轮会话完成 P0-P8 但存在流程缺陷：T055 从未执行 bump-version，T056 bump 了但 git tag 缺失。

## 2. 本会话执行内容

本会话从 T058 P5 接手（上一轮会话完成 P0-P4，但 P4 WIP commit 因 reset 丢失）：

| 阶段 | 结果 | 关键事件 |
|------|------|----------|
| P5 技术验证 | 通过 | 第一次派发不规范被用户叫停，第二次按模板重派 → 876 unit + 28 E2E PASS |
| P6 验收 | 通过 | 26/26 BDD PASS，含 BDD-05 badge bug 修复 |
| P7 一致性 | 通过 | BLOCKER=0, DESIGN_GAP=0 |
| P8 发布准备 | 通过 | bump 0.9.0, CHANGELOG 合并 T055+T056+T058 |
| publish | 完成 | PyPI peekview v0.9.0 发布成功 |

## 3. 关键事件与教训

### 3.1 C7 规则实证：subagent 自我报告不可信

P5 verifier subagent 返回摘要 "28/28 E2E PASS"。主 Agent 按 A1 原则亲自跑 gate 命令（`npx playwright test e2e/t058-share-redesign.e2e.spec.ts`），实际结果：9 failed, 19 did not run。根因是命令中遗漏 `BASE_URL=http://127.0.0.1:8888`，spec 默认连接 `localhost:5173`（Vite dev server），请求超时。

修复后（加 `BASE_URL`）重跑：28 passed, 0 failed——verifier 的结论碰巧正确，但命令执行过程不完整。若主 Agent 相信 subagent 报告而不亲自跑命令，漏掉的 `BASE_URL` 就永远不会被发现——下次有人在 CI 跑相同命令时才会暴露。

**教训**：C7 规则不是理论辩护。subagent 报告可能是正确的（28/28），但仍不代表验证过程完整——环境变量遗漏、命令简化、或路径问题都可能导致"正确结论，错误过程"。gate 验证不仅是验证结果（exit code），也是验证过程完整性。

**审计说明**：本事件的详细过程在 orchestrator-log.md 中仅记录为一行（"T058 P5: vue-tsc ✅, vitest 876/876 ✅"），日志未区分两次 P5 派发、用户叫停、或 BASE_URL 修复。暴露了日志纪律不足（见 §3.7）。

### 3.2 派发规范的重要性

第一次 P5 派发 prompt 缺少：dispatch-context.md、角色定义引用（verifier.md）、输入导航、能力补充说明（playwright-cdp / vision-analyzer）。subagent 被用户叫停后，第二次按 dispatch-prompt.md 模板重派（含全部上述要素），subagent 正常完成：创建 E2E spec、CDP 截图、vision 分析。

**教训**：派发模板中的要素不是冗余——缺少任一要素都会增加 subagent 盲目执行的概率。dispatch-context.md 提供环境状态和选择器，角色文件限制行为边界，能力补充说明告诉 subagent 可用的工具。

### 3.3 P4 commit 丢失与 P4+P5 合并

上一轮会话中 P4 WIP commit（`0fd52895`）在 git reset 操作中被撤销。本会话开始时 P4 代码未 commit，但代码变更存在于工作区。处理方式：将 P4 代码变更和 P5 验证产物合并为一个 commit（`5abf7183` "P4-P5 — implement + verify"）。

**根因**：`git reset` 在 agate 流程中是高风险操作，破坏了 phase 与 git log 的对应关系。标准恢复方案应为 reflog 恢复原 commit，而非合并两阶段。

**合并的影响**：合并 commit 无法 git bisect 区分"实现引入的 bug"和"验证产物错误"，也违反了 agate 的 phase 分离原则。这是紧急处置而非流程允许行为。当时的决策依据是：代码变更存在但未 commit，phase 已推进到 P5，时间约束下选择了合并而非恢复。

**教训**：
- reset 前先 `git branch backup-xxx`
- commit 丢失时应优先尝试 reflog 恢复
- 非恢复不可时将处置性质明确记录（应急 vs 常态）

### 3.4 版本 tag 缺失：两个不同根因

**T055**：完成 commit（`51aa046a`）只修改了 `active-tasks.md`，没有 VERSIONS.json 变更、没有 `__init__.py` 版本号变更。**bump-version 从未执行**。根因：agate 流程允许在 active-tasks.md 标记 "completed → v0.7.0"，但 P8 releaser subagent 没有实际执行 bump-version——流程缺陷，不是环境问题。

**T056**：完成 commit（`328ee612`）有完整 bump 产物（VERSIONS.json 0.8.0、CHANGELOG [0.8.0] 条目、`__init__.py` 版本号变更），但 git tag `v0.8.0` 缺失。根因待查——可能是 bump-version 脚本的 tag 创建步骤失败，或在后续操作中被删除。

**处理**：两个任务的代码已累积在 main 分支，无法回溯分开发布。跳版 v0.6.2 → v0.9.0，CHANGELOG 合并三个版本条目。

**教训**：
- P8 gate 应检查 `git tag -l "v{version}"` 确认 tag 确实存在
- active-tasks.md 的 "completed" 状态应有 gate 脚本验证 bump 产物存在，而非仅靠主 Agent 手动检查

### 3.5 BDD-05 badge bug：如何穿透两道关卡

P6 验收时发现 BDD-05 FAIL：share badge 在页面加载时不显示活跃 share 数量。`activeShareCount` 依赖 `shareStore.shares`，但 store 只在 ShareDialog 打开时才调用 `fetchShares()`——ShareDialogContent 的 `onMounted` 因 `v-if="isOpen"` 在页面加载时不触发。

**失守分析**：

- **P3 层**：单元测试（ShareDialog.spec.ts 55 tests）覆盖了 badge 在 popover 打开后的行为（create/revoke 后计数变化），但未覆盖"页面首次加载时 badge 展示"的初始化路径。测试设计只验证了组件内部行为，忽略了父组件（EntryDetailView）的数据初始化时序。
- **P5 层**：E2E spec（t058-share-redesign.e2e.spec.ts）的 SD06（Badge appears after creating share）只验证了"创建 share 后 badge 出现"，未验证"页面加载时 badge 展示已有 share 数量"。CDP 截图也未覆盖此场景。
- **P6 层**：BDD-05 的验收中首次实跑"页面加载时 badge 显示已有 share 数量"场景，发现 FAIL。

**谁失守**：P3 和 P5 各承担一半责任。P3 应设计"初始化数据加载"测试场景；P5 应验证"页面加载后状态完整"而非仅验证"交互后状态更新"。

**修复**：EntryDetailView 添加 `watch(showShareButton, () => shareStore.fetchShares(slug), { immediate: true })`，在页面加载时预加载 share 数据。

**教训**：P3 测试设计和 P5 E2E 覆盖应包含"初始化/首次渲染"场景（BDD 中隐含的 Given 条件），而非仅覆盖"交互后"场景（When/Then）。

### 3.6 handleClickOutside bug 严重度升级

P5 e2e.md 将 `ShareDialog.vue:handleClickOutside` 的 bug 定性为"In real browsers, the event timing is different and the popover stays open"——暗示无害。评审指出此判断错误：

`containerRef.contains(e.target)` 检查 sibling 元素在 DOM API 语义上是错误的（sibling 不被 `contains()` 覆盖）。当前"碰巧工作"依赖 Vue watcher 的异步调度时序，而非正确的逻辑保证。这是一个需要修复的逻辑 bug，不应定性为"无害"。

**影响**：Vue 版本升级、不同浏览器事件传播差异、或在同一微任务 tick 内同步注册监听器的代码变更都可能打破此假设。

**正确修复**：在 share button 的 click handler 中标记"此点击是打开操作"并让 `handleClickOutside` 检查此标记；或使用 `setTimeout` 将 document 监听器注册延迟到当前事件传播完成后。

**E2E workaround 问题**：t058-share-redesign.e2e.spec.ts 使用 `page.evaluate(() => btn.click())` workaround 绕过此 bug，而非测试修复后的行为。E2E 测试不应 workaround 绕过产品 bug。

**状态**：此 bug 未在本会话修复。标记为待修复（`[KNOWN_BUG] handleClickOutside sibling detection`）。

### 3.7 E2E spec 创建时机：self-verification 反模式

`gate_commands.P5_e2e`（P2-design.md 声明）引用了 `e2e/t058-share-redesign.e2e.spec.ts`，但该文件在 P5 开始前不存在。P3 测试设计未曾规划 E2E 测试用例；P4 实现未曾编写 E2E spec。P5 verifier 被迫同时创建测试文件和执行测试——即验证者验证自己写的测试（self-verification）。

这削弱了 external-output-gate 信任链：verifier 应独立于 implementer，但当 verifier 同时写 E2E 测试代码时，测试可能被设计成"刚好通过当前实现"。例如，测试使用 `page.evaluate()` workaround 绕过 handleClickOutside bug，而非暴露它。

**建议**：E2E spec 应作为 P3 gate 产出或 P4 实现的一部分，不应推迟到 P5 才创建。P2 声明的 `gate_commands.P5_e2e` 引用的 spec 文件应在 P3→P4 过渡时确认存在。

### 3.8 orchestrator log 稀疏问题

`orchestrator-log.md` 仅 17 行，覆盖了 10 次 subagent 派发和 4 次 gate 失败。以下关键事件在 log 中零记录：

- 第一次 P5 派发失败及用户叫停
- BDD-05 badge bug 发现和修复过程
- P6 截图去重和 provenance 冲突
- P7 DESIGN_GAP grep 误匹配
- P8 bump 的 amend 操作

日志的稀疏直接削弱了复盘的可查证性——C7 事件（P5 verifier 谎报 28/28 PASS）是本次迭代最具教学意义的案例，但没有审计轨迹支撑。

**改进**：orchestrator-log.md 需要在每次 gate 失败、subagent 失败、或流程决策时追加至少一行记录。

### 3.9 agate bug：卡片模板与 provenance 正则冲突

P6 dispatch-context.md 嵌入的阶段卡片模板包含 `- FAIL > 0 → gate exit 1 → 回 P4`，被 `check-p6-provenance.sh` 的 `grep -cE '^\s*- (PASS|FAIL)\b'` 匹配为"验收结论预判"。修复嵌入块内容后 hash 不一致，hash 检查和 provenance 审计形成循环死结。

**根因**：provenance 正则扫描 dispatch-context.md 全文，未排除 `<!-- AGATE_CARD_START -->` / `<!-- AGATE_CARD_END -->` 区域。

**临时修复**：修改 `check-p6-provenance.sh` 第 102 行，在 grep 前用 `sed` 排除卡片嵌入块。

**建议**：agate 应让 provenance 排除卡片区域，或修改卡片模板措辞使 `- FAIL` 不以 `^\s*- (PASS|FAIL)\b` 格式出现。

## 4. 数据统计

| 指标 | 数值 |
|------|------|
| 本会话 commit 数（T058 P5-P8）| 6 |
| subagent 派发次数 | 10（P5×2, P6 verifier, P6 format-fix, P7, P8, BDD-05 fix, P1, P2, P3）|
| gate 失败后修复次数 | 5（P5 BASE_URL, P6 BDD-05, P6 截图+provenance×2, P7 DESIGN_GAP grep）|
| P3 测试规模 | 92 tests（60 pass, 32 fail — 混合绿/红状态，非纯 TDD red light）|
| BDD 覆盖 | 26/26 PASS |
| 单元测试（最终）| 876/876 PASS |
| E2E 测试（t058 spec）| 28/28 PASS |
| 未修复 bug | 1（handleClickOutside sibling detection）|
| agate bug | 1（卡片模板×provenance 正则冲突）|

## 5. 改进建议

| # | 建议 | 优先级 | 负责人 |
|---|------|--------|--------|
| 1 | P8 gate 检查 `git tag -l "v{version}"` 确认 tag 存在 | P0 | agate 维护者 |
| 2 | check-p6-provenance.sh 排除 AGATE_CARD 块 | P0 | agate 维护者 |
| 3 | active-tasks.md "completed" 状态应 gate 验证 bump 产物存在 | P1 | agate 维护者 |
| 4 | P3/P5 测试设计须包含"初始化/首次渲染"场景 | P1 | PeekView 开发者 |
| 5 | E2E spec 应在 P3 或 P4 产出，不在 P5 才创建 | P1 | agate 流程 |
| 6 | orchestrator-log.md 每次 gate 失败/subagent 失败必须追加记录 | P2 | 主 Agent |
| 7 | git reset 前强制备份分支（`git branch backup-xxx`）| P2 | 主 Agent |
| 8 | 修复 handleClickOutside sibling detection bug | P2 | PeekView 开发者 |
| 9 | dispatch-context.md 可从 agate-next-card.sh 生成骨架 | P2 | agate 维护者 |

## 6. 未完成事项

- **[KNOWN_BUG]** ShareDialog.handleClickOutside 对 trigger button（sibling 元素）的点击检测依赖不稳定的 Vue 异步时序，存在跨浏览器/跨版本兼容性风险。当前 Workaround：E2E 使用 `page.evaluate()` 绕过。需在后续任务中修复。
- **[AGATE_BUG]** check-p6-provenance.sh 修改（排除 AGATE_CARD 块）应回馈给 agate 主仓库。
