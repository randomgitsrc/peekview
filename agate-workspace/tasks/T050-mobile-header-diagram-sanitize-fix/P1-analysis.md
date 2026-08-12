---
phase: P1
task_id: T050
task_name: T049 问题归零修复
type: analysis
trace_id: T050-P1-20260709
created: 2026-07-09
status: draft
parent: T050-P0-brief
data_source: mermaid-error-patterns.cjs (130 test cases, mermaid.parse() in Node.js)
---

# T050 P1: Mermaid 错误模式分析报告

## 数据来源

- **测试方法**: `mermaid.parse()` 在 Node.js 环境中执行（jsdom + DOMPurify polyfill）
- **测试用例**: 130 个，覆盖 7 大类错误模式
- **结果**: 75 PASS / 55 FAIL
- **脚本**: `frontend-v3/scripts/mermaid-error-patterns.cjs`

## 错误模式分类

### 类别 1: 关键字大小写 (17 FAIL, 0 PASS for wrong case)

**结论**: Mermaid 图表类型关键字**严格区分大小写**。首字母必须小写（camelCase 或全小写）。

| 错误写法 | 正确写法 | 错误类型 |
|----------|---------|---------|
| `gitgraph` | `gitGraph` | UnknownDiagramError |
| `Graph TD` | `graph TD` | UnknownDiagramError |
| `SEQUENCEDIAGRAM` | `sequenceDiagram` | UnknownDiagramError |
| `sequencediagram` | `sequenceDiagram` | UnknownDiagramError |
| `Flowchart LR` | `flowchart LR` | UnknownDiagramError |
| `ClassDiagram` | `classDiagram` | UnknownDiagramError |
| `ErDiagram` | `erDiagram` | UnknownDiagramError |
| `Gantt` | `gantt` | UnknownDiagramError |
| `Pie` | `pie` | UnknownDiagramError |
| `StateDiagram-v2` | `stateDiagram-v2` | UnknownDiagramError |
| `Journey` | `journey` | UnknownDiagramError |
| `Mindmap` | `mindmap` | UnknownDiagramError |
| `Timeline` | `timeline` | UnknownDiagramError |
| `Sankey-beta` | `sankey-beta` | UnknownDiagramError |
| `QuadrantChart` | `quadrantChart` | UnknownDiagramError |
| `Xychart-beta` | `xychart-beta` | UnknownDiagramError |
| `Block-beta` | `block-beta` | UnknownDiagramError |

**方向指示符也区分大小写**: `graph td` → Lexical error（应为 `graph TD`）

**可修复性**: ✅ 确定性修正——关键字映射表，安全无副作用

### 类别 2: 缺少换行 (11 FAIL)

**结论**: 图表类型关键字后必须换行；方向指示符与后续内容之间必须换行。

| 错误模式 | 修复 | 错误类型 |
|----------|------|---------|
| `graph TBsubgraph` | `graph TB\nsubgraph` | LexicalError |
| `graph TDsubgraph` | `graph TD\nsubgraph` | LexicalError |
| `graph LRsubgraph` | `graph LR\nsubgraph` | LexicalError |
| `graph RLsubgraph` | `graph RL\nsubgraph` | LexicalError |
| `graph BTsubgraph` | `graph BT\nsubgraph` | LexicalError |
| `flowchart TBsubgraph` | `flowchart TB\nsubgraph` | LexicalError |
| `flowchart LRsubgraph` | `flowchart LR\nsubgraph` | LexicalError |
| `sequenceDiagramA->>B` | `sequenceDiagram\nA->>B` | ParseError |
| `gitGraphcommit` | `gitGraph\ncommit` | ParseError |
| `graph TDA[B]` | `graph TD\nA[B]` | LexicalError |
| `flowchart LRA` | `flowchart LR\nA` | LexicalError |

**可修复性**: ✅ 确定性修正——正则匹配方向指示符后紧跟关键字/节点ID时插入换行

### 类别 3: 全角字符在语法位置 (5 FAIL)

**结论**: 全角字符在**语法位置**（节点形状定界符、箭头、冒号）会导致错误。但在**标签内容**（`[]` 内部）中完全正常。

