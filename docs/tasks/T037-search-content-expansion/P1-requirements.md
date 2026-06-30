---
phase: P1
task_id: T037-search-content-expansion
type: requirements
parent: P0-brief.md
trace_id: T037-P1-20260630
status: draft
created: 2026-06-30
---

# P1 Requirements — T037: FTS5 Search Content Expansion

## 1. 需求复述

**问题**：当前 FTS5 全文搜索只匹配 entry 的 `summary` + `tags` 字段。用户无法通过文件内容中的关键词找到 entry——例如搜索 `"SQLAlchemy"` 找不到包含该词的 Python 源文件。

**目标**：将 FTS5 索引范围从 `(summary, tags)` 扩展到 `(summary, tags, content)`，其中 `content` 聚合该 entry 下所有文本文件的文本内容。二进制文件不进入索引。

**约束**：
- 文件内容存储在磁盘（storage），不在 DB 中——FTS5 不能用 `content='entries'` 同步模式直接引用
- 已有 entry 的文件内容需要回填索引
- 搜索 API 签名不变（`q` 参数），搜索范围透明扩大

## 2. 隐含需求识别

### IM-1: FTS5 表结构重建（非 ALTER 可解）

当前 `entries_fts` 用 `content='entries'` 同步模式（FTS5 自动从 entries 表读取数据）。新增 `content` 列后：
- `content` 列的数据来源是 files 表（+ 磁盘文件），不是 entries 表 → 同步模式不可用
- FTS5 虚拟表不支持 `ALTER TABLE ADD COLUMN` → 必须重建（DROP + CREATE）
- 重建期间搜索不可用 → 需要在 migration 中保证原子性

**为什么必须**：不加这步，功能无法实现。FTS5 表结构是核心依赖。

### IM-2: 触发器重新设计

当前 3 个触发器（INSERT/DELETE/UPDATE on entries）只同步 `summary, tags`。新增 `content` 后：
- entry INSERT 时需聚合该 entry 所有文本文件内容写入 FTS
- entry UPDATE（summary/tags 变更）时需更新 FTS 的 content 列
- files 变更（增删文件、update_entry 的 add_files/remove_file_ids）时也需更新 FTS content
- 当前 files 变更不触发 FTS 更新 → 这是新需求

**为什么必须**：不加触发器或等价逻辑，FTS content 列会与实际文件内容不一致。

### IM-3: 已有数据回填

已有 entry 的文件内容在磁盘上，FTS5 重建后为空。需要：
- 迁移时遍历所有 entry，读取文本文件内容，写入 FTS
- 大量文件读取可能耗时 → 需要考虑迁移性能
- 文件可能已从磁盘删除（entry 存在但文件丢失）→ 需容错

**为什么必须**：不回填 = 已有 entry 的内容搜索失效 = 功能上线即有缺陷。

### IM-4: 二进制文件排除

`is_binary_content()` 和 `File.is_binary` 字段已有。需要：
- FTS 索引时跳过 `is_binary=True` 的文件
- 大文件截断策略（P0 已识别）— 需确定截断阈值

**为什么必须**：索引二进制内容 = 索引膨胀 + 无效结果 + 可能的 UTF-8 解码错误。

### IM-5: 文件变更时 FTS 同步

`update_entry` 的 `add_files` / `remove_file_ids` 路径当前不触发 FTS content 更新（触发器只在 entries 表上）。需要：
- 文件增删后，重新聚合该 entry 的所有文本文件内容并更新 FTS

**为什么必须**：不同步 = 增删文件后搜索结果不准确。

### IM-6: rebuild_fts_index 更新

`rebuild_fts_index()` 当前只回填 `summary, tags`。需要扩展为也回填 `content`（读磁盘文件 + 聚合）。

**为什么必须**：rebuild 是运维恢复手段，必须与实际索引结构一致。

### IM-7: 前端搜索范围提示

P0 提到"前端搜索 UI 提示搜索范围"。当前 placeholder 为 `"Search..."`，扩展后用户不知道搜索范围已包含文件内容。

**为什么必须**：用户需要知道搜什么能命中，否则"搜了但不知道能搜到文件内容"= 功能不可发现。

### IM-8: 大文件截断阈值

P0 已识别。需确定：每个文本文件索引前 N 个字符还是全文？全 entry 聚合后的上限？

**为什么必须**：无限制 = 索引体积不可控 + 迁移/回填耗时不可控。

### IM-9: 搜索结果高亮/上下文

搜索命中文件内容时，用户如何知道是文件内容匹配而非 summary/tags？当前搜索只返回 entry 列表，不区分匹配来源。

**为什么必须（可裁剪）**：这是 UX 改善，不是功能阻塞。可作为后续迭代。当前只需确保搜索结果正确即可。

### IM-10: MCP / CLI 搜索自动受益

`list_entries` 的 `q` 参数直接传给 FTS5 MATCH。FTS5 索引扩展后，MCP `list_entries` 和 CLI `peekview list -q` 自动搜到文件内容，无需额外改动。

**为什么必须（已满足）**：确认不需要额外工作。

## 3. BDD 验收条件

### BDD-1: 文本文件内容可搜

```
Given 创建 entry，summary="Deploy script"，tags=["ops"]，
  且该 entry 包含文本文件 deploy.sh，内容含 "kubectl apply -f deployment.yaml"
When 用 q="kubectl" 搜索
Then 该 entry 出现在搜索结果中
```

