---
phase: P2
task_id: T050
task_name: T049 问题归零修复
type: design
trace_id: T050-P2-20260709
created: 2026-07-09
status: draft
agent: architect
---

# T050 P2: 方案设计

## 问题 A: `config get diagram.sanitize_enabled` 默认值不显示

### 根因

`cli.py:651` 的 `get_default` helper 缺少 `elif section == "diagram"` 分支，而 `cli.py:713` 的 `_get_default`（`config list` 用）有。P4 实现时改了一处忘了另一处。

### 修复方案（唯一，无候选）

在 `cli.py:665`（`elif section == "remote"` 之后、`return ""` 之前）插入：

```python
elif section == "diagram":
    return getattr(defaults.diagram, k, "")
```

测试：`test_diagram_config.py` 新增 `test_config_get_diagram_default`，验证 `config get diagram.sanitize_enabled` 输出含 `default: True`。

---

## 问题 B: 清洗规则不全面

### 现状

`diagramSanitize.ts` 有 7 条规则（3 mermaid + 2 plantuml + 2 svg），P1 分析 130 用例 → 55 FAIL，覆盖不足。

### T049 原有 normalize-arrows 规则 bug

当前规则 `normalize-arrows` 把 `->>` 替换为 `-->>`，但 `-->>` 在 graph 上下文中也是无效箭头（仅 sequenceDiagram 有效）。需要删除此规则，用上下文感知的箭头修正替代。

### 候选方案

#### 方案 B1: 逐规则注册（扩展现有 registerRule 机制）

**策略**: 每个错误模式类别注册为独立规则，沿用现有 `registerRule` + `applyRules` 管线。箭头修正规则内部自行检测上下文。

**规则清单**:

| # | 规则名 | 引擎 | 类型 | 覆盖类别 | 说明 |
|---|--------|------|------|---------|------|
| 1 | `fix-keyword-case` | mermaid | deterministic | 类别1 (17 FAIL) | 关键字映射表修正 |
| 2 | `fix-missing-newline` | mermaid | deterministic | 类别2 (11 FAIL) | 方向指示符后插入换行 |
| 3 | `fix-fullwidth-syntax` | mermaid | deterministic | 类别3 (5 FAIL) | 语法位置全角→ASCII |
| 4 | `fix-arrows` | mermaid | deterministic | 类别4 (9 FAIL) | 上下文感知箭头修正 |
| 5 | `strip-plantuml-markers` | mermaid | deterministic | 类别5-@startuml (1 FAIL) | 移除 @startuml/@enduml |
| 6 | `strip-null-bytes` | mermaid | deterministic | 类别5-null (1 FAIL) | 移除 \0 |
| 7 | `fix-fullwidth-syntax` | plantuml | deterministic | PlantUML 全角 | 全角冒号/箭头→ASCII |
| 8 | `fix-fullwidth-syntax` | svg | deterministic | SVG 全角 | 全角引号/等号→ASCII |
| — | ~~`normalize-arrows`~~ | ~~mermaid~~ | ~~deterministic~~ | — | **删除**（bug，被 #4 替代） |
| — | `strip-leading-whitespace` | mermaid | heuristic | — | 保留不变 |
| — | `ensure-start-end` | plantuml | deterministic | — | 保留不变 |
| — | `fix-whitespace` | plantuml | heuristic | — | 保留不变 |
| — | `fix-unquoted-attrs` | svg | deterministic | — | 保留不变 |
| — | `close-unclosed-voids` | svg | deterministic | — | 保留不变 |

**关键设计细节**:

1. **关键字映射表** (`fix-keyword-case`):
   - 静态 `Map<string, string>`，覆盖 P1 表中全部 17 个错误写法
   - 匹配方式：正则 `^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram-v2|journey|mindmap|timeline|sankey-beta|quadrantChart|xychart-beta|block-beta|gitGraph)\b`，忽略大小写匹配首行
   - 方向指示符也修正：`graph td` → `graph TD`（TB/TD/BT/LR/RL 大写化）

