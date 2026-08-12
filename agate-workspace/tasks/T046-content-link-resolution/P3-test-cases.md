---
phase: P3
task_id: T046
type: test-cases
parent: P2-design.md
trace_id: T046-P3-20260704
status: draft
agent: test-designer
created: 2026-07-04
---

# T046 P3 Test Cases — path-map.ts

Tests file: `frontend-v3/src/utils/path-map.test.ts`
Implementation: `frontend-v3/src/utils/path-map.ts` (not yet created → tests RED)

## buildPathMap (10 cases)

| ID | Description | Input | Expected |
|----|-------------|-------|----------|
| TC-BPM-01 | Single file, path exact match (priority=1) | `{id:3, path:'images/arch.png', filename:'arch.png'}` | `map.get('images/arch.png') == {fileId:3, priority:1}` |
| TC-BPM-02 | Filename-only match (priority=2) | `{id:5, path:null, filename:'photo.png'}` | `map.get('photo.png') == {fileId:5, priority:2}` |
| TC-BPM-03 | Basename from path (priority=3 via path, priority=2 via filename) | `{id:7, path:'/tmp/screenshot.png', filename:'screenshot.png'}` | `map.get('screenshot.png').priority == 2` (filename wins) |
| TC-BPM-04 | Same-name conflict at same priority → key removed | Two files both `utils.py` | `map.has('utils.py') == false`; exact paths remain |
| TC-BPM-05 | Lower priority number wins for same key | path match (p=1) vs filename match (p=2) | `map.get('assets/logo.svg') == {fileId:11, priority:1}` |
| TC-BPM-06 | `./` prefix stripped from path | `path:'./images/logo.png'` | `map.get('images/logo.png')` exists; `./images/logo.png` does not |
| TC-BPM-07 | Empty file list → empty Map | `[]` | `map.size == 0` |
| TC-BPM-08 | External URL path not entered | `path:'https://...'` / `http://...` / `ftp://...` | External paths absent; filenames still entered |
| TC-BPM-09 | File with null path uses filename only | `{path:null, filename:'README.md'}` | `map.get('README.md') == {fileId:5, priority:2}`; size=1 |
| TC-BPM-10 | Absolute path extracts basename as key | `path:'/tmp/screenshot.png'` | Original `/tmp/...` not in map; `screenshot.png` key present |

## normalizeRef (18 cases)

| ID | Input | Expected | BDD trace |
|----|-------|----------|-----------|
| TC-NR-01 | `/api/v1/entries/...` | `null` | AC-P0-4 (skip API URLs) |
| TC-NR-02 | `https://...` | `null` | AC-P0-4 |
| TC-NR-03 | `http://...` | `null` | AC-P0-4 |
| TC-NR-04 | `data:image/png;base64,...` | `null` | skip data URI |
| TC-NR-05 | `blob:https://...` | `null` | skip blob URI |
| TC-NR-06 | `#anchor` | `null` | AC-P1-4 |
| TC-NR-07 | `mailto:user@...` | `null` | skip mailto |
| TC-NR-08 | `tel:+1234567890` | `null` | skip tel |
| TC-NR-09 | `//cdn.example.com/...` | `null` | skip protocol-relative |
| TC-NR-10 | `./images/logo.png` | `images/logo.png` | AC-P0-1 (strip `./`) |
| TC-NR-11 | `images/logo.png` | `images/logo.png` | AC-P0-1 (unchanged) |
| TC-NR-12 | `../parent/file.md` | `../parent/file.md` | unchanged, pathMap miss handles |
| TC-NR-13 | `./././images/logo.png` | `images/logo.png` | multiple `./` stripped |
| TC-NR-14 | `/tmp/screenshot.png` | `screenshot.png` | AC-P0-3 (basename extraction) |
| TC-NR-15 | `''` | `null` | empty → skip |
| TC-NR-16 | `'   '` | `null` | whitespace → skip |
| TC-NR-17 | `'  images/logo.png  '` | `images/logo.png` | trimmed |
| TC-NR-18 | `'./'` | `null` | only `./` → null |

## resolvePath (10 cases)

| ID | Description | Input | Expected |
|----|-------------|-------|----------|
| TC-RP-01 | Exact path match | `images/arch.png` | `3` |
| TC-RP-02 | Filename/basename match | `main.py` | `10` |
| TC-RP-03 | Not in map | `nonexistent.file` | `null` |
| TC-RP-04 | Exact path preferred over basename | `images/arch.png` vs `arch.png` | exact → 3, basename → 99 |
| TC-RP-05 | External URL → null | `https://...` | `null` |
| TC-RP-06 | Anchor → null | `#intro` | `null` |
| TC-RP-07 | `./` prefix stripped before lookup | `./main.py` | `10` |
| TC-RP-08 | Empty pathMap | `main.py` + empty Map | `null` |
| TC-RP-09 | Basename fallback when full path absent | `some/deep/path/arch.png` | `3` (via basename `arch.png`) |
| TC-RP-10 | No basename fallback when basename also absent | `some/deep/path/missing.png` | `null` |

## BDD Coverage Matrix

| BDD AC | Covered by |
|--------|-----------|
| AC-P0-1 relative path image rewrite | TC-BPM-01, TC-NR-10, TC-RP-01 |
| AC-P0-2 same-directory filename match | TC-BPM-02, TC-RP-02 |
| AC-P0-3 absolute path basename fallback | TC-BPM-10, TC-NR-14, TC-RP-09 |
| AC-P0-4 external URL not rewritten | TC-NR-02/03, TC-RP-05 |
| AC-P0-5 no match → keep original | TC-RP-03/10 |
| AC-P1-3 external link not rewritten | TC-NR-02/03 |
| AC-P1-4 anchor link not rewritten | TC-NR-06, TC-RP-06 |

Note: AC-P0-6 (raw HTML), AC-P0-7 (code block), AC-P1-1/2/5/6 (link click behavior) require integration/E2E tests beyond path-map.ts unit scope.
