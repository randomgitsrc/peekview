# P2 Progress — TPV0094-treeview-default-expand

## 读取记录

- [x] dispatch-context-architect.md — 派发指引：design_trivial + follows_existing_pattern → 候选可 1 个；requires_minimal_validation=true → minimal_validation 必须含红线实测协议
- [x] architect.md 角色定义 — 影响域分析/候选方案/四字段/frontmatter/gate_commands/files_to_read/env_constraints/minimal_validation 要求
- [x] P0-brief.md — 需求：默认全展开 + 节点数超红线降级折叠+提示；红线需 Playwright CDP 实测 100/500/1000/2000/5000；改动面单文件前端；risk=low

- [x] P1-requirements.md — 8 BDD；risk=low; domains=[frontend]; design_trivial=true; requires_minimal_validation=true; 隐含需求 #1 确认改动面 3 文件（TreeView.vue + TreeView.spec.ts + e2e spec）
- [x] P1-review.md — approved；4 条非阻塞建议：BDD-2 P6 双子场景记录 / BDD-5 fixture 用 100 vs 10000 固定余量 / BDD-4 手动展开 fixture 拆多个中等子树 / 多量级 fixture 紧凑格式 << 2MB

- [x] TreeView.vue — resetExpansion L127-133 只展开根；watch([content,format]) L135-145 清空后走 parseTree+resetExpansion；matchCount 递归遍历不依赖 expandedPaths；truncated(>2MB) 走 TruncationBanner 分支与 tree 互斥；DataTreeNode 递归渲染，isExpanded 靠 inject expandedPaths
- [x] DataTreeNode.vue — 递归自引用；hasChildren 判定 children?.length>0；isExpanded=expandedPaths.has(path)；toggle 两击可逆契约；无需改动（隐含需求 #4 确认）
- [x] structured-data.ts — TreeDataNode {key,value,type,children?,path}，path 唯一标识，无类型问题

- [x] TreeView.spec.ts — 13 用例；test_bdd_27/28 断言 meta 节点初始 aria-expanded="false"，默认全展开后必改；选择器契约用 class 而非 data-testid
- [x] e2e/structured-data-viewer.spec.ts — beforeAll 经 API 建 entry 先例；test_bdd_27_expand_node/test_bdd_28_collapse_node 断言初始折叠态，需同步；有 E2E 证据目录先例
- [x] useTreeData.ts / treeExpandKey.ts / TruncationBanner.vue — jsonToTreeData/xmlToTreeData 结构；TreeExpandKey 提供 expandedPaths+togglePath；TruncationBanner 样式（warning-bg）可复用
- [x] Makefile 核对 — test-frontend=vitest run 非 watch；typecheck=vue-tsc --noEmit；debug-test=E2E；debug-quick=build-fast+start+seed
- [x] playwright.config.ts — CDP endpoint 支持；e2e/ 目录 40 个 spec；baseURL :5173
- [ ] minimal_validation — debug backend :8888 未运行（000）；Chrome CDP :18800 可用（200）→ 红线实测协议设计 + P6 交接，工具可用性需 CDP 连接验证


## 关键步骤

### 最小验证（Chrome CDP :18800 实测）
- CDP 连通性确认：connectOverCDP 成功，page.goto/evaluate 正常 → P6 实测工具链可用
- 递归全展开渲染 bench（纯 DOM innerHTML 模拟 DataTreeNode 递归结构）：
  - n=100: build 0.2ms / render 98ms / domCount=100 / navTotal 149ms
  - n=500: 0.3ms / 43ms / 500 / 77ms
  - n=1000: 0.4ms / 41ms / 1000 / 66ms
  - n=2000: 0.3ms / 69ms / 2000 / 98ms
  - n=5000: 2.0ms / 125ms / 5000 / 158ms
- **结论**：DOM 计数口径可靠（domCount==n 精确匹配）；量级间有区分度；5000 raw DOM ~125-158ms 不白屏
- **注意**：bench 是纯 DOM，真实 TreeView 每节点一个 Vue 组件实例（成本更高）→ 绝对阈值仍须 P6 在真实 TreeView 实测，本验证确认测量协议可行 + 给 raw-DOM 下界参考
- 首帧口径：页内 performance.now() 同时间基准（page.addInitScript 记 T0 → .tree-node 达期望数 + 双 rAF 记 T1），排除 CDP 跨进程往返延迟


## 完成

- [x] P2-design.md 落盘（234 行）：frontmatter 四字段齐全（candidate_count=2 / packages=3文件 / domains=[frontend] / ui_affected=true）
- [x] 2 候选方案（A 全展开路径预收集选定 / B 默认展开标记下传否决——触碰 DataTreeNode.vue 违反 P0 约束）
- [x] gate_commands 引用 Makefile target（test-frontend/typecheck/debug-test/debug-quick）+ 红线实测独立脚本路径；ui_affected=true 含 P5_e2e
- [x] files_to_read 7 文件；env_constraints 细化；minimal_validation 含红线实测协议（量级/首帧口径/判定标准），result=confirmed
- [x] 自检通过：所有必需字段已落盘，文件非空

## 修订轮 rev1（2026-08-14）

- [x] R1（F2 大平层树边界）：§2 代码块 else 分支改为 `expandedPaths` 置空 Set（根也折叠）；新增 `hasBranchNode` computed（全树递归找含子节点节点）；§3 边界处理补单根+海量叶子（真实折叠+性能保护生效）与顶层宽数组（hasBranchNode=false → 无 banner，诚实，无性能保护为接受行为）两分支
- [x] R2（F1 shouldCollapse 定义）：§3 补完整定义（`totalNodeCount > 阈值 && hasBranchNode`，与 §2 代码块一致）；banner 渲染条件 = shouldCollapse true 且在非 truncated 分支（v-else 内）
- [x] R3（F3 红线协议）：§8 redline_protocol 声明平铺 fixture（单根+N-1 叶子，量级=N，单次根点击即达 N）；删除「阈值以上初始折叠直接测」错误括注，统一「若 .tree-node>1 先折叠 → T0 → 点击根 → 等 N → T1」测量路径（阈值以下预折叠、阈值以上直接测）；各量级 100/500/1000/2000/5000 均为平铺结构
- [x] F5 采纳：候选 B 否决理由改引 P1 隐含需求 #4（并注明 P0-brief 原文未禁止改 DataTreeNode）
- [x] F4 采纳：frontmatter packages 补入 frontend-v3/scripts/measure-treeview-perf.ts（§1 表中已含该文件，自述措辞同步）
- [x] P3 单测提示采纳：§9 实现提示注明 BDD-3 单测用 >阈值深层链（~2001 节点），宽分支/平铺大 fixture 留 E2E/红线层
- [x] 移动端说明采纳：§7 env_constraints 补 mobile 字段（移动端同受单阈值保护，未分端）
- [x] BDD-3/4 fixture 影响同步检查：§4.3 说明大文件 fixture（20 子树×500）根含子节点 → banner 条件满足（BDD-3 共用）；BDD-4 首步点根 toggle 展开第一层；平铺 fixture 专供 BDD-8
- [x] 自检：frontmatter 四字段齐全（candidate_count=2 / packages=4 / domains=[frontend] / ui_affected=true）；gate_commands / minimal_validation 原样保留合规；grep 确认 shouldCollapse/hasBranchNode/红线 fixture 结构已落盘
