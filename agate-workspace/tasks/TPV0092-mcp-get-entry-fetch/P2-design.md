---
phase: P2
task_id: TPV0092-mcp-get-entry-fetch
type: design
parent: P1-requirements.md
trace_id: TPV0092-P2-20260815
status: draft
created: 2026-08-15
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2
packages: [backend, packages/mcp-server]
domains: [backend, mcp, security]
ui_affected: false
---

# P2 方案设计 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

## 0. 影响域分析

### 改什么

**后端（backend）**
- `backend/peekview/api/files.py`：raw 端点 `get_entry_raw`（L465）增加 `share`/`purify` 两个可选 query 参数；`resolve_entry_raw`（L352）增加 share 验证分支（复用 get_entry 端点 share 逻辑）+ purify 净化后段。
- `backend/peekview/services/purify.py`（**新增**）：`purify_content(content)` 纯函数，base64 图片 → 占位符。
- `backend/peekview/services/entry_service.py`：暴露/复用 `get_entry_with_share`（L1019，已存在，无需改动）。

**MCP（packages/mcp-server）**
- `src/tools/getEntry.ts`：schema 从 `{slug}` 改为 `{ref, file?}`；handler 重写为 parseEntryRef → 匿名直读 raw → 净化 → 返回策略 → 结构化 JSON。
- `src/lib/entryRef.ts`（**新增**）：`parseEntryRef(ref, config)` URL 形态解析 + 协议/本地 host 白名单校验。
- `src/lib/purify.ts`（**新增**）：MCP 侧净化兜底（后端不支持 ?purify= 时）。
- `src/client.ts`：新增 `fetchEntryRaw`（匿名 fetch，不注入 Bearer）+ `fetchEntryRawAuthenticated`（裸 slug 用配置实例 Bearer）。
- `src/types.ts`：新增 `EntryRawResponse`/`RawFileItem` TS 类型。
- `src/tools/publishFiles.ts`：返回文本追加 `Raw URL: {publicUrl}/api/v1/entries/{slug}/raw`（L539 附近）。

### 不改什么

- 后端 `get_entry` 端点（`api/entries.py`）行为不改——raw ?share= 只是**复用**其验证逻辑，不修改端点本体。
- 后端 EntryRawResponse/RawFileItem 模型不改（P1 已确认无 schema 变更）。
- 后端 `_check_share_cookie` cookie 兜底路径不改（raw 无 ?share= 时的向后兼容，BDD-24）。
- MCP `list_entries`/`delete_entry`/`create_entry` 不改。
- 前端 `frontend-v3/` 完全不动。

### 风险在哪

- **净化双实现（后端 + MCP 兜底）正则漂移**：主实现单点在后端，MCP 兜底仅在"后端老版本不支持 ?purify="时触发。测试覆盖两套正则（BDD-12/14 后端，MCP 兜底单测）。
- **匿名 fetch 影响裸 slug 的私有读取**：裸 slug 走配置实例 Bearer（可读自己的私有 entry）；URL 形态走匿名（私有无 share → 404，符合 BDD-7）。规则必须写死，防 host 判定绕过注入凭据（BDD-8）。
- **share token 泄露**：错误消息/日志只输出 host+slug+"有 token"标志（BDD-25），fetch URL 构造不落日志。
- **SSRF**：协议白名单 + 响应结构校验（BDD-9/10/11），非 PeekView 响应不泄露响应体。

## 1. 候选方案

### 候选方案 A（选定）：MCP 端解析 + 匿名直读 raw + 后端补参数

**核心思路**：所有 URL 形态在 MCP 侧解析出 `{host, slug, shareToken?}` → 构造 `{host}/api/v1/entries/{slug}/raw?purify=true[&share=token]` 直接匿名 GET。后端只补 `?share=`/`?purify=` 两个可选参数。

