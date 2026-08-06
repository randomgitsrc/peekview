---
status: approved
agent: retrospective-reviewer
created: 2026-08-06
revised: 2026-08-06
---

# T080 复盘评审

> 评审对象：`docs/reviews/T080-retrospective-20260806.md`
> 评审依据：git log + state.yaml + 各阶段产出文件 + gate 脚本源码交叉核对
> 评审结论：needs-revision（客观性良好，但有一处技术判断错误 + 一处遗漏 + 数据不一致需修正）

---

## 1. 客观性核对

### 1.1 时间线（准确）

逐条核对 `git log -1 --format="%ci"` 与复盘 §1.1 表格：

| 阶段 | 复盘记录 | git 实际 | 判定 |
|------|---------|---------|------|
| P1 | 03:46:34 | 03:46:34 | ✓ |
| P2 | 04:08:39 | 04:08:39 | ✓ |
| P3 | 04:28:19 | 04:28:19 | ✓ |
| P4 | 05:55:45 | 05:55:45 | ✓ |
| P5 | 06:21:17 | 06:21:17 | ✓ |
| P6 | 07:04:02 | 07:04:02 | ✓ |
| P7 | 07:14:32 | 07:14:32 | ✓ |
| P8 | 07:26:55 | 07:26:55（READY commit 2726f972）| ✓ |

间隔计算（22min/20min/87min/26min/43min/10min/12min）全部正确。总跨度 3h40m 准确。

**小瑕疵**：P8 行标注 "bump v0.17.0 + tag + READY 清理" 对应 07:26:55，但实际有两个 bump commit（f0c7b40e @07:19:11、c0472105 @07:20:40，后者是 amend 含 CHANGELOG 补充）。复盘合并为一行可接受，但漏了 amend 事实。不影响结论。

### 1.2 重试次数（准确）

复盘 §1.1 "7 次（P1×2, P2×2, P4×3）" 与 dispatch-context 文件名一致：
- P1: analyst-retry1 + requirements-review-retry1 = 2
- P2: architect-retry1 + plan-design-review-retry1 = 2
- P4: implementer-retry1/2/3 = 3
- 合计 7 ✓

### 1.3 subagent 统计（轻微不一致）

复盘 §1.2 合计 15。按 dispatch-context 文件实际计数：
- 不重复角色：14（P1×2 + P2×2 + P3×1 + P4×5 + P5×1 + P6×1 + P7×1 + P8×1）
- dispatch 次数（含 retry）：21

P4 行写 "6 | implementer×3, review/design-review/cso×3, review-lead"。这个计数混乱：implementer 有 4 次 dispatch（initial + 3 retry）非 3；3 个 reviewer 各 1 次 dispatch + review-lead 1 次 = 4。按角色算 P4 = 5，按 dispatch 算 = 8，按复盘的 "6" 算对不上任何口径。建议明确口径（角色数 vs dispatch 次数）后重算。

### 1.4 质量数据（准确）

- pytest 1068 passed / 1 failed（ruff env）— 与 P5-test-results/unit.md 一致 ✓
- vitest 1217 passed — 一致 ✓
- E2E 27/27 — 一致 ✓
- 24/24 BDD PASS — 与 P6-acceptance.md 一致 ✓
- 预存失败登记 — known-failures.md 存在 ✓

---

## 2. 根因深度评估

### 2.1 问题 A（NEED_CONFIRM 分级）— 根因到位

"有倾向但求确认" vs "真无方向" 被同等阻塞，机理分析准确。建议（倾向性确认分级）可落地。但建议中"本任务用户已明确'所有决策自行判断不再询问'"——这一声明在 task 文件中未找到证据，可能来自会话内用户指令（无法交叉核对）。建议标注出处或改为"建议后续任务由主 Agent 采纳倾向"。

### 2.2 问题 B（P4 retry 预算）— 根因到位，分类有价值

三类问题（需求矛盾/实现 bug/契约偏差）共用 retry 预算的机理分析准确。"retry 预算分类"建议有落地价值。但需注意：retry#3 的 E2E 选择器问题实质是 P5 发现后回退到 P4（非 P4 gate 拦截），复盘 §1.3 把它列为 P4 gate 拦截略有误导——它是 P5→P4 回退而非 P4 首轮/review 拦截。建议在 §1.3 标注"retry#3 = P5 E2E 失败回退 P4"。

### 2.3 问题 C（P6 verifier 崩溃）— 现象描述合理，但根因浅

