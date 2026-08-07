# T087 代码块行号 off-by-one — agate 全流程复盘

> 任务：T087-code-linenumber-offbyone（代码块行号比实际代码多一行）
> 版本：v0.17.0 → v0.17.1（patch）
> 会话时间：2026-08-06 23:16 ~ 2026-08-07 07:28（跨夜，总墙钟 ~8h12m）
> 复盘日期：2026-08-07
> 复盘人：主 Agent（orchestrator）
> 任务性质：bug fix，横切 3 渲染路径，用户授权自主跑完
>
> ⚠️ 时间线说明（会话原始记录还原）：
> - 08-06 23:16（explore hotfix commit）~ 23:26：P0 立项 + P1 analyst 首次派发 +
>   requirements-review 评审完成（needs-revision）+ 写 retry dispatch-context
> - **23:26 API 503 宕机**（写完 retry dispatch-context 后，准备注入 AGATE_CARD 时）
> - **23:26 ~ 05:59（6h33m）会话挂起**——API 503 导致无法响应，非空闲等待
> - 05:59 会话 resume，派发 analyst retry#1，06:03 P1 commit
> - 06:03 ~ 07:28：P2-P8 连续推进（1h25m commit 跨度）
>
> 实际主动工作时间：~1h45m（23:16~23:26 + 05:59~07:28）
> API 503 挂起：6h33m（23:26~05:59）

---

## 1. 客观记录

### 1.1 时间线（git commit + 会话原始记录还原）

| 阶段 | commit 时间 | 实际工作时段 | 间隔 | 关键事件 |
|------|------------|-------------|------|---------|
| hotfix | 08-06 23:16:22 | — | — | explore 文案 hotfix commit（T087 立项起点）|
| P0 | （无独立 commit）| 23:16 ~ 23:26 | 10min | brief 四字段 + 审计 + 环境自检 |
| P1 analyst | — | 23:17 ~ 23:22 | 5min | analyst 派发，产出 P1-requirements.md（10 BDD + Shiki 实测关键发现）|
| P1 review | — | 23:22 ~ 23:23 | 1min | requirements-review 评审完成，status: needs-revision（3 项措辞修订）|
| P1 retry ctx | — | 23:23 ~ 23:26 | 3min | 写 retry dispatch-context 完成，准备注入 AGATE_CARD |
| **503 中断** | — | **23:26 ~ 05:59** | **6h33m** | **API 503 宕机，会话挂起**（写完 retry ctx 后注入 AGATE_CARD 时触发）|
| P1 resume | — | 05:59 ~ 06:03 | 4min | 会话 resume，派发 analyst retry#1，修订完成，P1 commit |
| P1 | 08-07 06:03:30 | 05:59 ~ 06:03 | — | **retry#1 approved**，gate exit 2，commit |
| P2 | 08-07 06:14:09 | 06:03 ~ 06:14 | 11min | 方案 A 调用方共享 trim，plan-design-review approved（无 retry）|
| P3 | 08-07 06:23:28 | 06:14 ~ 06:23 | 9min | 9 测试覆盖 BDD-1~7，5 真红灯，check-tdd-red exit 0 |
| P4 | 08-07 06:32:36 | 06:23 ~ 06:32 | 9min | 方案 A 实现（6 insert/4 delete），design-review approved（无 retry）|
| P5 | 08-07 07:03:00 | 06:32 ~ 07:03 | **31min** | vitest 1226 + typecheck 0 + E2E 6/6，**verifier 补跑 build-frontend（P4 漏建 static）**，viewer.spec.ts 预存失败登记 |
| P6 | 08-07 07:13:16 | 07:03 ~ 07:13 | 10min | 10/10 BDD PASS，6 vision blocker=0 |
| P7 | 08-07 07:19（估）| 07:13 ~ 07:19 | 6min | 一致性 approved，BLOCKER=0 |
| P8 | 08-07 07:28:04 | 07:19 ~ 07:28 | 9min | bump v0.17.1 + tag + READY 清理 |

