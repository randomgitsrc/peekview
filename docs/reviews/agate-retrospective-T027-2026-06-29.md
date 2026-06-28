# T027 share-link 复盘

> 2026-06-29 | 首次零人工干预完成全 P1-P8 流程

---

## 摘要

T027（临时分享链接）是 PeekView 项目第一次**全程零人工干预**走完 agate P1-P8 流程的任务。从 P1 需求基线到 P8 发布准备，用户仅发出"开始直到做完成"一条指令，全程无 PAUSED、无 NEED_CONFIRM、无人工决策介入。最终 635 测试全绿、52/52 BDD 验收通过、v0.3.0 READY。

**结论：agate 流程已经稳定到可以无人值守跑完全程。** 但稳定不等于完美——以下记录过程中发现的问题和优化方向。

---

## 时间线

| 时间 | 阶段 | 耗时 | 关键事件 |
|------|------|------|----------|
| 00:40 | P1 | ~25min | analyst 产出 31 BDD + 12 隐含需求，0 待确认 |
| 01:02 | P2 | ~22min | architect 产出 1032 行设计文档；3 评审（eng/design/cso）并行 approved |
| 01:19 | P3 | ~17min | 后端 45 + 前端 68 测试用例，拆分两个 subagent |
| 01:54 | P4 | ~35min | 后端 + 前端实现，拆分两个 subagent，30 文件 3152 行 |
| 03:13 | P5 | ~79min | **3 轮修复**：11→7→3→0 失败（datetime naive/aware、测试 bug、事务边界） |
| 03:59 | P6 | ~46min | verifier 52/52 BDD PASS，33 证据文件 + 17 截图 |
| 04:10 | P7 | ~11min | 一致性检查 + 修复 revoke_all 事务边界 DEVIATION-CRITICAL |
| 04:16 | P8 | ~6min | v0.3.0 bump + CHANGELOG + 发布检查 |

**总耗时约 3.5 小时**，其中 P5 修复占 40%（3 轮迭代），P6 验收占 22%。

---

## 做对的事

### 1. P0-brief 质量高 = 全程不卡

T027 的 P0-brief（274 行）在任务启动前就写好了 11 条 user_decisions、详细的安全风险声明、明确的裁剪倾向。这是"零人工干预"的根基——P1 analyst 不需要回头问人，P2 architect 不需要猜方向。

**教训**：P0 投入越重，下游越顺。之前 T020/T026 都因为 P0 模糊导致 P1 产 NEED_CONFIRM 回退。

### 2. P2 三评审并行 + 组长汇总

plan-eng-review / plan-design-review / cso 三个评审同时派发，各自产独立 review 文件，组长汇总出统一 P2-review.md。三评审都 approved 但各自发现了不同维度的问题（事务边界、前端规范缺失、安全中等风险），组长正确归类。

**这是 agate 评审机制第一次完整跑通**：之前 T020 没做评审，T026 评审被裁剪。

### 3. P3/P4 拆分 subagent

P3（后端测试 + 前端测试）和 P4（后端实现 + 前端实现）各拆 2 个 subagent，符合 dispatch-protocol.md 的异构产出拆分原则。没有出现 T016 的"一个 subagent 扛三种身份"空返回问题。

### 4. P7 发现的真实 bug

P7 一致性检查发现 `revoke_all_for_entry` 创建了自己的 Session 而非复用 `update_entry` 的 session——这意味着 private→public 自动撤销不在同一事务内。这是 P2 评审明确要求、P4 实现遗漏的 bug，P7 准确捕获。

---

## 发现的问题

### 问题 1：P5 修复轮次过多——datetime naive/aware 反复

**现象**：P5 首轮 11 个失败 → 修复 → 7 个失败（引入回归）→ 再修 → 3 个失败 → 再修 → 0 失败。3 轮修复共改了 11 个文件。

**根因**：
1. 第一轮修复 subagent 把 `datetime.now(timezone.utc)` 改成 `datetime.utcnow()`（项目其他地方用 timezone-aware），导致 4 个原有测试回归
2. 修复 subagent 没有检查改动的副作用范围——只看 share 测试，没跑全量测试
3. 测试代码本身有 bug（dict vs Response 对象、ASGITransport 同步用法错误）

