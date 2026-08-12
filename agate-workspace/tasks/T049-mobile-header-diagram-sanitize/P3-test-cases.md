---
phase: P3
task_id: T049-mobile-header-diagram-sanitize
type: test-cases
parent: P2-design.md
trace_id: T049-P3-20260708
status: draft
created: 2026-07-08
agent: test-designer
---

# P3 Test Cases

test_code_dir:
  - backend/tests/
  - frontend-v3/src/utils/__tests__/
  - frontend-v3/e2e/

## Domain: diagram-config (Backend Config + CLI)

| # | BDD | Test Name | File | Type | Expected (when implemented) | Current (RED) |
|---|-----|-----------|------|------|----------------------------|----------------|
| TC-1 | B-BDD-1 | `test_diagram_config_default_enabled` | backend/tests/test_diagram_config.py | unit | `PeekDiagram().sanitize_enabled == True` | `PeekDiagram` class doesn't exist → ImportError |
| TC-2 | B-BDD-1 | `test_diagram_config_env_override` | backend/tests/test_diagram_config.py | unit | `PEEKVIEW_DIAGRAM__SANITIZE_ENABLED=false` → `PeekDiagram().sanitize_enabled == False` | Same |
| TC-3 | B-BDD-1 | `test_diagram_config_endpoint_returns_default` | backend/tests/test_diagram_config.py | integration | `GET /api/v1/config/diagram` returns `{"sanitize_enabled": true}` | 404 (router doesn't exist) |
| TC-4 | B-BDD-1 | `test_diagram_config_endpoint_env_override` | backend/tests/test_diagram_config.py | integration | `GET /api/v1/config/diagram` reflects env var | 404 |
| TC-5 | B-BDD-7 | `test_cli_diagram_sanitize_set_false` | backend/tests/test_diagram_config.py | integration | `config set diagram.sanitize_enabled false` → exit 0, ack contains "Set" and "Restart" | "Unknown config key" → exit 1 |
| TC-6 | B-BDD-7 | `test_cli_diagram_sanitize_set_true` | backend/tests/test_diagram_config.py | integration | `config set diagram.sanitize_enabled true` → exit 0 | Same |
| TC-7 | B-BDD-8 | `test_cli_diagram_sanitize_list` | backend/tests/test_diagram_config.py | integration | `config list` output includes `diagram.sanitize_enabled` | Key not in SUPPORTED_CONFIG_KEYS → not listed |
| TC-8 | B-BDD-9 | `test_cli_diagram_sanitize_invalid_value` | backend/tests/test_diagram_config.py | integration | `config set diagram.sanitize_enabled invalid` → err msg + exit 1 | Exit 1 with "Unknown config key" (different msg) |

## Domain: diagram-sanitize (Frontend Utils)

| # | BDD | Test Name | File | Type | Expected (when implemented) | Current (RED) |
|---|-----|-----------|------|------|----------------------------|----------------|
| TC-9 | B-BDD-4 | `sanitize plantuml adds missing @startuml/@enduml` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | `sanitize(code_no_start, 'plantuml')` prepends `@startuml\n` + appends `\n@enduml` | Module not found |
| TC-10 | B-BDD-4 | `sanitize plantuml keeps existing @startuml` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | `sanitize(code_has_start, 'plantuml')` unchanged first line | Same |
| TC-11 | B-BDD-4 | `sanitize plantuml handles code with @startuml but no @enduml` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | appends `\n@enduml` if missing | Same |
| TC-12 | B-BDD-5 | `sanitizeWithRetry applies heuristic on render failure` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | Returns `{ code: fixed, appliedHeuristics: true }` | Same |
| TC-13 | B-BDD-5 | `sanitizeWithRetry skips heuristic on deterministic success` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | Returns `{ code: original, appliedHeuristics: false }` | Same |
| TC-14 | B-BDD-6 | `registerRule adds rule to engine list` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | Rule function stored and executed during sanitize pipeline | Same |
| TC-15 | B-BDD-6 | `registerRule with existing name warns and skips` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | `console.warn` called, no override | Same |
| TC-16 | P2-review | `sanitize unknown engine returns original code` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | `sanitize(code, 'unknown')` returns code unchanged | Same |
| TC-17 | P2-review | `sanitize empty string returns empty` | frontend-v3/src/utils/__tests__/diagramSanitize.spec.ts | unit | `sanitize('', 'mermaid')` returns `''` | Same |

## Domain: mobile-header-shrink (Playwright E2E)

| # | BDD | Test Name | File | Viewport | Expected (when implemented) | Current (RED) |
|---|-----|-----------|------|----------|----------------------------|----------------|
| TC-18 | A-BDD-1 | `mobile tags truncation with +N indicator` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | mobile 390x844 | header-tags single line, `+N` visible with N>0 | Tags wrap, no truncation |
| TC-19 | A-BDD-2 | `mobile single tag no overflow indicator` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | mobile 390x844 | No `+N` indicator visible | Works coincidentally (no overflow) |
| TC-20 | A-BDD-3 | `mobile scroll down hides header tags` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | mobile 390x844 | header-tags max-height → 0 | Unchanged → visible |
| TC-21 | A-BDD-4 | `mobile scroll up restores header tags` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | mobile 390x844 | header-tags returns | Same |
| TC-22 | A-BDD-5 | `desktop scroll has no header-tags effect` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | header-tags stays visible | Already visible (passes coincidentally) |
| TC-23 | A-BDD-6 | `body tags unaffected by header truncation` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | mobile 390x844 | Markdown-rendered tags fully displayed | Same (no feature yet) |

## Domain: diagram-error-ui (Playwright E2E)

| # | BDD | Test Name | File | Viewport | Expected (when implemented) | Current (RED) |
|---|-----|-----------|------|----------|----------------------------|----------------|
| TC-24 | C-BDD-1 | `mermaid error cleans #dmermaid-{id} SVG` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | No `#dmermaid-` element in DOM after render error | SVG still present |
| TC-25 | C-BDD-2 | `mermaid suppressErrors configured` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | `mermaid.initialize` called with `suppressErrors: true` | Not set (checked via init options) |
| TC-26 | C-BDD-3+5 | `error UI shows engine name collapsed details` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | `.diagram-error` contains engine name, collapsible details default hidden | Simple text error only |
| TC-27 | C-BDD-4 | `view source button switches to code mode` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | Clicking "查看源码" shows code mode | No button exists |
| TC-28 | C-BDD-6 | `error details expand shows truncated message` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | Clicking expand shows error text (≤200 chars) | No details |
| TC-29 | C-BDD-7 | `mermaid exportPng failure cleans error SVG` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | exportPng catch cleans `#dmermaid-` | Not implemented |
| TC-30 | C-BDD-8 | `plantuml error uses unified error UI` | e2e/t049-mobile-header-diagram-sanitize.spec.ts | desktop 1280x800 | PlantUML error shows `.diagram-error` with engine name | Auto-switches to code mode |

## Summary

- **Total test cases**: 30
- **Backend unit/integration**: 8 (TC-1~8)
- **Frontend vitest unit**: 9 (TC-9~17)
- **Playwright E2E**: 13 (TC-18~30)
- **All currently RED**: Yes — implementations not yet written
