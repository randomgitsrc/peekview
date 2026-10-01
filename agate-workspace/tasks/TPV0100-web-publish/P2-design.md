---
phase: P2
task_id: TPV0100
type: design
parent: P1-requirements.md
trace_id: TPV0100-P2-20261001
status: draft
created: 2026-10-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2
packages: [peekview-frontend, docs]
domains: [frontend]
ui_affected: true
ui_design_section: true
# ── v2.0 派发编排字段（可选）──
dispatch_plan: {mode: single}
---

# P2-design — TPV0100 网页发布入口

**任务一句话**：登录用户在 `/publish` 选文件（多选/拖拽）→ 填字段 → 一次 `POST /api/v1/entries`（后端零改动，前端成为第 4 个调用方）→ 同页结果态可复制页面/Raw 链接。

**方案综述**：新增 `/publish` 路由 + `PublishView.vue` 页面编排；抽 `useFileEncoding`（纯函数：文本/二进制判定 + base64）与 `usePublishValidation`（集中预校验）；`api/client.ts` 增 `createEntry` / `getLimits`；结果态为页面内状态机（不新增路由）；幂等键绑定「载荷指纹」，载荷变则换键。全程复用既有 `CreateEntryRequest` 契约，后端与 MCP 零改动。

---

## 1. 影响面梳理（强制节，先于候选方案）

> 依据：P1 §5 同类扫描 + P0-brief `known_risks` + 本次实读代码/grep + 对 debug `:8888` 的 curl 实测（见 §6 minimal_validation）。三处同源，逐级细化。

### 1.1 改什么（Modify）——落到文件+小节/函数

| # | 文件 | 落点（小节/函数） | 改动 | 关联 BDD |
| :-- | :--- | :--- | :--- | :--- |
| M1 | `frontend-v3/src/router.ts` | `routes[]` 增 `/publish`；`router.beforeEach`（L97-114）增 `if (to.path === '/publish') { if (authStore.authState !== 'authenticated') return '/' }` | 路由 + 守卫 | BDD-1,2,5 |
| M2 | `frontend-v3/src/components/UserMenu.vue` | `.user-dropdown`（L9-13）增 `Publish` 按钮 + `navigateToPublish()`；`data-testid="user-menu-publish-item"` | 全局入口 | BDD-1,4 |
| M3 | `frontend-v3/src/views/EntryListView.vue` | `.content-toolbar`（L16-92）内增主按钮，渲染条件 `authState === 'authenticated' && !props.owner`（`props.owner` 见 L299） | 页面入口（gate） | BDD-2,3,4 |
| M4 | `frontend-v3/src/api/client.ts` | 新增 `async createEntry(payload)` → `POST /entries`；`async getLimits()` → `GET /config/limits`；新增 `CreateEntryApiResponse` 的 transform（复用 `transformFile` L31） | API 层 | BDD-6,8,10,11,20,21,22,23,24,25,26 |
| M5 | `frontend-v3/src/api/types.ts` | 新增 raw 类型：`CreateEntryRequestPayload` / `CreateEntryApiResponse` / `PublicLimitsApiResponse` / `ApiErrorBody` | 契约类型 | 全局契约 |
| M6 | `frontend-v3/src/types/index.ts` | 新增领域类型：`PublishFileDraft` / `PublishResult` / `PublishLimits` | 领域类型 | 全局 |
| M7 | `frontend-v3/src/composables/useFileEncoding.ts`（新增） | 纯函数 `isBinaryContent(bytes)` / `readFileAsEncoded(file)` / `arrayBufferToBase64(buf)` | 编码模块 | BDD-6,7,8,30 |
| M8 | `frontend-v3/src/composables/usePublishValidation.ts`（新增） | 纯函数 `validatePublishForm(input, limits)` → `{ok, summaryError, slugError, fileErrors: Record<fileId,string>, globalError}` | 集中预校验 | BDD-14~19 |
| M9 | `frontend-v3/src/views/PublishView.vue`（新增） | 页面编排：表单状态、提交、结果态状态机、幂等键管理 | 主页面 | BDD-1,5,6,10,12,13,20~27 |
| M10 | `frontend-v3/src/components/FileDropZone.vue`（新增） | `<input type="file" multiple>` + dragover/drop 事件 | 文件选择 | BDD-6 |
| M11 | `frontend-v3/src/components/PublishFileList.vue`（新增） | 每文件一行：名称/大小/文本-二进制徽标/可编辑相对路径/移除；行级错误态 | 文件列表 | BDD-9,17,18 |
| M12 | `frontend-v3/src/components/PublishResultPanel.vue`（新增） | 结果态：页面链接 + Raw 链接 + 复制按钮 + 过期时间 + 查看详情/再发一个 | 结果态 | BDD-10,11,12,13 |
| M13 | `DESIGN.md` | L216 菜单文书 `(Settings, Teams, Logout)` → 增 `Publish`（spec §6.3 / P1 I-7） | 设计系统文档同步 | 非 BDD（P7 一致性核对项） |
| M14 | `frontend-v3/e2e/tpv0100-publish.spec.ts`（新增） | E2E：登录 → 选文件 → 填 summary → 发布 → 结果态 → 详情渲染/下载 → 清理 | P5_e2e 载体 |

**共享件**：`PublishFileDraft`（M6 定义，M8/M9/M11 消费）为跨文件共享类型，单文件单批交付（`dispatch_plan: {mode: single}`）无跨批重复风险。

### 1.2 不改什么（Not Modify）——显式边界

| 范围 | 决定不改的理由 |
| :--- | :--- |
| `backend/peekview/**`（全部） | 方案 A：复用既有 `POST /api/v1/entries`，契约未变（本次 curl 实测 `CreateEntryRequest`/`Response` 与 spec §6.4 一致）。**不留任何后端改动** |
| `packages/mcp-server/**` | MCP 工具不新增/不改；`publish_files` 逻辑与本次网页入口互不影响 |
| `CreateEntryRequest` / `FileCreate` 模型 | 无 schema 变更；不新增 `X-PeekView-Source` 头（OQ-1 已结案，创建端点不消费该头） |
| 认证 / 鉴权逻辑 | 复用 httpOnly Cookie `peekview_token`，axios 已 `withCredentials: true`（`client.ts:13`，本次实核） |
| 新增 Pinia store | 页面本地状态足够（spec §6.3 已定）；仅读取既有 `useAuthStore` |
| `EntryDetailView.vue` / 详情渲染链路 | BDD-7 复用既有渲染（文本→`language` 渲染、二进制→`FileResponse` 下载）；本次不改渲染 |
| `local_path` / `dirs` 输入 | spec §1.3 非目标；不暴露服务端路径能力 |
| 压缩包解压 / 文件夹选择 / multipart / 断点续传 | MVP 明确延后（P1 §1 非目标），不预留过度抽象 |
| API key / 团队创建等其它 API | 不在范围内 |
| 既有 E2E spec / seed 数据 | 不修改既有文件；新 E2E 独立成 spec |

### 1.3 风险在哪（Risk + 缓解）

| # | 风险 | 严重度 | 缓解措施 |
| :-- | :--- | :--- | :--- |
| R1 | **文本/二进制误判**：二进制误走 `content` → 后端按文本处理，详情页乱码/无高亮（后端对 `content_base64` 无条件 `is_binary:true`/`language:null`，`entry_service.py:1197-1206`） | 高 | `isBinaryContent` 与后端 `language.py:is_binary_content` 逐分支对齐（NUL→binary；否则严格 UTF-8 解码失败→binary；0 字节→文本）。**已最小验证**：8 样本 JS 端口与后端逐一致（§6） |
| R2 | **幂等键误用**：载荷变却不换键→误命中旧 entry；重试每次换键→重复创建 | 高 | 键绑定「载荷指纹」：`sha256(JSON.stringify(canonicalPayload))` 或提交时生成 UUID + 载荷变更监听重置。设计见 §4.2；BDD-23/24 双向覆盖 |
| R3 | **错误体形状假设错误**：spec §5.6 称"显示后端返回的 detail"，**实测错误体为 `{"error":{"code","message"}}`**（curl 400 实测，见 §6），非 FastAPI 默认 `{"detail":...}` | 中 | 前端错误提取按 `error.response.data.error.message` 优先，兼容 `detail` 兜底。标 `[SCOPE+]`（§8），BDD-26 的判据可满足（"显示后端 detail 原文"→显示 `error.message` 原文），但措辞需 P1 侧确认 |
| R4 | **结果态链接用错源**：`CreateEntryResponse.url` 是**服务端配置的 `base_url`**（`config.py:161,500`，实测返回 `https://peek.gsis.top/...`），非当前浏览器源。BDD-10 要求 `{当前源}/{slug}` | 中 | 前端用 `window.location.origin + '/' + slug` 构造，**不使用** `response.url`；`url` 仅作兜底（§4.3）。标 `[SCOPE+]` |
| R5 | **重复路径覆盖**：后端不查重（`path` 相同的两文件互相覆盖，产生两行 File 记录） | 中 | `validatePublishForm` 内做 `Set` 查重（BDD-18）；默认路径=文件名，同名不同目录文件默认即冲突，被拦下（OQ-3 已决，不额外提示） |
| R6 | **路径逃逸**：`..` / 绝对路径 | 中 | 前端早校验（非空、不以 `/` 开头、不含 `..` 段，BDD-17）+ 后端 `get_disk_path` `resolve()` 兜底（`storage.py:36-61`） |
| R7 | **大包内存/耗时**：base64 膨胀 1.333x（**已实测**），100MB 上限时 JSON ~133MB；无进度回调 | 中 | 提交中禁用按钮（BDD-27）+ loading 文案；超限预校验拦截（BDD-16）；接近上限的体验按 OQ-4 留待 P6 实测再评估方案 B |
| R8 | **限流无预读**：写端点 60/min 无公开接口，只能靠 429 | 低 | 只做 429 提示（BDD-25），不预先读取 |
| R9 | **未登录直达**：`/publish` 守卫漏写 | 中 | 并入 `router.beforeEach` 既有惯例（BDD-5）；E2E 覆盖 |
| R10 | **他人主页误现入口**：`EntryListView` 同时服务 `/explore` 与 `/users/:username` | 中 | 按钮渲染 gate 在 `!props.owner`（BDD-3）；E2E 覆盖 |
| R11 | **限额硬编码**：不读 `/config/limits` | 低 | `getLimits()` 驱动预校验与 `expires_in` 默认（I-1）；接口不可用时降级为"不预校验、交后端"（§4.5） |
| R12 | **`lang` 判定的次要偏差**：文本文件 `language` 由后端 `detect_language(filename)` 决定，扩展名无关时返回 `null`（如 `.log`）——BDD-7 要求"`language` 非 null"须用可识别扩展名（`.md`/`.txt`/`.py`）的 E2E 样本 | 低 | E2E 文本样本用 `.md`（实测 `a.txt`→`language:"text"`，见 §6）；P3 用例明确此前提 |
| R13 | **CSP 是否影响 `btoa`/`TextDecoder`**：均为浏览器内建，非 eval/内联脚本 | 低 | 主应用 CSP `script-src 'self' 'unsafe-eval'` 不影响；`btoa` 已在 `client.ts:191` 既有使用（`getFileAsBase64`），先例存在 |