| 错误模式 | 位置 | 修复 | 错误类型 |
|----------|------|------|---------|
| `A（text）` | 形状定界符 | `A(text)` | LexicalError |
| `A【text】` | 形状定界符 | `A[text]` | LexicalError |
| `A->>B：消息` | 冒号分隔符 | `A->>B:消息` | ParseError |
| `A → B` | 箭头 | `A --> B` | LexicalError |
| `A-->"B"` | 引号定界符 | `A-->"B"` | LexicalError |

**标签内全角字符全部 PASS**（25/25）:
- `A[数据（中文）]` ✅
- `A[数据【中文】]` ✅
- `A[数据，信息]` ✅
- `A[数据。信息]` ✅
- `A[范围～50万]` ✅
- `A[条件＝true]` ✅
- `A[《标题》]` ✅
- `A["中文"]` ✅
- `A['中文']` ✅
- ...等 25 种全角字符在标签内均 PASS

**可修复性**: ✅ 确定性修正——替换语法位置的全角符号为 ASCII 等价物

### 类别 4: 箭头语法 (9 FAIL)

**结论**: Mermaid 的 graph 和 sequenceDiagram 箭头语法不同，不能混用。

| 错误模式 | 上下文 | 修复 | 错误类型 |
|----------|--------|------|---------|
| `A ->> B` | graph | `A --> B` | ParseError |
| `A -->> B` | graph | `A -.-> B` | ParseError |
| `A -> B` | graph | `A --> B` | ParseError |
| `A => B` | graph | `A --> B` | LexicalError |
| `A -x> B` | graph | `A -x B` | ParseError |
| `A->>>B` | sequence | `A->>B` | ParseError |
| `A--->>B` | sequence | `A-->>B` | ParseError |

**注意**: `A ->> B` 在 graph 中 FAIL，但在 sequenceDiagram 中 PASS。当前 T049 的 `normalize-arrows` 规则把 ` ->> ` 替换为 ` -->> `，这在 graph 中仍然 FAIL（`-->>` 也不是有效的 graph 箭头）。

**可修复性**: ⚠️ 部分可修——需要区分 graph vs sequenceDiagram 上下文

### 类别 5: 结构性错误 (8 FAIL)

| 错误模式 | 可修复性 | 说明 |
|----------|---------|------|
| 缺少 `end` | ⚠️ 启发式 | 需要计数 subgraph/end 配对 |
| 多余 `end` | ⚠️ 启发式 | 同上 |
| `@startuml` in mermaid | ✅ 确定性 | 移除 PlantUML 标记 |
| 未闭合括号 `A[text with [bracket]` | ⚠️ 启发式 | 需要括号配对分析 |
| 未闭合圆括号 `A(text with (paren)` | ⚠️ 启发式 | 同上 |
| 空节点标签 `A[]` | ⚠️ 启发式 | 填充空格或移除 |
| 空图表 | ❌ 不可修 | 无内容可渲染 |
| null 字节 | ✅ 确定性 | 移除 null 字节 |

### 类别 6: 不需要修复的模式 (全部 PASS)

以下模式在 mermaid 中**正常工作**，不需要清洗规则：

- 全角字符在标签内（25 种）→ 全部 PASS
- 智能引号在标签内 → PASS
- HTML 标签在标签内（`<br/>`, `<b>`, `<div>`, `<span>`, `<em>`, `<i>`, `<a>`, `<img>`）→ 全部 PASS
- `<script>` 标签 → ParseError（mermaid 自身拒绝，不是 sanitizer 的职责）
- 空白变体（tab, CRLF, trailing spaces, BOM, extra blank lines）→ 全部 PASS
- Markdown 格式在标签内（`**bold**`, `*italic*`）→ PASS
- Unicode emoji → PASS
- `#quot;` 实体 → PASS
- `\n` 在标签内 → PASS

## 规则设计优先级

基于出现频率和可修复性：

