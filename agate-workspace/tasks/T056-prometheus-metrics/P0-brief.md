---
phase: P0
task_id: T056
task_name: prometheus-metrics
type: brief
trace_id: T056-P0-20260714
created: 2026-07-14
status: draft
parent: 可观测性 — 无 Prometheus /metrics 端点
---

# T056: Prometheus /metrics 端点

## 任务简报

### 问题

项目零 metrics 代码、零 prometheus 依赖。只有 `/health` 做 liveness 检查，`admin stats` 返回业务快照（非时序）。无法接入 Grafana/Prometheus 监控体系。

### 方案

加 `prometheus-fastapi-instrumentator` 依赖，在 `create_app()` 中 3 行集成：
```python
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
```

自动获得：请求延迟（histogram）、请求数量（counter）、错误率（counter by status）。

可选：用 `prometheus-client` 在关键路径（create_entry、FTS search、share verify）加自定义 Counter/Gauge。

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 后端 `python3 -m ruff check` + `pytest` CI 强制

## executor_env

```yaml
platform: "claude-code"
has_task_tool: false
has_local_runtime: true
network: "full"
```

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| /metrics 端点被 auth 拦截 | Prometheus 无法抓取 | 绕过 auth 中间件和 rate limiter |
| metrics 端点增加攻击面 | 暴露内部指标 | 仅暴露聚合指标，无用户数据；可配置关闭 |

## 裁剪倾向

- P3（TDD）简化：集成测试验证端点存在且格式正确即可
- P6（验收）简化：curl 验证 /metrics 返回 Prometheus 格式
- P7（一致性）可裁剪：纯后端改动

## packages

- `backend/peekview/`：main.py（3 行集成）、pyproject.toml（加依赖）

## domains

- `metrics`：Prometheus 格式指标暴露
