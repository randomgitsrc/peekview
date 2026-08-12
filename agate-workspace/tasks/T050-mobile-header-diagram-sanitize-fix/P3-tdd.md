---
phase: P3
task_id: T050
task_name: T049 问题归零修复
type: tdd
trace_id: T050-P3-20260709
created: 2026-07-09
status: draft
agent: test-designer
---

# T050 P3: TDD 测试设计

## 测试文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/tests/test_diagram_config.py` | 修改 | 新增 2 个 config_get 测试 |
| `frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts` | 修改 | 新增 ~55 个清洗规则测试 |
| `frontend-v3/scripts/mermaid-error-patterns.cjs` | 不改 | P1 回归验证用，期望 FAIL 数变化 |

---

## 问题 A: config_get diagram 分支遗漏

### A-1: test_config_get_diagram_default

| 字段 | 值 |
|------|-----|
| BDD | B-BDD-1 |
| 输入 | `peekview config get diagram.sanitize_enabled`（未设置过） |
| 预期 | 输出含 `default: True` |
| 文件 | `test_diagram_config.py::TestDiagramConfigCLI` |

### A-2: test_config_get_list_consistency

| 字段 | 值 |
|------|-----|
| BDD | B-BDD-1 |
| 输入 | 对所有 diagram key 分别执行 `config get` 和 `config list` |
| 预期 | `config get diagram.sanitize_enabled` 的 default 值与 `config list` 中显示的 default 值一致 |
| 文件 | `test_diagram_config.py::TestDiagramConfigCLI` |

---

## 问题 B: 清洗规则

### B-1: fix-keyword-case (17 + 2 = 19 tests)

