---
phase: P2
task_id: TPV0094-treeview-default-expand
type: review
parent: P2-design.md
trace_id: TPV0094-P2-design-review-20260814
status: approved
created: 2026-08-14
agent: plan-design-review
---

# P2 设计评审（复审）— TPV0094 TreeView 默认展开优化

## 评审结论

**Status: approved**

上轮 3 项必须修订（R1/F2、R2/F1、R3/F3）+ 4 条次要建议全部落实，修订未引入新问题。回归性检查（四字段/gate_commands/minimal_validation/BDD 覆盖）全部保持合规。批准进入 P3。

## 复审逐项核对（上轮必须修订项）

### R1/F2 大平层树边界 — 已落实 ✓

| 上轮要求 | 修订落点 | 判定 |
|---------|---------|------|
| >阈值时 `expandedPaths` 置空 Set | §2 代码块 L90-92（`// > 阈值：expandedPaths 保持空 Set——根也折叠，单根+海量叶子同样折叠到只剩根`）；L77-93 `resetExpansion()` 仅 ≤阈值收集含子节点 path | ✓ |
| 单根+海量叶子性能保护 | §3 边界处理 L146：`> 阈值 → expandedPaths 空 Set → 根折叠，.tree-node 只剩 1，真实折叠 + 性能保护生效（旧设计展开根 → 全量渲染 + banner 假折叠，已修复）` | ✓ |
| `shouldCollapse = 总数>阈值 && 存在含子节点节点` | §2 L73-75 与 §3 L137-139 两处一致（`totalNodeCount.value > DEFAULT_EXPAND_THRESHOLD && hasBranchNode.value`），无定义漂移 | ✓ |
| 顶层宽数组不显示 banner（诚实） | §3 L147（`hasBranchNode=false → shouldCollapse=false → 不显示 banner`）；§1 风险节 L44 同步记录"诚实行为，接受（评审 F2 确认）" | ✓ |
| BDD-4 首步点击根 toggle 语义自洽 | §4.3 L164：超阈值初始即折叠（空 Set）→ 首步点击根 toggle 展开第一层（20 子树头，单次渲染量受控）→ 再点开一个子树断言 500 子节点可见；每步渲染 ≤500 节点，无超时风险，语义自洽 | ✓ |

### R2/F1 shouldCollapse 定义 — 已落实 ✓

- §3 L129-140「**shouldCollapse 完整定义**」（与 §2 代码块一致，评审 F1/R2 补齐）：`hasBranchNode` 全树递归定义 + `shouldCollapse` computed 两行代码完整给出
- §3 L143 banner 渲染条件 = `shouldCollapse` 为 true **且在非 truncated 分支**（模板 `v-else` 内，与 TruncationBanner 互斥）；§1 L25、§3 L113 同步一致
- 实现者无需再猜 shouldCollapse 语义（上轮 AI Slop 扣分项消除）

### R3/F3 红线协议归一化 — 已落实 ✓

- §8 redline_protocol L230-233：声明红线 fixture 为**统一平铺结构**（单根 + N-1 叶子，如 `{"data":[leaf,...]}`，量级 = N = 节点总数），单次点击根 toggle 即达 N 个 `.tree-node`，消除"深层 fixture 单次根点击达不到 N"的协议悬挂
- §8 L238-242 归一化口径：所有量级统一「折叠 → T0 → 点击根 → 等 N」测量路径，与阈值常量解耦（阈值以下初始全展开先折叠再点击；阈值以上初始即折叠无需预折叠）
- 错误括注已消除：原「阈值以上量级初始折叠，直接测」与旧 §2 else 分支（>阈值仍展开根）矛盾；修订后 §2 语义改为「>阈值空 Set」，L242 括注「阈值以上量级：初始即折叠（§2 空 Set 语义）→ 无需预折叠，直接 T0 → 点击根」**与代码块一致**，不再是矛盾括注
- 平铺 fixture 专供红线实测、深层分支专用 BDD-3/4 的划分清晰（L233、§4.3 L164）

## 次要建议采纳情况（全部采纳 ✓）

