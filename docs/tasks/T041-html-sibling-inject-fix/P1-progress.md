# P1 Progress — T041

## 2026-06-30 — Input Reading

### P0-brief.md findings
- 5 items: 2 bugs + 4 enhancements (sandbox, module script, warning text, CSS internal refs, SVG-as-img, path normalization)
- Known risks: ES module inline import hard limit, CSS regex false positive, ../ basename collision, SVG XSS, browser consistency for allow-forms+allow-scripts+form-action 'none'
- Pruning: moderate — sandbox is trivial; backend injection logic needs P2+P3; warning text rides with sandbox

### html_render_service.py findings
- `normalize_ref` strips `./` but NOT `../` → confirmed Bug 6
- Line 148-149: `type_attr and type_attr != "text/javascript"` skips module scripts → confirmed Bug 2
- No CSS internal reference processing (`@import`, `url()`) → confirmed Enhancement 4
- No SVG-as-text-file handling in `<img src>` (only binary_siblings checked) → confirmed Enhancement 5
- `_sibling_keys` only uses `normalize_ref(filename)` and `normalize_ref(path)`, no basename fallback → confirmed Enhancement 6

### HtmlViewer.vue findings
- Line 64: `sandbox="allow-scripts"` missing `allow-forms` → confirmed Bug 1
- Line 11: Warning text says "当前不支持多文件相对路径，这些资源不会加载" → inaccurate, confirmed Enhancement 3

### CSP findings
- Render endpoint CSP (files.py:61): `form-action 'none'` — this is the security backstop for `allow-forms`
- Sandbox `allow-forms` + CSP `form-action 'none'` = form submit event fires (JS can intercept) but no actual navigation → correct security model
- Main app CSP (main.py:175): `form-action 'none'` for the main app

### Existing tests
- `test_html_render.py`: 4 groups (route basics, access control, CSP, sibling injection)
- No tests for module script, CSS internal refs, SVG, ../ paths, or sandbox allow-forms

## 2026-06-30 — Requirements Analysis

### Implicit needs identified
1. **Data**: No migration needed — changes are to injection logic, not schema
2. **Frontend**: sandbox attribute change + warning text change (2 files, same component)
3. **Multi-end**: No MCP/CLI sync needed — these are rendering-only changes
4. **Edge cases**:
   - CSS @import recursive depth limit (3 layers per P0) — must handle circular @import
   - SVG inline with `<script>` inside — sandbox iframe isolates, but worth noting
   - `../` basename fallback collision: `a/style.css` and `b/style.css` both map to `style.css` — first-wins or last-wins?
   - Module script with inline `import` from relative path — hard limit, cannot be solved by BS4
5. **Compatibility**: `allow-forms` + `allow-scripts` + `form-action 'none'` — well-supported in modern browsers

### Items needing confirmation
- None identified — all items have clear direction from P0-brief
