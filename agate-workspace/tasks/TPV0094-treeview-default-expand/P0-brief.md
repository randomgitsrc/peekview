---
phase: P0
task_id: TPV0094
task_name: treeview-default-expand
trace_id: TPV0094
created: 2026-08-12
status: pending
parent: 用户体验反馈（TreeView 默认折叠，想看内容要点开）
---

# P0-brief — T094 TreeView 默认展开优化

## task

优化详情页 TreeView（JSON/YAML/XML 结构化数据查看器）的默认展开行为：**默认展开全部节点**（用户倾向），当节点数超性能红线时降级折叠 + 提示。T075 的实现目前只默认展开根节点。

## 现象（用户反馈）

TreeView 打开 JSON/XML 后只显示根节点，想看内容必须手动逐层点开——体验繁琐。用户倾向"直接展开"，性能受限时再按需展开。

## 现状分析（已读代码，非猜测）

- `frontend-v3/src/components/TreeView.vue:127-133` `resetExpansion()`：
  ```ts
  function resetExpansion() {
    if (treeData.value.length === 1 && treeData.value[0].children?.length) {
      expandedPaths.value = new Set([treeData.value[0].path])  // 只展开根
    } else {
      expandedPaths.value = new Set()
    }
  }
  ```
- `DataTreeNode.vue` 是**递归自引用组件**（`<DataTreeNode v-for="child">`）——每个节点一个 Vue 组件实例，无虚拟滚动
- **性能含义**：全展开的渲染成本 ≈ 节点数 × 组件实例开销。估算：≤100 流畅、100~500 轻微卡顿、500~2000 明显卡顿、>5000 白屏风险

## 核心需求（用户确认）

1. **默认全部展开**（小/中文件直接一眼看完）
2. **性能保护**：节点数超红线时降级折叠 + 提示"内容较大，已折叠部分"
3. **红线需实测**：Playwright CDP 测不同量级（100/500/1000/2000/5000 节点）首帧时间，据实定阈值

## known_risks

- **递归组件性能**：无虚拟滚动，全展开大 JSON 会撑爆 DOM——红线阈值必须实测确定，不能拍脑袋
- **阈值自适应**：倾向"总节点数 ≤ N 全展开，> N 折叠+提示"（简单可靠），但 N 要实测（预估 2000~5000）
- **改动面**：单文件前端（TreeView.vue resetExpansion + 节点计数 + 阈值判断）+ 可能 DataTreeNode.vue（如需优化渲染）——低风险
- **P6 实测**：需要构造多量级 JSON fixture 用 Playwright CDP 测首帧时间（ui_affected: true）
- 不触碰生产 :8080 / ~/.peekview/

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，隔离）；Playwright CDP（:18800）；性能实测用构造的多量级 JSON entry"
lint: "cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"

## 裁剪倾向

- P1：BDD 覆盖「小 JSON 默认全展开」「大 JSON 降级折叠+提示」「切换文件后重置展开」「搜索/折叠交互不回归」
- P2：`follows_existing_pattern`（改现有 TreeView 展开逻辑），单候选方案（全展开 + 阈值降级），可简化
- P3：保留（新增节点计数/阈值逻辑，有可测行为）
- P5：前端 typecheck + 单测
- P6：**不可裁**——Playwright CDP 实测多量级首帧时间（ui_affected: true）
- P7：单文件改动可裁（若只改 TreeView.vue）
- 风险：low（纯前端单文件，无 schema/权限改动）

## 排期

TPV0094：独立小任务，零依赖零冲突（纯前端单文件）。可与 TPV0090（xdist，碰测试 fixture）**并行**——补进第一批并行组。
