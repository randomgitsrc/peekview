---
phase: P1
task_id: TPV0100
type: problems
parent: P0-brief.md
trace_id: TPV0100-P1-20261001
status: draft
created: 2026-10-01
agent: analyst
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages: [peekview-frontend, docs]
domains: [frontend]
ui_render_shape: layout
ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]
capability_requirements:
  - need: visual-vision
    why: P6 验收需对发布页/结果态截图做视觉确认
    available:
      - "vision-engine skill（本项目实测可调）"
      - "Playwright CDP（Chrome :18800）+ vision-helper subagent"
    status: available
  - need: browser-automation
    why: P6 需真实驱动浏览器完成端到端验收
    available:
      - "playwright-cdp skill / frontend-v3 Playwright E2E（指向 debug :8888）"
    status: available
---

# P1-requirements — TPV0100 网页发布入口

## 0. P0-brief 时效性质疑

已核对 P0-brief 时效性，无漂移。

- P0-brief 与 spec V1.1 同期（均 2026-10-01），立项与实际启动无间隔，不存在跨会话搁置。
- 逐条排查严重漂移判据：
  1. `task` 目标方案（复用 `POST /api/v1/entries`，后端零改动）仍成立——实读 `backend/peekview/api/entries.py` 确认端点存在且契约与 spec §6.4 一致。
  2. `executor_env`（opencode / 本地 runtime / debug :8888）仍成立——`make debug-start` 路径与文档一致。
  3. `known_risks` 声明的"无 schema 变更 / 仅 frontend / 无权限改动"三项经代码核对均成立（`CreateEntryRequest` / `FileCreate` 未改动，端点调用方确为 CLI-remote、MCP-remote、MCP-local 三方）。
- 轻微变化核对：无。前端 `router.ts` / `client.ts` / `UserMenu.vue` 现状与 P0 的"D 前端现状"实核一致。

`[PROD_NOT_TOUCHED]`（本次 P1 仅读代码与 grep，未起服务、未触碰生产 :8080 与 `~/.peekview/`）

---

## 1. 需求复述

为**已登录用户**提供一个网页发布入口，使其能力对标 MCP 的 `publish_files`，并成为 `POST /api/v1/entries` 的第 4 个调用方。

- **入口**：两处——全局 `UserMenu` 下拉新增 `Publish`；Explore 页（`/explore`）顶部新增主按钮 `Publish`。
- **页面**：新增 `/publish`，登录用户在其中选择文件、填写字段、提交发布。
- **字段**：`summary`（必填）、文件（≥1）、`slug`（可选）、`tags`（可选）、`is_public`（默认公开）、`expires_in`（默认取服务端 `default_expires_in`）、`team_id`（可选）。
- **文件**：支持多选与拖拽；前端判定文本 / 二进制，文本走 `content`、二进制走 `content_base64`；每个文件有可编辑相对路径，用于构造目录结构。
- **提交**：`POST /api/v1/entries`（JSON，携带 `idempotency_key`），**后端零改动**。
- **结果**：同页结果态，展示页面链接 `{base_url}/{slug}` 与 Raw 链接 `{base_url}/{slug}/raw`，均可复制，并可跳转详情页或"再发一个"。
- **非目标**：不做文件编辑器、不做文件夹选择 / 压缩包解压、不做 multipart / 断点续传、不做服务端路径输入（`local_path` / `dirs`）、不做草稿 / 批量历史 / 发布模板。

