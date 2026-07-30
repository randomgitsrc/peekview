---
phase: P7
task_id: T083-cjk-search-fix
type: consistency
parent: P6-acceptance.md
trace_id: T083-P7-20260731
status: draft
created: 2026-07-31
agent: consistency-reviewer
---

# P7 一致性检查 — T083: 中文搜索与 Tag 过滤修复

## 检查范围

逐项对照 P1 需求基线、P2 方案设计、P4 代码实现、P6 验收结果，执行双向一致性检查 + DESIGN_GAP 配对 + SCOPE+ 闭环 + 未决项清零。

## 1. DESIGN_GAP 配对

### 偏差发现：dispatch-context 声称"P4 无 DESIGN_GAP 声明"，但 P4-implementation.md 实际包含 DESIGN_GAP

dispatch-context L33 写道"P4 无 DESIGN_GAP 声明（实现与设计完全一致）"，但 P4-implementation.md L71 和 L127 实际声明了 `[DESIGN_GAP]` 和 `[DESIGN_GAP_REVIEWED]`。dispatch-context 信息有误，但 P7 以实际文件内容为准进行审查。

### GAP-1: trigger 依赖测试更新

**原始标记**（P4 L71）：
```
#### [DESIGN_GAP] P2 未显式提及需更新 trigger 依赖的测试
```

**P4 处理**：P2 设计移除 INSERT trigger，但未显式列出 `test_database.py`/`test_fts_content.py` 中依赖 trigger 的测试需同步更新。P4 implementer 按 trigger 降级决策更新了这些测试（FTS 填充方式变更，非断言语义变更）。

**P7 审查**：
- P2 §2（trigger 降级）确实只描述了 `database.py` 中 trigger 的 DROP+CREATE，未提及测试文件需同步更新。
- P4 的更新合理：trigger 移除后，依赖 INSERT trigger 自动填充 FTS 的测试必须改用手动填充，否则测试会失败。这不是断言语义变更，而是 FTS 填充机制变更的必然结果。
- 已验证 `test_database.py` 和 `test_fts_content.py` 文件存在且已被修改（文件时间戳 7月31日 02:50-02:51）。
- **判定**：决策合理，不回退 P2。

`[DESIGN_GAP_REVIEWED: 已确认]` — GAP-1 trigger 依赖测试更新，决策合理

### GAP-2: BDD-14 DetachedInstanceError 修复

**原始标记**（P4 L83）：
P4 描述 `test_cjk_search.py::test_bdd_14_backfill_rebuilds_fts_for_existing` 存在 `DetachedInstanceError`（`entry.id` 在 session 关闭后被访问），修复方式为在 session 内捕获 `entry_id`。

**P7 审查**：
- 这是 SQLAlchemy session 生命周期 bug，属于 P3 测试代码的问题，与 P2 设计方案无关。
- 修复方式（在 session 内捕获 ID）是 SQLAlchemy 标准实践，不影响测试断言语义。
- P6 验收中 BDD-14 为 PASS，证明修复有效。
- **判定**：合理的实现修复，不影响设计一致性。

`[DESIGN_GAP_REVIEWED: 已确认]` — GAP-2 BDD-14 DetachedInstanceError 修复，决策合理

## 2. SCOPE+ 闭环

P1-requirements.md 无 `[SCOPE+]` 标记（grep 确认全文无 SCOPE+ 声明）。P1 有 `[NO_NEED_CONFIRM]`（L173），表明所有需求均可在 P1 内确定，无需人工确认。

**结论**：无 SCOPE+ 需闭环。

## 3. 跨文件一致性

### 3.1 P2§packages 与 P8 bump 范围一致性

- P2§packages（L493-495）：`packages: [backend]`
- P2§domains（L496）：`domains: [backend]`
- P2§ui_affected（L497）：`ui_affected: false`
- P4 改动文件（L16-25）：`text_utils.py`（新增）、`database.py`、`entry_service.py`、`main.py`、`pyproject.toml`、3 个测试文件 — 全部在 backend 包内
- pyproject.toml L42 确认 `"jieba>=0.42.1"` 已添加到 dependencies

