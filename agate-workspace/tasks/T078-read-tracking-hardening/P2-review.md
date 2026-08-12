---
phase: P2
task_id: T078-read-tracking-hardening
type: review
parent: P2-design.md
trace_id: T078-P2-20260803
status: approved
created: 2026-08-03
agent: review
---

# P2 Design Review — 复审轮

## 复审范围

确认上轮 2 CRITICAL + 4 INFORMATIONAL 修复，并全量审查方案可行性 / BDD 覆盖 / files_to_read 完整 / gate_commands 正确 / 安全漏洞 / 边界遗漏。

## 1. CRITICAL 修复确认

### CRITICAL-2：DEFAULT 'direct' → DEFAULT NULL + model default "direct" + COALESCE 回填

**修复位置**：§3.8（P2-design.md:348-368）

**确认**：
- model 层 `source: str = Field(default="direct", max_length=20)` — 新记录自动填 "direct"（line 357）
- migration SQL `ALTER TABLE entry_reads ADD COLUMN source VARCHAR(20) DEFAULT NULL` — 历史记录为 NULL（line 364）
- 回填 SQL `COALESCE(source, 'unknown')` — NULL 归 unknown（line 401）
- 明确说明了三者分离策略及可区分性（line 368）

**结论**：✅ 修复到位。model default 与 migration DEFAULT 分离，BDD-19（历史记录 source 为 NULL）语义正确。

### CRITICAL-3：restore merge PK 冲突 → 导入前检查跳过已有

**修复位置**：§3.13（P2-design.md:546-581）

**确认**：
- 导入前收集目标库已有 `entry_read_stats` 的 entry_id 集合（line 553-555）
- 逐行检查 `if new_entry_id in existing_stats_ids: continue`（line 562-563）
- 防止 backup 内重复 entry_id（line 579）
- 与 entry_reads 的 window_key 冲突处理策略一致（冲突时保留目标库数据）

**结论**：✅ 修复到位。PK 冲突防护完整，无 IntegrityError 风险。

## 2. INFORMATIONAL 修复确认

### INFORMATIONAL-1：不变量声明

**修复位置**：§3.3（P2-design.md:185）

**确认**：已添加不变量声明——"聚合表增量始终等于原始表增量"，明确了 window_key 命中/新建两种路径的等价关系，并指出"修改去重逻辑时必须同步调整聚合表更新"。

**结论**：✅ 到位。

### INFORMATIONAL-2：调用点清单

**修复位置**：§3.6（P2-design.md:288-302）

**确认**：entries.py 四个调用点全部列出（line 169/231/298/473），files.py 三处列出（line 188/232/432），每处标注了传参变化。entries.py line 231 的硬编码 `channel="share"` 决策有合理理由（query 里有 `share=`，硬编码更明确）。

**结论**：✅ 到位。

### INFORMATIONAL-3：backfill 位置

**修复位置**：§3.9（P2-design.md:437-442）

**确认**：明确决策——回填逻辑放在 `ReadTrackingService.backfill_stats()` 方法中，在 `main.py:create_app()` 中 `init_db` 之后、`read_tracking_service` 创建之后调用（约 line 221 后），与 `backfill_fts_content(engine, storage)`（line 218）平级。

**结论**：✅ 到位。调用位置在 main.py:221 后已验证——read_tracking_service 在 line 221 创建，backfill 应在其后。

### INFORMATIONAL-4：today 语义

**修复位置**：§3.12（P2-design.md:544）

**确认**：明确声明 `reads.today = 今天新建的读取记录的 count 之和`，查询条件 `EntryRead.read_at >= today_start`。说明了 `read_at` 是记录创建时间、window_key 命中时不更新 `read_at`，因此 `today` 不包含今天对已有记录的 count 增量。标注"P6 验收按此语义判断"。

**结论**：✅ 到位。

## 3. 全量审查

### 3.1 候选方案 ≥2 + 权衡 + 选择理由

方案 A（写时更新）vs 方案 B（触发器+物化视图）。权衡充分：
- 方案 B 的 JSON 字典更新在 SQLite 触发器中极度复杂（json_set/json_extract + 版本依赖）
- 方案 B 的 reader_fingerprints `in` 检查在触发器中不可靠
- 方案 B 的"优点"（record_read 不变）不成立——仍需改 window_key + source 参数
- 方案 A 与项目现有模式一致（Python 层管理数据逻辑）

**结论**：✅ 合格。

### 3.2 BDD 覆盖（34 条）

逐条核对 P1-requirements.md 的 34 条 BDD 与 P2-design.md 的方案映射：

