---
phase: P2
task_id: T091-mobile-detail-visual-polish
type: review
parent: P2-design.md
trace_id: T091-P2-review-20260810
status: approved
created: 2026-08-10
revised: 2026-08-10
agent: plan-design-review
---

# P2-review — T091 方案设计复核（第 2 轮，plan-design-review）

## 结论

**approved**。上轮 needs-revision 标出的 3 处文档缺口（Wrap 按钮 aria-label/aria-pressed、Copy 按钮 tooltip 去留说明、E2E_SPEC 子串匹配脆弱性的显式承认）经本轮逐条核实，**均已在 P2-design.md 修订版中真实落笔，且写法/位置/论证质量均达标**，未发现表面应付或另生新问题。上轮已确认通过的 5 项重点检查本轮不重新展开（依据 dispatch-context 指令）。设计文档现已具备进入 P4 的组件完整性和可访问性覆盖，判 approved。

---

## 本轮 3 处缺口逐项复核

### 缺口 1：Wrap 按钮 aria-label/aria-pressed 是否真的补上，写法是否与 source-toggle 一致 —— **确认修复，写法精确一致**

- **上轮问题原始证据**（P2-review.md 旧版第 3 节）：现状 Wrap 按钮（`EntryDetailMobileBar.vue` 当时 L30-32）无任何 `aria-label`，图标化后会丢失全部可访问名称，属真实可访问性回归；要求补齐 `aria-label`/`aria-pressed`，对齐同文件内 `source-toggle` 既有模式。
- **核实 `EntryDetailMobileBar.vue` 现状（本轮独立读取）**：`source-toggle` 按钮实际代码（L21-24）：
  ```
  :class="['toggle-btn', { active: sourceViewMode }]"
  @click="$emit('toggle-source-view')"
  :aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"
  :aria-pressed="sourceViewMode"
  ```
  三元表达式绑定 `aria-label`、布尔值直接绑定 `aria-pressed`，双引号包裹表达式、内部字符串用单引号——这是本组件内唯一的既有三元式 aria-label 写法基准。
- **核实 P2-design.md 修订内容**：
  - 第 1 节改动表格（Wrap 按钮③）：`**新增 `:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"` 与 `:aria-pressed="wrapEnabled"`**（对齐同文件内 `source-toggle` 按钮既有模式，L22-23：`:aria-label="sourceViewMode ? 'Show rendered view' : 'Show source code'"` / `:aria-pressed="sourceViewMode"`）——现状 Wrap 按钮无任何 `aria-label`，可访问名称完全依赖按钮内可见文字节点，图标化后若不显式补充会丢失全部可访问名称，这是真实的可访问性回归，不是审美问题`
  - 第 9 节"实现完成的标志"：`Wrap 按钮（`mobile-bar-wrap-btn`）具备 `:aria-label="wrapEnabled ? 'Disable line wrap' : 'Enable line wrap'"` 与 `:aria-pressed="wrapEnabled"`，与同文件内 `source-toggle` 按钮的 aria 写法模式一致（可用 axe/手动检查浏览器可访问性树核验按钮存在非空可访问名称）`
- **判定**：语法结构（三元表达式、引号嵌套方式、`aria-pressed` 直接绑定布尔 prop）与 `source-toggle` 实际代码逐字符对应，不是"表面像"而是同一模式的精确复用；第 1 节（改动清单）与第 9 节（完成标志/可核验项）两处均有体现，满足 dispatch-context 要求的"两处都要有"。**本项确认真正修复**。

### 缺口 2：Copy 按钮 tooltip 去留说明是否补上 —— **确认修复，理由明确**

- **上轮问题原始证据**：`EntryDetailHeader.vue` 桌面端 `.icon-btn`/`.toggle-btn` 均配套 `.tooltip` span（纯 hover 驱动），但 P2-design.md 旧版全文未提及移动端新 `.icon-btn` 是否带 tooltip，属隐含假设未落笔。
- **核实 P2-design.md 修订内容**（第 1 节改动表格，Copy 按钮②）：`**不新增 `.tooltip` span**——移动端无 hover 交互语义，且本组件内既有的 file-tree/toc/source-toggle 三个 `.toggle-btn` 同样不带 tooltip，保持组件内一致性`
- **判定**：明确写出"不带"的结论 + 两条理由（移动端无 hover 语义 / 组件内既有先例一致性），理由本身与本轮独立核对 `EntryDetailMobileBar.vue` 现状（file-tree L3-10、toc L11-17、source-toggle L18-27 三个 `.toggle-btn` 确均无 `.tooltip` span）相符，不是编造依据。dispatch-context 只要求核实第 1 节，未强制要求 DESIGN.md 3.2 节同步补充移动端例外说明（上轮review原文对此是"如需要更完整"的可选建议，非必改项）——第 1 节已明确交代，**本项确认真正修复**，不构成遗留问题。