**架构适应度检查**：本任务无新增架构约束（纯前端复用既有 API 层与组件模式，无跨层穿透、无循环依赖引入）→ **本任务无架构适应度检查**。

---

## 2. 候选方案（candidate_count: 2）

### 方案一（采用）：集中式 composable + 页面内结果态状态机

- **结构**：`useFileEncoding`（纯编码）+ `usePublishValidation`（纯校验）+ `PublishView.vue`（编排）+ 三个展示组件（DropZone/FileList/ResultPanel）。结果态 = `PublishView` 内 `phase: 'form' | 'submitting' | 'done'` 状态机，**不新增路由**。
- **幂等键**：`idempotencyKey` ref；首次提交生成 `crypto.randomUUID()`；载荷指纹（canonical JSON 的 hash）变化时重置；成功后"再发一个"重置。
- **优点**：纯逻辑与 UI 分离 → `isBinaryContent`/`validatePublishForm` 可直接 vitest 单测（BDD-30 单元可测）；结果态无路由切换 → 表单状态天然保留（BDD-23）；符合 spec §6.3 定稿模块划分；拆分粒度对齐 `EntryDetailView` 的教训（不造 god component）。
- **风险/工作量**：文件多（4 新增组件/组合式 + 3 改动文件）；需处理 `getLimits` 未就绪时的表单禁用时序。工作量：**中**。

### 方案二（真替代）：单文件页面 + 路由化结果态

- **结构**：全部逻辑内联 `PublishView.vue`（含编码/校验函数），结果态走独立路由 `/publish/done`，结果数据经 `history.state` 或一个轻量 Pinia store 传递。
- **优点**：①结果态可分享/可刷新（URL 直达结果页）；②单文件改动，文件数少；③结果态有独立 URL，E2E 断言"地址变为 `/publish/done`"更简单（BDD-10/12 的地址类判据更好写）。
- **风险/工作量**：①**破坏 BDD-23 的"表单保留"语义**——失败后用户若刷新/前进后退，表单状态丢失；②路由化结果态需要额外守卫（未登录/无结果数据时回退）；③编码/校验逻辑内联 → 单测需挂载组件（vitest + `@vue/test-utils`），比纯函数测试慢且脆；④刷新结果页需持久化结果数据，引入新 store 与序列化问题。
- **在本任务维度上它更好的地方**：结果态可分享。但 P1 目标（"发布完立即拿到链接交给 Agent"，BDD-10/12 只要求同页展示与跳转详情）**不需要**结果页可分享；反而 BDD-23 的"失败保留表单"是硬验收项，方案二在此维度更差。

### 方案对比与选择理由

| 维度 | 方案一（采用） | 方案二 |
| :--- | :--- | :--- |
| BDD-23 失败保留表单 | ✅ 状态机同页，天然保留 | ❌ 路由切换/刷新丢状态 |
| BDD-30 单元可测 | ✅ 纯函数直接测 | ⚠️ 需挂载组件 |
| 结果态可分享 | ❌（P1 不要求） | ✅（需求外收益） |
| 文件数与维护性 | ⚠️ 4 新增文件（按 spec 定稿拆分） | ✅ 单文件 |
| 与 spec §6.3 定稿一致性 | ✅ 完全一致 | ❌ 偏离 |
| 守卫/数据传递复杂度 | ✅ 无 | ⚠️ 需新守卫 + 状态持久化 |

**选择方案一**。决定性理由：本方案的验收客户是 BDD-23（失败重试保留表单不重复创建）与 BDD-30（编码规则纯函数可测）；方案二在这两条核心 BDD 上更差，其唯一优势（结果页可分享）不在 P1 需求内（YAGNI）。方案二作为真替代被探索并记录——它不是稻草人：若未来出现"结果页需可分享/可刷新"的真实需求，应重新评估方案二并补持久化设计。

> `design_trivial: false`；`follows_existing_pattern` 部分适用（`api/client.ts` 的 TS 类方法模式、`data-testid` 测试标识惯例、`useToast` 反馈惯例），但新增编码/幂等语义非 trivial，故保留 2 候选。

---

## 2.x UI 维度候选与权衡（布局 / 视觉 / 交互三组，各 ≥2 候选）

> 本节是**角色硬规则**要求的「布局/视觉/交互方案各 ≥2 候选 + 权衡」落点，与 §2 的架构候选分开（§2 的 `candidate_count: 2` 只计**架构**候选，本节候选为 UI 维度取舍、不改 `candidate_count` 语义）。
> 三组均为**真替代探索**（非稻草人）——每个被否候选至少在一个具体维度上优于采用项；被否理由落到本任务可验证的验收项（BDD 编号）。

### 2.x.1 布局结构：页面容器与栏型

| # | 候选 | 优点 | 风险 | 工作量 |
| :-- | :--- | :--- | :--- | :--- |
| L1（采用） | **单列窄栏居中**：`.publish-content` = `max-width: 720px; margin: 0 auto`；桌面/移动同 DOM 单列 | ①表单字段与文件列表**单眼可读**、无需横向移动；②`summary` 一个 500 字字段在大宽容器里行宽过长、阅读节奏差，720px 落在可读行宽区间；③移动端天然同构（仅 padding/换行），布局分支最少 | 与 DESIGN.md §4 functional 1280px 规则**偏离**——须显式记录例外（见 §3.1.1） | 低 |
| L2 | **复用 Settings 的 1280px functional 容器**（与 Explore/Settings 完全对齐，零偏离） | ①与设计系统**零例外**、评审无摩擦；②桌面下与既有功能性页面视觉一致 | ①表单被拉到 1216px 内容宽，`summary`/`slug` 输入行宽过长，与「Keep functional views compact and scannable」（DESIGN.md §12）相悖；②文件行内「文件名 + 徽标 + 路径输入 + 移除」被拉散，左右视线跨度大；③内容实际利用率低（右侧大片留白） | 中（须改表单内部栅格） |
| L3 | **两栏（表单 + 实时文件预览）**：左栏表单/右栏 `PublishFileList` 实时预览 | ①文件较多时预览区可独立纵向滚动，长列表不把表单推下屏；②「所见即所得」预览符合编辑类界面直觉 | ①**移动端必须塌回单列**（仍要写两套布局），复杂度翻倍；②当前任务最多 50 文件，长列表是**低频分支**，两栏收益被支付成本超过；③文件列表本身已是「行编辑 + 状态」组件，拆到右栏后 drop 区与列表的上下紧邻关系被破坏（BDD-9 的"编辑路径后看结构"在右栏仍成立，但拖入→出现的动线变长）；④新增横向栅格与隐藏逻辑，属 YAGNI | 高 |

**选择 L1（单列 720px 窄栏）**。决定性理由：本任务的验收对象是**表单密集的可读性**（BDD-14~19/29 字段与提示密度高）与**移动端同构**（BDD-9/10 需在 390 视口截图）；L2 在"零偏离"维度更优但牺牲可读性（DESIGN.md §12 明确要求 functional views compact and scannable），L3 在长列表维度更优但本任务列表上限 50 且低频。**720px 的偏离按 DESIGN.md §4 自身的例外体例显式记录**（见 §3.1.1 新增子节），与 detail `.content-area` 的 12px/8px 例外同属"scoped, deliberate override"。

### 2.x.2 结果态视觉形态

