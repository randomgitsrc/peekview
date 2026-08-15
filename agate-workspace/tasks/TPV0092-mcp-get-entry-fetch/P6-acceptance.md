---
phase: P6
task_id: TPV0092-mcp-get-entry-fetch
type: acceptance
parent: P5-verification.md
trace_id: TPV0092-P6-20260815
status: draft
created: 2026-08-15
agent: verifier
# ── v2.0 机器汇总 ──
pass: 26
fail: 0
ui_affected: false
---

# P6 验收报告 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

## 验收方式

- **真实后端**：:8888（隔离 /tmp/peekview-debug/）+ :8889（第二实例 /tmp/peekview-debug-8889/，模拟外部 PeekView host）；严禁触碰 :8080/~/.peekview/ → `[PROD_NOT_TOUCHED]`
- **真实 MCP client**：`packages/mcp-server/src/client.ts`（`PeekViewClient.fetchEntryRaw` / `fetchEntryRawAuthenticated`）+ 真实 tool handler（`getEntry.ts` / `publishFiles.ts`），非 mock
- **非 PeekView mock**：验收脚本内 `127.0.0.1:0` 随机端口临时 http server（记录请求头 / 返回非 PeekView JSON / 挂起不响应），脚本结束自动 close（含 `closeAllConnections`），无残留
- 断言日志落 `P6-evidence/bdd-*.log`，汇总 `P6-evidence/test-output.log`（尾行 `EXIT_CODE: 0`）
- 验收脚本：`P6-evidence/scripts/verify-tpv0092.test.ts`（vitest，28 项检查 = 26 BDD + file:// 子断言 + raw_url 可读子断言，全部 PASS）

## BDD 逐条结果

- PASS BDD-1: get_entry 接受页面链接 `http://127.0.0.1:8888/yaml-docker-compose` 返回结构化 JSON（slug= yaml-docker-compose，文件 content_len=1810，成功非报错）(P6-evidence/bdd-01-05-url-forms.log, P6-evidence/test-output.log, P6-evidence/scripts/verify-tpv0092.test.ts, P6-evidence/scripts/vitest.p6.config.ts, P6-evidence/debug-test-mcp.log)
- PASS BDD-2: get_entry 接受 raw 长链接 `.../api/v1/entries/yaml-docker-compose/raw` 返回内容 content_len=1810，非"无法识别"错误 (P6-evidence/bdd-01-05-url-forms.log, P6-evidence/test-output.log)
- PASS BDD-3: get_entry 接受 raw 短链接 `.../yaml-docker-compose/raw`（不经 302 直连 raw API）返回 slug= yaml-docker-compose + 内容 1810 (P6-evidence/bdd-01-05-url-forms.log, P6-evidence/test-output.log)
- PASS BDD-4: get_entry 接受裸 slug `yaml-docker-compose`（配置实例 Bearer 认证路径）返回内容 1810，向后兼容现有 getEntry 调用方 (P6-evidence/bdd-01-05-url-forms.log, P6-evidence/test-output.log)
- PASS BDD-5: get_entry 接受分享链接 `.../t094-p6-private?share=DZvZ8Gu_Td5D4Fut` 解析并透传 share token，返回私有 entry 内容 `private share content` (P6-evidence/bdd-01-05-url-forms.log, P6-evidence/test-output.log)
- PASS BDD-6: 跨 host（:8889 外部实例）读取公开 entry `ext-public` 返回内容 `hello from external instance`，不受配置实例限制 (P6-evidence/bdd-06-08-cross-host.log, P6-evidence/test-output.log)
- PASS BDD-7: 跨 host 私有无 token `ext-private-2` 返回明确错误（isError=true + "无法读取"），不泄露 entry 内容 (P6-evidence/bdd-06-08-cross-host.log, P6-evidence/test-output.log)
- PASS BDD-8: 跨 host 请求不携带配置实例凭据——mock 服务器捕获到 `Authorization=null`、`X-PeekView-Source=mcp`，且返回内容成功 (P6-evidence/bdd-06-08-cross-host.log, P6-evidence/test-output.log)
- PASS BDD-9: 非 PeekView 响应（`{ok:true,data:"SUPERSECRETBODY"}`）被拒绝，错误含"无法识别为 PeekView entry"且不泄露响应体（无 SUPERSECRETBODY）(P6-evidence/bdd-09-11-ssrf.log, P6-evidence/test-output.log)
- PASS BDD-10: 非白名单协议请求前拒绝——`ftp://example.com/foo` 与 `file:///etc/passwd` 均返回"协议不支持：ftp/file"，未发起网络请求 (P6-evidence/bdd-09-11-ssrf.log, P6-evidence/test-output.log)
- PASS BDD-11: `http://` 非 localhost host 请求前拒绝——`http://example.com/foo` 返回"不支持的 host：http 仅允许 localhost/127.0.0.1" (P6-evidence/bdd-09-11-ssrf.log, P6-evidence/test-output.log)
- PASS BDD-12: 文本内 base64 图片替换为占位符并保留 alt——`t094-p6-base64` 内容含 `[image: alt text (...)`，base64 载荷 `iVBORw0KGgo...` 不出现，图片后文本保留 (P6-evidence/bdd-12-14-purify.log, P6-evidence/test-output.log)
- PASS BDD-13: 二进制文件保持 content=null——`unicode-filenames` 的 `arch.png` is_binary=true 且 content=null（不进上下文）(P6-evidence/bdd-12-14-purify.log, P6-evidence/test-output.log)
- PASS BDD-14: 无 base64 的普通文本原样返回——yaml-docker-compose 净化后内容与 raw（无 query）逐字符相等（1810=1810），未误伤 (P6-evidence/bdd-12-14-purify.log, P6-evidence/test-output.log)
- PASS BDD-15: 单文件 ≤200KB 返回全量内容——yaml-docker-compose content_len=1810，无 warning (P6-evidence/bdd-15-19-return-strategy.log, P6-evidence/test-output.log)
- PASS BDD-16: 单文件 >200KB（发布 210KB）返回全量内容 215040 字符 + 软警告"文件较大（>200KB），内容已完整返回" (P6-evidence/bdd-15-19-return-strategy.log, P6-evidence/test-output.log)
- PASS BDD-17: 多文件总量 ≤32KB（2×10KB）返回全部文件全量（len0=len1=10240），无 warning (P6-evidence/bdd-15-19-return-strategy.log, P6-evidence/test-output.log)
- PASS BDD-18: 多文件总量 >32KB（2×30KB）返回片段（≤2000 字符）+ 文本提示"可用 file= 取单个文件全量内容" (P6-evidence/bdd-15-19-return-strategy.log, P6-evidence/test-output.log)
- PASS BDD-19: `file=a.md` 取单个文件全量——仅返回 a.md（content_len=30720），不返回其他文件 (P6-evidence/bdd-15-19-return-strategy.log, P6-evidence/test-output.log)
- PASS BDD-20: publish_files 返回含 `Raw URL: http://127.0.0.1:8888/api/v1/entries/{slug}/raw`，且该 raw_url 可被 get_entry 直接读取（返回"hello raw url"内容）(P6-evidence/bdd-20-publish-raw-url.log, P6-evidence/test-output.log)
- PASS BDD-21: raw 端点 `?share=DZvZ8Gu_Td5D4Fut` 一次访问返回 200 + 内容 `private share content`，且无 Set-Cookie（无需两步设 cookie）(P6-evidence/bdd-21-24-backend-raw.log, P6-evidence/test-output.log)
- PASS BDD-22: raw 端点 `?share=BADTOKEN123` 返回 404（与 get_entry 端点 share 验证一致，不泄露 entry 存在性）(P6-evidence/bdd-21-24-backend-raw.log, P6-evidence/test-output.log)
- PASS BDD-23: raw 端点 `?purify=true` 剥离 base64——t094-p6-base64 内容含 `[image: alt text`，无 base64 载荷，响应体积由 459→431 字节（净化生效）(P6-evidence/bdd-21-24-backend-raw.log, P6-evidence/test-output.log)
- PASS BDD-24: raw 端点无 query 向后兼容——无参返回原样内容（仍含 base64 载荷），与改动前一致 (P6-evidence/bdd-21-24-backend-raw.log, P6-evidence/test-output.log)
- PASS BDD-25: 错误消息不打印 share token 明文——无效 token `SUPERSECRET_TOKEN_XYZ` 场景，错误含"无法读取"且不含 token 明文、不含含 token 的完整 URL (P6-evidence/bdd-25-token-redaction.log, P6-evidence/test-output.log)
- PASS BDD-26: fetch 超过超时阈值返回明确错误而非挂起——挂起 mock 服务器 1513ms 后 abort（`This operation was aborted`），未无限挂起 (P6-evidence/bdd-26-timeout.log, P6-evidence/test-output.log)

