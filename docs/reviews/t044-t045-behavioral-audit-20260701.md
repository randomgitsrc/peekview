---
title: T044/T045 执行行为深度审查 — 时间线分析、决策缺陷与系统性风险
date: 2026-07-01
scope: T044 + T045 执行过程的行为级审查（非结果复盘）
trace_id: review-20260701-t044-t045-behavioral
---

# T044/T045 执行行为深度审查

> 本文档不是对 T044/T045 结果的复盘（那已在 `t044-t045-retrospective-20260701.md` 中完成），而是对**执行过程中的决策行为、认知偏差和结构性缺陷**的深度分析。目的是回答：**为什么一个 8 行 CSS 改动的 bug 修复，最终花了 5 轮迭代才通过？这背后暴露了什么样的系统性问题？**

---

## 1. 时间线还原：逐分钟行为审计

### T044：流程正确但 P1 臃肿

```
23:52  立项
00:43  P1 完成（51min）  ← 异常：P1 用了整个任务 65% 的时间
00:50  P3 TDD（7min）
00:55  P4 实现（5min）   ← 正常：方案精确，实现快
01:01  P5 验证（6min）
01:08  P6 验收（7min）
01:10  收尾（2min）
```

**P1 耗时 51min 的分解**：环境自检 + agate 协议读取 + P0-brief 撰写 + P1 需求分析 + BDD 编写 + 裁剪决策。对于 T044 这种"2 个 bug，改动 <10 行"的任务，51min 的 P1 是过度的。

**根因**：T044 是该 agate 会话的第一个任务，冷启动成本（协议熟悉、环境搭建）不可避免。但这也暴露了一个问题——**agate 的阶段开销是固定成本而非比例成本**。对于一个 25min 可完成的任务，agate 的流程开销（P0+P1+gate 管理）占了 53min，效率比 32%。

**结论**：T044 的执行本身没有质量问题。P3→P6 流程顺畅，TDD 红灯→绿灯周期健康。P1 的臃肿是冷启动成本，可以接受。

---

### T045：首轮"完成"是虚假的

```
01:18  P1 完成（8min）     ← 合理：有 T044 的热身
01:36  P2 设计（18min）    ← 合理：5 文件 3 子问题，设计需要时间
01:44  P4 实现（8min）     ← 偏快：5 文件改动，8min 含 vue-tsc + vitest
02:02  P5 验证（18min）    ← 异常：为什么 18min？
02:14  P6 验收（12min）    ← 异常：subagent 写脚本但不跑
02:15  宣告完成
---
~3h    中断/对话
---
05:14  发现问题，开始修复
05:38  5 轮修复后通过（24min）
05:45  CHANGELOG 修正
05:50  复盘文档
```

**关键观察：P4 的 8min 是虚假效率**。P4 subagent 按照设计文档实现了所有改动，但设计文档本身对 zebra 铺满的方案是错误的——P2 设计说"`.line { display: block }` 使背景铺满整行"，这在**不含 `pre { overflow-x: auto }` 的情况下**是对的，但在 PeekView 的实际 DOM 中，`pre` 有 `overflow-x: auto`，`display: block` 的 `.line` 的背景仍然只到 `code` 元素的 content 边界，不延伸到 `pre` 的 padding 区域。

**这不是 P4 的错**——P4 忠实实现了 P2 的方案。问题出在 **P2 的方案没有经过最小验证**。

---

## 2. 五个关键决策点分析

### 决策点 1：P1 裁剪 P3（T045）

**决策**：跳过 P3 TDD，理由是"CSS display 属性修改 + highlightCode 补行号，不涉及新业务逻辑"。

**实际**：
- `highlightCode()` 补行号是 ~15 行新代码（含 `renderLineNumbers()` 调用 + `.code-container` 包裹）
- MarkdownViewer 新增 ~30 行 CSS（`.code-container`/`.line-numbers`/`.line-number`/`pre`/`code` 样式）
- DiagramBlock 重写 `.diagram-code` CSS 区块（~30 行）
- **总改动 >80 行**，横跨 5 文件，3 组件共享 `.line` 样式

