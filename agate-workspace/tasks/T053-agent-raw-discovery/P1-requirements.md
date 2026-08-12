---
phase: P1
task_id: T053
type: requirements
parent: P0-brief.md
trace_id: T053-P1-20260712
status: complete
created: 2026-07-12
agent: analyst
---

# T053: Agent Raw 端点自动发现 — 需求基线

[SCOPE_RESOLVED] B5 修正：原预期 `application/json;q=0.9, text/html;q=0.8 → JSON`，P2 minimal_validation 确认 GitHub 实际行为为 HTML 胜出（无论 q 值）。已修改 B5 预期为 HTML，对齐 GitHub 行为更安全。

## 需求复述

Agent 收到 PeekView URL（`https://peek.example.com/xxxx`）后，用 curl/fetch 访问只拿到 SPA 空壳 HTML，无法发现 `/raw` 结构化 JSON 端点。需要三层自动发现机制：

1. **Content Negotiation**：`/{slug}` 根据 Accept header 优先级返回 HTML 或 JSON（对齐 GitHub 行为）
2. **HTML 自描述**：SPA 空壳预注入 `<link rel="alternate">` + HTTP `Link` header，指向 `/raw` 端点
3. **llms.txt 补充**：在 `/llms.txt` 中补充 `/raw` API 描述

## 隐含需求识别

### I1: slug 存在性判断（<link> 注入的前提）

**为什么必须**：SPA catchall 对所有路径返回 `index.html`，不区分有效 slug 和前端路由。如果对所有路径都注入 `<link rel="alternate" href="/api/v1/entries/{slug}/raw">`，则：
- `/explore`、`/settings/apikeys`、`/users/foo` 等前端路由会注入无效的 `<link>`（`/api/v1/entries/explore/raw` 返回 404）
- 不存在的 slug 也会注入 `<link>`，误导 Agent 请求 404 端点

**必须做**：`<link>` 注入前需判断 slug 是否在 DB 中存在（具体实现方式由 P2 设计决定）。

### I2: 认证感知的 Content Negotiation

**为什么必须**：`/raw` 端点对私有 entry 需要认证（返回 404 防枚举）。Content Negotiation 如果只看 Accept header 不看 auth，会导致：
- 未认证 Agent 发 `Accept: application/json` 访问私有 entry → 应返回 404（与 /raw 一致），而非 JSON
- 已认证 Agent 发 `Accept: application/json` 访问自己的私有 entry → 应返回 JSON（与 /raw 一致）

**必须做**：Content Negotiation 返回 JSON 时，必须复用 `/raw` 的认证/可见性逻辑。这不是新逻辑，是确保 Content Negotiation 不绕过现有安全边界。

### I3: SPA catchall 需访问 DB

**为什么必须**：当前 SPA catchall（`serve_spa_catchall`）不访问 DB，纯文件服务。I1 和 I2 都需要 catchall 查询 DB：
- I1：判断 slug 是否存在
- I2：判断 entry 可见性

**性能影响**：SPA catchall 增加 DB 查询不应显著影响响应延迟。具体性能特征由 P2 设计验证。

### I4: 前端路由排除列表

**为什么必须**：已知前端路由（`/`、`/explore`、`/settings/apikeys`、`/users/:username`）不应触发 `<link>` 注入或 Content Negotiation JSON 返回。虽然 DB 查询会自然排除这些（不是有效 slug），但提前排除可避免无意义的 DB 查询。

**注意**：`/login` 不在 router.ts 中（由 LoginDialog 组件处理），但可能是 SPA 内部路由，也应排除。

### I5: llms.txt 行为变更

**为什么必须**：当前 `/llms.txt` 是 302 重定向到 GitHub raw 文件。P0 提出补充 /raw API 描述，但：
- 当前 llms.txt 已包含 `/raw` 端点描述（"GET /api/v1/entries/{slug}/raw — structured JSON, public entries no auth, private entries need API key"）
- 真正缺失的是 Content Negotiation 能力的描述
- 补充内容有两种路径：**(a)** 更新 GitHub 上的静态文件（保持 302 重定向）；**(b)** 改为后端直接返回（从静态文件读取内容后补充动态信息）
- 路径 (a) 改动最小但需要单独发布 llms.txt 文件更新；路径 (b) 改动更大但内容与后端版本同步