**总墙钟时长**：~8h12m（23:16 → 07:28）
**API 503 挂起**：6h33m（23:26 → 05:59）
**实际主动工作时间**：~1h45m（23:16~23:26 = 10min + 05:59~07:28 = 1h29min + 零散等待）
**P2-P8 commit 跨度**：1h25m（06:03 → 07:28）
**重试次数**：2 次（P1×2，其余阶段 0 retry）

> 503 中断的证据：会话 JSONL 在 23:26:47（UTC 15:26:47）记录
> `API Error: 503 The system is busy`，下一条事件在 05:59:35（UTC 21:59:35）。
> 503 发生在 P1 review needs-revision 之后、retry 派发之前——P1 产出已存在
> 但未 commit（正准备派 retry 修订后一起 commit）。resume 后 4 分钟完成
> retry + commit，符合 agate"P1 完成即 commit"的要求（中断前 P1 尚未完成
> review approved，不具备 commit 条件）。

### 1.2 subagent 派发统计

| 阶段 | dispatch 数 | 角色 | 备注 |
|------|------------|------|------|
| P1 | 3 | analyst, analyst-retry#1, requirements-review×2（同 agent 复用改 status）| retry#1 措辞修订 |
| P2 | 2 | architect, plan-design-review | — |
| P3 | 1 | test-designer | — |
| P4 | 2 | implementer, design-review | — |
| P5 | 1 | verifier | 补跑 build-frontend |
| P6 | 1 | verifier（含 vision-engine skill）| — |
| P7 | 1 | consistency-reviewer | — |
| P8 | 1 | releaser | — |
| **合计** | **12 dispatch** | — | 0 崩溃 |

### 1.3 gate 拦截记录

| 阶段 | gate 拦截原因 | 处置 |
|------|-------------|------|
| P1 commit | P2-dispatch-context AGATE_CARD hash mismatch（未注入卡片就 commit）| 注入卡片后重 commit |
| P1 commit | state phase=P2 但 P2-design.md 不存在（pre-commit 检测 state phase 跑 gate）| state 回退 P1，P2 dispatch-context 移出暂存区 |
| P2 gate | follows_existing_pattern 字段在 P2 但 gate 查 P1（脚本逻辑）| P1 补 yaml 字段 `[BASELINE_CHANGE]` |
| P5 | viewer.spec.ts 预存失败（路由 #/entry/{slug} vs /{slug}）| verifier 写 T087 专用 spec 替代验证，登记 known-failures |
| P5 | P4 未重建 static（AGENTS.md 铁律）| verifier 补跑 make build-frontend |
| P8 commit | 暂存 P5 e2e.md 但 phase=P6（hook 检测 state phase 不匹配）| 排除 P5 e2e.md 单独 commit |
| P8 commit | git add 带一堆路径时 .gitignore 报错中断 | 逐个 git add |

---

## 2. 做得好的地方

### 2.1 P1 关键发现纠正了用户拍板方案的陷阱

用户拍板"split 前去尾换行（只改 renderLineNumbers）"。analyst 实测 Shiki `codeToHtml` 行为后发现：**Shiki 与 split 都不处理末尾换行（都多一个尾部空行，数量对齐）**。只改 renderLineNumbers 会引入新错位（行号 N-1 vs `.line` N）。

这是 agate P1 的核心价值——**质疑需求、识别隐含依赖、用实测推翻错误假设**。analyst 没有盲信用户拍板，而是跑了 4 个 case 的实际验证，把结果记录在 progress 里，并据此设计了"三联对齐"验收锚点（行号数 == `.line` 数 == 逻辑行数），留给 P2 决定实现方式。最终方案 A（调用方共享 trim，同时作用于 codeToHtml 和 renderLineNumbers 输入）正是基于这个发现。

### 2.2 TDD 红灯设计精准

test-designer 设计的 mock `codeToHtml` 模拟真实 Shiki 行为（不 trim 末尾换行），使 P4 实现前 5 红灯、P4 实现后 5 转绿 + 4 not-broken 保持绿。关键断言是 `.line-number count == .line count`（三联对齐核心），而非只断言行号数。mock hoisting 反模式（T079 教训）被主动规避（vi.mock 回调只用字符串字面量）。