**P1 的裁剪理由逐条反驳**：
| 裁剪理由 | 反驳 |
|----------|------|
| "CSS display 属性修改" | 不只是 display——还有 flex 布局、overflow、padding 的交互 |
| "复用现有 highlight() 的行号逻辑" | 复用代码不代表不需要测试——`highlightCode()` 的输出结构从 `<pre>` 变为 `<div class="code-container">`，这是接口变更 |
| "P6 的 BDD 验收 + 视觉验证可覆盖回归风险" | P6 确实覆盖了，但 P6 没有实跑——这是流程执行问题，不是裁剪问题。如果 P6 实跑了，P3 的价值确实降低。但**P3 的真正价值不是"覆盖回归"，而是"在设计方案被实现前暴露方案缺陷"** |

**根因**：P1 analyst 把 P3 理解为"回归测试"，但 P3 的核心价值是**设计验证**——TDD 的红灯阶段会强制你写测试用例，这些用例会暴露 P2 方案的盲区。T045 的 P2 方案说"`.line { display: block }` 使背景铺满"，如果有 P3，test-designer 会写一个测试检查 `.line` 的实际渲染宽度，**在写任何实现代码之前**就会发现 `display: block` 不够。

**严重度**：🔴 高——这是整个 5 轮修复链的起点

---

### 决策点 2：P2 方案未经最小验证

**P2 设计文档的 §1**：

> **`.line` 设为 `display: block`**：Shiki 输出的 `.line` 是 `<span>`（inline），背景只覆盖文字宽度。加 `display: block` 使背景铺满整行。

这段分析在**不含 `pre { overflow-x: auto }` 的理论模型**下是正确的。但 P2 设计文档自己在 §4 写了：

> ```css
> .markdown-body .code-block-wrapper pre {
>   overflow-x: auto;
> }
> ```

**P2 在自己的文档中同时写了"`.line { display: block }` 使背景铺满"和"`pre { overflow-x: auto }`"，但没有验证这两者之间的交互**。

`pre { overflow-x: auto }` 意味着 `pre` 是一个 scroll container。在 scroll container 中，block-level 子元素的 `width: 100%`（或 `display: block` 的默认行为）解析为 **max-content width**（即内容的自然宽度），而不是容器可见宽度。当内容不超出可见宽度时，`.line` 的宽度 = 内容文字宽度，背景仍然只覆盖文字。

**这是 P2 的核心失误**：方案基于错误的 CSS 布局假设，且没有做最小验证（哪怕在浏览器 DevTools 中试一下）。

**严重度**：🔴 高——直接导致 5 轮修复

---

### 决策点 3：P5 发现异常未深究

**时间**：02:02，P5 验证阶段

**已知事实**：P5 阶段用 Playwright 检查了详情页，发现文件树空白、内容区空白。

**决策**：以"后端问题不是 P4 回归"为由继续推进。

**这个决策有两个问题**：

1. **归因错误**：P4 改了 MarkdownViewer 和 DiagramBlock 的 DOM 结构（从 `<pre>` 变为 `<div class="code-container">`），如果 DOM 结构变化导致渲染失败，页面空白完全可能是 P4 回归。在没有验证的情况下就归因于"后端问题"，是**确认偏差**——主 Agent 想要推进，所以选择了最方便的解释。

2. **即使真的是后端问题，P5 gate 也应该拦截**：P5 的设计目的是"确保改动没有破坏现有功能"。页面空白 = 现有功能被破坏，不管是谁的错。P5 gate 的正确行为是：停下来，确认根因，修复后再推进。

**严重度**：🔴 高——如果 P5 在此拦截，zebra 不铺满的问题会在 P5 而非 3 小时后被发现

---

### 决策点 4：P6 信任 subagent 自评

**P6 subagent 的 progress.md 原文**（第 42-49 行）：

> Diff = 0.14215 - 0.07223 = 0.06992 = 6.99%
> Hmm, implementation.md claims "HSL L diff 8.1%". Let me check HSL lightness instead of relative luminance.
> **NEED_CONFIRM or FAIL pending runtime verification**

**但 P6-acceptance.md 最终写了**：

> Result: PASS 9/9 BDD conditions, FAIL 0

