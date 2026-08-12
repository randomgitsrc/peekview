## P2 architect — 文件读取完成

### 已读取文件
1. P2-dispatch-context-architect.md — 派发指引，明确四条 FTS 写入路径 + 查询端 + jieba 预加载 + backfill 触发
2. architect.md — 角色定义，P2 须产出候选方案 ≥2 + 四字段 + files_to_read + minimal_validation
3. P0-brief.md — 三个 bug 根因 + 修法方向 + 约束（不改 schema/前端/MCP/存储 tag 值）
4. P1-requirements.md — 15 隐含需求 + 17 BDD + domains: [backend] + risk: medium
5. entry_service.py L55-124 — _update_fts_content: DELETE+INSERT，tags=" ".join(entry.tags or [])，summary=entry.summary
6. entry_service.py L450-499 — list_entries: tag 过滤 LIKE（L460-463），FTS MATCH（L466-486）
7. database.py L248-306 — FTS5 trigger: INSERT/UPDATE 写 NEW.summary/NEW.tags（原始 JSON 值，含 \uXXXX）
8. database.py L349-376 — search_entries: 独立搜索函数，当前仅转义引号
9. database.py L379-428 — rebuild_fts_index: 全量重建，L412 tags=" ".join(entry.tags or [])
10. database.py L492-528 — backfill_fts_content: 触发条件 content_count < entry_count，L522 tags=" ".join(entry.tags or [])
11. main.py L195-232 — lifespan: L214 调用 backfill_fts_content，未预加载 jieba
12. pyproject.toml L25-42 — dependencies，无 jieba

### 关键发现
- **trigger 是纯 SQL，不能调 jieba**：trigger（L277-302）在 INSERT/UPDATE 时用 `NEW.tags`（JSON 存储值）和 `NEW.summary`（原始文本）写入 FTS。无法在 trigger 里调用 Python jieba。这意味着 trigger 写入的 FTS 数据是未分词的。
- **应用层 _update_fts_content 紧跟 trigger 后执行**：create_entry 和 update_entry 调用 _update_fts_content，它先 DELETE 再 INSERT FTS row，覆盖 trigger 写入的数据。所以应用层写入路径可以走 jieba 分词。
- **trigger 与应用层写入有竞态**：trigger 先写（未分词），_update_fts_content 随后 DELETE+INSERT（可分词）。如果只改 _update_fts_content 而不改 trigger，在两者之间的时间窗口 FTS 数据是未分词的。但由于 _update_fts_content 紧跟在 commit 后执行，竞态窗口极短。
- **backfill 触发条件不满足**：backfill_fts_content 只在 content_count < entry_count 时触发。改 FTS 索引格式后需要强制重建。
- **search_entries 仅测试使用**：API 路径走 list_entries 自己的 FTS MATCH（L466-486），search_entries 仅 test_database.py 引用。但 P1 要求同步更新避免分叉。
- **无现有测试断言 LIKE 查询方式**：grep LIKE 仅命中 entry_service.py 的 tag 过滤代码和 test_admin 的 slug LIKE。无测试断言 tag LIKE。
- **jieba 未在任何代码中出现**：全新依赖。

### 设计决策点
1. jieba 分词模块放独立模块（如 `backend/peekview/text_utils.py` 或 `backend/peekview/services/tokenizer.py`）
2. trigger 不能调 jieba → 需禁用 trigger 的 FTS 写入，或让 trigger 只写空值再由应用层覆盖
3. backfill 触发条件需修改 → 强制重建或增加版本标记
4. jieba 预加载在 lifespan L200（init_db 后，backfill 前）
5. 连字符→空格在分词函数内统一处理

## P2 architect — 最小验证完成

### 验证 1: jieba 分词行为
- `jieba.cut('组件库')` → `['组件', '库']` — 拆分复合词
- `jieba.cut('组件')` → `['组件']` — 词典中已有，不拆
- `jieba.cut('FastAPI')` → `['FastAPI']` — 英文专有名词不拆 ✅ 零回归
- `jieba.cut('PostgreSQL')` → `['PostgreSQL']` — 不拆 ✅（P0-brief 担心的切错未发生）
- `jieba.cut('google-gemini')` → `['google', '-', 'gemini']` — 连字符保留为独立 token
- `jieba.cut('前端Vue组件库')` → `['前端', 'Vue', '组件', '库']` — 中英混合正确分词

