---
phase: P4
task_id: TPV0094-treeview-default-expand
type: review
parent: P4-implementation.md
trace_id: TPV0094-P4-design-review-20260814
status: approved
created: 2026-08-14
agent: design-review
---

# P4 评审 — TPV0094 TreeView 默认展开优化（design-review）

## 结论

**status: approved**（无 BLOCKER / 无 CRITICAL；2 条非阻塞观察 [OBS]）

## 一、实现 vs 设计一致性（P2-design.md §2/§3）

逐条核对 P2 §2 候选 A 代码块（L52-93）与 §3 定稿表（L108-114）对应的实现：

| 设计要求 | 实现位置 | 核对 |
|---|---|---|
| `export const DEFAULT_EXPAND_THRESHOLD = 2000` | TreeView.vue:49（独立 `<script lang="ts">` 块，P2 注释 L53「导出供单测 import」） | ✅ 一致。双 script 块是 Vue 合法模式（`<script setup>` 不允许 ESM export，implementer 用普通 `<script>` 导出，P4-implementation.md L26 已说明） |
| `totalNodeCount` 递归计数（children 深度优先） | TreeView.vue:82-92 | ✅ 与 P2 L55-65 逐字一致 |
| `hasBranchNode` 全树递归 | TreeView.vue:94-98 | ✅ 与 P2 §3 L132-136 一致 |
| `shouldCollapse = totalNodeCount > 阈值 && hasBranchNode` | TreeView.vue:100-102 | ✅ 与 P2 L73-75 一致 |
| `resetExpansion` 二分路径（≤阈值收集全部含子节点 path / >阈值空 Set 根折叠） | TreeView.vue:164-178 | ✅ 与 P2 L77-93 一致，`expandedPaths.value = paths` 覆盖旧值 |
| banner 在非 truncated 分支、tree-list 前、`v-if="shouldCollapse"`、`data-testid="tree-collapse-banner"`、`role="status"`、文案「内容较大，已折叠部分」 | TreeView.vue:21-29 | ✅ 与 P2 §3 L113 一致（v-else 分支内、no-data/tree-list 之前） |
| banner 与 TruncationBanner 互斥 | TreeView.vue:3-7（`v-if="truncated"`）+ 9（`v-else`） | ✅ P2 §4.1 L151-153：`v-else` 分支内天然互斥，同一时刻至多一个 |
| 复用 warning 视觉模式，不引组件本体 | TreeView.vue:253-264 | ✅ 见第二节 |

## 二、UI 视觉/交互（design-review 本职）

### banner 视觉一致性（对照 TruncationBanner.vue:22-33）

`.tree-collapse-banner`（TreeView.vue:253-264）与 `.truncation-banner`（TruncationBanner.vue:22-33）逐属性一致：

| 属性 | 折叠 banner | 截断 banner | 一致 |
|---|---|---|---|
| display/flex | `flex; align-items:center; gap: var(--space-2)` | 同 | ✅ |
| padding | `var(--space-3)`（12px，4px 网格） | 同 | ✅ |
| margin-bottom | `var(--space-3)` | 同 | ✅ |
| border-radius | `var(--radius-md)` | 同 | ✅ |
| background / color / border | `--warning-bg` / `--warning-text` / `--warning-border` | 同 | ✅ |
| font-size | `var(--font-sm)`（14px，DESIGN.md Body） | 同 | ✅ |
| 图标 | `<AlertTriangleIcon :size="16" />` | 同 | ✅（DESIGN.md §7 16px inline） |

- **设计系统 token**：全部使用 `var(--space-*)` / `var(--radius-md)` / `var(--warning-*)`，无硬编码 hex，无 `color-mix`（DESIGN.md §12「Do」全满足）
- **间距**：8/12px 均为 4px 网格倍数（DESIGN.md §4 基础单元）
- **AI Slop 检查**：无 violet 渐变、无泛化文案（「内容较大，已折叠部分」为 P1 用户确认方向）、非全居中布局、无同质 grid ✅
- **交互状态**：banner 是 status 提示（非交互元素），无需 focus/hover/active/disabled 样式——design-review 角色清单「交互状态」项不适用，正确
- **aria 语义**：`role="status"` 合理——status 是「非阻塞、用户无需关注」的声明式 live region，与截断 banner 一致；且 banner 不含可交互子元素，不需要 focus 管理

### [OBS-1] 移动端 banner 字号未上浮

TreeView.vue:279-283 的移动端媒体查询仅将 `.tree-search-input` 字号上浮到 `--font-md`（16px），`.tree-collapse-banner` 保持 `--font-sm`（14px）。design-review 角色清单要求「移动端字号最小 16px」。
**判定**：TruncationBanner（既有参照，TruncationBanner.vue:32）同样用 `--font-sm` 且无移动端上浮——折叠 banner 与既有模式保持一致，属一致性优先于通用清单；且 14px 满足 DESIGN.md 正文阅读字号。**非阻塞，不改。**