**范围界定（P1 不做方案设计）**：以下为实现约束的事实依据，非方案：
- 后端对 `content_base64` 无条件返回 `is_binary: true` / `language: null`（`entry_service.py:1197-1206`），故前端必须自行判定文本/二进制。
- 后端不对同一 entry 内 `path` 查重（重复会互相覆盖并产生两行 File 记录），故前端必须拦截重复路径。
- 后端 `get_disk_path` 对越界路径抛 `ForbiddenPathError`，前端需早校验绝对路径与 `..`。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
| :--- | :--- | :--- |
| I-1 | 前端需新增 `getLimits()` 并消费 `GET /api/v1/config/limits` | 预校验与 `expires_in` 默认值依赖该接口；全仓扫描确认前端当前**无任何 limits 消费者**（`api/client.ts` 无该方法，grep `config/limits` 前端零命中）。不消费则限额硬编码，与 spec §3.2 冲突 |
| I-2 | 文本/二进制判定必须对齐**后端** `language.py:is_binary_content` 而非 MCP `looksBinary` | MCP `looksBinary` 仅查前 8000 字节 NUL，会漏判"无 NUL 但非合法 UTF-8"的二进制文件；漏判会让二进制走 `content`，后端按文本处理导致详情页渲染乱码 |
| I-3 | `idempotency_key` 的生成 / 复用 / 重置规则须显式定义并测试 | 后端幂等语义为"同 key + 同 owner 返回已存在 entry (200)"；若前端每次重试都换 key，会重复创建；若载荷变却不换 key，会误命中旧 entry |
| I-4 | Explore 页 Publish 主按钮必须加 `!props.owner` 渲染 gate | `EntryListView.vue` 同时服务 `/explore` 与 `/users/:username`（`props.owner`）；不加 gate 会在**他人主页**出现发布入口 |
| I-5 | 未登录访问 `/publish` 的守卫需并入 `router.beforeEach` | 现有守卫对 `/settings` `/stars` `/teams` 各自 `return '/'`；`/publish` 复用同一惯例，否则未登录用户可直达表单页 |
| I-6 | `slug` 自定义时的长度/字符合法性前端需早校验 | `CreateEntryRequest.slug` `max_length=64`；非法 slug 会 400/422。填了 slug 时若与已有 entry 冲突，后端走覆盖路径（immutable update），需让用户知晓语义 |
| I-7 | `DESIGN.md` 的菜单描述 "(Settings, Teams, Logout)" 需同步 | spec §6.3 明确；不加 `Publish` 会造成设计系统文档与实现漂移（P7 一致性检查依赖 packages 声明） |
| I-8 | 提交中禁用按钮 + 进度反馈；失败保留表单 | spec §4 关键行为；大文件 base64 膨胀 33%，长耗时请求若无反馈用户会重复点击 → 重复提交 |
| I-9 | 二进制文件在详情页需可下载 | spec §9-3 验收方向；`FileResponse` 已带下载链接，前端无需特殊处理，但需在结果/详情验证渲染链路 |
| I-10 | OQ-2（0 字节文件）需在 P1 定性 | 后端 `is_binary_content(b"")` 返回 `False`（非二进制），`_validate_limits` 对 size=0 无下限；若产品不允许需前端拦截，否则允许即可发布 |
| I-11 | OQ-3（同名不同路径）需在 P1 定性 | 默认路径 = 文件名，两个不同目录同名文件默认路径重复会被前端重复检测拦下；是否主动提示改名需定 |

## 3. BDD 验收条件

> 说明：`domains: frontend`，形态为 `layout`（布局型），UX 维度取 `布局结构 / 交互行为 / 视觉呈现`。UX 类别 BDD 在标题后缀标出类别（布局结构：BDD-1/2/3/4/9；视觉呈现：BDD-29；其余为交互行为）；全部判据可二值判定，不绑定 CSS 类名 / 组件名 / 工具名。

### 3.1 入口可达性（布局结构）

#### BDD-1: 布局结构：已登录用户可从全局用户菜单进入发布页

- Given 用户已登录且位于任一渲染全局用户菜单的页面
- When 展开该用户菜单并点击其中的 `Publish` 项
- Then 浏览器地址变为 `/publish`，且页面渲染出发布表单（含 summary 输入与文件选择区）

#### BDD-2: 布局结构：Explore 页为已登录用户渲染发布主按钮

- Given 用户已登录并访问 `/explore`
- When 页面加载完成
- Then 顶部工具栏出现一个可点击的 `Publish` 主按钮，点击后地址变为 `/publish`

#### BDD-3: 布局结构：他人主页不出现发布入口

- Given 用户已登录并访问 `/users/{username}`（`username` 为任意用户）
- When 页面加载完成
- Then 页面内不存在跳转到 `/publish` 的可点击入口

#### BDD-4: 布局结构：未登录时不渲染发布入口

- Given 用户未登录
- When 访问 `/explore` 或任意复用全局用户菜单的页面
- Then 页面内不存在跳转到 `/publish` 的可点击入口

### 3.2 路由守卫

#### BDD-5: 交互行为：未登录访问发布页被重定向到首页

- Given 用户未登录
- When 直接访问 `/publish`
- Then 浏览器地址变为 `/`，且不渲染发布表单

### 3.3 文件编码与发布

#### BDD-6: 交互行为：多文件（文本 + 二进制）发布成功且落库类型正确

