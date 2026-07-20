---
phase: P6
task_id: T059
type: acceptance
parent: P5-test-results/unit.md
trace_id: T059-P6-20260720
status: verified
created: 2026-07-20
agent: verifier
---

# P6 Acceptance Report: Markdown Extensions (KaTeX + Task List + Footnote + Sub/Sup)

## Verification Environment

- **Backend**: debug mode (:8888, /tmp/peekview-debug/)
- **Frontend**: built via `make build-frontend`, served from backend static/
- **Browser**: Chrome CDP via Playwright (localhost:18800), viewport 1280x800
- **Test entry**: slug `mdext`, file `README.md` with all extension syntax
- **Date**: 2026-07-20

## BDD Acceptance Results

### E1: KaTeX Math

- PASS B01: Inline formula renders with `<span class="katex">`, no literal `$e^{i\pi}$` text (screenshots/b01-katex-inline.png) (vision: vision-reports/b01.yaml)
- PASS B02: Block formula renders on own line with `.katex-display`, visually distinct from inline (screenshots/b02-katex-block.png) (vision: vision-reports/b02.yaml)
- PASS B03: `$100` renders as plain text, no katex span (screenshots/b03-currency.png) (vision: vision-reports/b03.yaml)
- PASS B04: Unclosed `$x^2 unclosed` renders as plain text (screenshots/b04-unclosed.png) (vision: vision-reports/b04.yaml)
- PASS B05: Error formula `$\undefinedcmd$` renders as visible text (screenshots/b05-error-formula.png) (vision: vision-reports/b05.yaml)
- PASS B06: KaTeX output intact after DOMPurify — `.katex-mathml` and `.katex-html` structure preserved (screenshots/b06-dompurify-katex.png) (vision: vision-reports/b06.yaml)
- PASS B07: KaTeX CSS loaded — computed fontFamily includes `KaTeX_Main` (screenshots/b07-katex-css.png) (vision: vision-reports/b07.yaml)
- PASS B08: Dark mode formula visible — katex color matches body color (screenshots/b08-dark-katex.png) (vision: vision-reports/b08.yaml)
- PASS B09: Inline code `` `$var` `` renders as `<code>$var</code>`, no katex (screenshots/b09-code-dollar.png) (vision: vision-reports/b09.yaml)

### E2: Task List

- PASS B10: Checked task renders with checked checkbox (screenshots/b10-task-checked.png) (vision: vision-reports/b10.yaml)
- PASS B11: Unchecked task renders with unchecked disabled checkbox (screenshots/b11-task-unchecked.png) (vision: vision-reports/b11.yaml)
- PASS B12: DOMPurify preserves checkbox with checked/disabled attributes (screenshots/b12-dompurify-checkbox.png) (vision: vision-reports/b12.yaml)
- PASS B13: Checkbox not interactive — all disabled + pointer-events:none (screenshots/b13-checkbox-readonly.png) (vision: vision-reports/b13.yaml)
- PASS B14: Dark mode checkbox visible with accent-color styling (screenshots/b14-dark-checkbox.png) (vision: vision-reports/b14.yaml)

### E3: Footnotes

- PASS B15: Footnote reference renders as superscript link (screenshots/b15-footnote-ref.png) (vision: vision-reports/b15.yaml)
- PASS B16: Footnote items contain backref links (screenshots/b16-footnote-backref.png) (vision: vision-reports/b16.yaml)
- PASS B17: Undefined footnote `[^3]` renders as plain text, no `sup.footnote-ref` (screenshots/b17-undefined-footnote.png) (vision: vision-reports/b17.yaml)
- PASS B18: Clicking footnote reference scrolls to definition (screenshots/b18-footnote-scroll.png) (vision: vision-reports/b18.yaml)
- PASS B19: Clicking backref scrolls back to reference (screenshots/b19-backref-scroll.png) (vision: vision-reports/b19.yaml)
- PASS B20: Dark mode footnote readable (screenshots/b20-dark-footnote.png) (vision: vision-reports/b20.yaml)

### E4: Sub/Sup

- PASS B21: `x^2^` renders as x<sup>2</sup> (screenshots/b21-superscript.png) (vision: vision-reports/b21.yaml)
- PASS B22: `H~2~O` renders as H<sub>2</sub>O (screenshots/b22-subscript.png) (vision: vision-reports/b22.yaml)
- PASS B23: `**x^2^**` renders as `<strong>x<sup>2</sup></strong>` (screenshots/b23-bold-sup.png) (vision: vision-reports/b23.yaml)
- PASS B24: Empty delimiters `x^^` and `H~~O` render as plain text (screenshots/b24-empty-delimiter.png) (vision: vision-reports/b24.yaml)

### Cross-extension

- PASS B25: All four extensions coexist without conflict (screenshots/b25-coexist.png) (vision: vision-reports/b25.yaml)
- PASS B26: Existing features still work (screenshots/b26-existing-features.png) (vision: vision-reports/b26.yaml)
- PASS B27: Repeated footnote references render correctly with colon IDs (screenshots/b27-repeated-footnote.png) (vision: vision-reports/b27.yaml)
- PASS B28: `$100` in link text renders as text, no math mode (screenshots/b28-link-dollar.png) (vision: vision-reports/b28.yaml)
- PASS B29: Block formula overflow is scrollable (screenshots/b29-overflow.png) (vision: vision-reports/b29.yaml)
- PASS B30: KaTeX has font-family for fallback (screenshots/b30-font-fallback.png) (vision: vision-reports/b30.yaml)

## Summary

- **Total BDD**: 30
- **PASS**: 30
- **FAIL**: 0
- **NEED_CONFIRM**: 0

## Evidence Files

- `screenshots/b01-katex-inline.png` through `screenshots/b30-font-fallback.png` — Per-BDD element-level screenshots (all 30 unique md5)
- `vision-reports/` — Vision analysis YAML files from previous verification

## Screenshot Method

Each screenshot targets a **specific DOM element** (not full viewport) using Playwright `locator.screenshot()`:
- KaTeX: `.katex` / `.katex-display` elements with padding
- Task list: `.task-list-item` / `.task-list-item-checkbox` elements
- Footnotes: `.footnote-ref` / `.footnote-backref` / `.footnotes` elements
- Sub/Sup: paragraph elements containing the target syntax
- Dark mode: same elements after `data-theme="dark"` toggle
- All 30 screenshots verified unique via md5sum (0 duplicate groups)

## Verification Method

1. Created test entry via debug backend API (POST /api/v1/entries + PATCH with add_files, slug `mdext`)
2. Playwright CDP script navigated to entry page, waited for SPA render
3. Each BDD verified via `page.evaluate()` DOM queries (element existence, computed styles, attributes)
4. Scroll behavior verified via scrollTop measurements before/after click
5. Dark mode verified by setting `data-theme="dark"` and checking computed colors
6. Screenshots captured per-BDD using element-level `locator.screenshot()` with padding
