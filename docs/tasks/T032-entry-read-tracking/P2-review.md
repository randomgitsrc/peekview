---
status: approved
reviewer: plan-eng-review
trace_id: T032-P2-review-20260630
---

# P2 工程经理评审：T032 Entry 读取路径埋点

## 架构问题（阻塞级）

无。

## 架构问题（非阻塞）

### N01: select-then-update TOCTOU — 应直接用 raw SQL UPSERT

P2-design §3.2 用 select-then-update 而非 `INSERT ... ON CONFLICT(window_key) DO UPDATE`，理由是"SQLModel 的 ON CONFLICT 需要原始 SQL"。但 §3.2 自己也承认了 TOCTOU 风险并给出了更优方案。

**建议**：P4 直接实现 raw SQL UPSERT（方案已写在 §3.2 末尾），不走 select-then-update + retry。SQLite `ON CONFLICT` 是原子操作，彻底消除 TOCTOU；且 `window_key` UNIQUE 约束已声明，UPSERT 语法天然适配。select-then-update 的"极低概率"论证在 SQLite 单写者模型下虽然成立，但无必要冒这个险——代码复杂度反而更高（需 IntegrityError catch + retry）。

**记录到**：TD-T032-01（实现时优先用 raw SQL UPSERT）

### N02: `_record_read_async` 中同步 DB 调用会短暂阻塞 event loop

§3.4 承认 `service.record_read()` 是同步 DB 操作，在 `create_task` 的协程中执行会短暂阻塞 event loop。声称"SQLite WAL 下单行 UPSERT <1ms"。

**分析**：
- 正常情况下确实 <1ms，可接受。
- 但 `record_read` 每次开独立 `Session(self.engine)`，Session 创建 + 连接获取有开销。在 WAL busy_timeout 场景下（如后台有其他写操作），可能等待 up to 5s（默认 busy_timeout）。
- P2 已预留 `run_in_executor` 作为 fallback，这是合理的渐进策略。

**建议**：P4 先用 `create_task` + 同步调用，但 **P5 必须含 busy_timeout 下的性能测试**（模拟写锁竞争场景）。若不达标，立即改 `run_in_executor`。

**记录到**：TD-T032-02（P5 验证 busy_timeout 场景）

### N03: `reader_ip` 获取 — 反向代理场景需考虑

§3.2 `reader_ip=request.client.host`。在反向代理（nginx/Caddy）后，`request.client.host` 是代理 IP 而非真实客户端 IP。需读取 `X-Forwarded-For` 或 `X-Real-IP`。

**影响**：当前部署可能不经过反向代理（pipx 直接 `peekview serve`），但未来部署很可能加 nginx。anonymous fingerprint 基于 IP hash，代理 IP 会导致所有 anonymous 用户聚合为同一 fingerprint。

**建议**：P4 实现时用 `request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()` 或类似逻辑。不需要复杂的多 header 判断，但至少尊重 `X-Forwarded-For`。

**记录到**：TD-T032-03

### N04: `reader_fingerprint` 的 anonymous hash 可碰撞性

8 位 hex = 32 bit，约 4 billion 空间。Birthday paradox 下 ~65K 个不同 IP 即有 50% 碰撞概率。对当前规模（个人/小团队工具）可接受，但 long tail 会降低 `unique_readers` 精度。

**影响**：非阻塞。匿名 unique_readers 本身就是近似值（IP 不等于人），8 位 hash 是隐私-精度权衡的合理选择。增大到 12 位 hex（48 bit）可将碰撞阈值提升到 ~16M，代价可忽略。

**建议**：P4 实现时考虑 12 位 hex。不阻塞。

**记录到**：TD-T032-04

## 测试缺口

### T01: discover 事件的 entry_id 语义未明确

§5.1 `list_entries` 埋点 `action=discover`，但 `record_read` 需要 `entry_id`。list 操作返回多条 entry，discover 事件记录哪个 entry_id？

