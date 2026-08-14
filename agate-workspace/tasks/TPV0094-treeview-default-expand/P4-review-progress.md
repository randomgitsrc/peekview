# P4 review-progress — design-review

## 已读输入

1. P4-dispatch-context-design-review.md：单评审角色（frontend domain → design-review），只审不写，产出 P4-review.md（status 初始 draft，完成改 approved/rejected/needs-revision），结论须引用行号/设计节/BDD 编号
2. design-review.md 角色定义：AI Slop 必查（violet 渐变/泛化文案/全居中/同质卡片 grid）；Typography/Spacing/交互状态检查；门槛产出 Header 必须含 status
3. P4-implementation.md：单文件改动 TreeView.vue；DEFAULT_EXPAND_THRESHOLD 独立 script 块导出；totalNodeCount/hasBranchNode/shouldCollapse；resetExpansion 二分；banner v-else 分支；自查 17 单测过 / 1232 passed / typecheck passed
4. P2-design.md：候选 A 定稿（§2 L48-98 代码块 + §3 定稿表 + §3 边界处理 L127-147 + §4.1 互斥）
5. P1-requirements.md：8 条 BDD + 隐含需求 #1-8
6. TreeView.vue（评审对象）：实现 L48-50 导出、L82-102 三 computed、L164-178 resetExpansion、L21-29 banner、L253-264 样式
7. TruncationBanner.vue（视觉参照）：L21-33 样式基线
8. DESIGN.md（设计系统）：§12 Do/Don't（semantic alias tokens、4px 网格、lucide icons、无 color-mix）
9. TreeView.spec.ts：P3 已写断言语义（test_bdd_1/3/6/7 + 更新 27/28），import DEFAULT_EXPAND_THRESHOLD
10. P3-test-cases.md：断言语义对照

## 一致性核对（P2 §2/§3 代码块 vs 实现）

- DEFAULT_EXPAND_THRESHOLD=2000 导出：实现 L49 == P2 L53 ✓（双 script 块解决 <script setup> 不能 ESM export 的问题，Vue 合法模式，typecheck passed）
- totalNodeCount：实现 L82-92 == P2 L55-65 逐字一致 ✓
- hasBranchNode：实现 L94-98 == P2 §3 L132-136 一致 ✓
- shouldCollapse：实现 L100-102 == P2 L73-75 一致 ✓
- resetExpansion 二分：实现 L164-178 == P2 L77-93 一致（≤阈值递归 collect 全展开 / >阈值空 Set 根折叠）✓
- banner：实现 L21-29 在 v-else 分支、no-data/tree-list 前、v-if=shouldCollapse、data-testid="tree-collapse-banner"、role="status"、文案「内容较大，已折叠部分」——与 P2 §3 完全一致 ✓
- banner 样式：实现 L253-264 与 TruncationBanner L21-33 逐属性一致（warning-bg/text/border、space-2/3、radius-md、font-sm）✓
- P2 §4.1 互斥：banner 在 v-else 分支内，与 TruncationBanner v-if=truncated 天然互斥 ✓

## 视觉/交互检查（design-review 本职）

- AI Slop：无 violet 渐变、无泛化文案、无全居中布局、无同质 grid——banner 与既有截断 banner 视觉完全一致，符合设计系统 ✓
- 设计系统 token：全部用 var(--space-*)/var(--radius-md)/var(--warning-*)，无硬编码 hex，无 color-mix ✓（DESIGN.md §12）
- 间距：space-2/space-3（8/12px）4px 倍数 ✓；radius-md 6px 为既有 token（TruncationBanner 同用）
- Icon：AlertTriangleIcon :size="16" 与 TruncationBanner 一致（DESIGN.md §7 16px inline）✓
- aria：role="status" 合理（status 提示非交互元素，无需 focus）✓
- 交互状态：banner 无交互，无需 hover/focus/disabled ✓
- [OBSERVATION] 移动端 banner 字号 font-sm=14px，低于角色清单「移动端最小 16px」建议；但与既有 TruncationBanner 一致（同 14px），保持既有 banner 模式一致性优先——不阻塞
- [OBSERVATION] 用户手动展开根后 banner 仍显示「已折叠部分」，文案轻微滞后于展开态；此为 P2 定稿语义（shouldCollapse 基于节点数非展开态），非实现偏差——不阻塞

## 回归风险核对

- 现有 13 用例（BDD-24~36）：27/28 已由 P3 更新为默认展开语义；24/25/26 渲染、29 类型标签、30 搜索、31 点击复制（age 为根直子，全展开下仍可见）、32 yaml 安全、33/34/35 截断（truncated 分支，treeData 不解析，resetExpansion 不涉及）、36 空输入（treeData=[], totalNodeCount=0 ≤ 阈值 → collect 空 → 空 Set 不崩）——均不受新逻辑破坏 ✓
- watch 重置时序：immediate watch 内 treeData 先 parseTree() 赋值再 resetExpansion() 读取 totalNodeCount，时序安全 ✓
- 空输入/标量根：scalarLeaf 无 children → collect 不收集 → 空 Set → 正常渲染叶子 ✓
- 顶层宽数组：hasBranchNode=false → shouldCollapse=false → 无 banner，P2 §3 接受行为 ✓

## 测试一致性

- test_bdd_1：JSON_CONTENT 9 节点，totalNodeCount=9 ≤ 2000 → 收集 tags/meta 两 branch path → 全展开，aria-expanded=true 计数=2 == totalBranchNodes ✓
- test_bdd_3/7：buildDeepChain(THRESHOLD+2) 深层链 > 阈值 → 空 Set 根折叠 + banner 显示 ✓（P2 §9 深层链 fixture 提示已落实）
- test_bdd_6：小文件默认展开 → 点击折叠 → 再点展开可逆 ✓
- 实现满足 P3 断言语义，无冲突

## 结论

- 无 BLOCKER，无 CRITICAL
- 2 个 OBSERVATION（移动端字号 14px 与 banner 文案滞后）均为非阻塞、与既有模式/设计定稿一致
- status: approved
