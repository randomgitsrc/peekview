---
phase: P3
task_id: TPV0092-mcp-get-entry-fetch
type: test-cases
parent: P2-design.md
trace_id: TPV0092-P3-20260815
status: draft
created: 2026-08-15
agent: test-designer
---

# P3 测试用例清单 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

## test_code_dir 声明

```yaml
test_code_dir:
  backend: backend/tests/test_purify.py + backend/tests/test_raw_share_purify.py
  mcp: packages/mcp-server/tests/entryRef.test.ts
       + packages/mcp-server/tests/purify.test.ts
       + packages/mcp-server/tests/getEntry.test.ts
       + packages/mcp-server/tests/client.test.ts（扩展 fetchEntryRaw / fetchEntryRawAuthenticated describe）
       + packages/mcp-server/tests/publishFiles.test.ts（扩展 BDD-20 用例）
       + packages/mcp-server/tests/tools.test.ts（get_entry describe 改写为新契约）
  test_runner_registration: packages/mcp-server/package.json 的 test:unit 显式文件列表新增上述 3 个新文件
```

## 测试契约锚点（P4 必须遵循，驱动实现）

- **后端** `backend/peekview/services/purify.py`：`purify_content(content: str) -> str`。
- **后端** `backend/peekview/api/files.py::get_entry_raw`：新增 `share: str | None = Query(None, max_length=64)` 与 `purify: bool | None = Query(None)`。`?share=` 分支**先 public/owner/admin 直通，再 get_entry_with_share**（P2-review 注意点 2）；`?purify=true` 仅净化非二进制文本文件 content。
- **MCP** `src/lib/entryRef.ts`：`parseEntryRef(ref: string, config: { peekviewUrl: string })` → `{ kind: 'url' | 'slug', host: string, slug: string, shareToken?: string }`，失败抛 `EntryRefError`（继承 Error，message 以 `无法识别`/`协议不支持`/`不支持的 host` 开头）。
- **MCP** `src/lib/purify.ts`：`purifyContent(content: string) -> string`（与后端同规则兜底）。
- **MCP** `src/client.ts`：`fetchEntryRaw(host, slug, opts?: { shareToken?, timeoutMs? })`（匿名，无 Authorization，`X-PeekView-Source: mcp`，`?purify=true` 恒带）+ `fetchEntryRawAuthenticated(slug, userToken)`（复用 request() Bearer）。
- **MCP** `src/tools/getEntry.ts`：schema `{ ref: string, file?: string }`；输出 JSON 文本块 `{ slug, summary, tags, files:[{filename,path,is_binary,size,content|snippet|null}], warning: string|null }`。
- **MCP** `src/tools/publishFiles.ts`：`Link:` 行后追加 `Raw URL: {config.publicUrl}/api/v1/entries/{slug}/raw`。
- 允许 P4 工程化偏离：parseEntryRef 的 kind 细粒度（page/raw-long/raw-short 单列）可归一为 `'url'`；getEntryTool 签名可保持 `(client)` 单参（此时裸 slug 用 client 内部 baseUrl），测试按 `(client, config)` 调用运行时兼容。

## 净化共用样例（DEBT0004 closure_criteria — 双端同一组，契约锚点）

`SAMPLE.md`/`SAMPLE_TS` 以下字符串在后端 `test_purify.py` 与 MCP `purify.test.ts` **逐字相同**：

```text
MD_WITH_ALT   = '![alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=)'
IMG_NO_ALT    = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">'
IMG_WITH_ALT  = '<img alt="icon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">'
UPPERCASE     = '![logo](Data:IMAGE/jpeg;base64,QUJDREVGRw==)'
WS_VARIANT    = 'data: image/png;base64,QUJDREVGRw=='
PLAIN_TEXT    = 'plain text with no data:image inside'
```

断言模式（双端一致）：
- 含 data:image 的样例 → 输出含 `[image:` 占位符，且**不含**对应 base64 载荷串（如 `iVBORw0KGgoAAAANSUhEUgAAAAE=` / `QUJDREVGRw==`）。
- alt 保留：`MD_WITH_ALT` 占位符含 `alt text`；`IMG_WITH_ALT` 含 `icon`。
- 占位符形如 `[image: <alt> (<N> KB, base64)]`（KB 正则 `\d+(\.\d+)? KB`，不锁死格式化）。
- `PLAIN_TEXT` 原样返回（逐字符相等，不误伤）。

## 用例清单（26 BDD 1:1 映射 + P2-review 采纳项）