| # | 候选 | 优点 | 风险 | 工作量 |
| :-- | :--- | :--- | :--- | :--- |
| R1（采用） | **替换主区**：`phase='done'` 时主区 `v-if` 切换渲染 `PublishResultPanel`，表单整体隐藏 | ①**焦点集中**——结果态只有"复制链接 / 查看详情 / 再发一个"三个动作，无表单噪声；②DOM 切换明确，可用 `aria-live` 公告状态跃迁（BDD-10/12/13 断言单一结果区存在，E2E 判据干净）；③与 §2 方案一"同页状态机"直接咬合 | ①用户若想"改一下再发"须先点「再发一个」（表单已隐藏）；②须显式处理焦点迁移（否则读屏用户在原地丢失上下文） | 低 |
| R2 | **顶部成功横幅 + 保留下方表单**（表单不隐藏，顶部插入成功条 + 链接） | ①「改一点再发」最顺手（表单原地保留）；②成功信息与后续操作同屏 | ①**关键链接与表单混排**——BDD-10 的"结果区"边界模糊，E2E 断言"结果区"需额外去重（表单里也有 summary/slug 文本，易误判）；②成功态与表单态**同时存在**，状态机语义退化（`phase` 无法二值表达），与 §2 方案一冲突；③视觉噪声最大（长表单 + 顶部条），结果链接易被滚出视口 | 中 |
| R3 | **Toast + 跳转详情**：发布成功 → `useToast.success()` + `router.push('/' + slug)`，不渲染结果态 | ①代码最少（复用既有 `useToast`，见 `useToast.ts`：`show(message, variant)`）；②直接进详情页，符合"发布完就想看"直觉 | ①**直接违反 BDD-10**（要求"同时展示页面链接与 Raw 链接"且**各有复制按钮**）与 BDD-12（结果态**可**跳转详情——是动作不是自动跳转）；②Toast 3s 自动消失（`useToast.ts` setTimeout 3000），用户来不及复制 Raw 链接；③Raw 链接"给 Agent 用"的标注语义（BDD-11）无处安放。**判为不可行，非权衡取舍** | 低 |

**选择 R1（替换主区）**。决定性理由：BDD-10/12/13 把结果态定义为**一个独立的、含两条可复制链接与两个动作的状态**——R3 直接把该状态删除（且 Toast 3s 消失使链接不可用），R2 让结果态与表单态并存导致状态机退化且 E2E 断言边界模糊。R1 唯一代价（表单被隐藏）由 BDD-13 的「再发一个」显式覆盖为**一等动作**，不是缺失。保留 R2 为"若未来出现'批量微调再发'需求"的再评估项。

### 2.x.3 文件行编辑交互

| # | 候选 | 优点 | 风险 | 工作量 |
| :-- | :--- | :--- | :--- | :--- |
| E1（采用） | **内联行编辑**：每行 `.file-row` 内联 `<input>` 直接编辑 `path`，行内移除按钮 | ①**零额外层级**——路径是短字符串（多为 `文件名` 或 `目录/文件名`），行内输入最直接；②键盘流自然（Tab 依次过每行路径输入）；③与 `TeamsView.vue` 的**成员输入行**模式一致（既有惯例，见 `TeamsView.vue:110-121`）；④行级错误可就地落在该行（BDD-17/18 要求"对应行被标记"） | ①50 行时 Tab 需穿过 50 个输入框；②无拖拽排序能力 | 低 |
| E2 | **点击弹层编辑**：行内只显示只读路径，点击 → 弹层（`alertdialog`）编辑该文件 path | ①行内视觉最干净（只读文本）；②弹层内可放路径校验提示 + 目录建议 | ①**模态打断**——编辑 5 个路径 = 弹 5 次，动线冗长；②DESIGN.md §10 要求 `alertdialog` role + `aria-labelledby`，a11y 实现面变大；③BDD-17/18 的"对应行被标记"须在弹层关闭后**回写**行状态，多一层状态同步；④行内已能容纳一个短输入，弹层收益（"干净"）低于成本 | 高 |
| E3 | **拖拽排序改路径**：拖拽行到目录节点以决定路径结构（树形 UI） | ①构造嵌套目录（BDD-9）最直观——"拖进 `src/` 就成 `src/x`"；②无需手输路径 | ①须先引入**树形容器**（目录节点 + 拖拽实现），与"最多 50 文件的扁平表单"量级不匹配；②**键盘不可达**（DESIGN.md §10「all interactive elements must have visible focus indicators」+ 表单须键盘可完成），须再造键盘等价操作，成本翻倍；③BDD-9 只要求"手工改为 `src/b.cs` 后结构正确"，手输已满足；④移动端拖拽与滚动冲突，390 视口体验风险高 | 高 |

**选择 E1（内联行编辑）**。决定性理由：BDD-9 的验收是**"手工改为 `src/b.cs` → 结构正确"**（手工文本编辑即可满足），BDD-17/18 要求"对应行被标记"——内联编辑让"编辑点"与"错误标记点"**同一行**，是三条候选里唯一零跨层同步的；E1 还与 `TeamsView` 既有输入行惯例一致（`follows_existing_pattern`）。E3 在"构造嵌套目录"维度确实更优，但代价是键盘可达性再造 + 树容器引入（YAGNI，50 文件量级不必要），记为**未来若支持目录拖拽再评估**。

---

## UI 设计

### 渲染形态声明（必填，与 P1 形态声明一致）

- 渲染形态: layout（布局型）
- 适用维度: 布局结构 / 交互行为 / 视觉呈现

> 与 P1 frontmatter `ui_render_shape: layout` + `ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]` 严格一致。本任务为常规表单+列表+结果态布局，非渲染组件型、非时序特效型。

### 3.1 布局 checklist（布局结构维度）

- [x] **页面/组件层级结构已描述**：`PublishView` = 顶部 Header（logo + `UserMenu`/`AuthButton` + `ThemeToggle`，复用 `EntryListView` 的 `.explore-header` 模式）→ 主区 `.publish-content`（`max-width: 720px` 居中）：summary 区 → 文件区（`FileDropZone` + `PublishFileList`）→ 可选字段区（slug/tags/可见性/过期/团队）→ 主操作区（Publish 按钮）→（结果态）`PublishResultPanel`。桌面/移动同 DOM，仅 CSS 换行。
- [x] **关键区域占位关系已描述**：单列纵向流；`FileDropZone` 与 `PublishFileList` 上下紧邻（drop 区在上，选中文件列表在下）；结果态**替换**主区内容（同一容器内 `v-if` 切换，非弹层）。占位取舍依据见 §2.x.2（替换主区 vs 顶部横幅 vs Toast），布局栏型取舍见 §2.x.1。
- [x] **桌面与移动两档 viewport 布局均说明**：desktop `1280×800`（P1/P3 截图档）主区居中 720px；mobile `390×844` 主区全宽 `padding: var(--space-4)`，文件行内「路径输入」换行到文件名下方（`.file-row` 改 `flex-wrap`），主按钮 `min-height:44px` 全宽可达。

#### 3.1.1 容器宽度：720px 偏离 DESIGN.md §4 的记录（scoped, deliberate override）

DESIGN.md §4 规定 functional view 容器 `max-width: 1280px` + desktop `padding: 32px`。本页面**故意使用 `max-width: 720px` 居中**，属与 detail `.content-area` 同体例的**例外**（DESIGN.md §4 自身写明例外须"scoped, deliberate override, not a violation"）：

| 项 | 值 | 与 DESIGN.md §4 的关系 |
| :--- | :--- | :--- |
| 内容容器 `max-width` | `720px` | **偏离** 1280px（functional 默认） |
| 居中 | `margin: 0 auto` | 一致 |
| desktop padding | `var(--space-4)`（16px，随 720 容器） | 偏离 32px——因容器已窄，再叠 32px 双侧内边距使实际可读宽 < 660px，故取 16px |
| 例外理由 | 表单页是**字段密集的阅读/输入界面**：`summary`（≤500 字）、`slug`、文件行 path 均以**单列文本输入**为主，720px 匹配可读行宽；DESIGN.md §12 要求「Keep functional views compact and scannable」 | 覆盖准则：可读性准则（§12）优先于容器默认值（§4），且 §4 已确立"例外需显式记录"的体例 |
| 作用域 | 仅 `.publish-content`；Explore/Settings/Detail 的容器规则**不动** | scoped |

> 该例外为**布局栏型候选 L1 的选择结果**（对比 L2 零偏离 1280px / L3 两栏，见 §2.x.1）。

#### 3.1.2 tablet 断点（DESIGN.md §9 三档补齐）

DESIGN.md §9 定义三档：Mobile `≤640px` / Tablet `641–1023px` / Desktop `≥1024px`。本页面**显式声明 tablet 与 desktop 同构**（不新增 tablet 布局分支）：

- `641–1023px`：`.publish-content` 仍为 `max-width: 720px` 居中，`padding: var(--space-4)`；**与 desktop 同构**（720 < 1023，容器未被视口压缩）。
- 唯一的断点行为是 **`≤640px`**：主区 `width: 100%`、`.file-row` 换行、主按钮全宽 `min-height:44px`。
- 移动端导航差异（DESIGN.md §9「Overflow menus: dropdown on desktop, bottom sheet on mobile」）：`UserMenu`（M2 新增 Publish 项）沿用**既有组件自身**的移动端表现，本任务不新增菜单逻辑（§1.2 Not Modify：不改 `UserMenu` 的响应式行为，仅加一项）。

#### 3.1.3 结果态与错误态在 mobile_390x844 的布局

| 状态 | 390 视口布局（P3/P6 截图验证 BDD-10/17/18） |
| :--- | :--- |
| **结果态**（BDD-10） | `PublishResultPanel` 单列堆叠：页面链接块 → Raw 链接块 → 「查看详情」/「再发一个」按钮**纵向排列、各占全宽**（`min-height:44px`）。链接值 `word-break: break-all`，`pageLink`/`rawLink` 的复制按钮置于各自链接行的**下方**，避免 44px 触控目标与链接文本挤在一行导致溢出；`document.documentElement.scrollWidth ≤ 390`（§3.3 断言⑤）。 |
| **文件行错误态**（BDD-17/18） | `.file-row` 在 `≤640px` 已 `flex-wrap`：第一行 = 文件名 + 文本/二进制徽标，第二行 = path 输入（全宽），第三行 = 移除按钮；**行级错误文本 `.file-row-error` 追加为第四行**（不悬浮、不弹出），故错误态仅增加行高，不产生横向溢出，也不会与 input 重叠（§3.3 新增断言⑥）。 |
| **顶部汇总错误条**（BDD-14/25/26） | 全宽、`position: static`（不 sticky），错误文本 `word-break: break-word`，不遮挡主按钮。 |

