
## analyst 读取 P1-dispatch-context-analyst.md
- 角色：analyst（需求质疑模式）
- 目标：为 T083 建立需求基线
- 门槛：BDD ≥1 条 + domains/packages/risk_level/phases 声明 + 无 NEED_CONFIRM + 隐含需求五维度识别

## analyst 读取 analyst.md 角色定义
- 小任务降级模式可用（明确 bug 修复），但需求质疑和 BDD 不可跳
- 隐含需求五维度：数据/前端/多端/边界/兼容
- BDD 反模式自检：不绑 CSS/HTML 属性/主观词，必须可二值判定

## analyst 读取 P0-brief.md
- 三个独立 bug：tag 过滤失效（json_each）/ FTS5 中文子词搜索（jieba 预分词）/ 连字符复合 tag（FTS 索引文本连字符→空格）
- 约束：不改 schema、不改存储 tag 值、不改 MCP/前端、jieba 新依赖、现有测试全绿、启动 rebuild FTS
- 已知风险：jieba 0.4s 首加载、分词不完美、FTS5 查询净化需配合 jieba

## analyst 读取 entry_service.py（tag 过滤 + FTS 写入 + FTS 查询）
- L458-463: tag 过滤用 LIKE `Entry.tags.cast(String).like(f'%"{tag}"%')` — 对 ASCII tag 可工作，对非 ASCII tag 因 ensure_ascii 转义而失败
- L85-115: `_update_fts_content` — 写入 FTS 时 `tags=" ".join(entry.tags or [])`（应用层，空格连接）
- L466-486: FTS 查询 — `SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q`，只做 `q.strip()`，try/except 吞异常
- 关键发现：FTS5 trigger（database.py L277-302）在 INSERT/UPDATE 时直接用 `NEW.tags`（原始 JSON 存储值，即 `\uXXXX` 转义后的文本），不走应用层的 `" ".join()`。这意味着 trigger 写入的 tags 字段和应用层 `_update_fts_content` 写入的 tags 字段内容不同！

## analyst 读取 database.py（FTS5 表定义 + search + rebuild + backfill）
- L248-306: `setup_fts5` — contentless + contentless_delete 模式，trigger 在 INSERT/UPDATE 后用 `NEW.tags` 写 FTS
- L349-376: `search_entries` — 查询净化只转义引号，try/except 吞异常
- L379-428: `rebuild_fts_index` — 全量重建，tags 用 `" ".join(entry.tags or [])`（应用层空格连接）
- L492-528: `backfill_fts_content` — 幂等，比较 content_count >= entry_count 决定是否执行；全量 DELETE + 重新 INSERT，tags 用 `" ".join(entry.tags or [])`
- 重要：backfill 的触发条件是 `content_count >= entry_count`。如果只改 tags 索引文本不改 content，backfill 不会触发（因为 content_count 已满足条件）。需要修改 backfill 的触发条件或强制 rebuild。

## analyst 读取 main.py（lifespan 启动）
- L212-214: `backfill_fts_content(engine, storage)` 在启动时调用
- jieba 预加载应在此处或之前

## analyst 读取 pyproject.toml（dependencies）
- L25-42: dependencies 列表，需加 jieba

## analyst 识别隐含需求
1. **FTS5 trigger 与应用层 FTS 写入的 tags 不一致**：trigger 用 `NEW.tags`（JSON 转义文本），应用层用 `" ".join(entry.tags)`（原始文本）。如果 jieba 预分词只改应用层路径，trigger 路径仍然写入未分词的 JSON 转义文本。需要确保两条路径都走 jieba 分词，或让 trigger 只写空 tags 再由应用层覆盖。
2. **backfill 触发条件不满足**：backfill 只在 `content_count < entry_count` 时执行。改 FTS tags 索引文本后，已有数据的 content_count 不变，backfill 不会触发。需要强制 rebuild 或修改触发条件。
3. **jieba 查询分词与 FTS5 MATCH 语法交互**：jieba 分词后多个词用空格连接，FTS5 MATCH 中空格是 AND。需要确认分词后查询的正确性。
4. **jieba 对非中文文本的影响**：jieba 对英文、数字、混合文本的分词行为需确认（如 `FastAPI` 是否被切成 `Fast` + `API`）。
5. **summary 字段也进 FTS**：summary 的中文也需要 jieba 预分词，不只是 tags 和 content。
6. **content 字段的中文**：文件内容的中文也需要 jieba 预分词。
7. **查询端也要分词**：用户搜索 `组件库` 时，jieba 可能切成 `组件` + `库`，FTS5 MATCH 变成 `组件 库`（AND），需要确认语义正确。
8. **jieba 并发安全**：jieba 的 `cut` 函数是否线程安全？FastAPI 是异步多线程环境。
9. **存量数据迁移**：已有 entry 的 FTS 索引需要在启动时 rebuild。
10. **测试断言了 LIKE 查询方式**：现有测试可能断言了 LIKE 行为，需同步更新为 json_each。

## [PROD_NOT_TOUCHED]
## requirements-review subagent 进度记录