### 验证 2: jieba 线程安全
- 10 线程并发 `jieba.cut('前端组件库设计')` → 全部结果一致 ✅
- 精确模式（默认）线程安全，无需加锁

### 验证 3: jieba 首次加载
- 首次加载 dict ~0.4s（缓存到 /tmp/jieba.cache）
- 后续 1000 次调用 0.007s（<0.1ms/次）
- 需在 lifespan 预加载

### 验证 4: FTS5 MATCH 语义
- jieba 分词后空格连接 → FTS5 空格 = AND 操作符
- 搜 '组件库' → jieba 分词 '组件 库' → FTS5 AND → 命中包含两词的文档 ✅
- 搜 '组件' → jieba 分词 '组件' → 命中 ✅
- 搜 '数据库' → 不命中 ✅（正确返回空）

### 验证 5: 连字符处理
- jieba.cut('google-gemini') 保留连字符为独立 token `-`
- 需在分词后额外处理：`t.replace('-', ' ')` 或过滤掉 `-` token
- 验证：tags='google gemini gemini' → 搜 'gemini' 命中 ✅

### 验证 6: trigger 写入未分词数据
- trigger 写 `NEW.tags`（JSON 值 `["\u524d\u7aef"]`）→ FTS tags 字段含 \uXXXX 转义
- 搜 '组件' → 不命中（trigger 路径）
- _update_fts_content 紧跟 commit 后执行（L308 create_entry, L691 update_entry），DELETE+INSERT 覆盖 trigger 数据
- trigger 与应用层写入有极短竞态窗口（commit 到 _update_fts_content 之间），但用户不可见

### 验证 7: _update_fts_content 覆盖 trigger
- create_entry: commit(L260) → trigger 写 FTS → _update_fts_content(L308) DELETE+INSERT 覆盖
- update_entry: commit → trigger DELETE+INSERT → _update_fts_content(L691) DELETE+INSERT 覆盖
- 应用层写入始终覆盖 trigger

### 设计决策确认
1. **trigger 处理策略**：trigger 不能调 jieba（纯 SQL）。两个选项：
   - A) 修改 trigger 为只 DELETE 不 INSERT（让应用层独占 FTS 写入）
   - B) 保留 trigger 不变，依赖 _update_fts_content 覆盖
   → 选 A 更安全：消除竞态窗口 + 避免无用写入 + 避免 _update_fts_content 失败时残留未分词数据
2. **jieba 分词模块**：独立模块 `backend/peekview/text_utils.py`，提供 `tokenize_for_fts(text)` 和 `tokenize_query(query)` 两个函数
3. **backfill 触发**：强制重建（无条件 DELETE+INSERT 所有 entry），不依赖 count 比较
4. **jieba 预加载**：lifespan 中 init_db 后、backfill 前
5. **连字符→空格**：在 tokenize 函数内统一处理


## P2 architect — 产出完成

### 产出文件
`docs/tasks/T083-cjk-search-fix/P2-design.md`（571 行）

### 自检结果
- 候选方案 ≥2：方案 A（trigger 降级 + 版本标记）+ 方案 B（保留 trigger + 无条件重建）✅
- 四字段齐全：packages / domains / ui_affected / gate_commands ✅
- files_to_read 清单：10 条 ✅
- minimal_validation：6 条假设全部 confirmed ✅
- FTS 四条写入路径全覆盖：trigger(INSERT/UPDATE/DELETE) + _update_fts_content + backfill_fts_content + rebuild_fts_index ✅
- 查询端覆盖：list_entries tag 过滤 + list_entries FTS 搜索 + search_entries ✅
- jieba 预加载：lifespan init_db 后 backfill 前 ✅

### [PROD_NOT_TOUCHED]
仅读取代码 + 内存 SQLite 验证，未触碰生产环境。
