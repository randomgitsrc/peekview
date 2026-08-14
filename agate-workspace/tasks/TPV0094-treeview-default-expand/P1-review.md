---
phase: P1
task_id: TPV0094-treeview-default-expand
type: review
parent: P1-requirements.md
trace_id: TPV0094-P1-review-20260814
status: approved
created: 2026-08-14
agent: requirements-review
---

# P1 Review — TPV0094 TreeView 默认展开优化

## 结论

**approved**（独立 requirements-review，非 main agent）。

P1-requirements.md 需求基线成立：8 条 BDD 均可二值判定，红线量级与 BDD-8 自洽，隐含需求覆盖充分（数据/前端/边界/兼容逐项核对），capability 三态判定正确无 GAP，无 [NEED_CONFIRM] 阻塞项。以下为逐条评审证据与 4 条非阻塞建议（不阻断推进，供 P2/P6 引用）。

## BDD 评审

每条判定均基于对现有代码的核验（`TreeView.vue` `resetExpansion()` L127-133 / `DataTreeNode.vue` 递归渲染 / `useTreeData.ts` 节点语义 / `matchCount` L151-163）。

- **BDD-1**（小 JSON 全展开）：✅ 可判定。无虚拟滚动，`DataTreeNode` 每个节点一个 `<li class="tree-node">`，全展开时 DOM `.tree-node` 数 = 节点总数，可在 DOM 层稳定测量；`aria-expanded` 仅存在于含 children 行的 `.expand-toggle`，可枚别。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-2**（小 YAML/XML 全展开）：✅ 可判定。⚠️ 合并了 YAML+XML 两个场景，不符合"多场景拆独立编号"的最严格形式；但 YAML（js-yaml→jsonToTreeData）与 XML（DOMParser→xmlToTreeData）产物语义不同（XML 根元素计节点、含 `@attr`/`#text`），展开逻辑格式无关，且 BDD 已注明"各自独立验证"——接受，建议 P6 将两者作为 BDD-2 双子场景逐条记录 PASS。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-3**（超红线大 JSON 折叠+提示）：✅ 可判定。折叠态仅渲染根层，`.tree-node` 数 << 节点总数，提示文案存在性可断言。10000 节点与预估红线 2000~5000 余量充分。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-4**（折叠态手动展开）：✅ 可判定。点击 toggle → `aria-expanded=true` → 子节点渲染可见，两步断言明确。⚠️ P6 fixture 需控制单次点击渲染量（避免点开整棵 10000 节点树导致断言超时），建议 fixture 拆成多个中等子树分支。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✗
- **BDD-5**（切文件重决定展开态）：✅ 可判定。现有 watch([content, format]) 清空 expandedPaths 并走 resetExpansion——新默认展开逻辑落在该路径即可（隐含 #2 判断正确）。⚠️ fixture "节点数分居红线两侧" 依赖 BDD-8 红线实测结果，P6 执行顺序须 BDD-8 先行、BDD-5 fixture 按实测红线相对选型（可用 100 vs 10000 固定余量规避）。覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-6**（展开态折叠/再展开可逆）：✅ 可判定。toggle 两击状态翻转可断言，与现有 test_bdd_28 断言同构。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-7**（折叠态搜索计数不受影响）：✅ 可判定。`matchCount` 递归遍历 `treeData` 不依赖 `expandedPaths`，计数非零可断言（aria-live="polite" 已存在）。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **BDD-8**（红线实测并记录证据）：✅ 可判定。各量级首帧时间 + 选定阈值 + 判定依据 + 5000 不白屏均可客观记录/测量。⚠️ "页面导航至 .tree-node 渲染完成" 起止点口径偏松（导航起点、渲染完成判定需精确定义），但 frontmatter `requires_minimal_validation: true` 已强制 P2 产出 minimal_validation 实测协议承接此点——自洽。覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✗

## 隐含需求覆盖

| 维度 | 覆盖情况 | 对应锚点 |
|------|---------|---------|
| 数据 | 递归子树计数口径（#3）；JSON/YAML/XML 三格式（BDD-1/2）；2MB 截断分支互斥（#5） | 覆盖 |
| 前端 | 切文件/格式重置（#2）；折叠态交互保留（#4）；折叠提示与 TruncationBanner 互斥（#5）；搜索态不回归（#6）；折叠提示渲染路径内新元素 | 覆盖 |
| 多端 | 纯前端改动，无 API↔客户端契约变更（domains: [frontend]）；多文件切换为前端状态（BDD-5） | 覆盖 |
| 边界 | 空输入/标量根/无 children 根（#8）；节点数极大值降级（BDD-3）；折叠态手动展开（BDD-4） | 覆盖 |
| 兼容 | 旧行为变更受控（小文件全展开为大文件折叠降级）；受影响测试识别准确（隐含 #1：单测 spec L84-111 + E2E spec L206-225 两条 test_bdd_27/28，逐行核验均断言初始折叠态，改动面确认为 3 文件非 1 文件，P7 保留正确） | 覆盖 |

## 裁剪评审

- `phases: [P1..P8]` 全走无裁剪，与 P0-brief 裁剪倾向一致（P3 因节点计数/阈值有可测行为保留，P6 因红线实测不可裁，P7 因 3 文件改动不满足单文件条件保留）——理由充分，同意。

## 红线量级自洽性（dispatch 重点）

- BDD-1（≤100 节点）远小于预估红线 2000~5000，BDD-3（10000 节点）远超其上界——两量级在红线未定时均有充分余量，且 P0-brief 实测估算（≤100 流畅）支撑，**接受当前"余量描述"**。残留风险仅当实测红线 <100 或 >10000（P0 估算下概率极低），BDD-8 实测后 P6 可复核锚定，无需现在改 BDD。

## P1 纯净性

- 无 P2 级方案内容掺入主体（无算法/组件结构/API 签名）。
- SUGGEST 中 `DEFAULT_EXPAND_THRESHOLD` 常量名、折叠提示复用 TruncationBanner 视觉模式、搜索命中自动展开留作 backlog——三者为 SUGGEST 机制下的合法倾向表达（有倾向但求确认、可弃），且均已标注非绑定，P2 拥有最终设计决策权，**不构成过度设计**。

## 非阻塞建议（不阻断，供 P2/P6 引用）

1. BDD-2 在 P6 按 YAML/XML 双子场景分别记录 PASS（不必回改 BDD）。
2. BDD-5 fixture 在 BDD-8 红线实测后相对选型，或直接用 100 vs 10000 固定余量。
3. BDD-4 大文件手动展开 fixture 拆成多个中等子树，控制单次点击渲染量。
4. 多量级 fixture 统一紧凑格式（5000/10000 节点 << 2MB 截断线，已核实无资源/截断顾虑）。
