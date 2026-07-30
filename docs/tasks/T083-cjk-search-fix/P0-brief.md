---
phase: P0
task_id: T083
task_name: cjk-search-fix
trace_id: T083
created: 2026-07-30
status: pending
parent: null
---

# T083: 中文搜索与 Tag 过滤修复

## 问题

中文 tag 过滤和中文全文搜索存在两个独立 bug，导致用户无法通过点击中文 tag 过滤条目、无法通过搜索框搜索中文内容中的子词。此外英文带连字符的复合 tag 也存在搜索盲区。

### Bug 1: Tag 过滤完全失效（非 ASCII tag）

**路径**：用户点击 tag → `?tags=前端` → 后端 `list_entries()` → LIKE 过滤

**根因**：SQLModel 用 `Column(JSON)` 存储 tags，SQLAlchemy 的 JSON 序列化默认 `ensure_ascii=True`，中文被转义为 `\uXXXX`：

```
内存中:  ["前端", "Vue", "组件库"]
DB 存储: ["\u524d\u7aef", "Vue", "\u7ec4\u4ef6\u5e93"]
```

后端代码（`entry_service.py:476-480`）用 `CAST(tags AS TEXT) LIKE '%"前端"%'` 模式匹配，但 DB 里存的是 `\u524d\u7aef`，匹配失败。**所有非 ASCII tag 的过滤都失效**，不只是中文。

**修法**：用 SQLite 原生 JSON 函数 `json_each` 做精确匹配：

```sql
-- 当前（坏）
WHERE CAST(tags AS TEXT) LIKE '%"前端"%'

-- 修法
WHERE EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = '前端')
```

json_each 遍历 JSON 数组元素做相等比较，不受 ensure_ascii 转义影响。语义与 LIKE 方案的意图一致（精确匹配 tag 值），且消除了子串误匹配风险。

### Bug 2: FTS5 中文搜索部分失效

**路径**：用户搜索框输入中文 → `?q=组件` → 后端 FTS5 MATCH

**根因**：FTS5 默认 `unicode61` tokenizer 对连续 CJK 字符不分词（整体作为一个 token）：

```
FTS tags 字段: "前端Vue组件库"
unicode61 分词: "前端" + "Vue" + "组件库" （3 个 token）

搜 "前端"   → ✅ 是完整 token
搜 "组件库" → ✅ 是完整 token
搜 "组件"   → ❌ 不是任何 token（是"组件库"的子串）
```

**修法**：应用层预分词——写入 FTS 前用 jieba 分词（空格分隔），查询时也分词：

```
写入 FTS: "前端 Vue 组件 库"     （jieba.cut 后空格连接）
查询 FTS: "组件"                 （jieba.cut 后不变，已是完整词）
FTS5 分词: "前端" + "Vue" + "组件" + "库"  （4 个 token）
搜 "组件" → ✅ 命中
```

jieba 是中文分词事实标准（GitHub 2万+ star），纯 Python 实现，无 C 依赖，dict 文件 5MB，首次切词 0.4s（加载 dict），后续切词 <0.1ms。

### Bug 3: FTS5 连字符复合 tag 搜索盲区

**路径**：用户搜索框输入 `gemini`，想找到 tag 为 `google-gemini` 的 entry

**根因**：unicode61 把连字符视为 token 字符，`google-gemini` 被当作一个整体 token，搜 `gemini` 不命中。

**修法**：写入 FTS 索引文本时，把 tags 中的连字符替换为空格。只改 FTS 索引文本，不改存储的 tag 值：

```
存储 tags: ["google-gemini", "gemini"]           ← 不变
FTS tags: "google gemini gemini"                  ← 连字符→空格
搜 gemini: ✅ 命中
```

## 约束

- 不改数据库 schema（FTS5 表结构不变）
- 不改存储的 tag 值（只改 FTS 索引文本和查询方式）
- 不改 MCP server
- 不改前端（tag 过滤和搜索的前端交互不变）
- jieba 作为新依赖加入 `pyproject.toml`
- 现有测试必须全绿（除非有测试断言了 LIKE 查询方式，需同步更新）
- 启动时需 rebuild FTS 索引（已有 `backfill_fts_content` 机制可复用）

## 已知风险

- jieba 首次加载 dict 约 0.4s，需在应用启动时预加载（lifespan 或首次调用时 lazy load），避免首请求延迟
- jieba 分词不是完美的——专有名词可能切错（如 `PostgreSQL` 可能被切成 `Postgre` + `SQL`），但比 unicode61 不分词好得多
- `json_each` 需要 SQLite 支持 JSON1 扩展（SQLite 3.9+，当前环境 3.45.1 ✅）
- FTS5 查询净化逻辑（当前只 `q.strip()`，try/except 吞异常）需配合 jieba 分词后的查询做安全处理
- 连字符→空格只改 FTS 索引文本，不影响 tag 的显示和过滤（tag 过滤走 json_each，不走 FTS）

## 验收标准（BDD 预览）

- Given 一个 entry 有中文 tag `["前端", "Vue"]`，When 点击 `前端` tag 过滤，Then 该 entry 出现在结果中
- Given 一个 entry 有中文 tag，When 搜索框输入中文子词，Then 搜索结果包含该 entry
- Given 一个 entry 有 `google-gemini` tag，When 搜索框输入 `gemini`，Then 搜索结果包含该 entry
- Given 现有英文 tag 的 entry，When 搜索和过滤，Then 行为不变（零回归）
- Given 执行 `make test-quick`，When 所有测试运行完毕，Then 全部通过

## 关联

- 调查结论：本次会话中完整复现 + 验证（python3 脚本 + SQLite 3.45.1）
- 与 T082 无文件冲突：T082 改 DI/错误格式/store/component，T083 改 FTS 索引逻辑和 tag 查询方式
- SQLite FTS5 官方文档：https://www.sqlite.org/fts5.html
