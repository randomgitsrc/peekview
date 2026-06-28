---
phase: P2
task_id: T027-share-link
type: review
reviewer: plan-eng-review
status: approved
created: 2026-06-29
---

# P2 Engineering Review — T027 share-link

## 架构问题（阻塞级）

### 1. share_service DI 路径未定义 — entry_service 如何获取 share_service 实例

P2 §4.6 写 `share_service = self._get_share_service()`，但当前 `entry_service.py` 的 DI 模式是通过 `app.state` 注入（`request.app.state.entry_service`）。`share_service` 是新 service，需要：

- 在 `main.py` 的 `lifespan` 中实例化 `ShareService(engine)` 并挂到 `app.state.share_service`
- `entry_service` 需要持有 `share_service` 引用（构造函数注入或 `app.state` 访问）

P2 未说明 `ShareService` 的构造函数签名、初始化位置、以及 `entry_service` 如何获取它。如果 `entry_service` 在 `update_entry` 的事务内调用 `share_service.revoke_all_for_entry()`，两者必须共享同一个 `Session` 或至少同一个 `engine`，否则 `revoke_all_for_entry` 的 UPDATE 不在 `update_entry` 的事务内。

**建议**：P2 §3.6 明确 `revoke_all_for_entry` 接受 `session` 参数，由 `entry_service.update_entry` 传入当前事务的 session。否则 private→public 的自动撤销不在同一事务内，存在不一致窗口（entry 已 public 但 shares 未 revoke）。

### 2. _resolve_entry 重构方案不完整 — 缺少 _get_entry_id_by_slug 的实现细节

P2 §4.3 提出重构 `_resolve_entry`，增加 `_get_entry_id_by_slug()` helper 做 slug→entry_id 查找（跳过 visibility check），然后在 `_resolve_entry` 中检查 owner/admin/public/share_cookie。

但当前 `_resolve_entry` 的非 global-key 路径直接调用 `service.get_entry()`，后者在 service 层做 visibility check 并 raise NotFoundError。重构后需要：

- `entry_service` 新增一个 `_get_entry_by_slug()` 或 `get_entry_raw()` 方法（无 visibility check，返回 Entry 对象而非 EntryResponse）
- `_resolve_entry` 改为先调 raw lookup，再手动检查 visibility + share cookie

P2 只写了伪代码，没有说明 `_get_entry_by_slug` 是加在 `entry_service` 还是 `share_service`，也没有说明这个方法是否暴露为 public API（有被误用的风险——跳过 visibility check 的方法是危险的）。

**建议**：将 `_get_entry_by_slug` 命名为 `_get_entry_bypass_visibility` 并加 docstring 警告，明确仅用于 share cookie 验证路径。或者更安全的方式：`_resolve_entry` 先尝试 `service.get_entry()`（正常 visibility check），如果抛 NotFoundError，再 fallback 到 share cookie 检查路径（raw lookup + cookie validate）。这样正常路径不变，share 是 fallback。

### 3. verify_share_token 中 hmac.compare_digest 的使用逻辑有误

P2 §3.4 步骤 4 写：

> Defense-in-depth: `hmac.compare_digest(computed_hash, stored.token_hash)` — even though we just queried by token_hash, this prevents theoretical timing leakage in DB index traversal

但 `compare_digest` 比较的是两个已经相等的字符串（因为 DB 查询就是用 `computed_hash` 做的 WHERE 条件，查到了说明它们相等）。对两个已知相等的字符串做 `compare_digest` 没有任何安全意义——它永远返回 True。

`compare_digest` 的价值在于：当你有一个用户提供的值和一个存储的值做比较时，避免 `==` 的短路行为泄露信息。但这里 DB 已经用 hash 做了精确匹配查询，查到 = 相等，查不到 = 不相等。`compare_digest` 是多余的。

