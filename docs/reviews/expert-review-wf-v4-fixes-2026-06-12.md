---
review_id: expert-review-wf-v4-fixes-2026-06-12
type: expert-review-summary
target: docs/plans/workflow-v4-review-fixes.md
status: rejected
reviewers: [plan-eng-review, plan-ceo-review]
created: 2026-06-12
---

# 专家评审：Workflow v4 修复方案

> 评审日期：2026-06-12
> 评审对象：docs/plans/workflow-v4-review-fixes.md
> 评审团：plan-eng-review（工程经理）+ plan-ceo-review（创始人/CEO）

## 评审结论

**Status: rejected** — 同时存在技术阻塞（3 项）和方向分歧（过度设计）。修复方案需要两方面的调整：

1. **技术侧**（plan-eng）：Fix-4 基于错误诊断（P4 gate 不依赖 P3），Fix-12 与 L2 表冲突（拦截条件误用"非相邻"），且缺失"阶段跳过转移规则"
2. **方向侧**（plan-ceo）：第 3 批 5 个 P2 机制增强（Fix-8/9/10/12）属过度设计，应在实战数据积累后再评估

**推荐路径**：砍掉第 3 批 → 修正 Fix-4/Fix-12 → 增补缺失的"阶段跳过转移"→ 保留第 1/2 批核心修复 → 二次评审。

---

## 专家组意见

### BLOCKER（阻塞，必须修改）

**B1. Fix-4：P4 gate 注入测试验证 — 基于错误诊断**
> 来源：plan-eng-review（阻塞级）
>
> 当前 `state-machine.md:73` 的 P4 gate 定义：
> ```
> P4 --[P4-implementation/ 下文件非空 AND git log --oneline -1 包含 P4 commit]--> P5
> ```
> P4 gate **不引用 P3**，不验证测试结果。测试验证是 P5 gate 的独立职责（`state-machine.md:77`）：
> ```
> P5 --[pytest -q exit 0 AND failed==0 AND ...]--> P6
> ```
> P3 跳过时，P4→P5→P6 天然正确运行——P4 确认产出，P5 统一跑 pytest。原评审"P4 门槛依赖 P3"经核查不成立。**Fix-4 属无效修复，不实施。** 如需增强，应在 `implementer.md` 增加自检规范，而非在 gate 层重复测试验证。

**B2. Fix-12："非相邻阶段拦截"与 L2 上溯表冲突**
> 来源：plan-eng-review（阻塞级）
>
> Fix-12 定义"非相邻即 PAUSED"。但 L2 上溯表（`state-machine.md:346-355`）已包含非相邻合法跳转：P4→P2（跳 P3）、P6→P4（跳 P5）、P7→P2（跳 P3-P6）。按 Fix-12 规则，这三条全部被拦截，等于禁用 L2 核心机制。
>
> 根因：Fix-12 混淆了"单次 L2 非相邻跳转"（设计意图内）和"链式多次 L2"（需要拦截）。拦截条件应改为：**检测链（P5→P4→P2 累积回退）而非非相邻**。

**B3. 缺失：状态机无阶段跳过转移规则**
> 来源：plan-eng-review（阻塞级）
>
> README 声明 P2/P3/P6/P7 为可选阶段，但 `state-machine.md` 只有完整 P1→P8 线性路径，没有跨阶段跳转规则（如 P1→P4、P2→P4 等）。主 Agent 在跳过场景无形式规则可循，与 v4 原则 4（门槛必须机器可判定）矛盾。
>
> 需增补 Fix-13：在 state-machine.md 增加跳过转移段，gate 从 P1-requirements.md 裁剪声明中读 `phases:` 列表判定。

---

### 建议（可改进，非阻塞）

**S1. Fix-1：check-tdd-red.sh 鲁棒性不足**
> 来源：plan-eng-review（建议级）
>
> - `grep -oP` 依赖 GNU grep（macOS 不兼容），建议改用 `grep -oE`
> - pytest 崩溃（segfault/OOM）时可能误判为红灯，建议增加哨兵检查
> - ANSI 颜色码可能干扰 `grep` 匹配，建议脚本开头 `export FORCE_COLOR=0`

**S2. Fix-3：grep 转义在不同实现下不一致**
> 来源：plan-eng-review（建议级）
>
> `! grep -q '\[BLOCKER\]'` 中 `\[` 在 BRE 下行为实现定义。建议改用 `! grep -qF '[BLOCKER]'`（`-F` 固定字符串，零歧义）。

**S3. Fix-6：PAUSED 恢复后重试计数策略**
> 来源：plan-eng-review（建议级）
>
> 当前"retry 计数不清零"。若 PAUSED 原因正是 retry 耗尽（如 P2 retry=3/3），恢复后立即再次超限 → 再次 PAUSED → 人工介入无意义。建议恢复后的首次重试不计入上限，或增加 `recovery_bonus: 1`。

**S4. Fix-5：validation-report.md 标签回溯修改的历史准确性问题**
> 来源：plan-eng-review（建议级）
>
> `validation-report.md` 是特定验证运行的事实性报告。若验证在 v3 时期执行，全文 v3→v4 会失去历史上下文。建议区分处理：规格文档改 v3→v4，事实性报告保留原始标签或加注释。

