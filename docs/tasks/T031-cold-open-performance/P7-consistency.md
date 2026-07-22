---
phase: P7
task_id: T031-cold-open-performance
type: consistency
parent: P6-acceptance.md
trace_id: T031-P7-20260722
status: draft
created: 2026-07-22
agent: consistency-reviewer
---

# P7 一致性检查 — Explore 列表页性能与交互优化

## 1. BDD 数量匹配

P1§BDD-count: 7 条（BDD-1 ~ BDD-7）
P6§PASS-count: 7 条（BDD-1 ~ BDD-7 全 PASS，0 FAIL）

逐条映射：

| P1 BDD | P6 结果 | 状态 |
|--------|---------|------|
| BDD-1 详情页并行加载 | PASS | [OK] |
| BDD-2 卡片为原生链接 | PASS | [OK] |
| BDD-3 分隔符渲染 | PASS | [OK] |
| BDD-4 搜索框 placeholder | PASS | [OK] |
| BDD-5 导航按钮文案 | PASS | [OK] |
| BDD-6 加载态即时反馈 | PASS | [OK] |
| BDD-7 嵌套交互元素可用 | PASS | [OK] |

P6 二值规则：所有 BDD 均为 PASS/FAIL 二值，无中间态。[OK]

## 2. packages 一致

P2§packages: `[frontend-v3]`
P4§impl-path: `implementation_dir: frontend-v3/src/`

实现目录在 P2 声明的 packages 范围内。[OK]

## 3. 实现路径与方案吻合（设计→实现）

P2§1 定义 6 个子项（A-F），逐项对照 P4§Changed-Files：

| P2 子项 | P2 方案要点 | P4 实现 | 状态 |
|---------|------------|---------|------|
| A 并行加载 | route query 传 fileId + Promise.all | entry.ts: loadEntry(slug, fileId?, shareToken?) + Promise.all 并发；EntryListView navigateToEntry 传 firstFileId query；EntryDetailView onMounted 读 query + router.replace 清理 | [OK] |
| B 卡片改 `<a>` | 整卡 `<a>` + stopPropagation + username span | EntryCard.vue: card-body div→`<a>` + @click.prevent；username router-link→span[role=link]；card-actions @click.stop.prevent；移除 role/tabindex/keydown。EntryListRow.vue 同理 | [OK] |
| C 分隔符修复 | meta-sep 添加 UI 字体栈 | EntryCard.vue / EntryListRow.vue / EntryListView.vue footer: meta-sep inline font-family | [OK] |
| D placeholder | 中文→英文 | EntryListView.vue: placeholder→English | [OK] |
| E Explore 文案 | 两处 "Explore"→"Browse public" | LandingView.vue: 两处修改 | [OK] |
| F 骨架屏 | 内联骨架屏 grid+list+detail | EntryListView.vue: 6 .skeleton-card + 6 .skeleton-row；EntryDetailView.vue: header + content skeleton | [OK] |

P4 额外改动（2 个测试文件移除 unused import）为 typecheck 修复，非设计偏差。[OK]

## 4. 实现→设计反向检查

对照 P4 变更文件清单，检查 P2 中是否有不再适用的要求：

- P2§2 "不改什么"中列出的 api/client.ts、router.ts、后端 API、MCP/CLI 均未被 P4 触碰。[OK]
- P2 无僵尸 AC（所有 BDD 映射的方案均被实现）。[OK]
- P4 无超出设计范围的实现（EXTENSION）。[OK]

## 5. DESIGN_GAP 配对

P4§implementation 无 `[DESIGN_GAP]` 声明。无需配对。[OK]

## 6. SCOPE 增补闭环

P1§requirements 无范围增补。无需闭环。[OK]

## 7. 未决项清零

对 P1-requirements.md、P2-design.md、P4-implementation.md、P6-acceptance.md 全文检索：

- `[NEED_CONFIRM]`: 0 处 [OK]
- `[BLOCKER]`: 0 处 [OK]
- `[DEVIATION-CRITICAL]`: 0 处 [OK]

## 结论

6 项检查全部 [OK]，0 [BLOCKER]，0 [DEVIATION-CRITICAL]。P1-P6 跨文件一致性通过。