### 3.2 交互 checklist（交互行为维度）

- [x] **键盘可达性**：Tab 顺序 = summary 输入 → DropZone（内含隐藏 `<input type="file">` 的可见触发按钮，`Enter`/`Space` 打开文件选择）→ 每文件行（路径输入可 Tab）→ 移除按钮 → slug → tags（回车添加）→ 可见性 → 过期 → 团队 → Publish 按钮；焦点可见沿用全局 `:focus-visible`；DropZone 支持 `Enter`/`Space` 激活。行编辑交互取舍见 §2.x.3。
- [x] **输入态变化已定义**：summary 实时字数计数（`n/500`，取自 limits）；可见性文本随开关更新（BDD-29）；文件选择/移除后行数与总量实时更新；slug 输入即早校验。
- [x] **反馈态已覆盖**：loading（`submitting` → Publish 按钮 `disabled` + 文案"发布中…"，BDD-27）、error（顶部汇总条 + 字段级/行级提示，BDD-14~19/25/26）、empty（未选文件时文件列表空态提示"至少选择一个文件"，BDD-15）、disable（提交中所有输入 `disabled`）。
- [x] **输入态变化类用例需人工复核**：BDD-29（可见性文本随切换更新）、BDD-13（再发一个清空）→ 宣称需 P6 人工复核截图。
- [ ] [渲染组件型可选] 手势/动作交互：**维度不适用**（布局型，无旋转/缩放/拖拽图形）。

#### 3.2.1 过渡/动效（DESIGN.md §8 档位）

- 提交中 → 结果态的**状态跃迁不做入场动画**（DESIGN.md §12「Don't animate content entrances in data-dense views」）；结果态内部元素 `v-if` 直接出现。
- 结果态 → 「再发一个」回表单态：同样**不做入场动画**，仅焦点迁移（见 §3.2.2）。
- 允许的过渡仅限**颜色/背景/边框**类（`:hover`、`disabled`、输入聚焦边框），取 `var(--transition-fast)`（150ms，对应 DESIGN.md §8 Fast）；采用 `BaseButton` 时其内部已用 `var(--transition-fast)`（实读 `BaseButton.vue`）。
- DropZone dragover 高亮态用 `var(--transition-fast)` 过渡 `border-color`/`background`（不缩放、不出现入场动画）。
- DESIGN.md §8 Medium（250ms）/ Slow（350ms）**本页面不使用**（无 transform/overlay/模态）；`prefers-reduced-motion: reduce` 下沿用全局行为（`BaseButton.vue` 已内置 `transition: none` 规则）。

#### 3.2.2 程序化焦点管理（承接 §3.4 a11y 契约）

| 触发 | 焦点落点 | 依据 BDD |
| :--- | :--- | :--- |
| 预校验失败（点提交但校验不过） | 顶部汇总条（`role="alert"` + `tabindex="-1"`）→ 读屏播报后由用户 Tab 进首个错误字段 | BDD-14/15/16/19 |
| 后端错误（400/422/429/5xx） | 顶部汇总条（`role="alert"`）；表单保留 | BDD-23/25/26 |
| 提交成功 → 结果态 | 结果态标题容器（`tabindex="-1"`，`aria-live` 见 §3.4）获焦 | BDD-10/12 |
| 「再发一个」重置 → 表单态 | **summary 输入框**获焦 | BDD-13 |

- 提交中所有输入 `disabled`（BDD-27）时，Publish 按钮 `disabled` 后**保持**其 DOM 位置（不卸载），避免焦点丢失到 `<body>`；提交结束（成功或失败）后按上表迁移焦点。

### 3.3 视觉 checklist（视觉呈现维度，判据为可量化 DOM 度量）

> 视觉契约以「宽度/高度/对齐/重叠/溢出」五类 DOM 度量表达（E2E 以 `getBoundingClientRect` 采集），不收主观视觉。

- [x] **颜色/对比度已说明**：全部使用既有 CSS 变量（`--c-accent`/`--c-surface`/`--c-error`/`--c-text`）；Publish 主按钮 = `BaseButton` primary 变体（`--c-accent` 底 + `--text-on-accent` 字），沿用既有 WCAG AA 配色（body 文本 ≥4.5:1、大字 ≥3:1，DESIGN.md §10），**不新造色值**、不使用组件内 `color-mix()`（DESIGN.md §12）。错误色用 `--c-error` 文本 + `--c-badge-private-bg`（既有 error 语义别名）作底，**不单以颜色传意**——错误行/字段同时有文本提示 + `role="alert"`（§3.4）。
- [x] **字体层级与间距节奏已说明**：标题 `--font-lg`/`--font-xl`、正文 `--font-sm`、辅助 `--font-xs`；区块间距 `--space-4`/`--space-5`（4px 网格）；输入框高度 `min-height:44px`（移动可达）。**mono 场景**（DESIGN.md §3「Eyebrow/Meta 用 Mono」「文件路径/ID 用 mono」+ §12「Use monospace for code, commands, file paths, IDs」）：①文件行 path 输入与展示用 `var(--font-mono)`（`variables.css:21`）；②结果态 `pageLink`/`rawLink` 值与 slug 展示用 `var(--font-mono)`；③tags 徽标沿用 `BaseTag`（其样式已含 `font-family: var(--font-mono)`，实读 `BaseTag.vue:27`）。
- [x] **组件一致性已说明**：复用 `BaseButton`/`BaseTag`/`PageHeader`/`EmptyState`/`useToast`，圆角 `--radius-md`、阴影 `--shadow-md`、图标 `lucide-vue-next`。**"与 Settings 页表单节奏一致"的具体含义**（可核对）：字段块间距 `--space-4`、`<label>` + 输入 + 错误文本的 `form-field` 三段式结构、错误文本用 `.field-error`（`--font-xs` + `--c-error`）——与 `ProfileTab.vue`、`TeamsView.vue` 的既有表单结构同构。
- [x] **light/dark 双主题验证项**（DESIGN.md §12「Test every change in both dark and light themes」）：P3/P6 须在**两套主题**下各截图比对——①`.publish-content` 背景/边框/文本色（`--c-surface`/`--c-border`/`--c-text` 均有 light 分支，实读 `variables.css:109-140`）；②`BaseButton` primary 在 light/dark 的 `--c-accent`/`--text-on-accent` 对比度均 ≥4.5:1；③错误文本 `--c-error` 在两主题下可读；④`.field-error`/行错误态在两主题下不因底色变化失去对比。**双主题是二值验证项**（每主题各一轮截图 + vision 确认），不是可选。
- [x] **可量化断言清单（P3/P6 用）**：①主区宽度在 desktop 1280 下 `≤720px` 且水平居中（左右外边距差 `≤2px`）；②Publish 按钮高度 `≥44px`；③文件行「文本/二进制徽标」与文件名不重叠（两个 `getBoundingClientRect` 无交叠或行内先后排列）；④summary 计数文本不溢出其容器（`scrollWidth ≤ clientWidth`）；⑤移动 390 下主区无横向溢出（`document.documentElement.scrollWidth ≤ 390`）；⑥**结果态**（BDD-10）：两个链接块与各自复制按钮**不重叠**（`getBoundingClientRect` 无交叠），链接值元素 `scrollWidth ≤ clientWidth`（长链接在块内换行、不撑破容器）；⑦**文件行错误态**（BDD-17/18）：`.file-row-error` 与该行 path 输入**不重叠**且位于其下方（`error.top ≥ input.bottom - 1`），行错误出现后 `document.documentElement.scrollWidth ≤ 390`（390 视口）与 `≤ 1280`（desktop）；⑧**mono 断言**：文件 path 输入元素的 `getComputedStyle().fontFamily` 含 `JetBrains Mono`（即 `var(--font-mono)` 生效）。

### 3.4 可访问性契约（a11y，承接项目既有惯例）

> **承接源**（实读）：`ProfileTab.vue:21,106`（`<label>` + `.field-error`）与 `TeamsView.vue:34-38,117-121`（`aria-describedby="xxx-error"` + `<p id="xxx-error" class="field-error" role="alert">`）。本页**逐字段复用同一三件套**，不新造 a11y 模式；DESIGN.md §10 的「Form inputs must have associated `<label>` or `aria-label`」+「visible focus indicators」+「color alone must not convey meaning」为验收依据。

#### 3.4.1 字段 ↔ 错误关联（`aria-describedby` + `aria-invalid` + `role="alert"`）

