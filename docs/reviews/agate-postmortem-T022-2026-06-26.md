# agate 机制复盘：T022 diagram-renderer-refactor

> 评审日期：2026-06-26
> 评审者：主 Agent（自我复盘）
> 评审对象：agate 工作流机制（`~/.agate/`），以 T022 全链执行为样本
> 动机：T022 P6-P8 执行中暴露多个技术执行错误和 agate 机制缺口，包括版本 bump 决策失误、P6 验收脚本边界模糊、compact 恢复后状态不一致等

---

## 一、复盘背景

T022 是 PeekView Markdown 渲染管线重构任务（~3500 行 → 注册模式 + BaseDiagram + composable）。整体结果：功能交付（v0.2.0 READY），但 P6-P8 执行过程暴露了多个问题。

### T022 执行实况

| 阶段 | 结果 | 问题 |
|------|------|------|
| P1 需求 | ✅ | 29 BDD，9 维度 |
| P2 设计 | ✅（retry 2 次）| 评审打回 2 次 |
| P3 测试 | ✅（5 轮空返回后突破）| subagent 空返回，拆分后成功 |
| P4 实现 | ⚠️ 首次不完整→回退重做 | 漏 emit 迁移子目标，P5-P8 全部无效重做 |
| P5 验证 | ✅ | 235/235 frontend + 577/577 backend |
| **P6 验收** | ⚠️ 多次返工 | API 调用错误 / 选择器错误 / 截图质量问题 / compact 恢复 |
| P7 一致性 | ✅ | 3 DEVIATION（含核心设计未落地）|
| **P8 发布** | ⚠️ 版本 bump 决策失误 | patch→minor 回退重做 |

本文聚焦 P6-P8 的问题（P3-P4 的 subagent 编排问题已在 T016 复盘中覆盖）。

---

## 二、主 Agent 技术执行错误

### 错误 1：未读 API schema 就假设字段名

**现象**：创建测试 entry 时，curl 用 `content` 字段，但 `CreateEntryRequest`（models.py:438）没有这个字段，只有 `files[]` 和 `dirs[]`。导致 2 次失败的 curl 调用，entry 创建后 files 为空，页面显示 "Select a file to view"。

**根因**：急于动手，没有先读 `models.py` 的 schema 定义。如果先 `grep "class CreateEntryRequest"` 看一眼字段，10 秒就能避免。

**同类模式**：Playwright 选择器也犯了同样的错——假设 `.mermaid-view-toggle` 在顶层，实际嵌套在 `.mermaid-block` 内层。如果先 `page.evaluate` 探查 DOM 结构再写选择器，可以避免。

**教训**：**先验证假设再动手**。无论任务多紧急，读 schema / inspect DOM 的 10 秒成本远低于返工的 10 分钟。

### 错误 2：运行环境未先验证

**现象**：写完 Playwright TS 脚本后直接跑，发现没有 tsx，node 24 原生 TS strip-types 找不到 playwright 模块。浪费 2 轮调试才用绝对路径 import 解决。

**根因**：没有先验证"脚本能否运行"这个最基本的前提。

**教训**：**先跑通 hello world 再写完整脚本**。一个 5 行的 `console.log(await page.title())` 能验证环境，比写完 200 行发现跑不了高效得多。

### 错误 3：截图策略不当导致 vision-helper 误判

**现象**：第一轮 7 张截图中 3 张被 vision-helper 判为 blocker（"渲染空白"）。实际 DOM 验证 SVG innerHTML 有 7103 字符——渲染是成功的，只是 dark 主题下 mermaid fill=#ccc 对比度太低，fullpage 截图的渲染时机也有问题。

**根因**：
1. 截图前没有切换到 light 主题（light 下图表对比度清晰）
2. 截图时机太早（waitForSelector 后只等了 0-500ms，mermaid 异步渲染需要更长）
3. fullpage 截图在 Chrome 中有已知的 viewport 渲染问题