- Given 已登录用户已选择 ≥2 个文件，其中 1 个为合法 UTF-8 文本、1 个含 NUL 字节的二进制
- When 填写合法 summary 并点击发布
- Then 返回 201，且该 entry 详情中文本文件的 `is_binary` 为 false、二进制文件的 `is_binary` 为 true

#### BDD-7: 交互行为：文本文件在详情页渲染、二进制文件可下载

- Given 一个刚通过发布页创建的 entry，含 1 个文本文件与 1 个二进制文件
- When 打开该 entry 详情页
- Then 文本文件内容以文本形式呈现（可见其字符内容，且 `language` 非 null），二进制文件提供可点击的下载入口且下载内容字节与原文件一致

#### BDD-8: 交互行为：无 NUL 但非合法 UTF-8 的文件被判为二进制

- Given 用户选择一个不含 NUL 字节但无法以 UTF-8 严格解码的文件
- When 发布该 entry
- Then 该文件在详情中 `is_binary` 为 true（即未被误判为文本）

### 3.4 相对路径与目录结构

#### BDD-9: 布局结构：编辑相对路径后构造出嵌套目录结构

- Given 已登录用户选择两个文件，并将第二个文件的相对路径手工改为 `src/b.cs`
- When 发布成功并打开详情页
- Then 文件树同时呈现根级文件与 `src/` 目录下的文件，且两文件路径分别为各自填写的值

### 3.5 结果态

#### BDD-10: 交互行为：结果态提供可复制的页面链接与 Raw 链接

- Given 发布成功进入结果态
- When 查看结果区
- Then 同时展示页面链接（形如 `{当前源}/{slug}`）与 Raw 链接（形如 `{当前源}/{slug}/raw`），二者复制按钮点击后剪贴板内容与展示链接一致

#### BDD-11: 交互行为：Raw 链接对公开 entry 免认证可读

- Given 一个通过发布页创建且 `is_public=true` 的 entry
- When 以**未携带任何认证凭据**的请求访问其 Raw 链接
- Then 返回 200 且响应体为包含该 entry 结构化数据的 JSON

#### BDD-12: 交互行为：结果态可跳转详情

- Given 发布成功进入结果态
- When 点击"查看详情"
- Then 浏览器地址变为 `/{slug}` 且渲染对应 entry 详情

#### BDD-13: 交互行为：结果态"再发一个"清空表单并重置幂等键

- Given 发布成功进入结果态
- When 点击"再发一个"并随即提交一个与上一次等价意图相同的新发布（summary 与文件内容均相同）
- Then 返回结果态时表单的 summary 为空、已选文件为空，且新提交创建出新的 entry（未命中上一次的幂等键）

### 3.6 前端预校验

#### BDD-14: 交互行为：空 summary 阻止提交

- Given 已选 ≥1 个文件但 summary 为空
- When 点击发布
- Then 不发出创建请求，且页面就地显示 summary 必填的提示

#### BDD-15: 交互行为：无文件阻止提交

- Given summary 已填写但未选择任何文件
- When 点击发布
- Then 不发出创建请求，且页面就地显示"至少选择一个文件"的提示

#### BDD-16: 交互行为：超出限额（文件数 / 单文件 / 总量）阻止提交并指出对象

- Given 选择结果使 `文件数 > max_entry_files`、或存在 `单文件 > max_file_size`、或 `总大小 > max_entry_size`（限额取自 `GET /api/v1/config/limits`）
- When 点击发布
- Then 不发出创建请求，且提示中指明被违反的限额维度（超限文件名或当前总量）

#### BDD-17: 交互行为：非法相对路径阻止提交

- Given 某文件的相对路径为空、或以 `/` 开头、或含 `..` 段
- When 点击发布
- Then 不发出创建请求，且对应文件行被标记为错误状态

#### BDD-18: 交互行为：重复相对路径阻止提交

- Given 两个文件的相对路径完全相同
- When 点击发布
- Then 不发出创建请求，且对应行被标记为错误状态

#### BDD-19: 交互行为：自定义 slug 非法或超长时阻止提交

- Given 用户在 slug 字段填写超过 64 个字符、或含空格、或含 `/` 的字符串
- When 点击发布
- Then 不发出创建请求，且页面就地显示 slug 非法的提示

### 3.7 默认值与归属

#### BDD-20: 交互行为：默认公开且过期时间默认 15 天

- Given 用户打开发布表单且未改动可见性与过期时间
- When 填写 summary 与文件后直接发布
- Then 创建出的 entry `is_public=true`，且 `expires_at` 与创建时刻相差默认过期时长（取自 `GET /api/v1/config/limits` 的 `default_expires_in`）

