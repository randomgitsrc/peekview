---
phase: P7
task_id: T076-entry-card-interaction
type: consistency
parent: P6-acceptance.md
trace_id: T076-P7-20260730
status: approved
created: 2026-07-30
agent: consistency-reviewer
---

# P7 一致性检查 — T076 EntryCard 交互语义修复

## 检查清单

### 1. DESIGN_GAP 配对

P4§implementation 声明 DESIGN_GAP 数量 = 0（grep `\[DESIGN_GAP` 确认）。无 DESIGN_GAP，实现忠实 P2 方案 A。

[DESIGN_GAP_REVIEWED: 无 DESIGN_GAP 需配对，P4 声明 0 个偏差，实现与 P2§候选方案-方案A 完全吻合]

验证依据：逐项核对实现代码与 P2§设计细节：
- BaseTag.vue：`href` prop + `navigate` emit + `<a>`/`<span>` 多态渲染 = P2§BaseTag改造
- EntryCard.vue：card-body `<div>` + title `<a>` + username `<a>` + BaseTag href + tag-overflow `<button>` + navigateToEntry 内含 firstFileId = P2§EntryCard结构
- EntryListRow.vue：同 EntryCard 模式 + TAG_LIMIT=3 = P2§EntryListRow结构
- searchUrl.logic.ts：`RestoredQuery.tags: string[]` + 逗号分隔解析 = P2§EntryListView tag过滤 point 6
- EntryListView.vue：currentTags ref + restoreFromURL + loadEntries 传 tags + FilterChip + removeTag + onBeforeRouteUpdate = P2§EntryListView tag过滤 points 1-5
- EntryCard/EntryListRow 已移除 `navigate` emit；EntryListView 已移除 `@navigate` 绑定 = P2§navigate emit 清理

P2-review NOTE 1 采纳（tag-overflow 用 `<button>` 替代 `<span tabindex=0>`）是实现优化，不改变架构方向，不构成 DESIGN_GAP。

### 2. SCOPE+ 闭环

全阶段产出 grep `^\[SCOPE+\]` = 0。无 SCOPE+ 增补，无需闭环。

P1§待确认清单 含 `[NO_NEED_CONFIRM]`（合规负向声明）。

### 3. 跨文件一致性

#### 3.1 BDD 编号内容映射（P1§BDD ↔ P6§验收）

P1 BDD 总数 = 21（`#### BDD-NN` 标题数）；P6 验收 PASS 行 = 21（`- PASS BDD-NN` 行数）；FAIL = 0。

逐条内容映射核对（P1 标题 → P6 验收描述）：

| BDD | P1§BDD 标题 | P6§验收 描述 | 映射 |
|-----|-------------|-------------|------|
| 01 | 仅 title hover 显示下划线 | hover title 仅 title 出现下划线 | ✓ |
| 02 | 点击 title 进入 entry 详情页 | 点击 title SPA 导航到 entry 详情页 | ✓ |
| 03 | 点击 username 进入用户页 | 点击 username 导航到 /users/{username} | ✓ |
| 04 | 右键 title 复制 entry URL | 右键 title 可复制真实 entry URL | ✓ |
| 05 | 右键 username 复制 user URL | 右键 username 可复制真实 user URL | ✓ |
| 06 | hover 非链接区域无下划线 | hover 时间戳/分隔符等非链接区域无下划线 | ✓ |
| 07 | 点击 tag 跳转到 tag 过滤页 | 点击 tag 跳转 /explore?tags={tag} | ✓ |
| 08 | tag hover 显示下划线 | hover tag 出现下划线，光标为手型 | ✓ |
| 09 | tag-overflow hover 显示全部 tags | hover tag-overflow "+N" 显示全部 tags 的 tooltip | ✓ |
| 10 | 移动端 tag-overflow tap 可触发 | 移动端 tap "+N" 可触发全部 tags 显示 | ✓ |
| 11 | URL 带 tags 参数时列表按 tag 过滤 | URL 带 ?tags=python 时列表仅显示含该 tag 的 entries | ✓ |
| 12 | tag 过滤有视觉指示且可移除 | tag 过滤有 chip 视觉指示，点击移除后列表恢复 | ✓ |
| 13 | 多 tag 过滤 | 多 tag 过滤（?tags=python,cli）仅显示同时含两 tag | ✓ |
| 14 | tag 过滤与搜索组合 | tag 过滤与搜索组合（?tags=python&q=hello）生效 | ✓ |
| 15 | tag 过滤刷新后恢复 | tag 过滤刷新页面后从 URL 恢复 | ✓ |
| 16 | list 视图 title 点击进入详情 | list 视图点击 title SPA 导航到 entry 详情页 | ✓ |
| 17 | list 视图 tag 点击跳转过滤页 | list 视图点击 tag 跳转 /explore?tags={tag} | ✓ |
| 18 | list 视图 username 点击进入用户页 | list 视图点击 username 导航到 /users/{username} | ✓ |
| 19 | list 视图 hover 语义与 grid 一致 | list 视图 hover 语义与 grid 一致 | ✓ |
| 20 | Tab 键可聚焦 title/username/tag 链接 | Tab 遍历 title/username/tag 链接依次获得焦点 | ✓ |
| 21 | 卡片 hover 边框高亮保持 | 卡片 hover 边框高亮保持 | ✓ |

21/21 编号一一对应，内容语义正确映射。

#### 3.2 packages 与改动范围（P2§packages ↔ P4§implementation_dir）

- P2§四字段 packages = [frontend-v3]，domains = [frontend]
- P4§implementation_dir = frontend-v3/src
- P4§改动文件清单：5 实现文件（BaseTag.vue / EntryCard.vue / EntryListRow.vue / searchUrl.logic.ts / EntryListView.vue）+ 6 测试适配文件，全部在 frontend-v3/ 下
- 无后端文件改动，与 P1§范围声明 domains=[frontend] 一致

#### 3.3 实现路径与 P2 方案吻合（P4§改动清单 ↔ P2§候选方案-方案A）

P2§files_to_read 列出的 8 个文件与 P4 实际改动范围吻合：
- P2 列 EntryCard.vue / EntryListRow.vue / BaseTag.vue / EntryListView.vue / searchUrl.logic.ts → P4 全部改动
- P2 列 FilterChip.vue（复用不改）→ P4 未改，EntryListView 直接 import 复用
- P2 列 BaseTag.spec.ts / search.spec.ts（测试参考）→ P4 适配了相关测试

P2§不改什么 声明的 client.ts / types/index.ts / stores/entry.ts / router.ts → P4 改动清单中均未出现，一致。

### 4. 未决项清零

- 全阶段产出 grep `[NEED_CONFIRM]` = 0（排除 `[NO_NEED_CONFIRM]`）
- 全阶段产出 grep 行首 `[BLOCKER]` = 0
- 全阶段产出 grep `[DEVIATION-CRITICAL]` = 0
- P1§待确认清单 含 `[NO_NEED_CONFIRM]`（line 174）
- P6§待确认清单 含 `[NO_NEED_CONFIRM]`（line 97）

## 结论

[BLOCKER]: 0 条
[DEVIATION-CRITICAL]: 0 条

4 项检查全部通过。实现忠实 P2 方案 A，无设计偏差，BDD 21 条一一映射正确，无未决项。