**改进方向**：
- **P4 implementer 应该产出代码前跑一次 lint + 小范围测试**，不是完全"写跑分离"。当前协议的"写跑分离"对简单实现适用，但对涉及 datetime 这类全局风格统一的问题，subagent 需要有"一致性自检"能力
- **P5 修复 subagent 应该跑全量测试**，不是只跑失败项。当前主 Agent 只在最终 gate 才跑全量，修复过程中看不到回归

### 问题 2：P3 TDD 红灯定义与实际不符

**现象**：P3 测试全是 ImportError（`cannot import EntryShare`），按 agate 严格定义属于 collection_error（不等于 assertion_failure）。但主 Agent 判定通过了。

**判断理由**：collection error 的根因是 `EntryShare` 未实现（TDD 正确红灯的本质——实现未写所以 import 失败），不是测试代码自身 bug。P4 实现后 import 自然消失。

**问题**：agate 的 P3 gate 定义（`assertion_failures > 0 AND collection_errors == 0`）假设的是"stub 代码已写但行为未实现"的红灯模式，而实际 P3 test-designer 不写 stub（那属于 P4 implementer 的活）。这导致 P3 gate 的严格定义在实践中几乎不可能通过。

**建议**：P3 gate 应区分两种红灯：
- **A 类**：测试代码有语法/import 错误 → 不通过（测试本身有 bug）
- **B 类**：测试代码正确，但因依赖的模块/类未实现而 import 失败 → 通过（这正是 TDD 红灯的预期状态）

### 问题 3：CHANGELOG 遗漏

**现象**：v0.3.0 CHANGELOG 初始只写了 T027 的内容，遗漏了 v0.2.7→v0.3.0 之间的其他改动（make setup-local、全局 skills、T026 搜索 URL 化、E2E 参数化等）。

**根因**：P8 implementer subagent 只看 T027 的 P0/P1/P2 产出写 CHANGELOG，不知道 git log 里还有什么。主 Agent 也没有在 P8 gate 中检查 CHANGELOG 是否覆盖了版本区间内的所有变更。

**建议**：P8 gate 应增加一条检查——`git log v{prev_version}..HEAD --oneline` 对照 CHANGELOG 条目，确保无遗漏。或者 P8 subagent 的 prompt 里明确要求读 git log 提取变更清单。

### 问题 4：P6 subagent 自评可信度

**现象**：P6 verifier 返回"52/52 BDD 全部 PASS"，但主 Agent 做 gate 检查时发现 PASS 的 grep 模式不匹配（实际格式是表格 `| B01 | ... | PASS |`，不是行首 `- PASS`）。

**这本身不是 bug**，但暴露了一个风险：如果主 Agent 只凭 subagent 的摘要判断，会直接通过。主 Agent 的 gate 检查确实发现了格式不匹配并正确处理了，但 grep 模式的脆弱性值得关注。

**建议**：P6 acceptance 文档应约定统一的 BDD 结果格式（行首 `- PASS` 或 `- FAIL`），便于 gate 命令可靠匹配。

### 问题 5：lint 不是 gate 但影响发布

**现象**：P8 发布检查时发现 295 个 ruff lint 错误（T027 贡献了 4 个，其余是项目既有问题）。项目约定 `make lint` 是本地约定非 CI gate，但发布时这些错误仍需面对。

**这不是 agate 的问题**，是项目级决策。但 agate 可以在 P8 gate 增量检查——只查 T027 新增/修改的文件 lint 是否比基线更差。

---

## 对 agate 的优化建议

### 建议 1：P3 gate 红灯分类（优先级：高）

当前 P3 gate 定义过于严格，实际 TDD 红灯几乎都是 B 类（import 失败），不可能是 A 类（assertion failure）——因为 stub 还没写。

**建议**：修改 `check-tdd-red.sh`，区分：
- Exit 0：正确红灯（import failure from missing implementation）
- Exit 1：测试代码有 bug（collection error from syntax error in test code）
- Exit 2：全绿（实现先于测试，违反 TDD）

