# P4 progress — TPV0094 implementer

## 2026-08-15

- 已读 P4-dispatch-context-implementer.md：目标 = 让 P3 6 红灯变绿（test_bdd_27/28 + test_bdd_1/3/6/7）；单文件主改动 TreeView.vue；产出 P4-implementation.md；不碰测试文件；自查≠gate
- 已读 implementer.md：最小实现原则；测试不通过决策树；SCOPE_GAP/DESIGN_GAP 上报机制
- 已读 P0-brief.md：需求 = 小文件默认全展开、大文件折叠+banner、红线需实测（P6）
- 已读 P2-design.md：候选 A 定稿——DEFAULT_EXPAND_THRESHOLD=2000 导出；totalNodeCount 递归计数；hasBranchNode；shouldCollapse；resetExpansion 二分路径（≤阈值全展开收集 path / >阈值空 Set）；banner 在 v-else 分支 tree-list 前（v-if=shouldCollapse，data-testid="tree-collapse-banner"，复用 warning 视觉 + role="status"）
- 已读 P3-test-cases.md：6 红灯断言语义（小 JSON 全展开计数、深层链 >阈值 fixture、banner 存在、toggle 可逆、折叠态搜索计数）
- 已读 TreeView.vue：resetExpansion L127-133（旧：只展开根）；watch L135-145 immediate 重置路径；模板 L3-34（TruncationBanner v-if=truncated / v-else tree-search+no-data/tree-list）；matchCount L151-163 递归不依赖展开态
- 已读 DataTreeNode.vue：isExpanded = expandedPaths.has(path)（L62），toggle 走 togglePath——契约保留，不改
- 已读 TreeView.spec.ts：已 import DEFAULT_EXPAND_THRESHOLD（L3，undefined 兜底 2000）；断言依赖 .tree-node/.expand-toggle[aria-expanded]/[data-testid="tree-collapse-banner"]
- 已读 structured-data.ts：TreeDataNode = {key,value,type,children?,path}，递归计数/path 收集依赖此结构
- 已读 TruncationBanner.vue：视觉模式 warning-bg/warning-text/warning-border + role="status"（L21-33）——折叠 banner 内联复用，不引组件本体（强依赖 downloadFn）

- 实现完成：TreeView.vue 已按 P2 候选 A 落地（DEFAULT_EXPAND_THRESHOLD 独立 script 块导出 / totalNodeCount / hasBranchNode / shouldCollapse / resetExpansion 二分路径 / data-testid=tree-collapse-banner banner + 样式）
- 关键坑：`<script setup>` 不允许 ESM export（compiler-sfc 报错）→ 改用 `<script lang="ts">` 独立块导出常量
- 自查：TreeView.spec.ts 17 过；make test-frontend 1232 passed；make typecheck passed；make lint 因 ruff 不在 PATH 报 127（pre-existing），venv ruff 验证 All checks passed
- 已写 P4-implementation.md（implementation_dir: frontend-v3/src/components/）

## 2026-08-15 retry1（P5 回退修复轮）

- 已读 implementer.md：最小修复、自查≠gate、DESIGN_GAP 上报机制
- 已读 P4-dispatch-context-implementer-retry1.md：修复清单 3 处（BDD-4 :scope / BDD-7 .search-match-count / BDD-5 toHaveCount），只改 spec 文件
- 已读 P5-test-results/e2e.md：4 failed + 1 flaky，产品行为 CDP 实跑全对，3 处均为测试代码 bug
- 已读 e2e/structured-data-viewer.spec.ts：确认 BDD-4 在 L508-516（dataNode/sub0.locator('.expand-toggle') 各 3 处）、BDD-7 在 L556（[aria-live="polite"]）、BDD-5 在 L527（count() 立即读）
- 已读 DataTreeNode.vue：toggle 结构 = `.tree-node > .tree-node-row > button.expand-toggle`，子节点为嵌套 `.tree-node`（ul.tree-children）→ 无 :scope 递归匹配到全部 toggle，与 P5 根因一致
- 修复方向确认：BDD-4 用 `:scope > .tree-node-row > .expand-toggle`（更稳：aria-label 随展开态变化，getByRole 名字不稳）；BDD-7 改 `.search-match-count`；BDD-5 改 `await expect(...).toHaveCount(SMALL_TOTAL)`

## 2026-08-15 retry1 自查第 1 轮

- 3 处修复落盘后跑 `make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test`：96 passed | 2 failed（BDD-4 chromium + Mobile Chrome 各 1），BDD-5/BDD-7 已绿
- BDD-4 新失败（L516）：`sub0` 用 `page.locator('.tree-node').filter({ hasText: 'sub_0' }).first()` —— hasText 匹配子树文本，根 data 节点文本含全部 sub_*，`.first()` 命中根节点而非 sub_0 → sub0Toggle 是已展开的根 toggle，aria-expanded=false 断言失败
- 二次修复：`sub0` 限定为 `dataNode.locator(':scope > .tree-children > .tree-node').filter({ hasText: 'sub_0' }).first()`（只匹配 data 直接子树节点）

## 2026-08-15 retry1 自查第 2 轮（最终）

- 二次修复 sub0 限定后重跑：**98 passed (38.4s)**，0 failed，全绿
- 已跑 make debug-stop 清理 debug server
- [PROD_NOT_TOUCHED]：全程 debug :8888 隔离，未触碰 :8080 / ~/.peekview/