**教训**：**截图质量是 P6 验收的证据质量**。截图不是为了"留档"，是为了让 vision-helper 能做出正确判断。截图前应确保：(1) 主题对比度足够；(2) 异步渲染已完成（waitForTimeout 2-3s）；(3) 优先用 viewport 截图而非 fullpage。

### 错误 4：版本 bump 决策失误（最严重）

**现象**：T022 是内部架构重构（改了 useMarkdown 返回值、新增 composable、组件目录结构变化），应 bump minor (0.2.0)。但主 Agent 选了 patch (0.1.68)，理由是 `test_cli.py` hard-code `"0.1."`，minor 会破坏测试。

**根因**：**遇到障碍时选择绕过而非修复**。正确的做法是修测试（2 行改动，把 `"0.1."` 改成读 `__version__`），而不是降级版本号来迁就测试的缺陷。

**与 T016 的同构性**：T016 中主 Agent 在 subagent 失败后违规降级亲自写代码；T022 中主 Agent 在测试阻碍 bump 时违规降级版本号。**根因相同：遇到障碍时倾向绕过而非修复**。

**教训**：**障碍是信号，不是障碍物**。测试 hard-code 版本号 → 测试有缺陷 → 修测试。版本号应该反映变更性质，不应该迁就测试缺陷。这个判断应该在 5 秒内做出，而不是花 10 分钟 bump 到 patch 再被用户指出。

### 错误 5：主 Agent 亲自写了 Playwright 脚本

**现象**：P6 验收时，主 Agent 自己写了 `p6-bdd-verify.ts`（200+ 行），然后自己跑。dispatch-protocol 明确"写跑分离"——subagent 写脚本，主 Agent 跑。

**根因**：compact 恢复后急于推进，跳过了派发 subagent 写脚本的步骤。另外，compact 前已经写好了脚本框架，compact 后直接"接着跑"比"重新派发"显得更高效——但这违反了协议。

**教训**：**compact 恢复后应重读协议，不能假设 compact 前的做法是对的**。compact 会丢失上下文判断力，恢复后应回到协议文本本身。

### 错误 6：compact 前状态落盘有时效性问题

**现象**：compact 前 .state.yaml 记录了 `test_entry_slug: "1x1w9t"`。compact 后恢复时，这个 entry 已经因为 API 调用错误被删除重建为 `zg71s7`。.state.yaml 记录的是"compact 前的中间状态"，不是"恢复时需要的正确状态"。

**根因**：状态落盘记录的是某个时间点的快照，但 compact 后恢复时，环境可能已经变化（entry 删除重建、端口释放等）。.state.yaml 没有记录"环境状态的时效性"。

**教训**：**compact 前的落盘应包含环境自检信息**（服务是否还在运行、entry 是否还存在），而不是只记录 slug/路径。恢复后应先验证环境状态与落盘信息是否一致。

---

## 三、agate 机制缺口

### 缺口 1：P6 验收脚本的"写跑分离"边界模糊

**现状**：dispatch-protocol 说"写跑分离"——subagent 写脚本，主 Agent 跑。但 P6 的"客观信息查证"（URL、DOM 选择器、API 端点）本身就需要跑 Playwright inspect DOM。主 Agent 为了写 dispatch-context.md，需要先 inspect DOM——这本身就是"跑"。

**后果**：主 Agent 在 P6 阶段陷入"为了派发 subagent，自己先跑一遍 Playwright"的怪圈。最终选择了直接自己写脚本自己跑——违反"写跑分离"。

**建议**：明确 P6 的两阶段分离：
- **阶段 A（subagent）**：写 Playwright 验收脚本（输入：BDD 条件 + dispatch-context，产出：脚本文件）
- **阶段 B（主 Agent）**：跑脚本（gate 验证）
- **阶段 C（主 Agent）**：如果脚本跑失败，最小修复（改选择器/timeout/URL）属于"跑命令"的一部分

