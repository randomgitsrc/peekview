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