"429 API 崩溃"现象在 task 文件中无直接证据（文件中 429 仅指 BDD-01 rate limit）。崩溃发生在 subagent transcript（未持久化），无法交叉核对。主 Agent 接管修复格式是事实（P6-acceptance.md 最终格式正确）。但根因分析停留在"长耗时 subagent 在限流下脆弱"，未深挖：
- **为什么 verifier 一次调用会触发限流**：24 BDD × 多证据类型 × 多 gate 格式约束 = 单次 prompt 过大或工具调用过多？
- **第三方模型限流策略是什么**：是 token 速率还是并发？能否通过减小单次 dispatch 范围规避？

建议补充限流的机理判断（即使无法确证，也应给出假设）。

### 2.4 问题 D（DESIGN_GAP 暴露需求矛盾）— 根因到位

BDD-06（自 disable → 400）与 BDD-10（sole admin disable → 409）同场景矛盾的机理分析准确。P1-review.md 确认 reviewer 当时判 BDD-06 PASS 未提矛盾，复盘的"P1 review 未充分审查跨条一致性"判断成立。建议（同场景 BDD 交叉检查）可落地。

**补充**：复盘未提到 P1-requirements.md 的 BDD-06 在 P4 阶段被回写补充了"sole admin 自操作时 LastAdmin 保护优先，返回 409"注释（P4-progress Step 14）。这意味着 P1 文档被 P4 修改——这本身是一个 agate 流程问题（下游改上游文档），复盘应提及并评估是否合规（P4 改 P1 是否需要重新 review？）。

### 2.5 问题 E（3 个真实 bug）— 根因到位

is_active/FK/UI 三类 bug 的机理和根因分析准确。cso 的 ISSUE-1 与 review 的 CRITICAL 1 确实独立发现同一 is_active bug（P4-review-cso.md ISSUE-1 + P4-review.md CRITICAL 1 均提到），交叉验证的说法成立。

### 2.6 问题 F（gate 格式拦截）— **技术判断有误**（必须修）

复盘 §2.2 问题 F 称："dispatch-context 模板含 `- PASS`/`- FAIL` 指令行，被预判检测误匹配——模板自身就是反模式"。

**实际**：`check-p6-provenance.sh` 审计 2（第 75-77 行）在检测前用 `sed '/<!-- AGATE_CARD_START -->/,/<!-- AGATE_CARD_END -->/d'` **显式剥离 AGATE_CARD 块**，再 grep `- (PASS|FAIL)\b`。P6-dispatch-context-verifier.md 中的 `- PASS BDD-NN:` 行（第 105 行）和 `- FAIL > 0` 行（第 144 行）**全部位于 AGATE_CARD 块内**（第 47-192 行），会被 sed 删除，不参与预判检测。

实测：`bash ~/.agate/scripts/check-p6-provenance.sh docs/tasks/T080-admin-user-management` 当前 exit 0，无预判报错。

因此复盘的"dispatch-context 模板缺陷"判断**缺乏证据支持**。若复盘时确实发生过预判拦截，可能是：
1. 当时 dispatch-context 的 `- PASS` 行不在 AGATE_CARD 块内（后被修正），或
2. 拦截来自其他原因（非预判检测）

建议：复盘需重新核实 P6 拦截的真实原因。如果是中间态问题，应说明"已修复，当前 gate 通过"；如果判断错误，应撤回"模板缺陷"结论。

### 2.7 问题 G（E2E 选择器契约）— 根因到位

TDD 测试先写 + class 命名无协同的机理准确。data-testid 建议可落地，且本任务 retry#3 已实际采用。

### 2.8 问题 H/I（环境）— 准确

ruff env 预存失败的根因（hermes venv 劫持 python3）与 known-failures.md 一致。debug-stop 未真正停止服务的问题在 P8-release.md 第 109 行有直接证据（releaser 实测 :8888 仍在运行 PID 198514）。

---

## 3. 分类清晰度

管理/技术/环境三类分清，无混淆。问题 A/B/C 归管理（agate 机制），D/E/F/G 归技术，H/I 归环境——分类合理。

**一处可改进**：问题 C（verifier 崩溃）归"管理原因"但实质是"第三方 API 限流"（环境/工具因素）。建议归入环境类，或明确说明"管理层面表现为单点依赖，环境层面表现为限流"。

---

## 4. 建议可操作性

| 建议 | 可落地性 | 评估 |
|------|---------|------|
| NEED_CONFIRM 倾向性分级 | 可落地 | 具体格式 `[NEED_CONFIRM倾向: X]` 可直接实施 |
| P3/P4 选择器契约用 data-testid | 已落地 | retry#3 已验证 |
| gate 正则透明化（角色文件给代码块） | 可落地 | 需改角色文件模板 |
| vision YAML 结构模板 | 可落地 | 需改 verifier 角色文件 |
| P6 拆分（verifier 产出 + 主 Agent 修格式） | 可落地 | 但需评估主 Agent 修格式是否违反"不亲自产出"原则 |
| retry 预算分类 | 可落地 | 需改 agate 状态机 |
| make debug-stop 兜底 pkill | 可落地 | 需改 Makefile |