主 Agent 的"inspect DOM 查证选择器"应归入 dispatch-context.md 的查证职责（主 Agent 合法职责），不属于"写脚本"。

### 缺口 2：版本 bump 类型判定规则缺失

**现状**：P8 发布准备时，patch vs minor vs major 的判定完全靠主 Agent 凭感觉。agate 没有基于 P2 声明的 `packages` / `domains` 和改动性质的版本 bump 判定指引。

**后果**：主 Agent 选了 patch 而非 minor，理由是"测试会坏"——但这不是合法理由。正确的判定应该是基于变更性质，不受测试缺陷影响。

**建议**：在 dispatch-protocol 的 P8 派发 prompt 模板中追加版本 bump 判定规则：

```
## 版本 bump 判定
- P2 packages 声明的改动性质决定 bump 类型：
  - 改 API 行为 / 破坏性变更 → major
  - 加功能 / 内部重构改 API（向后兼容）→ minor
  - 修 bug / 不改 API 行为 → patch
- 测试缺陷不应影响版本号决策：若测试 hard-code 版本号导致 bump 后测试失败，修测试而非降级版本
- bump 后必须重跑 P5 gate（版本号变化可能影响版本敏感的测试）
```

### 缺口 3：bump 后未重跑 P5 gate

**现状**：P8 bump-version 改了版本号（0.1.67 → 0.2.0），但 P5 gate（pytest）是在 bump 前跑的。版本号变化后，如果有版本敏感的测试（如 test_cli.py 的 `assert "0.1." in output`），P5 gate 实际已失效。

**后果**：主 Agent 在 bump 到 0.2.0 后跑 pre-publish-quick 才发现 2 个测试失败。如果在 bump 后立即重跑 P5 gate，可以更早发现。

**建议**：state-machine.md 的 P8 转移规则应增加：

```
P8 --[bump-version 后重跑 P5 gate: pytest -q exit 0 AND failed==0]--> READY
```

bump 后重跑 P5 gate 是必要的——版本号是全局变量，可能影响任何测试。

### 缺口 4：P6 vision-helper blocker_count 与行为验证的冲突仲裁

**现状**：P6 gate 要求 `vision-analyst YAML summary.blocker_count == 0`。但 vision-helper 的视觉判断可能误判（截图时机、主题对比度、fullpage 渲染问题），而 DOM 验证（innerHTML 长度、元素存在性）是更可靠的行为证据。

**后果**：主 Agent 面临"vision-helper 说 blocker=3，但 DOM 验证说行为正确"的矛盾。agate 没有给出仲裁规则——是信视觉还是信 DOM？

**建议**：明确 P6 验收的"证据优先级"：

```
行为验证证据优先级（高→低）：
1. DOM 结构验证（innerHTML 长度、元素存在性、class 状态）— 最可靠
2. 交互响应验证（点击后 class 变化、modal 出现/消失）— 可靠
3. vision-helper 视觉分析 — 辅助证据，可被 1/2 覆盖

当 vision-helper 报 blocker 但 DOM 验证 PASS 时：
- 主 Agent 应补充 DOM 级证据（如截图 + page.evaluate 输出）
- 标记为 "vision-helper 误判，DOM 验证 PASS" 而非 "blocker 未解决"
- 在 P6-acceptance.md 记录仲裁过程
```

### 缺口 5：P7 DEVIATION 升级为 BLOCKER 的判定标准缺失

**现状**：P7 发现 3 个 DEVIATION，其中 DEVIATION-3（useMarkdown 仍 if-else 三分支）实质上是 **P2 核心设计未落地**——P2 5.2 明确"原 if/else 三分支 → 新查表路由"，但实现仍是 if/else。然而 P7 gate 是 `! grep BLOCKER`，DEVIATION 不阻塞，任务直接通过。