| BDD 范围 | 设计章节 | 覆盖 |
|-----------|----------|------|
| BDD-01~02（window_key 加 action） | §3.1 | ✅ |
| BDD-03（公开 entry share channel） | §3.6（line 231 硬编码 share） | ✅ |
| BDD-04~06（files.py share cookie） | §3.6（三处 _detect_channel(request, slug)） | ✅ |
| BDD-07（admin stats 含 discover） | §3.12（discover 从原始表查） | ✅ |
| BDD-08~09（by_action/by_source） | §3.5、§3.3 | ✅ |
| BDD-10~11（source direct/internal） | §3.7（_classify_source） | ✅ |
| BDD-12~16（聚合表写时更新） | §3.3、§3.4 | ✅ |
| BDD-17~18（回填） | §3.9 | ✅ |
| BDD-19（source 列迁移） | §3.8 | ✅ |
| BDD-20~23（90 天清理） | §3.10、§3.14 | ✅ |
| BDD-24~25（删 entry 保留聚合） | §3.11 | ✅ |
| BDD-26~27（admin stats reads 维度） | §3.12 | ✅ |
| BDD-28~29（restore merge/replace） | §3.13 | ✅ |
| BDD-30（total_count 含 self_read） | §3.15、§3.4 | ✅ |
| BDD-31（discover 不入聚合表） | §3.3（entry_id is None 跳过聚合更新） | ✅ |
| BDD-32~34（source search/social/other） | §3.7（_classify_source 分类逻辑） | ✅ |

**结论**：✅ 34 条 BDD 全部有方案覆盖。

### 3.3 聚合表写时更新去重 + 时序

- window_key 命中时 `existing.count += 1` → `stats.total_reads += 1`：同事务，原子性保证
- 新建记录 `count=1` → `stats.total_reads += 1`：同事务
- by_action/by_channel/by_source 每次调用都 +1，与原始表增量一致
- reader_fingerprints 去重：split → in 检查 → append → join，空字符串边界处理（`[fp for fp in (...).split(",") if fp]`）

**结论**：✅ 无重复计数风险。

### 3.4 _detect_channel 提取后 files.py 三处覆盖

验证 files.py 现有代码：
- line 188: `channel = "mcp" if ... else "api"` → `_detect_channel(request, slug)` ✅
- line 232: 同上 → `_detect_channel(request, slug)` ✅
- line 432: 同上 → `_detect_channel(request, slug)` ✅

`_detect_channel` 新增 `slug` 参数，检查 share cookie `peekview_share_{slug}`。现有 `_resolve_entry` 已验证 share cookie 可访问子资源（files.py:157-163），所以 `_detect_channel` 也能正确检测。

**结论**：✅ 三处全覆盖。

### 3.5 _classify_source 分类逻辑完整性

5 个分类：direct（无 Referer）/ internal（同域名）/ search（搜索引擎列表）/ social（社交平台列表）/ other（其余）。

- `_SEARCH_ENGINES`：google/bing/duckduckgo/baidu/yahoo/yandex/sogou
- `_SOCIAL_PLATFORMS`：twitter/x.com/facebook/linkedin/reddit/weibo/github.com
- `urlparse` 异常 → "other"（防御性）
- `request_host` 与 `ref_host_lower` 比较前都 lower()

**结论**：✅ 逻辑完整，异常处理到位。

### 3.6 迁移回填 SQL 正确性

- 幂等检查：`entry_read_stats` 非空则跳过（line 377-379）
- 空数据检查：`entry_reads` 无数据则跳过（line 381-383）
- by_action/by_channel：`GROUP BY action, channel` + `SUM(count)`
- by_source：`COALESCE(source, 'unknown')` + `GROUP BY src`
- unique_readers：`COUNT(DISTINCT reader_fingerprint) WHERE is_self_read = 0`
- reader_fingerprints：`GROUP_CONCAT(DISTINCT reader_fingerprint) WHERE is_self_read = 0`
- last_read_at：`MAX(updated_at)`

**结论**：✅ SQL 正确，与聚合表写时更新语义一致。

### 3.7 90 天清理顺序

§3.10 明确：先 archive/delete entries（通过 `_cleanup_reads` 删 entry_reads），再清理过期 entry_reads。聚合表不受影响。

验证 `cleanup_expired` 现有结构（admin_service.py:192-248）：entries 先归档/删除，然后返回。新清理逻辑加在返回前。

**结论**：✅ 顺序正确。

### 3.8 删 entry 保留聚合统计

§3.11 确认 `_cleanup_reads` 只 `select(EntryRead)` 删除，不碰 `EntryReadStats`。验证现有代码（entry_service.py:782-788）确实只删 EntryRead。

**结论**：✅ 无需改动，只需确保不增加删除 EntryReadStats 的代码。

### 3.9 files_to_read 完整性

12 个文件条目，每个含 `path` + `why`。核对：
- 核心改动文件全覆盖（read_tracking_service / models / _shared / entries / files / entry_service / admin_service / database / config / main）
- 测试文件 3 个（test_read_tracking / test_admin_stats_cleanup / test_admin_backup）
- 无冗余文件（MCP/frontend/CLI 不在列表中）

**结论**：✅ 完整且不过多。

### 3.10 gate_commands 正确性