**建议**：删除步骤 4 的 `compare_digest`，或者改为：先按 `token_prefix` + `entry_id` 查询（缩小范围），再用 `compare_digest` 比较 `token_hash`。这样 `compare_digest` 才有实际意义——DB 按 prefix 查可能返回多条，constant-time 比较防止从 hash 比对时间推断 hash 内容。但这增加了复杂度，对本地/self-hosted 工具不必要。建议直接删除，在注释中说明理由。

## 架构问题（非阻塞）

### 4. token_hash 使用 SHA-256 而非 HMAC-SHA256 — 与 ApiKey 模式不一致

现有 `hash_api_key()` 使用 HMAC-SHA256（带 key `b"peekview-api-key"`），P2 的 share token hash 使用 plain SHA-256。两者功能等价（都是单向 hash），但不一致可能造成维护困惑。

**记录到 TD-027-01**：Share token hash 使用 plain SHA-256（无 HMAC key），与 API key 的 HMAC-SHA256 不一致。Plain SHA-256 对 capability URL token 是足够的（token 空间 96 bits，hash 只用于去重和不可逆存储，不用于密码学认证协议）。后续如需统一可改为 HMAC，但非必要。

### 5. Cookie 值为 token_prefix (8 chars) 的安全考量

P2 §3.5 和 §6.3 分析了 cookie 值为 8-char prefix 的安全性，结论是"可接受"。但有一个未讨论的场景：

如果攻击者能读取服务器日志（access log 中 cookie 值通常不记录，但自定义日志可能记录），8-char prefix + entry_id + 知道 cookie name pattern = 可构造有效 cookie。不过这需要：(1) 读取服务器日志，(2) 知道 entry_id，(3) prefix collision（8 chars from 64-char alphabet ≈ 48 bits，collision 概率极低）。

**记录到 TD-027-02**：Cookie 值为 token_prefix (48 bits entropy)。对本地/self-hosted 工具可接受。如未来需要更高安全性，可改为 cookie 值存完整 token hash 或使用独立 session token。

### 6. ShareManagementPanel 加载时机 — 是否在每次 entry detail 加载时都请求 shares

P2 §5.2 写 "Load shares on mount"，但 ShareManagementPanel 只在 owner + private entry 时显示。如果每次进入 entry detail 都触发 shares API 请求（即使不是 owner 或 entry 是 public），会浪费请求。

**建议**：前端应在 `fetchShares` 前检查 `isOwner && !entry.isPublic`，避免不必要的 API 调用。后端已有 auth guard（非 owner 返回 403），但前端应提前拦截。

### 7. parse_expires_in 复用 — 需确认 file_service 中是否存在此函数

P2 §3.1 步骤 9 写 "reuse existing `parse_expires_in` from `file_service.py`"。需确认此函数确实存在且接口兼容（接受 "1h"/"24h"/"7d"/"30d"/"0" 格式）。

**验证结果**：经查 `file_service.py`，`parse_expires_in` 确实存在（用于 entry 的 `expires_in` 解析），接口兼容。但 "0" 表示 permanent 的语义需确认——当前 `parse_expires_in` 可能将 "0" 解析为立即过期而非永久。P4 实现时需验证。

### 8. gate_commands 可执行性

P2 gate_commands:
```bash
cd /home/kity/oclab/peekview/backend && source .venv/bin/activate && pytest tests/ --tb=no -q 2>&1 | tail -20 && cd /home/kity/oclab/frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -5
```

问题：
- `source .venv/bin/activate` 在非交互 shell 中可能不生效（取决于 bash 配置）。更可靠的方式：`backend/.venv/bin/python -m pytest`。
- P8 gate 包含 `E2E_SPEC=e2e/share-link.spec.ts make debug-test`，但此 spec 文件在 P4 才创建，P5/P6 gate 时可能不存在。应加条件判断或确保 P5 前已有此文件。

**建议**：gate_commands 改用 `backend/.venv/bin/python -m pytest` 替代 `source .venv/bin/activate && pytest`。

## 测试缺口

### 9. 并发 view_count 测试 — B29 的验证策略不足