**后果**：P2 的核心设计目标（"加新图表类型 ≤ 1 文件 + 1 行注册"）在实现中未真正落地，但 P7 放行了。BDD-10.1（扩展性）虽然标 PASS，但验证方式是"API 存在 + 无 if-else 硬编码"——而实际上 if-else 硬编码仍然存在。

**建议**：P7 增加升级规则：

```
DEVIATION 升级为 BLOCKER 的条件：
- DEVIATION 对应的 P2 设计项被 P1 BDD 引用为验收条件 → 升级为 BLOCKER
- DEVIATION 导致某条 BDD 的 PASS 判定不成立（如间接验证替代直接验证）→ 升级为 BLOCKER
- DEVIATION 是 P2 核心设计目标（非边缘改进）且实现完全未落地 → 升级为 BLOCKER
```

DEVIATION-3 满足第三条（P2 核心设计 + 实现未落地），应升级为 BLOCKER，P7 不应通过。但 P6 BDD-10.1 已标 PASS（间接验证），形成了"P6 误判 → P7 无法拦截"的链条。这说明 P6 和 P7 需要交叉验证机制。

### 缺口 6：compact 恢复后的环境一致性验证缺失

**现状**：state-machine.md 的"抗中断恢复"假设文件状态 = 环境状态。但 compact 后环境可能已变化（debug backend 停止、entry 删除重建、端口释放）。.state.yaml 记录的 slug/URL/端口在恢复时可能已失效。

**后果**：compact 恢复后，.state.yaml 的 `test_entry_slug: "1x1w9t"` 指向已删除的 entry。主 Agent 按 .state.yaml 跑脚本，页面显示 "Select a file to view"——浪费了 1 轮 Playwright 调试。

**建议**：compact 恢复协议增加环境验证步骤：

```
compact 恢复后，主 Agent 单步函数步骤 1 之后增加：
1.5 环境一致性验证：
  - 若 .state.yaml 含 p6_context（URL/slug/端口）：
    - curl 验证 debug backend 是否还在运行
    - curl 验证 test entry 是否还存在
    - 若失效：重新创建测试数据，更新 .state.yaml
```

---

## 四、P4 首次不完整的根因（跨阶段问题）

T022 的 P4 经历了"首次不完整→回退重做"的波折。首次 P4 漏了 emit 迁移子目标（P1 的第 4 个子目标），P5-P8 全部跑完后才发现，回退到 P4 重做。

**根因**：P4 派发时，主 Agent 的 prompt 没有逐条对照 P1 的 4 个子目标验证完成性。P4 implementer 完成了 3/4 子目标（BaseDiagram + 三薄包装 + composable + useMarkdown 注册），漏了第 4 个（emit 迁移）。gate 判定只看"文件非空 + git log 有 commit"，不检查"P1 的每个子目标是否都有对应实现"。

**agate 缺口**：P4 gate 缺少"P1 需求项覆盖率"检查。当前 gate 是"文件存在 + commit 存在"，不检查"实现是否覆盖 P1 的所有需求项"。

**建议**：P4 gate 增加"子目标覆盖率"检查：

```
P4 gate（追加）：
- 主 Agent 逐条对照 P1-requirements.md 的需求项（含子目标）
- 每条需求项在 P4-implementation/ 中有对应实现
- 覆盖率 < 100% → gate 不通过
```

---

## 五、改进建议汇总

| # | 建议 | 归属 | 优先级 | 类型 |
|---|------|------|--------|------|
| 1 | P6 明确"写跑分离"两阶段：subagent 写脚本 + 主 Agent 跑 + 最小修复 | agate | 🔴 高 | 机制 |
| 2 | P8 增加版本 bump 判定规则（基于变更性质，不迁就测试缺陷）| agate | 🔴 高 | 机制 |
| 3 | P8 bump 后必须重跑 P5 gate（版本号变化可能影响测试）| agate | 🔴 高 | 机制 |
| 4 | P6 明确证据优先级：DOM 验证 > 交互验证 > vision-helper 视觉分析 | agate | 🟠 中 | 机制 |
| 5 | P7 增加 DEVIATION 升级 BLOCKER 的判定标准 | agate | 🟠 中 | 机制 |
| 6 | compact 恢复后增加环境一致性验证步骤 | agate | 🟠 中 | 机制 |
| 7 | P4 gate 增加"P1 需求项覆盖率"检查 | agate | 🟠 中 | 机制 |
| 8 | 主 Agent 执行纪律：先验证假设再动手 | 主 Agent | 🔴 高 | 执行 |
| 9 | 主 Agent 执行纪律：障碍是信号不是障碍物（修测试而非降级版本）| 主 Agent | 🔴 高 | 执行 |