| 优先级 | 规则 | 类型 | 覆盖 FAIL 数 |
|--------|------|------|-------------|
| P0 | 关键字大小写修正 | 确定性 | 17 |
| P0 | 缺换行修正（方向+关键字/节点） | 确定性 | 11 |
| P1 | 全角符号→ASCII（语法位置） | 确定性 | 5 |
| P1 | 箭头语法修正（区分 graph/sequence） | 确定性 | 9 |
| P2 | `@startuml` 移除 | 确定性 | 1 |
| P2 | null 字节移除 | 确定性 | 1 |
| P3 | subgraph/end 配对修正 | 启发式 | 2 |
| P3 | 未闭合括号修正 | 启发式 | 2 |

## PlantUML 和 SVG 分析

### PlantUML

PlantUML 渲染由后端服务处理（viz.js WASM 在前端运行），不在浏览器中解析。常见错误：
- 缺少 `@startuml`/`@enduml` → T049 已覆盖
- 全角冒号 `：` → 应替换为 ASCII `:`
- 全角箭头 `→` → 应替换为 `->`
- CRLF → T049 已覆盖（heuristic）

**需要补充**: 全角符号替换规则（与 mermaid 共享映射表）

### SVG

SVG 由 DOMPurify 处理，不经过 mermaid parser。常见错误：
- 未闭合标签 → T049 已覆盖
- 未引用属性值 → T049 已覆盖
- 全角引号 `""` → 应替换为 ASCII `""`
- 全角等号 `＝` → 应替换为 ASCII `=`

**需要补充**: 全角符号替换规则（与 mermaid 共享映射表）

## BDD 验收条件

### B-BDD-1: config_get 默认值一致性
- Given 未设置 diagram.sanitize_enabled
- When 执行 `peekview config get diagram.sanitize_enabled`
- Then 返回 `(not set, default: True)` 而非 `(not set)`

### B-BDD-2: 关键字大小写修正
- Given mermaid 代码以 `gitgraph` 开头
- When sanitize(code, 'mermaid')
- Then 首行变为 `gitGraph`

### B-BDD-3: 缺换行修正
- Given mermaid 代码含 `graph TBsubgraph`
- When sanitize(code, 'mermaid')
- Then 变为 `graph TB\nsubgraph`

### B-BDD-4: 全角符号修正（语法位置）
- Given mermaid 代码含 `A（text）--> B[text]`
- When sanitize(code, 'mermaid')
- Then 变为 `A(text)--> B[text]`

### B-BDD-5: 全角符号保留（标签位置）
- Given mermaid 代码含 `A[数据（中文）] --> B`
- When sanitize(code, 'mermaid')
- Then 标签内全角符号不变

### B-BDD-6: 箭头语法修正（graph 上下文）
- Given mermaid 代码含 `graph TD\n  A ->> B`
- When sanitize(code, 'mermaid')
- Then 变为 `graph TD\n  A --> B`

### B-BDD-7: 箭头语法保留（sequence 上下文）
- Given mermaid 代码含 `sequenceDiagram\n  A->>B: msg`
- When sanitize(code, 'mermaid')
- Then `->>` 保持不变

### B-BDD-8: @startuml 移除
- Given mermaid 代码以 `@startuml` 开头
- When sanitize(code, 'mermaid')
- Then `@startuml` 被移除

### B-BDD-9: null 字节移除
- Given mermaid 代码含 null 字节
- When sanitize(code, 'mermaid')
- Then null 字节被移除

### B-BDD-10: 全角符号修正（PlantUML）
- Given plantuml 代码含全角冒号 `：`
- When sanitize(code, 'plantuml')
- Then 变为 ASCII `:`

### B-BDD-11: 全角符号修正（SVG）
- Given svg 代码含全角引号 `""`
- When sanitize(code, 'svg')
- Then 变为 ASCII `""`

### C-BDD-1: 移动端 header 登录态布局
- Given 登录状态 + 移动端视口 (390×844)
- When 访问含多个 tag 的条目详情页
- Then header-tags 区域宽度 ≥ 视口宽度的 60%

### C-BDD-2: 移动端 header 非登录态布局
- Given 非登录状态 + 移动端视口
- When 访问含多个 tag 的条目详情页
- Then header-tags 区域正常显示，不被挤压
