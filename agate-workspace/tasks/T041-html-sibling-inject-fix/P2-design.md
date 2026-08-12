---
phase: P2
task_id: T041-html-sibling-inject-fix
type: design
parent: P1-requirements.md
trace_id: T041-P2-20260630
status: draft
created: 2026-06-30
---

# P2 Design — T041: HTML Sibling Injection Fix & Enhancement

## Declarations

```yaml
packages: [backend/peekview, frontend-v3]
domains: [backend, frontend]
ui_affected: true
ui_affected_items:
  - iframe sandbox attribute (allow-forms added)
  - relative path warning text content
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/test_html_render.py -q --tb=no"
  P5_lint: "cd backend && python3 -m ruff check peekview/services/html_render_service.py"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P6: "cd backend && .venv/bin/python -m pytest tests/test_html_render.py -q --tb=no"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' (should match test expectations, not production)"
files_to_read:
  - path: backend/peekview/services/html_render_service.py
    why: Primary file — all 4 backend changes (module script, CSS refs, SVG, path normalization)
  - path: frontend-v3/src/components/HtmlViewer.vue
    why: sandbox attribute (line 64) + warning text (line 11)
  - path: backend/peekview/api/files.py:50-62
    why: RENDER_CSP definition — confirm form-action 'none' exists (security baseline for allow-forms)
  - path: backend/tests/test_html_render.py
    why: Existing test patterns — new tests must follow same fixture/async style
minimal_validation:
  - assumption: "BS4 html.parser correctly identifies <script type='module' src='app.js'> and preserves type attribute"
    method: "Python REPL: BeautifulSoup with script type=module, verify type_attr value"
    result: "confirmed"
    note: "BS4 returns type='module' as string attribute, can filter with `type_attr in ('text/javascript', 'module')`"
  - assumption: "sandbox allow-forms + CSP form-action 'none' allows submit event but blocks navigation"
    method: "Web spec review — CSP form-action takes precedence over sandbox for navigation; allow-forms enables submit event"
    result: "confirmed"
    note: "Well-supported in Chrome/Firefox/Safari. Cannot test in CLI, but spec is unambiguous."
  - assumption: "normalize_ref('../style.css') returns '../style.css' unchanged (bug confirmed)"
    method: "Python REPL: normalize_ref('../style.css')"
    result: "confirmed"
    note: "Returns '../style.css' — cannot match sibling key 'style.css'. Fix: add basename fallback in _sibling_keys."
```

## Impact Analysis

### What Changes

| File | Function/Area | Change Type | Description |
|------|---------------|-------------|-------------|
| `html_render_service.py:149` | JS script type filter | Bug fix | Accept `type="module"` alongside `text/javascript` |
| `html_render_service.py:152` | Inline script creation | Bug fix | Preserve `type` attribute on new inline `<script>` |
| `html_render_service.py:90-100` | `_sibling_keys` | Enhancement | Add `posixpath.basename()` fallback key |
| `html_render_service.py:131-139` | CSS injection | Enhancement | Post-process inlined CSS for `@import` and `url()` refs |
| `html_render_service.py:196-203` | Binary img src matching | Enhancement | Also check `text_map` for SVG files, inline as data URI |
| `HtmlViewer.vue:64` | sandbox attribute | Bug fix | Add `allow-forms` |
| `HtmlViewer.vue:11` | Warning text | Enhancement | Replace misleading text with neutral description |

### What Does NOT Change

- `normalize_ref()` function signature or core logic — only `_sibling_keys` adds a fallback
- `RENDER_CSP` in `files.py` — `form-action 'none'` already present, no change needed
- `countRelativePaths()` in `HtmlViewer.vue` — client-side DOM counting, independent of injection
- `parse_inject_ids()`, `_detect_kind()` — no changes
- API routes, models, database schema — no changes
- MCP server — no changes (rendering-only)

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSS `@import` regex false positive on string content | Low | Non-greedy regex with quote-awareness; documented as acceptable minor rate |
| `../` basename fallback collision (e.g. `../a/style.css` + `../b/style.css` both → `style.css`) | Low | First-wins (dict key order); documented as known limitation for flat-file scenarios |
| Inline module script `import './dep.js'` relative paths fail | Hard limit | Cannot fix with BS4 static analysis. If HTML has `<script type="importmap">`, sibling JS can register. Otherwise: documented limitation. |
| SVG containing `<script>` inline | Low | sandbox iframe (`allow-scripts` without `allow-same-origin`) → opaque origin isolation. Acceptable. |

## Design: Item-by-Item

### §1. sandbox allow-forms (Bug 1)

**File**: `frontend-v3/src/components/HtmlViewer.vue:64`