| 字段 | `<label>`（可见） | 错误元素 id | 关联 | 错误渲染 |
| :--- | :--- | :--- | :--- | :--- |
| summary 输入 | `Publish`/`Summary`（可见 `<label for="publish-summary-input">`） | `publish-summary-error` | input 加 `aria-describedby="publish-summary-error"`；错误时加 `aria-invalid="true"` | `<p v-if="summaryError" id="publish-summary-error" class="field-error" role="alert">` |
| slug 输入（可选） | 可见 `<label for="publish-slug-input">` | `publish-slug-error` | 同上 | 同上（BDD-19 就地提示） |
| tags 输入 | 可见 `<label for="publish-tags-input">Tags</label>` + 视觉提示"回车添加" | `publish-tags-hint` | `aria-describedby="publish-tags-hint"`（**提示恒在**，非错误） | `<span id="publish-tags-hint" class="field-hint">输入后按 Enter 添加</span>`（`.field-hint` 新样式取 `--font-xs` + `--c-text-tertiary`，与 `.field-error` 同构仅换色；`.sr-only` 已全局存在于 `base.css:116` 可复用） |
| 文件 path 输入（每行） | 无可见 label（行内视觉已有文件名），用 `aria-label` | `publish-file-error-{fileId}` | `:aria-label="'相对路径：' + filename"`；`:aria-describedby="'publish-file-error-' + fileId"`；错误时 `:aria-invalid="!!fileErrors[fileId]"` | `<p v-if="fileErrors[fileId]" :id="'publish-file-error-' + fileId" class="field-error file-row-error" role="alert">` |
| 可见性开关 | 可见文本标签 + `publish-visibility-text`（BDD-29） | — | 开关 `aria-describedby` 指向可见性文本（`publish-visibility-text`） | 恒在的可见文本 |
| 过期/团队下拉 | 可见 `<label for=...>` | — | 无独立错误 | — |
| 顶部汇总条 | — | `publish-error-summary`（testid） | `role="alert"` + `tabindex="-1"`（供 §3.2.2 焦点迁移） | `<div role="alert" tabindex="-1" data-testid="publish-error-summary">` |

- **id 稳定性**：文件行错误 id 用 `fileId`（稳定标识，非 index——见 §4.10），保证删除中间行后 `aria-describedby` 不指错行。
- **颜色不单独传意**（DESIGN.md §10）：错误同时有 `role="alert"` 文本 + `--c-error` 色 + `aria-invalid`。

#### 3.4.2 提交中 / 状态跃迁公告

| 语义 | 实现 | 依据 |
| :--- | :--- | :--- |
| 提交进行中 | 主表单容器 `aria-busy="true"`；Publish 按钮 `disabled` + 文案"发布中…"（由页面自管 slot 文案，**不改 `BaseButton`**——`BaseButton.vue` 无 `loading` prop，仅 `disabled`，实读确认） | BDD-27 |
| 提交进度公告 | `<div role="status" aria-live="polite" class="sr-only">` 提交时文案"正在发布…"，完成后更新为"发布成功" | BDD-27 |
| 结果态跃迁 | 结果容器 `role="status" aria-live="polite"`；成功后焦点迁移至结果态标题（§3.2.2） | BDD-10/12 |
| 错误类跃迁 | 汇总条 `role="alert"`（隐式 `aria-live="assertive"`），无需额外 live 区 | BDD-14~19/25/26 |

- 不使用 `role="alert"` 承载**非错误**的成功消息（避免 assertive 打断），成功走 `aria-live="polite"`。

---

## 4. 详细设计

### 4.1 数据流

```
File[] ──useFileEncoding.readFileAsEncoded──► PublishFileDraft[{fileId, file, path, encoded, ...}]
表单字段 + drafts ──usePublishValidation.validatePublishForm(..., limits)──► {ok, errors: {summaryError, slugError, fileErrors[fileId], globalError}}
ok ──buildPayload(drafts, fields, idempotencyKey)──► POST /api/v1/entries
   201/200 ──► PublishResult（slug/expiresAt 由响应取；pageLink/rawLink 由 window.location.origin 拼）
   400 ──► extractApiErrorMessage: error.message 原文
   422 ──► extractApiErrorMessage: detail[].msg 拼接（见 §4.6 形状表）
   429/5xx ──► 固定/通用文案 → 顶部汇总 + 保留表单
```

### 4.2 幂等键（BDD-13/23/24）

- **生成**：`crypto.randomUUID()`（浏览器内建，无需依赖）。
- **复用条件**：失败后**原样重试**（summary/slug/tags/is_public/expires_in/team_id/文件集合/每文件 `path` 均未变）→ 复用当前 key。
- **重置触发**：①任一表单字段变更；②文件集合增删/重排；③任一文件 `path` 编辑；④提交成功后点「再发一个」。实现：`watch` 一个 `payloadFingerprint` computed（canonical JSON string），变化即 `idempotencyKey = null`（下次提交时重新生成）。
- **语义边界**：若用户编辑后又改回原值，指纹相同 → 会复用旧 key，命中旧 entry（正常幂等语义，符合 spec §6.5）。
- **测试标识**：幂等键不出现在 DOM；E2E 通过"同载荷重试 → 数据库仅 1 条 / 编辑后重试 → 新增 1 条"验证（BDD-23/24）。

### 4.3 结果态（BDD-10/11/12/13）

- **形态**：`PublishView` 内 `v-if` 切换，主区渲染 `PublishResultPanel`（不新增路由；理由见 §2 方案选择）。
- **链接构造**：`pageLink = window.location.origin + '/' + slug`；`rawLink = window.location.origin + '/' + slug + '/raw'`。**不使用** `response.url`（实测为服务端 `base_url`，见 R4）。
- **复制**：`navigator.clipboard.writeText(link)`，失败降级 `useToast` 提示"复制失败，请手动选择"；两个链接各有独立复制按钮 + `data-testid`。
- **过期时间**：展示 `expires_at`（格式化本地时间）。
- **动作**：`查看详情` → `router.push('/' + slug)`（BDD-12）；`再发一个` → 重置全部表单态 + 重置幂等键（BDD-13）。
- **Raw 链接标注**："给 Agent 用"，突出免认证可读（BDD-11）。
- **「再发一个」的内存释放（R7 缓解）**：重置时除清空表单字段外，必须**显式释放编码缓存与 `FileDraft` 引用**——①清空 `drafts` 数组（每个 draft 的 `encoded` 字符串一并丢弃）；②清空 `fileErrors`/`fileId 映射`；③`idempotencyKey = null`；④对大文件场景，`drafts` 置空后由 GC 回收（`File`/`ArrayBuffer`/base64 字符串均无其他引用）；⑤**不保留**上一次发布用的 `files: File[]` 或 base64 于任何持久 ref。设计约束：编码结果只存在 `drafts` 内，**禁止**另建模块级/全局缓存（否则「再发一个」无法释放，R7 内存风险在连发场景累积）。

### 4.4 编码规则（BDD-6/7/8/30）

```ts
// useFileEncoding.ts
export function isBinaryContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false          // 0 字节 → 文本（对齐后端）
  if (bytes.includes(0)) return true            // 含 NUL → 二进制
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return false }
  catch { return true }                          // 非严格 UTF-8 → 二进制
}
```
文本 → `content: string`（`new TextDecoder().decode`，**fatal:false 时已确定合法**）；二进制 → `content_base64: arrayBufferToBase64(buf)`（分块 `String.fromCharCode.apply` + `btoa`，避免大文件爆栈，对齐 `client.ts:186-191` 既有 `getFileAsBase64` 模式）。每文件同时给 `filename`（叶子名）与 `path`（默认=文件名，可编辑）。

### 4.5 预校验（BDD-14~19）

`validatePublishForm(input, limits)` 返回结构见 §1.1 M8。规则：
- summary：trim 后非空（BDD-14）+ `≤ max_summary_length`（500）。
- 文件：`≥1`（BDD-15）；`≤ max_entry_files`（50）；每个 `size ≤ max_file_size`（20MB）并在提示中**指出文件名**；总量 `≤ max_entry_size`（100MB）并提示当前总量（BDD-16）。
- path：非空、不以 `/` 开头、不含 `..` 段（BDD-17）；`path ≤ 500` 字符、叶子名 `≤ 255`（对齐 `FileCreate`）；同 entry 内不重复（BDD-18）。
- slug（填了才校验）：`^[a-z0-9_-]+$` 且 `≤ max_slug_length`（64）——**实读对齐** `entry_service.py:221-226` + `models.py:25-26`（BDD-19）。
- 错误展示：字段级就地 + 顶部汇总条（总结性），行级错误标红对应文件行；字段与错误的 `id`/`aria` 关联见 §3.4.1。

> **`fileErrors` 的 key 契约（rev1 修订，替换原 `Record<idx,msg>`）**：`fileErrors` 是 **`Record<string, string>`**，key 为**稳定 `fileId`**（`crypto.randomUUID()` 在文件加入时生成并**随条目绑定**，见 §4.10.2），**不用数组 index**。理由：用 index 作 key 时，删除中间行/重排后，同一 index 会指向另一个文件，导致"第 2 行的错误出现在第 3 行"——这是 BDD-17/18「对应文件行被标记」的正确性缺口。删除行时该 fileId 对应的 `fileErrors` 条目**同步删除**（避免残留键污染后续同 id 判断），不做任何 index 重映射（因为根本不使用 index）。`validatePublishForm` 返回的 `fileErrors` 以 `fileId` 为键（见 §1.1 M8 更新）。

### 4.6 提交与失败（BDD-23~27）