每个错误关键字写法 1 个测试 + 方向大小写修正 1 个 + 已正确关键字不变 1 个。

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-keyword-case: gitgraph → gitGraph` | `gitgraph\n  commit id: "A"` | 首行 `gitGraph` | B-BDD-2 |
| 2 | `fix-keyword-case: Graph TD → graph TD` | `Graph TD\n  A --> B` | 首行 `graph TD` | B-BDD-2 |
| 3 | `fix-keyword-case: SEQUENCEDIAGRAM → sequenceDiagram` | `SEQUENCEDIAGRAM\n  A->>B: msg` | 首行 `sequenceDiagram` | B-BDD-2 |
| 4 | `fix-keyword-case: sequencediagram → sequenceDiagram` | `sequencediagram\n  A->>B: msg` | 首行 `sequenceDiagram` | B-BDD-2 |
| 5 | `fix-keyword-case: Flowchart LR → flowchart LR` | `Flowchart LR\n  A --> B` | 首行 `flowchart LR` | B-BDD-2 |
| 6 | `fix-keyword-case: ClassDiagram → classDiagram` | `ClassDiagram\n  class A\n    A : string name` | 首行 `classDiagram` | B-BDD-2 |
| 7 | `fix-keyword-case: ErDiagram → erDiagram` | `ErDiagram\n  CUSTOMER \|\|--o{ ORDER : places` | 首行 `erDiagram` | B-BDD-2 |
| 8 | `fix-keyword-case: Gantt → gantt` | `Gantt\n  title A\n  section S\n  Task :a, 2024-01-01, 1d` | 首行 `gantt` | B-BDD-2 |
| 9 | `fix-keyword-case: Pie → pie` | `Pie title Pets\n  "Dogs" : 50` | 首行 `pie` | B-BDD-2 |
| 10 | `fix-keyword-case: StateDiagram-v2 → stateDiagram-v2` | `StateDiagram-v2\n  [*] --> Active` | 首行 `stateDiagram-v2` | B-BDD-2 |
| 11 | `fix-keyword-case: Journey → journey` | `Journey\n  title My day` | 首行 `journey` | B-BDD-2 |
| 12 | `fix-keyword-case: Mindmap → mindmap` | `Mindmap\n  root((mindmap))` | 首行 `mindmap` | B-BDD-2 |
| 13 | `fix-keyword-case: Timeline → timeline` | `Timeline\n  title History` | 首行 `timeline` | B-BDD-2 |
| 14 | `fix-keyword-case: Sankey-beta → sankey-beta` | `Sankey-beta\n  A,B,10` | 首行 `sankey-beta` | B-BDD-2 |
| 15 | `fix-keyword-case: QuadrantChart → quadrantChart` | `QuadrantChart\n  title Test` | 首行 `quadrantChart` | B-BDD-2 |
| 16 | `fix-keyword-case: Xychart-beta → xychart-beta` | `Xychart-beta\n  title "Test"` | 首行 `xychart-beta` | B-BDD-2 |
| 17 | `fix-keyword-case: Block-beta → block-beta` | `Block-beta\n  columns 3` | 首行 `block-beta` | B-BDD-2 |
| 18 | `fix-keyword-case: direction td → TD` | `graph td\n  A --> B` | 首行 `graph TD` | B-BDD-2 |
| 19 | `fix-keyword-case: correct keyword unchanged` | `graph TD\n  A --> B` | 输出 === 输入 | B-BDD-2 |

### B-2: fix-missing-newline (7 + 3 + 1 = 11 tests)

每个 `XXsubgraph` 模式 1 个 + `sequenceDiagramA` 1 个 + `gitGraphcommit` 1 个 + `graph TDA[B]` 1 个 + 已有换行不变 1 个。

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-missing-newline: graph TBsubgraph` | `graph TBsubgraph S\n  A --> B\nend` | `graph TB\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 2 | `fix-missing-newline: graph TDsubgraph` | `graph TDsubgraph S\n  A --> B\nend` | `graph TD\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 3 | `fix-missing-newline: graph LRsubgraph` | `graph LRsubgraph S\n  A --> B\nend` | `graph LR\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 4 | `fix-missing-newline: graph RLsubgraph` | `graph RLsubgraph S\n  A --> B\nend` | `graph RL\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 5 | `fix-missing-newline: graph BTsubgraph` | `graph BTsubgraph S\n  A --> B\nend` | `graph BT\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 6 | `fix-missing-newline: flowchart TBsubgraph` | `flowchart TBsubgraph S\n  A --> B\nend` | `flowchart TB\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 7 | `fix-missing-newline: flowchart LRsubgraph` | `flowchart LRsubgraph S\n  A --> B\nend` | `flowchart LR\nsubgraph S\n  A --> B\nend` | B-BDD-3 |
| 8 | `fix-missing-newline: sequenceDiagramA` | `sequenceDiagramA->>B: msg` | `sequenceDiagram\nA->>B: msg` | B-BDD-3 |
| 9 | `fix-missing-newline: gitGraphcommit` | `gitGraphcommit id: "A"` | `gitGraph\ncommit id: "A"` | B-BDD-3 |
| 10 | `fix-missing-newline: graph TDA[B]` | `graph TDA[B] --> C` | `graph TD\nA[B] --> C` | B-BDD-3 |
| 11 | `fix-missing-newline: already has newline unchanged` | `graph TD\n  A --> B` | 输出 === 输入 | B-BDD-3 |

### B-3: fix-fullwidth-syntax (mermaid) (5 + 3 + 3 = 11 tests)

语法位置全角替换 5 个 + 标签内全角不替换 3 个 + 边界 3 个。

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-fullwidth-syntax mermaid: （）→ () shape delimiter` | `graph TD\n  A（text）--> B[text]` | `graph TD\n  A(text)--> B[text]` | B-BDD-4 |
| 2 | `fix-fullwidth-syntax mermaid: 【】→ [] shape delimiter` | `graph TD\n  A【text】--> B[text]` | `graph TD\n  A[text]--> B[text]` | B-BDD-4 |
| 3 | `fix-fullwidth-syntax mermaid: ：→ : colon` | `sequenceDiagram\n  A->>B：消息` | `：`消息` | `sequenceDiagram\n  A->>B:消息` | B-BDD-4 |
| 4 | `fix-fullwidth-syntax mermaid: → → --> arrow` | `graph TD\n  A → B` | `graph TD\n  A --> B` | B-BDD-4 |
| 5 | `fix-fullwidth-syntax mermaid: \u201c\u201d → "" quotes` | `graph TD\n  A-->\u201cB\u201d` | `graph TD\n  A-->"B"` | B-BDD-4 |
| 6 | `fix-fullwidth-syntax mermaid: （）in label preserved` | `graph TD\n  A[数据（中文）] --> B` | 输出 === 输入 | B-BDD-5 |
| 7 | `fix-fullwidth-syntax mermaid: 【】in label preserved` | `graph TD\n  A[数据【中文】] --> B` | 输出 === 输入 | B-BDD-5 |
| 8 | `fix-fullwidth-syntax mermaid: \u201c\u201d in label preserved` | `graph TD\n  A[\u201c中文\u201d] --> B` | 输出 === 输入 | B-BDD-5 |
| 9 | `fix-fullwidth-syntax mermaid: nested shape A[(text)]` | `graph TD\n  A[（数据）] --> B[(store）]` | `graph TD\n  A[（数据）] --> B[(store)]` | B-BDD-4 |
| 10 | `fix-fullwidth-syntax mermaid: unclosed bracket kept as-is` | `graph TD\n  A[text with 【bracket] --> B` | 全角 `【` 不替换（未闭合） | B-BDD-4 |
| 11 | `fix-fullwidth-syntax mermaid: placeholder no conflict` | `graph TD\n  A[text1] --> B[text2] --> C[text3]` | 还原后无 `__PV_PH_` 残留 | B-BDD-4 |

### B-4: fix-arrows (5 + 2 + 1 + 1 = 9 tests)

graph 上下文 5 个 + sequenceDiagram 上下文 2 个 + 无上下文安全降级 1 个 + BOM + sequenceDiagram 组合 1 个。

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-arrows: ->> in graph → -->` | `graph TD\n  A ->> B` | `graph TD\n  A --> B` | B-BDD-6 |
| 2 | `fix-arrows: -->> in graph → -.->` | `graph TD\n  A -->> B` | `graph TD\n  A -.-> B` | B-BDD-6 |
| 3 | `fix-arrows: -> in graph → -->` | `graph TD\n  A -> B` | `graph TD\n  A --> B` | B-BDD-6 |
| 4 | `fix-arrows: => in graph → -->` | `graph TD\n  A => B` | `graph TD\n  A --> B` | B-BDD-6 |
| 5 | `fix-arrows: -x> in graph → -x` | `graph TD\n  A -x> B` | `graph TD\n  A -x B` | B-BDD-6 |
| 6 | `fix-arrows: ->>> in sequence → ->>` | `sequenceDiagram\n  A->>>B: msg` | `sequenceDiagram\n  A->>B: msg` | B-BDD-7 |
| 7 | `fix-arrows: --->> in sequence → -->>` | `sequenceDiagram\n  A--->>B: msg` | `sequenceDiagram\n  A-->>B: msg` | B-BDD-7 |
| 8 | `fix-arrows: no context → no change` | `A ->> B` | 输出 === 输入 | B-BDD-6 |
| 9 | `fix-arrows: BOM + sequenceDiagram` | `\uFEFFsequenceDiagram\n  A->>>B: msg` | `sequenceDiagram\n  A->>B: msg` | B-BDD-7 |

### B-5: strip-plantuml-markers (2 tests)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `strip-plantuml-markers: @startuml removed` | `@startuml\n  A --> B` | `  A --> B` | B-BDD-8 |
| 2 | `strip-plantuml-markers: @enduml removed` | `@startuml\n  A --> B\n@enduml` | `  A --> B` | B-BDD-8 |

### B-6: strip-null-bytes (1 test)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `strip-null-bytes: removes \\0` | `graph TD\n  A --> \u0000B` | `graph TD\n  A --> B` | B-BDD-9 |

### B-7: fix-fullwidth-syntax (plantuml) (2 tests)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-fullwidth-syntax plantuml: ：→ :` | `@startuml\nAlice `：`hello\n@enduml` | `@startuml\nAlice :hello\n@enduml` | B-BDD-10 |
| 2 | `fix-fullwidth-syntax plantuml: → → ->` | `@startuml\nAlice → Bob: hello\n@enduml` | `@startuml\nAlice -> Bob: hello\n@enduml` | B-BDD-10 |

### B-8: fix-fullwidth-syntax (svg) (2 tests)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `fix-fullwidth-syntax svg: \u201c\u201d → ""` | `<text fill=\u201cred\u201d>Hi</text>` | `<text fill="red">Hi</text>` | B-BDD-11 |
| 2 | `fix-fullwidth-syntax svg: ＝ → =` | `<rect width＝100 />` | `<rect width=100 />` | B-BDD-11 |

### B-9: normalize-arrows 删除 (1 test)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `normalize-arrows: rule no longer exists` | `graph TD\n  A ->> B` | ` ->> ` **不被替换为** ` -->> `（旧规则已删除，由 fix-arrows 处理） | B-BDD-6 |

### B-10: 规则执行顺序 (1 test)

| # | 测试名 | 输入 | 预期输出 | BDD |
|---|--------|------|---------|-----|
| 1 | `rule order: fix-keyword-case before fix-missing-newline` | `Graph TDsubgraph S\n  A --> B\nend` | `graph TD\nsubgraph S\n  A --> B\nend`（先修正大小写再插入换行） | B-BDD-2, B-BDD-3 |

---

## 问题 C: 移动端 header

纯 CSS 变更，P3 不需要前端单测。P6 通过 Playwright CDP 截图验证 C-BDD-1 和 C-BDD-2。

---

## P1 回归测试

`mermaid-error-patterns.cjs` 当前 FAIL 数: **55**

修复后期望 FAIL 数: **≤10**

| 类别 | 修复前 FAIL | 修复后 FAIL | 说明 |
|------|------------|------------|------|
| 1-关键字大小写 | 17 | 0 | fix-keyword-case 完全覆盖 |
| 2-缺换行 | 11 | 0 | fix-missing-newline 完全覆盖 |
| 3-全角语法位置 | 5 | 0 | fix-fullwidth-syntax 完全覆盖 |
| 4-箭头语法 | 9 | 0 | fix-arrows 完全覆盖 |
| 5-结构性 | 8 | 5 | @startuml(1)+null(1) 修复；缺end(2)+未闭合括号(2)+空标签(1)+空图表(1) 不修 |
| 6-不需要修复 | 0 | 0 | — |
| 其他（normalize-arrows bug 导致的） | 5 | 5 | 旧规则误替换 `->>` → `-->>` 在 graph 中仍 FAIL，删除后由 fix-arrows 正确修正为 `-->` |
| **合计** | **55** | **≤10** | |

> 注: "其他 5" 来自 P1 脚本中 `->> in graph`、`-->> correct (graph)` 等用例——旧 `normalize-arrows` 把 `->>` 替换为 `-->>`，在 graph 中仍 FAIL。删除旧规则后 `fix-arrows` 正确替换为 `-->`，这些用例应 PASS。实际剩余 FAIL 仅类别 5 的启发式/不可修项（缺 end 2 + 未闭合括号 2 + 空标签 1 + 空图表 1 = 6，加上 `flowchart lr` 方向小写 1 = 7，加上 `incomplete gitgraph` 1 = 8~10）。

---

## 统计

| 问题 | 测试数 |
|------|--------|
| A (config_get) | 2 |
| B-1 (fix-keyword-case) | 19 |
| B-2 (fix-missing-newline) | 11 |
| B-3 (fix-fullwidth-syntax mermaid) | 11 |
| B-4 (fix-arrows) | 9 |
| B-5 (strip-plantuml-markers) | 2 |
| B-6 (strip-null-bytes) | 1 |
| B-7 (fix-fullwidth-syntax plantuml) | 2 |
| B-8 (fix-fullwidth-syntax svg) | 2 |
| B-9 (normalize-arrows 删除) | 1 |
| B-10 (规则执行顺序) | 1 |
| C (移动端 header) | 0 (P6 CDP) |
| **合计** | **61** |

### 最关键的 3 个测试

1. **B-10: rule order — fix-keyword-case before fix-missing-newline** — 验证规则间隐式依赖正确，若顺序错误则 `Graph TDsubgraph` 无法同时修正大小写和换行
2. **B-3#9: nested shape A[(text)]** — 验证全角替换的标签提取/还原逻辑对嵌套形状正确处理，这是 fix-fullwidth-syntax 最复杂的边界
3. **B-4#9: BOM + sequenceDiagram** — 验证 fix-arrows 的 BOM 预处理（review MAJOR-2），若缺失则 BOM 干扰首行检测导致箭头修正失败