### 2.3 零 review retry（P2/P4）

P2 plan-design-review 和 P4 design-review 都一次 approved，无 retry。得益于：
- P1 实测把不确定点（Shiki 行为）提前消解，P2 设计基于 confirmed 事实
- follows_existing_pattern 单候选方案 + 否决 4 个替代方向 + 理由充分
- P4 严格按改动清单（精确到行号）实现，renderLineNumbers 不改、CodeViewer/useMarkdown 不碰

### 2.4 全程 0 subagent 崩溃

12 个 dispatch 全部正常返回，无 429/API 崩溃（对比 T080 P6 verifier 429 崩溃）。vision-engine skill 6 张截图分析全部 blocker_count=0。

---

## 3. 问题与改进

### 3.1【P5 严重】P4 implementer 未重建 static

**问题**：P4 implementer 改了 `useShiki.ts` 源码但没跑 `make build-frontend`。P5 verifier 首次跑 E2E 时，debug backend 服务的 static 是 08-06 22:45 构建的（早于 P4 commit），built assets 不含 `trimmedCode`，off-by-one bug 仍存在（3 行代码渲染 4 个 `.line`）。verifier 补跑 build-frontend 后修复才生效。

**根因**：P4 dispatch-context 的"不改什么"清单没写"必须重建 static"，implementer 遵守了 AGENTS.md 铁律的字面（不改 CodeViewer.vue 等）但漏了"改前端后必须 build-frontend"这条。AGENTS.md 铁律第 8 条说了，但 P4 dispatch-context 没强调。

**影响**：P5 verifier 花了额外时间诊断"E2E 为什么没修复"→ 发现 static 没更新 → 补跑。若 verifier 没发现，P6 验收会基于错误 static 截图（bug 仍存在），得出错误 PASS。

**改进**：
- P4 dispatch-context 模板加"前端改动后必须 `make build-frontend` 重建 static"检查项
- 或 P5 gate_commands.P5_e2e 前置检查 static 时间戳 > 源码 commit 时间
- 短期：P4 implementer prompt 追加"前端改动后自跑 make build-frontend"

### 3.2【P5 中等】viewer.spec.ts 预存失败掩盖 gate_commands.P5_e2e

**问题**：P2 固化的 `gate_commands.P5_e2e = E2E_SPEC=e2e/viewer.spec.ts make debug-test`，但 viewer.spec.ts 有预存失败（路由 `/#/entry/{slug}` vs 实际 `/{slug}` + 硬编码 slug `lu4prg`/`ngajri` 失效，上次改动 v0.1.22）。P5 跑这个命令会全部失败，与 T087 无关。

**根因**：P2 architect 选 viewer.spec.ts 作 P5_e2e 时，只确认它"已覆盖 .code-body .line count + wrap"（TC-002/TC-003），没跑一遍确认它当前是否能通过。viewer.spec.ts 的路由问题跨越多个版本无人发现（router.ts 改 history 模式后它就坏了）。

**影响**：P5_e2e 的 gate 命令形同虚设。verifier 不得不写临时 t087-verify.spec.ts 替代验证。若 verifier 没主动绕开，P5 会卡在"viewer.spec.ts 全失败"。

**改进**：
- P2 architect 选 P5_e2e spec 时必须**实跑一遍确认当前能通过**（预跑检查），不能只看"覆盖了什么"
- 或 gate_commands.P5_e2e 不绑定单一 spec，改为"跑全部 e2e/ spec + failed≤N"
- 短期：立项修复 viewer.spec.ts（路由 + 硬编码 slug），登记 known-failures 已做

### 3.3【P8 中等】CHANGELOG 漏登记 v0.17.0 后的 infra 改动