**分析**：从 §3.1 接口签名看，`record_read` 必须传 `entry_id`。但 list 操作的语义是"发现一批 entry"，不是"读取某个 entry"。P1 B11 说"记录一个 discover 事件（含查询参数），不为每个返回的 entry 逐一记录 read"。

**缺口**：P2 未设计 discover 事件的 entry_id 处理方案。选项：
- A) discover 事件 entry_id=NULL（需改表允许 NULL）
- B) discover 事件不记录 entry_id，单独记录查询参数
- C) discover 事件逐 entry 记录（与 P1 "不逐一记录"矛盾）

**建议**：选 A，`entry_id` 改为 nullable（`INTEGER` 而非 `INTEGER NOT NULL`），discover 事件 entry_id=NULL，查询参数存在 action/channel 旁的扩展字段。或更简单：discover 事件不进 `entry_reads` 表，单独一个轻量记录。**需在 P3 前明确**。

### T02: share cookie 路径的埋点入口不清晰

§5.1 说"share cookie 路径：`_check_share_cookie` 返回后，在 `cookie_result` 分支埋点，显式 channel=share"。但看实际代码（entries.py:221-223），`_check_share_cookie` 返回的是完整 `EntryResponse`，调用方直接 `return cookie_result`，没有 `entry_id` 的直接访问。

**缺口**：在 `cookie_result` 分支中，需要从 response 对象中提取 `entry_id` 和 `owner_id` 来调用 `record_read`。这不是技术障碍，但 P2 应明确：是从 `cookie_result.id` / `cookie_result.owner_id` 取值，还是在 `_check_share_cookie` 内部埋点？

**建议**：在 API 层（entries.py:222-223 之间）埋点，从 `cookie_result.id` 提取 entry_id。不在 `_check_share_cookie` 内部埋点（保持该函数职责单一）。

### T03: `get_entry_raw` 中 global API key 路径缺少 entry_owner_id

§5.1 说 `get_entry_raw` 需埋点。看实际代码（files.py:358-368），global API key 路径只从 DB 取了 entry 的基本字段，没有取 `owner_id`。`record_read` 需要 `entry_owner_id` 来计算 `is_self_read`。

**缺口**：global API key 路径需额外 SELECT `owner_id`，或从已有查询中补充。这是实现细节，不影响设计，但 P4 需注意。

### T04: 前端 `readStats` 展示对 mobile 的处理

§7.3 UI 展示用了 `class="entry-read-stats desktop-only"`，意味着移动端不展示。这是合理简化（移动端空间有限），但 P1 B09 的验收条件只说"owner 可查看"，未区分设备。

**建议**：P6 验收时移动端截图确认不展示 readStats，desktop 确认展示。不阻塞。

## 锁定决策

1. **存储方案**：`entry_reads` 表 + `window_key` UNIQUE 聚合 — 批准。1 分钟窗口 + UPSERT 是 SQLite 下写入频率和存储的合理平衡。`reader_fingerprint` 冗余列存储是好决定（避免 window_key 解析）。

2. **异步写入**：`asyncio.create_task` + 同步 DB 调用 — 批准，附条件（P5 必须验证 busy_timeout 场景，不达标则改 `run_in_executor`）。

3. **MCP 埋点**：`X-PeekView-Source: mcp` header — 批准。最小侵入，client 层一行改动，tool handler 不变。

4. **API 向后兼容**：`read_stats: ReadStatsResponse | None = None` — 批准。可选字段，默认 null，不破坏现有客户端。

5. **gate_commands**：可执行。P5 的 pytest + vue-tsc + mcp-unit 覆盖三个 package，P6 单独跑 read_tracking 测试文件是合理的冒烟验证。

6. **discover 事件 entry_id**：需在 P3 前明确（见 T01），不阻塞 P2 approval 但必须在 TDD 前解决。