**关键决策**：
1. **parseEntryRef 直连 API，不经 302**（P1-review 附注必答）：raw 短链接 `/{slug}/raw` 的 302（`main.py:528`）`RedirectResponse` 只拼路径、丢弃 query（已 curl 验证）。故 parseEntryRef 从 URL 直接提取 slug，构造 `{host}/api/v1/entries/{slug}/raw`，绝不依赖 302。share 参数由 MCP 自己拼接 query。
2. **raw_url 一致性**（P1-review 附注必答）：`publish_files` 的 raw_url 用 `config.publicUrl`（对外可访问地址，与现有 `Link:` 同源，BDD-20 断言 `{public_url}/api/v1/entries/{slug}/raw`）；后端 raw 响应自引用 raw_url 保持 `request.base_url`（`files.py:391`，BDD-24 向后兼容）。开发环境 publicUrl≠base_url 是有意的：publish_files 面向 agent 对外分享，raw 自引用面向当前请求。P6 测试时 MCP 的 publicUrl 指向 :8889 实例即可闭环。
3. **凭据隔离**：`fetchEntryRaw` 是独立匿名 fetch（无 Authorization header，仅 `X-PeekView-Source: mcp`）；裸 slug 才走 `fetchEntryRawAuthenticated`（配置实例 Bearer）。URL 形态一律匿名。
4. **净化主实现后端**（P1 SUGGEST 3）：MCP 请求总带 `?purify=true`；响应后若仍含 `data:image`（老后端），用 MCP 本地 `purify.ts` 兜底。

**权衡（优点/风险/工作量）**：
- 优点：MCP 保有读取自主权（不依赖 config 实例后端的外网 egress）；无新增后端端点/认证面；凭据边界最清晰（匿名字面不携带）。
- 风险：净化双实现可能漂移（兜底触发面小，可接受）；MCP 需要维护 URL 解析逻辑（测试覆盖 5 种形态）。
- 工作量：后端 ~60 行（两个 query 参数 + share 分支 + purify 调用）+ MCP ~350 行（entryRef + purify + getEntry 重写 + client 方法）。

### 候选方案 B（备选）：后端代理 fetch（config 实例代读）

**核心思路**：MCP 不做跨 host fetch。新增后端端点 `GET /api/v1/fetch?url=...`（或扩展 raw），后端用 Python（httpx/urllib）代 MCP fetch 外部 URL → SSRF 校验 → 响应校验 → 净化 → 返回。MCP 变成薄壳，把用户 URL 传给自己的 config 实例。

**权衡（优点/风险/工作量）**：
- 优点：净化/SSRF/响应校验单实现点（Python）；MCP 代码量最小；不重复实现正则。
- 风险：**新增后端开放端点 = 新 SSRF 攻击面 + 认证设计**（config 实例被当代理滥用）；config 实例后端必须能访问外部网络（很多部署内网封闭）；凭据边界反而模糊（config 实例持有所有 key）；与 P0/P1 既定方向"跨 host 匿名、不依赖 config 实例"相悖。
- 工作量：后端 ~150 行（新端点 + SSRF + 认证）+ MCP ~50 行。

### 选择理由

选 A。理由：
1. **安全边界**：B 新增后端开放 fetch 端点，把 SSRF 面从"单个 MCP 进程"扩大到"config 实例公网服务"，且需为它单独设计认证；A 保持 MCP 进程内 fetch，凭据根本不进入外部请求。
2. **P0/P1 既定**：P0 明确"跨 host 匿名读取，MCP 走独立 fetch 路径"，B 直接推翻已批准的需求基线方向。
3. **依赖正交**：B 依赖 config 实例后端有外网 egress；A 只依赖运行 MCP 的机器可访问目标 host（通常就是 agent 宿主）。
4. **工作量/风险不占优**：B 后端新增面 > A 的 MCP 端逻辑，且测试更难（后端要 mock 外部 URL）。

## 2. 详细设计（按 A 展开）

### 2.1 parseEntryRef（`src/lib/entryRef.ts` 新增）

输入 `ref: string`（任意形态），输出 `{ kind, host, slug, shareToken? }` 或抛 `EntryRefError`。

| 形态 | 示例 | 解析规则 |
|------|------|---------|
| 页面链接 | `https://host/{slug}` | path 无 `/api/v1/entries/` 前缀、无 `/raw` 后缀 → slug = path 首段 |
| raw 长链接 | `https://host/api/v1/entries/{slug}/raw` | path 匹配 `/api/v1/entries/{slug}/raw` |
| raw 短链接 | `https://host/{slug}/raw` | path 以 `/raw` 结尾（非 `/api/`）→ slug = path 去尾 `/raw` |
| 分享链接 | `https://host/{slug}?share={token}` | 上述任一形态 + query `share` 提取 |
| 裸 slug | `my-slug` | 无 `://` 且非 URL → kind=slug，用配置实例 |