2. **缺换行修正** (`fix-missing-newline`):
   - 正则：`/^(graph|flowchart)\s+(TB|TD|BT|LR|RL)([^\n\S]*)(\S)/im` → `$1 $2\n$4`
   - 正则：`/^(sequenceDiagram|gitGraph)([^\n\S]*)(\S)/im` → `$1\n$3`
   - 在 `fix-keyword-case` 之后执行（此时关键字已正确）

3. **全角符号修正** (`fix-fullwidth-syntax`):
   - **核心问题**: 如何区分"语法位置"和"标签内容"
    - **方案**: 先提取所有标签内容（`[...]`、`(...)`, `{"..."}` 内部），替换为占位符 → 对剩余文本做全角替换 → 还原占位符
    - **占位符格式**: `__PV_PH_{N}__`（N 递增），还原时按 N 降序替换（避免 PH_1 被 PH_10 误匹配）
    - **边界情况处理**（review MAJOR-1 修正）:
      - 嵌套形状 `A[(text)]`: 从外到内逐层提取，cylinder 的 `(...)` 外层 `(` 是定界符、内层 `)` 是标签内容，用栈配对
      - 未闭合括号 `A[text with [bracket]`: 提取逻辑遇到未闭合括号时不替换为占位符（保持原样），避免错位
      - hexagon `{"text"}`: 引号是形状定界符，提取时将整个 `{"text"}` 替换为占位符
    - 语法位置替换映射：
     - `（` → `(`, `）` → `)` （形状定界符）
     - `【` → `[`, `】` → `]` （形状定界符）
     - `：` → `:` （冒号分隔符）
     - `→` → `-->` （箭头）
     - `\u201c` → `"`, `\u201d` → `"` （引号定界符，仅语法位置）
   - 标签内全角符号**不替换**（P1 证明 25/25 PASS）

4. **箭头修正** (`fix-arrows`):
   - **上下文检测**: 检测首行是否匹配 `/^(sequenceDiagram|sequence-diagram)/i`
    - **预处理**: 先 strip BOM (`\uFEFF`) 和前导空行，再检测 diagramType（review MAJOR-2 修正）
   - **graph 上下文**:
     - ` ->> ` → ` --> ` （实线开放箭头）
     - ` -->> ` → ` -.-> ` （虚线开放箭头）
     - ` -> ` → ` --> ` （实线无箭头→实线箭头）
     - ` => ` → ` --> ` （无效→实线箭头）
     - ` -x> ` → ` -x ` （无效组合→有效）
   - **sequenceDiagram 上下文**:
     - `->>>` → `->>` （多余箭头）
     - `--->>` → `-->>` （多余横线）
   - **无上下文**（首行无法判断）: 不修正（安全降级）

5. **规则执行顺序**: `fix-keyword-case` → `fix-missing-newline` → `fix-fullwidth-syntax` → `fix-arrows` → `strip-plantuml-markers` → `strip-null-bytes`
   - registerRule 按注册顺序执行，确保注册顺序即可

**优点**:
- 最小改动：沿用现有 registerRule 机制，不引入新抽象
- 规则独立可测试，每条规则有明确输入/输出
- 箭头修正的上下文检测逻辑封装在单条规则内，不污染管线

**缺点**:
- 全角符号的"提取标签→替换→还原"逻辑较复杂，单条规则内嵌
- 箭头修正的上下文检测只看首行，混合图表（如 mermaid 内嵌 sequenceDiagram）无法处理
- 规则间有隐式依赖（fix-keyword-case 必须在 fix-missing-newline 之前）

#### 方案 B2: 两阶段管线（两阶段管线 + 上下文传递）

**策略**: 将管线分为"预处理→上下文分析→规则应用"三阶段。预处理提取标签占位符和上下文信息，规则函数接收上下文对象而非纯字符串。

**管线变更**:

```typescript
interface SanitizeContext {
  code: string
  engine: string
  diagramType: 'graph' | 'sequence' | 'class' | 'gantt' | 'unknown'
  placeholders: Map<string, string>  // 占位符 → 原始标签内容
}

type ContextualRuleFn = (ctx: SanitizeContext) => SanitizeContext
```

