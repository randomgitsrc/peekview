# P4 Implementation — T041: HTML Sibling Injection Fix & Enhancement

## Modified Files

### 1. `backend/peekview/services/html_render_service.py`

**Changes:**
- Added `import posixpath` and `import re`
- Added `_CSS_RECURSION_LIMIT = 3` constant
- Added `_IMPORT_RE` and `_URL_RE` compiled regex patterns
- Added `_lookup_key(key, mapping)` — lookup with basename fallback for `../` paths
- Added `_is_svg_file(f)` — detect SVG by language (xml/svg) or .svg extension
- Added `_process_css_refs(css_content, text_map, binary_map, svg_keys, depth, visited)` — recursive CSS @import and url() replacement
- Modified `_sibling_keys(f)` — added `posixpath.basename(by_path)` fallback key
- Modified `inject_resources()`:
  - Build `svg_keys` set from text siblings
  - Build `binary_map` unconditionally (not inside `if binary_siblings:`)
  - Add basename keys to `binary_map`
  - Use `_lookup_key` at all lookup sites (CSS href, JS src, img src, favicon href)
  - Accept `type="module"` scripts, preserve `type` attribute on inline replacement
  - Process CSS content through `_process_css_refs` before inlining
  - SVG-as-img: check `text_map` + `svg_keys` for img/video/audio/source/track src

### 2. `frontend-v3/src/components/HtmlViewer.vue`

**Changes:**
- Line 64: `sandbox="allow-scripts"` → `sandbox="allow-scripts allow-forms"`
- Line 11: Warning text changed from "PeekView 当前不支持多文件相对路径，这些资源不会加载" to "PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）。"

### 3. `backend/tests/test_html_render.py`

**New test classes:**
- `TestModuleScriptInjection` (5 tests) — BDD-2a, BDD-2b
- `TestCssInternalRefs` (9 tests) — BDD-4a, BDD-4b, BDD-4c
- `TestSvgAsImg` (8 tests) — BDD-5a, BDD-5b
- `TestPathNormalization` (8 tests) — BDD-6a, BDD-6b

**Total new tests:** 30

## BDD Coverage

| BDD | Test(s) |
|-----|---------|
| BDD-1 (sandbox allow-forms) | HtmlViewer.vue change (visual P6) |
| BDD-2a (module script inlined) | test_module_script_inlined_with_type_preserved, test_module_script_not_duplicated_in_unreferenced |
| BDD-2b (importmap preserved) | test_importmap_preserved_module_inlined |
| BDD-3 (warning text) | HtmlViewer.vue change (visual P6) |
| BDD-4a (@import replaced) | test_process_css_refs_import_replaced, test_process_css_refs_import_with_single_quotes, test_render_inject_css_with_import |
| BDD-4b (url() replaced) | test_process_css_refs_url_binary_replaced, test_process_css_refs_url_svg_text_replaced |
| BDD-4c (circular terminates) | test_process_css_refs_circular_import_terminates, test_process_css_refs_depth_limit |
| BDD-5a (SVG img → data URI) | test_svg_img_inlined_as_data_uri, test_svg_img_by_extension |
| BDD-5b (binary img unchanged) | test_binary_img_still_base64 |
| BDD-6a (../style.css matches) | test_relative_path_css_injected, test_lookup_key_basename_fallback |
| BDD-6b (../js/app.js matches) | test_relative_path_js_injected, test_relative_path_img_injected |
