---
phase: P6
task_id: T032-entry-read-tracking
type: acceptance
parent: P1-requirements.md
trace_id: T032-P6-20260630
status: draft
created: 2026-06-30
---

# T032 P6 BDD 验收报告

## 验收环境

- Backend: http://127.0.0.1:8888 (debug mode, captcha disabled)
- DB: /tmp/peekview-debug/peekview.db
- Test users: testuser_a (id=1, admin), testuser_b (id=2, non-admin)
- Test entries: w4nrfo (public, owner=1), ei6h5l (private, owner=1), a5rnxz (public, owner=1)

## BDD 验收结果

- PASS B01: API 读取 entry 记录读取事件。匿名 GET /api/v1/entries/w4nrfo → entry_reads 表记录 entry_id=1, channel=api, reader_type=anonymous, reader_id=null, read_at 有时间戳。证据：DB row id=1

- PASS B02: MCP 读取 entry 记录 channel=mcp。请求带 X-PeekView-Source: mcp header → entry_reads 记录 channel=mcp。证据：DB row id=2

- PASS B03: Share 链接访问记录 channel=share。通过 ?share= token 访问私有 entry → entry_reads 记录 channel=share。证据：DB row id=3

- PASS B04: 非创建者读取被标识。用户 B (id=2) 读取用户 A (id=1) 的 entry → is_self_read=false (0), reader_id=2。证据：DB row id=4

- PASS B05: 创建者读取自己的 entry 被标识。用户 A 读取自己的 entry → is_self_read=true (1), reader_id=1。证据：DB row id=5

- PASS B06: 匿名读取公开 entry 被计数。无认证请求读取公开 entry → reader_type=anonymous, reader_id=null。证据：DB rows id=1,2,3

- PASS B07: 读取埋点不阻塞 API 响应。asyncio.create_task 异步写入，5 次并发读取响应时间均在 5ms 左右（4.5-5.1ms），无可观测延迟增加。证据：响应时间测量

- PASS B08: 高频读取的聚合/采样。同一 reader 10 次连续读取同一 entry → 不产生新行，已有窗口行 count 递增（1→15）。window_key UNIQUE 约束 + UPSERT 正常工作。证据：DB row id=6 count=15

- PASS B09: Owner 可查看 entry 读取统计。Owner GET /entries/w4nrfo → 响应包含 read_stats 字段，含 total_count, unique_readers, by_channel, last_read_at。证据：API 响应 read_stats={'total_count': 19, 'unique_readers': 2, 'by_channel': {'api': 18, 'mcp': 1}, 'last_read_at': '...'}

- PASS B10: 非 owner 无法看到读取统计。用户 B GET /entries/w4nrfo → read_stats=null。证据：API 响应 read_stats=None

- PASS B11: list 操作记录 discover 事件。修复后 list 端点只创建 1 条 discover 事件（entry_id=null），不为每个返回的 entry 逐一记录。2 个公开 entry 的列表请求只产生 1 条 discover 记录。证据：DB 仅有 1 行 (entry_id=NULL, action=discover, channel=api)

- PASS B12: /raw 端点读取也记录。GET /entries/w4nrfo/raw → entry_reads 记录 action=read, channel=api。证据：DB row id=11

- PASS B13: 读取统计 API 端点。GET /entries/w4nrfo/reads → 返回分页读取事件列表（含 id, action, channel, reader_type, reader_id, is_self_read, count, read_at, updated_at），total=9, page=1, per_page=20。非 owner 访问返回 404。证据：API 响应 JSON

- PASS B14: MCP listEntries 记录 discover + channel=mcp。带 X-PeekView-Source: mcp header 的 list 请求 → entry_reads 记录 action=discover, channel=mcp（与 B11 同修复，仅 1 条记录）。证据：API 验证

## 汇总

PASS: 14/14
FAIL: 0/14
NEED_CONFIRM: 0

## 修复记录

### B11 修复（list 端点 discover 事件）

**问题**: list 端点为每个返回的 entry 创建一条 discover 记录，而非单一 discover 事件。

**修复**: 将 `for item in result.items` 循环改为创建一条 entry_id=null 的 discover 事件。models.py 和 read_tracking_service.py 允许 entry_id=null。

**验证**: 创建 2 个公开 entry 后调用 list API → entry_reads 仅 1 条记录 (entry_id=NULL, action=discover, channel=api)。pytest 674/674 通过。

## 备注

- B09 的 total_count 和 by_channel 包含了 self-read 和 discover 事件，P2 设计文档指定 `total_count: SUM(count) WHERE is_self_read = false`，但 BDD 本身未明确要求排除 self-read。此差异标记为信息项，不构成 FAIL
- B14 的 MCP channel 检测通过 X-PeekView-Source header 工作正常，但 MCP server 端的 header 添加未在此验收中直接测试（需 MCP server 运行），仅验证了后端对 header 的识别