- `phase='submitting'`：所有输入 `disabled`，Publish 按钮 `disabled` + 文案"发布中…"（由页面自管 slot 文案，`BaseButton` 无 loading prop，见 §3.4.2）（BDD-27）。
- 成功（201 或幂等命中 200）：`phase='done'`，渲染结果态。**200 与 201 在 UI 上不区分**（BDD 不要求），不做"已存在同名 entry"提示。
- 401：由 axios 拦截器统一处理（登出 + `peekview:auth-expired`），页面随 auth 变化回首页守卫。
- **错误体提取口径（区分两种形状，BDD-26 双路径均可读）**：

  | 状态码 | 形状 | 提取 | 渲染 |
  | :--- | :--- | :--- | :--- |
  | **400**（`PeekError`：`InvalidSlugError`/`ValidationError` 等，实测确认） | `{"error":{"code","message"}}` | `err.response.data?.error?.message` | 直接渲染该字符串 |
  | **422**（FastAPI 默认校验失败；`main.py` **无 `RequestValidationError` handler**，评审实核） | `{"detail":[{loc,msg,type},...]}`（**数组**） | `err.response.data?.detail` → 若 `Array.isArray`，映射为 `` detail.map(d => d?.msg ?? JSON.stringify(d)).join('；') `` | 拼接后的可读文本（**禁止** `String(detail)` → 会渲染 `[object Object]`） |
  | 429 | `{"error":{"code":"RATE_LIMITED",...}}`（实核 `main.py:397`） | 固定文案 | "请求过于频繁，请稍后重试"（BDD-25） |
  | 5xx/网络 | 可能无 body | 通用文案 | 保留表单 + 复用幂等键（BDD-23） |

  **统一提取函数** `extractApiErrorMessage(err): string`（放 `api/client.ts` 或页面工具，供 BDD-26 两路径复用）：依次尝试 ① `data.error.message`（400）；② `data.detail` 为字符串 → 原样；③ `data.detail` 为数组 → `detail.map(d => d.msg ?? JSON.stringify(d)).filter(Boolean).join('；')`（422）；④ 兜底 `err.message` 或"发布失败，请稍后重试"。**不论哪种形状，结果均为非空字符串**，再交给顶部汇总条 `role="alert"` 渲染（§3.4.1），确保 BDD-26"显示后端 detail 原文"在两条路径都可读。
- 429：固定文案"请求过于频繁，请稍后重试"（BDD-25），保留表单。
- 5xx/网络：通用错误提示，保留表单 + 复用幂等键（BDD-23）。
- `getLimits` 失败：**降级**为"不发预校验（仅做 summary 非空、≥1 文件），交后端校验"，`expires_in` 默认 `'15d'` 常量兜底；不阻塞发布。

### 4.7 团队选择（BDD-21）

`team_id` 下拉数据来自既有 `api.listTeams()`（`client.ts:491`），仅在已登录且有团队时渲染；选团队时后端强制 `is_public=false`（`entry_service.py:259-261`），前端 UI 提示"选择团队后将变为团队可见"。

### 4.7.1 slug 覆盖语义的 UI 提示（P1 I-6）

P1 I-6 明确「填了 slug 时若与已有 entry 冲突，后端走覆盖路径（immutable update），**需让用户知晓语义**」。前端无法预知 slug 是否已存在（无公开查重接口），故采用**常驻提示**而非"检测到冲突才提示"：

- **位置**：`slug` 字段下方的恒在 `field-hint`（`--font-xs` + `--c-text-tertiary`）文案：**"自定义 slug 若与已有记录相同，将覆盖该记录（原内容被替换）"**。
- **触发**：slug 字段一旦非空即显示该提示（不依赖任何网络请求）；字段为空时不显示（默认由后端生成，不存在覆盖）。
- **a11y**：该提示元素 id = `publish-slug-hint`，slug 输入 `aria-describedby="publish-slug-hint"`（与 §3.4.1 一致，提示恒在、非错误，不用 `role="alert"`）。
- **不新增 BDD**（I-6 已存在，此为 UI 落地）：P3 用例可断言"slug 非空时 `publish-slug-hint` 可见且文本含'覆盖'"。
- **与后端语义对齐**（实读）：`entry_service.py` 在 slug 已存在时走覆盖路径，返回有效 entry；前端按成功处理（`phase='done'`），不额外弹确认框（覆盖是**用户主动指定 slug** 的预期结果，无需二次确认；这与"意外覆盖"不同——默认不填 slug 时不会命中此路径）。

### 4.8 测试标识清单（供 P3 test-designer；不绑定 class）

| `data-testid` | 元素 |
| :--- | :--- |
| `user-menu-publish-item` | UserMenu 下拉 Publish 项 |
| `explore-publish-button` | Explore 顶部主按钮 |
| `publish-view` | 页面根 |
| `publish-summary-input` / `publish-summary-count` | summary 输入 / 计数 |
| `publish-dropzone` / `publish-file-input` | 拖拽区 / 隐藏 file input |
| `publish-file-row` / `publish-file-path-input` / `publish-file-badge-binary` / `publish-file-remove` | 文件行元素 |
| `publish-slug-input` / `publish-tags-input` / `publish-visibility-toggle` / `publish-visibility-text` / `publish-expires-select` / `publish-team-select` | 可选字段 |
| `publish-slug-hint` / `publish-tags-hint` | 字段提示（非错误，恒在；§4.7.1/§3.4.1） |
| `publish-submit` | 主按钮 |
| `publish-error-summary` / `publish-summary-error` / `publish-slug-error` / `publish-file-row-error` | 错误展示（`role="alert"`，§4.10.5） |
| `publish-file-empty` | 文件列表空态（BDD-15） |
| `publish-result` / `publish-page-link` / `publish-raw-link` / `publish-copy-page` / `publish-copy-raw` / `publish-view-detail` / `publish-again` | 结果态 |

> 行级 testid `publish-file-row-error` 每行重复，E2E 用 `[data-testid="publish-file-row-error"]` + 行内 `data-file-id`（或 `getByRole` + 可访问名）定位；**id 属性**用 `publish-file-error-{fileId}`（§3.4.1）。

### 4.9 E2E 落点与命名

新增 `frontend-v3/e2e/tpv0100-publish.spec.ts`（沿用 TPV0099 spec 惯例：`BASE_URL` 默认 `:8888`；`alice/testpass123` 登录取 token 后 `addCookies` 注入 `peekview_token`；自建 entry 用 `e2e-` 前缀确定性 slug；`afterEach` 按响应 slug 经 API 删除清理；双视口 `test.use` 钉定 1280×800 / 390×844）。`setInputFiles` 用 `test.use` 临时文件或 `e2e/fixtures/` 下样本（1 文本 `.md` + 1 二进制 `.png`，含无 NUL 非法 UTF-8 样本覆盖 BDD-8）。运行：`E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`。

**E2E 须覆盖的 rev1 新增判据**（P3 test-designer 落用例）：①BDD-26 两路径——400（slug 非法，取 `error.message`）与 **422（构造超长/类型错字段触发 FastAPI 默认数组 `detail`，断言汇总条文本非 `[object Object]` 且含 `msg`）**；②BDD-17/18 行级错误与**行 fileId 绑定**——删除第 1 行后第 2 行错误不漂移；③a11y——错误输入 `aria-invalid="true"` + `aria-describedby` 指向存在的错误元素 id；提交中表单容器 `aria-busy="true"`；④断言⑥⑦⑧（结果态不重叠、行错误不与 input 重叠、path 输入 `font-family` 含 mono）；⑤light/dark 两主题各一轮截图（P6 视觉确认）。

### 4.10 逐组件契约（props / emits / 内部状态 / 空态 / 触发）

> 本节替代"职责一句话"——P4 implementer 按本表实现，不凭空决定交互细节。所有类型引 §1.1 M6/M8 的 `PublishFileDraft` / `PublishResult` / `PublishLimits`。

#### 4.10.1 `PublishFileDraft`（M6 领域类型，所有文件组件共享）

```ts
interface PublishFileDraft {
  fileId: string          // crypto.randomUUID()，稳定标识，作为 fileErrors/列表 :key
  file: File              // 原 File（用于 filename/size/读取）
  filename: string        // 叶子名（file.name）
  size: number            // 字节
  isBinary: boolean       // 编码时判定结果，用于徽标
  path: string            // 可编辑相对路径，默认 = filename
  encoded: string         // content 或 content_base64 的结果（内存占用主体，见 §4.3 释放）
}
```

#### 4.10.2 `FileDropZone.vue`

| 项 | 契约 |
| :--- | :--- |
| **props** | `disabled: boolean`（提交中禁用）；`accept?: string`（默认 `''` = 不过滤）；`maxFiles: number`（= `limits.max_entry_files`，默认 50） |
| **emits** | `files-added: [files: File[]]`（过滤/去重后的新增文件）；`reject: [reason: string]`（超 maxFiles 截断或全重复，父组件用 `useToast.error` 提示） |
| **内部状态** | `isDragOver: boolean`（dragover 进入 true、dragleave/drop 复位 false，驱动高亮态） |
| **空态** | 无内部空态——Zone 本身恒显示"拖拽文件到此处，或点击选择"（文案）；空态由父级 `PublishFileList` 承担 |
| **触发** | 点击 Zone → 隐藏 `<input type="file" multiple>` 的 `click()`；`Enter`/`Space`（Zone 为 `role="button"` + `tabindex="0"`）同点击；`drop`/`change` → 读 `FileList` → **过滤**（`accept` 非空时按扩展名/MIME 过滤，本任务默认空=全收）→ **去重**（同名同 size 视为重复，跳过）→ 若"已有 + 新增" > `maxFiles` 则**前端截断**至 maxFiles 并 `emit('reject', '最多 N 个文件')` → `emit('files-added', 通过项)` |
| **不做** | 文件夹选择、压缩包解压（§1.2 非目标）；不做拖拽排序（§2.x.3 E3 已否） |

#### 4.10.3 `PublishFileList.vue`