**已决议**：选择路径 (a)——更新 GitHub 上的静态文件（保持 302 重定向），改动最小。

### I6: Content Negotiation 对不存在的 slug 的行为

**为什么必须**：当 Agent 发 `Accept: application/json` 访问不存在的 slug 时：
- 返回 404 JSON？（与 /raw 行为一致）
- 返回 HTML？（SPA 前端处理 404 显示）

应与 /raw 端点行为一致：返回 404 JSON error response。

### I7: 静态文件路径匹配优先于 Content Negotiation

**为什么必须**：SPA catchall 先检查 `file_path.exists()`，匹配到静态文件直接返回 `FileResponse`。Content Negotiation 逻辑必须在静态文件检查**之后**——只有"回退到 index.html"的路径才需要 Content Negotiation 和 `<link>` 注入。这是当前路由结构的自然结果，但需显式声明避免误改。

### I8: 无前端代码改动

**为什么成立**：
- Content Negotiation：后端根据 Accept header 选择返回内容，前端 JS 从不直接请求 `/{slug}`（用 `/api/v1/entries/{slug}` API）
- `<link>` 注入：修改的是后端返回的 HTML，前端 JS 不解析 `<link rel="alternate">`
- `Link` header：HTTP 级别，前端 JS 不消费
- llms.txt：后端端点，前端不涉及

**结论**：`ui_affected: 无`。P0 声明正确。但需确认前端路由 `/:slug` 的 detail 页面不受影响——Content Negotiation 只影响直接 HTTP 请求，不影响前端 JS 路由。

### I9: /{slug}/raw 短链接不受影响

**为什么必须**：main.py:421 的 raw_shortlink 注册在 SPA catchall 之前，Content Negotiation 改动 catchall 不应影响短链接。需显式声明此不变量，避免误改路由注册顺序。

### I10: 畸形 Accept header 行为

**为什么必须**：Accept header 可能是无效值（如 `Accept: garbage`）或空值。HTTP 规范说缺少 Accept 等同于 `*/*`，畸形值行为未定义。需声明：畸形 Accept 视同 `*/*`，返回 HTML。

### I11: <link> 存在性泄露 slug 有效性

**为什么必须**：攻击者可通过遍历 slug + 检查 `<link>` 或 `Link` header 存在性来枚举有效 entry。当前 slug 空间足够大（随机生成），风险评估为可接受。但需显式记录此分析，避免未来 slug 生成策略变更时遗漏。

**评估**：可接受。`<link>` 只是指路，不泄露内容。slug 随机生成空间足够大，枚举成本高。

## BDD 验收条件

### B1: Content Negotiation — JSON 优先

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: application/json
Then  响应 Content-Type 为 application/json
  And 响应体为该 entry 的结构化 JSON（与 /api/v1/entries/test-slug/raw 返回内容一致）
```

### B2: Content Negotiation — HTML 优先

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: text/html, application/json
Then  响应 Content-Type 为 text/html
  And 响应体为 SPA index.html
```

