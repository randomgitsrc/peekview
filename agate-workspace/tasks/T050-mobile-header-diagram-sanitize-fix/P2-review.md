---
phase: P2
task_id: T050
type: review
reviewer: design-reviewer
created: 2026-07-09
status: approved
---

# T050 P2 Design Review

## 评审结论: **approved** — BLOCKER-1 和 MAJOR-1/MAJOR-2 已在 P2-design.md 中修正（2026-07-09 修订）

---

## 问题清单

### BLOCKER-1: 覆盖统计数字 44/55 (80%) 存在重复计算

P2 覆盖对照表底部声称：
- 确定性覆盖: 44/55 FAIL (80%)
- 原有 bug 修复: 5/55 FAIL (9%) — normalize-arrows 替换为 fix-arrows

但 `normalize-arrows` 的 bug 效果（`->>` → `-->>` 在 graph 中仍 FAIL）**已经包含在类别 4 的 9 FAIL 中**。P1 类别 4 的 `A ->> B in graph` 就是这个 bug 的直接表现。将 "原有 bug 修复" 单独列为 5/55 是重复计算。

**实际数字应为**：
- 类别 1: 17 FAIL → 17 覆盖
- 类别 2: 11 FAIL → 11 覆盖
- 类别 3: 5 FAIL → 5 覆盖
- 类别 4: 7 FAIL（P1 表中列出 7 个模式，不是 9）→ 7 覆盖
- 类别 5: 8 FAIL → 2 覆盖 + 5 启发式不实现 + 1 不可修

合计: 42/48 确定性覆盖 (87.5%)，而非 44/55 (80%)。

**需要修正**：
1. 类别 4 的 FAIL 数应与 P1 一致（7 个模式，不是 9）。如果 P2 认为有 9 个，需明确列出多出的 2 个模式
2. 删除 "原有 bug 修复: 5/55" 行，避免与类别 4 重复计算
3. 重新计算覆盖率和总 FAIL 数

### MAJOR-1: 全角符号"提取标签→替换→还原"方案的边界情况未充分分析

P2 提到方案是"先提取所有标签内容（`[...]`、`(...)`, `{"..."}` 内部），替换为占位符 → 对剩余文本做全角替换 → 还原占位符"，但未说明：

1. **嵌套括号处理**: `A[(内层)]` — mermaid 支持 `A[(text)]` (cylinder 形状)。外层 `(` 和内层 `)` 如何配对？如果用简单正则匹配最内层，可能只替换外层定界符而遗漏内层
2. **未闭合括号**: `A[text with [bracket]` — P1 已识别此为 FAIL 模式。提取逻辑遇到未闭合括号时行为未定义，可能导致占位符替换错位
3. **占位符冲突**: 如果标签内容本身包含占位符字符串（如 `__PH_1__`），还原时会误替换。需要使用不可能出现在 mermaid 中的占位符格式
4. **`{"..."}` 形状**: mermaid 的 `{"text"}` 是 hexagon 形状，引号是定界符。提取逻辑需要区分"形状内的引号定界符"和"标签内容中的引号"

**建议**: P4 实现时必须补充边界测试用例，至少覆盖：嵌套形状 `A[(text)]`、未闭合括号、占位符冲突、hexagon 形状引号。

### MAJOR-2: fix-arrows 上下文检测只看首行，BOM/前导空格/注释会导致误判

P2 设计：检测首行是否匹配 `/^(sequenceDiagram|sequence-diagram)/i` 来判断 diagramType。

问题：
1. **BOM**: P1 测试用例包含 BOM (`\uFEFFgraph TD`)。BOM 在首行前会导致正则不匹配。虽然 `strip-leading-whitespace` 是 heuristic 规则可能处理，但 BOM 不是空白字符，不会被 `^\s+` 匹配
2. **前导空格**: 如果代码有前导空格或空行，`^` 锚定会失败。需要用 `/^\s*(sequenceDiagram|sequence-diagram)/im` 或先 trim
3. **注释行**: mermaid 支持 `%%` 注释。如果首行是注释，第二行才是 diagram 类型声明，当前检测会误判为 "无上下文"（安全降级不修正），导致 sequenceDiagram 中的 `->>>` 不被修正