### 缺口 3：E2E_SPEC 子串匹配脆弱性的显式承认是否补上 —— **确认修复，承认到位且不止步于"现在没问题"**

- **上轮问题原始证据**：P2-design.md 旧版第 5 节只回答了"当前目录内没有其他文件会意外匹配"（时点判断），未正面回答"这是不是一个被有意识接受的技术债"。
- **核实 P2-design.md 修订内容**（第 5 节末尾新增段落）：`**显式承认 `E2E_SPEC=e2e/t09` 的脆弱性，非疏忽**：这是无锚定的子串正则匹配，不是精确文件名匹配、也不是 glob——未来若新增文件名恰好包含 `t09` 子串（如误粘贴、命名巧合），会被静默纳入这次 gate 的测试范围而不会报错。本任务有意识接受这个取舍：`gate_commands` 只服务本任务窗口期（P3-P6），P8 发布完成后即失去时效性，不会被后续任务复用或残留在长期运行的脚本里；用更精确的写法（显式文件列表或更严格的 glob）能消除这个脆弱点，但成本收益比不构成本任务必须解决的问题。`
- **判定**：三个要素齐全——①明确点出脆弱性的具体触发场景（未来文件名巧合命中 `t09`）、②明确声明"本任务有意识接受"而非停留在"现在没问题"、③给出接受的理由（gate_commands 时效性范围 + 成本收益比），并保留原有的时点实测数据（29 个文件、无第三方误匹配）作为佐证而非替代论证。与上轮要求的"承认这是有意识接受的技术债"逐字对应。**本项确认真正修复**。

---

## 5 项重点检查项（上轮已通过，本轮不重新展开）

按 dispatch-context 指令，以下 5 项本轮不重新核实，沿用上轮结论：T090 遗留 E2E 冲突判断准确、E2E_SPEC 子串匹配技术判断成立（脆弱性承认已在缺口 3 补齐）、svg-standalone 替代不构成 [BASELINE_CHANGE] 论证成立、candidate_count=1 理由充分。Copy tooltip 行为经本轮缺口 2 复核确认已闭合。

---

## 评分维度（0-10，本轮复核后）

| 维度 | 分数 | 理由 |
|---|---|---|
| 交互状态覆盖率 | 8 | 纯 CSS/图标视觉打磨任务定位不变，边界场景已在 P1 声明；Wrap 按钮 active/inactive 两态现已同步补齐 aria-pressed 表达，上轮扣分点已闭合，维持 8（非满分因任务性质本身交互状态种类有限，非缺陷）。 |
| AI Slop 风险 | 9 | 维持上轮评价：像素值、文件/行号、DESIGN.md 前后对照文字精确，P4 发挥空间极小。 |
| 移动端考虑 | 9 | 维持上轮评价：390×844 实测、safe-area、44×44 触控热区、桌面端隔离守卫齐全。 |
| 可访问性 | 9 | 上轮唯一的实质回归项（Wrap 按钮 aria-label/aria-pressed 缺失）经本轮核实已按 source-toggle 既有模式精确补齐，覆盖第1节改动清单+第9节完成标志两处；Copy 按钮 tooltip 去留决定也已显式落笔并有站得住的理由。未给满分保留 1 分：`.icon-btn`/`BaseButton` 44px 触控线的跨组件不一致仍是已知技术债（P2 已声明不在本任务范围，非本轮新增问题）。 |
| 组件完整性 | 9 | 上轮命中的"P4 会凭空实现"缺口（Wrap aria 属性、Copy tooltip 去留）均已补齐输入/输出描述，不再有隐含假设需 P4 自行判断。 |

---

## 是否需要补充设计

**不需要**。3 处上轮缺口均已验证真实修复，写法与既有模式精确对齐，论证完整，无新增遗漏。可进入 P4。