### B3: Content Negotiation — 通配符不触发 JSON

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: */*
Then  响应 Content-Type 为 text/html
  And 响应体为 SPA index.html
```

### B4: Content Negotiation — 浏览器 Accept 返回 HTML

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept 为浏览器默认值（text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8）
Then  响应 Content-Type 为 text/html
  And 响应体为 SPA index.html
```

### B5: Content Negotiation — text/html 存在时 HTML 胜出（无论 q 值）

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: application/json;q=0.9, text/html;q=0.8
Then  响应 Content-Type 为 text/html
  And 响应体为 SPA index.html
```

> [SCOPE+ from P2] 原预期为 JSON（q 值排序），但 GitHub 实测确认：当 text/html 和 application/json 都可接受时，HTML 总是胜出（无论 q 值）。对齐 GitHub 行为更安全（浏览器永远不会意外拿到 JSON）。P2 minimal_validation confirmed。

### B6: Content Negotiation — 私有 entry 未认证返回 404

```
Given 存在一个私有 entry "private-slug"
When  发送 GET /private-slug 且 Accept: application/json（无认证）
Then  响应状态码为 404
  And 响应体为 JSON error（与 /api/v1/entries/private-slug/raw 的 404 行为一致）
```

### B7: Content Negotiation — 私有 entry 已认证返回 JSON

```
Given 存在一个私有 entry "private-slug" 且当前用户为 entry owner
When  发送 GET /private-slug 且 Accept: application/json（带认证 cookie）
Then  响应 Content-Type 为 application/json
  And 响应体为该 entry 的结构化 JSON
```

### B7b: Content Negotiation — admin 访问私有 entry 返回 JSON

```
Given 存在一个私有 entry "private-slug" 且当前用户为 admin（非 owner）
When  发送 GET /private-slug 且 Accept: application/json（带 admin 认证 cookie）
Then  响应 Content-Type 为 application/json
  And 响应体为该 entry 的结构化 JSON（与 /raw admin 行为一致）
```

### B8: Content Negotiation — 不存在的 slug 返回 404 JSON

```
Given 不存在 entry "nonexistent-slug"
When  发送 GET /nonexistent-slug 且 Accept: application/json
Then  响应状态码为 404
  And 响应体为 JSON error
```

### B9: Content Negotiation — 不存在的 slug HTML 模式返回 SPA 页面

```
Given 不存在 entry "nonexistent-slug"
When  发送 GET /nonexistent-slug 且 Accept: text/html
Then  响应 Content-Type 为 text/html
  And 响应体为 SPA index.html
```

### B10: HTML <link> 注入 — 有效 slug

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: text/html
Then  响应 HTML 的 <head> 中包含 <link rel="alternate" type="application/json" href="/api/v1/entries/test-slug/raw" />
```

### B10b: HTML <link> 注入 — 私有 entry 也注入

```
Given 存在一个私有 entry "private-slug"
When  发送 GET /private-slug 且 Accept: text/html
Then  响应 HTML 的 <head> 中包含 <link rel="alternate" type="application/json" href="/api/v1/entries/private-slug/raw" />
  And 请求 /api/v1/entries/private-slug/raw（无认证）仍返回 404
```

### B11: HTML <link> 注入 — 不存在的 slug 不注入

```
Given 不存在 entry "nonexistent-slug"
When  发送 GET /nonexistent-slug 且 Accept: text/html
Then  响应 HTML 的 <head> 中不包含 <link rel="alternate"> 指向 /raw
```

### B12: HTML <link> 注入 — 前端路由不注入

```
Given /explore、/settings/apikeys、/users/:username 是前端路由（非有效 slug）
When  发送 GET /explore 且 Accept: text/html
Then  响应 HTML 的 <head> 中不包含 <link rel="alternate"> 指向 /raw
```

### B13: HTTP Link header — 有效 slug

```
Given 存在一个公开 entry "test-slug"
When  发送 GET /test-slug 且 Accept: text/html
Then  响应包含 HTTP header: Link: </api/v1/entries/test-slug/raw>; rel="alternate"; type="application/json"
```

### B13b: HTTP Link header — 私有 entry 也添加

```
Given 存在一个私有 entry "private-slug"
When  发送 GET /private-slug 且 Accept: text/html
Then  响应包含 HTTP header: Link: </api/v1/entries/private-slug/raw>; rel="alternate"; type="application/json"
```

### B14: HTTP Link header — 不存在的 slug 不添加

```
Given 不存在 entry "nonexistent-slug"
When  发送 GET /nonexistent-slug 且 Accept: text/html
Then  响应不包含指向 /raw 的 Link header
```

### B15: llms.txt — 包含 /raw 和 Content Negotiation 描述

```
When  发送 GET /llms.txt
Then  响应内容包含 /raw API 端点描述
  And 响应内容包含 Content Negotiation 机制描述（Accept: application/json 获取 JSON）
```

### B16: 端到端 — Agent 通过 Accept 直接获取 JSON

```
Given 存在一个公开 entry "test-slug"
When  Agent 发送 GET /test-slug 且 Accept: application/json
Then  Agent 一步获取结构化 JSON，无需事先知道 /raw 路径
```

### B17: 端到端 — Agent 通过 <link> 发现 /raw

```
Given 存在一个公开 entry "test-slug"
When  Agent 发送 GET /test-slug（默认 Accept: */*）获得 HTML
  And Agent 解析 HTML 发现 <link rel="alternate" type="application/json" href="/api/v1/entries/test-slug/raw" />
  And Agent 发送 GET /api/v1/entries/test-slug/raw