**Change**: 
```
sandbox="allow-scripts"  →  sandbox="allow-scripts allow-forms"
```

**Security analysis**: CSP `form-action 'none'` (already in `RENDER_CSP`, `files.py:61`) blocks actual navigation. `allow-forms` only enables the submit event to fire (JS can intercept via `onsubmit`). This is the intended behavior — forms can trigger JS logic but cannot navigate away.

**BDD coverage**: BDD-1 (sandbox includes allow-forms, submit event fires, no navigation)

### §2. module script injection (Bug 2)

**File**: `backend/peekview/services/html_render_service.py:148-155`

**Current code** (lines 148-155):
```python
type_attr = script.get("type")
if type_attr and type_attr != "text/javascript":
    continue
used_text_keys.add(key)
inline = soup.new_tag("script")
inline.string = f"/* injected from: {key} */\n{text_map[key]}"
script.decompose()
inline_scripts_to_append.append(inline)
```

**New code**:
```python
type_attr = script.get("type")
if type_attr and type_attr not in ("text/javascript", "module"):
    continue
used_text_keys.add(key)
inline = soup.new_tag("script")
if type_attr:
    inline["type"] = type_attr
inline.string = f"/* injected from: {key} */\n{text_map[key]}"
script.decompose()
inline_scripts_to_append.append(inline)
```

