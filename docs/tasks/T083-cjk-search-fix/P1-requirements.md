---
phase: P1
task_id: T083-cjk-search-fix
type: problems
parent: P0-brief.md
trace_id: T083-P1-20260731
status: draft
created: 2026-07-31
agent: analyst
---

# P1 需求基线 — T083: 中文搜索与 Tag 过滤修复

## 需求复述

三个独立的后端 bug 需要修复，不涉及前端和 MCP：

1. **Tag 过滤失效**：非 ASCII tag（如中文）的过滤完全失效，因为 SQLModel `Column(JSON)` 的 `ensure_ascii=True` 将中文转为 `\uXXXX`，而 LIKE 查询匹配原始字符。需改用 SQLite `json_each` 精确匹配。
2. **FTS5 中文子词搜索失效**：FTS5 默认 `unicode61` tokenizer 不分词 CJK，连续中文字符整体为一个 token，导致子词搜索（搜"组件"找不到"组件库"）失败。需在应用层用 jieba 预分词，写入 FTS 前空格分隔。
3. **连字符复合 tag 搜索盲区**：`unicode61` 将 `google-gemini` 视为整体 token，搜 `gemini` 不命中。需在 FTS 索引文本中将连字符替换为空格。

## 隐含需求识别

### 数据维度

1. **FTS5 全部文本写入路径的 tags/summary 不一致** — 共有四条独立的 FTS 文本写入路径，均需走 jieba 分词 + 连字符→空格处理：
   - **trigger 路径**（database.py L277-302）：INSERT/UPDATE 时直接用 `NEW.tags`（JSON 存储值，含 `\uXXXX` 转义）和 `NEW.summary`（原始文本）。
   - **应用层 `_update_fts_content`**（entry_service.py L68-114）：用 `" ".join(entry.tags)`（原始文本）和 `entry.summary`。
   - **`backfill_fts_content`**（database.py L506）：存量数据补录路径，写入 `entry.tags`/`entry.summary`。
   - **`rebuild_fts_index`**（database.py L379-428）：全量重建路径，L411 写入 `summary=entry.summary`，L412 写入 `tags=" ".join(entry.tags or [])`。虽然该函数当前未被启动流程调用（启动走 `backfill_fts_content`），但它是公开函数且测试可能引用，若不同步处理将导致 P7 一致性检查标记为不一致。**所有四条路径都需覆盖 jieba 分词 + 连字符→空格处理。**

2. **backfill 触发条件不满足** — `backfill_fts_content`（database.py L506）只在 `content_count < entry_count` 时执行。改 FTS tags 索引文本后，已有数据的 content_count 不变，backfill 不会触发。**必须确保存量数据在启动时被重新索引**（修改 backfill 触发条件或强制 rebuild）。

3. **summary 和 content 字段也需预分词** — FTS 索引包含 summary、tags、content 三个字段。中文子词搜索失效不仅影响 tags，也影响 summary 和 content。jieba 预分词必须覆盖所有进 FTS 的文本字段。

4. **查询端也需分词** — 用户搜索 `组件库` 时，如果不分词直接送 FTS5 MATCH，unicode61 仍将其作为整体 token 匹配。查询端也需 jieba 分词后送 MATCH。但 jieba 分词后多个词空格连接，FTS5 中空格是 AND 操作符，需确认语义正确（搜"组件库"→分词"组件 库"→FTS5 AND→命中包含两个词的文档）。

### 前端维度

无 — P0-brief 明确约束不改前端。tag 过滤和搜索的前端交互不变，前端请求参数（`?tags=前端`、`?q=组件`）不变。

### 多端维度

- **MCP**：P0-brief 明确约束不改 MCP。MCP 通过 API 创建 entry，entry 创建后走后端 FTS 写入逻辑，MCP 不直接操作 FTS。无隐含需求。
- **CLI**：CLI `peekview list -t <tag>` 和 `peekview list -q <query>` 走后端 API，不直接操作 FTS。无隐含需求。
- **API**：`GET /api/v1/entries?tags=<tag>&q=<query>` 是唯一入口。请求/响应格式不变。无隐含需求。

### 边界维度

5. **jieba 并发安全** — FastAPI 是异步多线程环境。jieba 的 `cut` 函数在默认模式下是否线程安全需确认。如果不安全，需加锁或使用精确模式（精确模式文档明确线程安全）。

6. **jieba 首次加载延迟** — 首次 `jieba.cut()` 加载 dict 约 0.4s。需在应用启动时预加载（lifespan），避免首请求延迟。

7. **jieba 对非中文文本的影响** — jieba 对英文、数字、混合文本的分词行为需确认。例如 `FastAPI` 是否被切成 `Fast` + `API`？如果切错，英文搜索可能回归。需测试覆盖。

8. **空 tags / 空 query** — `entry.tags = None` 或 `[]` 时，FTS tags 字段写入空字符串。`q = ""` 或 `q = "  "` 时不走 FTS 查询。这些边界已由现有代码处理，需确保 jieba 分词不破坏。