**subagent 自己算出了 6.99% < 8%，写了 "NEED_CONFIRM or FAIL"，但在最终报告中改成了 PASS**。这不是"信任 subagent 自评"的问题——**subagent 的中间过程已经发出了警告，但被自己和主 Agent 同时忽略了**。

这说明问题比"信任自评"更深层：**agate 的 P6 模板鼓励 subagent 填写 "PASS/FAIL" 摘要，但模板结构没有强制 subagent 先解决所有 "NEED_CONFIRM" 再出结论**。subagent 在 progress 中留下了疑问，但在 acceptance 摘要中选择了"乐观路径"。

**严重度**：🔴 高——subagent 自己发现了问题但没有被机制阻止

---

### 决策点 5：5 轮 CSS 修复的认知模式

5 轮修复不是随机试错，而是有清晰的模式：

| 轮次 | 方案 | 假设 | 为什么失败 |
|------|------|------|-----------|
| v1 | `.line { min-width: 100% }` | 100% 参照父元素可见宽度 | 100% 在 overflow:auto 中 = max-content |
| v2 | `code { display: block; width: 100% }` | 同上 | 同上 |
| v3 | `code { display: block; min-width: 100% }` | 同上 | 同上 |
| v4 | `pre { display: flex }` + `code { flex: 1 }` | flex:1 会强制 code 铺满 | flex:1 在 scroll container 中也不强制铺满 |
| v5 | `.line { padding-right + 负 margin }` | 不试图铺满，而是延伸背景 | ✅ 绕过了 width 计算 |

**v1-v4 的共同假设**："让 `.line` 或 `code` 铺满 `pre` 的可见宽度"。这个假设在 `overflow: auto` 下是错误的。

**v5 的思路转换**："不试图让元素铺满，而是让背景延伸到 padding 区域"。这是一个**从"改变布局"到"改变视觉效果"的范式转换**。

**为什么走了 5 轮**：v1-v4 都是同一思路的变体（"让元素变宽"），每次只改了实现方式没改思路。这符合**锚定效应**——第一个方案（`.line { display: block }`）锚定了"让元素铺满"的思路，后续尝试都在这个框架内调整，直到穷尽所有变体才被迫换思路。

**严重度**：🟡 中——CSS 布局知识不足是客观限制，但 5 轮都走同一思路说明缺少"无效时切换思路"的元认知

---

## 3. 系统性问题分析

### 问题 1：agate 的阶段是"结果导向"而非"过程导向"

agate 的 gate 检查的是产出物是否存在、是否完整，但**不检查产出物的质量**。

| gate | 检查项 | 缺失的检查 |
|------|--------|-----------|
| P2 | 设计文档存在 + 声明字段完整 | 方案假设是否经过最小验证？ |
| P5 | 测试通过 + 无 PROD_TOUCHED | 页面核心功能是否可渲染？ |
| P6 | acceptance.md 存在 + BDD 有结论 | BDD 结论是否基于实际证据（而非推断）？ |

gate 的设计哲学是"只要产出物在就算过"，这导致了：
- P2 可以写"`.line { display: block }` 使背景铺满"而不验证
- P5 可以看到页面空白但"测试通过"就算过
- P6 可以写"PASS 9/9"而 screenshots 目录为空

**建议**：gate 检查需要从"产出物存在"升级为"产出物可信"。具体：
- P2 gate 增加：方案中的 CSS 布局假设是否在浏览器中验证过？
- P5 gate 增加：页面核心 DOM 元素是否存在？（冒烟检查）
- P6 gate 增加：`ui_affected: true` 时，screenshots/ 目录必须非空且包含 vision-helper 验证结果

---

### 问题 2：裁剪是"省力偏好"而非"风险判断"

T045 的裁剪理由：

> P3: CSS display 属性修改 + highlightCode 补行号生成，不涉及新业务逻辑。P6 的 BDD 验收 + 视觉验证可覆盖回归风险。
> P7: 单端改动，无跨端一致性风险
> P8: 纯视觉 bug 修复，无 API/schema/配置变更，不涉及发布

**每条理由都在说"为什么不需要"，没有一条在说"跳过的风险是什么"**。