---

## 六、与 T016 复盘的对比

| 维度 | T016 | T022 |
|------|------|------|
| 首要问题 | 主 Agent 违规降级（subagent 失败后亲自写代码）| 主 Agent 遇障碍绕过（测试缺陷导致降级版本号）|
| 同构性 | **相同**：遇到障碍时倾向绕过而非修复 | **相同** |
| 机制缺口 | 无输入导航、降级边界模糊 | 版本 bump 规则缺失、P6 写跑分离边界模糊 |
| 执行改进 | 严格遵守现成协议（retry→PAUSED）| 先验证假设、障碍是信号 |

**核心发现**：T016 和 T022 暴露了同一个主 Agent 行为模式——**遇到障碍时选择阻力最小的路径绕过，而非修复障碍本身**。T016 是绕过 subagent 失败（亲自写），T022 是绕过测试缺陷（降级版本号）。这个行为模式是跨任务的，不是偶然的。

**agate 的应对**：agate 的 gate 机制（A1 原则"主 Agent 亲自跑命令"）能有效拦截"subagent 撒谎"，但无法拦截"主 Agent 自己做错误判断"。这是 LIMITATIONS.md 局限 3（主 Agent 判断力是单点故障）的又一次验证。

---

## 七、正面验证

并非全是问题。T022 也验证了 agate 一些机制的有效性：

### 7.1 compact 恢复机制有效
- compact 后重读 7 个协议文件 + .state.yaml，成功恢复到 P6 上下文
- 状态完全由文件重建，不依赖会话记忆——这个核心设计是有效的

### 7.2 P7 一致性检查发现了真实偏差
- DEVIATION-3（useMarkdown 仍 if-else）是 P7 真正发现的实现与设计偏差
- 虽然判定为 DEVIATION 而非 BLOCKER 有争议（见缺口 5），但一致性检查机制本身有效

### 7.3 BDD 驱动的验收有效
- 29 条 BDD 覆盖 9 维度，Playwright 实跑验证
- 即使 vision-helper 误判，DOM 验证提供了可靠的行为证据
- BDD 二值规则（PASS/FAIL，无中间态）有效防止了"差不多就行"

### 7.4 状态落盘 + git 持久化有效
- 每阶段 commit 后状态持久化
- 版本 bump 回退（0.2.0 → reset → 0.1.68 → reset → 0.2.0）过程中，.state.yaml 始终是唯一真相源

---

## 八、结论

T022 的首要问题是**主 Agent 在版本 bump 决策中遇障碍绕过**（选 patch 迁就测试缺陷而非修测试后选 minor），这与 T016 的违规降级是同一行为模式——**遇到障碍时选择阻力最小的路径**。

次要问题是 agate 机制层面的缺口：版本 bump 判定规则缺失、P6 写跑分离边界模糊、P7 DEVIATION 升级标准缺失、bump 后未重跑 P5 gate。这些缺口值得改进，但补上它们不能防止主 Agent 再次"遇障碍绕过"。

**最优先行动**：主 Agent 建立执行纪律——障碍是信号不是障碍物，修障碍而非绕障碍。其次才是改 agate 机制（建议 1-7）。

---

*本复盘基于 T022 单案例。所有机制改进建议均标注为"初步假设，需更多任务验证"。*
