---
phase: P4
task_id: TPV0094-treeview-default-expand
type: implementation
parent: P2-design.md
trace_id: TPV0094-P4-20260814
status: draft
created: 2026-08-14
agent: implementer
---

# P4 实现记录 — TPV0094 TreeView 默认展开优化

## implementation_dir

```
implementation_dir: frontend-v3/src/components/
```

## 改动文件

### `frontend-v3/src/components/TreeView.vue`（唯一代码改动）

按 P2-design.md §2 候选 A / §3 设计定稿实现：

1. **新增导出常量**：`export const DEFAULT_EXPAND_THRESHOLD = 2000`（放在独立 `<script lang="ts">` 块——`<script setup>` 不允许 ESM export，Vue SFC 双 script 块模式，供单测 import；P6 红线实测后据证据更新值）
2. **新增 `totalNodeCount`**：递归计数 computed，遍历所有 `TreeDataNode`（含所有层级，`children` 深度优先）
3. **新增 `hasBranchNode`**：全树递归判断是否存在含子节点节点（顶层宽数组/纯叶子树 → false）
4. **新增 `shouldCollapse`**：`totalNodeCount.value > DEFAULT_EXPAND_THRESHOLD && hasBranchNode.value`
5. **修改 `resetExpansion()`** 为二分路径：
   - `≤ 阈值` → 递归收集所有含子节点节点的 path 进 Set（全展开）
   - `> 阈值` → Set 为空（根也折叠，单根+海量叶子大平层同样真实折叠）
6. **模板新增折叠 banner**：在非 truncated 分支（`v-else`）内、no-data/tree-list 之前渲染 `v-if="shouldCollapse"`，`data-testid="tree-collapse-banner"`，`role="status"`，文案「内容较大，已折叠部分」，复用 TruncationBanner 视觉模式（`warning-bg`/`warning-text`/`warning-border`，内联实现，不引组件本体）
7. **新增 scoped 样式** `.tree-collapse-banner`（与 `.truncation-banner` 同视觉模式，不同 class 避免与截断 banner 断言混淆）

### 未改动文件

- `DataTreeNode.vue` — isExpanded/toggle/hasChildren 契约与递归渲染保留（P2 §1 不改清单）
- `structured-data.ts` / `treeExpandKey.ts` / `useTreeData.ts` — 不变
- `TreeView.spec.ts` / E2E spec / `measure-treeview-perf.ts` — P4 不触碰测试与红线脚本（P3 已写 / P6 执行）

## 测试结果（自查，非 gate）

- `cd frontend-v3 && npx vitest run src/components/__tests__/TreeView.spec.ts`：**17 tests 全过**（含此前 6 个红灯：`test_bdd_27`/`test_bdd_28` 反转、`test_bdd_1`/`test_bdd_3`/`test_bdd_6`/`test_bdd_7` 新用例）
- `make test-frontend`：**92 files / 1232 passed**（0 fail）
- `make typecheck`（vue-tsc --noEmit）：**passed**（TS2614 消除）
- `make lint`：命令本身因 ruff 不在 PATH 报 127（**pre-existing env 问题**，与本次前端改动无关）；用 `backend/.venv/bin/ruff check peekview/ tests/` 验证 **All checks passed**

## 实现说明

- `totalNodeCount`/`hasBranchNode`/`shouldCollapse` 三个 computed 依赖 `treeData`（watch 重置路径内 `parseTree()` 先赋值再 `resetExpansion()` 调用，时序安全）
- 空输入（`{}`/`[]`/`null`/标量根）：`totalNodeCount=0 ≤ 阈值` → collect 收集空集 → 空 Set，无 toggle 可点，不崩
- banner 放 `v-else` 分支（与 TruncationBanner 的 `v-if="truncated"` 互斥），同一时刻至多一个
- 顶层宽数组（无含子节点节点）：`hasBranchNode=false` → `shouldCollapse=false` → 不显示 banner（P2 §3 接受行为）
- `[PROD_NOT_TOUCHED]`：未触碰 :8080 生产服务与 ~/.peekview/，无任何生产写入

## 标注

无 [DESIGN_GAP] / [SCOPE+] / [SCOPE_GAP] / [CLARIFY]。

---
phase: P4
task_id: TPV0094-treeview-default-expand
type: implementation
parent: P5-test-results/e2e.md
trace_id: TPV0094-P4-retry1-20260814
status: draft
created: 2026-08-14
agent: implementer
---

# P4 重试轮修复记录 — E2E spec 3 处测试代码修复（P5 回退）

## 回退诊断

P5 首轮 E2E `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test` → **4 failed + 1 flaky | 93 passed**。P5 verifier 已用 CDP 逐例实跑核实产品行为全部正确（`evidences/p5-bdd4-manual-expand.png` + t=0/50/.../450ms 采样），3 处失败均为 **E2E spec 测试代码 bug**，与 `frontend-v3/e2e/structured-data-viewer.spec.ts` 当前代码 + `DataTreeNode.vue` DOM 结构核对后根因成立。

`DataTreeNode.vue` toggle DOM：`.tree-node > .tree-node-row > button.expand-toggle`，子节点是嵌套的 `.tree-node`（`ul.tree-children > DataTreeNode`）——递归结构是 3 处 bug 的共同背景。

## 改动文件（唯一改动）

`frontend-v3/e2e/structured-data-viewer.spec.ts` —— 仅 3 处测试代码修复，未改产品代码、未改单测、未弱化断言、未删用例、未改预期值：

1. **BDD-4 `test_bdd_4_large_manual_expand`（L508-516）— :scope 限定 toggle**
   - 原错误：`strict mode violation: locator('.expand-toggle') resolved to 21 elements`——`dataNode/sub0.locator('.expand-toggle')` 未限定 `:scope`，递归匹配到该节点子树内全部 21 个 toggle
   - 修复：`dataNode/sub0` 的 toggle 提取为 `const dataToggle/sub0Toggle = X.locator(':scope > .tree-node-row > .expand-toggle')`，只命中该节点行的 toggle（aria-expanded/click 断言不变）
   - 选 `:scope` 而非 `getByRole('button', { name: 'Expand node' })`：button 的 aria-label 随展开态在 'Expand node'/'Collapse node' 间切换，getByRole 名称定位不稳；`:scope > .tree-node-row > .expand-toggle` 结构稳定

2. **BDD-7 `test_bdd_7_search_count_in_collapsed`（L558）— 精确化 aria-live 选择器**
   - 原错误：`strict mode violation: locator('[aria-live="polite"]') resolved to 2 elements`——页面上 `.sr-only`（entry-detail 容器）与 `.search-match-count` 都有 `aria-live="polite"`
   - 修复：选择器精确化为 `.search-match-count`（与 BDD-30 已用的 L274 写法一致）

3. **BDD-5 `test_bdd_5_switch_file_resets_expansion`（L529）— 时序竞态 → 自动等待**
   - 原错误：`expect(await page.locator('.tree-node').count()).toBe(SMALL_TOTAL)` 收到 0——切文件后 `.tree-view` 容器先可见但 `.tree-node` 未渲染完成，`count()` 立即读
   - 修复：改为 `await expect(page.locator('.tree-node')).toHaveCount(SMALL_TOTAL)`（Playwright 自动轮询等待），后续 `expand-toggle[aria-expanded="false"]` 计数与 banner 断言不变

## 自查

- `make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test`（timeout 300000，CDP :18800）—— 结果记录于 progress
- `[PROD_NOT_TOUCHED]`：全程 debug :8888 隔离，未触碰 :8080 生产服务与 ~/.peekview/