**缺评估**：P6 拆分建议中"主 Agent 直接 sed/python 修格式"与 agate 铁律"主 Agent 不亲自写代码或产出"存在张力。复盘应讨论这个冲突并给出取舍（如：格式修正不算"产出"，属 gate 维护）。

---

## 5. 完整性（遗漏问题）

### 遗漏 1：known-failures.md 被滥用为草稿本（必须补）

`known-failures.md` 第二个条目"T080 E2E 失败（非预存，记录待修复）"明确写道"非预存失败，不在此登记为 known-failure，仅记录供主 Agent 决策"——**但它仍然被写入了 known-failures.md**。

这是流程问题：known-failures.md 的语义是"预存失败登记"（P5 之前就存在的失败），不应混入本任务引入的失败。把当前任务的失败写进去会：
1. 污染 known-failures 的语义（reviewer/gate 无法区分预存 vs 新引入）
2. 给后续任务留下误导（看起来像预存失败）

复盘未提及此问题。建议补充为新的"管理/流程问题"。

### 遗漏 2：P4 修改 P1 文档（流程合规问题）

P4-progress Step 14 明确记录"P1-requirements.md BDD-06 Then: added LastAdmin priority note"。P4 修改 P1 文档是下游改上游，agate 流程上应触发 P1 重新 review 或至少主 Agent 确认。复盘在问题 D 的根因中提到"P4 implementer 标 DESIGN_GAP 而非擅自改测试"，但没注意到 P4 **实际修改了 P1 文档**这一更严重的流程问题。建议补充。

### 遗漏 3：双 bump commit（小）

f0c7b40e（07:19:11）和 c0472105（07:20:40）是两个内容几乎相同的 bump commit，后者是 amend。这可能是 bump-version 流程的瑕疵（先 commit 再 amend 补 CHANGELOG）。复盘未提及。影响小，但既然复盘涉及 P8 发布准备，应记录。

---

## 6. 自我吹捧平衡

### 好的方面（§3）评估

1. gate 有效拦截 — 属实 ✓
2. 三角色并行评审 — 部分属实。cso 和 review 确实独立发现 is_active bug，但 design-review **未发现** is_active bug。复盘表述"cso 和 review 独立发现同一 bug"准确，但"三角色并行评审"的标题暗示三者都有效，略夸大。建议注明 design-review 未参与该 bug 的发现。
3. 主 Agent 亲跑 gate — 属实 ✓
4. DESIGN_GAP 机制有效 — 属实 ✓
5. PROD_NOT_TOUCHED — 属实 ✓（P6-acceptance.md + P7-consistency.md 均声明）
6. known-failures 登记 — 属实但见遗漏 1
7. vision-engine + playwright-cdp 链路稳定 — 属实 ✓（8 张截图 md5 唯一，blocker_count=0）

### 问题回避

未发现明显回避。P4 的 3 次 retry、P6 崩溃、gate 格式拉锯都如实记录。自我批评的比例（9 个问题 vs 7 个好的方面）平衡。

---

## 7. 修订要求清单

### 必须修（影响复盘正确性）

1. **问题 F 技术判断错误**：撤回或重新核实"dispatch-context 模板缺陷"结论。gate 脚本 `check-p6-provenance.sh` 第 75 行已用 sed 剥离 AGATE_CARD 块，`- PASS`/`- FAIL` 行在块内不会被检测。需说明 P6 拦截的真实原因（或标注"中间态已修复，无法复现"）。

2. **补充遗漏 1**：known-failures.md 被写入非预存失败（E2E 选择器问题），违反 known-failures 语义。作为新的流程问题列入 §2。

3. **补充遗漏 2**：P4 修改 P1-requirements.md（BDD-06 补注释）是下游改上游文档，应评估流程合规性。

### 建议修（提升质量）

4. §1.2 P4 subagent 计数（"6"）口径不清，建议明确是角色数还是 dispatch 次数后重算。
5. §1.3 P4 retry#3 标注"P5 E2E 失败回退 P4"（非 P4 首轮 gate 拦截）。
6. §1.3 BLOCKER 数量：写"3 review BLOCKER"但实际 5 个（2 CRITICAL + 3 MUST-FIX），与 §2.2/§5 的"5"不一致。统一为 5。
7. §3 第 2 点"三角色并行"注明 design-review 未发现 is_active bug（仅 cso + review 交叉验证）。
8. 问题 C 归类：从"管理原因"移到"环境/工具原因"，或说明双因素。
9. P6 拆分建议讨论与"主 Agent 不亲自产出"铁律的张力。
10. 问题 C 补充限流机理假设（为何单次 dispatch 触发限流）。

