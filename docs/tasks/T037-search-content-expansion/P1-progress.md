## P1 Progress — T037

### Input files read
- P0-brief.md: task=FTS5索引文件内容, pruning=保守, phase_hint=[P1-P6]
- database.py: FTS5表entries_fts(summary,tags), 3个触发器, rebuild_fts_index只回填summary+tags
- entry_service.py: list_entries用FTS5 MATCH搜summary+tags, 无content字段
- SearchInput.vue: 纯文本输入框, placeholder="Search...", 无范围提示
- models.py: File有is_binary字段, EntryFTS空壳
- language.py: is_binary_content()已有(检测null bytes+UTF-8)

### Key findings
1. FTS5当前只索引summary+tags — 需要加content列
2. FTS5用content='entries'同步模式 — 加content列后需重设计(因为content不在entries表上,而在files表)
3. 文件内容在磁盘上(storage),不在DB中 — FTS5 content-sync模式无法直接用,需改用触发器+手动同步
4. is_binary已有 — 可作为二进制文件排除条件
5. MCP list_entries支持q参数 — 搜索范围扩大后MCP自动受益
6. rebuild_fts_index需同步更新以回填content
7. update_entry增删文件时需同步FTS content

### P1 analysis complete
- 10 implicit needs identified (IM-1 through IM-10)
- 8 BDD conditions written (BDD-1 through BDD-8)
- 2 [NEED_CONFIRM] items (NC-1: truncation threshold, NC-2: placeholder text)
- 0 [CAPABILITY_GAP]
- Phases: [P1,P2,P3,P4,P5,P6,P8] — P7 skipped (low consistency risk)
