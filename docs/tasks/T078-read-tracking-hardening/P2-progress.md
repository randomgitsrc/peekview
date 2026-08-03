## P2 Review Progress

### Step 1: Read dispatch-context
- Read P2-dispatch-context-review.md
- 10 review focus points identified
- Input files: 8 files

### Step 2: Read role definition
- Read review.md (Staff Engineer, paranoid reviewer)
- Pass 1: CRITICAL — data safety & correctness
- Pass 2: INFORMATIONAL — code health
- Output format: [CRITICAL/INFORMATIONAL] file:line + description + fix

### Step 3: Read all input files
- P2-design.md (624 lines) — candidate schemes A/B, 15 design sections, files_to_read, implementation markers
- P1-requirements.md (389 lines) — 34 BDD conditions
- P0-brief.md (242 lines) — task brief, known risks
- read_tracking_service.py (156 lines) — current record_read/get_read_stats/get_read_events
- api/entries.py (491 lines) — _detect_channel at line 36, 5 _record_read_async call sites
- api/files.py (458 lines) — 3 inline channel at lines 188/232/432
- models.py (812 lines) — EntryRead model, ReadStatsResponse, AdminStatsResponse, RestorePreview/RestoreResult
- database.py (562 lines) — _run_migrations pattern, init_db flow
- api/_shared.py (65 lines) — _record_read_async current signature
- entry_service.py:782-788 — _cleanup_reads current implementation
- admin_service.py:129-248 — get_stats/cleanup_expired current implementation
- admin_service.py:629-853 — _restore_merge current implementation
- config.py:201-222 — PeekCleanup current fields
- main.py:80-236 — lifespan/create_app flow, init_db + backfill_fts_content call sites

### Step 4: Review P2-design.md
(see P2-review.md for findings)

### Step 5: Write P2-review.md
(see output file)

### Step 6: Self-check
- status field set to needs-revision
- grep confirmed

[PROD_NOT_TOUCHED]

## P2 修复轮 — architect revision

### 输入读取
- P2-dispatch-context-architect-revision.md：2 CRITICAL + 3 INFORMATIONAL 修复目标
- P2-design.md（当前版本）：624 行
- P2-review.md：needs-revision，详细审查意见
- P1-requirements.md BDD-19：确认 "默认值为 NULL"

### 修复计划
1. CRITICAL-2：§3.8 迁移 SQL DEFAULT 'direct' → DEFAULT NULL；model default 保持 "direct"（新记录）；回填 SQL 用 COALESCE(source, 'unknown')
2. CRITICAL-3：§3.13 restore merge 增加 PK 冲突处理（方案 A：跳过已有）
3. INFORMATIONAL-1：§3.3 补充"聚合表增量 = 原始表增量"不变量声明
4. INFORMATIONAL-2：§3.6 列出 entries.py 所有 _detect_channel 调用点
5. INFORMATIONAL-3：§3.9 明确 backfill_stats() 调用位置
6. INFORMATIONAL-4：§3.12 明确 reads.today 语义


### 修复完成
1. **CRITICAL-2** ✅：§3.8 迁移 SQL 改为 `DEFAULT NULL`；model default 保持 `"direct"`（新记录）；§3.9 回填 SQL 改用 `COALESCE(source, 'unknown')` 聚合 by_source
2. **CRITICAL-3** ✅：§3.13 restore merge 增加 PK 冲突处理（方案 A：导入前检查 `existing_stats_ids`，冲突跳过）
3. **INFORMATIONAL-1** ✅：§3.3 补充"聚合表增量 = 原始表增量"不变量声明
4. **INFORMATIONAL-2** ✅：§3.6 列出 entries.py 所有 4 个 _detect_channel 调用点及传参
5. **INFORMATIONAL-3** ✅：§3.9 明确 backfill_stats() 在 main.py 约 line 221 后调用
6. **INFORMATIONAL-4** ✅：§3.12 明确 reads.today 语义（方案 A：read_at，今天新建记录的 count 之和）

### 自检
- grep 确认 DEFAULT NULL 已落盘 ✅
- grep 确认 restore merge PK 冲突处理已落盘 ✅
- grep 确认 COALESCE 已落盘 ✅
- grep 确认不变量声明已落盘 ✅
- grep 确认 today 语义声明已落盘 ✅
- grep 确认 backfill 调用位置已落盘 ✅