| # | BDD-NN | 测试文件 | 用例名 | 预期（P4 实现后） | P3 红灯原因（实现未写） |
|---|--------|---------|--------|------------------|------------------------|
| 1 | BDD-1 | mcp/entryRef.test.ts | 页面链接解析 | `{kind:'url',host:'https://host',slug:'my-slug'}` | 模块不存在 import 失败 |
| 2 | BDD-1 | mcp/getEntry.test.ts | handler(页面链接)→结构化 JSON 含 content | parsed.slug/summary + files[0].content 非空 | 现 handler 只认 {slug} → ZodError |
| 3 | BDD-2 | mcp/entryRef.test.ts | raw 长链接解析 | slug 正确提取（含 /api/v1/entries/ 前缀剥离） | 模块不存在 import 失败 |
| 4 | BDD-2 | mcp/getEntry.test.ts | handler(raw 长链接)→ JSON | parsed.files 含 content | ZodError |
| 5 | BDD-3 | mcp/entryRef.test.ts | raw 短链接解析（不经 302） | slug = path 去尾 /raw | 模块不存在 import 失败 |
| 6 | BDD-3 | mcp/getEntry.test.ts | handler(raw 短链接)→ JSON | 直连 raw API（mock 断言命中 raw 路径） | ZodError |
| 7 | BDD-4 | mcp/entryRef.test.ts | 裸 slug 解析 | `{kind:'slug',host:config.peekviewUrl}` | 模块不存在 import 失败 |
| 8 | BDD-4 | mcp/getEntry.test.ts | handler(裸 slug)→ JSON 且带 Bearer | parsed 含 content + mock 捕获 Authorization=Bearer | ZodError |
| 9 | BDD-5 | mcp/entryRef.test.ts | 分享链接 shareToken 提取 | shareToken='abc123' | 模块不存在 import 失败 |
| 10 | BDD-5 | mcp/getEntry.test.ts | handler(分享链接)→ 私有内容，query 含 share | mock 断言 searchParams.share===token + parsed 含 content | ZodError |
| 11 | BDD-6 | mcp/getEntry.test.ts | 跨 host 公开读（https://external.example.com） | parsed 含 content（非配置实例 host 成功） | ZodError |
| 12 | BDD-7 | mcp/getEntry.test.ts | 跨 host 私有无 token → 404 明确错误 | isError + 文案含 `无法读取` | 现文案不含 `无法读取` |
| 13 | BDD-8 | mcp/client.test.ts | fetchEntryRaw 无 Authorization（mock 捕获头） | Authorization 为 null + X-PeekView-Source=mcp | 方法不存在 TypeError |
| 14 | BDD-8 | mcp/getEntry.test.ts | URL 形态 handler 外部 host 请求无 Bearer | mock 捕获 Authorization 为 null | ZodError（未发请求） |
| 15 | BDD-9 | mcp/client.test.ts | 响应缺 slug/summary/files → 拒绝且不泄响应体 | rejects；message 含 `无法识别` 且不含响应体串 | 方法不存在 TypeError |
| 16 | BDD-10 | mcp/entryRef.test.ts | ftp:// file:// 请求前拒绝 | 抛 EntryRefError（协议不支持），未发请求 | 模块不存在 import 失败 |
| 17 | BDD-11 | mcp/entryRef.test.ts | http:// 非 localhost 拒绝 | 抛 EntryRefError，未发请求 | 模块不存在 import 失败 |
| 18 | BDD-12 | backend/test_purify.py | markdown base64 → 占位符保 alt | `[image:` + alt text，无 base64 载荷 | import peekview.services.purify 失败 |
| 19 | BDD-12 | mcp/purify.test.ts | 同上（共用样例） | 同上 | 模块不存在 import 失败 |
| 20 | BDD-13 | backend/test_raw_share_purify.py | 二进制 raw content=null 结构 | files[0].content is None + file_url 非空 | 现有行为已满足（回归守卫，绿） |
| 21 | BDD-13 | mcp/getEntry.test.ts | 二进制 content null 映射 | parsed.files[0].content === null | ZodError |
| 22 | BDD-14 | backend/test_purify.py | 无 data:image 原样返回 | 逐字符相等 | import 失败 |
| 23 | BDD-14 | mcp/purify.test.ts | 同上（共用样例） | 同上 | 模块不存在 import 失败 |
| 24 | BDD-15 | mcp/getEntry.test.ts | 单文件 ≤200KB 全量 | parsed.files[0].content 全量，无 warning | ZodError |
| 25 | BDD-16 | mcp/getEntry.test.ts | 单文件 >200KB 全量 + warning | content 全量 + warning 非空 | ZodError |
| 26 | BDD-17 | mcp/getEntry.test.ts | 多文件 ≤32KB 全部全量 | 所有 files[].content 全量 | ZodError |
| 27 | BDD-18 | mcp/getEntry.test.ts | 多文件 >32KB 清单+片段+file= 提示 | 内容为片段 + 文本含 `file=` 提示 | ZodError |
| 28 | BDD-19 | mcp/getEntry.test.ts | file= 匹配单个（path+filename 优先） | 仅该文件全量，其余 content null/缺省 | ZodError |
| 29 | BDD-19 | mcp/getEntry.test.ts | file= 无匹配 → 错误列可用文件 | isError + 列出可用文件名 | ZodError |
| 30 | BDD-19 | mcp/getEntry.test.ts | file= 多匹配 → 要求更精确 | isError + 提示更精确 | ZodError |
| 31 | BDD-20 | mcp/publishFiles.test.ts | publish_files 返回含 Raw URL | text 含 `Raw URL: {publicUrl}/api/v1/entries/{slug}/raw` | 现实现无该行 |
| 32 | BDD-21 | backend/test_raw_share_purify.py | raw ?share= 有效 token → 200 内容 | 200 + content 非空 + 无 cookie 副作用断言（响应无 Set-Cookie） | 现 ?share= 被忽略 → 404 |
| 33 | BDD-22 | backend/test_raw_share_purify.py | 同一流程：有效 200 后无效 token → 404 | 无效 token → 404（不泄露存在性） | 该断言在有效 token 断言之后，因前置断言红 |
| 34 | BDD-23 | backend/test_raw_share_purify.py | raw ?purify=true 剥离 base64 | content 含 `[image:` 无 base64，响应体积显著减小 | 现 ?purify= 被忽略 → 原样返回 |
| 35 | BDD-24 | backend/test_raw_share_purify.py | raw 无 query 向后兼容 | 与改动前一致（无净化、无 share） | 现有行为已满足（回归守卫，绿） |
| 36 | BDD-25 | mcp/getEntry.test.ts | 错误不打印 token / 完整 URL | isError + 不含 token 明文 + 不含完整 URL | 现文案不含 `无法`（前置断言红） |
| 37 | BDD-26 | mcp/client.test.ts | 挂起服务器 → 超时明确错误 | rejects（本地 http server 挂起 + timeoutMs 小） | 方法不存在 TypeError |
| 38 | P2-review | mcp/client.test.ts | 302 重定向拒绝（redirect 兜底） | mock 302→内网 URL（内网已 mock 返回合法 JSON）→ fetchEntryRaw 仍拒绝 | 方法不存在 TypeError |
| 39 | P2-review | mcp/entryRef.test.ts | http://localhost / 127.0.0.1 放行（白名单正向） | kind='url'，http 放行 | 模块不存在 import 失败 |
| 40 | P2-review | mcp/entryRef.test.ts | 无法识别路径（多段、含穿越）→ EntryRefError | 抛 EntryRefError | 模块不存在 import 失败 |

