---
phase: P2
task_id: T083-cjk-search-fix
type: review
parent: P2-design.md
trace_id: T083-P2-20260731
status: approved
created: 2026-07-31
agent: review
---

# P2 评审 — T083: 中文搜索与 Tag 过滤修复

## 覆盖维度

| 维度 | 覆盖 | 说明 |
|------|------|------|
| 方案覆盖性 | ✅ | 候选方案 A/B 覆盖全部 3 个 bug + 15 隐含需求 + 17 BDD |
| 候选方案权衡合理性 | ✅ | 方案 A（trigger 降级）vs 方案 B（保留 trigger），权衡完整，选择理由充分 |
| 四字段完整性 | ✅ | packages/domains/ui_affected/gate_commands 齐全 |
| files_to_read 实用性 | ⚠️ | 缺少 test_fts_content.py（见 [INFORMATIONAL] #1） |
| minimal_validation 充分性 | ✅ | 6 项假设全部 confirmed，方法可复现 |

## 评审结论

**status: approved**

方案 A 设计正确、完整、可实施。发现 1 个 [INFORMATIONAL] 和 2 个 [SUGGESTION]，均不阻断 P2 推进。

---

## [INFORMATIONAL] #1 — files_to_read 缺失 test_fts_content.py

**锚点**：`P2-design.md` 声明字段 `files_to_read`（L514-536）

`backend/tests/test_fts_content.py:496-508` 的 `test_fts_insert_trigger_content_empty` 测试断言 INSERT trigger 会向 FTS 写入一行数据（`assert result.scalar() == 1`）。方案 A DROP 了 INSERT trigger（`setup_fts5` 不再创建 `entries_ai`），该测试将 **必然失败**。

`files_to_read` 列出了 `test_database.py:160-210` 但 **未列出 `test_fts_content.py`**，P4 implementer 可能遗漏此测试更新。

**Fix**：在 `files_to_read` 中追加：
```yaml
  - path: backend/tests/test_fts_content.py:496-509
    why: test_fts_insert_trigger_content_empty 断言 INSERT trigger 写入 FTS，方案 A 删 INSERT trigger 后此测试需更新
```

---

## [INFORMATIONAL] #2 — search_entries 缺少 try/except 保护

**锚点**：`P2-design.md` 详细设计 §5 `search_entries`（L300-322）

设计中的 `search_entries` 调用 `tokenize_query(query)` 后直接送 FTS5 MATCH，无 try/except。如果 tokenized 查询包含 FTS5 特殊字符（如 jieba 分词产生的标点 token），可能引发 `fts5: syntax error`。

**但这是现有问题**：现有 `search_entries`（database.py:349-376）同样无 try/except，现有转义也不防 `*`/`:` 等 FTS5 语法字符。实测 jieba 分词后的 `*`/`:`/`"` 不会导致 FTS5 报错（返回空结果），仅 lone `'`（如 `it's` → `it ' s` → 转义为 `it '' s`）会报 syntax error —— 但这与现有代码行为一致。

`list_entries` 路径有 try/except 兜底（entry_service.py:484），`search_entries` 仅测试引用（P1 隐含需求 15），不阻断。

**不要求修改**，但建议 P3 测试覆盖含标点查询的边界场景。

---

## [SUGGESTION] #1 — tokenize_for_fts 与 tokenize_query 代码重复

**锚点**：`P2-design.md` 详细设计 §1 `text_utils.py`（L121-143）

两个函数逻辑完全相同（jieba.cut + 连字符→空格 + 过滤空 token），仅命名不同。设计已说明原因（"语义清晰"），可接受。但代码重复有 future divergence 风险。

**建议**（非阻断）：可提取 `_tokenize(text)` 私有函数，两个公开函数调用它。或保持现状但 P4 implementer 需注意同步修改。

---

## [SUGGESTION] #2 — _set_user_version 使用 f-string

**锚点**：`P2-design.md` 详细设计 §3 `backfill_fts_content`（L205-206）

```python
def _set_user_version(conn, version: int) -> None:
    conn.execute(text(f"PRAGMA user_version = {version}"))
```

`version` 类型为 `int`，无注入风险。但 f-string 拼 SQL 不符合 ruff/安全规范习惯。建议改用参数化（SQLite PRAGMA 不支持绑定参数，故 f-string 是合理选择）。**不要求修改**——SQLite PRAGMA 不支持参数绑定，f-string + int 类型约束是可接受的方案。

---

## 方案覆盖性验证

### P1 隐含需求 → 方案 A 覆盖映射