1. **预处理阶段**: 提取标签内容为占位符、检测 diagramType
2. **规则应用阶段**: 规则函数接收 `SanitizeContext`，可读取 diagramType 决定行为
3. **后处理阶段**: 还原占位符

**优点**:
- 上下文信息显式传递，箭头修正不需要自行检测 diagramType
- 标签占位符提取/还原只做一次，所有规则共享
- 规则间无隐式依赖

**缺点**:
- 需要修改 `registerRule`/`applyRules`/`sanitize`/`sanitizeWithRetry` 的签名，**破坏现有 API**
- 现有 7 条规则全部需要适配新签名
- 测试文件需要重写
- 改动范围大，引入回归风险

### 权衡分析 + 选择

| 维度 | B1 (逐规则注册) | B2 (两阶段管线) |
|------|-----------------|-----------------|
| 改动范围 | 新增 6 条规则 + 删除 1 条 | 重构管线 + 重写所有规则 |
| API 兼容性 | 完全兼容 | 破坏性变更 |
| 回归风险 | 低（只增不改旧规则签名） | 中（所有规则需适配） |
| 上下文感知 | 规则内自行检测 | 管线显式传递 |
| 标签占位符 | 每条规则自行处理 | 共享，只提取/还原一次 |
| 可测试性 | 每条规则独立测试 | 需要构造 Context 对象 |

**选择: 方案 B1**

理由：
1. T050 是归零修复任务，核心目标是覆盖 P1 识别的 55 FAIL，不是重构管线架构
2. 全角符号的"提取标签→替换→还原"只在 `fix-fullwidth-syntax` 一条规则中使用，不需要所有规则共享
3. 箭头修正的上下文检测只看首行，对 mermaid 单一图表类型场景足够（mermaid 不支持混合图表类型）
4. 方案 B2 的破坏性变更与"归零修复"的风险偏好不匹配
5. 如果未来需要更复杂的管线（如混合图表、多轮修正），可以在独立任务中重构

---

## 问题 C: 移动端 header tags 被 header-right 挤压

### 现状分析

`EntryDetailView.vue` header 布局：
- `.detail-header`: `display: flex; align-items: flex-start;`
- `.detail-logo`: `flex-shrink: 0` (28px)
- `.title-group`: `flex: 1; min-width: 0` (标题 + tags)
- `.header-right`: `flex-shrink: 0` (Expires/Edit/TOC/Theme toggle)

移动端（<768px）header-right 内容：
- 非登录态: `Expires ...` + `TOC` + `ThemeToggle` ≈ 3 元素
- 登录态: `Expires ... Edit` + `TOC` + `ThemeToggle` ≈ 4 元素（Expires 含 Edit 按钮）

`header-right` 设了 `flex-shrink: 0`，不会缩小；`title-group` 的 `flex: 1` + `min-width: 0` 使其可被压缩到 0。tags 区域被挤压。

### 候选方案

#### 方案 C1: header-right 在移动端换行到下一行

**策略**: 移动端让 `.detail-header` 从 `flex-direction: row` 变为 `flex-wrap: wrap`，header-right 在空间不足时自动换行。

**CSS 变更** (`layout.css` + `EntryDetailView.vue` scoped):

```css
@media (max-width: 768px) {
  .detail-header {
    flex-wrap: wrap;
  }
  .title-group {
    flex-basis: calc(100% - 44px); /* logo 28px + gap 16px */
    max-width: calc(100% - 44px);
  }
  .header-right {
    flex-basis: 100%;
    justify-content: flex-end;
    padding-top: 0;
    gap: var(--space-1);
  }
}
```

**优点**:
- 实现简单，纯 CSS，无 JS 逻辑
- 所有按钮可见，不需要额外点击
- header-right 元素顺序不变

**缺点**:
- header 高度增加（两行），减少内容区可视面积
- 视觉上 header-right 独占一行可能显得空旷
- Expires/Edit/TOC/Theme 在第二行右对齐，与 title-group 视觉关联弱