**Key points**:
- `type="importmap"` scripts are preserved (they have no `src`, so `soup.find_all("script", src=True)` won't match them)
- `type="module"` scripts get `type="module"` preserved on the inline replacement
- `used_text_keys.add(key)` prevents the module JS from being re-appended as "unreferenced JS"
- Inline module scripts with `import './dep.js'` will fail at runtime — this is a hard limit documented in P0

**BDD coverage**: BDD-2a (module script inlined with type preserved, not duplicated), BDD-2b (importmap preserved, module script inlined)

### §3. Warning text (Enhancement 1)

**File**: `frontend-v3/src/components/HtmlViewer.vue:11`

**Current text**:
```
此 HTML 含 {{ relativePathWarningCount }} 个本地资源引用，PeekView 当前不支持多文件相对路径，这些资源不会加载。
```

**New text**:
```
此 HTML 含 {{ relativePathWarningCount }} 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）。
```

**Key points**:
- Removes "不支持" and "不会加载" (misleading — simple cases work)
- Adds "将尝试自动注入" (accurate — injection is attempted)
- Adds caveat for unsupported cases (dynamic loading, nested iframe)

**BDD coverage**: BDD-3 (text says "将尝试自动注入", does NOT say "不支持" or "不会加载")

### §4. CSS internal reference injection (Enhancement 2)

**File**: `backend/peekview/services/html_render_service.py`

**New function**: `_process_css_refs(css_content, text_map, binary_map, depth=0, visited=None)`

**Algorithm**:
1. Track `visited` set (normalized ref keys) to break circular `@import` chains
2. Recursion depth limit: 3 (per P0-brief)
3. Process `@import`:
   - Regex: `@import\s+(?:url\(\s*['"]?|['"])([^'")\s]+)['"]?\s*\)?\s*;`
   - For each match, normalize the ref, look up in `text_map`
   - If found and not in `visited`: recursively process that CSS content, then replace the `@import` with the processed content
   - If not found: leave `@import` as-is (may be external URL that normalize_ref skipped)
4. Process `url()`:
   - Regex: `url\(\s*['"]?([^'")\s]+)['"]?\s*\)`
   - For each match, normalize the ref
   - Check `binary_map` first → replace with `data:{mime};base64,{content}`
   - Check `text_map` for SVG → replace with `data:image/svg+xml;charset=utf-8,{content}`
   - If not found: leave `url()` as-is

**Integration point**: After CSS is inlined (line 138), call `_process_css_refs` on the content before setting `style.string`:
```python
style.string = f"/* injected from: {key} */\n{_process_css_refs(text_map[key], text_map, binary_map)}"
```

Also apply to unreferenced CSS append (line 176):
```python
style.string = f"/* injected from: {f.filename} */\n{_process_css_refs(f.content, text_map, binary_map)}"
```

**Note**: `binary_map` must be built before CSS processing. Currently `binary_map` is built inside the `if binary_siblings:` block (line 185). Need to hoist `binary_map` construction to before CSS processing, or build it unconditionally.

**Design decision**: Build `binary_map` unconditionally (empty dict if no binary siblings). This simplifies the code and avoids conditional logic.

**BDD coverage**: BDD-4a (@import replaced with content), BDD-4b (url() replaced with data URI), BDD-4c (circular @import terminates)

### §5. SVG-as-img injection (Enhancement 3)

**File**: `backend/peekview/services/html_render_service.py:196-203`

**Current code** only checks `binary_map` for img/video/audio/source/track src.

**New logic**: After the binary_map check, also check `text_map` for SVG files:
```python
for tag_name in safe_src_tags:
    for el in soup.find_all(tag_name, src=True):
        src = el.get("src")
        key = normalize_ref(src or "")
        if not key:
            continue
        if key in binary_map:
            f = binary_map[key]
            el["src"] = f"data:{f.mime_type or 'application/octet-stream'};base64,{f.content}"
            continue
        if key in text_map and _is_svg_ref(key, text_siblings):
            svg_content = text_map[key]
            el["src"] = f"data:image/svg+xml;charset=utf-8,{svg_content}"
            used_text_keys.add(key)
```

**SVG detection helper**: `_is_svg_ref(key, text_siblings)`
- Check if the sibling file matching this key is an SVG
- Criteria: `language` is "xml" or "svg", OR filename ends with `.svg`
- Simple implementation: iterate `text_siblings`, find one whose `_sibling_keys` include `key`, then check language/filename

**Optimization**: Build a `svg_keys` set during sibling processing (alongside `text_map` and `binary_map`) to avoid per-element iteration:
```python
svg_keys: set[str] = set()
for f in text_siblings:
    if _is_svg_file(f):
        for k in _sibling_keys(f):
            svg_keys.add(k)
```

Where `_is_svg_file(f)` checks `f.language in ("xml", "svg") or f.filename.lower().endswith(".svg")`.

Then in the img src loop:
```python
if key in text_map and key in svg_keys:
    svg_content = text_map[key]
    el["src"] = f"data:image/svg+xml;charset=utf-8,{svg_content}"
    used_text_keys.add(key)
```

**Security**: SVG can contain `<script>`, but sandbox iframe (`allow-scripts` without `allow-same-origin`) runs in opaque origin — cannot access parent page cookies/localStorage. Acceptable per P0 risk analysis.

**BDD coverage**: BDD-5a (SVG img → data:image/svg+xml), BDD-5b (binary img → base64, unchanged)

### §6. ../ path normalization (Enhancement 4)

**File**: `backend/peekview/services/html_render_service.py:90-100`

**Current `_sibling_keys`**:
```python
def _sibling_keys(f: SiblingFileData) -> list[str]:
    keys: list[str] = []
    by_name = normalize_ref(f.filename)
    if by_name:
        keys.append(by_name)
    if f.path:
        by_path = normalize_ref(f.path)
        if by_path and (not by_name or by_path != by_name):
            keys.append(by_path)
    return keys
```

**New `_sibling_keys`** — add basename fallback:
```python
import posixpath

def _sibling_keys(f: SiblingFileData) -> list[str]:
    keys: list[str] = []
    by_name = normalize_ref(f.filename)
    if by_name:
        keys.append(by_name)
    if f.path:
        by_path = normalize_ref(f.path)
        if by_path and (not by_name or by_path != by_name):
            keys.append(by_path)
            basename = posixpath.basename(by_path)
            if basename and basename != by_path and basename != by_name:
                keys.append(basename)
    return keys
```

**How it works**:
- `normalize_ref("../style.css")` returns `"../style.css"` (unchanged)
- Sibling file with `path="style.css"` has `_sibling_keys` → `["style.css"]`
- With basename fallback, sibling file with `path="js/app.js"` has `_sibling_keys` → `["app.js", "js/app.js", "app.js"]` (deduped → `["app.js", "js/app.js"]`)
- Wait — `posixpath.basename("style.css")` = `"style.css"` which equals `by_name`, so no extra key added. That's correct.
- For `path="js/app.js"`: `posixpath.basename("js/app.js")` = `"app.js"` which equals `by_name` ("app.js"), so no extra key. Also correct.
- The basename fallback helps when `normalize_ref("../style.css")` = `"../style.css"` and the sibling has `filename="style.css"` → `by_name="style.css"`. The lookup `key="../style.css"` won't match `"style.css"` in `text_map`.

**Wait — this doesn't solve the problem!** The issue is that `normalize_ref("../style.css")` returns `"../style.css"`, and the sibling key is `"style.css"`. Adding basename to `_sibling_keys` doesn't help because the *lookup key* is still `"../style.css"`.

**Revised approach**: Also normalize `../` in `normalize_ref` by resolving relative paths. But P0 says "在 `_sibling_keys` 中同时注册 `posixpath.basename()` 作为 fallback key" — this means registering the basename as an *additional* key in the map, so `"../style.css"` won't match but `"style.css"` will.

The problem: `normalize_ref("../style.css")` = `"../style.css"`. This is the *lookup key*. The *map key* from `_sibling_keys` is `"style.css"`. They don't match.

**Two-part fix**:
1. In `_sibling_keys`, add `posixpath.basename(f.path)` as fallback key (so `text_map["app.js"]` exists for `path="js/app.js"`)
2. In the lookup sites (CSS href, JS src, img src), also try `posixpath.basename(key)` as fallback when `key` is not found in the map

Actually, re-reading P0 more carefully: "在 `_sibling_keys` 中同时注册 `posixpath.basename()` 作为 fallback key（扁平文件场景下 `../style.css` → `style.css`）"

The intent is: when `normalize_ref("../style.css")` returns `"../style.css"`, we also register `"style.css"` as a key in the map. But the *lookup* still uses `"../style.css"` which won't find `"style.css"`.

**Correct fix**: Modify the lookup to also try basename. Specifically, when `key not in text_map`, try `posixpath.basename(key)` as fallback:

```python
def _lookup_key(key: str, mapping: dict) -> str | None:
    """Find key in mapping, with basename fallback for ../ paths."""
    if key in mapping:
        return key
    basename = posixpath.basename(key)
    if basename and basename != key and basename in mapping:
        return basename
    return None
```

Use this helper at all lookup sites (CSS href, JS src, img src, CSS @import, CSS url()).

**Combined with `_sibling_keys` basename registration**: Both sides contribute:
- `_sibling_keys` registers basename for `path="js/app.js"` → keys include `"app.js"` (already exists as `by_name`)
- `_lookup_key` resolves `"../style.css"` → tries `"style.css"` → found in map

This is the correct design. The `_sibling_keys` basename addition is actually redundant for the `../style.css` case (since `filename="style.css"` already produces key `"style.css"`), but it helps for cases like `path="sub/theme.css"` where `filename` might be different from the path basename.

**Final design for §6**:
1. Add `_lookup_key(key, mapping)` helper that tries basename fallback
2. Use `_lookup_key` at all lookup sites in `inject_resources`
3. Add `posixpath.basename(by_path)` to `_sibling_keys` as additional fallback (for path-based siblings where filename differs from path basename)

**BDD coverage**: BDD-6a (../style.css matches style.css), BDD-6b (../js/app.js matches app.js via basename)

## Implementation Order

1. **§6 path normalization** — foundational, affects all lookup sites
2. **§2 module script** — bug fix, independent of other changes
3. **§5 SVG-as-img** — needs `svg_keys` set + modified img src loop
4. **§4 CSS internal refs** — most complex, depends on §6 (lookup) and needs `binary_map` hoisted
5. **§1 sandbox** — frontend one-liner, independent
6. **§3 warning text** — frontend one-liner, independent

Items 5 and 6 can be done in parallel with backend changes.

## Completion Criteria

- [ ] `sandbox="allow-scripts allow-forms"` in HtmlViewer.vue
- [ ] `<script type="module" src="app.js">` replaced with inline `<script type="module">`
- [ ] Warning text says "将尝试自动注入" and does NOT say "不支持" or "不会加载"
- [ ] CSS `@import url("theme.css")` replaced with theme.css content (depth ≤ 3)
- [ ] CSS `url("bg.png")` replaced with data URI
- [ ] Circular @import terminates without infinite loop
- [ ] `<img src="diagram.svg">` replaced with `data:image/svg+xml;charset=utf-8,...`
- [ ] Binary img src still uses base64 data URI (unchanged)
- [ ] `normalize_ref("../style.css")` matches sibling key "style.css" via basename fallback
- [ ] All existing tests pass (no regression)
- [ ] New tests cover all 11 BDD criteria

## Test Plan (P3 Reference)

New test classes to add in `test_html_render.py`:

| Test Class | BDD | Description |
|------------|-----|-------------|
| `TestModuleScriptInjection` | BDD-2a, 2b | module script inlined with type preserved; importmap preserved |
| `TestCssInternalRefs` | BDD-4a, 4b, 4c | @import replacement, url() replacement, circular termination |
| `TestSvgAsImg` | BDD-5a, 5b | SVG text file → data:image/svg+xml; binary img unchanged |
| `TestPathNormalization` | BDD-6a, 6b | ../style.css matches style.css; ../js/app.js matches app.js |

Unit tests for `html_render_service.py` functions (no HTTP, direct function calls):
- `test_normalize_ref_basename_fallback`
- `test_process_css_refs_import`
- `test_process_css_refs_url_binary`
- `test_process_css_refs_circular`
- `test_is_svg_file`
- `test_sibling_keys_basename_fallback`

Integration tests (via render endpoint):
- `test_render_module_script_inlined`
- `test_render_css_import_resolved`
- `test_render_svg_img_inlined`
- `test_render_relative_path_css`

P6 visual verification (Playwright):
- sandbox allow-forms: form submit event fires
- warning text content matches new wording