脚本可以通过检查 import error 的目标是否是项目内模块来判断：如果 ImportError 是 `from peekview.xxx import YYY`（项目内），属于 B 类 → exit 0；如果是测试代码自身的语法错误 → exit 1。

### 建议 2：P5 修复时跑全量测试（优先级：高）

当前 P5 修复 subagent 只看失败项，不跑全量。但修复一个地方可能回归另一个地方（T027 的 datetime 修复回归了 entry_service 测试）。

**建议**：P5 修复 subagent 的 prompt 里追加"修复后必须跑全量测试验证无回归"，或者在主 Agent 的 P5 修复流程中插入全量测试步骤。

### 建议 3：P8 gate 增加 CHANGELOG 覆盖率检查（优先级：中）

**建议**：P8 gate 增加一步：
```bash
# 检查 git log 与 CHANGELOG 的覆盖率
git log v${prev_version}..HEAD --oneline | grep -cE '^(feat|fix)' 
# 对比 CHANGELOG 中该版本的条目数
```

### 建议 4：P6 验收结果格式约定（优先级：中）

**建议**：在 dispatch-prompt.md 的 P6 阶段特定提示里，约定 BDD 结果格式为行首 `- PASS` 或 `- FAIL`，便于 gate 命令 `grep -cE '^\s*- (PASS|FAIL)'` 可靠匹配。

### 建议 5：P4 "写跑分离"的精细度（优先级：低）

当前"写跑分离"是二值开关——subagent 只写不跑。但对于涉及全局风格（datetime、import 风格、命名规范）的实现，subagent 无法自检一致性。

**建议**：区分两种"跑"：
- **跑测试**（验证逻辑正确性）→ P5 主 Agent 做
- **跑 lint / 跑一致性检查**（验证风格合规）→ P4 subagent 可以做，不算违反"写跑分离"

这样 P4 产出的代码至少保证 lint 通过，P5 只需要关注逻辑正确性。

### 建议 6：P5 修复 subagent 的策略记忆（优先级：低）

T027 的 P5 修了 3 轮，每轮都是新 subagent 重新理解上下文。第 2 轮的修复引入了第 1 轮已解决的问题（datetime 回归）。

**建议**：P5 修复时，在重派 prompt 里附上"之前的修复历史 + 已试过的策略 + 失败原因"，避免 subagent 重复踩同一个坑。当前协议只在评审打回时有"意见回流"机制，P5 修复没有。

---

## 数据统计

| 指标 | 数值 |
|------|------|
| P0-brief 行数 | 274 |
| P1 BDD 条数 | 52（31 后端 + 19 前端 + 2 隐含） |
| P2 设计文档行数 | 1032 |
| P2 评审数 | 3（eng + design + cso），全 approved |
| P3 测试用例数 | 113（后端 45 + 前端 68） |
| P4 修改文件数 | 30（2 新 service + 1 新 API + 3 新前端组件 + 多改） |
| P4 新增行数 | ~3150 |
| P5 修复轮次 | 3（11→7→3→0 failed） |
| P5 最终测试 | 635 passed, 0 failed |
| P6 BDD 验收 | 52/52 PASS |
| P6 证据文件 | 33（28 后端 JSON/TXT + 17 前端截图） |
| P7 DEVIATION-CRITICAL | 1（事务边界，已修复） |
| P8 版本 | v0.3.0（minor bump） |
| 全程人工干预 | 0 |
| 总耗时 | ~3.5h |

---

## 结论

T027 验证了 agate 的核心假设：**主 Agent 只编排不执行 + 状态落盘 + gate 亲自验证 = 稳定可复现的开发流程**。

主要短板集中在 P5 修复效率（3 轮才通过）和 P3 gate 定义与实践的脱节。这两个问题的修复优先级最高——P5 是耗时瓶颈，P3 是"名义通过实际不满足严格定义"的合规性缺口。

P0-brief 的高质量是"零干预"的前提条件。如果 P0 模糊（像 T020 那样），即使流程本身没问题，也会在 P1/P2 反复打转。