#### BDD-21: 交互行为：填写的可选字段被正确提交与采纳

- Given 用户在表单填写自定义 slug、至少一个 tag、一个所属团队、以及一个非默认的过期时长
- When 发布成功并查询该 entry
- Then 该 entry 的 slug、tags、team 归属、`expires_at` 均与所填值一致

#### BDD-22: 交互行为：创建的 entry 归属登录用户

- Given 用户 A 已登录并通过发布页创建一个 entry
- When 查询该 entry 的归属信息
- Then `owner_id` 等于用户 A 的 id

### 3.8 失败与幂等

#### BDD-23: 交互行为：失败后保留表单且重试不产生重复 entry

- Given 提交因 5xx 或网络失败而失败，且用户未改动任何字段或文件集合
- When 用户原样重试并成功
- Then 表单在失败后仍保留原 summary 与已选文件，且最终数据库中该发布意图只存在 1 个 entry

#### BDD-24: 交互行为：载荷变更后重试视为新意图

- Given 提交失败后用户修改了 summary/文件集合/任一字段
- When 用户再次提交并成功
- Then 产生一个新的 entry（不命中前一次的幂等键）

#### BDD-25: 交互行为：限流（429）有明确提示

- Given 创建请求返回 429
- When 用户提交
- Then 页面显示限流相关错误提示，且表单保留

#### BDD-26: 交互行为：后端校验错误（400/422）有明确提示

- Given 创建请求返回 400 或 422 且响应体含 detail
- When 用户提交
- Then 页面显示后端 detail 原文，且表单保留

#### BDD-27: 交互行为：提交进行中禁止重复提交

- Given 创建请求已发出且尚未返回
- When 用户再次点击发布
- Then 不发出第二个创建请求，且主操作按钮处于不可点击状态

### 3.9 人工体验路径（强制）

#### BDD-28: 交互行为：按文档 seed 后发布流程可人工走通

- Given 按项目文档执行 debug 环境的 seed（`make debug-start` + `make debug-seed`，用户 alice）
- When 以 alice 登录访问 `/explore` 并进入 `/publish`
- Then Explore 页渲染出 seed 的 entry 列表（页面有内容），发布页可完成"填 summary → 选文件 → 提交"并进入结果态

### 3.10 视觉呈现

#### BDD-29: 视觉呈现：表单上以可见文本标明当前可见性状态，默认指明为公开

- Given 用户打开发布表单且未改动可见性设置
- When 查看表单中的可见性设置区域
- Then 该区域存在明确的可见文本，文本内容指明当前可见性为公开，且该文本随可见性设置切换而更新

### 3.11 单元可测行为

#### BDD-30: 交互行为：文本/二进制判定与后端规则一致

- Given 一组样本（含 NUL 的字节流、合法 UTF-8 字节流、无 NUL 但非法 UTF-8 的字节流、0 字节）
- When 调用前端文本/二进制判定
- Then 判定结果与后端 `is_binary_content` 对同样本的结果逐一致（0 字节判为文本）

## 4. 待确认清单

`[NO_NEED_CONFIRM]`

## 5. 同类扫描结论（强制节）

扫描范围：仓库根（排除 `node_modules` / `.git` / `agate-workspace` / `backend/.venv`）。关键符号逐条判定。

