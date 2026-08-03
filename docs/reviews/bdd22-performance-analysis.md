# BDD-22 50000 行测试性能分析

> 2026-08-03 | 基于 T085 命令时间分析

## 问题

`npx vitest run` 全量 170s，其中 146s 花在 `TableView.spec.ts` 的 `test_bdd_22_truncation_banner_with_download`。

## 根因链

```
BDD-22 测试: mount(TableView, { content: 50001行CSV })
→ parseCsv(content, delimiter, maxRows=50000)
  → 解析 50001 行 → 截断到 50000 行 → truncated=true
→ useVueTable({ data: 50000行 })
  → TanStack Table 为 50000 行创建 Row 对象（每个含闭包/方法）
  → 这一步耗 ~140s（JS 层面，非 DOM）
→ pageRows computed: if (truncated) return [] → 渲染 0 个 tr
→ TruncationBanner 显示
```

**表格渲染 0 个 tr**（因为 `truncated=true` 时 `pageRows` 返回空数组），但 TanStack Table 在初始化时已经为 50000 行创建了 Row 实例——这才是 140s 的来源。

## 关键发现

1. **分页有生效**：`pageRows` 用 `rows.slice(start, start + perPage)` 只取 100 行
2. **但截断时不渲染表格**：`if (parsed.value.truncated) return []` → 0 个 tr
3. **TanStack Table 初始化才是瓶颈**：`useVueTable({ data: 50000行 })` 为所有行创建 Row 对象
4. **jsdom DOM 不是瓶颈**：因为 truncated=true 时根本没创建 tr DOM 节点

## 为什么测试这么慢

测试 mount 了 TableView 组件，TanStack Table 初始化时处理 50000 行数据——这是 JS 对象创建 + 闭包 + GC 的开销，不是 DOM 操作。

## 设计问题

50000 行截断阈值本身值得重新评估：

- **截断后仍然 parse 50000 行到内存**：如果 CSV 有 100000 行，parse 50000 行仍然耗时
- **截断后传 50000 行给 TanStack Table**：即使不渲染 tr，TanStack 也要为 50000 行创建 Row 对象
- **更合理的设计**：超过阈值（如 10000 行）→ 不 parse、不渲染表格，直接"文件过大，请下载"

## 修复方向

### 方案 A：测试降数据量（最小修复）

BDD-22 用 `maxRows=5` + 10 行 CSV 数据：
- `parseCsv(10行, delimiter, maxRows=5)` → `truncated=true` + `rows.length=5`
- mount TableView → `pageRows` 返回空 → TruncationBanner 显示
- 验证 banner 文案 + 下载按钮
- 耗时 ~0.01s（从 140s 降到 0.01s）

### 方案 B：截断时不传数据给 TanStack Table（实现修复）

TableView.vue 修改：`truncated=true` 时不初始化 TanStack Table（或传空数组）：
```typescript
const tableData = computed(() => parsed.value.truncated ? [] : parsed.value.rows)
const table = useVueTable({ data: tableData.value, ... })
```
这样截断时 TanStack Table 收到 0 行数据，不创建 Row 对象。

### 方案 C：降低截断阈值 + 不渲染表格（设计变更）

- 截断阈值从 50000 降到 10000（或更低）
- 超过阈值 → 不 parse、不渲染表格，直接显示"文件过大" + 下载按钮
- 需要改 BDD-22 需求 + useCsvParser + TableView

### 推荐

**A + B 同时做**：测试降数据量（消除 140s）+ 实现修复（截断时不传数据给 TanStack Table，防止真实浏览器也卡）。