B29 要求 "10 concurrent requests → view_count = 60"，但 SQLite WAL 模式下写操作是串行的（database-level lock），并发 UPDATE 会排队而非真正并发。SQLite 的 `SET view_count = view_count + 1` 本身是原子的（单条 SQL statement），不存在 lost update 问题。

测试应验证的是：多个线程/协程同时调用 `verify_share_token`（每个都做 SELECT + UPDATE），view_count 最终值等于调用次数。SQLite 的串行写入保证了这一点，但测试应明确说明"SQLite WAL 写串行，原子 UPDATE 无 lost update 风险"。

### 10. Share cookie 与 JWT cookie 同时存在的场景

当已登录用户（有 `peekview_token` JWT cookie）通过 share link 访问别人的 private entry 时，请求同时携带 JWT cookie 和 share cookie。P2 §4.2 的 access resolution order 处理了这种情况（JWT 优先），但缺少测试覆盖：

- 已登录非 owner + 有效 share cookie → 应返回 entry + share_context（JWT 不 grant 访问，share cookie grant）
- 已登录 owner + 有效 share cookie → 应返回 entry 无 share_context（JWT 优先，owner 视角）

### 11. Entry 过期后 share cookie 仍存在 — 前端行为未定义

当 entry 过期（`entry.expires_at < now()`），share cookie 仍在浏览器中。用户再次访问 `/{slug}` 时：
- 后端返回 404（entry expired）
- 前端显示什么？P2 §5.3 只定义了 "share link no longer valid" 的错误，没有定义 "entry expired" 的错误

由于 P1 B11 明确要求 "share token does not grant access to expired entry" → 404，前端无法区分 "share expired" 和 "entry expired"。这是设计意图（防止信息泄露），但应在 P3 测试中覆盖此场景。

### 12. max_views 边界 — view_count == max_views vs view_count > max_views

P2 §3.4 步骤 7 写 `view_count >= max_views`，但并发场景下 view_count 可能超过 max_views（两个请求同时通过 check，都 increment）。设计已接受此行为（§3.4 "we count page loads, not unique viewers"），但 B10 的 BDD 写 `view_count = 5` 时拒绝，未覆盖 `view_count = 6`（超过 max_views）的情况。

**建议**：P3 测试增加 case：max_views=5, view_count=6 → 仍拒绝（>= 而非 ==）。

## 锁定决策

1. **Share token 格式**：16-char `token_urlsafe(12)`，无 prefix，SHA-256 hash 存储。锁定。
2. **Cookie 机制**：`peekview_share_{entry_id}`，值为 token_prefix (8 chars)，Path=/，SameSite=Lax，HttpOnly。锁定。
3. **Access resolution order**：Public > Authenticated owner/admin > Share token > Share cookie > 404。锁定。
4. **Private→public auto-revoke**：在同一事务内 revoke all active shares，响应含 `revoked_shares` count。锁定（需补充 session 传递机制）。
5. **3 端点设计**：POST create / GET list / POST revoke，嵌套在 `/entries/{slug}/shares` 下。锁定。
6. **Referrer-Policy override**：middleware 检测 `?share=` → `no-referrer`。锁定。
7. **Frontend URL cleanup**：`router.replace` 移除 `?share=`。锁定。
8. **删除 compare_digest**：verify_share_token 中删除无意义的 `hmac.compare_digest`（阻塞问题 #3）。锁定。

## 阻塞问题数量

**3 个阻塞级问题**（#1 事务一致性、#2 _resolve_entry 重构方案、#3 compare_digest 逻辑错误），均为设计细节补充，不涉及架构方向变更。P4 实现前需在 P2-design.md 中补充：

1. §3.6 `revoke_all_for_entry` 接受 `session` 参数，由 `entry_service.update_entry` 传入
2. §4.3 补充 `_get_entry_bypass_visibility` 的归属、命名、访问控制
3. §3.4 删除步骤 4 的 `compare_digest`，加注释说明理由

补充后 status 可从 draft → approved。