**问题**：git log v0.17.0..HEAD 含 7 个非 T087 流程 commit（fb9b2802~103a8131，T080 复盘基建改进 5 项：Makefile 进度可见性/xdist 并行/rate limit 默认禁用/bcrypt 降级/lint 清理）。这些在 v0.17.0 tag 后、v0.17.1 tag 前，但 CHANGELOG [0.17.1] 没登记。

**根因**：这些是 infra/process 改动（非用户可见产品功能），按 Keep a Changelog 规范可以不进。但 P8 gate 要求"git log 对照 CHANGELOG 无遗漏"，P8 releaser 没标注这些"非产品改动不进 CHANGELOG"的判定。

**影响**：轻微。CHANGELOG [0.17.1] 只有 T087 修复 + explore 文案，用户视角准确。但 gate 的"无遗漏"判定没显式记录"7 个 infra commit 故意不进"。

**改进**：
- P8 releaser 产出应含"git log 对照表"，显式标注每个 commit "进 CHANGELOG / 不进（理由）"
- 或 P8 gate 放宽：infra/process commit（chore/docs/perf 类）不强制进 CHANGELOG

### 3.4【流程】pre-commit hook 与 state phase 的耦合摩擦

**问题**：commit 时 pre-commit hook 按 .state.yaml 的 phase 跑 gate。若 state phase 领先于实际产出（如 state=P2 但 P2-design.md 还没产出），commit 被拦截。P1/P8 commit 多次因这个被拦。

**根因**：agate 流程是"更新 state → commit"，但 state 更新到下一阶段后，下一阶段产出还没生成，hook 检测到 state phase 与产出不匹配。

**改进**：
- commit 时 state phase 应反映"已 commit 的产出阶段"，而非"即将进入的阶段"
- 主 Agent 已学会：commit 时 state 保持当前阶段，commit 后再更新到下一阶段（本任务后半段这么做，摩擦消失）
- 或 hook 放宽：state phase=N 但无 N+1 产出时不拦截（仅当 state phase=N 且有 N+1 dispatch-context 时才跑 N+1 gate）

### 3.5【流程】AGATE_CARD 注入时序

**问题**：写 dispatch-context 时手写 `<!-- AGATE_CARD_START -->PLACEHOLDER<!-- AGATE_CARD_END -->`，但若忘记注入就 commit，pre-commit 检测 hash mismatch 拦截。P1 commit 一次因这个被拦。

**改进**：dispatch-context 写完后立即跑 agate-inject-card.sh，不等到 commit 才发现。

---

## 4. 数据对比（T087 vs T080）

| 维度 | T087 | T080 | 差异 |
|------|------|------|------|
| 任务类型 | bug fix（横切 3 路径）| 新功能（三端 + 审计 + 保护）| T087 简单 |
| 总墙钟时长 | ~8h12m（含 6h33m API 503 挂起）| 3h40m（白天连续）| T087 墙钟长，但有效工作短 |
| 实际主动工作时间 | ~1h45m | 3h40m | T087 少（小任务）|
| P2-P8 commit 跨度 | 1h25m | 3h40m | T087 快 2.4× |
| 重试次数 | 2（P1×2）| 7（P1×2, P2×2, P4×3）| T087 少 5 |
| dispatch 数 | 12 | 21 | T087 少 9 |
| subagent 崩溃 | 0 | 1（P6 429）| T087 好 |
| API 中断 | 1（503，6h33m）| 0 | T087 遭遇外部故障 |
| 代码改动 | 6 insert/4 delete（1 文件）| 多文件三端 | T087 小 |
| BDD 数 | 10 | 24 | T087 少 |
| 风险 | low-medium | medium-high | T087 低 |

T087 是"小任务走完整 agate"的典型——流程开销与任务规模匹配，无过度评审。P1_simplified 降级模式有效降低了小任务的开销。

> 时长注：T087 总墙钟 8h12m 含 6h33m API 503 挂起（23:26~05:59），
> 实际主动工作 ~1h45m。P2-P8 的 1h25m commit 跨度反映流程实际开销。
> 若无 503 中断，P1 在 23:30 左右即可 commit，总时长约 2h（23:16~01:00）。

---

## 5. 流程改进建议（汇总）