**建议**: 
- 正则改为 `/^\s*(sequenceDiagram|sequence-diagram)/im`，并在匹配前 strip BOM
- 或在 fix-arrows 内部先做轻量预处理（strip BOM + trim leading blank lines），再检测 diagramType
- 在 P3 测试中增加 BOM + sequenceDiagram 的组合用例

### MINOR-1: 规则执行顺序依赖无保护机制

P2 明确指出 `fix-keyword-case` 必须在 `fix-missing-newline` 之前执行（因为 fix-missing-newline 的正则依赖关键字已正确），但 `registerRule` 按注册顺序执行，无显式排序或依赖声明。

当前设计中，规则在模块顶层按顺序 `registerRule` 调用，顺序是隐式的。如果未来有人调整注册顺序或新增规则插入中间，可能破坏依赖。

**建议**: 在代码注释中明确标注执行顺序约束，或在 `registerRule` 调用处添加顺序断言（如检查前序规则是否已注册）。

### MINOR-2: C1 方案的 CSS 未考虑 header-right 内元素的动态变化

P2 的 C1 CSS 方案：
```css
.title-group {
  flex-basis: calc(100% - 44px);
  max-width: calc(100% - 44px);
}
.header-right {
  flex-basis: 100%;
  justify-content: flex-end;
}
```

问题：
1. `44px` 硬编码了 logo 宽度 (28px) + gap (16px)。如果 gap 变量 `--space-3` 值变化，计算会错位
2. `header-right` 换行后 `flex-basis: 100%` 使其独占一行，但 `justify-content: flex-end` 让内容右对齐。在移动端，Expires/Edit/TOC/Theme 右对齐可能超出安全区域（notch 机型）
3. 未考虑 `header-tags-hidden` 状态（滚动收缩 tags 时），此时 title-group 高度减小，header-right 仍独占一行可能视觉上不协调

**建议**: 
- `flex-basis` 使用 `calc(100% - var(--space-3) - 28px)` 替代硬编码
- 添加 `padding-right: env(safe-area-inset-right)` 适配 notch
- 验证 `header-tags-hidden` 状态下的换行布局

### MINOR-3: T049 normalize-arrows 删除后，现有测试用例需同步更新

当前 `diagramSanitize.spec.ts:38-42` 测试 "normalizes arrow syntax"，断言 `sanitize('A ->> B: msg', 'mermaid')` 结果不含 ` ->> `。这个测试依赖 `normalize-arrows` 规则。删除 `normalize-arrows` 后：
1. 此测试会失败（新规则 `fix-arrows` 需要上下文检测，纯 `A ->> B: msg` 无首行 diagramType，会安全降级不修正）
2. 测试用例需要改为包含完整 diagram 上下文的输入

**建议**: P4 实现时必须同步更新测试文件，所有箭头测试用例需包含首行 diagram 类型声明。

---

## 改进建议

1. **fix-arrows 增加 BOM/前导空格容忍**: 在规则函数内部先 strip BOM (`\uFEFF`) 和前导空行，再检测 diagramType。这比修改全局管线更安全
2. **fix-fullwidth-syntax 占位符方案细化**: 使用 `__PV_PH_N__` 格式（N 为递增数字），并在还原时按逆序替换（避免 `__PV_PH_1__` 被 `__PV_PH_10__` 的还原误匹配）
3. **覆盖统计修正后更新 gate_commands**: `mermaid-error-patterns.cjs | grep FAIL | wc -l` 的期望值需要基于修正后的数字，而非 "从 55 降至 ≤10"
4. **移动端 C1 方案增加 safe-area**: `padding-right: env(safe-area-inset-right)` 是 iOS notch 适配的标准做法，应在 P4 实现时一并加入

---

## 评审总结

| 维度 | 评价 |
|------|------|
| P1 覆盖完整性 | ⚠️ 覆盖统计有重复计算，需修正数字 |
| 设计决策数据支撑 | ✅ 方案选择有 P1 数据支撑，B1 vs B2 权衡合理 |
| 遗漏/风险 | ⚠️ 全角符号边界情况、BOM/前导空格、规则顺序依赖 |
| 方案选择理由 | ✅ B1 选择理由充分（归零修复风险偏好、最小改动） |
| C1 移动端方案 | ✅ 换行方案合理，但需补充 safe-area 和动态状态 |

**条件**: 修正 BLOCKER-1 的覆盖统计数字 + 补充 MAJOR-1/MAJOR-2 的边界处理方案后，可进入 P3。
