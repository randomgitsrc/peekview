---
phase: P2
task_id: T056
type: design
parent: P1-requirements.md
trace_id: T056-P2-20260717
status: approved
created: 2026-07-17
agent: architect
design_trivial: true
---

# T056 P2: Prometheus /metrics Endpoint Design

## packages

- `backend/peekview/` (main.py, config.py, pyproject.toml)

## domains

- `metrics`

## ui_affected

- none

## Candidate 1: prometheus-fastapi-instrumentator integration (ONLY candidate)

### Overview

Add `prometheus-fastapi-instrumentator` as a dependency. In `create_app()`, after app creation and before route registration, call `Instrumentator().instrument(app).expose(app)`. This auto-generates `/metrics` with request latency histograms, request counters, and error-rate counters. A new `PeekMetrics` config section with `enabled: bool = True` controls whether the endpoint is exposed.

### Integration Point

In `main.py:create_app()`, insert the instrumentator setup **after** the SlowAPIMiddleware is added (line ~366) and **before** the API route registration (line ~369). This ordering ensures:

1. The instrumentator middleware wraps all subsequent route handlers
2. The `/metrics` endpoint is registered before the SPA catch-all `/{path:path}`

### Auth Bypass

The `api_key_auth` middleware (lines 286-338) skips paths matching `/health`, `/assets`, `/`, and `/api/v1/auth`. Add `/metrics` to the skip list:

```python
if request.url.path == "/health" or request.url.path == "/metrics":
    return await call_next(request)
```

### Rate Limit Bypass

SlowAPI rate limiting is applied via `@limiter.limit()` decorators on individual route handlers. The `/metrics` endpoint is added by `instrumentator.expose()` and has no `@limiter.limit()` decorator, so it is inherently exempt from rate limiting. No code change needed for rate limit bypass.

### Security Headers Bypass

The `add_security_headers` middleware applies CSP/X-Frame-Options to API paths (`/api` prefix) and frontend paths. `/metrics` returns `text/plain` and is not a browser-facing endpoint. The middleware's `elif` branch (line 261) catches non-API, non-health paths and applies frontend CSP. Add `/metrics` to the skip condition:

```python
if path.startswith("/api") or path == "/health" or path == "/metrics":
```

This ensures `/metrics` gets only `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` (from the API branch), which is appropriate.

### Config: PeekMetrics

New settings class in `config.py`:

```python
class PeekMetrics(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PEEKVIEW_METRICS__",
        extra="ignore",
    )
    enabled: bool = Field(default=True, description="Enable Prometheus /metrics endpoint")
```

Add `metrics: PeekMetrics = Field(default_factory=PeekMetrics)` to `PeekConfig`.

### Conditional Exposure

In `create_app()`, only call `instrumentator.expose(app)` when `config.metrics.enabled` is `True`. When disabled, the instrumentator still instruments (middleware tracks metrics internally) but no endpoint is exposed.

### Custom Metrics (optional)

Add custom counters for key business operations using `prometheus_client` (pulled in transitively by `prometheus-fastapi-instrumentator`):

- `peekview_entries_created_total` (Counter) — incremented in `entry_service.create_entry()`
- `peekview_fts_searches_total` (Counter) — incremented in entry search path
- `peekview_share_verifications_total` (Counter) — incremented in share verify path

These are optional and can be added in a follow-up. The core deliverable is the instrumentator integration.

### Files to Modify

| File | Change |
|------|--------|
| `backend/pyproject.toml` | Add `prometheus-fastapi-instrumentator>=7.0.0` to dependencies |
| `backend/peekview/config.py` | Add `PeekMetrics` class + `metrics` field to `PeekConfig` |
| `backend/peekview/main.py` | Add instrumentator setup + auth/headers bypass for `/metrics` |

### files_to_read

- `backend/peekview/main.py` — integration point, middleware ordering
- `backend/peekview/config.py` — settings class pattern
- `backend/pyproject.toml` — dependency declaration
- `backend/tests/conftest.py` — test fixtures

### gate_commands

```yaml
P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
P5_lint: "cd backend && ruff check peekview/ tests/"
```

### minimal_validation

1. `GET /metrics` returns 200 with `text/plain` content type
2. `GET /metrics` body contains `http_requests_total{`
3. `GET /metrics` bypasses global API key auth
4. `PEEKVIEW_METRICS__ENABLED=false` → `GET /metrics` returns 404
5. All existing tests still pass