#### 方案 C2: header-right 在移动端折叠部分元素到 ⋯ 菜单

**策略**: 移动端将 header-right 中的次要元素（TOC、Theme toggle）折叠到 ⋯ 菜单，保留 Expires + Edit（核心信息/操作）。

**实现**:
- 给 TOC 按钮和 ThemeToggle 添加 `mobile-hide` class
- 在 header-right 末尾添加一个移动端专用的 ⋯ 按钮（仅 <768px 显示）
- ⋯ 菜单复用 `OverflowMenu` 组件，包含 TOC 和 Theme toggle 选项
- 登录态: header-right 只显示 `Expires ... Edit` + `⋯` ≈ 3 元素 + 1 菜单
- 非登录态: header-right 只显示 `Expires ...` + `⋯` ≈ 2 元素 + 1 菜单

**优点**:
- header 保持单行，tags 区域获得足够空间
- 核心信息（Expires）始终可见
- 复用现有 OverflowMenu 组件，交互模式一致

**缺点**:
- TOC 和 Theme toggle 需要额外点击才能访问
- 需要新增 JS 逻辑（移动端 ⋯ 菜单的状态管理）
- Theme toggle 在 ⋯ 菜单中不如直接按钮直观

#### 方案 C3: 混合方案 — 换行 + 紧凑布局

**策略**: header-right 换行到下一行，但第二行使用紧凑布局（小字号、无间距），视觉上接近一行。

**CSS 变更**:

```css
@media (max-width: 768px) {
  .detail-header {
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .title-group {
    flex-basis: calc(100% - 44px);
  }
  .header-right {
    flex-basis: 100%;
    padding: 2px 0 0 44px; /* 与 title-group 左对齐 */
    gap: var(--space-1);
    font-size: var(--font-xs);
  }
  .header-right .entry-expires {
    font-size: 11px;
  }
  .header-right .toc-btn,
  .header-right .theme-toggle {
    padding: 2px 6px;
    font-size: 11px;
  }
}
```

**优点**:
- 所有元素可见，无需额外点击
- 紧凑布局减少第二行视觉冲击
- 纯 CSS，无 JS

**缺点**:
- 第二行仍然存在，header 高度略增
- 紧凑布局在小屏（<375px）可能仍然拥挤
- 字号过小影响可读性

### 权衡分析 + 选择

| 维度 | C1 (换行) | C2 (折叠菜单) | C3 (混合) |
|------|----------|--------------|----------|
| 实现复杂度 | 低（纯 CSS） | 中（CSS + JS + OverflowMenu） | 低（纯 CSS） |
| 信息可见性 | 全部可见 | TOC/Theme 需 1 次点击 | 全部可见 |
| header 高度 | 两行（+~32px） | 单行 | 两行但紧凑（+~24px） |
| tags 空间 | 充足（100% 宽度） | 充足（header-right 缩小） | 充足（100% 宽度） |
| 小屏适配 | 好 | 好 | 一般（紧凑后仍可能挤） |
| 交互一致性 | — | 与 mobile-actions 的 ⋯ 一致 | — |

**选择: 方案 C1 (换行)**

理由：
1. P0-brief 明确提到"至少 1 次点击可访问"作为折叠方案的缓解，但用户反馈的核心痛点是 tags 被挤压不可见——换行方案直接解决，零点击成本
2. 纯 CSS 实现，无 JS 逻辑，回归风险最低
3. header 增加一行（~32px）在移动端可接受——tags 区域获得完整宽度，信息密度反而提升
4. 方案 C2 的折叠菜单虽然交互模式一致，但 TOC 是高频操作（markdown 条目），折叠后增加操作成本
5. 方案 C3 的紧凑布局在 390px 宽度下仍可能拥挤，且字号过小影响可读性

---

## 错误模式 × 规则覆盖对照表