Then  Agent 获取结构化 JSON
```

## 待确认清单

### NC1: llms.txt 实现路径 — [RESOLVED] 路径 A

**决策**：保持 302 重定向到 GitHub，更新 GitHub 上的 llms.txt 静态文件。
**理由**：T053 核心是 Content Negotiation 和 HTML 自描述，llms.txt 是辅助层。路径 B（改后端直接返回）引入 302→200 行为变更，scope 超出目标。GitHub 文件更新在 P4 实现阶段单独处理。
**部署协调风险**：后端代码部署与 GitHub llms.txt 文件更新是两个独立动作，需确保同步。P6 验收时需注意测试环境与生产环境的 llms.txt 内容可能不同。
**对 BDD 影响**：B15 验证的是 GET /llms.txt 返回内容包含描述——302 重定向后内容仍包含，BDD 不受影响。

### NC2: 私有 entry 的 <link> 注入 — [RESOLVED] 选项 A

**决策**：私有 entry 也注入 `<link>`。
**理由**：`<link>` 只是发现提示，不泄露内容。Agent 看到 `<link>` 后请求 /raw 仍需认证（返回 404）。不注入反而减少合法 Agent 的发现路径。与"私有 entry 对非 owner 返回 404"原则不矛盾——404 防止内容泄露，`<link>` 只是指路。
**对 BDD 影响**：B10 的 Given 条件需扩展——不仅公开 entry，私有 entry 也注入 `<link>`。新增 B10b 补充覆盖。

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7]
internal_only: true
internal_only_reason: 纯后端行为变更，无公共 API 破坏性变更，无版本 bump
override: P8 pruned (internal_only, no version bump needed)
```

- **P1**：需求基线（本文件）
- **P2**：方案设计（不可裁剪，Content Negotiation 优先级解析和 slug 查询策略需设计）
- **P3**：TDD 测试（保留，Content Negotiation Accept header 各种组合需要单元测试覆盖，安全边界必须测试）
- **P4**：代码实现
- **P5**：技术验证（保留，pytest 全绿 + 隔离验证）
- **P6**：验收（保留，需 curl 实测验证三层发现机制，涉及安全边界不可裁剪）
- **P7**：一致性检查 — **恢复**。理由：Content Negotiation 复用 /raw 认证/可见性逻辑（I2），属于安全相关改动，WORKFLOW.md 风险矩阵要求安全相关改动不可跳过一致性检查。需验证 Content Negotiation 实现与 /raw 认证逻辑一致
- **P8**：发布准备 — **裁剪**。理由：无 schema 变更、无新 package、无版本号变更，仅需在 CHANGELOG.md [Unreleased] 记录。跳过风险: 低 — CHANGELOG 更新由 AGENTS.md 铁律保障，不依赖 P8 流程驱动

## 范围声明

```yaml
packages:
  - backend/peekview

domains:
  - content-negotiation    # Accept header 优先级解析 + JSON/HTML 选择
  - html-self-description  # SPA 空壳预注入 <link> + Link header
  - llms-txt               # /raw API 描述补充（取决于 NC1 确认）
  - security               # Content Negotiation 必须遵守现有认证/可见性边界
  - information-leakage    # <link> 存在性可被用于枚举有效 slug

risk_level: medium
# 理由：涉及安全边界（Content Negotiation 不能绕过私有 entry 认证），
# 但改动范围有限（纯后端，无前端，无 schema 变更）

ui_affected: 无
```

## 能力需求声明

```yaml
capability_requirements:
  - need: curl-http-testing
    why: P6 验收需用 curl 测试各种 Accept header 组合的 Content Negotiation 行为
    available:
      - "bash curl（本地环境内置）"
    status: available

  - need: browser-accept-header
    why: P6 验收需确认浏览器默认 Accept header 返回 HTML 而非 JSON（安全边界）
    available:
      - "playwright-cdp skill（CDP 模式，可发送自定义 Accept header）"
    status: available

  - need: requires_minimal_validation
    why: Content Negotiation 的 Accept header 优先级解析涉及 RFC 7231 规范行为，需确认实现与规范一致
    status: true
```