### [OBS-2] banner 文案 span 无 flex 拉伸

折叠 banner 的 `<span>内容较大，已折叠部分</span>`（TreeView.vue:28）未加 `flex: 1`（TruncationBanner 的 `.truncation-message` 有 `flex: 1`，TruncationBanner.vue:35-37）。因折叠 banner 无右侧按钮，文字不会与任何元素争抢空间，`flex: 1` 无实际作用。**非阻塞，不改。**

## 三、回归风险

1. **现有 13 用例**（P4-implementation.md L44：`test_bdd_27/28` 反转 + 新增 4 用例 → 共 17 全过，本 agent 从 spec 实测 `it(` 计数 = 17 ✅）：
   - `test_bdd_27/28`（spec L126-148）断言小 JSON 初始 `aria-expanded="true"` → 实现 `totalNodeCount=9 ≤ 2000` → 收集 2 个 branch path（tags/meta），与断言匹配
   - `test_bdd_1`（spec L286-297）断言 `.tree-node` == 9 且 `aria-expanded="false"` == 0 → 全展开语义满足
   - `test_bdd_3/7`（spec L299-309, L328-340）用 `buildDeepChain(THRESHOLD+2)` 深层链 > 阈值 → 空 Set 根折叠 + banner 出现，断言满足（P2 §9 L259 深层链 fixture 提示已落实）
   - `test_bdd_6`（spec L311-326）toggle 可逆 → 初始全展开 → 点一次折叠 → 再点恢复，`togglePath`（TreeView.vue:104-112）不变，满足
   - `test_bdd_36` 空输入（spec L268-277）→ `totalNodeCount=0 ≤ 阈值` → collect 空集 → 空 Set，`treeData` 空则 `.no-data` 分支，不崩
   - `test_bdd_33/34/35` 截断（spec L231-259）→ `truncated` 分支走 TruncationBanner，与折叠 banner 互斥，不回归
2. **watch 重置路径时序**（TreeView.vue:180-190）：`parseTree()` 先赋值 `treeData.value`（L186）再 `resetExpansion()`（L187），`totalNodeCount` computed 读取已更新的 `treeData`，时序安全 ✅（P2 §1「切文件状态串扰」隐含需求 #2 / BDD-5 满足）
3. **空输入/标量根边界**：标量根 → `scalarLeaf`（L152-155）无 children → collect 不收集 → 空 Set → 正常渲染叶子，不崩（P2 §3 边界 L144-145 ✅）
4. **顶层宽数组**：`hasBranchNode=false` → `shouldCollapse=false` → 无 banner（P2 §3 L147 接受行为 ✅）

## 四、测试一致性（P3-test-cases.md）

- P3 L26 约定「单测引用 DEFAULT_EXPAND_THRESHOLD 导出（undefined 兜底 2000）」→ 实现已导出（TreeView.vue:49），spec L32 `?? 2000` 兜底仍在但会取真实值 ✅
- P3 断言语义与实现匹配：`totalRenderedNodes`/`totalBranchNodes` 辅助函数（spec L35-60）镜像 `jsonToTreeData` 递归，实现 `totalNodeCount` 递归语义（每节点 +1）与之一致 ✅
- 无实现与断言冲突

## 五、范围与隔离

- 唯一代码改动 `frontend-v3/src/components/TreeView.vue`（git diff 确认，62 insertions / 4 deletions）✅
- `DataTreeNode.vue` / `structured-data.ts` / `treeExpandKey.ts` / `useTreeData.ts` 未动（P2 §1「不改什么」✅）
- 测试文件未动（P3 已改，P4 不触碰）✅
- `[PROD_NOT_TOUCHED]`：只读评审，未触碰 :8080 生产服务与 `~/.peekview/`

## 六、观察汇总

| 编号 | 级别 | 内容 |
|---|---|---|
| OBS-1 | 非阻塞 | 移动端 banner 字号 14px 未上浮，与既有 TruncationBanner 一致，不处理 |
| OBS-2 | 非阻塞 | banner 文案 span 无 `flex:1`，无按钮无需拉伸，不处理 |

**无 BLOCKER / 无 CRITICAL / 无需要 implementer 返工的项。**

## 判定

- **approved** — P4 实现与 P2 设计定稿逐条一致（§2/§3/§4.1），视觉复用 TruncationBanner 模式到位，回归风险已封闭，P3 断言语义全部满足。
- 建议 P5/P6 关注：BDD-8 红线实测后据证据更新 `DEFAULT_EXPAND_THRESHOLD`（TreeView.vue:49）并重跑 BDD-1/3 边界（P2 §8 redline_protocol 判定标准 ③）。
