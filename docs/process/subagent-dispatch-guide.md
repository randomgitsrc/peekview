# OpenCode Subagent 派发指南

> 在 OpenCode 上正确编排 subagent 的操作规范。
> 基于 T020 diagram 重构实战经验 + agate context 机制调研。

## 为什么要这份指南

OpenCode 的 subagent 有两个结构性约束（无法在协议层消除）：

1. **SSE idle timeout**：subagent 推理间隙可能被截断，导致空返回
2. **压缩摘要注入**：父 session 越长，注入子 session 的噪音越多，角色隔离越差

但 subagent 仍然可用——关键在于**控制任务粒度和 prompt 结构**。T020 实战验证了：粒度正确的 subagent 100% 成功，粒度错误的 subagent 100% 空返回。

## 诊断：什么样的任务会失败

### T020 实测数据

| 任务 | 粒度 | 结果 |
|------|------|------|
| useDiagramViewer（单文件，纯提取逻辑） | 小 | ✅ |
| MermaidRenderer 测试（只写测试） | 小 | ✅ |
| MermaidRenderer 实现（有测试做参考） | 小 | ✅ |
| PlantUml/Svg Renderer（有 Mermaid 做模板） | 小 | ✅ |
| useMarkdown blocks（6 个子任务挤一起） | 大 | ❌ 空返回 |
| DiagramBlock 完整版（5 个行为） | 大 | ❌ 连续 3 次空返回 |

### 成功/失败的分界线

**成功条件（全部满足）**：
- 产出 ≤ 1 个文件
- 产出行数 ≤ 300 行
- prompt 步骤 ≤ 8 个
- 有参考模板（"基于 X 文件简化"）

**失败信号（任一命中）**：
- 要同时写测试 + 实现 + 类型定义
- 要理解"为什么"而不是只"做什么"
- prompt 里出现"参考 spec §3.5"（依赖对话历史）
- 一个 prompt 里有 5+ 个"步骤"

## 四条铁律

### 铁律 1：一个 subagent 只产出一个文件

**不要**：一个 subagent 同时写 `types/index.ts` + `useMarkdown.ts` + 两个测试文件

**要**：
- subagent A：写 `types/index.ts`（类型定义）→ commit
- subagent B：写 `useMarkdown.blocks.spec.ts`（测试）→ commit
- subagent C：改 `useMarkdown.ts`（实现）→ commit

### 铁律 2：测试和实现分开派发

TDD 的 RED 和 GREEN 是两个 subagent：

```
subagent 1（RED）：只写测试文件 → 跑测试确认失败 → commit
       ↓
主 Agent 验证：测试确实失败，失败原因是"文件不存在"
       ↓
subagent 2（GREEN）：读测试文件，写实现让测试通过 → commit
```

好处：subagent 2 的任务极其明确——"让这个测试通过"，不需要理解"为什么"。

### 铁律 3：prompt 自包含，不引用对话历史

subagent 拿到的 context 包含父 session 的压缩摘要，但摘要可能不完整或噪音多。prompt 必须自包含全部信息。

**不要**：
```
按 spec §3.5 的 R1-R5 风险对策实现 MermaidRenderer。
```

**要**：
```
## 上下文（读这些文件，不需要其他）
- frontend-v3/src/components/MermaidDiagram.vue（v0.2.3 实现，复刻行为）
- frontend-v3/src/composables/useDiagramViewer.ts（Task 2 创建的 composable）

## 任务
创建 frontend-v3/src/components/renderers/MermaidRenderer.vue

## 具体要求
1. Props: code: string, theme: "dark" | "light"
2. 模块级 mermaidCache = new Map<string, string>()，key: ${theme}-${code}
3. cancelled = ref(false)，onUnmounted 设 true
...
```

### 铁律 4：每步 commit，progress 落盘

subagent 空返回后，主 Agent 需要知道它做到哪了。两个手段：

**手段 1：每完成一个文件就 commit**
```
## 交付规范
1. 创建测试文件 → git add + commit "test: ..."
2. 跑测试确认失败
3. 创建实现文件 → git add + commit "feat: ..."
4. 跑测试确认通过
5. 跑类型检查
```

即使 subagent 在第 3 步空返回，`git log` 能看到第 1 步的 commit，主 Agent 从断点继续。

**手段 2：progress 文件**

prompt 里要求 subagent 写 progress 文件（验证有效——agate 的空返回根因分析证实"落盘指令"能从空返回变为完整返回）：

```
## 进度跟踪
每完成一步，更新 docs/superpowers/plans/.progress/task-{N}.md：

## Task {N}: {名称}
- [x] 步骤 1: 写测试
- [x] 步骤 2: 跑测试确认失败
- [ ] 步骤 3: 写实现
- [ ] 步骤 4: 跑测试确认通过
- [ ] 步骤 5: commit
```

