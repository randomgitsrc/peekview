---
phase: P0
task_id: TPV0092
task_name: mcp-get-entry-fetch
trace_id: TPV0092
created: 2026-08-12
status: pending
parent: 用户产品讨论（agent 读 PeekView 链接的摩擦）
---

# P0-brief — T092 MCP get_entry 直接读取任意 PeekView 链接

## task

消除"agent 拿到 PeekView 链接却读不到"的摩擦：`get_entry` 扩展为**接受任意 PeekView URL（页面链接 / raw 链接 / 分享链接 / 裸 slug）→ 直接返回净化后的结构化内容**；`publish_files` 返回附带 `raw_url`。后端 raw 端点补 `?share=` 与 `?purify=` 支持。

## 现象（用户场景）

用户把 PeekView 链接发给 agent（可能是**非 MCP 配置实例**的链接，如 `https://xxx.com/xx100xx`、`https://xxx.com/xx123xx?share=xxxxx`），agent 尝试 `get_entry`/`list_entries` 查不到（MCP 只绑定配置实例 + 只认 slug），用户被迫纠正"直接用 web_fetch 访问那个地址"——摩擦。

## 核心需求（用户确认）

1. **get_entry 接受任意 PeekView 链接**：URL / raw 链接 / `?share=` 分享链接 / 裸 slug → 解析 host + slug → 直接读 → 返回内容
2. **跨 host 读取**：不限于配置实例（用户给的链接就是该读的）；**只支持公开 entry + 私有分享链接**（私有无 token 不读）
3. **返回统一结构化 JSON**（含文件内容，净化后）
4. **SSRF 防护**：不是 URL 白名单，是**响应结构校验**——请求后校验响应是否为 PeekView EntryRawResponse（含 slug/summary/files 字段），非 PeekView 响应 → 拒绝并返回"无法识别为 PeekView entry"
5. **内容净化**：文本内 base64 图片 → 占位符 `[image: 名 (N KB, base64)]`（保留 alt text），避免大 base64 串污染 agent 上下文；二进制文件保持 content=null
6. **返回策略**：单文件净化后全量（软警告 >200KB）；多文件总量 ≤32KB 全量，>32KB 清单+片段+`file=` 取单个
7. **publish_files 返回加 raw_url**（基于 public_url）

## 根因分析（已查证）

- `getEntry.ts` 只接受 `slug`，绑配置实例 `peekviewUrl`（client.ts 单一 baseUrl）
- 后端 raw 端点（`files.py:456`）**不支持 `?share=` 参数**——私有分享 entry 读 raw 只能走 get_entry 端点（支持 `?share=`，设 cookie）→ 两步；浏览器自动处理 cookie，MCP 不会 → 摩擦
- **关键修正**：后端 raw 端点补 `?share=` 支持（复用 get_entry 的 share 验证逻辑）→ 分享链接一次访问读 raw，与浏览器体验一致，MCP 无需 cookie 管理

## known_risks

- **SSRF**：接受任意 host URL 并 fetch——防护 = 协议白名单（https，http 仅 localhost）+ **响应结构校验**（非 PeekView JSON 拒绝，不泄露响应体）；内网中碰巧也是 PeekView 的实例可读（用户自己的 MCP 读自己内网 PeekView 是正常场景，非泄露）
- **私有分享 token 在 URL 中**：MCP 拼到 raw 请求 → 日志/中间件可能记录 token（需注意不打印完整 URL）
- **净化正则鲁棒性**：`data:image` 变体（大小写/空格/`<img>` 形式）需测试覆盖
- **向后兼容**：get_entry 返回从"文本列表"变"结构化 JSON"——老调用方行为变化（agent 都是新会话，可接受）
- **无现成测试覆盖**：parseEntryRef / 净化 / raw ?share= 均无测试 → P3 不可跳
- 不触碰生产 :8080 / ~/.peekview/

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，隔离）；跨 host 验收需第二个 debug 实例（:8889）模拟外部 PeekView；私有分享用 `POST /api/v1/entries/{slug}/shares` 创建"
lint: "make lint && make typecheck（CI 强制）；MCP: cd packages/mcp-server && npm run test:unit"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"

## 裁剪倾向

- P1：BDD 覆盖「get_entry 接受 URL/raw/分享链接/slug 各形态」「跨 host 读取公开 entry」「私有分享链接读取」「非 PeekView 响应拒绝」「净化 base64 保 alt」「单文件全量+软警告」「多文件清单+file=」「publish_files 返回 raw_url」
- P2：跨端改动（后端 raw + MCP client/tools），方案需明确（?share= 复用逻辑 / 净化位置 / 响应校验），不可单候选跳过
- P3：**不可跳**——零现成覆盖（parseEntryRef/净化/raw ?share= 测试）
- P5：后端 pytest 全量 + MCP 单测 + typecheck
- P6：**不可裁**——真实 URL 读取（需 :8889 外部实例）+ 净化效果 + 分享链接 + 非 PeekView 拒绝，实测
- P7：**不可裁**——跨后端 + MCP
- 风险：medium（涉及安全边界 SSRF + 跨端改动）

## 排期

TPV0092：独立，可随时启动。与 TPV0090/TPV0091 无依赖。