9. **FTS5 查询净化与 jieba 交互** — 当前 `search_entries` 只转义引号。jieba 分词后的查询如果含 FTS5 特殊字符（如 `*`、`:`），需安全处理。但 jieba 分词输出是普通中文/英文词，不含 FTS5 语法字符，风险低。仍需测试覆盖。

10. **json_each 对非数组 tags 的处理** — 如果 `tags` 字段为 `None` 或空数组 `[]`，`json_each` 行为需确认（SQLite `json_each(NULL)` 返回空集，`json_each('[]')` 返回空集）。不会报错。

### 兼容维度

11. **英文 tag 过滤零回归** — 改用 `json_each` 后，英文 tag 过滤行为必须与原 LIKE 一致。LIKE 是子串匹配（`%"python"%`），json_each 是精确匹配。语义上精确匹配更正确（消除 `pythonic` 匹配 `python` 的误匹配），但需确认无现有测试断言了子串匹配行为。

12. **英文搜索零回归** — jieba 对英文文本的分词不能破坏现有英文搜索。需测试覆盖。

13. **FTS trigger 的 summary 字段** — trigger 在 INSERT/UPDATE 时写入 `NEW.summary`（原始文本），应用层 `_update_fts_content` 也写入 `entry.summary`。如果 summary 需要 jieba 预分词，trigger 路径也需覆盖（同隐含需求 1）。

14. **现有测试可能断言 LIKE 查询方式** — 需检查是否有测试直接断言了 SQL 查询包含 `LIKE`，如有需同步更新。

15. **search_entries 函数处理策略** — `search_entries()`（database.py:349-376）是独立于 API 路径的 FTS5 搜索函数，当前仅测试使用（test_database.py:174/191/207），API 路径走 `list_entries()` 自己的 FTS MATCH（entry_service.py:466-486）。如果 P4 修改查询端分词只改 `list_entries` 而不改 `search_entries`，测试与生产行为可能不一致。**处理策略：同步更新 `search_entries` 的查询端分词逻辑**，与 `list_entries` 保持一致，避免测试与生产行为分叉。

## BDD 验收条件

### Tag 过滤（Bug 1）

#### BDD-1: 中文 tag 过滤返回正确结果
- Given 数据库中存在 entry，其 tags 为 `["前端", "Vue"]`（存储为 JSON `\uXXXX` 转义形式）
- When 通过 API `GET /api/v1/entries?tags=前端` 查询
- Then 该 entry 出现在返回结果中

#### BDD-2: 日文 tag 过滤返回正确结果
- Given 数据库中存在 entry，其 tags 为 `["テスト"]`
- When 通过 API `GET /api/v1/entries?tags=テスト` 查询
- Then 该 entry 出现在返回结果中

#### BDD-3: 英文 tag 过滤零回归
- Given 数据库中存在 entry，其 tags 为 `["python", "auth"]`
- When 通过 API `GET /api/v1/entries?tags=python` 查询
- Then 该 entry 出现在返回结果中

#### BDD-4: tag 精确匹配不误命中子串
- Given 数据库中存在两个 entry，tags 分别为 `["python"]` 和 `["pythonic"]`
- When 通过 API `GET /api/v1/entries?tags=python` 查询
- Then 只有 tags 为 `["python"]` 的 entry 出现在结果中（`pythonic` 不出现）

#### BDD-5: 多 tag 过滤返回同时包含所有 tag 的 entry
- Given 数据库中存在 entry，其 tags 为 `["前端", "Vue", "组件库"]`
- When 通过 API `GET /api/v1/entries?tags=前端&tags=Vue` 查询
- Then 该 entry 出现在返回结果中

#### BDD-6: 不存在的 tag 过滤返回空结果
- Given 数据库中存在 entry，其 tags 为 `["前端"]`
- When 通过 API `GET /api/v1/entries?tags=不存在` 查询
- Then 返回结果为空

### FTS5 中文搜索（Bug 2）

#### BDD-7: 中文子词搜索命中
- Given 数据库中存在 entry，其 summary 含中文文本"前端组件库设计"（或 tags 含"组件库"）
- When 通过 API `GET /api/v1/entries?q=组件` 搜索
- Then 该 entry 出现在搜索结果中

#### BDD-8: 中文整词搜索命中
- Given 数据库中存在 entry，其 summary 含中文文本"前端组件库"
- When 通过 API `GET /api/v1/entries?q=组件库` 搜索
- Then 该 entry 出现在搜索结果中

#### BDD-9: 英文搜索零回归
- Given 数据库中存在 entry，其 summary 为 "FastAPI tutorial"
- When 通过 API `GET /api/v1/entries?q=FastAPI` 搜索
- Then 该 entry 出现在搜索结果中

#### BDD-10: 中英文混合搜索命中
- Given 数据库中存在 entry，其 tags 为 `["前端", "Vue", "组件库"]`
- When 通过 API `GET /api/v1/entries?q=Vue` 搜索
- Then 该 entry 出现在搜索结果中

