# P2-review-progress — plan-design-review

## 2026-08-14 读取 1: dispatch-context + role 定义
- 派发指引确认：只审不写，产出 P2-review.md，status 字段 gate 判定依据
- 评审重点 5 项 + 特别关注点 5 项（红线协议/candidate B/gate 合规/[SCOPE+]/测试同步）

## 2026-08-14 读取 2: P2-design.md
- 候选 A（selected）：resetExpansion 按 totalNodeCount 二分 + 折叠 banner；候选 B（rejected）：defaultExpanded 标记
- 四字段齐全：candidate_count=2, packages=[TreeView.vue, TreeView.spec.ts, e2e spec], domains=[frontend], ui_affected=true
- gate_commands 全引用 Makefile target（make test-frontend/typecheck/debug-quick/debug-test）+ P6_redline（npx tsx 自定义脚本，符合 AGENTS.md 先例）
- 设计声明：design_trivial + follows_existing_pattern，仍写 2 候选
- 发现 F1: shouldCollapse 在 §1/§2/§3 引用但全文未定义计算式（AI-slop 缝隙）
- 发现 F2: 大平层树（单根+海量叶子 / 顶层宽数组）totalNodeCount>阈值 → else 分支保留「展开根」，全部叶子渲染 + banner 文案「已折叠部分」为假；与 BDD-3 Then 子句（.tree-node<节点总数）语义矛盾；§3 边界处理只覆盖空/标量/无子根，遗漏此最常见 JSON 形态
- 发现 F4: frontmatter packages 未含新增 scripts/measure-treeview-perf.ts（[SCOPE+] 自述「packages 已含」不准确，cosmetic）

## 2026-08-14 读取 3: P1-requirements.md
- 隐含需求 8 条逐条核对；BDD-1~8 对照设计覆盖：BDD-2/5 仅 E2E（合理，格式无关/页面级）；BDD-4 fixture 深度化（§4.3）合理
- 隐含需求 #1 准确（见下）
- requires_minimal_validation: true → P2 minimal_validation 块存在且 result=confirmed（计数口径+量级区分度 P2 实跑确认，绝对阈值 P6 交接，诚实声明）

## 2026-08-14 读取 4: P0-brief.md
- 核心需求 1/2/3 与设计对齐；known_risks 预估 2000~5000 与设计默认 2000 一致
- 发现 F5(轻微): P0-brief 原文「可能 DataTreeNode.vue（如需优化渲染）」并未禁止改 DataTreeNode——「P0-brief 明确要求不改」实为 P1 隐含需求 #4；否决理由仍成立（契约双源、toggle 无法折叠默认展开节点等真实缺陷），不影响结论

## 2026-08-14 读取 5: TreeView.vue
- resetExpansion L127-133、watch L135-145、模板 v-if=truncated L3-34、matchCount L151-163 与设计引用逐行吻合
- 确认 F2 可复现：else 分支对单根含子节点必展开根（L128-129）→ 大平层全量渲染
- 顶层宽数组根（treeData.length>1）走 else 空 Set，叶子全渲染，banner 仍触发 → F2 第二种形态

## 2026-08-14 读取 6: DataTreeNode.vue
- hasChildren L61 / isExpanded L62 / toggle L74-76 契约保留，递归渲染 v-if L33-41 ——「不改」边界成立，候选 A 与现状无矛盾

## 2026-08-14 读取 7: 测试文件
- TreeView.spec.ts test_bdd_27/28 L84-111 断言初始 aria-expanded=false → 隐含需求 #1 判断准确，必须更新
- e2e structured-data-viewer.spec.ts test_bdd_27/28 L206-225 断言初始 false → 同准确
- 单测 BDD-3 需 >阈值 fixture（2001 节点 jsdom 挂载，P3 注意耗时，非阻断）
- e2e beforeAll 现有 t075-yaml/xml 小 fixture 可复用于 BDD-2

## 2026-08-14 读取 8: treeExpandKey / TruncationBanner / structured-data / useTreeData
- TreeExpandKey 仅 expandedPaths+togglePath，candidate B 需改此文件确认
- TruncationBanner role="status" + warning 视觉 L21-56，折叠 banner 复用模式合理
- useTreeData：JSON 对象根 → treeData=[单根含子]，确认 F2 形态一成立；顶层数组 → treeData.length>1 叶子，确认形态二

## 2026-08-14 红线协议（§8）执行性核查
- 发现 F3: 归一化口径正文（条件化「若根已自动展开先折叠」）对平铺 fixture 可执行（单次根点击即达 N）；但括注「阈值以上量级初始折叠，直接测」与 else 分支（根自动展开）矛盾；fixture 结构（平铺 vs 深层）未声明——须平铺否则单次点击无法达 N
- T0（addInitScript 页内 performance.now）/ T1（waitForFunction .tree-node==N）同页时钟非脆弱；≤500ms 判定标准合理；判定规则②取满足预算最大量级合理