| # | 建议 | 优先级 | 归属 |
|---|------|--------|------|
| 1 | P4 dispatch-context 模板加"前端改动后必须 make build-frontend" | 🔴 高 | agate 模板 / 项目 P4 dispatch |
| 2 | P2 architect 选 P5_e2e spec 时必须实跑确认当前能通过 | 🟠 中 | agate P2 卡片 / architect 角色 |
| 3 | P8 releaser 产出含 git log 对照表（进/不进 CHANGELOG 显式标注） | 🟡 低 | agate P8 卡片 / releaser 角色 |
| 4 | commit 时 state phase 反映已 commit 产出阶段（非即将进入） | 🟠 中 | 主 Agent 操作规范（已部分执行）|
| 5 | dispatch-context 写完立即注入 AGATE_CARD | 🟢 低 | 主 Agent 操作习惯 |
| 6 | 复盘时长分析须查会话 JSONL 区分主动工作 vs 外部故障挂起 | 🟠 中 | 复盘规范 |

### 建议 6 详述：commit 时间戳不能单独作流程合规性证据

**问题**：本次复盘初稿用 commit 时间戳算"总时长 1h25m"和"P0+P1 6h47m"，完全错误。真实情况是 API 503 在 23:26 宕机 6h33m，会话挂起到 05:59 才 resume。commit 时间戳只记录"提交时刻"，无法区分：
- 主动工作耗时（撰写/评审/跑 gate）
- subagent 异步等待
- Monitor 轮询空转
- **外部故障挂起**（API 503/429/网络断开）

**证据**：会话 JSONL 在 `15:26:47 UTC` 记录 `API Error: 503`，下一条事件在 `21:59:35 UTC`——6h33m 完全空白。commit 时间戳显示 P1 在 06:03，看似"拖延 6h47m 才 commit"，实际 503 前 P1 review 是 needs-revision（未 approved，不具备 commit 条件），503 后 resume 4 分钟即完成 commit，完全合规。

**改进**：
- 复盘时长分析必须查会话 JSONL（`~/.claude/projects/{project}/*.jsonl`），提取工具调用时间戳，找大间隔（>10min）并定位间隔边界事件
- 间隔边界若含 `API Error` / `503` / `429` / `SessionStart`（resume），判定为外部故障/挂起，不计入主动工作时间
- commit 时间戳只用于"阶段顺序 + commit 间隔"，不用于"实际工作时长"
- 避免把外部故障挂起误判为"主 Agent 拖延"或"流程低效"

**适用场景**：跨夜/长时间任务复盘、自主推进任务（用户睡眠期间）、遭遇 API 不稳定的会话。

---

## 6. 结论

T087 实际主动工作 ~1h45m 完成 P1-P8，2 次重试，0 subagent 崩溃，是高效的 agate 执行。总墙钟 8h12m 中 6h33m 是 API 503 外部故障挂起（23:26~05:59），非流程问题。

### commit 时序合规性说明

agate 要求"每阶段完成即 commit"。T087 的 P1 commit 在 06:03（而非 23:23 review 完成时），根因是 **503 在 P1 retry 派发前中断**：
- 23:23 review 返回 needs-revision → P1 尚未 approved，不具备 commit 条件
- 23:26 准备派 retry 修订时 503 宕机
- 05:59 resume → 06:00 retry 完成 → 06:03 P1 approved + commit

P2-P8 均在阶段完成后 1~9 分钟内 commit，符合 agate 要求。**503 中断不构成 commit 时序违规**——中断前 P1 不具备 commit 条件（review 未 approved），中断后 resume 立即完成并 commit。

### 最大价值

P1 的关键发现（Shiki 实测）纠正了用户拍板方案的陷阱，是本次最大价值。

### 主要问题

P4 漏建 static（导致 P5 额外诊断）和 viewer.spec.ts 预存失败（gate_commands.P5_e2e 形同虚设），两者都是"前端测试基础设施"的缺口，建议立项修复 viewer.spec.ts + 在 P4/P5 流程加固 static 重建检查。