| 符号 | 命中位置（剔除测试/文档/历史任务） | 判定 |
| :--- | :--- | :--- |
| `publish_files` | `packages/mcp-server/src/tools/publishFiles.ts`（及 dist）；`README.md:53` / `README.zh-CN.md:53` / `AGENTS.md:168-169` / `CHANGELOG.md` 多处；`docs/specs/peekview-web-publish-20261001.md`；seed 数据与 mermaid 示例内容 | **本次不处理**：MCP 工具本身不改（后端零改动、MCP 零改动）。README/CHANGELOG 的入口描述是否补"网页"归入 P8/文档同步，非功能改动；seed 内容仅示例文本 |
| `create_entry` | `backend/peekview/api/entries.py:102`（HTTP handler）；`backend/peekview/services/entry_service.py:174`（service）；`backend/peekview/client.py:137`（CLI remote 客户端）；`backend/peekview/cli.py:359`（CLI 调用点）；`entry_service.py:1124`（overwrite 复用）；`packages/mcp-server` remote 工具 | **本次不处理**：均既有调用方，本次不新增后端方法与工具；前端走 HTTP 端点，不经过 Python client |
| `createEntry`（前端 JS 命名惯例） | 前端 `frontend-v3/src` **零命中**；命中全在 `agate-workspace/tasks/**` 历史 E2E 脚本与 `packages/mcp-server/dist/*.d.ts` | **本次处理**：`frontend-v3/src/api/client.ts` 需新增 `createEntry(payload)`（spec §6.3），历史任务脚本不属本次范围 |
| `POST /api/v1/entries` 调用方 | 实读确认现为 3 个：CLI-remote（`backend/peekview/client.py:163`）、MCP-remote（`packages/mcp-server/src/client.ts`）、MCP-local（`packages/mcp-server/src/tools/publishFiles.ts`）。CLI-local 经 `EntryService` 不经端点 | **本次处理**：新增第 4 个调用方（网页）。**同步面核查**：① 限流口径——写端点 60/min 共享（`server.rate_limit_per_minute`），新增调用方共用同一限流，无需改配置，但前端需处理 429（→ BDD-25）；② `/config/limits` 返回 6 字段，前端新增消费方不影响其他调用方；③ 无工具描述需同步（网页不走 MCP schema）；④ 来源标注头 `X-PeekView-Source` 创建端点不消费，本次不添加（P0 事实 E / OQ-1 已结案）。**结论：无需同步的其它消费方** |
| `content_base64` | `backend/peekview/services/{entry_service,file_service,admin_service}.py`、`api/entries.py`、`models.py`；`packages/mcp-server/src/{tools/publishFiles.ts,types.ts}`；`frontend-v3/e2e/html-render.spec.ts`（测试） | **本次处理**：前端新增编码路径（二进制→`content_base64`）是首个前端消费方。后端行为不改；MCP 既有逻辑不改 |
| `local_path` / `dirs` | `backend/peekview/{cli,config,storage,models,exceptions}.py`、`services/*`、`api/entries.py`；`backend/tests/*` | **本次不处理**：spec §1.3 明确非目标，网页不暴露服务端路径输入；前端不新增 `local_path`/`dirs` 字段 |
| `X-PeekView-Source` | `backend/peekview/api/_shared.py:23`（仅读端点 `_detect_channel` 消费）；`packages/mcp-server/src/client.ts` 两处（读端点）；`backend/tests/test_read_tracking.py`；MCP 测试 | **本次不处理**：创建端点不消费该头（P0 事实 E）；保持后端零改动，网页不添加该头 |
| `type="file"` 文件输入 | `frontend-v3/src` **零命中**（全仓前端无 `<input type="file">` / `FormData` / 上传 UI） | **本次处理**：网页发布是前端首个文件输入 UI。无同类既有实现可复用，需新建（拆分见 spec §6.3） |
| 前端 limits 消费 | `frontend-v3/src` 零命中；`packages/mcp-server/src/tools/createEntry.ts:44` 仅在工具描述中**提及**该接口（未读取） | **本次处理**：前端新增 `getLimits()`；MCP 描述保持不变 |

**扫描总结**：端点 `POST /api/v1/entries` 的调用方从 3 增至 4（+web），经全仓扫描，**未发现需要同步修改的其它消费方**（限流共享无需改配置、无 MCP schema/工具描述需改、来源头已确认不适用）。前端侧 `createEntry` / `getLimits` / 文件输入 UI / `content_base64` 编码均**只此一处**（即本次新增），无存量同类实例待处理。

**回归拦截**：本次为一次性新功能，无存量同类问题扩散。新增行为由 §3 的 BDD 覆盖（含 BDD-30 对齐后端判定的单元测试），不额外新增 gate 脚本。

## 6. 已解决的历史裁决（采信上游，不重开）

- **OQ-1（已决）**：`POST /api/v1/entries` 不消费 `X-PeekView-Source`，本次**不添加**该头，保持后端零改动。→ 无对应 BDD（不作为验收项）。
- **OQ-2（0 字节文件）**：经查后端 `is_binary_content(b"")` 返回 `False`、`_validate_limits` 无 size 下限，故**允许发布 0 字节文件**，判为文本、`language` 依扩展名。→ 由 BDD-30 覆盖判定分支。
- **OQ-3（同名不同路径）**：默认路径即文件名，同名文件默认路径重复会被 BDD-18 的重复检测拦下；**不额外增加主动提示**（用户手工改路径即可），作为 UX 增强进 roadmap。

## 7. 范围声明（正文说明，机器字段在 frontmatter）

