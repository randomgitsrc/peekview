# P1-progress — TPV0092-mcp-get-entry-fetch（analyst）

[PROD_NOT_TOUCHED]

## 2026-08-15 读输入文件记录

- 读 P0-brief.md：7 条核心需求已定稿。根因已查证：getEntry.ts 只认 slug；client.ts 单一 baseUrl；后端 raw 端点无 ?share=。known_risks 含 SSRF/分享 token 在 URL/净化正则/向后兼容/零测试覆盖。
- 读 getEntry.ts：schema 只接受 `slug: string min(1)`，返回文本列表（summary/slug/visibility/tags/created/expires/files 列表），**不含文件内容**。调用 `client.getEntry(slug)` → `/api/v1/entries/{slug}`（EntryResponse，files 无 content 字段）。
- 读 client.ts：单一 baseUrl；`request()` 恒带 `Authorization: Bearer {userToken}` + 30s 超时 + JSON content-type 校验。**无跨 host 能力**；`getEntry(slug)` 走 `/api/v1/entries/{slug}`（get_entry 端点，非 raw）。
- 读 publishFiles.ts：返回 `Link: {config.publicUrl}/{entry.slug}`，无 raw_url。需要加 raw_url（基于 public_url）。注意 publishFiles 默认 is_public=true，有 SecurityRejection 安全类拒绝。
- 读 files.py：`resolve_entry_raw`（L352）→ `/api/v1/entries/{slug}/raw` 返回 EntryRawResponse（slug/summary/tags/created_at/files + raw_url）。raw 内文件：文本 content=内容；二进制 content=None + file_url。**share 仅支持 cookie 形态**（`_check_share_cookie`），无 ?share= query 参数。URL 形态：`/{slug}/raw` 短链接（main.py:526 302 → /api/v1/entries/{slug}/raw）。
- 读 entries.py：get_entry 端点支持 `?share=`（L182-263）：share 存在时用 `service.get_entry_with_share(slug, share, share_service)` 验证（成功→设 cookie+返回 EntryResponse+share_context；无效→404）。**这是 raw 端点 ?share= 要复用的验证逻辑**。`_check_share_cookie` 是 cookie 形态的对照实现。
- 读 models.py：EntryRawResponse 含 slug/summary/files/raw_url；RawFileItem 含 content/content_encoding/file_url。SSRF 响应结构校验锚点字段：slug/summary/files（raw）或 id/slug/files（get_entry）。**raw 响应才是 MCP 要的"含文件内容"结构**——现有 getEntry 走 get_entry 端点拿不到 content，必须改走 raw。
- 读 share_service/entry_service：`get_entry_with_share` 返回 (EntryResponse, EntryShare)，None 表示验证失败。share token 有效性/过期/revoke 逻辑已存在，raw ?share= 直接复用。
- 读 main.py：`/{slug}/raw` → 302 RedirectResponse 到 /api/v1/entries/{slug}/raw（短链接形态已存在，MCP parseEntryRef 需支持）。
- 查证测试：getEntry 无现成单测；raw 端点测试在 backend/tests/test_raw_api.py（含 raw_url AC）；share 测试覆盖 get_entry ?share= 但不覆盖 raw ?share=。**零覆盖断言成立**。
- 确认 :8889 能力：dev-server.sh 硬编码 PORT=8888，无现成 :8889 启动脚本。P6 跨 host 需第二个实例（可手动 PORT=8889 + DATA_DIR=/tmp/peekview-debug2 起 uvicorn，或用 debug-workflow 手动命令），标记 supplementable。

## 隐含需求识别（逐维度）

- 数据：无 schema 变更；无迁移；MCP 端新增纯逻辑（URL 解析/净化/返回策略），后端 raw 仅加 query 参数。→ 无数据隐含依赖
- 前端：无 UI 变化（MCP + 后端 API 改动，无视觉）。→ 不标 frontend domain；P6 无 ui_affected 但有跨 host 实测
- 多端：**getEntry 返回结构从文本列表→结构化 JSON（含内容）** = 向后兼容行为变化（P0 已确认 agent 新会话可接受）；publish_files 加 raw_url；后端 raw ?share=/?purify=。→ backend + mcp 双端
- 安全（重要隐含）：跨 host 请求**不能发送配置实例的 userToken**（client.request 恒带 Bearer，会泄漏给外部 host）→ 跨 host 必须匿名或仅带分享 token；分享 token 在 URL 中，日志不打印完整 URL；SSRF 协议白名单（https，http 仅 localhost）+ 响应结构校验。
- 边界：URL 形态（页面/raw API 长链接/raw 短链接/分享链接/裸 slug）；share token 有/无；单文件/多文件；文件大小阈值（单文件 200KB 软警告、多文件 32KB）；base64 净化正则变体（data:image 大小写/空格/<img> 形式/alt 保留）；非 PeekView 响应拒绝且不泄露响应体。
- 兼容：get_entry 返回结构变化（已确认接受）；raw ?purify= 参数可选（缺省=现有行为）；raw ?share= 仅新增能力。MCP getEntry 需新方法（raw 读取），现有 getEntry 保留 slug 兼容。

## 能力评估

- P6 跨 host 实测需要第二个 debug 实例（:8889 模拟外部 PeekView）→ supplementable（dev-server.sh 无 PORT 参数，可手动起或按 debug-workflow 手动命令，隔离 /tmp/peekview-debug2）
- 净化正则鲁棒性测试、SSRF 响应校验测试 → available（pytest/单测即可）
- P6 私有分享创建：`POST /api/v1/entries/{slug}/shares` → available（后端已有）
## 完成状态
- P1-requirements.md 已落盘（24 条 BDD，domains: backend/mcp/security，risk_level: medium，全阶段 P1-P8）
- 无 [NEED_CONFIRM]，5 条 [SUGGEST]
- [PROD_NOT_TOUCHED]

## 2026-08-15 rev1 修订记录

- 读 P1-review.md：status=needs-revision，2 打回项（安全隐含缺口 1=share token 不打印、缺口 2=fetch 超时）。
- R1（BDD-25）：已新增「错误消息不打印 share token 明文」，Given/When/Then 采用评审建议文案，覆盖维度安全✓，对齐隐含 2.4「不得打印完整 URL」。
- R2（BDD-26）：已新增「fetch 超过超时阈值返回明确错误而非挂起」，覆盖维度安全✓边界✓，对齐隐含 2.4「超时与限流」，可复用 client.ts 30s AbortController。
- 2.4 安全节两处已加 `[REV1: 承接 BDD-25/26 验收]` 注释（不删原文）。
- 自检通过：BDD-1~BDD-26 编号连续（26 条）；frontmatter 机器字段未变（risk_level/phases/packages/domains/capability_requirements）；`[NO_NEED_CONFIRM]` 行首无反引号。
- [PROD_NOT_TOUCHED]