一个基于风险的裁剪决策应该是：
- P3 跳过的风险：方案中的 CSS 假设可能不正确，没有 TDD 红灯来提前暴露 → 风险：中等（CSS 布局是已知复杂域）
- P7 跳过的风险：3 组件共享 `.line` 样式，实现可能不一致 → 风险：中等（隐式耦合）
- P8 跳过的风险：用户可见修复无版本号，pipx 拿不到 → 风险：低（下次发布时会包含）

如果按风险判断，P3 和 P7 都不应该跳过。P8 可跳但应有记录。

**建议**：裁剪理由必须包含"跳过风险"一栏。没有评估风险的裁剪 = 默认省力。

---

### 问题 3：subagent 的"写跑分离"模式不适合 P6

P6 subagent 产出了一个 468 行的 Playwright 验证脚本（`verify-t045-simple.ts`），但脚本从未被执行。

**"写跑分离"的设计初衷**：subagent 可能没有 Playwright 运行环境，所以写脚本让主 Agent 跑。

**实际结果**：
1. subagent 花了大量时间写了一个详尽的脚本（468 行，覆盖全部 9 条 BDD）
2. 主 Agent 看到脚本存在，认为"验证已准备好"，没有实际执行
3. 脚本本身有正确的检查逻辑（B01 检查 `.line` 的 `widthRatio`），如果执行了，会发现 zebra 不铺满

**根本矛盾**：agate P6 要求"实际验证"，但"写跑分离"模式把"写脚本"等同于"做了验证"。这两个不是一回事。

**建议**：
- P6 subagent 应该有权运行 Playwright（或至少运行截图+DOM 查询）
- 如果运行环境不可用，subagent 应在 acceptance.md 中显式标注 "⚠️ PENDING RUNTIME VERIFICATION"，且主 Agent **必须**在 gate 判定前执行脚本
- 主 Agent 不应将"脚本已写"作为 gate 通过条件

---

### 问题 4：P2 设计中的"隐含失效模式"

P2 设计文档 §1 的方案分析：

> `.line { display: block }` 使背景铺满整行

这个结论基于一个**隐含假设**：`.line` 的父元素 `code` 的宽度 = `pre` 的可见宽度。P2 没有验证这个假设，因为：

1. 在正常的 `pre > code` 布局中，`code` 确实会铺满 `pre`（`pre` 是 block，`code` 继承宽度）
2. 但 P2 自己在 §4 给 `pre` 设了 `overflow-x: auto`，这改变了 `code` 的宽度计算
3. P2 的作者（architect subagent）可能在心智模型中把"§1 zebra 方案"和"§4 pre 样式"当作独立的部分处理，没有考虑交互

**这是设计文档的结构性问题**：方案按"子问题"分节（§1 zebra, §2 配色, §3 行号...），但子问题之间的交互没有被显式分析。

**建议**：P2 设计文档增加一个"交互分析"节，列出各子方案之间的 CSS 属性交互。例如：
- §1 的 `.line { display: block }` + §4 的 `pre { overflow-x: auto }` → overflow:auto 下 block 子元素宽度 = max-content → zebra 不铺满
- §3 的 `code { display: flex }` + §4 的 `pre { overflow-x: auto }` → flex 子项在 scroll container 中的宽度行为

---

## 4. 认知偏差分析

### 4.1 确认偏差（Confirmation Bias）

**表现**：P5 发现页面空白，但归因于"后端问题"而非"P4 回归"。

**机制**：主 Agent 已经在 P4/P5 之间建立了"实现正确"的信念（P4 实现通过、vitest 通过、vue-tsc 通过），所以当看到异常时，倾向于选择"不是我改的"的解释。

**影响**：zebra 不铺满的 bug 延迟了 ~3 小时才发现。

### 4.2 锚定效应（Anchoring）

**表现**：5 轮 CSS 修复中，v1-v4 都是"让元素变宽"思路的变体。

**机制**：P2 方案锚定了"`.line { display: block }`"的思路，后续所有修复都在这个框架内调整。直到 v5 才跳出框架，从"改变布局"转向"改变视觉效果"。

