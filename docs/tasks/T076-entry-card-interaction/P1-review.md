---
phase: P1
task_id: T076-entry-card-interaction
type: review
parent: P1-requirements.md
trace_id: T076-P1-review-20260730
status: approved
created: 2026-07-30
agent: requirements-review
---

## BDD 评审

### 卡片交互语义（EntryCard 拆分）

- BDD-01: PASS 可判定。Given/When/Then 明确（hover title → 下划线，其余无）。覆盖维度：前端✓
- BDD-02: PASS 可判定。SPA 导航 + URL 断言明确。覆盖维度：前端✓
- BDD-03: PASS 可判定。导航目标 /users/alice 明确。覆盖维度：前端✓
- BDD-04: PASS 可判定。右键复制链接 → 剪贴板含 /my-post。覆盖维度：前端✓
- BDD-05: PASS 可判定。右键 → 剪贴板含 /users/alice。覆盖维度：前端✓
- BDD-06: PASS 可判定。非链接区域无下划线 + 光标箭头。覆盖维度：前端✓

### Tag 交互（BaseTag 可点击 + tag-overflow tooltip）

- BDD-07: PASS 可判定。点击 tag → /explore?tags=python + 列表过滤。覆盖维度：前端✓
- BDD-08: PASS 可判定。hover tag → 下划线 + 手型光标。覆盖维度：前端✓
- BDD-09: PASS 可判定。hover +2 → tooltip 列出 5 个 tags。覆盖维度：前端✓
- BDD-10: PASS 可判定。touch tap +2 → 显示全部 tags。覆盖维度：前端✓ 移动端✓

### Explore 页 tag 过滤

- BDD-11: PASS 可判定。URL 参数 → 列表过滤结果。覆盖维度：前端✓
- BDD-12: PASS 可判定。chip 指示 + 移除后恢复。覆盖维度：前端✓
- BDD-13: PASS 可判定。多 tag AND 语义明确。覆盖维度：前端✓ 边界✓
- BDD-14: PASS 可判定。tags + q 组合过滤。覆盖维度：前端✓
- BDD-15: PASS 可判定。刷新后 URL 状态恢复。覆盖维度：前端✓

### EntryListRow 同步

- BDD-16: PASS 可判定。list 视图 title 点击 → SPA 导航。覆盖维度：前端✓
- BDD-17: PASS 可判定。list 视图 tag 点击 → /explore?tags=k8s。覆盖维度：前端✓
- BDD-18: PASS 可判定。list 视图 username → /users/bob。覆盖维度：前端✓
- BDD-19: PASS 可判定。hover 语义与 grid 一致。覆盖维度：前端✓

### 键盘可访问性

- BDD-20: PASS 可判定。Tab 遍历 + 可见 focus 指示。覆盖维度：前端✓ 可访问性✓

### 卡片整体 hover

- BDD-21: PASS 可判定。hover 任意区域 → 边框高亮保持。覆盖维度：前端✓ 兼容✓

## 覆盖维度总结

| 维度 | 覆盖情况 |
|------|----------|
| EntryCard 拆分 | ✓ BDD-01~06 |
| EntryListRow 同步 | ✓ BDD-16~19 |
| BaseTag 可点击 | ✓ BDD-07, BDD-08 |
| Explore tag 过滤 | ✓ BDD-11~15 |
| tag-overflow tooltip | ✓ BDD-09, BDD-10 |
| 移动端 | ✓ BDD-10 |
| 可访问性 | ✓ BDD-20 |
| 右键复制链接 | ✓ BDD-04, BDD-05 |
| 卡片 hover 兼容 | ✓ BDD-21 |
| 数据 | N/A（纯前端，无后端变更） |
| 多端 | N/A（MCP/CLI/API 无需同步） |

## P0 验证标准对照

P0 列出 11 项验证标准，逐条映射：

