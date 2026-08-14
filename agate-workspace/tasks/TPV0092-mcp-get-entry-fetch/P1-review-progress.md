# TPV0092 P1-review progress — requirements-review

## 2026-08-15

### 1. 读完 dispatch-context-requirements-review.md
- 评审目标：24 BDD 可二值判定、隐含需求覆盖（尤其安全）、无掺入方案设计
- 评审重点：BDD-16 软警告、BDD-18 清单+片段、BDD-8 mock 服务器记录请求头、SSRF 双保险、share token 不泄露、超时限流、:8889 第二实例可行性
- 约束：只审不写，产出 P1-review.md，status 初始 draft

### 2. 读完 requirements-review.md 角色定义
- 检查清单：BDD 可二值判定 / 隐含需求覆盖（数据/前端/多端/边界/兼容）/ BDD 跨条一致性 / 裁剪合理性 / P1 纯净性
- 门槛产出：Header 含 status 字段，approved/rejected/needs-revision 映射

### 3. 读完 P1-requirements.md（评审对象，24 BDD）
- 结构完整：frontmatter 含 risk_level=medium / phases 全走 / packages=[backend, packages/mcp-server] / domains=[backend, mcp, security] / capability_requirements 4 项
- BDD 编号连续 `#### BDD-1` 至 `#### BDD-24`，无跳号，每条单一 Given/When/Then
- 隐含需求 2.1-2.6 分维度声明
- [NO_NEED_CONFIRM] + 5 条 SUGGEST

### 4. 读完 P0-brief.md
- 需求一致：get_entry 接受任意链接 / 跨 host / 结构化 JSON / SSRF 响应结构校验 / 净化 base64 保 alt / 返回策略 / publish_files raw_url / raw ?share= ?purify=
- P1-requirements 与 P0 各条一一对应，无偏离
- env_constraints：:8889 第二实例、shares API 创建分享

### 5. 读完 getEntry.ts
- 现实现只接受 `slug`（schema z.object({slug})），返回"元数据文本列表"（files 无 content）
- 确认根因：get_entry 端点 /api/v1/entries/{slug} 的 EntryResponse 不含文件 content → 必须切 raw 端点
- 无 `file` 参数 → 隐含 2.5 file 参数确需新增
- 无 URL 解析逻辑 → parseEntryRef 全新

### 6. 读完 client.ts
- `request()`（L27-32）恒带 `Authorization: Bearer ${userToken}` + `X-PeekView-Source: mcp`
- 确认跨 host 复用 request() 会把本实例凭据泄漏给外部 host → SUGGEST 1（匿名 fetch 路径）成立、必要
- 30s AbortController 超时机制已存在 → 隐含 2.4 超时"可复用现有机制"属实
- 但 request() 硬编码 baseUrl=配置实例 → 跨 host 需独立路径（P2 方案，P1 无需细节）

### 7. 读完 files.py（raw 端点 L352-471）
- `resolve_entry_raw`：share 仅支持 cookie（_check_share_cookie L379），无 `?share=` query 参数 → BDD-21/22 需求成立
- get_entry_raw 签名无 share/purify 参数 → 两者均需新增
- raw_url 自引用格式 L391：`{base}/api/v1/entries/{slug}/raw` → SUGGEST 5 格式与后端一致，属实
- EntryRawResponse/RawFileItem 结构已在 models.py:527-549，二进制 content=None + file_url，文本 content + content_encoding → BDD-13/2.1 依据属实
- **发现点（重要）**：raw 端点对"私有 entry + 无效/过期 share" 会先走 `service.get_entry`（无认证匿名时对私有 404）→ 现有 cookie 分支返回 404。BDD-22 要求 ?share= 无效也 404，与现有行为一致，可判定。

### 8. 读完 main.py（raw 短链接）
- L526-528：`/{slug}/raw` → 302 → `/api/v1/entries/{slug}/raw`，已存在 → BDD-3 依据属实
- 注意：302 重定向**不带 query string**（RedirectResponse 固定 url 无 query 拼接）→ 短链接 + ?share= 形态（`/{slug}/raw?share=x`）能否透传存在疑问。BDD-3 只测公开短链接，未覆盖"短链接+share"组合。若 MCP 先解析 URL 形态再直连（parseEntryRef 提取 slug+share 后拼 API URL），则不经 302，可规避。建议 P2 设计时确认 parseEntryRef 直连 vs 跟随重定向。

### 9. 读完 entries.py + shares.py + entry_service.py
- get_entry 端点支持 `?share=`（L182-263），无效 share → `get_entry_with_share` 返回 None → NotFoundError 404（entry_service.py:1046-1047）→ BDD-22 "与 get_entry 端点行为一致"属实
- shares API：POST /{slug}/shares 已存在（shares.py:18）→ capability share-creation = available 属实
- 分享 token 创建逻辑复用可行（share_service.create_share / verify_share_token 均在）

