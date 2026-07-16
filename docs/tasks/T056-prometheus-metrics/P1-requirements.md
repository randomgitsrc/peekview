---
phase: P1
task_id: T056
type: requirements
parent: P0-brief.md
trace_id: T056-P1-20260717
status: draft
created: 2026-07-17
agent: analyst
---

# T056 P1: Prometheus /metrics Endpoint

## 1. Requirement Restatement

Add a Prometheus-compatible `/metrics` endpoint to the PeekView backend so that external monitoring systems (Grafana/Prometheus) can scrape request-level metrics. The integration uses `prometheus-fastapi-instrumentator` for automatic request latency histograms, request counters, and error-rate counters. A config flag allows disabling the endpoint.

## 2. Implicit Requirements

| # | Implicit Requirement | Rationale |
|---|---------------------|-----------|
| I1 | `/metrics` must bypass the global API key auth middleware | Prometheus scrapers cannot carry API keys; the `/health` endpoint already sets this precedent by skipping auth |
| I2 | `/metrics` must bypass the SlowAPI rate limiter | Prometheus scrapes at fixed intervals; rate-limiting the scraper would cause dropped metrics |
| I3 | `/metrics` must bypass the security-headers middleware (no CSP/X-Frame-Options needed) | Prometheus reads plain text, not a browser; security headers add no value and complicate response |
| I4 | Config flag to disable metrics endpoint | P0-brief lists "可配置关闭" as risk mitigation; deployment without Prometheus should not expose the endpoint |
| I5 | `prometheus-fastapi-instrumentator` must be added to `pyproject.toml` dependencies | New runtime dependency needs declaration |
| I6 | Instrumentator must be initialized after app creation but before route registration | FastAPI middleware ordering: instrumentator middleware must wrap all routes to capture metrics |
| I7 | `/metrics` endpoint path must not collide with SPA catch-all `/{path:path}` | The catch-all in `_setup_static_files` would swallow `/metrics` if registered after static files |
| I8 | Tests must verify the endpoint returns valid Prometheus exposition format | P0-brief specifies integration test validating format correctness |

## 3. BDD Acceptance Criteria

### B1: Metrics endpoint returns Prometheus format

```
Given the PeekView server is running with metrics enabled (default)
When  a GET request is sent to /metrics
Then  the response status is 200
  And the Content-Type header starts with "text/plain"
  And the body contains at least one line matching the pattern `http_requests_total{`
```

### B2: Metrics endpoint bypasses global API key auth

```
Given the PeekView server is running with PEEKVIEW_SERVER__API_KEY set to a non-empty value
  And no Authorization or X-API-Key header is provided
When  a GET request is sent to /metrics
Then  the response status is 200
  And the response body contains Prometheus metrics (not a 401 error)
```

### B3: Metrics endpoint bypasses rate limiter

```
Given the PeekView server is running with rate limiting enabled
When  more than rate_limit_per_minute GET requests are sent to /metrics in one minute
Then  none of the /metrics responses return status 429
```

### B4: Metrics can be disabled via config

```
Given the PeekView server is running with PEEKVIEW_METRICS__ENABLED=false
When  a GET request is sent to /metrics
Then  the response status is 404
```

### B5: Instrumentator captures request metrics

```
Given the PeekView server is running with metrics enabled
When  a GET request is sent to /health
  And then a GET request is sent to /metrics
Then  the /metrics response body contains `http_requests_total{method="GET",handler="/health"`
  And the /metrics response body contains `http_request_duration_seconds_bucket{method="GET",handler="/health"`
```

### B6: Metrics endpoint does not appear in SPA catch-all

```
Given the PeekView server is running with frontend static files
When  a GET request is sent to /metrics with Accept: text/html
Then  the response is not the SPA index.html
  And the response Content-Type starts with "text/plain"
```

## 4. Pending Confirmations

None. All implicit requirements resolved via codebase analysis.

## 5. Pruning Declaration

| Phase | Status | Justification |
|-------|--------|---------------|
| P1 | **Required** | Requirements baseline (this document) |
| P2 | **Required** (simplified) | `follows_existing_pattern` — `/health` endpoint + middleware bypass pattern is established; single candidate design |
| P3 | **Required** (simplified) | Integration tests only: endpoint exists + format valid + auth bypass. No complex TDD cycle needed for a 3-line integration + config flag |
| P4 | **Required** | Implementation |
| P5 | **Required** | Verify tests pass, lint clean |
| P6 | **Required** (simplified) | `no_behavior_change` — `curl /metrics` returns Prometheus format; `curl /metrics` with API key returns 200 |
| P7 | **Skipped** | Single-package backend change, no cross-file consistency risk beyond what P5 covers |
| P8 | **Required** | New dependency = version bump needed |

**single_agent_mode: true** (executor_env has_task_tool: false)

## 6. Scope Declaration

| Dimension | Value |
|-----------|-------|
| packages | `backend/peekview/` (main.py, config.py, pyproject.toml) |
| domains | `metrics` |
| ui_affected | none |
| risk_level | low |

**Risk justification**: The change adds a read-only monitoring endpoint. No data mutation, no schema change, no auth/permission modification (bypass follows `/health` precedent). The only new dependency is `prometheus-fastapi-instrumentator`, a well-maintained library with 1k+ GitHub stars.

## 7. Capability Requirements

| Capability | Required | Notes |
|------------|----------|-------|
| Python runtime | 3.10+ | Already satisfied |
| New dependency | `prometheus-fastapi-instrumentator>=7.0.0` | Must add to pyproject.toml |
| Config section | `PeekMetrics` | New settings class with `enabled: bool = True` |
| Env var | `PEEKVIEW_METRICS__ENABLED` | Follows existing `PEEKVIEW_*__*` pattern |
| Test framework | pytest + httpx | Already available |
