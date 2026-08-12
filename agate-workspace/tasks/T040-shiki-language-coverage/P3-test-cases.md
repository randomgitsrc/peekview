---
phase: P3
task_id: T040-shiki-language-coverage
type: test-cases
parent: P2-design.md
trace_id: T040-P3-20260630
status: draft
created: 2026-06-30
---

## 测试用例清单

### 后端测试（backend/tests/test_language.py）

| # | 用例 ID | 对应 BDD | 描述 | 预期 |
|---|---------|----------|------|------|
| 1 | TC-B01 | BDD-05 | EXTENSION_MAP 中 `.wl` 映射为 `wolfram` | `detect_language("file.wl") == "wolfram"` |
| 2 | TC-B02 | BDD-05 | EXTENSION_MAP 中 `.wls` 映射为 `wolfram` | `detect_language("file.wls") == "wolfram"` |
| 3 | TC-B03 | BDD-05 | EXTENSION_MAP 中 `.nb` 映射为 `wolfram` | `detect_language("file.nb") == "wolfram"` |
| 4 | TC-B04 | BDD-05 | EXTENSION_MAP 中 `.reg` 映射为 `reg` | `detect_language("file.reg") == "reg"` |
| 5 | TC-B05 | BDD-05 | EXTENSION_MAP 不再包含 `mathematica` 值 | `"mathematica" not in EXTENSION_MAP.values()` |
| 6 | TC-B06 | BDD-05 | EXTENSION_MAP 不再包含 `registry` 值 | `"registry" not in EXTENSION_MAP.values()` |
| 7 | TC-B07 | BDD-05 | FILENAME_MAP 不再包含 `mathematica` 值 | `"mathematica" not in FILENAME_MAP.values()` |
| 8 | TC-B08 | BDD-05 | FILENAME_MAP 不再包含 `registry` 值 | `"registry" not in FILENAME_MAP.values()` |
| 9 | TC-B09 | BDD-05 | PLAIN_TEXT_LANGS 包含所有无 Shiki grammar 的语言 | 12 种无 grammar 语言均在 PLAIN_TEXT_LANGS 中 |
| 10 | TC-B10 | BDD-05 | PLAIN_TEXT_LANGS 包含原有 5 种 | text, log, csv, ignore, git_attributes 仍在 |
| 11 | TC-B11 | BDD-08 | `.wl` 文件经 detect_language 返回 `wolfram` | `detect_language("script.wl") == "wolfram"` |
| 12 | TC-B12 | BDD-08 | `.reg` 文件经 detect_language 返回 `reg` | `detect_language("fix.reg") == "reg"` |
| 13 | TC-B13 | BDD-05 | get_language_list 不含 `mathematica` | `"mathematica" not in get_language_list()` |
| 14 | TC-B14 | BDD-05 | get_language_list 不含 `registry` | `"registry" not in get_language_list()` |
| 15 | TC-B15 | BDD-05 | get_language_list 含 `wolfram` | `"wolfram" in get_language_list()` |
| 16 | TC-B16 | BDD-05 | get_language_list 含 `reg` | `"reg" in get_language_list()` |

### 前端测试（frontend-v3/src/composables/__tests__/useShiki.spec.ts）

| # | 用例 ID | 对应 BDD | 描述 | 预期 |
|---|---------|----------|------|------|
| 17 | TC-F01 | BDD-01 | 16 种静态 import 语言在 highlighter 初始化后可用 | getLoadedLanguages 包含全部 16 种 |
| 18 | TC-F02 | BDD-02 | ensureLanguage 对已注册语言直接返回该语言 ID | 返回原 lang，不触发动态 import |
| 19 | TC-F03 | BDD-02 | ensureLanguage 对未注册语言执行动态 import + loadLanguage | 调用 LANG_IMPORT_MAP 中对应 importer，loadLanguage 被调用 |
| 20 | TC-F04 | BDD-03 | ensureLanguage 对 LANG_IMPORT_MAP 中不存在的语言返回 `'text'` | 返回 `'text'`，不抛错 |
| 21 | TC-F05 | BDD-04 | ensureLanguage 动态 import 失败时返回 `'text'` | importer reject 后返回 `'text'`，不抛错 |
| 22 | TC-F06 | BDD-06 | 并发调用 ensureLanguage 同一语言不重复加载 | importer 仅被调用 1 次，两次调用均成功 |
| 23 | TC-F07 | BDD-07 | highlightCode 也调用 ensureLanguage | highlightCode 对未注册语言触发动态加载 |
| 24 | TC-F08 | BDD-09 | LEGACY_LANG_MAP 将 `mathematica` 映射到 `wolfram` | ensureLanguage("mathematica") 实际加载 wolfram |
| 25 | TC-F09 | BDD-09 | LEGACY_LANG_MAP 将 `registry` 映射到 `reg` | ensureLanguage("registry") 实际加载 reg |
| 26 | TC-F10 | BDD-01 | LANG_IMPORT_MAP 包含 63 种动态语言 | Object.keys(LANG_IMPORT_MAP).length === 63 |
| 27 | TC-F11 | BDD-02 | ensureLanguage 成功加载后再次调用不触发 import | 第二次调用 importer 不被再次调用 |
| 28 | TC-F12 | BDD-05 | LANG_IMPORT_MAP 包含 `wolfram` 和 `reg` | 两个 key 均存在 |
| 29 | TC-F13 | BDD-03 | LANG_IMPORT_MAP 不包含无 grammar 的语言 | autohotkey, editorconfig 等不在 map 中 |

## 红灯预期

- 后端测试：TC-B01~B04 断言 `mathematica`→`wolfram`、`registry`→`reg`，当前代码仍为旧值，红灯
- 后端测试：TC-B05~B08 断言旧值不存在，当前代码仍有，红灯
- 后端测试：TC-B09 断言 PLAIN_TEXT_LANGS 含 12 种新语言，当前仅 5 种，红灯
- 前端测试：TC-F01~F13 全部依赖 `ensureLanguage`、`LANG_IMPORT_MAP`、`LEGACY_LANG_MAP`，当前代码不存在这些导出，import 即失败，红灯