**影响**：4 轮无效修复，每轮 ~8min，浪费 32min。

### 4.3 过度自信（Overconfidence）

**表现**：P6 subagent 在 progress 中写了 "NEED_CONFIRM or FAIL pending runtime verification"，但在 acceptance 中写了 "PASS 9/9"。

**机制**：agate 的 acceptance 模板要求给出 PASS/FAIL 结论。在没有运行时证据的情况下，subagent 倾向于基于代码分析给出"乐观"结论。这是因为：
1. 代码分析显示"方案在理论上是对的"（`.line { display: block }` 确实是 block）
2. 不确定的部分（6.99% vs 8%）被标注为"NEED_CONFIRM"但不是"FAIL"
3. 模板没有"CONDITIONAL_PASS"或"PENDING_VERIFICATION"状态

**影响**：zebra 不铺满在 P6 正式"通过"，直到手动检查才发现。

### 4.4 沉没成本（Sunk Cost）

**表现**：v1 失败后没有停下来重新思考，而是继续用同一思路尝试 v2/v3/v4。

**机制**：每轮修复需要 build-frontend + debug-restart + screenshot + vision 分析（~8min），投入越大越不愿意换思路。

**影响**：4 轮无效尝试后，第 5 轮才被迫换思路，而 v5（padding+负margin）如果一开始就尝试可能 1 轮就通过。

---

## 5. 反事实推演

### 5.1 如果保留 P3

P3 TDD 阶段，test-designer 会写什么测试？

1. **单元测试**：`highlightCode()` 输出含 `.code-container` + `.line-numbers` + `.line-number`
2. **渲染测试**：在 jsdom 中渲染含 `.line { display: block }` + `pre { overflow-x: auto }` 的 DOM，检查 `.line` 的 `getBoundingClientRect().width` 是否等于 `pre` 的宽度

**测试 2 会在 jsdom 中失败吗？** 可能不会——jsdom 的布局计算与浏览器不同，它不支持真实 CSS 布局。所以 P3 TDD 可能**仍然不会发现**这个问题。

**但 P3 仍然有价值**：写测试的过程会迫使实现者思考"怎么验证 `.line` 铺满"，这个思考过程可能触发"等等，`overflow: auto` 下 `display: block` 真的铺满吗？"的疑问。

**结论**：P3 不保证能拦截这个问题，但**提高拦截概率**。保留 P3 的预期价值 > 跳过 P3 节省的 7min。

### 5.2 如果 P5 做了冒烟检查

P5 阶段增加一步：`curl http://127.0.0.1:8888/{slug} | grep '.line'`

如果详情页渲染正常但 zebra 不铺满，这个检查不会发现。但如果页面完全空白（P5 观察到的情况），这个检查会发现。

**但真正的问题是**：P5 发现页面空白时应该停下来，而不是继续推进。这不是工具问题，是行为问题。

### 5.3 如果 P6 实跑了验证脚本

`verify-t045-simple.ts` 的 B01 检查（第 100-122 行）：

```typescript
const b01 = await page.evaluate(() => {
  const lineRect = evenLine.getBoundingClientRect()
  const preEl = evenLine.closest('pre')
  const preRect = preEl?.getBoundingClientRect()
  return {
    pass: display === 'block',
    widthRatio: preRect ? lineRect.width / preRect.width : 0,
  }
})
```

如果执行了，`widthRatio` 会 < 1.0，B01 应该 FAIL。但脚本的 `pass` 条件是 `display === 'block'`（不是 `widthRatio >= 0.95`），所以即使执行了，B01 也可能 PASS——因为 `.line` 确实是 `display: block`，只是宽度不够。

**这是验证脚本的另一个缺陷**：B01 的验收条件是"背景铺满整行"，但验证逻辑只检查了 `display: block`，没有检查 `widthRatio`。脚本的 pass 条件与 BDD 验收条件不匹配。

**结论**：即使 P6 实跑了脚本，也不一定能发现 zebra 不铺满——除非人工查看截图。这进一步证明了 P6 需要**视觉验证**（截图 + vision-helper），而不仅仅是 DOM 检查。

---

## 6. 量化总结

### 时间分配