**结论**：P2§packages 声明 `[backend]`，P4 实现全部在 backend 内，P8 只需 bump backend 版本。一致。

### 3.2 P1 BDD 数 vs P6 验收数

- P1 BDD 数：17（BDD-1 到 BDD-17）
- P6 PASS 数：17（逐条列出 BDD-1~17 均为 PASS）
- P6 BDD 二值规则检查：所有 17 条 BDD 均为 PASS，无中间态（无"调整/跳过/覆盖"）

**结论**：数量匹配，二值规则无偏差。

**细节验证**：
- BDD-1~15, BDD-17：通过 `test_cjk_search.py` 的 16 个 pytest 测试验证（P6 L28: 16 passed）
- BDD-16：引用 P5-test-results/unit.md（`make test-quick` 全量测试 1001 passed + 2 skipped + 0 failed）
- 拆分合理：BDD-16 是"现有测试全部通过"的宏观验收条件，不适合写进单个测试文件，用 P5 全量测试结果作为证据是正确的方法

### 3.3 P4 实现路径与 P2 方案设计吻合度

逐项对照 P2 §详细设计（§1-§11）与实际代码：

#### §1 text_utils.py — ✅ 一致
- P2 设计：`preload_jieba()` / `tokenize_for_fts()` / `tokenize_query()` 三个函数
- 实际代码（text_utils.py L18-62）：三个函数均存在，逻辑与 P2 伪代码一致
- `_jieba_loaded` 全局标志 + 幂等检查：一致
- jieba.cut（精确模式）+ 连字符→空格 + 过滤空 token：一致

#### §2 database.py trigger 降级 — ✅ 一致
- P2 设计：`_run_migrations` 中 DROP `entries_ai` + DROP `entries_au` + CREATE DELETE-only `entries_au`
- 实际代码（database.py L135-148）：完全一致，含幂等 DROP + CREATE
- P2 设计：`setup_fts5` 移除 INSERT trigger，UPDATE trigger 改为仅 DELETE
- 实际代码（database.py L275-321）：`setup_fts5` 中无 INSERT trigger（L302-308 只有 DELETE trigger，L311-318 DELETE-only UPDATE trigger），一致

#### §3 backfill_fts_content 版本标记 — ✅ 一致
- P2 设计：`FTS_VERSION = 2` / `_get_user_version()` / `_set_user_version()` + 版本不匹配时 DELETE ALL + 逐行重建
- 实际代码（database.py L151-160, L501-545）：
  - `FTS_VERSION = 2`（L151）✅
  - `_get_user_version` / `_set_user_version`（L154-160）✅
  - 版本检查 + 重建逻辑（L517-527）✅
  - `tokenize_for_fts` 用于 summary/tags/content（L538-540）✅
- P2 设计中 `backfill_fts_content` 接受 `engine: Engine, storage: StorageManager` — 实际签名一致

#### §4 rebuild_fts_index 分词 — ✅ 一致
- P2 设计：两个分支统一为逐行 Python 处理 + `tokenize_for_fts()`
- 实际代码（database.py L397-437）：统一路径，无 storage 时 content=""，有 storage 时调 `_aggregate_entry_content`，两分支都逐行处理 + 分词
- P2 设计中提到"无 storage 分支不再用 INSERT ... SELECT FROM entries" — 实际代码确认无 INSERT...SELECT，一致

#### §5 search_entries 查询端分词 — ✅ 一致
- P2 设计：`query` 先经 `tokenize_query()` 分词，空结果返回 `[]`，非空则转义引号后送 MATCH
- 实际代码（database.py L364-394）：
  - `from peekview.text_utils import tokenize_query`（L375）✅
  - `tokenized = tokenize_query(query)` + 空检查返回 `[]`（L377-379）✅
  - 引号转义（L381）✅
  - MATCH 查询（L383-392）✅

