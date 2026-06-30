# P4 Implementation Record

## Modified Files

### 1. `frontend-v3/src/composables/useShiki.ts`

**Changes:**
- Added `LANG_IMPORT_MAP` (63 entries): dynamic import mapping for languages not in the static 16
- Added `LEGACY_LANG_MAP` (2 entries): `mathematica` → `wolfram`, `registry` → `reg`
- Added `loadingLangs` Map for concurrent deduplication
- Added exported `ensureLanguage(highlighter, lang)` function:
  - Resolves legacy IDs via `LEGACY_LANG_MAP`
  - Checks `getLoadedLanguages()` for already-loaded languages
  - Checks `commonLangs` for statically imported languages
  - Dynamically imports via `LANG_IMPORT_MAP` and calls `loadLanguage()`
  - Deduplicates concurrent calls via shared Promise in `loadingLangs`
  - Falls back to `'text'` on missing grammar or import failure
- Modified `highlight()`: replaced inline lang fallback with `await ensureLanguage(highlighter, lang)`
- Modified `highlightCode()`: same replacement

### 2. `backend/peekview/language.py`

**Changes:**
- `EXTENSION_MAP`: Changed `.nb`, `.wl`, `.wls` from `"mathematica"` to `"wolfram"`
- `EXTENSION_MAP`: Changed `.reg` from `"registry"` to `"reg"`
- `EXTENSION_MAP`: Updated `.m` comment to clarify dict last-wins behavior
- `PLAIN_TEXT_LANGS`: Expanded from 5 to 14 entries, adding: `autohotkey`, `editorconfig`, `git_config`, `janet`, `odin`, `pip-requirements`, `sed`, `vba`, `vbscript`

## BDD Coverage

| BDD | Implementation |
|-----|---------------|
| BDD-01 | `commonLangs` unchanged, `LANG_IMPORT_MAP` uses dynamic import only |
| BDD-02 | `ensureLanguage()` checks → imports → `loadLanguage()` |
| BDD-03 | `LANG_IMPORT_MAP` missing key → returns `'text'` |
| BDD-04 | `ensureLanguage()` catch → returns `'text'` |
| BDD-05 | Backend `mathematica` → `wolfram`, `registry` → `reg` |
| BDD-06 | `loadingLangs` Map shares Promise for concurrent calls |
| BDD-07 | `highlightCode()` also calls `ensureLanguage()` |
| BDD-08 | `.wl` → `wolfram`, `.reg` → `reg` in backend |
| BDD-09 | `LEGACY_LANG_MAP` maps old IDs at read time |
