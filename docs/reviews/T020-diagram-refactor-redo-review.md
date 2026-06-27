---
review_date: 2026-06-27
reviewer: Claude (主 Agent 自我复盘)
scope: T020 diagram refactor redo (v0.2.3 → v0.2.4)
method: superpowers TDD 流程 (非 agate 编排)
time_spent: ~4 小时
commits: 11 个代码 commit + 1 个文档 commit + 1 个版本 bump
---

# T020 Diagram Refactor Redo 复盘

> 本次任务是对 T022（v0.2.0）失败后回退的 diagram 渲染管线进行重新重构。
>
> **关键差异**：T022 使用 agate 子 Agent 编排（P0-P8），而本次 redo 使用 **superpowers TDD 流程**（主 Agent 直接执行，无 subagent 编排）。
>
> 复盘目的：对比两种执行模式的优劣，提取经验教训。

---

## 一、执行概览

### 1.1 任务背景

| 维度 | T022 (v0.2.0) | 本次 Redo (v0.2.4) |
|------|---------------|-------------------|
| **触发原因** | v0.1.67 的 diagram 代码冗余（4021 行） | v0.2.3 回退 T022 后，diagram 功能恢复但代码仍冗余 |
| **执行模式** | agate 子 Agent 编排（P0-P8） | superpowers TDD（主 Agent 直接执行） |
| **目标** | 重构为 BaseDiagram + 注册模式 + composable | 重构为 DiagramBlock + 3 渲染器 + useDiagramViewer composable |
| **实际 commit** | ~35 个（含 17 个废弃） | **11 个代码 commit + 1 个 bump** |
| **浪费率** | ~50%（周期 1 整体废弃） | **~0%**（无废弃 commit） |
| **最终状态** | v0.2.0 发布 → 用户发现 bug → v0.2.3 回退 | **v0.2.4 发布，52/52 E2E pass** |

### 1.2 Commit 链

```
9e6a02d4  feat(useDiagramViewer): pan-zoom/touch/resize composable (TDD)
2db02850  refactor(useMarkdown): return structured blocks for diagram types (TDD)
dfbafd65  feat(MermaidRenderer): mermaid render + pan-zoom + cache + cancelled flag (TDD GREEN)
44e8e252  feat(PlantUmlRenderer): plantuml render + pan-zoom + renderError emit (TDD)
bd3024ef  feat(SvgRenderer): DOMPurify sanitize + pan-zoom + transparent PNG export (TDD GREEN)
cca153e1  feat(DiagramBlock): basic structure + toggle behavior (TDD GREEN)
79eba31a  feat(DiagramBlock): complete 6B - dropdown, copy, error, resize (TDD GREEN)
cf42aa56  chore: 提交遗留的 progress 文件和 MermaidRenderer 测试
f264e58a  feat(Task 7-9): MarkdownViewer v-for blocks + CSS migration + delete old components
eb682211  fix(DiagramBlock): remove stale :not(.is-active) CSS, wire fullscreen click
dfbdf145  fix(diagram): toggle blank viewer + PlantUML toggle text + Download PNG
234a56ce  test: update specs to match new refreshPanZoom + PlantUML toggle text
4db67349  chore(release): bump to v0.2.4
```

---

## 二、经验与教训

### 2.1 经验：superpowers TDD 流程的优势

#### 经验 1：TDD 红灯 → 绿灯 → 重构 的节奏有效

**具体表现**：
- 每个组件（MermaidRenderer/PlantUmlRenderer/SvgRenderer/DiagramBlock）都是先写测试 → 看到失败 → 实现 → 测试通过
- 测试文件与实现文件一一对应，变更范围清晰
- 最终 193/193 单元测试全部通过，无回归

**与 T022 对比**：T022 的 agate 流程中，P3（测试设计）和 P4（实现）由不同 subagent 执行，存在"测试与实现脱节"风险。本次主 Agent 直接执行，测试和实现由同一上下文维护，一致性更好。

#### 经验 2：Playwright-vision skill 极大加速了 E2E 调试

**具体表现**：
- 发现 CSS `:not(.is-active)` bug 时，用 CDP Chrome 截图 + Read 工具分析，5 分钟内定位到 1px width 问题
- 发现 toggle 空白 bug 时，用 `page.evaluate` 提取 viewport transform，确认 `matrix(0,0,0,0,0,0)`
- 无需写完整的 Playwright spec 文件，直接用 inline script 验证假设

