# P5 E2E 验证结果 — TPV0094 TreeView 默认展开优化

- phase: P5
- task_id: TPV0094-treeview-default-expand
- trace_id: TPV0094-P5-20260815
- agent: verifier
- 状态标记: [PROD_NOT_TOUCHED]（debug :8888 隔离，未触碰 :8080 / ~/.peekview/）
- 状态标记: [NO_NEED_CONFIRM]

## 命令

```bash
make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test
```

- debug-quick: exit 0（:8888 启动成功，21 entries 灌入，CDP Chrome :18800 在线）
- debug-test: **exit 2** — `4 failed | 1 flaky | 93 passed (1.1m)`

## 汇总

```
failed 4 (chromium + Mobile Chrome: test_bdd_4_large_manual_expand x2, test_bdd_7_search_count_in_collapsed x2)
flaky 1 (chromium: test_bdd_5_switch_file_resets_expansion — retry 后通过)
passed 93 (合计 4 failed + 1 flaky + 93 passed)
```

## 失败逐一分析（均为 E2E spec 测试代码问题，非产品行为缺陷）

### BDD-4 `test_bdd_4_large_manual_expand`（chromium + Mobile Chrome，各 3 次含 retry 全败）

- 错误: `Error: strict mode violation: locator('.tree-node').filter({ hasText: 'data' }).first().locator('.expand-toggle') resolved to 21 elements`
- 根因（测试代码 bug）: `dataNode.locator('.expand-toggle')` 未限定 `:scope`。`data` 根节点展开后 DOM 内嵌全部 21 个 toggle（根 + 20 个子树头），`.locator('.expand-toggle')` 递归匹配到全部 21 个 → strict mode violation。
- 产品行为 CDP 实跑验证（`evidences/p5-bdd4-manual-expand.png`）: 根 `aria-expanded=false` → 点击 → `.tree-node` 21 → `sub_0` 可见且 `aria-expanded=false` → 点击 → 521 节点 → `leaf_0_499` 可见。**功能正确**。
- 修复方向: 用 `:scope > .tree-node-row > .expand-toggle` 或 `getByRole('button', { name: 'Expand node' })` 限定到行内 toggle。

### BDD-7 `test_bdd_7_search_count_in_collapsed`（chromium + Mobile Chrome，各 3 次含 retry 全败）

- 错误: `Error: strict mode violation: locator('[aria-live="polite"]') resolved to 2 elements`
- 根因（测试代码 bug）: 页面上有两个 `[aria-live="polite"]` 元素 —— `.sr-only`（entry-detail 容器，空）+ `.search-match-count`（搜索计数）。spec 用宽泛选择器命中 2 个。
- 产品行为 CDP 实跑验证: `.search-match-count` 文本 = `"1 match"` 且可见。**功能正确**。
- 修复方向: 选择器改为 `[aria-live="polite"].search-match-count` 或 `.search-match-count`。

### BDD-5 `test_bdd_5_switch_file_resets_expansion`（chromium，retry 后 flaky 通过）

- 错误: `expect(...count()).toBe(SMALL_TOTAL=9)` 收到 0；错误发生前 `.tree-view` toBeVisible 已过
- 根因（时序竞态）: 切文件后 `.tree-view` 容器先可见，但 `.tree-node` 尚未完成渲染，`count()` 立即读得 0。`toBeVisible` 不等树节点渲染完成。
- 产品行为 CDP 实跑验证: 切 small.json 后立即采样 t=0/50/.../450ms 均 `.tree-node=9`，`aria-expanded=false` 计数 0，banner 0。**功能正确**。
- 修复方向: `count()` 断言改为 `await expect(page.locator('.tree-node')).toHaveCount(SMALL_TOTAL)`（自动等待）。

## BDD 覆盖矩阵（含未失败用例）

| 用例 | 结果 | 备注 |
|------|------|------|
| test_bdd_1_small_json_default_expanded | PASS | 9 节点全展开 |
| test_bdd_2_small_yaml_xml_default_expanded | PASS | YAML/XML 无折叠 toggle |
| test_bdd_3_large_json_collapsed_banner | PASS | banner 可见 + 节点数 < 10021 |
| test_bdd_4_large_manual_expand | FAIL | 测试 locator bug（产品行为 CDP 验证正确） |
| test_bdd_5_switch_file_resets_expansion | FLAKY→PASS | 时序竞态（产品行为 CDP 验证正确） |
| test_bdd_6_toggle_reversible | PASS | 折叠/展开可逆 |
| test_bdd_7_search_count_in_collapsed | FAIL | 测试 locator bug（产品行为 CDP 验证正确） |
| test_bdd_27_expand_node / 28_collapse_node（更新） | PASS | 默认展开语义适配正确 |
| T075 其余 86 用例 | PASS | 无回归 |

## 证据

- 截图: `agate-workspace/tasks/TPV0094-treeview-default-expand/evidences/p5-bdd4-manual-expand.png`
- E2E 失败截图（playwright test-results 拷贝）: `evidences/e2e-failures/`（BDD-4/5/7 各浏览器）

## 判定

**E2E 未能全绿**：P5_e2e gate 命令 exit 2。3 个失败（BDD-4/7 FAIL + BDD-5 FLAKY）均为 **E2E spec 测试代码问题**（locator 未限定 :scope / aria-live 宽泛选择器 / count 时序），**产品行为经 CDP 手动实跑全部验证正确**，93/97 通过。需回 P4 修复 E2E spec 的 3 处测试代码后重跑 P5_e2e 全量确认。

EXIT_CODE: 2

## 修复后复跑（主 Agent 执行）

- P4 retry1 修复 3 处测试代码（BDD-4 :scope 限定 toggle / BDD-7 .search-match-count / BDD-5 toHaveCount 自动等待）后，主 Agent 重跑 `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test`：
  ```
  98 passed (42.2s)
  === ✓ 所有 E2E 测试通过 ===
  ```
- failed=0，flaky=0，全量 98/98 通过（含 T075 86 例 + TPV0094 新增/更新 12 例）

## 判定（最终）

**P5_e2e gate 通过**（exit 0 等效：failed=0）。E2E 验证完整。

EXIT_CODE: 0
