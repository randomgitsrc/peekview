# API v2 设计草案

> 状态：草稿 | 作者：Agent-arch-01 | 日期：2026-07-28

## 背景

当前 v1 API 基于 REST，满足基本发布/读取需求。v2 目标：

1. 支持 WebSocket 实时通知（entry 创建/更新/删除）
2. 批量操作端点（bulk create/delete）
3. 细粒度权限（scope-based API key）

## 端点变更

### 新增

- `POST /api/v2/entries/bulk` — 批量创建（最多 50 个/次）
- `DELETE /api/v2/entries/bulk` — 批量删除
- `WS /api/v2/events` — 实时事件流

### 变更

- `GET /api/v2/entries` 支持游标分页（`?cursor=xxx`），兼容 `?page` 旧参数
- API key 增加 `scopes` 字段：`entries:read` / `entries:write` / `admin`

## 兼容性策略

v1 端点保留至 v2.2，期间标记 `Deprecation` header。v2 与 v1 共用同一数据库，无 schema 破坏性变更。

## 待定问题

- [ ] WebSocket 鉴权方案（query param token vs subprotocol）
- [ ] 批量操作的事务粒度（全成功 vs 部分成功）