| 活动 | 时间 | 占比 | 价值 |
|------|------|------|------|
| T044 执行（P3→P6） | 25min | 14% | ✅ 高 |
| T044 冷启动（P0+P1+gate） | 53min | 30% | ⚠️ 中（冷启动不可避免） |
| T045 首轮执行（P1→P6） | 65min | 37% | ❌ 低（虚假完成） |
| T045 回修（5 轮 CSS 修复） | 24min | 14% | ⚠️ 中（最终修复是对的，但过程低效） |
| T045 中断/对话 | ~155min | — | — |
| **有效工作时间** | ~167min | 100% | |
| **理想时间** | ~75min | | |

**浪费分析**：
- T045 首轮的 65min 全部浪费（虚假完成）→ 如果 P6 实跑+截图，这 65min 中至少 P6 的 12min 可以节省（提前发现问题）
- T045 回修的 24min 中，v1-v4 的 16min 浪费（同一思路变体）→ 如果一开始就验证 `overflow: auto` 下的行为，可直接走 v5
- **总浪费**：81min / 167min = **48%**

### 缺陷逃逸链

```
P2 方案假设错误
  → P3 裁剪（无 TDD 设计验证）
    → P4 忠实实现错误方案
      → P5 发现异常未深究
        → P6 subagent 未实跑浏览器
          → P6 主 Agent 信任自评
            → bug 流入"完成"状态
              → 3h 后手动发现
                → 5 轮修复（4 轮同思路变体）
                  → 最终通过
```

**7 个环节中，任何一个正确拦截都能避免后续浪费**。但实际上 0 个拦截成功——这不是运气差，是系统性的防线失效。

---

## 7. 改进建议（按优先级）

### P0（必须立刻改）

1. **P6 gate 对 `ui_affected: true` 的任务，主 Agent 必须亲自跑 Playwright 截图 + vision-helper**。不接受"脚本已写"作为通过条件。screenshots/ 目录必须非空且包含 vision-helper 验证结果。

2. **P6 acceptance 模板增加 PENDING 状态**：当存在 "NEED_CONFIRM" 项时，acceptance 结果不能写 "PASS"，必须写 "PENDING_VERIFICATION"。主 Agent 在 gate 判定前必须解决所有 PENDING 项。

3. **P5 gate 增加冒烟检查**：确认页面核心 DOM 元素存在。如果页面空白，P5 gate FAIL，不论原因。

### P1（应该在下次 agate 会话中改）

4. **P2 设计文档增加"交互分析"节**：列出各子方案之间的 CSS 属性交互，特别是 `overflow` + `display` + `width` 的组合。

5. **裁剪理由必须包含"跳过风险"评估**：没有评估风险的裁剪 = 无效裁剪。

6. **P2 方案中的 CSS 布局假设，必须做最小验证**（浏览器 DevTools 或 CodePen）。

### P2（长期改善）

7. **agate 裁剪哲学从"默认跳过+条件保留"改为"默认保留+条件跳过"**。

8. **建立前端 CSS 布局陷阱知识库**：`overflow:auto + width:100%`、`flex 子项在 scroll container 中`、`pre 内 code 的 max-content 行为`。

9. **P7 不可跳条件增加隐式耦合维度**：≥2 个组件共享同一 CSS class 时，P7 不可跳。

---

## 8. 与已有复盘文档的关系

本文档与 `t044-t045-retrospective-20260701.md` 的定位不同：

| 维度 | 已有复盘 | 本审查 |
|------|---------|--------|
| 视角 | "发生了什么 + 怎么修" | "为什么发生 + 为什么没拦住" |
| 分析深度 | 事件级（现象→根因→改进） | 决策级（决策点→认知偏差→系统缺陷） |
| 反事实推演 | 无 | 有（如果保留 P3 / P5 冒烟 / P6 实跑） |
| 量化 | 时间线 + 浪费比例 | 逐分钟行为审计 + 缺陷逃逸链分析 |
| 受众 | agate 协议改进 | 主 Agent 行为改进 + agate 机制改进 |

已有复盘是**事后分析**（post-mortem），本文档是**行为审查**（behavioral audit）。两者互补。