**注意**：progress 文件用于**监控**，不用于 **gate 判定**。gate 判定仍由主 Agent 亲自跑命令（铁律 C7）。

## Prompt 模板

每个 subagent 的 prompt 用以下结构：

```markdown
## 任务
{一句话描述：做什么，产出什么文件}

## 上下文（读这些文件，不需要其他）
- {文件路径}（{为什么读它}）
- {文件路径}（{为什么读它}）

## 具体要求
1. {要求 1}
2. {要求 2}
...

## 约束
- 前端测试: cd frontend-v3 && ./node_modules/.bin/vitest run（不是 npm run test）
- 类型检查: cd frontend-v3 && npx vue-tsc --noEmit
- 不加注释
- 严禁 pip3 install --break-system-packages -e .

## 交付
1. {产出文件}
2. 跑测试确认 {预期结果}
3. git add + commit "{commit message}"

## 进度
每完成一步，更新 docs/superpowers/plans/.progress/task-{N}.md
```

## 派发决策流程

```
任务来了
  │
  ├── 产出 ≤ 1 文件 且 步骤 ≤ 8？
  │     ├── 是 → 派 1 个 subagent
  │     └── 否 → 拆分
  │
  ├── 拆分后，每个子任务有参考模板？
  │     ├── 有 → 按依赖顺序串行派发
  │     └── 无 → 先派 1 个做"模板"，后续基于它简化
  │
  ├── 是 TDD 任务？
  │     ├── 是 → RED subagent → 验证失败 → GREEN subagent
  │     └── 否 → 直接派
  │
  └── 有无并行机会？
        ├── 子任务互相独立 → 并行派发
        └── 有依赖 → 串行
```

## 失败恢复流程

subagent 空返回后，主 Agent 执行：

```
1. git log --oneline -5
   → 看最近的 commit，判断 subagent 做到哪了

2. git status --short
   → 看有没有未提交的改动（subagent 可能改了文件但没 commit）

3. ls docs/superpowers/plans/.progress/task-{N}.md
   → 看 progress 文件是否存在

4. 根据断点决定：
   → 完全没开始：重新派发（可能要拆小）
   → 做了一半：从断点派发续做
   → 做完但没 commit：主 Agent 亲自验证 + commit
```

## T020 实战案例

### 成功案例：3 个渲染器并行

```
MermaidRenderer（第一个，从零写）
  ↓ 提供模板
PlantUmlRenderer + SvgRenderer（并行，基于 Mermaid 简化）
  ↓ 两个都成功
```

prompt 关键句："读 `MermaidRenderer.vue`，基于它简化：移除 touch/resize，用 usePlantUML 替代 useMermaid"。

### 失败案例：DiagramBlock 完整版

prompt 包含 5 个行为（toggle + dropdown + copy + error + resize），每个都要根据 `block.lang` 分支处理。subagent 要同时理解 5 套行为差异 + 模板结构 + 事件处理 → 推理量过大 → 空返回。

**修复方式**：拆成 6A（header + toggle）+ 6B（dropdown + copy + error + resize）。6A 的 prompt 只描述 toggle 的 3 种行为差异，subagent 一次成功。

## 什么时候不该用 subagent

以下场景主 Agent 直接做更高效：

- **读代码做分析**（评审、调研）——主 Agent 有完整 context
- **单行修复**（改个变量名、修个 bug）——派发开销 > 收益
- **需要跨文件理解**（如 CSS 迁移要同时看 3 个组件）——subagent context 不够
- **Playwright 验证**——需要实时交互

## 什么时候必须用 subagent

- **写新文件**（新组件、新 composable、新测试）——隔离 context，主 Agent 不被实现细节污染
- **并行独立任务**（3 个渲染器同时写）——节省墙钟时间
- **TDD 的 RED/GREEN 分离**——测试和实现的 context 隔离

## 与 agate 的关系

这份指南不替代 agate 的 dispatch-protocol，而是补充 agate 在 OpenCode 平台上的**操作性约束**：

| agate 规定 | 本指南补充 |
|-----------|-----------|
| 只传路径不传内容 | prompt 自包含，不引用对话历史 |
| gate 用客观 exit code | progress 文件用于监控（非 gate） |
| 状态落盘 | 每步 commit + progress 落盘 |
| — | 一个 subagent 只产出一个文件 |
| — | TDD 的 RED/GREEN 分开派发 |
| — | 有参考模板时成功率最高 |

agate 的阶段编排（P0-P8）是**宏观**工作流，本指南是**微观**的 subagent 派发操作规范。
