# P2 Progress — T041

## 2026-06-30 Session

### Input Read
- P0-brief.md: 6 items (2 bugs, 4 enhancements), known risks, env constraints
- P1-requirements.md: 11 BDD criteria across 6 items, edge cases, pruning P7/P8
- html_render_service.py: 234 lines, key functions normalize_ref, _sibling_keys, inject_resources
- HtmlViewer.vue: 309 lines, sandbox="allow-scripts" at line 64, warning text at line 11
- test_html_render.py: 218 lines, existing test coverage for route basics, CSP, access control, sibling injection
- files.py: RENDER_CSP with form-action 'none', render endpoint at line 300

### Minimal Validation
1. BS4 + script type="module": CONFIRMED — BS4 correctly identifies `<script type="module" src="app.js">`, `type_attr` returns "module", can be filtered with `type_attr in ("text/javascript", "module")`
2. normalize_ref("../style.css"): CONFIRMED BUG — returns "../style.css" unchanged, cannot match sibling key "style.css"
3. sandbox allow-forms + form-action 'none': NOT directly testable in CLI, but spec is well-supported across browsers (Chrome/Firefox/Safari). CSP form-action takes precedence over sandbox allow-forms for navigation. allow-forms enables submit event firing. ACCEPTED as confirmed based on web spec.

### Design Decisions
- Item 1 (sandbox): One-line change, no design risk
- Item 2 (module script): Change type filter + preserve type attr on new tag + mark used_text_keys to prevent duplicate append
- Item 3 (warning text): Simple string replacement
- Item 4 (CSS internal refs): New function `_process_css_refs`, regex-based @import + url() replacement, recursive with depth limit 3 + visited set
- Item 5 (SVG-as-img): Check text_map for img src matching SVG, inline as data:image/svg+xml;charset=utf-8
- Item 6 (../path): Add posixpath.basename() fallback key in _sibling_keys