规则细化：
- 协议白名单（BDD-10/11）：`new URL(ref)` 解析，`https:` 任意 host 放行；`http:` 仅 hostname ∈ {localhost, 127.0.0.1, ::1}；`ftp:`/`file:` 等其余 → 抛"协议不支持"错误（请求前拒绝）。
- 裸 slug 判定：不含 `://` 且不含 `/` 且非空白 → 配置实例。
- 含 token：query `share` 提取为 shareToken，但**请求 URL 构造时只拼 query 不进日志**（BDD-25）。
- 无法识别（如 path 多段、含路径穿越字符）→ 抛"无法识别为 PeekView 链接"。

### 2.2 匿名 fetch（`src/client.ts` 新增方法）

```
fetchEntryRaw(host, slug, { shareToken?, timeoutMs=30000 }): Promise<EntryRawResponse>
fetchEntryRawAuthenticated(slug, userToken): Promise<EntryRawResponse>  // 裸 slug
```

- `fetchEntryRaw`：`fetch(`${host}/api/v1/entries/${slug}/raw?purify=true${shareToken ? `&share=${shareToken}` : ''}`)`，headers 仅 `X-PeekView-Source: mcp`，**无 Authorization**（BDD-8）。AbortController 30s 超时（复用现有模式，BDD-26）。
- **响应结构校验**（BDD-9）：`res.ok` + `content-type: application/json` + body 解析为对象且含非空 `slug`/`summary`/`files[]` → 通过；否则抛"无法识别为 PeekView entry（host=..., slug=...）"，**响应体不进入错误消息**。
- 私有无 token → raw 404 → 抛 `PeekViewApiError(404)`，handler 翻译为"无法读取（私有 entry，需分享链接）"。
- `fetchEntryRawAuthenticated`：复用现有 `request()`（带 Bearer），仅用于裸 slug 且 host=配置实例。

### 2.3 净化（后端主 + MCP 兜底）

**后端 `services/purify.py`（新增）**：
- `purify_content(content: str) -> str`：正则匹配 base64 图片，替换为 `[image: {alt} ({kb} KB, base64)]`。
- 覆盖变体（P1 净化鲁棒性）：
  - Markdown：`![alt](data:image/...;base64,XXXXX)`
  - HTML：`<img alt="..." src="data:image/...;base64,XXXXX">` 与 `<img src="data:image/...;base64,XXXXX">`（无 alt → 空 alt）
  - data URI 大小写：`Data:IMAGE`, 空白变体 `data: image/...`
  - 占位符保留 alt text；KB 从 base64 串长估算（`len*3/4/1024`）。
  - 普通文本（无 data:image）原样返回（BDD-14 不误伤）。
- `resolve_entry_raw` 中：`if purify: f.content = purify_content(f.content)`（仅对非二进制文本文件；二进制 content=None 跳过）。

**MCP `src/lib/purify.ts`（新增）**：同规则兜底。仅当后端响应内容仍含 `data:image` 时触发（老后端不支持 ?purify=）。

### 2.4 getEntry 返回策略（`src/tools/getEntry.ts` 重写）

schema：`{ ref: string, file?: string }`。

获取后按文件数/大小分派：

| 场景 | 返回 |
|------|------|
| 单文件 ≤200KB | 全量内容 |
| 单文件 >200KB | 全量 + `warning: "文件较大（>200KB）"`（BDD-16） |
| 多文件总量 ≤32KB | 全部全量（BDD-17） |
| 多文件总量 >32KB | 清单（文件名/大小）+ 每文件片段（前 2000 字符）+ 提示 `file=` 取单个（BDD-18） |
| `file=` 传入 | 匹配文件名（`filename` 或 `path/filename`）返回该文件全量（BDD-19） |

输出统一结构化 JSON 文本块：
```json
{
  "slug": "...", "summary": "...", "tags": [...],
  "files": [{ "filename": "...", "path": "...", "is_binary": false, "size": N, "content": "..." | "...<snippet>…" | null }],
  "warning": "..." | null
}
```
- 二进制文件 `content: null`（BDD-13）。
- `file=` 匹配：优先 `path + '/' + filename` 完整匹配，次之 `filename` 匹配；无匹配 → 错误列出可用文件；多匹配 → 错误要求更精确。

### 2.5 publish_files 返回 raw_url（`src/tools/publishFiles.ts`）