### 输入文件读取

1. **角色定义 requirements-review.md** — 已读。检查清单：BDD 可二值判定、隐含需求覆盖（数据/前端/多端/边界/兼容）、裁剪合理性、P1 纯净性（无方案渗入）。
2. **P1-dispatch-context-requirements-review.md** — 已读。目标：独立评审 P1-requirements.md。约束：agent≠main、BDD 编号锚点、覆盖维度标注。门槛 status: approved/rejected。
3. **P0-brief.md** — 已读。三个 bug 根因+修法+约束。约束：不改 schema/前端/MCP/存储 tag 值。jieba 新依赖。risk: medium。
4. **P1-requirements.md** — 已读。17 条 BDD + 14 项隐含需求 + 全阶段不裁 + domains:[backend] + risk:medium + 4 项 capability 全 available。

### 初步发现

- BDD 编号 1-17 连续不跳号，格式 `#### BDD-NN:` 标准
- 每条 BDD 只有一条 Given-When-Then
- 隐含需求 14 项，分布：数据4 + 前端0(声明无) + 多端0(声明无) + 边界6 + 兼容4
- 裁剪：全阶段不裁（P1-P8），理由充分
- 待确认：[NO_NEED_CONFIRM]

### 需验证的技术声明
- jieba 线程安全性声明（隐含需求 5）
- FTS trigger 路径覆盖声明（隐含需求 1）
- backfill 触发条件声明（隐含需求 2）


### 代码验证结果

1. **Trigger 路径声明（隐含需求 1）— 验证通过**：database.py:277-302 的 trigger 确实直接写入 `NEW.tags`（JSON 存储值），而应用层 `_update_fts_content`（entry_service.py:112）写入 `" ".join(entry.tags or [])`（原始文本）。两条路径写入的 FTS tags 格式不同，这是代码事实而非方案设计渗入。隐含需求 1 正确识别了这个不一致。

2. **Backfill 触发条件声明（隐含需求 2）— 验证通过**：database.py:506 `if content_count >= entry_count and entry_count > 0: return`。改 FTS tags 索引文本后 content_count 不变，backfill 确实不会触发。隐含需求 2 正确。

3. **search_entries vs list_entries 两路径**：`search_entries()`（database.py:349）仅在测试中使用，API 路径走 `list_entries()`（entry_service.py:466-486）自己的 FTS MATCH。BDD 正确引用 API 端点 `GET /api/v1/entries?q=`，不涉及 search_entries 函数。但隐含需求未提及 search_entries 函数也需同步更新（如果保留该函数的话）——这是一个遗漏点。

4. **现有测试**：test_database.py 和 test_fts_content.py 有多个搜索测试，均使用英文 tag/summary。test_database.py:191 `search_entries(session, "fastapi")` 断言按 tag 搜索。这些测试在 jieba 分词后仍应通过（英文不受影响），但 search_entries 函数本身不经过 jieba 分词——如果有测试通过 search_entries 测试中文，会失败。当前测试全英文，不影响。

5. **rebuild_fts_index 也需同步**：database.py:379 的 `rebuild_fts_index` 也写入 `" ".join(entry.tags or [])`，是第三条 FTS tags 写入路径。隐含需求 1 只提到 trigger 和应用层，未提到 rebuild_fts_index。这是一个遗漏。

### BDD 逐条评审结论
- 17 条 BDD 全部可二值判定（Given/When/Then 明确，结果为出现/不出现/空/通过）
- 编号 1-17 连续不跳号，格式 `#### BDD-NN:` 标准
- 每条只有一条 Given-When-Then
- BDD-17 响应时间 ≤1 秒可测量但有环境依赖（需注明测量方式）

### 隐含需求覆盖评审
- 数据维度：4 项，覆盖 trigger/应用层不一致、backfill 触发、多字段分词、查询端分词。**遗漏**：rebuild_fts_index 第三路径、search_entries 函数路径
- 前端维度：声明无，符合 P0 约束
- 多端维度：声明无，符合 P0 约束
- 边界维度：6 项，覆盖并发/延迟/英文影响/空值/净化/json_each 边界
- 兼容维度：4 项，覆盖英文回归/LIKE 测试断言

### P1 纯净性评审
- 隐含需求 1 提到 `json_each` 和 jieba 分词——但这些是 P0-brief 已确认的修法方向，P1 声明的是"所有 FTS tags 写入路径都需覆盖"这一需求约束，不是新设计方案。可接受。
- 隐含需求 4 提到 FTS5 AND 语义——这是需求层面的语义确认，不是方案设计。可接受。
- BDD 条件均描述用户行为（API 请求 → 响应结果），未描述技术实现。通过。

### 裁剪评审
- 全阶段不裁，理由充分（涉及 trigger+应用层+backfill 三路径协调 + jieba 新依赖 + 多文件改动）
- risk_level: medium 判定合理

### 最终判定
status: needs-revision
原因：隐含需求遗漏 rebuild_fts_index 第三路径（database.py:379-428），该路径也写入 FTS tags 但未被覆盖声明。

