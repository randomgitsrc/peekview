---
phase: P7
task_id: T073
type: consistency
parent: P6-acceptance.md
trace_id: T073-P7-20260726
status: draft
created: 2026-07-26
agent: architect
---

## 方向 1：设计→实现（逐项对照 P2-design.md）

### §2 修复映射表

#### `not Column` → `~Column`（4 处）

| P2 设计项 | 实际代码 | 一致性 |
|-----------|---------|--------|
| admin_service.py:131 `not Entry.is_public` → `~Entry.is_public` | admin_service.py:131 `~Entry.is_public` | ✅ 一致 |
| entry_service.py:96 `not File.is_binary` → `~File.is_binary` | entry_service.py:96 `~File.is_binary` | ✅ 一致 |
| database.py:485 `not File.is_binary` → `~File.is_binary` | database.py:468 `~File.is_binary` | ✅ 一致（行号偏移，内容一致） |
| test_read_tracking.py:365 `not EntryRead.is_self_read` → `~EntryRead.is_self_read` | test_read_tracking.py:397 `~EntryRead.is_self_read` | ✅ 一致（行号偏移，内容一致） |

#### `Column is not None` → `Column.isnot(None)`（5 处）

| P2 设计项 | 实际代码 | 一致性 |
|-----------|---------|--------|
| admin_service.py:135 `Entry.expires_at is not None` → `.isnot(None)` | admin_service.py:135 `Entry.expires_at.isnot(None)` | ✅ 一致 |
| admin_service.py:156 `ApiKey.expires_at is not None` → `.isnot(None)` | admin_service.py:153 `ApiKey.expires_at.isnot(None)` | ✅ 一致（行号偏移） |
| admin_service.py:196 `Entry.expires_at is not None` → `.isnot(None)` | admin_service.py:193 `Entry.expires_at.isnot(None)` | ✅ 一致（行号偏移） |
| admin_service.py:220 `Entry.archived_at is not None` → `.isnot(None)` | admin_service.py:217 `Entry.archived_at.isnot(None)` | ✅ 一致（行号偏移） |
| apikey_service.py:161 `ApiKey.expires_at is not None` → `.isnot(None)` | apikey_service.py:157 `ApiKey.expires_at.isnot(None)` | ✅ 一致（行号偏移） |

#### `Column is None` → `Column.is_(None)`（6 处）

| P2 设计项 | 实际代码 | 一致性 |
|-----------|---------|--------|
| share_service.py:71 → `.is_(None)` | share_service.py:75 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |
| share_service.py:179 → `.is_(None)` | share_service.py:177 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |
| share_service.py:201 → `.is_(None)` | share_service.py:199 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |
| share_service.py:223 → `.is_(None)` | share_service.py:225 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |
| share_service.py:244 → `.is_(None)` | share_service.py:246 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |
| share_service.py:267 → `.is_(None)` | share_service.py:273 `EntryShare.revoked_at.is_(None)` | ✅ 一致（行号偏移） |

#### 裸 Column → `Column.is_(True)`（4 处）

| P2 设计项 | 实际代码 | 一致性 |
|-----------|---------|--------|
| entry_service.py:444 `Entry.is_public` → `.is_(True)` | entry_service.py:467 `Entry.is_public.is_(True)` | ✅ 一致（行号偏移） |
| entry_service.py:445 `Entry.is_public` → `.is_(True)` | entry_service.py:468 `Entry.is_public.is_(True)` | ✅ 一致（行号偏移） |
| entry_service.py:448 `(Entry.is_public)` → `.is_(True)` | entry_service.py:470 `Entry.is_public.is_(True) \| (Entry.owner_id == current_user_id)` | ✅ 一致（行号偏移） |
| entry_service.py:451 `(Entry.is_public)` → `.is_(True)` | entry_service.py:472 `Entry.is_public.is_(True) \| (Entry.owner_id == current_user_id)` | ✅ 一致（行号偏移） |

#### pyproject.toml 回归防护（1 处）

| P2 设计项 | 实际代码 | 一致性 |
|-----------|---------|--------|
| 添加 E711, E712 到 `[tool.ruff.lint] ignore` | pyproject.toml:95-96 `E711`/`E712` 在 ignore 列表中 | ✅ 一致 |

**行号偏移说明**：P2 设计基于 ruff 误改后的代码行号，P4 实现修复后行号自然偏移（ruff format 可能调整了空行/缩进）。所有修复内容与 P2 设计完全一致，仅行号不同。

### §1 候选方案

| P2 设计决策 | 实际实现 | 一致性 |
|------------|---------|--------|
| 选择方案 A（全局 ignore E711/E712） | pyproject.toml 全局 ignore E711/E712 | ✅ 一致 |
| 不使用 per-file-ignores（方案 B） | 未使用 per-file-ignores | ✅ 一致 |
| 不使用 noqa 注释（方案 C） | 未使用 noqa 注释 | ✅ 一致 |