| P1 隐含需求 | 方案 A 覆盖 | 锚点 |
|-------------|-----------|------|
| #1 FTS 四条写入路径分词 | ✅ 全覆盖 | 详细设计 §2-§6（trigger/`_update_fts_content`/backfill/rebuild） |
| #2 backfill 触发条件 | ✅ 版本标记强制重建 | §3 backfill_fts_content（L196-248） |
| #3 summary/content 也需分词 | ✅ 全字段分词 | §1 tokenize_for_fts 用于 summary/tags/content |
| #4 查询端分词 | ✅ | §5 search_entries + §8 list_entries FTS（L300-322, L376-403） |
| #5 jieba 并发安全 | ✅ 最小验证 confirmed | minimal_validation assumption_1 |
| #6 jieba 首次加载延迟 | ✅ lifespan 预加载 | §9 main.py（L407-419） |
| #7 jieba 对英文不切错 | ✅ 最小验证 confirmed | minimal_validation assumption_3 |
| #8 空 tags / 空 query | ✅ None 安全 | §1 tokenize_for_fts None → "" |
| #9 FTS5 特殊字符 | ⚠️ 现有问题延续 | [INFORMATIONAL] #2 |
| #10 json_each 对 null/空数组 | ✅ | json_each(NULL) / json_each('[]') 返回空集 |
| #11 英文 tag 零回归 | ✅ json_each 精确匹配 | §7 list_entries tag 过滤（L357-368） |
| #12 英文搜索零回归 | ✅ 最小验证 confirmed | assumption_3 FastAPI 不切错 |
| #13 trigger summary 也需分词 | ✅ trigger 不再写 FTS | §2 trigger 降级 |
| #14 现有测试断言 LIKE | ✅ BDD-16 覆盖 | 实现完成标志 §1（L485） |
| #15 search_entries 同步更新 | ✅ | §5 search_entries（L300-322） |

### BDD 覆盖验证

| BDD | 设计覆盖 | 验证方法 |
|-----|---------|---------|
| BDD-1 中文 tag | ✅ json_each | §7 + 实测 json_each 精确匹配中文 |
| BDD-2 日文 tag | ✅ json_each | json_each 不受 ensure_ascii 影响（实测确认） |
| BDD-3 英文 tag | ✅ json_each | 实测确认 |
| BDD-4 精确匹配 | ✅ json_each | 实测 python ≠ pythonic |
| BDD-5 多 tag AND | ✅ 多次 .where | §7 for tag in tags 循环 |
| BDD-6 空结果 | ✅ json_each | json_each 无匹配返回空集 |
| BDD-7 中文子词 | ✅ jieba 分词 | 实测 组件 命中 前端组件库 |
| BDD-8 中文整词 | ✅ jieba → AND | 实测 组件库 → 组件 库 → AND 命中 |
| BDD-9 英文零回归 | ✅ jieba 不切 FastAPI | 实测确认 |
| BDD-10 混合搜索 | ✅ jieba 分词 Vue | 实测确认 |
| BDD-11 无匹配空 | ✅ | 实测 数据库 不命中 |
| BDD-12 连字符子词 | ✅ 连字符→空格 | 实测 google-gemini → google gemini |
| BDD-13 连字符整词 | ✅ | 实测确认 |
| BDD-14 存量重建 | ✅ 版本标记 | §3 backfill 版本不匹配触发重建 |
| BDD-15 新建分词 | ✅ | §6 _update_fts_content 分词 |
| BDD-16 测试通过 | ✅ gate_commands P5 | make test-quick |
| BDD-17 预加载 | ✅ §9 lifespan | preload_jieba 在 backfill 前 |

---

## 候选方案权衡验证

### 方案 A（选定）vs 方案 B

| 维度 | 方案 A | 方案 B | 评审意见 |
|------|--------|--------|---------|
| trigger 语义 | 仅 DELETE，应用层独占写入 | 保留 trigger + 应用层覆盖 | A 正确：trigger 无法调 jieba，保留只会产生竞态和脏数据 |
| _update_fts_content 失败 | FTS 无数据（backfill 修复） | FTS 残留未分词脏数据 | A 更干净 |
| backfill | 版本标记，首次重建后续跳过 | 无条件重建 | A 更高效，B 更简单 |
| 工作量 | 中等 | 略小 | 差异不显著 |
| P7 风险 | trigger 与应用层一致 | trigger 与应用层不一致（DEVIATION） | A 更安全 |

选择方案 A 的理由充分：trigger 降级语义正确、版本标记优于无条件重建、方案 B 留下竞态和脏数据风险。

---

## 四字段验证

| 字段 | 值 | 验证 |
|------|-----|------|
| packages | [backend] | ✅ 改动全在 backend/（含 pyproject.toml） |
| domains | [backend] | ✅ 与 P1 声明一致 |
| ui_affected | false | ✅ 不改前端，BDD-5 的前端测试由 P6 visual 覆盖 |
| gate_commands.P3 | `cd backend && .venv/bin/python -m pytest tests/ -v --tb=short` | ✅ verbose 输出供 check-tdd-red.sh |
| gate_commands.P5 | `make test-quick` | ✅ |
| gate_commands.P5_e2e | null | ✅ ui_affected=false |

---

## minimal_validation 验证

6 项假设全部 confirmed，方法可复现。关键验证：

| 假设 | 方法 | 结果 | 评审确认 |
|------|------|------|---------|
| jieba 线程安全 | 10 线程并发 | confirmed | ✅ 实测 10 线程结果一致 |
| FTS5 AND 语义 | 内存 SQLite | confirmed | ✅ 实测 组件 库 AND 命中 |
| 英文不切错 | jieba.cut | confirmed | ✅ FastAPI/PostgreSQL 保持完整 |
| trigger 纯 SQL | 文档确认 | confirmed | ✅ trigger body 只能是 SQL |
| trigger 脏数据 | 内存模拟 | confirmed | ✅ trigger 路径搜中文返回空 |
| json_each 精确匹配 | 内存 SQLite | confirmed | ✅ \uXXXX 被 JSON 引擎解码 |

---

## [PROD_NOT_TOUCHED]

本阶段为方案评审，仅读取代码文件 + 内存 SQLite 验证，未触碰生产环境（`~/.peekview/` 或 `:8080`）。