### 10. 读完 dev-server.sh + debug-workflow.md（:8889 第二实例可行性）
- dev-server.sh PORT=8888 硬编码，DATA_DIR=/tmp/peekview-debug 硬编码 → 手动起 :8889 需手工 uvicorn（PORT=8889 + 独立 DATA_DIR + PEEKVIEW_DEBUG_MODE=1）
- debug-workflow.md L88-95 有手动 uvicorn 启动示例 → capability p6-second-instance = supplementable 判定属实

### 11. 读完 publishFiles.ts
- L539 只返回 `Link: {publicUrl}/{slug}` 文本，无 raw_url → BDD-20 需求成立
- 注意：raw_url 需用 publicUrl（config.publicUrl）→ 与 BDD-20 Given"public_url 已配置"匹配

### 12. 检查净化现状
- 后端 backend/peekview 无任何 purify 实现，MCP src 无 purify/data:image 处理 → BDD-12/14/23 净化为全新逻辑，P3 不可跳属实
- capability purify-regex-tests = available 属实（无现成实现，需新建测试）

### 13. BDD 逐条判定（24 条全部可二值判定，2 条安全隐含缺 BDD 覆盖 → 结论倾向 needs-revision）
- BDD-1/2/3/4/5/6/7/9/10/11/12/13/14/15/16/17/18/19/20/21/22/23/24：均 Given/When/Then 可 PASS/FAIL 判定
- **缺口 1**：隐含 2.4「日志/中间件/错误消息不得打印完整 URL（只打 host/slug/有 token 标志）」无对应 BDD。BDD-5/21/22 只验证 share 读取/404 行为，未验证"错误消息不包含 token"→ dispatch-context 明确要求评估"share token 不泄露是否充分"，当前不充分
- **缺口 2**：隐含 2.4「跨 host fetch 必须有超时」无对应 BDD。现有 30s 超时机制可复用属实，但无行为验收项（挂起/超时返回明确错误）
- 其他候选补充（不构成打回）：短链接+share 组合（BDD-3 未覆盖）；跨 host 私有 entry 的 raw ?share= 直读（BDD-21 是配置实例场景，跨 host 分享 token 直读未独立成条——但 BDD-5+21 组合覆盖，非必须）

### 14. 覆盖维度标注（逐条）
- 数据：BDD-12/13/14/15/16/17/18/19/20/23/24 ✓
- 前端：无 UI 变化（2.2 声明，P6 无 ui_affected）——覆盖维度标注"无 UI 影响"
- 多端：BDD-4（裸 slug 兼容+切 raw 端点）/ BDD-20（publish_files raw_url）/ BDD-21/22/24（后端 raw 扩展）✓
- 安全：BDD-5/6/7/8/9/10/11/21/22 ✓ + 缺口 1/2
- 边界：BDD-1/2/3/5（URL 形态）/ BDD-13（二进制）/ BDD-16/18（阈值）✓
- 兼容：BDD-4（裸 slug 语义保留）/ BDD-24（raw 缺省向后兼容）✓

### 15. P1 纯净性
- SUGGEST 1（匿名 fetch 路径）：安全约束澄清，非方案细节——但"走独立匿名 fetch 路径"带实现方向色彩，仍属合法倾向（P0 已定响应结构校验，此为约束细化），可接受
- SUGGEST 2（file 参数）：需求级（新增入参），合法
- SUGGEST 3（净化由后端 ?purify= 实现 + MCP 兜底）：实现源选择——略有方案色彩但 P0 已定后端补 ?purify=，作为倾向声明可接受
- SUGGEST 4（日志格式）：安全需求细化，合法
- SUGGEST 5（raw_url 格式）：与后端 files.py:391 一致，合法
- 结论：无实质方案设计掺入，P1 纯净

### 16. 裁剪合理性
- risk_level=medium：与 SSRF + 跨端改动匹配（P0 同判）✓
- phases 全走 + P2/P3/P6/P7 不可裁理由均充分（跨端、零覆盖、真实 URL 实测、双包一致性）✓
- capability_requirements 4 项三态判定均经代码查证正确（supplementable=:8889、available=净化测试/SSRF 测试/share 创建）✓

### 17. BDD 跨条一致性
- BDD-22（404）与 get_entry 端点现有行为一致，无矛盾 ✓
- BDD-5/21 与 BDD-22 的 share 验证同源（share_service），无冲突 ✓
- 阈值边界（≤200KB vs >200KB、≤32KB vs >32KB）互斥，无重叠 ✓

### 18. 结论：needs-revision
- 24 条 BDD 全部可二值判定、编号连续、覆盖数据/前端/多端/安全/边界/兼容
- **打回理由（2 条安全隐含缺 BDD）**：
  1. 隐含 2.4「share token 不打印」无验收 BDD → 建议新增 BDD-25：错误消息/日志不含完整 URL 中的 share token
  2. 隐含 2.4「超时」无验收 BDD → 建议新增 BDD-26：跨 host fetch 超时返回明确错误而非挂起
- 其余全部通过（BDD 可判定性、覆盖、一致性、裁剪、纯净性、capability 三态）
