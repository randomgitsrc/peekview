# V-04 核实更正：截断态表头排序/过滤仍有效果假象

> 基准：`9a47df77`（main，2026-11-24）
> 结论：**V-04 未修复**。此前"已修复"的判断错误，已更正。

## 一、错在哪

上一轮我看到 `TableView.vue:60` 有 `v-if="!parsed.truncated"`，就判定"控件区已隐藏"。
实际该 v-if 只控制**底部 `.table-controls`**（每页条数 + 分页），与 V-04 所指的表头排序/过滤无关。

## 二、源码事实（`frontend-v3/src/components/TableView.vue`）

| 元素 | 行号 | 截断时（`parsed.truncated === true`） |
|---|---|---|
| `.th-sort-btn` 排序按钮 | 25-31 | **无 v-if，始终渲染** |
| `.th-filter` 过滤输入框 | 32-37 | **无 v-if，始终渲染** |
| `<tbody>` 截断分支 | 42-46 | 遍历 `parsed.rows`（**原始二维数组**） |
| `<tbody>` 正常分支 | 48-54 | 遍历 `pageRows`（= `table.getRowModel().rows`） |
| `.table-controls` 每页条数+分页 | 58 | `v-if="!parsed.truncated"` ✅ 已隐藏 |

关键差异：
```ts
const pageRows = computed<Row<CsvRow>[]>(() => table.getRowModel().rows)  // 178 行：应用排序+过滤
```
而截断分支用的是 `parsed.rows` —— **不经过 `table.getRowModel()`**。

`table` 的配置确实启用了两个模型（169-170 行）：
```ts
getSortedRowModel: getSortedRowModel(),
getFilteredRowModel: getFilteredRowModel(),
```
但截断状态下正文根本不读 `table` 的计算结果 ⇒ **排序/过滤状态与显示内容脱钩**。

## 三、用户可见现象

1. 点击列标题（`.th-sort-btn`）→ 排序指示器 `↑/↓` 会变化（`getIsSorted()` 正常）
2. 输入过滤条件（`.th-filter`）→ 输入框有内容
3. **但表格数据一行都不变** —— 因为正文渲染的是 `parsed.rows`

这是"控件有反馈、数据无变化"的假象，比控件完全不显示更糟（用户会以为功能坏了或数据有问题）。

## 四、修复要求

二选一：

| 方案 | 做法 | 评价 |
|---|---|---|
| **A（推荐）** | 截断时同时隐藏 `.th-sort-btn` 与 `.th-filter`（与底部 `.table-controls` 一致） | 改动小，语义诚实：截断态本就是"只展示前 N 行"，排序/过滤无意义 |
| B | 让排序/过滤真正作用于 `parsed.rows` | 需把截断数据也喂给 TanStack，改动大且语义模糊（前 N 行内排序 ≠ 全量排序，易误导） |

建议 A。若选 A，需同时保留 `TruncationBanner` 的"已显示前 N 行"提示（现有），让用户明确知道当前是部分数据。
