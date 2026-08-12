---
phase: P2
task_id: T052-entry-detail-header-redesign
type: review
parent: P2-design.md
trace_id: T052-P2-review-20260710
status: approved
created: 2026-07-10
agent: plan-design-review
---

# P2 设计评审：Entry Detail Header 重新设计

## 各维度评分

### 1. 交互状态覆盖率 — 8/10

**已覆盖的 edge cases：**
- Desktop short title / long title / owner / guest / private / overflow open（s1-desktop.html 5 states）
- Mobile .md / text-code / binary 三态底部栏（s2-mobile.html 3 phones）
- Long title 不换行，actions 仍可触达（s1-desktop.html state 2）
- Single-file 无 Files 按钮（§1.2: `v-if="isFileTreeOpen && isMultiFile"`）
- TOC 无 headings 时不显示（§1.2: `tocHeadings.length > 0` 条件）
- Binary 文件只有 [...]（§1.4 条件链第三分支）
- Overflow items 按 owner/guest 角色动态过滤（BDD B7）

**缺失：**
- **Loading 状态**：entry 数据尚未返回时，header 和 bottom bar 的渲染状态未定义。P2 没有 skeleton/placeholder 方案。
- **Error 状态**：entry fetch 失败时 header 如何展示？未提及。
- **Empty tags**：meta-row 中 tags 为空时，分隔符和空白处理未讨论（DESIGN-SPEC 也未覆盖）。
- **Desktop sidebar 关闭态**：两侧 sidebar 均关闭时 empty content 区满宽的情况已在 layout.css 的 flex 模式覆盖（content flex:1），但未显式说明。

**影响**：非 blocking。Loading/error 在 EntryDetailView.vue 原有 `v-if="entry"` 逻辑中已有兜底，但新 header 设计应配合说明 loading 时的占位方案。建议 P4 补充最小 skeleton（title 部分+meta 部分灰条），或在已有 loading 逻辑上确认无影响。

---

### 2. AI Slop 风险 — 9/10

**亮点：**
- 每个设计项均有 ≥2 候选方案 + 比较表 + 选择理由（§1.1-§1.8）
- 关键决策有 `minimal_validation` 验证结果（§4：PUSH vs OVERLAY 已通过 HTML 原型验证）
- OverflowMenu 接口完整定义 TypeScript 类型（`OverflowMenuItem` 含 label/icon/hint/href/variant/divider/action）
- Mobile bottom bar 给出几乎可直接使用的 template 代码（§1.4）
- 每个方案映射到现有代码的具体行号（§3 files_to_read）
- [SCOPE+] 发现明确指出 P1 未覆盖的 lucide-vue-next 依赖和测试文件作废问题
- 16 条 BDD 验收条件与设计项一一对应

**风险分析**：极低。不同实现者基于该 spec 应能产出一致的 UI。

**唯一模糊点**：
- Toggle button active CSS class 的精确样式（`background: rgba(77,141,255,.12); color: var(--c-accent-secondary); border-color: rgba(77,141,255,.2)`）在 DESIGN-SPEC 中而非 P2 中定义。但 P2 引用了 DESIGN-SPEC 和 HTML 原型，cross-reference 可消除歧义。

---

### 3. 移动端考虑 — 9/10

**覆盖内容：**
- Sticky header 52px 毛玻璃（§1.5）：position sticky, z-index, background, backdrop-filter, responsive breakpoint display:none
- Bottom bar 三态动态变化（§1.4）：完整条件链 template，Files 按钮位置 layout
- Meta-tags-bar scroll-hide（§1.6）：Intersection Observer sentinel 方案，opacity transition
- Overflow bottom sheet（§1.3）：Teleport, position fixed, backdrop overlay, 16px 圆角, drag handle, safe-area-inset-bottom
- ThemeToggle mobile 在 overflow sheet 中（§1.7）
- 响应式断点统一为 768px（§1.11）
- Files badge 数字实时响应（D15）

**缺失：**
- Tablet（768-1023px）的精确行为：P2 说 >=768 用 desktop layout（2-row header），但当前 codebase 同时使用了 768 和 1024 断点。`layout.css` 中的 1024 breakpoint（当前用于 `.detail-header` sticky）是否需要移除或调整？P2 说 "保持统一" 但未检验 1024 breakpoint 的具体影响。
- Mobile keyboard（外部键盘连接时）如何触达底部栏按钮？非阻塞。

**影响**：非 blocking。Tablet 断点冲突需在 P4 实现时确认 layout.css 的 1024px media query 是否覆盖了正确的选择器。

---

### 4. 可访问性 — 3/10

**已覆盖：**
- **Tooltip**：DESIGN-SPEC §2.3 和 s1-desktop.html prototype 均包含 tooltip（hover 200ms 后在按钮下方显示）。P2 §7 完成标准中提及 "icon-only 按钮 32×32，tooltip 悬停提示"。

**未覆盖：**
- **键盘导航**：未提及 Tab 键顺序、Enter/Space 触发的交互。OverflowMenu 在 dropdown 模式下的键盘导航（方向键选择、Escape 关闭）完全未定义。
- **Focus 管理**：OverflowMenu dropdown/sheet 打开后 focus 应移到第一个 item；bottom sheet 打开时 focus 应 trap；关闭后 focus 应回到 trigger 按钮。均未提及。
- **Screen reader**：无 `aria-label`、`role`、`aria-expanded` 等语义属性的设计。Toggle button（Files/TOC）需要 `aria-expanded` 和 `aria-controls` 与 sidebar 关联。ThemeToggle 需要 `aria-label="Switch to dark/light theme"`。
- **Bottom sheet backdrop**：点击 backdrop 关闭 sheet 的行为未指定是否只通过 backdrop click 还是也可通过 Escape 键。
- **Color contrast**：未检查 active toggle button 的 `rgba(77,141,255,.12)` 背景 + `color: var(--c-accent-secondary)` 前景的对比度是否达标。虽然此类细节通常由 P4 实现者处理，但在 design review 中标注有助于约束实现。

**影响**：非 blocking（本任务为 UI 设计重排，a11y 在现有代码基础上已有部分无法一蹴而就），但建议 P4 实现前补充：
1. `<button>` 上的 `aria-label` 属性映射表
2. Toggle buttons 的 `aria-expanded` + `aria-controls`
3. OverflowMenu 的 Escape 关闭 / focus trap（bottom sheet 模式）
4. Bottom sheet 关闭后 focus 回到 trigger

---

## 综合结论

| 维度 | 评分 | 判定 |
|------|------|------|
| 交互状态覆盖率 | 8/10 | minor gaps（loading/error 未覆盖） |
| AI Slop 风险 | 9/10 | 极低，方案选择有理有据 |
| 移动端考虑 | 9/10 | 全面，tablet 断点需确认 |
| 可访问性 | 3/10 | 仅 tooltip 覆盖，键盘/屏幕阅读器/focus 管理缺失 |

**Status: approved** — 非 blocking 问题，建议 P4 实现时补充 a11y 属性和 loading 态确认。设计决策清晰、可选方案有比较、最小验证已执行，满足前进到 P3 条件。

**改进建议（非门槛）：**
1. P4 实现前补充 button aria-label 映射表 + aria-expanded 设计
2. P4 确认 tablet（768-1023px）layout.css 的 1024 breakpoint 是否需调整
3. P4 检查 loading 态下 header 的渲染状态（可能复用现有 `v-if="entry"` 逻辑无需额外工作）
