---
phase: P3
task_id: TPV0094-treeview-default-expand
type: test-cases
parent: P2-design.md
trace_id: TPV0094-P3-20260814
status: draft
created: 2026-08-14
agent: test-designer
---

# P3 测试用例清单 — TPV0094 TreeView 默认展开优化

## test_code_dir

```
test_code_dir:
  - frontend-v3/src/components/__tests__/TreeView.spec.ts   # 单测（修改现有文件）
  - frontend-v3/e2e/structured-data-viewer.spec.ts          # E2E（修改现有文件）
```

不新建 P3-test-code/ 目录——按派发指引，本任务测试代码**修改现有测试文件**。

## 测试约定

- **阈值相对构建**：单测引用 `DEFAULT_EXPAND_THRESHOLD` 导出（当前未导出，import 得 undefined，用 `?? 2000` 兜底，P4 实现后自动取真实值，P6 改阈值测试不炸）
- **fixture 结构**：
  - 小 JSON：复用 `JSON_CONTENT`（9 节点，全树分支节点 = 2）
  - 大 JSON（单测 BDD-3/7）：深层链（`buildDeepChain(THRESHOLD+2)`，全链对象每层 1 子 → jsdom 挂载面小，总节点 > 阈值）
  - 大 JSON（E2E BDD-3/4/7）：`buildLargeBranchJson()`（根 `data` → 20 子树 × 500 叶子，共 10021 节点，紧凑 JSON，分支结构避免单次点击渲染 10000 节点）
  - 多文件（E2E BDD-5）：`t094-multi` = large.json + small.json
- **计数口径**：`totalRenderedNodes(content)` / `totalBranchNodes(content)` 辅助函数镜像 `jsonToTreeData` 递归语义（根容器本身不计数，数组/对象节点计 1 + 子节点），断言从辅助函数推导，避免手写魔数与 fixture 矛盾

## BDD → 测试用例映射（1:1）

### 单测（TreeView.spec.ts）

| 用例 | BDD | 断言（新默认语义） | 当前实现状态 |
|------|-----|--------------------|--------------|
| `test_bdd_27_expand_shows_children`（更新） | 隐含需求 #1 同步 | 初始 meta 行 `aria-expanded="true"`，`level` 子节点可见（无需点击） | 红（初始折叠） |
| `test_bdd_28_collapse_hides_children`（更新） | 隐含需求 #1 同步 | 初始展开 → 点击一次 → `aria-expanded="false"` 且 `level` 隐藏 | 红（初始折叠） |
| `test_bdd_1_small_json_default_expanded`（新增） | BDD-1 | `.tree-node` 数 == `totalRenderedNodes`（9）；`[aria-expanded="false"]` 计数 == 0；`[aria-expanded="true"]` 计数 == `totalBranchNodes`（2） | 红（初始折叠） |
| `test_bdd_3_large_tree_collapsed_with_banner`（新增） | BDD-3 | `data-testid="tree-collapse-banner"` 存在；`.tree-node` 数 < 总节点数 | 红（banner 未实现） |
| `test_bdd_6_toggle_reversible`（新增） | BDD-6 | 初始展开 → 点击一次折叠（false + 子隐藏）→ 再点恢复（true + 子可见） | 红（初始折叠） |
| `test_bdd_7_search_count_in_collapsed_tree`（新增） | BDD-7 | 折叠前置条件（banner 存在）→ 搜索折叠子树内关键词 → aria-live 计数非零 | 红（banner 未实现） |

### E2E（structured-data-viewer.spec.ts）

| 用例 | BDD | 断言（新默认语义） | fixture |
|------|-----|--------------------|---------|
| `test_bdd_27_expand_node`（更新） | 隐含需求 #1 | meta 初始 `aria-expanded="true"` + `level` 可见（无需点击） | t075-json |
| `test_bdd_28_collapse_node`（更新） | 隐含需求 #1 | 初始展开 → 点击一次 → false + `level` 隐藏 | t075-json |
| `test_bdd_1_small_json_default_expanded`（新增） | BDD-1 | `.tree-node` 数 == 9；`.expand-toggle[aria-expanded="false"]` 计数 0 | t075-json |
| `test_bdd_2_small_yaml_xml_default_expanded`（新增） | BDD-2 | YAML 与 XML entry 各自 `.expand-toggle[aria-expanded="false"]` 计数 0 | t075-yaml / t075-xml |
| `test_bdd_3_large_json_collapsed_banner`（新增） | BDD-3 | `[data-testid="tree-collapse-banner"]` 可见；`.tree-node` 数 < 总节点数 | t094-large |
| `test_bdd_4_large_manual_expand`（新增） | BDD-4 | 根 `data` 折叠 → 点根 toggle → `sub_0` 可见；点 `sub_0` toggle → `leaf_0_499` 可见 | t094-large |
| `test_bdd_5_switch_file_resets_expansion`（新增） | BDD-5 | 大文件（banner 可见）→ 切小文件 → 小文件全展开（`.tree-node` 数 == 9，无折叠 toggle） | t094-multi |
| `test_bdd_6_toggle_reversible`（新增） | BDD-6 | 初始展开 → 折叠 → 恢复，meta 行三态断言 | t075-json |
| `test_bdd_7_search_count_in_collapsed`（新增） | BDD-7 | 大文件折叠态（banner 可见）→ 搜索折叠子树内关键词 → aria-live 计数非零 | t094-large |

> BDD-8（红线实测）：不写测试用例——由 `scripts/measure-treeview-perf.ts` 红线脚本承载（P6 执行）。

## 新增 E2E fixture entries（beforeAll 追加）

| slug | 文件 | 节点数 |
|------|------|--------|
| `t094-large` | large.json（根 data → 20 子树 × 500 叶子） | 10021 |
| `t094-multi` | large.json + small.json | 10021 + 9 |

## 红灯确认方式

- 只跑单测：`cd frontend-v3 && make test-frontend`（vitest 排除 e2e/**）
- 预期失败用例（实现未改，均为 B 类红灯）：`test_bdd_27`/`test_bdd_28`（初始态断言 折叠→展开 反转）、`test_bdd_1_*`（全展开计数）、`test_bdd_3_*`/`test_bdd_7_*`（banner 未实现）、`test_bdd_6_*`（初始展开反转）
- E2E 不实跑（需 debug backend，P5/P6 跑 `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test`）
- 现有 13 个单测中与初始折叠无关的用例（渲染/类型标签/搜索高亮/复制/截断/空输入）预期保持绿

## P3 自检记录

- fixture 计数用辅助函数推导（`totalRenderedNodes`/`totalBranchNodes`），断言值来自同源数据，无手写魔数
- BDD-3/7 单测 fixture 用深层链（~2003 节点，每对象 1 子），jsdom 挂载面小；`total > THRESHOLD` 由 fixture 自身断言
- E2E BDD-4 单次点击渲染受控：点根（21 节点）→ 点子树（+500），不整树展开