### §3 BDD 覆盖映射

| P2 BDD | P6 验收结果 | 一致性 |
|--------|-----------|--------|
| BDD-1 admin_stats | PASS | ✅ |
| BDD-2 share 创建 revoked_at 过滤 | PASS | ✅ |
| BDD-3 share token 验证跳过已撤销 | PASS | ✅ |
| BDD-4 share cookie 验证跳过已撤销 | PASS | ✅ |
| BDD-5 revoke 只撤销未撤销的 | PASS | ✅ |
| BDD-6 API key 过期统计 | PASS | ✅ |
| BDD-7 cleanup_expired 识别过期 | PASS | ✅ |
| BDD-8 cleanup_expired 识别旧归档 | PASS | ✅ |
| BDD-9 ruff 不报 E711/E712 | PASS | ✅ |
| BDD-10 make lint-fix 不破坏 | PASS | ✅ |
| BDD-11 全部测试通过 | PASS | ✅ |
| BDD-12 entry 列表匿名只返回公开 | PASS | ✅ |
| BDD-13 FTS 搜索找到非二进制文件 | PASS | ✅ |

P2 设计 13 条 BDD ↔ P6 验收 13 条 PASS，数量和内容完全匹配。

### §4 完成标准

| P2 完成标准 | 实际状态 | 一致性 |
|------------|---------|--------|
| 1. 所有 19 处误改已修复 | 19 处全部修复（代码验证确认） | ✅ |
| 2. pyproject.toml 已添加 E711/E712 | 已添加（pyproject.toml:95-96） | ✅ |
| 3. `make test-quick` 全量通过 | P4 自查 159 关键测试通过；P6 BDD-11 971 passed 0 failed | ✅ |
| 4. `ruff check --select E711,E712` 无违规 | P4 自查确认 | ✅ |
| 5. `make lint-fix` 不改变 SQLAlchemy 语法 | P4 自查确认幂等 | ✅ |

### 声明字段

| P2 声明 | 实际 | 一致性 |
|---------|------|--------|
| packages: [backend/peekview] | 仅改 backend/ | ✅ |
| domains: [backend] | 仅后端 | ✅ |
| ui_affected: false | 无前端改动 | ✅ |

## 方向 2：实现→设计（检查设计文档中是否有不再适用的要求）

| 检查项 | 结果 |
|--------|------|
| P2 §1 方案 B/C 的设计描述是否仍适用 | ✅ 方案 B/C 作为被否决的候选方案保留在 P2 中，不影响实现。无需删除 |
| P2 "不改什么"清单是否仍准确 | ✅ Python 对象属性访问未被误改；apikey_service.py:127 的 `ApiKey.expires_at.is_(None)` 未被改动；前端/MCP 未涉及——全部准确 |
| P2 风险分析是否仍适用 | ✅ 三项风险（误改 Python 上下文、裸 Column 语义、ruff ignore 副作用）均已在实现中正确处理，无新增风险 |
| 实现是否超出设计范围 | ✅ 无超出。P4 仅做了 P2 设计的 19 处修复 + 1 处配置修改，无额外改动 |
| 僵尸需求（已否决方案的 AC） | ✅ 无。P1 BDD 全部关联方案 A，无方案 B/C 专属 BDD |

## DESIGN_GAP 配对

P4-implementation.md 中无 `[DESIGN_GAP]` 声明。无需配对。

## SCOPE+ 闭环

全阶段无 `[SCOPE+]` 声明，无 `[SCOPE_RESOLVED]` 需确认。闭环状态：N/A（无增补）。

## P6 BDD 二值规则检查

P6-acceptance.md 中 13 条 BDD 全部为 PASS，无中间态（无"调整/跳过/覆盖"）。✅ 符合二值规则。

## 未决项清零

| 检查项 | 结果 |
|--------|------|
| [NEED_CONFIRM] 残留 | ✅ 无。P6 声明 [NO_NEED_CONFIRM] |
| [BLOCKER] 残留 | ✅ 无 |
| [DEVIATION-CRITICAL] 残留 | ✅ 无 |

## 一致性结论

**双向一致性检查完成，无 [BLOCKER]、无 [DEVIATION-CRITICAL]、无 [DEVIATION]。**

- 方向 1（设计→实现）：P2 设计的 19 处修复 + 1 处配置修改全部落地，内容完全一致（行号因 ruff format 偏移属正常现象）
- 方向 2（实现→设计）：实现未超出设计范围，P2 的"不改什么"清单和风险分析仍准确，无僵尸需求
- DESIGN_GAP：无（P4 未声明）
- SCOPE+：无增补，闭环 N/A
- BDD 二值规则：符合
- 未决项：已清零