#### BDD-11: 无匹配中文搜索返回空结果
- Given 数据库中存在 entry，其 summary 为"前端组件库"
- When 通过 API `GET /api/v1/entries?q=数据库` 搜索
- Then 返回结果为空

### 连字符复合 tag 搜索（Bug 3）

#### BDD-12: 连字符 tag 的子词搜索命中
- Given 数据库中存在 entry，其 tags 为 `["google-gemini"]`
- When 通过 API `GET /api/v1/entries?q=gemini` 搜索
- Then 该 entry 出现在搜索结果中

#### BDD-13: 连字符 tag 整词搜索命中
- Given 数据库中存在 entry，其 tags 为 `["google-gemini"]`
- When 通过 API `GET /api/v1/entries?q=google` 搜索
- Then 该 entry 出现在搜索结果中

### 存量数据与启动

#### BDD-14: 启动后存量数据 FTS 索引被重建
- Given 数据库中已有 entry（在修复前创建，FTS tags 字段未分词）
- When 应用启动（执行 backfill/rebuild）
- Then 通过 API 搜索中文子词能命中存量 entry

#### BDD-15: 新建 entry 的 FTS 索引正确分词
- Given 应用已启动，jieba 已加载
- When 通过 API 创建新 entry，tags 为 `["组件库"]`，summary 为"前端组件"
- Then 立即通过 API `GET /api/v1/entries?q=组件` 搜索能命中该 entry

### 回归与安全性

#### BDD-16: 现有测试全部通过
- Given 代码修改完成
- When 执行 `make test-quick`
- Then 所有测试通过（如有测试断言了 LIKE 查询方式，已同步更新为 json_each 语义）

#### BDD-17: jieba 预加载不阻塞首请求
- Given 应用启动完成
- When 立即发送第一个搜索请求
- Then 响应时间不超过 1 秒（jieba dict 已在启动时预加载；P6 验收时通过 `curl -w '%{time_total}'` 测量首请求耗时，或 pytest 超时断言 `@pytest.mark.timeout(1)` 验证）

## 待确认清单

[NO_NEED_CONFIRM]

P0-brief 已明确定义三个 bug 的根因和修法方向，约束清晰（不改 schema/前端/MCP/存储 tag 值），隐含需求均可通过技术分析确定方向，无需人工决策。

## 裁剪说明

```yaml
P1_simplified: false
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

- **P1 不裁**（核心阶段，不可裁剪）
- **P2 不裁**：涉及 FTS5 四条文本写入路径（trigger、_update_fts_content、backfill_fts_content、rebuild_fts_index）协调、backfill 触发条件、jieba 并发安全、search_entries 查询端分词一致性等多个设计决策点，必须有方案设计
- **P3 不裁**：三个 bug 均有可测试行为，需 TDD 红灯。BDD 条件多达 17 条，测试覆盖是重点
- **P4 不裁**：代码实现
- **P5 不裁**：需验证全量测试通过 + 环境隔离
- **P6 不裁**：BDD 逐条实跑验收（涉及搜索/过滤行为变更，不可跳）
- **P7 不裁**：多文件改动（entry_service.py / database.py / main.py / pyproject.toml），需跨文件一致性检查
- **P8 不裁**：jieba 新依赖需加入 pyproject.toml，版本/CHANGELOG 需更新

## 范围声明

```yaml
domains: [backend]
packages:
  - backend/peekview/services/entry_service.py
  - backend/peekview/database.py
  - backend/peekview/main.py
  - backend/pyproject.toml
  - backend/tests/ (新增/更新测试)
risk_level: medium
```

**risk_level 判定理由**：
- 涉及 FTS5 trigger 与应用层写入路径的协调（机制交叉：trigger + 应用层 _update_fts_content + backfill_fts_content + rebuild_fts_index 四条路径）
- jieba 新依赖引入并发安全 + 预加载时序问题
- 存量数据迁移（backfill 触发条件变更）
- 不涉及 schema 变更/安全/多端，故不是 high

## 能力需求声明

```yaml
capability_requirements:
  - need: sqlite-json1
    why: json_each 需要 SQLite JSON1 扩展（3.9+）
    available:
      - "SQLite 3.45.1（当前环境，已验证支持 json_each）"
    status: available

  - need: jieba-package
    why: 中文分词预分词
    available:
      - "jieba 0.42.1 已在 venv 和系统 Python 安装"
    status: available

  - need: pytest-venv
    why: P5 技术验证需跑 make test-quick
    available:
      - "backend/.venv（make dev 管理）"
    status: available

  - need: debug-backend
    why: P6 验收需通过 :8888 调试后端实跑 BDD
    available:
      - "make debug（:8888，/tmp/peekview-debug/）"
    status: available
```

无 `status: GAP` 项，不触发 `[CAPABILITY_GAP]`。

## [PROD_NOT_TOUCHED]

本阶段为需求分析，仅读取代码文件，未触碰生产环境。
