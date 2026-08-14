# TPV0094 P1 progress（analyst）

## 2026-08-14 已读文件
- [x] P1-dispatch-context-analyst.md（派发指引，status:ready 可直接复用）
- [x] analyst.md 角色定义
- [x] P0-brief.md（task/known_risks/env_constraints）
- [x] frontend-v3/src/components/TreeView.vue（resetExpansion:127-133、watch 重置、matchCount 遍历）
- [x] frontend-v3/src/components/DataTreeNode.vue（递归自引用、无虚拟滚动、inject TreeExpandKey）
- [x] frontend-v3/src/types/structured-data.ts（TreeDataNode: path/key/value/type/children）
- [x] frontend-v3/src/composables/treeExpandKey.ts（provide/inject 契约）
- [x] frontend-v3/src/components/__tests__/TreeView.spec.ts（13 用例）
- [x] frontend-v3/e2e/structured-data-viewer.spec.ts（BDD-24~36，beforeAll 经 API 建 entry 模式）
- [x] frontend-v3/src/components/EntryDetailContent.vue（TreeView 挂载点）

## 关键发现
1. **破坏性影响（兼容维度）**：现有单测 + E2E 断言"默认折叠"：
   - TreeView.spec.ts:89 test_bdd_27 断言 meta aria-expanded='false'；:97-111 test_bdd_28 双击 toggle 后断言 false → 默认展开后必挂
   - e2e/structured-data-viewer.spec.ts:206-225 test_bdd_27_expand_node / test_bdd_28_collapse_node 同样断言默认折叠 → 必挂
   → 改 TreeView.vue 的同时必须更新这两个测试文件（P4/P5/P7 范围），**不是单文件改动**
2. resetExpansion 现状：单根有 children 时展开根，否则空 Set → 需改为"节点总数 ≤ 阈值全展开"
3. watch([content, format]) 重置 treeData+expandedPaths+search → 切文件自动走 resetExpansion，天然满足"切文件重置"
4. 搜索 matchCount 遍历全树与展开态无关 → 大文件折叠态下搜索仍可工作（命中高亮但不自动展开，现有行为）
5. 红线阈值 P1 无法定值 → BDD 需用"远小于/远大于预估范围"的 fixture 保证二值可验，阈值实测定于 P6

## 2026-08-14 完成
- P1-requirements.md 已产出（140 行，8 条 BDD：BDD-1/2 默认全展开、BDD-3/4 超红线折叠+提示、BDD-5 切文件重置、BDD-6/7 交互不回归、BDD-8 红线实测）
- frontmatter：risk_level=low / phases 全走（P7 保留因改动 3 文件）/ domains=[frontend] / packages=4 个文件 / capability_requirements 三态（无 GAP）/ requires_minimal_validation=true
- [NO_NEED_CONFIRM]，3 条 [SUGGEST]
- 关键决策：现有 BDD-27/28 单测+E2E 断言默认折叠必挂 → 同步更新测试，P7 由可裁变保留