`Link:` 行后追加 `Raw URL: {config.publicUrl}/api/v1/entries/{slug}/raw`（BDD-20）。用 `config.publicUrl`（对外地址），与现有 Link 同源。

### 2.6 后端 raw 端点扩展（`backend/peekview/api/files.py`）

```
@router.get("/{slug}/raw", response_class=Response)
async def get_entry_raw(slug, share: str | None = Query(None, max_length=64),
                        purify: bool | None = Query(None, ...), request, current_user):
```

`resolve_entry_raw` 内：
1. **share 分支**（优先于 cookie 兜底）：`if share:` → 复用 `service.get_entry_with_share(slug, share, share_service)`（L1045 已存在）或 public/owner/admin 直通（对齐 `entries.py:196-263`）。成功 → 用返回的 EntryResponse 字段（id/slug/summary/tags/created_at/owner_id）构建 raw；失败 → 抛 `NotFoundError`（404，BDD-22，不泄露存在性）。
   - 与 get_entry 端点差异：raw 不设 cookie（一次访问即返回，BDD-21）。
2. **purify 分支**：`if purify:` 对每个非二进制文本文件 content 应用 `purify_content`。
3. 缺省参数（无 share/purify）→ 现有行为（BDD-24）。

`get_entry_with_share` 已存在且返回 `(EntryResponse, EntryShare)`（`entry_service.py:1019`），**后端无新增 service 逻辑**，只在 files.py 加调用分支。

## 3. 接口契约

- **MCP get_entry**：`get_entry({ ref: string, file?: string })` → 结构化 JSON 文本（含 slug/summary/tags/files + 可选 warning）。向后兼容：`ref` 传裸 slug 语义保持（BDD-4）。
- **后端 raw**：`GET /api/v1/entries/{slug}/raw?share={token}&purify=true` → 200 EntryRawResponse（净化后）/ 404（私有无有效 share）。
- **publish_files**：返回文本含 `Raw URL: {publicUrl}/api/v1/entries/{slug}/raw`。

## 4. [SCOPE+] 声明

无。P2 设计未发现 P1 基线遗漏的必须改动。（净化双实现、匿名 fetch、publicUrl 分拆均已在 P1 SUGGEST/隐含需求覆盖。）

## 5. gate_commands / files_to_read / env_constraints / minimal_validation

```yaml
gate_commands:
  P3: "make test-quick && make test-mcp-unit"
  P5: "make test-quick && make test-mcp-unit"
  P5_typecheck: "make typecheck && make lint"
  P5_e2e: ""                    # ui_affected=false，无前端 E2E
  P6: "make debug-test-mcp"
  P6_real_urls: |
    # 跨 host 实测（:8889 第二实例，见 env_constraints）
    # 1) :8888 公开 entry raw → curl + get_entry(页面链接/raw长/raw短/分享链接/裸slug)
    # 2) :8889 外部实例公开 entry（BDD-6）→ get_entry
    # 3) :8889 私有无 token（BDD-7）→ 明确错误
    # 4) :8889 非 PeekView mock（BDD-9/10/11）→ 拒绝
    # 5) 净化效果：发布含 base64 图片 entry → get_entry 返回占位符（BDD-12/23）
  project_module: "packages/mcp-server/src/"
```

```yaml
files_to_read:
  - path: backend/peekview/api/files.py:352-471
    why: raw 端点 resolve_entry_raw/get_entry_raw，改 share/purify 分支
  - path: backend/peekview/api/entries.py:196-263
    why: get_entry 的 share 验证模式，raw 复用其逻辑
  - path: backend/peekview/services/entry_service.py:1019-1061
    why: get_entry_with_share 已存在，raw 直接调用
  - path: backend/peekview/services/share_service.py:188-240
    why: verify_share_token 行为，理解 share 校验边界
  - path: backend/peekview/models.py:527-549
    why: EntryRawResponse/RawFileItem 结构（净化字段改动依据）
  - path: packages/mcp-server/src/tools/getEntry.ts
    why: 重写为 ref+file 形态，parseEntryRef 入口
  - path: packages/mcp-server/src/client.ts:22-62
    why: request() 恒带 Bearer，新增匿名 fetch 路径对照
  - path: packages/mcp-server/src/tools/publishFiles.ts:517-547
    why: 返回文本加 Raw URL
  - path: packages/mcp-server/src/types.ts:29-46
    why: EntryResponse 结构，新增 EntryRawResponse 类型
  - path: packages/mcp-server/src/config/merge.ts:33-148
    why: peekviewUrl/publicUrl 来源与格式（raw_url 构造）
  - path: packages/mcp-server/tests/tools.test.ts:102-129
    why: 现有 get_entry 单测模式（msw mock），P3 扩展参考
  - path: backend/peekview/main.py:522-528
    why: raw 短链接 302 实现（确认不经 302 的设计依据）
```

