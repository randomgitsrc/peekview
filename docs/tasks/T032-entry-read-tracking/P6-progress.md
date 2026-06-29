# T032 P6 Progress Log

## 2026-06-30T20:35Z — P6 验收开始

- 读取 P1-requirements.md (14 条 BDD)、P2-design.md (方案设计)、verifier.md (角色定义)
- 确认 debug backend 运行中 (:8888)，entry_reads 表存在
- 创建测试用户: testuser_a (id=1, admin), testuser_b (id=2, non-admin)
- 创建测试 entries: w4nrfo (public, owner=1), ei6h5l (private, owner=1), a5rnxz (public, owner=1)

## 2026-06-30T20:36Z — BDD 逐条验证完成

- B01 PASS: API 读取记录 channel=api, reader_type=anonymous
- B02 PASS: X-PeekView-Source: mcp header → channel=mcp
- B03 PASS: ?share= token 访问 → channel=share
- B04 PASS: 非创建者读取 → is_self_read=false, reader_id=B
- B05 PASS: 创建者自读 → is_self_read=true, reader_id=A
- B06 PASS: 匿名读取 → reader_type=anonymous, reader_id=null
- B07 PASS: 响应时间 ~5ms，无阻塞
- B08 PASS: 高频读取窗口聚合，count 递增而非新增行
- B09 PASS: Owner 可见 read_stats (total_count, unique_readers, by_channel, last_read_at)
- B10 PASS: 非 owner read_stats=null
- B11 FAIL: list 为每个 entry 创建 discover 记录，而非记录单一 discover 事件
- B12 PASS: /raw 端点记录 action=read, channel=api
- B13 PASS: /reads 端点返回分页事件列表，非 owner 404
- B14 PASS: MCP list → action=discover, channel=mcp (但同 B11 多条记录问题)

## 2026-06-30T20:37Z — 产出文件写入

- P6-acceptance.md 已写入
- P6-evidence/test-output.log 已写入