## gate 命令 debug-test-mcp 结果

执行：`PEEKVIEW_API_KEY=pv_QLpdLuMqffSan5nYMqhDOhA8D9851mGR make debug-test-mcp`（:8888 已在线，未启动/停止任何服务）。完整日志 `P6-evidence/debug-test-mcp.log`。

| 步骤 | 结果 |
|------|------|
| MCP 单元测试 `npm test` | ✅ 268 passed（17 files），含 entryRef/purify/getEntry/client 新契约全部用例 |
| MCP 集成测试 `test:integration`（PEEKVIEW_URL=:8888 + API key） | ✅ 通过（create_entry/get_entry/delete_entry/隔离；Bob 多用户用例按设计 skip，需 PEEKVIEW_API_KEY_BOB） |
| 前端 Playwright E2E `e2e/mcp-server.spec.ts` | ⚠️ 11 passed / **3 failed（均为 Mobile Chrome 项目 FileTree 渲染）** |

**3 个 e2e 失败归因（与 TPV0092 无关，预存前端问题）**：
- 失败用例：`should create multi-file entry with FileTree`、`should switch between files in FileTree`、`should expand/collapse directories in FileTree`，全部在 Mobile Chrome（Pixel 5 viewport）项目，`.file-tree` locator 恒为 0 元素；Desktop Chromium 项目对应用例全过。
- 归因证据：① TPV0092 P4 commit `f1b9f8f1` 未触碰 `frontend-v3/`（P2-design §0 明确"前端完全不动"）；② 加 `CDP_ENDPOINT=http://127.0.0.1:18800`（真实 Windows Chrome）重跑 Mobile Chrome 项目，同一 3 例仍失败（4 passed / 3 failed）→ 非本地无头浏览器模拟问题，是前端移动端 FileTree 渲染行为与 e2e 断言不符的预存问题；③ 失败 spec 自 v0.7.0（`6398e09f`）起未改。
- 结论：TPV0092 全部后端/MCP 改动经单元+集成+真实后端 BDD 实测通过；debug-test-mcp 的 3 个失败为预存前端移动端问题，不影响 TPV0092 验收结论，建议登记为技术债由前端任务跟进。

**Summary**: 26/26 PASS, 0 FAIL