**S5. Fix-1 缺少配套测试**
> 来源：plan-eng-review（建议级）
>
> `check-tdd-red.sh` 应覆盖：纯 assertion failure、纯 collection error、混合 failure+error、全绿、pytest 崩溃无输出、带颜色输出等 6 个场景。

---

### 可忽略

无。

---

### 专家组共识

以下意见两位专家一致同意：

| # | 共识项 | 纪要 |
|---|--------|------|
| C1 | Fix-1 必须做 | 唯一实操阻塞项，P3 gate 依赖的脚本不存在 |
| C2 | Fix-2 方向正确 | dispatch-protocol.md:293 "P7 gate"→"P8 gate"，两文档需对齐 |
| C3 | Fix-3 方向正确但命令需微调 | 从 `grep -L` 改为 `! grep -qF '[BLOCKER]'` |
| C4 | Fix-7 无争议 | P8 gate 补注 packages 交叉引用 |
| C5 | Fix-11 顺手清理 | 删除 loop-orchestration.md 中已实现的改进项 |
| C6 | 第 3 批（Fix-8/9/10/12）不应原样实施 | 两位专家基于不同理由得出相同结论——plan-eng 认为 Fix-12 逻辑有 bug，plan-ceo 认为全批过度设计 |

---

### 专家组分歧（交用户判断）

**分歧 1：Fix-4 — 是"不实施"还是"做"？**

| 专家 | 立场 | 理由 |
|------|------|------|
| plan-eng | ❌ 不实施 | P4 gate 不依赖 P3，Fix-4 基于错误诊断。P3 跳过场景在现有状态机中天然正确运行 |
| plan-ceo | ✅ 实施 | P3 跳过是高频场景（小任务），不定义 P4 替代门槛确实走不通 |

> 需用户裁决。plan-eng 的观点有状态机代码支撑（`state-machine.md:73` vs `:77` 确实未交叉依赖）。plan-ceo 的担忧（P3 跳过时盲区）是否已被现有状态机解决？建议用户亲自在 state-machine.md 验证 P4 gate 定义后裁决。

**分歧 2：Fix-8/9/10 — 是"正确可提交"还是"过度设计应搁置"？**

| 专家 | 立场 | 理由 |
|------|------|------|
| plan-eng | ✅ 正确可提交 | SCOPE+ 矩阵化、BDD 可量化门槛、P7 覆盖度计数都是合理的机制化改进 |
| plan-ceo | ❌ 过度设计搁置 | 为尚未发生过的失败模式增加规则，增加长期认知负担。应在 5-10 个真实任务后自然总结规律 |

> 需用户裁决。这是"坐房间里设计规则" vs "跑任务后自然出现规则"的经典张力。plan-eng 的立场是"有比没有好"，plan-ceo 的立场是"多一条规则多一份负担，只加被验证过的"。

**分歧 3：Fix-5（v3→v4 标签）— 是"独立追踪"还是"顺手改"？**

| 专家 | 立场 | 理由 |
|------|------|------|
| plan-eng | 纳入修复 | 8 处标签不一致需系统修复（但对 validation-report.md 建议保留历史标签） |
| plan-ceo | 降级为顺手改 | 纯 cosmetic，投入产出比低（0 行为改变），不单独追踪 |

> 建议：采纳 plan-ceo 的"顺手改"策略，但接受 plan-eng 对 validation-report.md 的保留建议。

---

## 修正后的执行建议

整合两位专家意见，建议如下执行路径：

```
第 1 批（阻塞修复 — 立即做）：
  Fix-1 + Fix-2 + Fix-3（改用 grep -qF）+ Fix-11（顺手）
  → commit "fix(wf-v4): create check-tdd-red.sh, fix P7 grep, unify summary trigger point"

第 2 批（逻辑缺口 — 需用户裁决 Fix-4 后再定）：
  待裁决项：Fix-4（分歧 1）
  无争议项：Fix-6 + Fix-7
  顺手项：Fix-5（validation-report.md 保留原标签，其他改 v3→v4）
  → 如 Fix-4 不做：commit "fix(wf-v4): PAUSED recovery, P8 gate cross-ref"
  → 如 Fix-4 做：   commit "fix(wf-v4): P3-skip P4 gate, PAUSED recovery, P8 gate cross-ref"

缺项增补：
  Fix-13（新增）— 状态机阶段跳过转移规则
  Fix-1 配套测试 — scripts/test-check-tdd-red.sh

搁置（不 commit，记录到 improvement-backlog.md）：
  Fix-8, Fix-9, Fix-10, Fix-12（待实战数据积累后重新评估）
```

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 整体 | 5/10 | 修复方向大体正确，但 1/3 的项（Fix-4/12/缺失项）存在技术错误或遗漏，1/3 的项（第 3 批）为过度设计 |
| 完整性 | 5/10 | 缺少状态机跳过转移规则和脚本测试，遗漏回归风险说明 |
| 优先级判断 | 5/10 | 第 1/2 批的阻塞识别基本准确，但将 P2 机制增强与 P0 阻塞项并列拉平了优先级 |
| 可执行性 | 6/10 | 每批独立 commit 合理，修正后 7 项可落地 |