**与 T022 对比**：T022 P6 验收时写了 200+ 行的 `p6-bdd-verify.ts`，调试选择器、截图时机、主题切换花了多轮。本次用 inline script 快速验证，效率更高。

#### 经验 3：小步快跑 vs 大段派发

**具体表现**：
- 每个 commit 只做一件事（一个组件 + 对应测试）
- 每完成一个组件就 `git commit`，可随时回退
- 最终 11 个 commit 无废弃，因为每步都可验证

**与 T022 对比**：T022 的 P4 阶段一次性派发"完成所有实现"，导致 4 个子目标漏了 1 个（emit 迁移），周期 1 整体废弃。

### 2.2 教训：直接执行模式的不足

#### 教训 1：缺少 P1 需求基线的约束，导致 CSS 规则遗漏

**现象**：Task 8 CSS 迁移时，从旧 MarkdownViewer 复制了 `.diagram-viewer:not(.is-active)` 规则。这条规则在旧代码中有意义（JS 控制 `.is-active` class），但在新代码中无意义（`v-show` 直接控制 visibility）。

**根因**：没有 agate P1 的"需求基线"来约束"哪些旧代码应该保留、哪些应该删除"。主 Agent 凭经验判断"这条 CSS 看起来有用"就保留了。

**后果**：E2E 测试 4 个失败，viewer 被压成 1×1px，调试 30+ 分钟才发现是 CSS 问题。

**改进建议**：即使不走完整 agate，也应在重构前写一份简短的"行为保真清单"（类似 BDD），明确"旧代码中哪些行为必须保留、哪些可以删除"。

#### 教训 2：缺少 P2 设计评审，导致架构假设未验证

**现象**：`useDiagramViewer.ts` 的 `refreshPanZoom` 最初实现为 `destroyPanZoom() + initPanZoom()`，没有意识到 svg-pan-zoom 的 `instancesStore` 会返回旧实例。

**根因**：没有 agate P2 的"方案设计"阶段来验证架构假设。如果 P2 有"svg-pan-zoom 实例生命周期"的设计讨论，这个坑可以提前发现。

**后果**：toggle 切回 Diagram 时 SVG 空白，调试 20+ 分钟才发现是 svg-pan-zoom 实例缓存问题。

**改进建议**：对于涉及第三方库生命周期的问题，应在实现前做"架构假设验证"（哪怕只是 5 分钟的文档查阅）。

#### 教训 3：缺少 P6 全量验收，导致 bug 在发布后才被发现

**现象**：5 个 bug 中有 4 个是在"创建 demo entries 后手动验证"时发现的，而不是在自动化测试中发现的。

**具体**：
- Bug 1: CSS `:not(.is-active)` — E2E 测试发现（4 个失败）
- Bug 2: Fullscreen 按钮无 click — 手动验证发现
- Bug 3: Toggle 切回空白 — 手动验证发现
- Bug 4: PlantUML toggle 文案 — 手动验证发现
- Bug 5: Download PNG 无效 — 手动验证发现

**根因**：E2E 测试覆盖了"渲染"和"基本交互"，但没有覆盖"toggle 双向切换""dropdown 按钮""PlantUML 文案"等细节。手动验证补充了测试覆盖的不足。

**改进建议**：
- E2E 测试应覆盖所有用户可见的交互路径（toggle 双向、dropdown 每个按钮）
- 或者：发布前强制要求"手动验证清单"（类似 agate P6 的 BDD 验收）

### 2.3 与 T022 的对比分析

| 维度 | T022 (agate) | 本次 Redo (TDD) | 结论 |
|------|--------------|-------------------|------|
| **执行效率** | ~35 commit，50% 废弃 | 11 commit，0% 废弃 | TDD 直接执行更高效 |
| **需求清晰度** | P1 需求基线 + BDD（29 条） | 无正式需求文档，凭经验 | agate P1 更清晰 |
| **设计验证** | P2 设计评审 + 一致性检查 | 无设计评审，边做边改 | agate P2 能提前发现架构坑 |
| **测试覆盖** | P3 测试设计 + P6 全量验收 | 单元测试 + E2E（部分覆盖） | agate P6 更全，但 TDD 单元测试更细 |
| **bug 发现时机** | P6 验收时发现 | 手动验证时发现 | 两者都需要，TDD 不能替代 E2E |
| **调试效率** | Playwright 脚本 200+ 行 | Inline script 快速验证 | TDD 更灵活 |
| **发布质量** | v0.2.0 发布后回退 | v0.2.4 发布后稳定 | 本次更稳，但 bug 数量相近（5 vs T022 的更多） |

