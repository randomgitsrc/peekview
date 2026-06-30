# P4 Progress Log

## 2026-06-30 Implementation

### Read inputs
- P2-design.md: LANG_IMPORT_MAP (63 items), LEGACY_LANG_MAP (2 items), ensureLanguage(), highlight/highlightCode改造, backend ID对齐
- P3-test-cases.md: 16 backend tests (TC-B01~B16), 13 frontend tests (TC-F01~F13)
- P1-requirements.md: 9 BDD conditions, language ID alignment table
- useShiki.ts: current 16 static imports, highlight/highlightCode with inline lang fallback
- language.py: EXTENSION_MAP with mathematica/registry, PLAIN_TEXT_LANGS with 5 entries
- test_language.py: P3 tests already written, asserting wolfram/reg/no-mathematica/no-registry
- useShiki.spec.ts: P3 tests already written, importing LANG_IMPORT_MAP/LEGACY_LANG_MAP/ensureLanguage

### Implementation completed
- useShiki.ts: Added LANG_IMPORT_MAP (63), LEGACY_LANG_MAP (2), loadingLangs Map, ensureLanguage(), modified highlight() and highlightCode()
- language.py: mathematica→wolfram (3 places), registry→reg (1 place), PLAIN_TEXT_LANGS expanded to 14, .m comment updated