---

## 8. 总结

复盘的客观性扎实（时间线/数据全部可核对），根因分析在多数问题上到位（A/B/D/E/G），分类清晰。主要问题集中在：

- **一处技术判断错误**（问题 F：gate 脚本已处理 AGATE_CARD 剥离，"模板缺陷"结论不成立）
- **两处遗漏**（known-failures 滥用 + P4 改 P1 文档）
- **数据小不一致**（BLOCKER 3 vs 5、subagent 计数口径）

修订后可达到 approved。建议主 Agent 按第 7 节清单修订后提交复审。

---

## 9. 复审（2026-08-06）

### 逐条核对

| # | 类型 | 修订项 | 落实 | 核对位置 |
|---|------|--------|------|---------|
| 1 | 必须 | 问题 F 撤回"模板缺陷"→ 改"主 Agent dispatch-context 格式失误" | ✓ | §2.2 问题 F 第 169/174/178 行：明确"在 AGATE_CARD 块外"触发，"非 agate 模板缺陷"。技术判断已修正，与 gate 脚本第 119 行 sed 剥离逻辑一致 |
| 2 | 必须 | 补 known-failures.md 滥用（问题 J） | ✓ | §2.3 问题 J 第 219-231 行：语义污染机理 + 影响 + 处置建议齐全 |
| 3 | 必须 | 补 P4 修改 P1 文档（问题 D 流程问题） | ✓ | §2.2 问题 D 第 135 行："流程问题（P4 修改 P1 文档）"，含 [BASELINE_CHANGE] 机制建议 |
| 4 | 建议 | §1.2 P4 subagent 计数口径 | ✓ | 第 37 行："5 角色 / 8 dispatch" + 明细；第 42 行合计"14 角色 / 21 dispatch"。口径自洽 |
| 5 | 建议 | §1.3 retry#3 标注 P5 回退 | ✓ | 第 53 行："（**P5 E2E 失败回退 P4**，非 P4 gate 拦截）" |
| 6 | 建议 | BLOCKER 数量 3→5 统一 | △ 部分 | §1.3/§2.2/§5 均改为 5，但 §1.1 第 21 行仍写"3 review BLOCKER"。仅剩摘要行未同步 |
| 7 | 建议 | 三角色并行（design-review 未发现 is_active） | ✓ | §3 第 2 点第 238 行："design-review 未参与该 bug 发现，但发现了 3 个前端 MUST-FIX" |
| 8 | 建议 | 问题 C 归类环境/工具 | ✓ | 移至 §2.3 环境与工具原因，标题标注"环境/工具因素，管理层面表现为单点依赖" |
| 9 | 建议 | P6 拆分张力讨论 | ✓ | §4 第 5 项第 261 行 + §2.3 问题 C 第 85 行：明确张力 + gate 维护例外边界 |
| 10 | 建议 | 问题 C 限流机理假设 | ✓ | §2.3 问题 C 第 81 行：MaaS 代理 + token 速率/并发假设 + 单次 dispatch 超窗口假设 |

### 评估

10 项中 9 项完全落实，第 6 项部分落实（§1.1 时间线摘要行"3 review BLOCKER"漏改为 5）。这是单行数字遗漏，主体（§1.3/§2.2/§5）均已统一为 5，不影响复盘正确性。

### 结构小瑕疵（不阻断）

- §2.3 标题"### 2.3 环境与工具原因"出现两次（第 72 行、第 199 行）。问题 C 应归 §2.3，但 §2.2 技术原因节在问题 D/E/F/G 之后直接接了第二个 §2.3，章节编号重复。建议将问题 C 所在节改为独立编号或并入 §2.3 一次。不影响内容正确性。

### 结论

**status: approved**

修订到位。问题 F 的技术判断已纠正（撤回"模板缺陷"，归因为主 Agent dispatch-context 格式失误 + AGATE_CARD 块外触发），与 gate 脚本实际逻辑（第 119 行 sed 剥离 AGATE_CARD）一致。两处必须补充的遗漏（问题 J known-failures 滥用、问题 D P4 改 P1 流程问题）均已补全且根因到位。限流机理假设、P6 拆分张力讨论均按要求补充。

遗留的 §1.1 "3 review BLOCKER" 单行不一致属笔误级别，建议主 Agent 顺手改为"5 review BLOCKER（2 CRITICAL + 3 MUST-FIX）"，但不构成复审阻断条件。