#### §6 _update_fts_content 分词 — ✅ 一致
- P2 设计：summary → `tokenize_for_fts(entry.summary)`；tags → `tokenize_for_fts(" ".join(entry.tags or []))`；content → `tokenize_for_fts(aggregated)`
- 实际代码（entry_service.py L68-119）：
  - `from peekview.text_utils import tokenize_for_fts`（L73）✅
  - `summary=tokenize_for_fts(entry.summary)`（L113）✅
  - `tags=tokenize_for_fts(" ".join(entry.tags or []))`（L114）✅
  - `content=tokenize_for_fts(aggregated)`（L115）✅
  - DELETE + INSERT 模式（L105-117）✅

#### §7 list_entries tag 过滤改 json_each — ✅ 一致
- P2 设计：`EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)`
- 实际代码（entry_service.py L460-467）：
  ```python
  tag_filter = text(
      "EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)"
  ).bindparams(tag=tag)
  query = query.where(tag_filter)
  count_query = count_query.where(tag_filter)
  ```
  完全一致。
- P2 提及移除未使用的 `String` import — 已验证 entry_service.py 中无 `from sqlalchemy import.*String` ✅

#### §8 list_entries FTS 查询分词 — ✅ 一致
- P2 设计：`q.strip()` → `tokenize_query(q)` + 转义
- 实际代码（entry_service.py L470-494）：
  - `from peekview.text_utils import tokenize_query`（L471）✅
  - `tokenized = tokenize_query(q)` + 空检查（L473-474）✅
  - 引号转义（L475）✅
  - MATCH 查询 + try/except 静默吞掉 FTS5 语法错误（L476-494）✅
  - 空结果返回空 EntryListResponse（L486-492）✅

#### §9 main.py lifespan 预加载 jieba — ✅ 一致
- P2 设计：`init_db` 后、`backfill_fts_content` 前插入 `preload_jieba()`
- 实际代码（main.py L200-218）：
  - `engine = init_db(config.db_path, run_migrations=True)`（L200）✅
  - `from peekview.text_utils import preload_jieba`（L212）✅
  - `preload_jieba()`（L214）✅
  - `from peekview.database import backfill_fts_content`（L216）✅
  - `backfill_fts_content(engine, storage)`（L218）✅
  - 顺序正确：init_db → preload_jieba → backfill ✅

#### §10 pyproject.toml 添加 jieba 依赖 — ✅ 一致
- P2 设计：添加 `"jieba>=0.42.1"` 到 dependencies
- 实际代码（pyproject.toml L42）：`"jieba>=0.42.1",` ✅

#### §11 Migration — trigger 变更 — ✅ 一致
- P2 设计：`_run_migrations` 末尾追加 DROP + CREATE（幂等）
- 实际代码（database.py L135-148）：
  - DROP `entries_ai`（L137）✅
  - DROP `entries_au`（L138）✅
  - CREATE DELETE-only `entries_au`（L141-146）✅
  - commit + logger.info（L147-148）✅
  - `entries_ad`（DELETE trigger）保持不变 ✅

## 4. FTS 写入路径覆盖确认

| 路径 | P2 设计位置 | P4 实现 | 一致性 |
|------|------------|---------|--------|
| trigger (INSERT) | P2 §2: DROP trigger | database.py L137: DROP | ✅ |
| trigger (UPDATE) | P2 §2: 改为仅 DELETE | database.py L138-146: DROP + CREATE DELETE-only | ✅ |
| trigger (DELETE) | P2 §2: 不变 | database.py L304-308: entries_ad 不变 | ✅ |
| `_update_fts_content` | P2 §6: 分词 | entry_service.py L73-115: tokenize_for_fts | ✅ |
| `backfill_fts_content` | P2 §3: 版本标记 + 分词 | database.py L501-545: 版本标记 + 分词 | ✅ |
| `rebuild_fts_index` | P2 §4: 逐行分词 | database.py L397-437: 逐行分词 | ✅ |

**四条写入路径全覆盖，无遗漏。**

## 5. 查询端覆盖确认

| 路径 | P2 设计位置 | P4 实现 | 一致性 |
|------|------------|---------|--------|
| `list_entries` tag 过滤 | P2 §7: json_each | entry_service.py L460-467: json_each | ✅ |
| `list_entries` FTS 搜索 | P2 §8: tokenize_query | entry_service.py L470-494: tokenize_query | ✅ |
| `search_entries` | P2 §5: tokenize_query | database.py L375-394: tokenize_query | ✅ |