```yaml
env_constraints:
  debug_env: |
    - 后端测试/开发：make test-quick（pytest venv）/ make debug-quick（:8888）
    - MCP 单测：make test-mcp-unit（vitest run tests/...）
    - MCP 集成/E2E：make debug-test-mcp（需 :8888 在线 + PEEKVIEW_API_KEY）
    - 跨 host 实测（P6）：手动起第二实例
      PORT=8889 PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug2 PEEKVIEW_DEBUG_MODE=1 python3 -m uvicorn peekview.main:app --port 8889
      （dev-server.sh 硬编码 8888，需手动命令；参照 docs/process/debug-workflow.md）
    - 私有分享创建：POST http://127.0.0.1:8888/api/v1/entries/{slug}/shares（Bearer 登录后）
  isolation_check: |
    - debug :8888 用独立数据目录 /tmp/peekview-debug/；跨 host 用 :8889 /tmp/peekview-debug2/
    - 严禁触碰 :8080 生产 / ~/.peekview/
    - MCP 集成测试必须指向 127.0.0.1:8888，绝不指向 :8080
  prod_isolation: "P0 继承：严禁触碰 :8080 与 ~/.peekview/；测试 entry 只通过 debug HTTP API 创建"
```

```yaml
minimal_validation:
  assumption: |
    - raw 端点实际响应结构（EntryRawResponse 字段）
    - raw 短链接 302 是否丢弃 query（决定 parseEntryRef 是否可直接依赖 302）
    - raw ?share= 当前是否已支持（决定后端改动范围）
    - raw ?purify= 当前行为（决定净化主实现位置）
    - 二进制文件 raw 响应 content=null + file_url（BDD-13 依据）
  method: "debug backend :8888 + curl 只读 HTTP 验证 + make debug-seed 灌入测试数据"
  result: "confirmed"
  note: |
    - raw 长链接结构确认：keys = created_at/files/raw_url/slug/summary/tags；files[0] = content/content_encoding/file_url/filename/id/is_binary/language/path/size → 响应校验字段 = slug+summary+files
    - 短链接 302 确认丢弃 query：/yaml-docker-compose/raw?share=X → 302 location 无 ?share= → parseEntryRef 必须直连 API 不经 302（P1-review 附注 1 成立）
    - raw ?share= 当前 404（私有+有效 share 仍 404，而 get_entry 端点 200）→ 后端补 ?share= 必要性确认
    - raw ?purify= 当前被忽略（FastAPI 未声明参数忽略，返回原样）→ 补参数，缺省行为不变（BDD-24）
    - 私有 raw 无 token → 404；页面 /{slug} → 200 HTML（MCP 必须解析 slug 直连 raw，不可解析 HTML）
    - 二进制文件确认：unicode-filenames entry png → content=null + file_url（BDD-13 满足）
    - 分享 token 经 share_url 获取（含 host + ?share=token）；注意 share_url 的 host 可能非请求 host → 设计取用户传入 URL 的 host，不信任 share_url host
    - 状态标记：[PROD_NOT_TOUCHED]（仅访问 :8888 /tmp/peekview-debug/，未触碰 :8080/~/.peekview/）
```

## 6. 完成标志

1. 后端：`make test-quick` 全绿（含新增 raw ?share=/?purify=/purify_content 测试）。
2. MCP：`make test-mcp-unit` 全绿（parseEntryRef 5 形态 + 匿名 fetch 无 Bearer + 净化兜底 + 返回策略 + file= + publish_files raw_url）。
3. `make typecheck`（vue-tsc）+ `make lint` 零回归。
4. P6 实测：5 种 URL 形态 + 跨 host :8889 + 私有无 token 拒绝 + 非 PeekView 拒绝 + 净化效果，BDD-1~26 全部可二值判定通过。