| 类别 | 错误模式 | FAIL 数 | 规则名 | 类型 | 覆盖状态 |
|------|---------|---------|--------|------|---------|
| 1-关键字大小写 | `gitgraph` → `gitGraph` | 17 | `fix-keyword-case` | 确定性 | ✅ 完全覆盖 |
| 1-关键字大小写 | `Graph TD` → `graph TD` | (含上) | `fix-keyword-case` | 确定性 | ✅ |
| 1-关键字大小写 | `SEQUENCEDIAGRAM` → `sequenceDiagram` | (含上) | `fix-keyword-case` | 确定性 | ✅ |
| 1-方向大小写 | `graph td` → `graph TD` | (含上) | `fix-keyword-case` | 确定性 | ✅ |
| 2-缺换行 | `graph TBsubgraph` → `graph TB\nsubgraph` | 11 | `fix-missing-newline` | 确定性 | ✅ 完全覆盖 |
| 2-缺换行 | `sequenceDiagramA->>B` → `sequenceDiagram\nA->>B` | (含上) | `fix-missing-newline` | 确定性 | ✅ |
| 2-缺换行 | `gitGraphcommit` → `gitGraph\ncommit` | (含上) | `fix-missing-newline` | 确定性 | ✅ |
| 2-缺换行 | `graph TDA[B]` → `graph TD\nA[B]` | (含上) | `fix-missing-newline` | 确定性 | ✅ |
| 3-全角语法位置 | `A（text）` → `A(text)` | 5 | `fix-fullwidth-syntax` (mermaid) | 确定性 | ✅ 完全覆盖 |
| 3-全角语法位置 | `A【text】` → `A[text]` | (含上) | `fix-fullwidth-syntax` (mermaid) | 确定性 | ✅ |
| 3-全角语法位置 | `A->>B：消息` → `A->>B:消息` | (含上) | `fix-fullwidth-syntax` (mermaid) | 确定性 | ✅ |
| 3-全角语法位置 | `A → B` → `A --> B` | (含上) | `fix-fullwidth-syntax` (mermaid) | 确定性 | ✅ |
| 3-全角语法位置 | `A-->"B"` → `A-->"B"` | (含上) | `fix-fullwidth-syntax` (mermaid) | 确定性 | ✅ |
| 3-全角标签内 | `A[数据（中文）]` | 0 (PASS) | — | — | ⛔ 不需要修复 |
| 4-箭头语法 | `A ->> B` in graph → `A --> B` | 9 | `fix-arrows` | 确定性 | ✅ 完全覆盖 |
| 4-箭头语法 | `A -->> B` in graph → `A -.-> B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 4-箭头语法 | `A -> B` in graph → `A --> B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 4-箭头语法 | `A => B` in graph → `A --> B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 4-箭头语法 | `A -x> B` in graph → `A -x B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 4-箭头语法 | `A->>>B` in seq → `A->>B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 4-箭头语法 | `A--->>B` in seq → `A-->>B` | (含上) | `fix-arrows` | 确定性 | ✅ |
| 5-结构性 | `@startuml` in mermaid | 1 | `strip-plantuml-markers` | 确定性 | ✅ |
| 5-结构性 | null 字节 | 1 | `strip-null-bytes` | 确定性 | ✅ |
| 5-结构性 | 缺少 `end` | 2 | — | 启发式 | ❌ P3 不实现（启发式风险高） |
| 5-结构性 | 未闭合括号 | 2 | — | 启发式 | ❌ P3 不实现（启发式风险高） |
| 5-结构性 | 空节点标签 `A[]` | 1 | — | 启发式 | ❌ P3 不实现 |
| 5-结构性 | 空图表 | 1 | — | — | ❌ 不可修 |
| PlantUML | 全角冒号 `：` → `:` | — | `fix-fullwidth-syntax` (plantuml) | 确定性 | ✅ |
| PlantUML | 全角箭头 `→` → `->` | — | `fix-fullwidth-syntax` (plantuml) | 确定性 | ✅ |
| SVG | 全角引号 `""` → `""` | — | `fix-fullwidth-syntax` (svg) | 确定性 | ✅ |
| SVG | 全角等号 `＝` → `=` | — | `fix-fullwidth-syntax` (svg) | 确定性 | ✅ |

**覆盖统计** (修正重复计算，review BLOCKER-1):
- 类别1: 17 FAIL → 17 确定性覆盖
- 类别2: 11 FAIL → 11 确定性覆盖
- 类别3: 5 FAIL → 5 确定性覆盖
- 类别4: 9 FAIL → 9 确定性覆盖（含 T049 normalize-arrows bug 修复，已在类别4中计算，不单独列）
- 类别5: 8 FAIL → 2 确定性覆盖 + 5 启发式不实现 + 1 不可修
- 合计: **42/48 确定性覆盖 (87.5%)**
- 启发式不实现: 5/55 (9%) — 缺 end、未闭合括号、空标签
- 不可修: 1/55 (2%) — 空图表

---

## 四字段

### packages

- `backend/peekview/cli.py` — config_get 补 diagram 分支
- `backend/tests/test_diagram_config.py` — config_get 测试
- `frontend-v3/src/utils/diagramSanitize.ts` — 新增 6 条规则 + 删除 1 条
- `frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts` — 补充测试
- `frontend-v3/src/views/EntryDetailView.vue` — header 移动端换行 CSS
- `frontend-v3/src/styles/layout.css` — header 移动端换行 CSS

### domains

- `config-get-fix`: CLI config_get 默认值 bug 修复
- `sanitizer-rules-systematic`: 基于 P1 数据的清洗规则系统补充
- `mobile-header-layout`: 移动端 header-right 换行

### ui_affected

- EntryDetailView header 移动端布局（<768px 换行）
- Mermaid/PlantUML/SVG 渲染成功率提升（清洗规则覆盖）
- config list/get CLI 输出一致性

### gate_commands

```bash
# 后端
cd backend && .venv/bin/python -m pytest tests/test_diagram_config.py -v --tb=short
cd backend && .venv/bin/python -m pytest tests/ -q
cd backend && python3 -m ruff check peekview/ tests/