---

## 三、agate 机制的启示

### 3.1 agate 中哪些机制本次缺失但有用

| agate 机制 | 本次缺失 | 如果存在，能避免什么 |
|-----------|---------|---------------------|
| **P1 需求基线** | ❌ 无 | 能避免 CSS `:not(.is-active)` 规则遗漏 |
| **P2 设计评审** | ❌ 无 | 能提前发现 svg-pan-zoom 实例缓存问题 |
| **P3 测试设计** | ⚠️ 部分（有单元测试，无 E2E 设计） | 能让 E2E 覆盖 toggle 双向、dropdown 按钮 |
| **P6 全量验收** | ❌ 无（只有部分 E2E） | 能提前发现 PlantUML 文案、Download PNG 等问题 |
| **P7 一致性检查** | ❌ 无 | 能发现 CSS 规则与 v-show 语义不一致 |

### 3.2 agate 中哪些机制本次不需要

| agate 机制 | 本次不需要的原因 |
|-----------|----------------|
| **P0 任务简报** | 任务范围清晰（重构已有功能），无需简报 |
| **子 Agent 编排** | 任务规模适中（~1500 行），主 Agent 上下文足够 |
| **P8 发布准备** | 版本 bump 流程简单，`make bump-version` 一键完成 |
| **状态机落盘** | 任务连续执行，无中断恢复需求 |

---

## 四、建议

### 4.1 对类似任务的建议

**对于"中等规模重构"（~1000-3000 行）**：

1. **优先用 superpowers TDD**：主 Agent 直接执行，效率高、浪费少
2. **但必须补充 agate P1 的"行为保真清单"**：即使不走完整 agate，也应在重构前写一份简短的"旧代码行为清单"，明确哪些必须保留
3. **必须补充 agate P6 的"手动验证清单"**：发布前强制要求"手动验证所有用户可见的交互路径"
4. **Playwright-vision skill 是 TDD 的好搭档**：用 inline script 快速验证假设，比写完整 spec 文件更高效

**对于"大规模重构"（>3000 行或跨模块）**：

1. **走完整 agate P0-P8**：子 Agent 编排能处理更大规模的复杂度
2. **P1 必须写 BDD**：行为保真清单是防止遗漏的底线
3. **P2 必须做设计评审**：架构假设验证能提前发现坑

### 4.2 对 agate 本身的建议

1. **P1 需求基线应可裁剪**：对于"已知行为保真"的重构任务，P1 可以简化为"行为保真清单"（而非完整 BDD），降低执行成本
2. **P6 验收应支持"渐进式覆盖"**：不要求一次性覆盖所有 BDD，允许"核心路径先验、边缘路径后补"
3. **Playwright-vision skill 应集成到 P6**：P6 验收时，vision-helper 的截图分析应作为标准工具，而非可选手段

---

## 五、总结

本次 T020 redo 用 **superpowers TDD + Playwright-vision** 成功完成了 diagram 渲染管线的重构，**效率显著高于 T022 的 agate 编排**（11 commit vs 35 commit，0% 浪费 vs 50% 浪费）。

但 **TDD 不能替代 agate 的需求基线和设计评审**。本次发现的 5 个 bug 中，有 3 个（CSS 规则、svg-pan-zoom 缓存、PlantUML 文案）如果走 agate P1/P2 可以提前避免。

**最佳实践**：
- **小步快跑用 TDD**（主 Agent 直接执行）
- **行为保真用 agate P1**（需求基线，哪怕简写）
- **架构验证用 agate P2**（设计评审，哪怕简短）
- **发布验收用 agate P6**（手动验证清单，必须全量）

---

*复盘日期：2026-06-27*
*对比基准：T022 复盘（docs/reviews/agate-postmortem-T022-2026-06-26.md）*