```yaml
gate_commands:
  P3: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=short"
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_e2e: null  # ui_affected: false
```

- P3 用 verbose 输出供 check-tdd-red.sh 读取 ✅
- P5 紧凑输出 ✅
- P5_e2e: null（ui_affected: false）✅
- 使用 `.venv/bin/python` 与 Makefile 的 `make test-quick` 一致 ✅

**结论**：✅ 正确。

### 3.11 四字段齐全

```yaml
packages: [backend]
domains: [backend, api, security, database, config]
ui_affected: false
gate_commands: {...}
```

**结论**：✅ 齐全。

### 3.12 minimal_validation

声明"纯代码逻辑，无外部系统依赖"，附理由（SQLModel ORM + SQLite ALTER TABLE + JSON 序列化 + HTTP Referer 字符串匹配）。唯一外部输入 Referer 是纯字符串匹配。

**结论**：✅ 合格。

## 4. 安全审查（Pass 1）

### 4.1 SQL 注入

- 回填 SQL 用 `text()` + `bindparams(eid=eid)` — 参数化查询 ✅
- 90 天清理用 `text("DELETE FROM entry_reads WHERE read_at < :cutoff").bindparams(cutoff=cutoff)` — 参数化 ✅
- `_classify_source` 的 `urlparse` 不直接拼 SQL ✅

**结论**：✅ 无注入风险。

### 4.2 Read-Check-Write 竞态

- `record_read` 的 window_key 去重 + 聚合表更新在同一 Session（同事务），SQLite 单写者锁保证原子性
- 回填幂等检查（`entry_read_stats` 非空则跳过）在启动时单线程执行，无竞态
- restore merge 的 PK 冲突检查在单 Session 内，无 TOCTOU

**结论**：✅ 无竞态风险。

### 4.3 状态值消费方

新增的 source 分类值（direct/internal/search/social/other/unknown）和 action 值（read/raw/download/discover）——消费方：
- `get_read_stats`：从聚合表 JSON 读，不硬编码值 ✅
- `get_stats`（admin）：从聚合表 JSON 读 + 原始表 GROUP BY，不硬编码 ✅
- 前端：按需展示，不硬编码 ✅

**结论**：✅ 无遗漏消费方。

## 5. 代码健康审查（Pass 2）

### 5.1 async/sync 混用

`_record_read_async` 是 async 函数，内部调用同步的 `record_read`。现有模式（fire-and-forget via `asyncio.create_task`），与现状一致。`record_read` 增加聚合表更新后耗时略增，但 SQLite 单写者 + 日均几十次 read，可忽略。

**结论**：✅ 无阻塞风险。

### 5.2 N+1 查询

- 回填：`SELECT DISTINCT entry_id` → 逐 entry 聚合查询。回填在启动时一次性执行，且幂等跳过，可接受。
- `get_stats`（admin）：`select(EntryReadStats)` 全表读 + Python 层聚合。entry 数量通常 <1000，可接受。
- `record_read`：每次 1 次原始表查询 + 1 次聚合表查询/创建，同事务内，可接受。

**结论**：✅ 无 N+1 性能问题。

### 5.3 reader_fingerprints 字符串拼接

`split(",")` → `in` 检查 → `append` → `join(",")`。已知风险（>500 人变慢）在 P1 IR-16 声明可接受。

**结论**：✅ 已知风险，可接受。

### 5.4 GROUP_CONCAT 限制

SQLite `GROUP_CONCAT` 默认最大长度由 `SQLITE_MAX_LENGTH` 控制（通常 1GB），单 entry <100 人时 fingerprint 字符串极短。

**结论**：✅ 无截断风险。

## 6. 边界审查

### 6.1 discover（entry_id=None）不入聚合表

§3.3 line 204: `if entry_id is not None:` 才更新聚合表。BDD-31 覆盖。

**结论**：✅ 正确。

### 6.2 回填后新数据与回填数据共存

回填后 `entry_read_stats` 有行 → 后续启动跳过回填（幂等）。新 read 事件通过写时更新累加到已有行。无冲突。

**结论**：✅ 正确。

### 6.3 restore merge 后聚合表与原始表一致性

restore merge 导入 `entry_reads`（原始表）+ `entry_read_stats`（聚合表）。两者都从 backup 导入，保持 backup 时的快照一致性。导入后新 read 事件通过写时更新累加。

**结论**：✅ 正确。

### 6.4 restore replace 覆盖聚合表

`_restore_replace` 是整库替换（staging_db → target_db），新表 `entry_read_stats` 随库一起替换。无需额外代码。BDD-29 覆盖。

**结论**：✅ 正确。

## 7. 发现的问题

无 CRITICAL，无 INFORMATIONAL。上轮所有问题已修复到位。

## 8. 结论

PASS — 方案可行，34 条 BDD 全覆盖，files_to_read 完整，gate_commands 正确，无安全漏洞，无遗漏边界。2 CRITICAL + 4 INFORMATIONAL 全部修复到位。