1. hover card-title 下划线 + 点击进详情 → BDD-01, BDD-02 ✓
2. hover meta-username 下划线 + 点击进 user 页 → BDD-03 ✓
3. hover meta-time/sep 无下划线 → BDD-06 ✓
4. hover base-tag 下划线 + 点击进过滤页 → BDD-07, BDD-08 ✓
5. 右键 username 复制 user URL → BDD-05 ✓
6. 右键 title 复制 entry URL → BDD-04 ✓
7. tag-overflow hover tooltip → BDD-09 ✓
8. Explore URL ?tags= 过滤 → BDD-11 ✓
9. EntryListRow 同步 → BDD-16~19 ✓
10. make typecheck → P5 构建验证（非 BDD 范畴）✓
11. make build-frontend → P5 构建验证（非 BDD 范畴）✓

全部覆盖。

## 路径修正核实

analyst 将 P0 的 `/?tags=xxx` 修正为 `/explore?tags=xxx`。独立核实 router.ts：

- `/` → LandingView（router.ts:8-11）
- 认证用户访问 `/` 时 redirect 到 `/explore`（router.ts:80-82），但 `return '/explore'` 不保留 query 参数
- `/explore` → EntryListView（router.ts:13-16）

结论：修正正确。若 tag href 指向 `/?tags=python`，认证用户会被 redirect 丢失 query；匿名用户则落在 LandingView 无过滤能力。`/explore?tags=python` 是唯一正确目标。

## 隐含需求覆盖

- 数据维度：无（不改后端）✓
- 前端维度：SPA 导航保持（隐含需求 #1）→ BDD-02 的 "无全页刷新" 覆盖 ✓；EntryListRow tag 截断（隐含需求 #2）→ 识别但未建 BDD（见建议）；URL 同步（#3）→ BDD-15 ✓；过滤器组合（#4）→ BDD-14 ✓；键盘 focus（#5）→ BDD-20 ✓；移动端 tooltip（#6）→ BDD-10 ✓；BaseTag 共用（#7）→ BDD-07/17 覆盖两处 ✓
- 多端维度：N/A ✓
- 边界维度：特殊字符 URL 编码 → 识别但未建 BDD（见建议）
- 兼容维度：card-body 点击区域缩小 → BDD-21 保持 hover 高亮 ✓

## 裁剪评审

无裁剪（P1-P8 全走）。理由充分：4 组件 + URL 路由逻辑 + UI 交互需 Playwright 验证 + 多文件需一致性核对。risk=low 判断合理（纯前端 UI，不涉及数据/权限/安全）。

## P1 纯净性

BDD 均描述用户可观测行为（hover/点击/导航/显示），未混入具体实现方案。需求复述中的 HTML 结构对比是问题描述（现状 vs 目标），非解决方案设计，可接受。

## 建议（非阻断）

1. **tag 特殊字符编码**：隐含需求识别中提到"tags 含特殊字符（空格、中文）时 URL 编码需正确"，但无对应 BDD。建议在 P3 单测中覆盖（encodeURIComponent 行为），不必新增 BDD——因为这是标准 URL 编码行为，非独立用户场景。
2. **tag 过滤无结果空状态**：`/explore?tags=nonexistent` 无匹配时应有空状态提示。现有 Explore 页已有搜索无结果的空状态组件，tag 过滤可复用，不必单独建 BDD。P4 实现时注意即可。
3. **EntryListRow tag 截断**：隐含需求 #2 提到 list 视图 tags 无截断可能撑开行高。这是 P2 设计决策（是否对 list 视图也加 TAG_LIMIT），不影响当前 BDD 基线。

## 结论

21 条 BDD 完整覆盖 P0 全部验证标准，编号连续（BDD-01~21），格式规范（`#### BDD-NN:`），每条可二值判定。路径修正经独立核实正确。隐含需求识别充分，3 项未建 BDD 的边界情况均有合理归属（P3 单测/P2 设计/现有组件复用）。裁剪合理，capability_requirements 状态正确。

**status: approved**