### BDD-2: 二进制文件内容不进入索引

```
Given 创建 entry，summary="Logo asset"，
  且该 entry 包含二进制文件 logo.png（is_binary=True），
  且文本文件 readme.txt 内容含 "brand guidelines"
When 用 q="brand" 搜索
Then 该 entry 出现在搜索结果中（因为 readme.txt 匹配）
When 用 q="PNG" 搜索（假设 logo.png 二进制内容含此字节序列）
Then 该 entry 不出现在搜索结果中
```

### BDD-3: 已有 entry 回填后可搜

```
Given 数据库中存在已有 entry（FTS5 扩展前创建），
  且该 entry 的文本文件磁盘内容含 "legacy_function"
When 执行迁移（含回填）后，用 q="legacy_function" 搜索
Then 该 entry 出现在搜索结果中
```

### BDD-4: 增删文件后 FTS 同步

```
Given 创建 entry，summary="Config files"，包含 config.yaml（内容含 "database_url"）
When 通过 update_entry 的 remove_file_ids 删除 config.yaml
Then 用 q="database_url" 搜索，该 entry 不出现
When 通过 update_entry 的 add_files 添加新文件 app.py（内容含 "flask_route"）
Then 用 q="flask_route" 搜索，该 entry 出现
```

### BDD-5: 前端搜索框提示搜索范围

```
Given 前端加载完成
When 查看搜索输入框
Then placeholder 文本提示搜索范围包含文件内容（如 "Search summaries & file content..."）
```

### BDD-6: 大文件内容截断

```
Given 创建 entry，包含文本文件 large.log（大小超过截断阈值，前 N 字符含 "unique_marker_abc"，截断范围外含 "unique_marker_xyz"）
When 用 q="unique_marker_abc" 搜索
Then 该 entry 出现在搜索结果中
When 用 q="unique_marker_xyz" 搜索
Then 该 entry 不出现在搜索结果中
```

### BDD-7: 搜索结果仍包含 summary/tags 匹配

```
Given 创建 entry，summary="FastAPI tutorial"，tags=["python"]，无文本文件含 "FastAPI"
When 用 q="FastAPI" 搜索
Then 该 entry 出现在搜索结果中（summary 匹配）
When 用 q="python" 搜索
Then 该 entry 出现在搜索结果中（tags 匹配）
```

### BDD-8: 空 entry（无文件）搜索不受影响

```
Given 创建 entry，summary="Empty entry"，无文件
When 用 q="Empty" 搜索
Then 该 entry 出现在搜索结果中
When 用 q="nonexistent_random_string" 搜索
Then 该 entry 不出现
```

## 4. 待确认清单

### [NEED_CONFIRM] NC-1: 大文件截断阈值

每个文本文件索引内容的最大字符数？建议选项：
- A) 每文件 100KB（~100K 字符）— 覆盖绝大多数源代码文件
- B) 每文件 50KB — 更保守
- C) 不截断 — 最完整但索引最大

**影响**：直接决定索引体积和回填耗时。建议 A。

### [NEED_CONFIRM] NC-2: 搜索范围提示文案

前端 placeholder 文案？建议：
- A) `"Search summaries & file content..."` — 明确范围
- B) `"Search entries..."` — 简洁但不够具体
- C) `"Search..."` — 维持现状，不做变更

**影响**：UX 可发现性。建议 A。

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P8]
pruning_reason:
  P0: 已完成（P0-brief.md）
  P1: 本文档
  P2: 保留 — FTS5 表结构重建 + 触发器重新设计 + 回填策略，方案不明确需设计
  P3: 保留 — FTS5 触发器和搜索逻辑变更，TDD 确保正确性
  P4: 保留 — 实现代码
  P5: 保留 — 数据模型 + FTS5 索引变更必须验证隔离和正确性
  P6: 保留 — BDD 验收需实跑，含 Playwright 截图验证前端提示
  P7: 跳过 — 改动集中在 database.py + entry_service.py + SearchInput.vue，一致性风险低
  P8: 保留 — 后端版本需 bump（schema 变更）
```

## 6. 范围声明

```yaml
packages:
  - peekview (PyPI, backend)

domains:
  - backend: database.py (FTS5 表结构/触发器/rebuild), entry_service.py (文件变更时 FTS 同步), storage.py (回填时读文件)
  - frontend: SearchInput.vue (placeholder 文案)
  - api: entries.py 无变更（q 参数透传，FTS 扩展自动生效）
  - mcp: 无变更（list_entries 的 q 参数自动受益）
  - cli: 无变更（list -q 自动受益）
  - security: 无新增风险（FTS5 查询净化已有）

ui_affected:
  - SearchInput.vue placeholder 文案
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: backend-testing
    why: FTS5 触发器、回填、搜索逻辑需要 pytest 验证
    available:
      - pytest + conftest.py 隔离机制
    status: available

  - need: frontend-typecheck
    why: SearchInput.vue 文案变更需 vue-tsc 验证
    available:
      - npx vue-tsc --noEmit
    status: available

  - need: browser-vision
    why: P6 验收 BDD-5 需截图验证搜索框提示文案
    available:
      - playwright-vision skill
      - vision-analyst (agate)
    status: available
    requires_minimal_validation: true
```