| 项 | 契约 |
| :--- | :--- |
| **props** | `drafts: PublishFileDraft[]`；`fileErrors: Record<string,string>`（**key = fileId**，见 §4.5）；`disabled: boolean` |
| **emits** | `update-path: [fileId: string, path: string]`（`input` 即时 emit，父级写回 `drafts[i].path`，**不做去抖**——path 是短文本，校验在提交时与 `blur` 时进行，实时 `input` 只更新值不报错）；`remove: [fileId: string]` |
| **内部状态** | 无持久内部状态（纯受控）；行内 `:key="draft.fileId"`（**禁止用 index**，保证删除中间行后 DOM/焦点不串行） |
| **空态** | `drafts.length === 0` 时渲染 `EmptyState`/`<p data-testid="publish-file-empty">` 文案"至少选择一个文件"（BDD-15 的就地提示来源） |
| **每行结构** | `[文件名 + 文本/二进制徽标] [path 输入] [移除按钮] [(错误时) .file-row-error]`；path 输入 `aria-label`/`aria-describedby`/`aria-invalid` 见 §3.4.1；徽标 `publish-file-badge-binary`（二进制时显示，文本时不显示或显示"文本"） |
| **删除时的重映射/清理** | 父级 `remove(fileId)` 处理：`drafts = drafts.filter(d => d.fileId !== fileId)`；**同步** `delete fileErrors[fileId]`（用 `delete` 而非重建索引），**不做 index 重映射**（因为 key 是 fileId）；幂等键指纹随之变化（§4.2 ②），自动重置 |

#### 4.10.4 `PublishResultPanel.vue`

| 项 | 契约 |
| :--- | :--- |
| **props** | `result: PublishResult`（字段见 §4.11，**由父级 `PublishView` 构造**，组件不读 `window.location`、不发请求） |
| **emits** | `view-detail: []`（父级 `router.push('/' + result.slug)`）；`publish-again: []`（父级执行重置，见 §4.3 内存释放） |
| **内部状态** | 仅复制反馈的瞬时态（可选：`copiedTarget: 'page' | 'raw' | null`，用于按钮短暂显示"已复制"，用 `setTimeout` 复位；不持久化） |
| **空态** | **无空态**——组件仅在 `phase='done'` 且有 `result` 时挂载（`v-if`），不存在"无结果的结果态" |
| **触发** | 两个复制按钮 → `navigator.clipboard.writeText(result.pageLink / rawLink)`，失败 `useToast.error('复制失败，请手动选择')`；`查看详情` → `emit('view-detail')`；`再发一个` → `emit('publish-again')` |
| **a11y** | 容器 `role="status" aria-live="polite"`（§3.4.2）；标题 `tabindex="-1"` 供焦点迁移（§3.2.2） |

#### 4.10.5 字段错误渲染件（不单独成组件，统一模板片段）

错误渲染**不引入新组件**，统一为模板片段 + 样式类（承接 `ProfileTab`/`TeamsView` 惯例）：

| 变体 | testid | 模板 | 关联 |
| :--- | :--- | :--- | :--- |
| 顶部汇总 | `publish-error-summary` | `<div role="alert" tabindex="-1">` 含文本（400 `error.message` 或 422 拼接文本，见 §4.6） | 提交失败时焦点落此（§3.2.2） |
| 字段级（summary） | `publish-summary-error` | `<p id="publish-summary-error" class="field-error" role="alert">` | input `aria-describedby` + `aria-invalid`（§3.4.1） |
| 字段级（slug） | `publish-slug-error` | `<p id="publish-slug-error" class="field-error" role="alert">` | 同上 |
| 行级 | `publish-file-row-error` | `<p :id="'publish-file-error-' + fileId" class="field-error file-row-error" role="alert">` | path input `aria-describedby` + `aria-invalid` |
| 提示（非错误） | `publish-slug-hint` / `publish-tags-hint` | `<span class="field-hint">`（`--font-xs` + `--c-text-tertiary`），**无** `role="alert"` | 输入 `aria-describedby` 指向；恒在 |

### 4.11 `PublishResult` 结构与构造处（M6，M12 消费）

```ts
interface PublishResult {
  slug: string        // 取响应 entry.slug（后端可能改写？否——指定/生成后返回最终值）
  expiresAt: string   // 取响应 entry.expires_at（ISO，展示时格式化本地时间）
  pageLink: string    // window.location.origin + '/' + slug   ← 页面构造（§4.3，不用 response.url）
  rawLink: string     // window.location.origin + '/' + slug + '/raw'
  isPublic: boolean   // 取响应 entry.is_public（用于结果态可选标注）
}
```

- **构造处**：`PublishView.vue` 的提交成功分支（`phase='done'` 处）——唯一构造点；`PublishResultPanel` 只读 `props.result`。
- **字段来源边**：`slug`/`expiresAt`/`isPublic` 来自 `CreateEntryApiResponse`（经 `transformFile`/entry transform，M4）；`pageLink`/`rawLink` 由页面用 `window.location.origin` 拼（**不使用** `response.url`，R4）。

---

## 5. gate_commands（P2 固化，P4-P6 不得改）

> 出处：实读根 `Makefile` 与 `frontend-v3/package.json`。`package.json` scripts 仅有 `test: "vitest"`（**watch 模式，禁用于 gate**）/ `build: "vue-tsc && vite build"`；Makefile 提供非 watch 的运行器（`test-frontend` L173-178 = `npx vitest run`；`typecheck` L193-199 = `npx vue-tsc --noEmit`；`test-quick` L163-166 = 后端 pytest；`debug-test` L648-657 = E2E via `scripts/run-e2e-tests.sh` 支持 `E2E_SPEC`）。故 gate 走 Makefile target，不裸用 `npm test`。

```yaml
gate_commands:
  # P3 红灯基线：前端单测运行器（Makefile test-frontend = npx vitest run，非 watch）。check-tdd-red.py 读取此键。
  P3: "make test-frontend"
  # vitest 输出经内置 formatter 标准化为 JSON，供 check-tdd-red.py 判 A/B 类错误
  P3_formatter: "vitest.sh"
  project_module: "src/"
  # P5：前端单测紧凑模式（Makefile test-frontend = vitest run）
  P5: "make test-frontend"
  # P5 后端不回归（本任务后端零改动，确认仍绿；xdist 并行）
  P5_backend: "make test-quick"
  # P5 类型检查独立 key（CI 强制；--strict 反模式：不串进 P5）
  P5_typecheck: "make typecheck"
  # P5 E2E（ui_affected: true → 必填）：指向 debug :8888，单跑新 spec
  P5_e2e: "E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test"
  P5_timeout_seconds: 180
  P5_backend_timeout_seconds: 300
  P5_typecheck_timeout_seconds: 180
  P5_e2e_timeout_seconds: 600
```

- **P5_e2e 前置**：debug backend `:8888` 在线 + `make debug-seed`（跨调用须挂后台 job 托底，见 AGENTS.md）。
- 架构适应度检查：**本任务无架构适应度检查**（见 §1.3 末）。

---

## 6. minimal_validation:（强制，已实做）

方案依赖浏览器行为（File API 读入、`TextDecoder`、base64、axios 请求）与后端契约，**已做实测**：

1. **文本/二进制判定对齐后端**（`assumption`：前端 JS 规则可与后端 `language.py:is_binary_content` 逐一致）
   - `method`：写 JS 端口 `.agate-tmp/validate_binary.mjs`，对 8 个样本跑 `isBinaryContent`；同时用 `backend/.venv` Python 直接调 `is_binary_content` 对同样本取基准。
   - `result`：**confirmed**。8 样本全部一致（empty=false、ascii=false、utf8-cjk=false、nul=true、invalid-utf8=true、lone-continuation=true、truncated-multibyte=true、png-header=true）。另实测 base64 膨胀 `1.333x`（1MiB→1.398MiB）。
2. **POST 契约实测**（`assumption`：`content`/`content_base64` 两路径与响应结构符合 spec §6.4）
   - `method`：debug `:8888` 起服务 + `make debug-seed`，alice 登录取 cookie，`curl POST /api/v1/entries`（1 文本 `content` + 1 二进制 `content_base64` + `idempotency_key`），并重放同 key。
   - `result`：**confirmed**。201 → 文本 `is_binary:false/language:"text"`，二进制 `is_binary:true/language:null`；同 key 重放 → **200** 返回同一 entry（幂等命中）；`GET /config/limits` 返回 6 字段且默认 `15d`；`expires_at` = 创建 + 15d；匿名 `GET /{slug}/raw` → 200；非法 slug → 400。
3. **axios 认证配置**（`assumption`：Cookie 自动携带）
   - `method`：实读 `frontend-v3/src/api/client.ts:13`。
   - `result`：**confirmed**。`withCredentials: true` 已设置，无需改动。
4. **错误体形状**（`assumption`：spec §5.6 称响应含 `detail`）
   - `method`：curl 非法 slug 触发 400；另由评审实核 `main.py` **无 `RequestValidationError` handler**（仅 `RateLimitExceeded`/`PeekError`/`Exception` 三个 handler）。
   - `result`：**refuted（部分）**。400 实际为 `{"error":{"code":"INVALID_SLUG","message":"Slug must match ..."}}`，**无 `detail`** → 前端按 `error.message` 提取（R3），标 `[SCOPE+]`。**422**（FastAPI 校验失败）走框架默认 `{"detail":[{loc,msg,type},...]}` **数组** → 前端按 `detail[].msg` 拼接（§4.6 形状表），`extractApiErrorMessage` 统一两条路径。**BDD-26 双路径均可读，已闭合**。
5. **响应 `url` 字段来源**（`assumption`：`url` 可用于结果态链接）
   - `method`：实读 `config.py:161,500-501` + 实测响应。
   - `result`：**refuted**。`url` 是服务端 `base_url`（`https://peek.gsis.top/...`），非当前源 → 前端自拼（R4）。
