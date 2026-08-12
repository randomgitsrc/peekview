---
phase: P1
task_id: T056
type: review
parent: P1-requirements.md
trace_id: T056-P1-review-20260717
status: approved
created: 2026-07-17
agent: requirements-review
---

# P1 Requirements Review: T056 Prometheus /metrics

## Review Checklist

| # | Criterion | Verdict | Notes |
|---|-----------|---------|-------|
| R1 | BDD conditions >= 1 | PASS | 6 BDD conditions (B1-B6) |
| R2 | domains declared | PASS | `metrics` |
| R3 | packages declared | PASS | `backend/peekview/` (main.py, config.py, pyproject.toml) |
| R4 | ui_affected declared | PASS | `none` |
| R5 | risk_level declared | PASS | `low` with justification |
| R6 | phases declared | PASS | P1-P6, P8 required; P7 skipped with justification |
| R7 | No [NEED_CONFIRM] markers | PASS | All implicit requirements resolved |
| R8 | Implicit requirements identified | PASS | 8 implicit requirements (I1-I8) covering auth bypass, rate limit bypass, SPA catch-all collision, config flag, dependency, initialization order |
| R9 | BDD conditions are testable | PASS | Each BDD has concrete Given/When/Then with observable outcomes (status codes, content patterns) |
| R10 | Pruning justification adequate | PASS | P7 skip justified (single-package); P2 simplified as follows_existing_pattern; P6 simplified as no_behavior_change |
| R11 | Scope matches P0-brief | PASS | P0-brief mentions `prometheus-fastapi-instrumentator`, 3-line integration, optional custom metrics; P1 scope covers the mandatory part |
| R12 | Config pattern consistent | PASS | PeekMetrics + PEEKVIEW_METRICS__ENABLED follows existing PeekServer/PeekAuth/PeekDiagram pattern |

## Observations

1. **Custom metrics (optional in P0-brief) correctly excluded from initial scope.** P0-brief marks custom Counter/Gauge for create_entry, FTS search, share verify as optional. P1 correctly scopes to the mandatory `Instrumentator` integration only. Custom metrics can be a separate task if needed.

2. **SPA catch-all collision (I7) is a real risk.** The `serve_spa_catchall` route `/{path:path}` in `_setup_static_files` would intercept `/metrics` if the instrumentator endpoint is registered after static file setup. The instrumentator's `expose()` must be called before `_setup_static_files(app)`, or the endpoint path must be explicitly excluded from the catch-all. B6 covers this case.

3. **Auth middleware bypass pattern (I1) is well-established.** The existing `api_key_auth` middleware already skips `/health` and other paths. Adding `/metrics` to the skip list follows the same pattern. B2 verifies this.

4. **Rate limiter bypass (I2) needs attention at the SlowAPI middleware level.** The global `SlowAPIMiddleware` wraps all routes. Unlike auth (which has explicit path skips), SlowAPI applies to all routes unless the route handler is decorated with `@limiter.exempt`. The instrumentator's exposed endpoint needs exemption. B3 covers this.

## Verdict

**APPROVED.** The requirements baseline is complete, testable, and consistent with the codebase architecture. All implicit requirements are identified and covered by BDD conditions. No [NEED_CONFIRM] markers remain.