| 建议 | 落点 | 判定 |
|------|------|------|
| F4 packages 补入 perf 脚本 | frontmatter L12 `packages` 已含 `frontend-v3/scripts/measure-treeview-perf.ts`，§6 files_to_read 同步收录，§5 gate 命令路径一致 | ✓ |
| F5 否决理由引用 P1 | §2 候选 B L105-106：否决理由改为「超出 P1 隐含需求 #4 声明（DataTreeNode.vue 不改、toggle 契约不变）」+ 保留 F5 事实更正括注（P0-brief 原文未禁止改该文件） | ✓ |
| P3 单测 BDD-3 深层链提示 | §9 实现提示 L259：BDD-3 单测用 >阈值 深层链结构（约 2001 节点链，jsdom 渲染面小），平铺/宽分支大 fixture 只留 E2E 与红线实测层 | ✓ |
| 移动端显式说明 | §7 env_constraints `mobile`（L211）：「移动端同受单阈值保护，未分端——折叠判定/阈值/banner 渲染双端一致，无独立移动端路径」 | ✓ |

## 回归性检查（修订未引入新问题）

- **四字段**：frontmatter 完整（candidate_count: 2、packages 含 4 文件、domains: [frontend]、ui_affected: true），与 §6 files_to_read 一一对应
- **gate_commands**：§5 全引用 Makefile target（make test-frontend / make typecheck / make debug-quick / make debug-test），P6_redline 用 `npx tsx`（无现成 target，符合 AGENTS.md 先例），`E2E_SPEC=` 单 spec 规避全量超时——与上轮判定一致
- **minimal_validation**：§8 完整（assumption/method/redline_protocol/result: confirmed），协议口径、判定标准、③ 闭环（P6 据证据更新阈值 + 重跑 BDD-1/3）均在
- **BDD 覆盖不缩水**：§9 单测覆盖 BDD-1/3/6/7 + test_bdd_27/28 更新，E2E 覆盖 BDD-1/2/3/4/5/6/7，BDD-8 走 P6_redline；BDD-2/4/5 仅 E2E 维持上轮认定（合理，与现状一致）
- **shouldCollapse 双处定义一致性**：§2 L73-75 与 §3 L137-139 逐字符一致，无漂移
- **fixture 一致性**：§4.2 大文件 ≈10000 节点与 §4.3 根→20×500 子树口径自洽（总 10021 节点，量级语义不变）；§4.4 紧凑 JSON 约 60KB < 2MB 截断线
- **P1 引用准确性**：候选 B 否决依据改引 P1 隐含需求 #4，P1 原文 L61 确认该条影响面含「DataTreeNode.vue 不改，toggle 契约不变」——引用属实

## 评分（0-10）

| 维度 | 分 | 依据 |
|------|----|------|
| 交互状态覆盖率 | 9 | 上轮 F2 已修：大平层/顶层宽数组/单根+海量叶子全部写入 §3 边界处理与 §1 风险节，Banner 诚实性闭环 |
| AI Slop 风险 | 9 | shouldCollapse/hasBranchNode/totalNodeCount 全定义，§2 代码块可直接翻译成实现，无留给 implementer 猜测的语义 |
| 移动端考虑 | 8 | §7 显式声明单阈值双端一致、未分端 |
| 可访问性 | 8 | banner role="status" 即时播报、aria-expanded 契约保留（上轮维持） |
| 组件完整性 | 9 | 折叠 banner 触发/文案/testid 齐备，toggle 复用现有契约，shouldCollapse 输入输出已完整定义 |

## 批准后成立的部分（维持上轮）

- 候选 A 单点改动、DataTreeNode.vue 零改动、「不改」边界与现状逐行吻合
- 阈值 P6 实测闭环（§8 ③）+ fixture 固定余量解耦（§4.2）
- gate_commands 全部 Makefile target 引用、P5_e2e/P6_e2e/P6_redline 齐备
- 测试同步范围与现有断言逐行一致（隐含需求 #1）
- 红线实测协议经平铺 fixture + 统一测量路径修正后可直接执行（BDD-8）

## 结论

上轮 3 项必须修订全部落实且落点精确（§2/§3/§8/§4.3/§9），4 条次要建议全部采纳，无新增回归。**Status: approved**，批准进入 P3。