> 注：`#20`、`#35` 是**回归守卫**用例（现状已绿，P4 后仍须绿），用于防倒退，不是红灯驱动；其余全部为实现未写导致的红灯。`#33` 的 404 断言当前也绿（现状恰好 404），靠同文件前置的 `#32` 有效 token 200 断言保证整文件红灯（见红灯确认方式）。

## 红灯确认方式

1. 后端：`make test-quick`（`cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`）
   - `test_purify.py`：`ImportError: cannot import name 'purify_content' from 'peekview.services.purify'`（B 类：项目内 import 失败）
   - `test_raw_share_purify.py`：`#32` valid share → 断言 200 实际 404；`#34` purify → 断言占位符实际原样 base64（B 类：断言与未实现行为矛盾）
2. MCP：`make test-mcp-unit`（`cd packages/mcp-server && npm run test:unit`）
   - `entryRef.test.ts` / `purify.test.ts`：模块不存在 → vitest 加载失败（B 类）
   - `getEntry.test.ts` / `client.test.ts` 新增 describe：`client.fetchEntryRaw is not a function`（B 类）或 getEntry handler ZodError → 返回错误文本 ≠ 结构化 JSON（B 类）
   - `publishFiles.test.ts` BDD-20：断言 `Raw URL:` 实际不存在（B 类）
3. **非真红灯判定**：若某红灯失败原因是"断言与测试数据矛盾"（样例自身问题）→ 属测试代码 bug，先修正再交付。当前全部红灯均指向"被测模块/行为未实现"，判定为真红灯。

## 环境隔离声明

- 后端：conftest autouse `isolate_config_file`（tmp_path）+ 新文件自建临时 dir 的 client fixture，与现有 test_raw_api.py / test_share_create.py 同模式。未触碰 :8080 / ~/.peekview/。
- MCP：msw setupServer 拦截（现有先例）+ setup.ts 已隔离 HOME；BDD-26 用本地 `127.0.0.1` 临时 http server（挂起不响应），不访问外网。
- 状态标记：[PROD_NOT_TOUCHED]
