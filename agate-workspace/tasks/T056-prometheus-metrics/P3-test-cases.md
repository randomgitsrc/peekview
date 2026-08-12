---
phase: P3
task_id: T056
type: test-cases
parent: P2-design.md
trace_id: T056-P3-20260717
status: approved
created: 2026-07-17
agent: test-designer
test_code_dir: backend/tests/
---

# T056 P3: Test Cases for Prometheus /metrics Endpoint

## Test Mapping to BDD

| Test Function | BDD | Description |
|---------------|-----|-------------|
| `test_metrics_endpoint_exists` | B1 | GET /metrics returns 200 |
| `test_metrics_content_type` | B1 | Content-Type starts with text/plain |
| `test_metrics_prometheus_format` | B1 | Body contains `http_requests_total{` |
| `test_metrics_bypasses_api_key_auth` | B2 | No auth header needed when API key is set |
| `test_metrics_bypasses_rate_limiter` | B3 | No 429 even under burst |
| `test_metrics_disabled_via_config` | B4 | PEEKVIEW_METRICS__ENABLED=false → 404 |
| `test_metrics_captures_request_data` | B5 | /health request appears in metrics |
| `test_metrics_not_spa_catchall` | B6 | /metrics returns text/plain, not HTML |

## Test Details

### test_metrics_endpoint_exists
- Send `GET /metrics` to test client
- Assert status == 200

### test_metrics_content_type
- Send `GET /metrics`
- Assert `response.headers["content-type"]` starts with `text/plain`

### test_metrics_prometheus_format
- Send `GET /metrics`
- Assert body contains `http_requests_total{`

### test_metrics_bypasses_api_key_auth
- Create app with `PEEKVIEW_SERVER__API_KEY` set to a non-empty value
- Send `GET /metrics` without any auth header
- Assert status == 200
- Assert body contains Prometheus metrics

### test_metrics_bypasses_rate_limiter
- Create app with rate limiting enabled and very low limit
- Send 5 rapid `GET /metrics` requests
- Assert none return 429

### test_metrics_disabled_via_config
- Create app with `PEEKVIEW_METRICS__ENABLED=false`
- Send `GET /metrics`
- Assert status == 404

### test_metrics_captures_request_data
- Send `GET /health` first
- Then send `GET /metrics`
- Assert metrics body contains `handler="/health"`

### test_metrics_not_spa_catchall
- Send `GET /metrics` with `Accept: text/html`
- Assert content-type starts with `text/plain` (not `text/html`)

## Fixture Requirements

- Reuse existing `app` and `client` fixtures from conftest.py
- New fixture: `app_with_api_key` — creates app with global API key set
- New fixture: `app_metrics_disabled` — creates app with metrics disabled
