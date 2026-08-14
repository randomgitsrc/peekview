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