6. **环境隔离**：全程只起 debug `:8888`，测试 entry 只经 debug HTTP API 创建，验证后经 API 删除（GET=404）。`[PROD_NOT_TOUCHED]`——未触碰生产 `:8080` 与 `~/.peekview/`；未用 CLI `peekview create`。

---

## 7. files_to_read:（P4 implementer 上下文地图）

```yaml
files_to_read:
  - path: frontend-v3/src/api/client.ts:1-200
    why: 复用 PeekAPI 类方法/transformFile/getFileAsBase64 模式；新增 createEntry/getLimits 的落点；确认 withCredentials
  - path: frontend-v3/src/router.ts:1-116
    why: 新增 /publish 路由与 beforeEach 守卫（L97-114 惯例）
  - path: frontend-v3/src/components/UserMenu.vue:1-71
    why: 下拉项结构与 navigateTo* 函数模式；新增 Publish 项
  - path: frontend-v3/src/views/EntryListView.vue:1-30,299-302
    why: 顶部工具栏插槽位置与 props.owner 定义（按钮 gate 依据）
  - path: frontend-v3/src/views/SettingsView.vue
    why: 表单页布局/authState gate/data-testid 惯例参照
  - path: frontend-v3/src/components/settings/ProfileTab.vue
    why: 字段级校验与错误反馈惯例参照
  - path: frontend-v3/src/views/TeamsView.vue:28-45,110-125
    why: aria-describedby + .field-error + role="alert" 三件套惯例（§3.4 a11y 契约的承接源）
  - path: frontend-v3/src/components/BaseButton.vue
    why: 确认无 loading prop（提交文案由页面 slot 自管，§3.4.2）
  - path: frontend-v3/src/styles/variables.css:21,29-30
    why: --font-mono（mono 场景）/ --transition-fast（150ms 过渡档）
  - path: frontend-v3/src/composables/useToast.ts
    why: 成功/失败反馈调用方式
  - path: frontend-v3/src/stores/auth.ts:1-93
    why: authState/isOwner 读取；不新增 store
  - path: frontend-v3/src/types/index.ts
    why: 领域类型新增落点
  - path: frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts:1-80
    why: E2E 登录/清理/双视口/API 前置惯例（照此写 tpv0100 spec）
  - path: frontend-v3/playwright.config.ts
    why: project/视口/CDP 配置，BASE_URL 默认 :8888
  - path: backend/peekview/models.py:560-574,803-846
    why: FileCreate/CreateEntryRequest/CreateEntryResponse 契约（前端类型对齐）
  - path: backend/peekview/services/entry_service.py:1176-1245
    why: _process_file_input 的 content vs content_base64 分支（编码约束代码依据）
  - path: backend/peekview/language.py:314-340
    why: is_binary_content 精确逻辑（前端 JS 对齐）
  - path: backend/peekview/api/config_router.py:49-91
    why: /config/limits 响应 6 字段
  - path: DESIGN.md:210-220
    why: 菜单文书 (Settings, Teams, Logout) 同步点（L216）
```

---

## 8. env_constraints:（确认/细化 P0-brief，不弱化）

```yaml
env_constraints:
  debug_env: "make debug-start（:8888，数据目录 /tmp/peekview-debug/）；跨调用须挂持续 running 后台 job 托底（AGENTS.md「跨调用起服务的正确姿势」）；seed 用 make debug-seed；一步到位可用 make debug-quick"
  prod_forbidden: "严禁触碰生产 :8080 与 ~/.peekview/；严禁 pip3 install --break-system-packages；严禁 uvicorn 直启；严禁 CLI `peekview create` 创建测试 entry"
  test_data: "测试 entry 只经 debug HTTP API 创建（curl -X POST http://127.0.0.1:8888/api/v1/entries），E2E 自建 entry 用 e2e- 前缀并在 afterEach 经 API 删除"
  tmp_artifacts: "临时产物落 {project_root}/.agate-tmp/（DSH 沙箱下 /tmp 跨调用不共享）"
  e2e_guard: "E2E 必须指向 :8888；scripts/run-e2e-tests.sh 内置生产端口拦截；BASE_URL 默认 http://127.0.0.1:8888"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db \"SELECT COUNT(*) FROM entries\"；或 make debug-verify-isolation（依赖 :8080 在线）"
```

---

## 9. [SCOPE+] 与遗留

- **[SCOPE+]** 发现：spec §5.6 / BDD-26 描述后端错误体为"含 detail"，实测 400 响应体为 `{"error":{"code","message"}}`（无 `detail`）。
  - 必须做的理由：前端错误提取逻辑必须按实际形状写，否则 BDD-26 失败。
  - 影响：P1 BDD-26 措辞可保留（"显示后端 detail 原文"在语义上由 `error.message` 原文满足），但 **P3/P4 须以 `error.message` 为提取口径**；建议主 Agent 在 P1 基线补注（不新增 BDD）。
- **[SCOPE+]** 发现：`CreateEntryResponse.url` 为服务端 `base_url`，非当前源。
  - 必须做的理由：BDD-10 明确要求 `{当前源}/{slug}`，用 `response.url` 会指向生产域名，违反验收。
  - 影响：前端链接构造用 `window.location.origin`；不新增 BDD，仅实现约束。
- **OQ-4（大文件体验）**：留待 P6 在 debug 环境实测接近上限文件的发布体验，再决定是否评估方案 B。

## 10. 实现完成的标志

- `/publish` 可达；未登录重定向 `/`；UserMenu 与 Explore（`!props.owner`）入口就位；他人主页无入口。
- 文本走 `content`、二进制走 `content_base64`；被判二进制者详情页 `is_binary:true` 且可下载，文本 `language` 非 null。
- 相对路径编辑生效（嵌套目录）；重复/非法路径与超限在提交前拦截并指出对象；**行级错误与行 `fileId` 绑定（删除中间行不串错行）**。
- 结果态页面/Raw 链接均基于当前源、可复制；「查看详情」跳 `/{slug}`；「再发一个」清空（含编码缓存释放）并换幂等键。
- BDD-23/24 幂等行为可复现；429/**400（`error.message`）**/**422（`detail[].msg` 拼接）** 有可读提示且保留表单；提交中不可重复提交。
- 字段错误与输入 `aria-describedby`/`aria-invalid` 关联、`role="alert"` 播报；提交中 `aria-busy`；结果态 `aria-live` 公告；焦点迁移按 §3.2.2。
- 默认公开 + 过期默认取 `default_expires_in`；slug 早校验与后端规则一致；slug 非空时显示覆盖语义提示（I-6）。
- `make typecheck` 通过；`make test-frontend` 绿；新 E2E spec 在 debug `:8888` 绿。

## 11. 变更记录

| 日期 | 版本 | 变更 |
| :--- | :--- | :--- |
| 2026-10-01 | v1 | 初稿。基于 P1 v2（30 BDD）+ spec V1.1 + P0-brief；实读前端 7 文件/后端 5 文件；对 debug :8888 实测 POST 契约与幂等 + JS 端口对齐后端判定（8 样本）；固化 gate_commands（Makefile/package.json 实读）；2 候选方案（集中式 composable vs 单文件+路由化结果态）；含 UI 设计节与 [SCOPE+]×2 |
| 2026-10-01 | v1.1（rev1.1） | 主 Agent 修正 `gate_commands.P3`：`cd frontend-v3 && npx vitest run --reporter=dot` → `make test-frontend`（Makefile 为测试命令唯一真相源，且消除 check-gate 对首 token `cd` 的假阳性 WARNING），并将 `P3_formatter` 由空串改为内置 `vitest.sh`（vitest 输出标准化为 JSON，供 check-tdd-red.py 判 A/B 类错误）。`agate-read-gate-commands.py` 实跑确认解析为 `{"cmd": "make test-frontend", "formatter": "vitest.sh"}`，P2 gate 无 WARNING |
| 2026-10-01 | v1.1（rev1） | 闭合 plan-design-review §5 补充清单 1–6：①新增 §2.x「UI 维度候选与权衡」（布局 L1/L2/L3、结果态 R1/R2/R3、行编辑 E1/E2/E3，各含优点/风险/工作量/选择理由，§2 架构候选与 `candidate_count: 2` 不动）；②新增 §4.10 逐组件契约表（`FileDropZone`/`PublishFileList`/`PublishResultPanel`/错误渲染件的 props/emits/内部状态/空态/触发）+ §4.11 `PublishResult` 字段与构造处；`fileErrors` 由 `Record<idx,msg>` 改为 **`Record<fileId,msg>`**（稳定 `crypto.randomUUID()`，删除行同步 `delete`，无 index 重映射）；③新增 §3.4 可访问性契约（`aria-describedby`+`aria-invalid`+`role="alert"` 三件套、`aria-busy`/`aria-live`、焦点迁移表，承接 `ProfileTab`/`TeamsView` 惯例）+ §3.2.2 焦点管理；④新增 §4.6 错误体形状表（400 `error.message` vs 422 `detail[].msg` 拼接，`extractApiErrorMessage` 统一，禁 `[object Object]`）；⑤视觉/移动端细化：§3.1.1 720px 偏离 DESIGN.md §4 记录、§3.1.2 tablet 断点、§3.1.3 结果态/错误态 390 布局、§3.2.1 过渡档（150ms）、§3.3 light/dark 双主题 + mono 场景 + 断言⑥⑦⑧；⑥§4.7.1 slug 覆盖语义 UI 提示（I-6）+ §4.3「再发一个」内存释放（R7）。**未改动**已达标项（§2 架构候选 / §4.2 幂等 / §4.4 编码 / §5 gate_commands / §1 影响面 / `[SCOPE+]` 标记） |
