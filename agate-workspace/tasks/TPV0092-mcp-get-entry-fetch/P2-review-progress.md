# P2-review-progress — plan-eng-review

## 输入 1：dispatch-context（派发指引）— 已读
- 目标：按角色 6 维度评审 P2-design.md，只审不写
- 特别关注：SSRF 重定向跟随 / DNS rebinding；凭据隔离边界（URL 形态匿名）；净化正则；裸 slug 向后兼容
- 约束：status 初始 draft → 终态 approved/rejected；产出到 P2-review.md

## 输入 2：角色定义 plan-eng-review.md — 已读
- 评审维度：数据流/状态机/接口契约/错误边界/测试策略/技术债 + 多方案探索 + 实现就绪度 + P2 最小验证
- DEBT 条目若提"架构债"须用标准格式（template 已读）

## 输入 3：P2-design.md — 已读
- candidate_count=2（A 选定：MCP 解析+匿名直读 raw+后端补参数；B 备选：后端代理 fetch）
- 四字段齐全；gate_commands 含 P3/P5/P6；files_to_read 覆盖后端+MCP；minimal_validation result: confirmed
- 关键设计点：parseEntryRef 5 形态表、匿名 fetch 无 Bearer、净化双实现（后端主 + MCP 兜底）、返回策略表、raw ?share=/?purify= 分支

## 输入 4：P1-requirements.md — 已读
- 26 条 BDD（BDD-1~26），risk_level medium，domains [backend, mcp, security]
- 跨 host 匿名 fetch 不携带配置实例凭据（SUGGEST）、file= 参数、净化后端主实现、token 不落日志、超时

## 输入 5：P0-brief.md — 已读
- 核心需求：get_entry 接受任意 PeekView 链接；跨 host 只读公开+私有分享；SSRF=协议白名单+响应结构校验；净化；返回策略；publish_files raw_url
- known_risks：SSRF / token 在 URL / 净化正则 / 向后兼容 / 无测试

## 输入 6：getEntry.ts + client.ts — 已读
- getEntry.ts 现状：schema 仅 {slug}，返回元数据文本列表（无 content），调 getEntry 端点
- client.ts：request() 恒带 Bearer（L30），30s AbortController；无匿名 fetch 路径 → 需新增 fetchEntryRaw

## 输入 7：files.py raw 端点现状 — 已读
- resolve_entry_raw L352：global_key_auth 分支 + get_entry/_check_share_cookie 分支，构造 EntryRawResponse，files content 文本 / 二进制 content=None+file_url
- get_entry_raw L465：无 share/purify 参数 → 改动点确认
- raw_url 自引用用 request.base_url（L391）→ 与 publicUrl 分拆一致

## 输入 8：entries.py get_entry share 逻辑 — 已读
- L196-263：share 时先查 entry，public/owner/admin 直通 get_entry；否则 get_entry_with_share；失败 NotFoundError 404
- get_entry_with_share 返回 (EntryResponse, EntryShare) 或 None（entry_service.py:1019-1061）；public entry 直接返回 None（L1032）
- 注意：get_entry_with_share 对 public entry 返回 None → raw ?share= 分支须先 public/owner/admin 直通，再走 share 校验（对齐 entries.py 顺序），否则 public+share 会误 404 —— 设计 2.6 已写"或 public/owner/admin 直通（对齐 entries.py:196-263）"，需 P4 严格按顺序实现

## 输入 9：main.py raw 短链接 302 — 已读
- L526-528：raw_shortlink 用 RedirectResponse(url=f"/api/v1/entries/{slug}/raw", 302)，仅拼路径 → 丢弃 query → 设计 1 关键决策 1 成立（parseEntryRef 直连 API 不经 302）
- SPA catchall L585-614：/slug 页面链接返回 HTML（含 Link header），非 JSON → MCP 不能解析 HTML，须解析 slug 直连 raw —— 设计 minimal_validation 已确认

## 输入 10：share_service.py verify_share_token — 已读
- L188-232：sha256(token) 匹配、entry_id 校验、expires/max_views、view_count+1
- 语义确认：一次访问计数，与 get_entry 端点一致

## 输入 11：models.py EntryRawResponse/RawFileItem — 已读
- L527-549：字段结构确认，MCP EntryRawResponse 新类型对齐

## 输入 12：merge.ts / publishFiles.ts / types.ts / utils.ts — 已读
- publicUrl/peekviewUrl 双字段存在（merge.ts L35-36）；publishFiles.ts L539 Link 用 config.publicUrl → raw_url 同源可行
- utils.ts translateError：PeekViewApiError 401/403 特殊处理，其余 error.message —— 注意：匿名 fetch 错误若走 PeekViewApiError 会带 status 文本，token 不进入

## 发现汇总（初稿）
1. [非阻塞] SSRF 重定向跟随：设计 2.2 未声明 fetch 重定向策略；Node fetch 默认跟随重定向，可被 https→http 内网重定向绕过 http-仅-localhost 白名单。P0 主防线是响应结构校验（不泄露响应体），故非阻塞，但应加 redirect: manual/error 或跟随后校验最终 host
2. [非阻塞] DNS rebinding：URL hostname 白名单基于字面 hostname，DNS rebinding 可重定向到内网 IP；响应结构校验兜底（内网碰巧是 PeekView 才可读，P0 已接受）→ 非阻塞
3. [非阻塞] public+share 顺序：raw ?share= 分支必须先 public/owner/admin 直通（get_entry_with_share 对 public 返回 None），设计 2.6 已含，P4 需严格对齐 entries.py 顺序
4. [非阻塞] 凭据隔离边界：URL 形态一律匿名 → 配置实例自身页面链接读私有 entry 也读不了（须分享链接）——符合 BDD-5 分享链接读私有、BDD-7 私有无 token 不可读的预期；设计 2.2 明确，无矛盾
5. [非阻塞] 净化双实现正则漂移 → 建议 DEBT 条目（净化主实现后端，MCP 兜底仅老后端触发）
6. [非阻塞] get_entry_with_share 对 public entry 返回 None 已在上面 3 合并
7. [非阻塞] P6 real_urls 手动 uvicorn :8889 命令：注意 AGENTS.md 铁律 1 严禁 uvicorn 直接启动（仅 make debug 可用 :8888）；:8889 第二实例绕不开 make debug（dev-server.sh 硬编码 8888），P1 已 supplementable 声明 —— 手动 uvicorn 属 P1 既定异常，非设计问题；建议 P6 实际用 venv python 启动 :8889 且隔离数据目录

## 结论
- 6 维度逐项评估完毕，无阻塞问题；2 个安全注意点（重定向跟随/DNS rebinding）由响应结构校验兜底，建议 P4 加 redirect 处理
- status: approved（7 条非阻塞发现，0 阻塞）
