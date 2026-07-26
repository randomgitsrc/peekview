# P1 Progress — T073

## Input file readings

### P0-brief.md
- Root cause: commit 165997b5 `ruff --fix --unsafe-fixes` auto-fixed E711/E712, breaking SQLAlchemy Column comparisons
- 43 test failures: admin_stats 6 + share ~27 + fts_content ~10
- Three miscomparison patterns: `is not None` → should be `.isnot(None)`, `is None` → should be `.is_(None)`, `not X` → should be `~X`
- Original code had `# noqa: E711` comments that ruff deleted along with the fix

### admin_service.py
- Line 131: `not Entry.is_public` — broken (Python bool, not SQL expression)
- Line 135: `Entry.expires_at is not None` — broken
- Line 156: `ApiKey.expires_at is not None` — broken
- Line 196: `Entry.expires_at is not None` — broken
- Line 220: `Entry.archived_at is not None` — broken

### share_service.py
- Line 71: `EntryShare.revoked_at is None` — broken (5 occurrences: lines 71, 179, 201, 223, 244, 267)
- All in SQLAlchemy `.where()` clauses — `is None` returns Python bool, not SQL WHERE condition

### apikey_service.py
- Line 161: `ApiKey.expires_at is not None` — broken
- Line 127 already uses `.is_(None)` correctly (was already fixed or not touched by ruff)

### models.py
- Entry: is_public (bool Column), expires_at (datetime|None Column), archived_at (datetime|None Column)
- EntryShare: revoked_at (datetime|None Column)
- ApiKey: expires_at (datetime|None Column)
- These are all SQLAlchemy Column attributes — must use `.is_()`/`.isnot()`/`~` in query contexts

### entry_service.py
- Line 444: `Entry.is_public` used as standalone WHERE — this is correct (truthy SQL expression)
- Line 448: `(Entry.is_public) | (Entry.owner_id == current_user_id)` — correct (bitwise OR)
- Line 342: `not entry.is_public` — this is on a loaded Python object, NOT in a query context — this is CORRECT Python usage
- No SQLAlchemy Column comparison bugs found in entry_service.py

### pyproject.toml (ruff config)
- E711/E712 are NOT in the ignore list — ruff will flag them again
- No per-file or per-rule exclusions for SQLAlchemy patterns
- `select` includes E (all pycodestyle errors) which covers E711/E712

## Key findings
1. Broken patterns are ONLY in SQLAlchemy query contexts (`.where()` clauses), not in Python object attribute access
2. 3 files affected: admin_service.py (5 sites), share_service.py (6 sites), apikey_service.py (1 site)
3. Total: 12 broken SQLAlchemy Column comparisons
4. ruff config has no protection against re-introducing this regression
5. fts_content test failures likely cascade from admin/share breakage, not separate Column comparison bugs

## P1-requirements.md 产出完成

- 11 条 BDD 验收条件（BDD-1 到 BDD-11）
- 4 个隐含需求（I1-I4）
- [NO_NEED_CONFIRM]
- domains: backend, risk_level: high
- phases: [P1,P2,P3,P4,P5,P6,P8]，P7 跳过
- capability_requirements: []

## 自检
- BDD ≥1 条 ✓ (11 条)
- domains/packages/risk_level/phases 已声明 ✓
- 无 [NEED_CONFIRM] ✓ ([NO_NEED_CONFIRM])
- 无 status: GAP ✓
- 隐含需求已主动识别 ✓ (4 条)
- BDD 反模式自检：
  - Then 子句无 CSS 类名绑定 ✓
  - Then 子句无 HTML 属性绑定 ✓
  - Then 子句无主观形容词 ✓
  - Then 子句可二值判定 ✓
  - Given/When 无实现细节绑定 ✓
  - 每条 BDD 单一 Given-When-Then ✓
  - BDD 编号连续 ✓
