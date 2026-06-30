# P3 Progress — T040

## 2026-06-30 P3 开始

### 读取输入

- [x] P0-brief.md：环境约束（debug 127.0.0.1:8888）、已知风险
- [x] P1-requirements.md：9 条 BDD 验收条件
- [x] P2-design.md：LANG_IMPORT_MAP + ensureLanguage + LEGACY_LANG_MAP 方案，packages/domains/gate_commands

### 代码分析

- [x] backend/peekview/language.py：当前 EXTENSION_MAP 中 `.wl`/`.wls`/`.nb` 映射 `mathematica`，`.reg` 映射 `registry`；PLAIN_TEXT_LANGS 仅 5 项
- [x] frontend-v3/src/composables/useShiki.ts：无 LANG_IMPORT_MAP、ensureLanguage、LEGACY_LANG_MAP；highlight/highlightCode 直接 fallback text
- [x] backend/tests/test_language.py：已有基础测试，需新增对齐断言

### 测试用例设计

- 后端 16 个用例（TC-B01~B16），覆盖 BDD-05/08
- 前端 13 个用例（TC-F01~F13），覆盖 BDD-01~09
- 共 29 个用例，全部追溯 BDD

### 产出

- [x] P3-test-cases.md
- [x] backend/tests/test_language.py（扩展）
- [x] frontend-v3/src/composables/__tests__/useShiki.spec.ts（新增）

### 红灯预期

- 后端：TC-B01~B04 断言 wolfram/reg 但当前值为 mathematica/registry → 红灯
- 后端：TC-B05~B08 断言旧值不存在但当前存在 → 红灯
- 后端：TC-B09 断言 PLAIN_TEXT_LANGS 含 14 项但当前仅 5 项 → 红灯
- 前端：import LANG_IMPORT_MAP/LEGACY_LANG_MAP/ensureLanguage 不存在 → 模块加载失败 → 红灯
