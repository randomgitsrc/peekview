# P2 Progress — T073

## Input Reading

### P0-brief.md
- Task: ruff --fix --unsafe-fixes 误改 SQLAlchemy Column 比较，43 个测试失败
- env: make debug (:8888), make test-quick (venv pytest)
- Risk: ruff E711/E712 不区分 SQLAlchemy 语境，未来 make lint-fix 可能再次引入

### P1-requirements.md
- 13 条 BDD (BDD-1~BDD-13)
- 4 个隐含需求 (I1~I4)
- risk_level: high
- packages: backend only (6 service/test files + pyproject.toml)
- P7 跳过

### admin_service.py — 误改确认
- L131: `not Entry.is_public` → 应为 `~Entry.is_public` (在 case() 中)
- L135: `Entry.expires_at is not None` → 应为 `Entry.expires_at.isnot(None)` (在 .where() 中)
- L156: `ApiKey.expires_at is not None` → 应为 `ApiKey.expires_at.isnot(None)` (在 .where() 中)
- L196: `Entry.expires_at is not None` → 应为 `Entry.expires_at.isnot(None)` (在 .where() 中)
- L220: `Entry.archived_at is not None` → 应为 `Entry.archived_at.isnot(None)` (在 .where() 中)

### share_service.py — 误改确认
- L71: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 .where() 中)
- L179: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 .where() 中)
- L201: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 .where() 中)
- L223: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 update .where() 中)
- L244: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 .where() 中)
- L267: `EntryShare.revoked_at is None` → 应为 `EntryShare.revoked_at.is_(None)` (在 .where() 中)

### apikey_service.py — 误改确认
- L161: `ApiKey.expires_at is not None` → 应为 `ApiKey.expires_at.isnot(None)` (在 .where() 中)

### entry_service.py — 误改确认
- L96: `not File.is_binary` → 应为 `~File.is_binary` (在 .where() 中)
- L444: `Entry.is_public` (裸 Column) → 在 .where() 中作为布尔过滤，SQLAlchemy 可接受但语义不明确
- L445: `Entry.is_public` (裸 Column) → 同上
- L448: `(Entry.is_public) | (Entry.owner_id == current_user_id)` → Entry.is_public 裸 Column
- L451: `(Entry.is_public) | (Entry.owner_id == current_user_id)` → 同上

### database.py — 误改确认
- L485: `not File.is_binary` → 应为 `~File.is_binary` (在 .where() 中)

### test_read_tracking.py — 误改确认
- L365: `not EntryRead.is_self_read` → 应为 `~EntryRead.is_self_read` (在 .where() 中)

### pyproject.toml — ruff 配置
- 当前 ignore: E501, B008
- 未 ignore E711/E712 → 未来 make lint-fix 会再次触发同类回归
- select 包含 E, F, I, N, W, UP, B, C4, SIM

## Design Analysis

### 误改分类
1. `not Column` (3处): admin_service:131, entry_service:96, database:485, test_read_tracking:365 → 修复为 `~Column`
2. `Column is not None` (4处): admin_service:135/156/196/220, apikey_service:161 → 修复为 `Column.isnot(None)`
3. `Column is None` (6处): share_service:71/179/201/223/244/267 → 修复为 `Column.is_(None)`
4. 裸 Column (4处): entry_service:444/445/448/451 → SQLAlchemy 在 .where() 中接受裸 Column 作为布尔，但为明确语义和防止 ruff 误改，应改为 `Entry.is_public.is_(True)`

### 回归防护策略
- 方案A: pyproject.toml 全局 ignore E711/E712
- 方案B: per-file-ignores 对特定文件 ignore E711/E712
- 方案C: 使用 ruff lint-extend-per-file-ignores + noqa 注释

## Design Complete

### Key Findings
1. 19 处误改 + 1 处配置修改 = 20 处改动
2. 误改分 4 类：`not Column`(4), `is not None`(5), `is None`(6), 裸 Column(4)
3. 裸 Column 在 .where() 中功能正确但语义不明确，改为 .is_(True) 更一致
4. ruff E711/E712 修复是 unsafe-fixes（需 --unsafe-fixes 才会触发），当前 make lint-fix 不含 --unsafe-fixes
5. 但 commit 165997b5 明确使用了 --unsafe-fixes，所以需要 ignore 防护

### Design Decision
- 选择方案 A：全局 ignore E711/E712
- 理由：SQLAlchemy 项目中 E711/E712 几乎总是误报；Python 代码不会用 == None/== True；维护成本最低

### Self-Check
- P2-design.md exists and non-empty: confirmed
- 3 candidate schemes + tradeoff + selection reason: confirmed
- 4 fields (packages/domains/ui_affected/gate_commands): confirmed
- files_to_read with why: confirmed
- env_constraints: confirmed
- minimal_validation: not_needed
- All 13 BDD covered: confirmed
