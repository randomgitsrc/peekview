# 决策记录：Health Check 503 vs 200

> 日期：2026-06-11
> 背景：改善清单 #12，复审 health check 降级时返回 200 还是 503

---

## 结论

**保持现状：始终返回 200。** 不添加 `HEALTH_DEGRADED_STATUS` 配置项。

---

## 分析

### 两个阵营

| 论点 | 200（当前） | 503（业界标准） |
|------|-----------|----------------|
| 负载均衡器 | 单实例服务，没有健康节点可路由 | 有多个副本时，503 让流量切走 |
| Docker/systemd | 返回非 200 会重启容器，DB 瞬断不宜重启 | 让编排系统感知真实状态 |
| 监控 | body 里 `warnings` 数组可精细化区分故障 | 监控工具看状态码比解析 body 简单 |
| 降级可用性 | 服务部分可用（静态页、健康检查本身） | 告诉上游"这个节点不可用" |

### PeekView 为什么选择 200

1. **单实例服务**：没有"切到健康节点"的概念。DB 挂了返回 503，负载均衡器唯一能做的是返回 503 错误页——和返回 200 但 API 调用都失败，本质上一样烂。

2. **降级优于下线**：DB 故障时 `/health` 本身还能响应，静态页面还能渲染，用户能看到发生了什么。返回 503 把一切都关掉了。

3. **body 信息足够监控**：`{"status": "degraded", "warnings": ["database_error"]}` 可以被任何现代监控系统（Prometheus blackbox exporter、UptimeRobot keyword monitoring、Datadog）解析。说"body 难监控"是对 2026 年监控工具的误解。

4. **disk_space_low 返回 503 是错误**：磁盘低只是警告，服务仍完全正常。返回 503 会触发不必要的容器重启或流量切断。

---

## 不做的事

- 不加 `PEEKVIEW_SERVER__HEALTH_DEGRADED_STATUS` 配置项——没有人真正需要，单实例服务里 200 是正确的默认值。

---

## 相关

- `docs/specs/spec-security-hardening-20260523.md` §4 P0-3 Health Check 增强
- 改善清单 #12