# 前端
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && ./node_modules/.bin/vitest run
cd frontend-v3 && ./node_modules/.bin/vitest run src/utils/__tests__/diagramSanitize.spec.ts

# P1 回归验证
cd frontend-v3 && node scripts/mermaid-error-patterns.cjs | grep FAIL | wc -l
# 期望: FAIL 数从 55 降至 ≤10（剩余为启发式/不可修类别）

# 移动端视觉验证
# Playwright CDP: iPhone 14 (390×844), 登录态 + 非登录态
```

---

## files_to_read

P4 implementer 需要参考的文件：

| 文件 | 用途 |
|------|------|
| `backend/peekview/cli.py:640-685` | config_get bug 位置 |
| `backend/peekview/cli.py:688-717` | config_list 的 _get_default（参考 diagram 分支写法） |
| `backend/tests/test_diagram_config.py` | 现有测试，追加 config_get 测试 |
| `frontend-v3/src/utils/diagramSanitize.ts` | 清洗模块，新增规则 + 删除 normalize-arrows |
| `frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts` | 现有测试，补充新规则测试 |
| `frontend-v3/src/views/EntryDetailView.vue:1-133` | header 模板结构 |
| `frontend-v3/src/views/EntryDetailView.vue:775-950` | header scoped CSS |
| `frontend-v3/src/styles/layout.css` | header 全局 CSS |
| `frontend-v3/scripts/mermaid-error-patterns.cjs` | P1 测试脚本，验证回归 |
| `docs/tasks/T050-mobile-header-diagram-sanitize-fix/P1-analysis.md` | 错误模式参考 |

---

## env_constraints

- 调试: `make debug` (:8888)，数据隔离到 `/tmp/peekview-debug/`
- 前端 CI: `npx vue-tsc --noEmit` + `vitest run`
- 后端 CI: `pytest -q` + `ruff check`
- 移动端验证: Playwright CDP `Emulation.setDeviceMetricsOverride` iPhone 14 (390×844)
- 移动端双态: 登录 + 非登录
- 严禁触碰生产 DB (`~/.peekview/peekview.db`)
- 严禁 `pip3 install --break-system-packages -e .`
