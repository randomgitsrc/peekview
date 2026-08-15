
## P6 verifier 进度（2026-08-15）

- [x] 读 dispatch-context + verifier 角色 + P0/P1/P2/P3/P5 输入文件
- [x] :8888 在线（debug，seed 数据完整）；:8080 未响应（不触碰）
- [x] alice 登录 :8888 成功；创建 API key `pv_Pmn7q3PzIUYZfaH1mG0VGzccO5C4FEUz`（id=1）
- [x] 环境确认：:8888/:8889 均 health 200；:8080 不可达（不触碰）；API key pv_QLpdLuMqffSan5nYMqhDOhA8D9851mGR 有效（alice）
- [x] 数据确认：t094-p6-base64（含 base64 图片，raw 无 query 返回原样 base64）/ t094-p6-private（share=DZvZ8Gu_Td5D4Fut raw 200，无/坏 token 404）/ unicode-filenames（arch.png 等二进制 content=null）/ :8889 ext-public（hello.txt）/ ext-private-2 无 token 404
- [x] 阅读 MCP 源码：client.ts fetchEntryRaw（匿名、X-PeekView-Source、?purify=true、redirect manual、响应结构校验）/ getEntry.ts（ref+file 返回策略）/ entryRef.ts / purify.ts / publishFiles.ts Raw URL 行
- [ ] 写 P6-evidence/scripts 验收脚本（vitest 真后端实测）
- [x] 验收脚本写好并实跑：P6-evidence/scripts/verify-tpv0092.test.ts（vitest，真实 :8888/:8889 + 脚本内 mock 服务器）→ **28/28 PASS**（26 BDD + file:// 子断言 + raw_url 可读子断言），证据已落 P6-evidence/bdd-*.log + test-output.log
- [ ] 跑 make debug-test-mcp（P2 gate_commands.P6）
- [x] make debug-test-mcp（PEEKVIEW_API_KEY 已 export）：MCP 单元 268 passed + 集成全绿；前端 e2e 11 passed / 3 failed（均为 Mobile Chrome FileTree 渲染，TPV0092 未触碰前端，加 CDP 重跑仍失败 → 预存前端问题，已登记）
- [x] P6-acceptance.md 写入（26 BDD 全 PASS，frontmatter pass:26 fail:0 ui_affected:false）
- [x] gate 预检全过：check-p6-format.sh --fix ✓ / check-p6-evidence.sh exit 0 / check-p6-provenance.sh exit 0（仅 debug-test-mcp.log 无 EXIT_CODE 尾行的非阻塞提示——该命令实际 exit 2，如实不伪造）
- [x] 自检：26 条 BDD 结果行、证据文件全部存在、无 p6-bdd* 残留 entry、:8888/:8889 在线未动 → [PROD_NOT_TOUCHED]