**查询端全覆盖，无遗漏。**

## 6. 未决项清零

- `[NEED_CONFIRM]`：全阶段产出文件中无残留（P1 有 `[NO_NEED_CONFIRM]` 表明清零）
- `[BLOCKER]`：无
- `[DEVIATION-CRITICAL]`：无
- `[SCOPE+]`：P1 无 SCOPE+ 标记，无需闭环
- `[CAPABILITY_GAP]`：P1 能力需求声明全部 `status: available`，无 GAP

## 7. 方向 2 检查（实现→设计）

对照代码变更，检查 P2 设计文档是否有不再适用的要求：

- **僵尸需求**：无。P2 的所有设计点均在实现中落地。
- **已废弃约束**：无。P2 §不改什么 列表中的约束（schema 不变、tag 值不变、前端不变、MCP 不变）均在实现中遵守。
- **超出设计但合理**：
  - P4 修复了 BDD-14 的 DetachedInstanceError（GAP-2）— 这是 P3 测试代码的 bug 修复，非设计超纲。
  - P4 移除了 `String` import — P2 §7 提及"移除未使用的 String import"，实现中已移除，一致非超纲。
  - P4 更新了 trigger 依赖的测试（GAP-1）— P2 未显式提及，但属于 trigger 降级的必然结果，合理。

无 `[EXTENSION]` 标记需求。

## 8. P6 BDD 二值规则检查

P6 验收中每条 BDD 只使用了 PASS 标记，无"调整/跳过/覆盖"等中间态。17 条 BDD 均为 PASS。

- BDD-1~6: PASS（tag 过滤）
- BDD-7~11: PASS（FTS 中文搜索）
- BDD-12~13: PASS（连字符复合 tag）
- BDD-14~15: PASS（存量数据与启动）
- BDD-16: PASS（现有测试全部通过，引用 P5 证据）
- BDD-17: PASS（jieba 预加载）

**无偏差。**

## 9. 偏差总结

### 发现的偏差

| 编号 | 偏差描述 | 分类 | 涉及 P2 设计目标 | 判定 |
|------|----------|------|-----------------|------|
| DEV-1 | dispatch-context L33 声称"P4 无 DESIGN_GAP 声明"与 P4 实际内容矛盾 | 文档信息偏差 | 无（dispatch-context 非 P2 设计文件） | `[DEVIATION]` 不阻塞 |
| DEV-2 | P4 L71 trigger 依赖测试更新未在 P2 显式列出 | DESIGN_GAP | P2 §2 trigger 降级（非核心设计目标，是实现附带影响） | `[DESIGN_GAP_REVIEWED: 已确认]` |
| DEV-3 | P4 L83 BDD-14 DetachedInstanceError 修复 | DESIGN_GAP | 无（P3 测试代码 bug，与 P2 设计无关） | `[DESIGN_GAP_REVIEWED: 已确认]` |

### 偏差分类

- DEV-1：dispatch-context 信息有误（声称无 DESIGN_GAP 但实际有），但 P7 以实际文件为准审查，不影响 gate。属于文档维护偏差，不阻塞。
- DEV-2/DEV-3：已通过 DESIGN_GAP_REVIEWED 配对，决策合理，不阻塞。

**无 `[BLOCKER]` / `[DEVIATION-CRITICAL]`。**

## 10. 环境隔离

`[PROD_NOT_TOUCHED]`

- P1-P6 全部在 venv/测试环境/内存 SQLite 中完成
- 未触碰 `~/.peekview/` 或 `:8080`
- conftest.py autouse 隔离生效

## 结论

跨文件一致性检查通过。P2 设计的 11 个设计点全部在 P4 实现中落地，无遗漏。P1 的 17 条 BDD 在 P6 全部 PASS，数量匹配，二值规则无偏差。2 条 DESIGN_GAP 均已 REVIEWED 配对，决策合理。无 SCOPE+ 需闭环。无未决项残留。

**gate 判定：通过**（无 BLOCKER / 无 DEVIATION-CRITICAL / DESIGN_GAP 全部 REVIEWED / 无 SCOPE+ 待闭环）
