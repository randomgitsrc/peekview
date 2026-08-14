# P3-progress — TPV0094-treeview-default-expand (test-designer)

## 2026-08-14
- [x] 读取 P3-dispatch-context-test-designer.md：8 BDD → 测试用例映射表已确认；test_bdd_27/28 必须更新为默认展开语义；BDD-8 不写用例；红线 fixture 平铺专用于 P6，BDD-3/4 用 10000 节点分支结构
- [x] 读取 test-designer.md 角色定义：BDD 1:1 映射、测试名引用 BDD 编号、vitest mock hoisting 反模式（vi.mock 回调只字面量）
- [x] 读取 P0-brief.md：TreeView 默认只展开根；性能红线 2000~5000；纯前端
- [x] 读取 P1-requirements.md：8 条 BDD 定义清晰（BDD-1/2 小文件全展开、BDD-3/4 大文件折叠+提示+手动展开、BDD-5 切文件重置、BDD-6 toggle 可逆、BDD-7 折叠态搜索、BDD-8 红线实测）
- [x] 读取 P2-design.md：实现语义确认（totalNodeCount 递归计数 / DEFAULT_EXPAND_THRESHOLD=2000 导出 / 全展开收集 path / >阈值空 Set / shouldCollapse 判定 / banner data-testid="tree-collapse-banner"）；BDD-3 单测用 >阈值深层链（约 2001 节点链）；fixture 相对阈值构建
- [x] 读取 TreeView.vue：resetExpansion L127-133（只展开根）；watch L135-145（content/format 变化 → resetExpansion）；matchCount 全树遍历；模板 v-if=truncated / v-else（tree 分支）；当前无 banner、无 totalNodeCount、无 DEFAULT_EXPAND_THRESHOLD 导出
- [x] 读取 DataTreeNode.vue：isExpanded = expandedPaths.has(path)（L62）、toggle → togglePath（L74）、递归渲染 v-if="hasChildren && isExpanded"（L33）——契约不变
- [x] 读取 TreeView.spec.ts：现有 13 用例；test_bdd_27/28（L84-111）断言初始 aria-expanded="false" 需改为默认展开语义；mount/fixture 模式（mountTree + JSON_CONTENT）
- [x] 读取 e2e/structured-data-viewer.spec.ts：test_bdd_27/28（L206-225）同改；beforeAll 经 :8888 API 建 entry 先例（L34-60）；gotoEntry 模式；desktop/mobile viewport 已配置
- [x] 读取 structured-data.ts：TreeDataNode { key, value, type, children?, path }
- [x] 读取 P2-review.md：approved；R1/R2/R3 已落实；shouldCollapse/hasBranchNode 定义在 §2/§3 两处逐字符一致；BDD-3 单测用深层链提示在 §9
- [x] 读取 useTreeData.ts / treeExpandKey.ts / vitest.config.ts：jsonToTreeData 根对象→每 key 一节点；XML 含 @attr/#text 子节点；vitest exclude e2e/；TreeView 当前无 DEFAULT_EXPAND_THRESHOLD 导出
- [x] 已写 P3-test-cases.md（含 test_code_dir + BDD 1:1 映射）
- [x] 单测：新增 test_bdd_1/3/6/7（4 用例）+ 更新 test_bdd_27/28（默认展开语义）；helper（countNodeValue/totalRenderedNodes/totalBranchNodes/buildDeepChain）从 fixture 同源推导计数，无手写魔数
- [x] E2E：新增 test_bdd_1/2/3/4/5/6/7（7 用例）+ 更新 test_bdd_27/28；beforeAll 追加 t094-large/t094-multi；helper（buildLargeBranchJson/countNodeValue/totalRenderedNodes）
- [x] 红灯确认：`npx vitest run`（= make test-frontend）6 failed，全部 B 类（断言与未实现行为矛盾：初始 aria-expanded 折叠、banner 未实现）；1226 passed | 4 skipped
- [x] vue-tsc：仅 TS2614（DEFAULT_EXPAND_THRESHOLD 未导出）——预期，P4 导出后消除
- [x] 返回前自检：git status 仅含 2 测试文件 + P3 产出；[PROD_NOT_TOUCHED]