- `domains`: `[frontend]` —— 后端零改动、MCP 零改动；文档（`DESIGN.md`）随前端同步。
- `packages`: `[peekview-frontend, docs]`。
- `risk_level`: `medium` —— 新增用户可见功能、跨多个前端组件、涉及编码正确性（文本/二进制）与幂等语义（重试不重复创建）。
- `phases`: `[P1, P2, P3, P4, P5, P6, P7, P8]` —— 无裁剪，全走。

### 裁剪说明

不裁剪任何阶段。理由：本任务虽有 spec 详设，但涉及**文件编码正确性**与**幂等语义**两个高风险面，且跨 `router` / `api client` / `UserMenu` / `EntryListView` / 新页面 / 新 composable / 新组件多文件——属「机制交叉」（≥2 子系统交互），按 P1 卡规则必须走完整 agate，P2/P6 不可裁，P3（编码与幂等为可测纯逻辑）保留。

`[NO_NEED_CONFIRM]`

## 8. 能力需求声明

```yaml
capability_requirements:
  - need: visual-vision
    why: P6 验收需对发布页/结果态截图做视觉确认（布局结构、交互行为、视觉呈现三维度）
    available:
      - "vision-engine skill（本项目实测可调，见 AGENTS.md「Playwright CDP 截图 + vision 分析」）"
      - "Playwright CDP（Chrome :18800）+ vision-helper subagent"
    status: available
  - need: browser-automation
    why: P6 需真实驱动浏览器完成"登录→选文件→提交→结果态"端到端验收
    available:
      - "playwright-cdp skill / frontend-v3 Playwright E2E（指向 debug :8888）"
    status: available
```

`verification_env`（运行环境，非能力三态）：`debug backend http://127.0.0.1:8888 + 数据目录 /tmp/peekview-debug/`，由主 Agent 用 `make debug-start` / `make debug-seed` 准备；**严禁**生产 :8080 与 `~/.peekview/`。
`verification_env_budget`: 止损轮次 2（独立计数，不占 `retries[P5]`）；轮次追踪由主 Agent 在 dispatch-context 记录。

## 9. UI/UX 形态声明（正文说明，机器字段在 frontmatter）

- `ui_render_shape`: `layout`（布局型）——常规表单 + 列表 + 结果态布局，非渲染组件型、非时序特效型。
- `ui_ux_dimensions`: `[布局结构, 交互行为, 视觉呈现]`——三条 UX 类别 BDD 均在标题后缀标出对应类别（布局结构：BDD-1/2/3/4/9；视觉呈现：BDD-29；其余为交互行为），维度声明与 BDD 类别严格对齐。
- UX BDD 判据均为可观测的二值判定，且不绑定具体 CSS 类名 / 组件名 / 工具名 / 技术栈名。

## 10. 下游交接要点

- **P2 依赖**：`domains: frontend` + `risk_level: medium` → 触发 plan-design-review（frontend 域 C8 映射）。
- **P6 验收**：逐条对照 §3 的 30 条 BDD（PASS/FAIL 总数须 ≥ 30）；UI 项须 Playwright 实跑 + 截图 + vision 分析；BDD-28 为人工体验路径必测项。
- **P7 一致性**：按 `packages: [peekview-frontend, docs]` 做跨文件交叉核对，重点核对 `DESIGN.md` 菜单描述与 `UserMenu.vue` 实现是否一致。
- **E2E 约束**（沿用项目规范）：指向 :8888，entry 用 `e2e-` 前缀确定性 slug，`afterEach` 按返回的 `created.slug` 清理；截图证据落 `evidence/`。
- **P1 基线保护**：本文为需求基线，P2-P8 不应直接修改；如需变更须主 Agent 批准并标 `[BASELINE_CHANGE: 理由]`。

## 11. 变更记录

| 日期 | 版本 | 变更 |
| :--- | :--- | :--- |
| 2026-10-01 | v1 | 初稿。基于 P0-brief + spec V1.1 + brainstorming 定稿，建立 25 条 BDD；完成同类扫描（8 类关键符号）；P0 时效性核对无漂移 |
| 2026-10-01 | v2 | 闭合 P1-review 修订清单 1-6：BDD-12 拆为跳转详情 + "再发一个"重置（BDD-12/13）；新增视觉呈现 BDD-29、slug 早校验 BDD-19、可选字段 payload 契约 BDD-21；BDD-22 拆为限流 429（BDD-25）与后端校验 400/422（BDD-26）；BDD-1 标题/Given 去组件名 `UserMenu`；BDD 重编为 30 条连续编号 |
