# P1 Review Progress — TPV0094 requirements-review

## 1. 派发指引 + 角色定义已读
- dispatch-context：8 条 BDD 评审，重点核对可二值判定 / 红线量级自洽 / 隐含需求覆盖（搜索态、TruncationBanner 互斥、空输入标量根）/ P1 纯净性 / P6 fixture 资源约束
- requirements-review 角色：检查清单（BDD 可二值判定 / 隐含需求覆盖 / 跨条一致性 / 裁剪合理性 / P1 纯净性），实质锚点要求（BDD 编号 + 覆盖维度）

## 2. P1-requirements.md 已读
- 8 条 BDD（BDD-1~8）标准 `#### BDD-NN:` 格式，连续
- domains: [frontend] / risk_level: low / phases 全走无裁剪 / capability 三态声明齐全，无 NEED_CONFIRM
- 隐含需求 8 条（#1 测试更新 / #2 切文件重置 / #3 递归计数 / #4 折叠态交互可用 / #5 TruncationBanner 互斥 / #6 搜索不回归 / #7 红线证据是交付物 / #8 空输入标量根边界）

## 3. P0-brief.md 已读（一致性核对）
- 核心需求三件套（默认全展开 / 超红线折叠+提示 / 红线实测）与 P1 复述一致
- 现状代码引用准确：resetExpansion 只展开根（TreeView.vue:127-133）确认无虚
- 预估红线 2000~5000、≤100 流畅，与 BDD-1(≤100)/BDD-3(10000) 量级余量自洽

## 4. TreeView.vue 已读（现状核验）
- resetExpansion() 仅对单根含 children 展开根 path，其余空 Set——确认 BDD-5 "切文件重新决定" 依赖 watch 重置路径（隐含 #2 判断正确）
- 无虚拟滚动，DataTreeNode 递归渲染——".tree-node 数 = DOM 节点数" 可稳定测量（BDD-1 判定条件成立）
- truncated 分支与 tree 渲染互斥（v-if/else），隐含 #5 正确
- matchCount 递归遍历不依赖 expandedPaths——BDD-7 判定成立

## 5. TreeView.spec.ts 已读（隐含 #1 核验）
- test_bdd_27/28（L84-111）断言初始 aria-expanded="false"——默认全展开后必 FAIL，隐含 #1 引用准确
- 其余测试（24/25/26/29/30/31/33~36）均不依赖初始折叠态，不受影响
- 现有 JSON_CONTENT 共 14 节点（6 根键 + tags 2 + meta 1 + 其余）——小于红线，默认全展开用例可复用

## 6. e2e/structured-data-viewer.spec.ts 已读（隐含 #1 + fixture 模式核验）
- test_bdd_27_expand_node / 28_collapse_node（L206-225）断言初始折叠态——必 FAIL，隐含 #1 引用准确
- createEntry beforeAll 经 API 建 entry 模式现成，新增多量级 fixture 无资源顾虑（5000/10000 节点紧凑 JSON << 2MB，不受截断分支影响）
- 注意：BDD-4 大文件手动展开测试的 fixture 需控制单次点击渲染量，避免一点开整棵 10000 节点树导致超时

## 7. DataTreeNode.vue / useTreeData.ts 已读
- 每个节点一个 `<li class="tree-node">`，全展开时 .tree-node 总数 = 节点总数（JSON 根容器不计节点，XML 根元素计节点——计数语义按格式一致即可，fixture 声明数与实现计数需一致）
- aria-expanded 只在含 children 行的 .expand-toggle 上——"所有含子节点行 aria-expanded=true" 可测量

## 8. 初步结论（待写 P1-review.md）
- 8 条 BDD 均可二值判定，红线量级余量自洽，隐含需求覆盖充分，无 GAP
- 发现（均非阻塞）：BDD-2 合并 YAML+XML 两场景（可接受，已注明各自独立验证）；BDD-8 测量协议松散（P2 minimal_validation 已承接）；BDD-5 fixture 依赖红线实测结果（相对选型可解）；SUGGEST 中 DEFAULT_EXPAND_THRESHOLD 常量名为实现细节（属 SUGGEST 合法倾向表达，P2 自决）
- 倾向 verdict: approved

## 状态标记
[PROD_NOT_TOUCHED] 只读评审：未修改任何项目源码文件，未修改 P1-requirements.md，未触碰生产 :8080 / ~/.peekview/，仅产出 P1-review.md + P1-review-progress.md

