# Changelog

所有对 PeekView 项目的显著更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- T053: Agent /raw 端点自动发现（Content Negotiation + HTML 自描述 + llms.txt 补充）

## [0.6.2] - 2026-07-11

### 修复

- T052: 修复 light 模式下 mobile sticky header 背景色硬编码问题（改用 `--c-glass-bg` CSS 变量）
- T052: 桌面端 TOC 和 File tree 侧栏默认打开


### 修复

- T052: 修复 light 模式下 mobile sticky header 背景色硬编码（改用 `--c-glass-bg` CSS 变量）
- T052: 桌面端 TOC 和 File tree 侧栏默认打开

## [0.6.1] - 2026-07-11-


### 新增

- T052: 桌面 entry detail header 重构为 2 行紧凑布局（~78px），icon-only 按钮 32×32
- T052: 移动端新增 sticky header（52px + backdrop-filter blur(16px)）
- T052: 移动端底部操作栏（48px），按文件类型动态显示按钮
- T052: OverflowMenu 双模式（desktop dropdown / mobile bottom sheet）
- T052: ThemeToggle 桌面端独立显示，移动端在 overflow bottom sheet 中
- T052: 全部图标替换为 Lucide SVG，移除 emoji
- T052: 移动端 meta-tags-bar 滚动隐藏

### 修复

- T052: 修复 layout.css scoped scope 导致子组件（OverflowMenu）样式丢失

## [0.6.0] - 2026-07-09

### 新增

- T051: 后台定时清理任务（lifespan background cleanup）
- T051: 列表页筛选栏重设计（All/Mine/Archived + @用户跳转）
- T051: 过期未归档视觉警告 banner
- T051: 详情页/列表页头部信息布局重设计

## [0.5.6] - 2026-07-09

### 修复

- **`config get` 默认值修复**（T050）：`peekview config get diagram.sanitize_enabled` 正确显示 `(not set, default: True)`，不再返回 `(not set)`
- **extractLabels 无限递归 OOM**（T050）：`fix-fullwidth-syntax` 规则的标签提取函数在含嵌套括号的 label（如 `A[(text)]`）时进入无限循环导致内存耗尽——改为 right-to-left 扫描 + 完整括号对替换
- **生产构建清洗不生效**（T050）：`DiagramBlock.vue` 中 `sanitizedCode` 初始值 `''` 导致 Vue watch 立即触发时拿到空字符串，fallback 到未清洗的原始代码——改为 `null`
- **fix-arrows 破坏已正确箭头**（T050）：graph 上下文中 `A --> B` 被误改为 `A ---> B`——使用 sentinel 保护后再做归一化

### 变更

- **清洗规则系统补充**（T050）：从 7 条规则扩展至 13 条，基于 130 用例 P1 数据分析
  - 确定性规则新增 6 条：关键字大小写修正（17 种映射）、缺换行修正（TB/TD/LR/RL/BT+subgraph）、全角符号语法位置替换（提取标签→替换→还原）、上下文感知箭头修正、PlantUML 标记移除、空字节移除
  - PlantUML/SVG 各增 `fix-fullwidth-syntax` 规则
  - 删除有 bug 的 `normalize-arrows`（`->>` → `-->>` 在 graph 中依然无效）
- **移动端 Header 换行布局**（T050）：`header-right` 在 <768px 时 `flex-wrap` 换行到下一行，不再挤压 tags 区域；修复硬编码间距 `44px` → `calc(100% - 28px - var(--space-3))`；适配 iOS safe-area

### 新增

- **客观错误模式分析管线**（T050）：`frontend-v3/scripts/mermaid-error-patterns.cjs` 数据驱动测试脚本，130 用例 + mermaid.parse() 验证，可扩展为持续集成用 regression

## [0.5.5] - 2026-07-08

### 新增

- **移动端 Header 智能滚动**（T049）：header-tags 在手机端自动截断显示 "+N" 溢出指示器，向下滚动时隐藏 header 以释放内容空间，向上滚动时恢复，桌面端不受影响
- **Diagram 源码自动清洗**（T049）：前端 diagramSanitize 管线（register 架构），两阶段清洗（确定性 + 启发式），支持 mermaid/plantuml/svg 源码自动修正
- **统一错误 UI**（T049）：Mermaid/PlantUML/SVG 渲染失败的统一错误面板，含引擎名 + 可折叠详情 + 查看源码按钮
- **可配置清洗开关**（T049）：`PEEKVIEW_DIAGRAM__SANITIZE_ENABLED` 环境变量 + `GET /api/v1/config/diagram` 端点 + CLI `peekview config set diagram.sanitize_enabled`

### 变更

- 后端 CLI bool key 输入校验加强：无效值报错退出（之前静默接受）

### 修复

- PlantUML 渲染失败不再自动切到 code mode，改用统一错误 UI

## [0.5.4] - 2026-07-07

### 新增

- **Entry 生命周期管理**（T048）：过期 entry 从直接物理删除改为两阶段生命周期（active→archived→物理删除），`POST /admin/cleanup` 第一阶段归档、第二阶段物理删除
- **PATCH expires_in**（T048）：entry 续命/设永不过期，archived entry 传 `expires_in` 自动重新激活
- **可配置归档保留期**（T048）：`PEEKVIEW_CLEANUP__ARCHIVE_RETENTION_DAYS`（默认 90 天，0=永不删除）
- **前端过期编辑**（T048）：ExpiresInDialog 组件 + EntryDetailView 过期时间 Edit 按钮 + archived banner + Reactivate 按钮
- **Archived entry 列表展示**（T048）：Mine tab 含 archived entry（灰色淡化 + "Archived" badge）
- **AdminCleanupResponse 扩展**（T048）：新增 `archived_count`/`archived_slugs` 字段，向后兼容

### 变更

- cleanup 行为从物理删除→归档（破坏性变更，已有 entry 不可恢复）
- 前端 `Entry.status` 类型从 `'active' | 'expired'` 改为 `'active' | 'archived'`

### 修复

- list_entries owner 查询现在包含 archived entry（之前被静默过滤）

## [0.5.3] - 2026-07-05

### 修复

- **后端二进制文件 Content-Type 修复**（T047）：`/content` 端点对 PNG/JPEG/SVG 等二进制文件返回 `text/plain`，改为三级 fallback（`_LANGUAGE_TO_MIME` → `mimetypes.guess_type()` → `application/octet-stream`），新增 `_determine_content_type` 函数
- **前端 Markdown 图片/链接路径重写恢复**（T047）：从 T046 patch 恢复 path-map.ts + useMarkdown.ts + MarkdownViewer.vue + EntryDetailView.vue 改动，Markdown 中 `![alt](image.png)` 和 `[doc](guide.md)` 引用自动重写为 API URL

## [0.5.2] - 2026-07-01

### 修复

- **v0.5.1 回归：代码行间出现空白行**（hotfix）：T045 将 `code`/`.diagram-code code` 从 `display:flex;flex-direction:column` 改为 `display:block`，导致 `<pre>` 的 `white-space:pre` 让 Shiki 输出中 `.line` 元素间的 `\n` 变成可见空行。改回 `display:flex` 修复
- **v0.5.1 回归：空行塌缩致"连续蓝色"错觉**（hotfix）：MarkdownViewer.vue 的 `.line` 规则缺失 `height:1.6em`，空源行渲染高度为 0，蓝色偶数行间无视觉间隔，看起来像连续蓝色行。补 `height:1.6em` + `.line:empty{transparent}` 修复
- **Zebra stripe 配色优化**（hotfix）：`--bg-code-even` 从灰度色（`#1c2536`/`#d4d9e2`）改为品牌蓝色 5% 透明度（`rgba(77,141,255,0.05)`/`rgba(9,105,218,0.05)`），消除灰+灰的丑感

## [0.5.1] - 2026-07-01

### 变更

- **Markdown/Diagram 代码块补行号**（T045）：`highlightCode()` 复用 `highlight()` 的行号逻辑，Markdown 代码块和 Diagram code mode 均显示行号列；DiagramBlock 的 Mermaid/PlantUML code mode 改走 Shiki 高亮（不再用 `escapeHtml`）
- **Zebra stripe 整行背景**（T045）：代码块 `.line` 用 `min-width: 100%` + `padding-right` + 负 `margin` 延伸到 `pre` 的 padding 区域，zebra 背景铺满整行宽度（不再只衬文字下方）；`code` 改为 `display: block` 消除 flex 子项宽度限制
- **Zebra 配色对比度提升**（T045）：dark 主题 `--bg-code-even` 调整为 `#161b22`（HSL 亮度差 8.04%），light 主题调整为 `#e2e5ea`（HSL 亮度差 8.43%），肉眼可辨识

### 修复

- **Ctrl+F 不再触发全屏模式**（T044）：`zen-shortcut.ts` 的 `shouldHandleZenShortcut` 增加修饰键过滤（Ctrl/Meta/Alt），按 Ctrl+F 时浏览器搜索正常弹出，单独 F 键仍触发 zen mode
- **Explore 视图模式持久化**（T044）：`EntryListView.vue` 的 viewMode 切换后写入 localStorage（key: `peekview-view-mode`），页面重载后恢复上次选择，首次访问默认 grid，非法值 fallback 到 grid

## [0.5.0] - 2026-06-30

### 新增

- **Shiki 按需动态加载**（T040）：前端 `useShiki.ts` 新增 `LANG_IMPORT_MAP`（62 种语言动态 import）+ `ensureLanguage()` 按需加载 + `LEGACY_LANG_MAP` 语言 ID 映射，首屏 16 种静态 import 不变，未注册语言首次查看时动态加载（并发去重），后端 `language.py` 语言 ID 对齐（mathematica→wolfram、registry→reg）
- **HTML sibling 注入增强**（T041）：`sandbox` 加 `allow-forms` 允许表单交互（CSP `form-action 'none'` 兜底安全）；`<script type="module">` 保留 type 属性注入；CSS `@import` / `url()` 递归替换（深度限制 3 层）；`<img src>` 匹配 SVG 文件自动内联为 `data:image/svg+xml`；`../style.css` 路径归一化（basename fallback 双向匹配）
- **FTS5 文件内容搜索**（T037）：FTS5 索引从只搜 summary+tags 扩展为也搜文件内容（文本文件），`contentless+contentless_delete=1` 模式由应用层管理 content 列，启动时回填已有 entry，二进制文件不进索引，大文件截断到 10000 字符/文件，前端搜索 placeholder 改为"搜索标题、标签和文件内容..."

### 变更

- **Public badge 智能显隐**（T039）：EntryCard / EntryListRow 的 public/private badge 改为仅 owner 可见（`v-if="isOwner"`），非 owner 不再看到废信息的 "Public" badge
- **列表 summary 去重**（T039）：EntryListRow 删除 `.entry-summary` 重复行（title 已显示 `summary || slug`），消除两行完全相同内容
- **标签折叠上下文感知**（T039）：卡片模式保留 `TAG_LIMIT = 3` + `+N` 折叠，列表模式和详情页不限制标签数量
- **HTML viewer 警告文案**（T041）：从"不支持多文件相对路径，这些资源不会加载"改为中性描述"此 HTML 含 N 个本地资源引用，PeekView 将尝试自动注入。部分引用可能无法注入（如动态加载、嵌套 iframe 等）"

## [0.4.0] - 2026-06-30

### 新增

- **Entry 读取埋点**（T032）：`entry_reads` 表记录读取事件（reader 身份、channel、时间），1 分钟窗口聚合 UPSERT，`asyncio.create_task` 异步写入不阻塞 API 响应；`read_stats` 字段（total_count / unique_readers / by_channel）仅 owner/admin 可见；`GET /entries/{slug}/reads` 端点查询读取历史；MCP client 传 `X-PeekView-Source: mcp` header；list 请求记录单条 `discover` 事件（entry_id=null）
- **代码行交替色**（T030）：CodeViewer / MarkdownViewer 代码块 / DiagramBlock 代码视图奇偶行不同背景色，dark/light 双主题 `--bg-code-even` / `--bg-code-odd` CSS 变量驱动，`!important` 覆盖 MarkdownViewer `pre * { background-color: transparent }`
- **OverflowMenu 组件**（T030）：dropdown 菜单 + click-outside / Escape 关闭 + 44px touch targets，集成到 EntryDetailView 移动端 actions
- **Tag 折叠**（T029）：EntryCard / EntryListRow / EntryDetailView 中 tag 数量超过 3 个时只显示前 3 个，剩余折叠为 `+N`（BaseTag 样式，纯静态无交互）
- **相对时间 + tooltip**（T036）：`useRelativeTime` composable 统一 EntryCard / EntryListRow / EntryDetailView 三处时间格式化，hover 显示完整日期（`title` 属性）
- **`useRelativeTime` composable**（T036）：统一三处时间格式化逻辑，替代各自手写的 `formatRelativeTime` / `toLocaleDateString`

### 变更

- **卡片/列表 Meta 信息重排**（T029）：布局顺序调整为 `title → meta（@user · 日期 · file数） → tags（折叠） → badge`，tags 与 meta 分离为独立行
- **详情页标题 2 行截断**（T029）：`line-clamp: 2` 替代 `white-space:nowrap; text-overflow:ellipsis`，header 高度从固定 56px 改为 `min-height` 自适应
- **详情页 tags 位置**（T036）：tags 从顶栏右侧移到标题下方独立一行（title-group flex column）
- **Share cookie 改名**（T033）：`peekview_share_{entry.id}` → `peekview_share_{slug}`，防止 cookie 名称暴露内部 ID 推断 entry 总量
- **Share UI 文案**（T033）：`Max views` → `Max uses`，`N/M views` → `N/M uses`，语义统一为"最多验证 N 次 token"

### 修复

- **删除无效 hmac.compare_digest**（T033）：`share_service.py` 的 `hmac.compare_digest(computed_hash, share.token_hash)` 比较同一值永远为真，误导维护者，已删除；`test_share_security` 重写为验证 token 验证安全性语义而非特定函数调用


## [0.3.1] - 2026-06-29

### 新增

- **设计系统 Token 全局化**：`--c-*` CSS 变量体系（surface/text/border/accent/shadow/radius/space/font）提升到 `variables.css` 全局声明，29 个旧 token 通过别名映射兼容
- **7 个共享组件**：BaseButton/BaseBadge/BaseTag/PageHeader/SearchInput/EmptyState/ThemeToggle，统一 `--c-*` token 驱动
- **EntryCard 组件**：卡片视图专用组件，2 行标题截断（`-webkit-line-clamp: 2`）、flex 等高布局、badge 靠底
- **卡片/列表双视图**：Explore 页面默认卡片 grid 布局，可切换为列表视图，切换按钮在内容区顶部右侧
- **BaseButton href 支持**：`href` prop 存在时渲染为 `<a>`，不存在时渲染为 `<button>`，统一视觉风格

### 变更

- **Explore 页面 header 重构**：去掉 PageHeader 组件，自写 header（logo + actions 靠右），搜索框移至内容区顶部与 entry 列表同宽
- **全页面 logo 统一**：Explore/API Keys 页面使用 LandingView 同款 SVG logo + "PeekView" 文字；Detail 页面 `⌂` 回退按钮替换为 logo 图标（无文字）
- **API Keys 页面 header 统一**：去掉 `← Back` 链接，改为 logo header + 页面标题"API Keys"在内容区顶部
- **Detail 页面 Raw 按钮**：从 `<a class="raw-link">` 改为 `<BaseButton variant="secondary">`，与 Copy/Download/Pack 按钮风格统一
- **EntryListRow 标题**：从硬编码 `entry.slug` 改为 `entry.summary || entry.slug`，与 EntryCard 一致
- **SearchInput 高度**：padding 从 `10px` 缩减为 `6px`，与 header actions 按钮高度对齐
- **移动端搜索框**：从 header 内挤压改为内容区全宽独占一行

### 修复

- **Explore 页面 Back 按钮回归**：T028 重构误加 `← Back` 链接，已移除
- **搜索框位置回归**：T028 将搜索框塞入 PageHeader `#meta` slot 导致位置不合理，已移至内容区
- **移动端搜索框变形回归**：header 空间不足导致搜索框变方块，已移至内容区全宽
- **卡片 grid 布局丢失回归**：T028 用 EntryListRow 替换了 entry-grid，已恢复卡片布局并增加切换按钮

## [0.3.0] - 2026-06-29

### 新增

- **临时分享链接**：private entry 的 owner 可生成临时分享链接（`/{slug}?share={token}`），无需密码即可访问
- **`entry_shares` 表**：存储分享 token 的 SHA256 hash、过期时间、view 次数限制、撤销状态
- **3 个分享 API 端点**：`POST /entries/{slug}/shares`（创建）、`GET /entries/{slug}/shares`（列表）、`POST /entries/{slug}/shares/revoke`（批量撤销）
- **ShareDialog 组件**：有效期选择（1h/24h/7d/30d/永久）+ view 次数限制 + 生成后显示 URL + Copy 按钮
- **ShareManagementPanel 组件**：分享列表（active/expired/revoked）+ 单个/批量撤销 + view_count 统计
- **分享水印**：share 访问时显示"由 @username 分享"，owner 自己不显示
- **private→public 自动撤销**：entry 从 private 变为 public 时，同一事务内撤销所有 active shares
- **Share cookie 隔离**：独立命名空间的 HTTPOnly cookie，与登录 cookie 不冲突
- **Referrer-Policy: no-referrer**：share 访问时防止 token 通过 Referer 泄露
- **`make setup-local`**：新 clone 后快速初始化 `.claude/`/`.opencode/` agents symlink
- **playwright-cdp / vision-analyzer 全局 skills**：从项目 symlink 改为全局独立目录，任何会话可直接调用
- **搜索 URL 化**（T026）：`/explore?q=关键词&owner=me` 搜索条件同步到 URL，可分享/书签

### 变更

- **Claude Code + OpenCode 双系统兼容**：agent 定义源统一在 `docs/converse/agents/`，本地目录加入 gitignore
- **E2E 脚本参数化**：`run-e2e-tests.sh` 支持 `E2E_SPEC` 变量，不再硬编码 `debug-server.spec.ts`
- **E2E 单 spec 隔离 guard**：`E2E_GUARD_ENABLED=1` 强制验证 debug backend，防误写生产

### 修复

- **vision-analyzer 全局独立**：从项目 symlink 改为全局目录，playwright-cdp 同步独立


## [0.2.7] - 2026-06-28

### 新增

- **`/users/:username` 路由**：用户公开页，复用 EntryListView 显示特定用户的所有公开 entry，含 banner 头（"@username 的发布内容" + Back to Home）
- **`list_entries` API 扩展**：`owner=username` 查询参数，大小写不敏感（`func.lower`），返回 `owner_found` 三态字段（None/True/False）
- **`BannerBar` 组件**：用户页大标题组件（可复用）
- **`FilterChip` 组件**：可消除的筛选标签组件（供搜索等场景复用）
- **卡片 `@username` 可点击**：点击卡片中的用户名跳转对应 `/users/:username`，已登录用户点自己跳 `/explore?owner=me`

### 变更

- **EntryListView 三态驱动**：`owner` prop 驱动 banner/chip/tab 三态 UI 切换
- **嵌套 `router-link` 修复**：卡片外层从 `<router-link>` 改为 `<div @click>`，消除 `<a>` 嵌套 `<a>` 的 HTML 违规
- **Tab URL 同步**：`/explore` 的 All/Mine tab 切换通过 `router.replace` 同步到 URL（`?owner=me` 可分享）

## [0.2.6] - 2026-06-28

### 新增

- **LandingView 全新设计**：基于静态 HTML 设计稿完整迁移为 Vue SFC（Hero + 产品预览窗 + Access 双入口 + 6 种格式画廊 + Features + CTA + Footer），暗色默认 + 亮色切换
- **格式卡片真实渲染**：Code（行号 + 语法高亮）、Markdown（结构化渲染）、Diagram（Mermaid 流程图）、HTML（Web UI 模拟）、SVG（架构图）、Data（JSON 表格）
- **移动端导航自适应**：ThemeToggle 移入 `.nav-cta`，≤860px 紧凑间距，≤380px 隐藏 Sign in，预览窗跟随主题切换

### 修复

- **版本号统一注入**：LandingView 底栏版本号从硬编码 `v0.2.5` 改为 `__APP_VERSION__` 构建时注入，与 EntryListView 一致
- **MCP 过期版本号清理**：源码注释和回退值从 `v0.3.0`/`v0.2.0`/`v0.8.0` 更正为当前版本


## [0.2.5] - 2026-06-28

### 新增

- **Landing Page** (`/`)：未登录用户看到产品介绍页（Hero + 示例 entry + Login CTA + SEO meta），已登录用户自动跳 `/explore`
- **路由迁移**：EntryListView 从 `/` 移至 `/explore`，EntryDetailView 返回/删除按钮同步修正
- **404 兜底页**：多级不匹配路径显示友好 404 页（"Page not found" + 返回首页），`/:pathMatch(.*)*` catch-all 路由
- **清理僵尸文件**：删除 `views/HomeView.vue`（17 行未引用的占位欢迎页）
- **测试覆盖**：新增 11 个组件单元测试（Toast/ThemeToggle/ConfirmDialog/Pagination/CodeViewer/TocNav/TreeNodeItem/ActionBar/ImageViewer/LoginDialog/MarkdownViewer），总测试数 370
- **useDebounce composable**：通用 debounce 工具函数

### 流程

- **Subagent 派发指南**：基于 14 次系统对照实验的证据驱动规范（`docs/process/subagent-dispatch-guide.md`）
- **Agate 流程实战**：T023/T024 通过 agate 子 Agent 编排完成（P1→P4→P6）


## [0.2.4] - 2026-06-27

### 重构

- **Diagram 渲染管线重构（T020 redo）** — 在 v0.2.3 回退 T022 后，基于 v0.1.67 重新实现：
  - `useMarkdown.ts` 返回 `blocks[]` 数组（html | diagram），替代原 HTML+sourcesMap 模式
  - `DiagramBlock.vue` 统一外壳（header/toggle/dropdown/copy/error/resize）+ 3 个独立渲染器：`MermaidRenderer.vue` / `PlantUmlRenderer.vue` / `SvgRenderer.vue`
  - `useDiagramViewer.ts` composable — svg-pan-zoom 封装（pan/zoom/touch/resize observer）
  - `MarkdownViewer.vue` 改用 `v-for blocks` 模板，删除 1500+ 行旧 diagram 事件委托/CSS
  - 删除旧组件：`MermaidDiagram.vue` / `PlantUmlDiagram.vue` / `SvgDiagram.vue`

### 修复

- **CSS `:not(.is-active)` 死规则** — Task 8 CSS 迁移时复制的 `.diagram-viewer:not(.is-active)` 规则（来自旧 MarkdownViewer 的激活模型）在 v-show 控制下永远匹配，导致 viewer 被压成 1×1px，SVG 渲染后不可见
- **Fullscreen 按钮无 click handler** — `@click` 未绑定 `openFullscreen()`，点击无反应
- **Toggle 切回 Diagram 空白** — ResizeObserver 在 viewer `display:none` 时触发 `svg-pan-zoom.fit()`，对 0×0 容器计算 scale=0，写入 `transform=matrix(0,0,0,0,0,0)`，此后所有 zoom 操作抛 "matrix not invertible"；修复：ResizeObserver handler 跳过 width/height 为 0 的情况
- **PlantUML toggle 文案不变** — `toggleText` computed 对 plantuml 硬编码返回 "Diagram"，忽略 `isCodeMode` 状态
- **Download PNG 按钮无效** — dropdown 中 "Download PNG" 按钮无 `@click` handler，未调用 `rendererRef.downloadPng()`

### 验证

- 193/193 vitest 单元测试通过
- 52/52 Playwright E2E 测试通过（含 mermaid toggle/fullscreen、plantuml toggle、svg 渲染、mobile responsive）
- `vue-tsc --noEmit` 0 errors
- `make build-frontend` 成功

## [0.2.3] - 2026-06-26

### 修复

- 回退 T022 diagram-renderer-refactor — v0.2.0 引入的 BaseDiagram 薄包装架构导致 diagram 功能全面损坏（双重 DOM 嵌套、CSS 全未迁移、双重状态管理），恢复 MarkdownViewer.vue 和 useMarkdown.ts 到 v0.1.67 版本，删除 T022 新增的 diagrams/ 目录、useCodeBlockRenderer.ts、diagramRegistry.ts 及相关测试文件。Playwright 验证：Mermaid/PlantUML/SVG 三种 diagram 的渲染、toggle、dropdown、fullscreen modal 全部正常


## [0.2.2] - 2026-06-26

### 修复

- doc-sync 彻底修复 — 移除 active-tasks.md 的版本同步规则（任务看板不应在版本同步清单中，`docs/process/`→`docs/tasks/` 路径迁移后遗留的垃圾规则）


## [0.2.1] - 2026-06-26

### 变更

- Footer 样式改版 — 图标+文字 pill 卡片（GitHub/PyPI/npm），hover 圆角背景浮现；右侧新增 tagline "Built for sharing code & docs"；space-between 双栏布局替代居中；移动端堆叠居中

### 修复

- doc-sync 脚本 `docs/process/active-tasks.md` 路径修正为 `docs/tasks/active-tasks.md`（6/12 目录整理后的遗留 bug，v0.2.0 CI 首次暴露）


## [0.2.0] - 2026-06-26

### 重构

- **T022**: Markdown 渲染管线重构 — `MarkdownViewer.vue`（脚本 322 → 236 行）、`useCodeBlockRenderer` composable（162 行）、`BaseDiagram.vue` 基类骨架（zoom/fullscreen/pan/PNG 导出 + refresh listener + slot 注入）、三薄包装 `MermaidDiagram/PlantUmlDiagram/SvgDiagram`（77/69/57 行）
- **T022**: `useMarkdown` 注册模式 — `diagramRegistry.ts` 独立文件 + `registerDiagramType()` API；识别 fenced code block 后查表路由（mermaid/plantuml/svg 三族）
- **T022**: 事件委托迁移到 emit — 去除原 `data-action` 字符串协议 + `closest()` + `switch case`（15 case），子组件用标准 Vue `emit` 通讯，`defineExpose` 按差异暴露
- **T022**: composable API — `useCodeBlockRenderer` 提供 `getMermaidSvgByIndex`/`getPlantUmlSvgByIndex`/`getCodeViewHtml`/`getError`/`preRenderMermaid`/`preRenderPlantUml`/`registerSvg`/`renderMermaidFresh`/`renderPlantUmlFresh`/`svgToPng`/`nextToken`/`isCurrent`/`registerInstance`/`unregisterInstance`/`getInstance`/`beginResize`/`endResize`/`clearInstances`
- **T022**: 渲染状态抽离 — `mermaidCache`/`plantumlSourcesMap`/`svgSourcesMap`/`renderToken`/`instances.{mermaid,plantuml,svg}` 从 MarkdownViewer 迁出至 composable

### 行为保真

- T022: 三族（mermaid/svg/plantuml）共存渲染无干扰
- T022: 按钮交互（图/码 toggle/Copy/Fullscreen/Download PNG）行为不变
- T022: DOMPurify 两层净化保留（svg meta.sanitize + 末尾整体净化）
- T022: renderToken 8 检查点保留（renderContent 4 个 + mountDiagrams 4 个），异步渲染竞态防护
- T022: 响应式断点（>768px desktop / <768px mobile compact layout）保留
- T022: 主题切换（dark/light）保留，watch([content, theme]) 触发 renderContent
- T022: CSP 合规 — 全用 Vue @click（编译为 addEventListener），无内联 onclick

### 修复

- 修复 `test_cli.py` 版本断言 hard-code `"0.1."` 导致 minor bump 后测试失败（改为读取 `__version__` 做断言）

### 验证

- T022: 前端 235/235 单元测试通过（含 `markdown-viewer-degeneration.spec.ts` 15 + `emit-handler-diffs.spec.ts` 15 + `mount-loop-unified.spec.ts` 8 新增）
- T022: 后端 577/577 pytest 通过
- T022: Playwright BDD 验收 29/29 全部通过（9 维度：渲染输出/按钮交互/全屏/竞态/安全/响应式/主题/CSP/错误处理）
- T022: P7 一致性检查 PASS（0 BLOCKER, 3 DEVIATION + 5 EXTENSION 均为合理偏差）
  - DEVIATION-1: BaseDiagram.vue 531 行 vs 目标 <400（P2 行数预算过紧，功能完整且无新行为）
  - DEVIATION-2: MarkdownViewer.vue CSS 未按归属拆分（不影响行为，可作下一轮独立任务）
  - DEVIATION-3: useMarkdown 仍 if-else 三分支（`registerDiagramType` API 已实现但 `if/else` 查表落地不彻底，扩展性 BDD-10.1 仍间接验证通过）


## [0.1.67] - 2026-06-25

### 新增

- T021: Zen mode — 按 `f` 键进入沉浸阅读模式，隐藏 header/sidebar/mobile-actions，content-area 占满视口；按 `f` 或 `Esc` 退出
- T021: 焦点重定向 — 进入 zen 时若焦点在被隐藏元素内（header 按钮、侧边栏链接），自动重定向到 `.content-area`（tabindex=-1），防止焦点丢失
- T021: aria-live 通知 — zen 状态切换时屏幕阅读器播报 "Zen mode on/off"（`aria-live="polite"` + `.sr-only` span）
- T021: 输入框焦点排除 — `INPUT`/`TEXTAREA`/`contenteditable`/模态对话框（`role="alertdialog"`）内按 `f` 不触发 zen
- T021: CSS-only 隐藏策略 — `.zen-mode` class 控制 `display:none`，不改变 `v-if` 逻辑，退出后状态零丢失（FileTree 展开状态、滚动位置、iframe 均保持）

### 验证

- 前端 140/140 单元测试通过（含 zen-shortcut.ts 纯函数测试）
- Playwright 实跑 BDD 13/13 全部通过：f 进入 zen、Esc 退出、f toggle 退出、输入框排除、状态零丢失、滚动不跳动、iframe 不重载、非详情页不触发、ConfirmDialog 排除、单文件 entry、焦点重定向、aria-live 通知


## [0.1.66] - 2026-06-25

### 新增

- T020: ` ```svg ` 代码块一体化查看工具栏 — markdown 中 ` ```svg ` 围栏代码块渲染为带工具栏的矢量图容器，对齐现有 mermaid/plantuml 体验
- T020: 图/码 toggle — 默认图形视图，可切换查看 Shiki 高亮的 SVG 源码（xml grammar，effectiveLang=xml 非 text）
- T020: 工具栏操作 — Copy Code（原始源码入剪贴板 + "✓ Copied!" 2s 反馈）、Download PNG（透明背景，不调 fillRect，canvas 默认 alpha=0）、Fullscreen modal（svg-pan-zoom 滚轮缩放 + 拖拽平移）
- T020: SvgDiagram.vue 新组件 — pan-zoom + fullscreen modal + 透明 PNG 导出（独立 exportSvgToPng，不复用 mermaid 白底逻辑）
- T020: useShiki.ts 注册 xml grammar（static import `shiki/langs/xml.mjs` + commonLangs 追加），svg 代码块 code-mode 走 Shiki 高亮

### 修复

- T020: 修复 `mime.spec.ts` 过时测试 — `guessMimeType('icon.svg')` 期望从 null 改为 `'image/svg+xml'`（自 e8069c6b 起实际返回此值，测试未跟上）

### 安全

- T020: ` ```svg ` 代码块内容单独 `DOMPurify.sanitize`（配置与全局末尾相同但调用独立，作用域隔离）— 剥除 `<script>`/`on*`/`<foreignObject>`/`javascript:` 引用，保留合法图形元素；不改全局 DOMPurify 配置，内联 `<svg>` 与独立 `.svg` 文件管线行为不变

### 验证

- 前端 104/104 单元测试通过（含 SvgBlock.spec.ts 新增组件测试）
- 前端构建 + vue-tsc typecheck 全绿
- Playwright 实跑 BDD 16/16 全部通过：渲染矢量图、图/码 toggle（Shiki 高亮）、Copy Code、透明 PNG（对角像素 alpha=0）、Fullscreen 缩放、XSS（script/on*/foreignObject/javascript: 剥除）、三管线共存（mermaid+plantuml+svg 互不干扰）、主题切换重挂载、尺寸回退


## [0.1.65] - 2026-06-23

### 新增

- T019: HTML Viewer 后端 render 路由 — `GET /api/v1/entries/{slug}/files/{file_id}/render?inject=...`，返回 HTML + 独立宽松 CSP（支持 Three.js/WebGL/Canvas 富交互 HTML）
- T019: 后端 sibling 文件注入服务（`html_render_service.py`，BS4 实现），CSS/JS/img/favicon 内联注入
- T019: `main.py` CSP 中间件 render 路由特判（跳过 X-Frame-Options DENY，由 render 路由自设 `frame-ancestors 'self'`）

### 修复

- T019: 修复 iframe 加载 blob URL 继承主页面 CSP 导致 inline script 被拦截的问题 — 改用后端 render 路由，iframe 用 HTTP URL 加载，使用响应的独立 CSP
- T019: 修复主应用 CSP `frame-src blob:` 阻止同源 render URL iframe 的问题 — 改为 `frame-src 'self' blob:`

### 变更

- T019: `HtmlViewer.vue` 从 blob URL 改为 render URL（`:src="renderUrl"`），移除 createObjectURL/revokeBlobUrl 逻辑
- T019: `EntryDetailView.vue` 移除前端 sibling 内容 fetch 逻辑，改为只传 file IDs（后端注入）
- T019: 新增依赖 `beautifulsoup4>=4.12.0`

### 验证

- 后端 15/15 单元测试通过（test_html_render.py）
- 后端 17/17 API 回归测试通过
- 前端 31/31 + 5/5 单元测试通过
- Playwright 实跑 BDD 8/8 全部通过：CSP 0 违规、React 渲染、WebGL 2.0 context（D3D11 硬件加速）、sandbox 凭据隔离


## [0.1.64] - 2026-06-21

### 修复

- T018: PlantUML 起止标记通用化 — validateSource 只认 @startuml/@enduml，导致 @startmindmap/@startgantt/@startnwdiag 等 17+ 种非 UML 图类型被前置验证拦截。改为通用 @start\w+/@end\w+ 模式，覆盖 mindmap/gantt/nwdiag/salt/ditaa/wbs/json/yaml/creole 等所有 PlantUML 图类型
- T018: Playwright 实测确认 mindmap 完美渲染，gantt/nwdiag 进入渲染流程（修复前被前端验证器拦截）

### 验证

- 17/17 单元测试通过（含 6 个新增 BDD 用例）
- Playwright 实跑：10 种 PlantUML 图类型全部产出 SVG，0 console 错误


## [0.1.63] - 2026-06-21

### 修复

- T017: 主题切换 @media 冲突修复 — github-markdown-css v5.9.0 的 `@media (prefers-color-scheme: dark)` 越权绕过 `data-theme` 控制，导致系统黑夜时用户切 light 模式内容区仍为黑色。patch `public/css/github-markdown.css` 去掉 `@media` 包裹，改为 `[data-theme=dark] .markdown-body` / `[data-theme=light] .markdown-body` 显式选择器，`data-theme` 成为唯一真相源
- T017: Playwright 3 场景验证通过（系统黑夜+light→白 / 系统黑夜+dark→黑 / 系统白天+dark→黑），vision 确认无割裂


## [0.1.62] - 2026-06-20

### 新增

- T016: PlantUML 图表渲染支持 — markdown 中的 ` ```plantuml ` 代码块在浏览器端渲染为可交互 SVG（pan-zoom/全屏/PNG 导出），与现有 Mermaid 共存
- T016: `usePlantUML.ts` 引擎封装 — 懒加载 plantuml.js v1.2026.6（8.3MB，仅检测到 plantuml 块时加载）+ 模块级 Promise 链串行队列（引擎共享状态硬约束）+ 5s 超时 + 四道语法错误降级
- T016: `PlantUmlDiagram.vue` 展示组件 — 与 MermaidDiagram 接口对称，PNG 导出独立实现适配 PlantUML SVG 结构
- T016: vendored `frontend-v3/public/vendor/plantuml/` — plantuml.js + viz-global.js + VERSION，同源加载命中 CSP `script-src 'self'`
- T016: `MarkdownViewer.vue` renderToken 取消机制 — 快速切换条目/主题时丢弃旧渲染结果，防 mount 错位

### 验证

- 10/10 单元测试通过（validateSource 4 + render 4 + ensureLoaded 2）
- 真实 CSP 下 Playwright + vision 验证：3 种图类型（类图/时序图/组件图）+ 中文渲染正常 + Mermaid 共存
- 9/9 BDD 验收通过（含暗色主题、语法错误降级、多块串行、懒加载）


## [mcp-v0.9.2] - 2026-06-16

### 新增

- T015: `peekview-mcp config verify` — 验证配置连通性和认证（5 步检查：文件存在→url 必填→格式校验→/health 连通→api_key 认证）
- T015: `peekview-mcp config unset <key>` — 删除配置项（空 section 自动清理，不残留 `section: {}`）


## [mcp-v0.9.1] - 2026-06-16

### 新增

- T014: `peekview-mcp config namespace add <ns> <container_path> <host_path>` — 添加 namespace 映射（container_path 必须为绝对路径）
- T014: `peekview-mcp config namespace remove <ns> [container_path]` — 删除单条映射或整个 namespace（整个 namespace 需要 --yes 确认）
- T014: `peekview-mcp config namespace list [ns]` — 列出所有/指定 namespace 映射
- T014: `peekview-mcp config list` 输出追加 path_namespaces 部分


## [0.1.61] - 2026-06-16

### 新增

- T010: apikey CLI 支持 local 模式（新增 --user 参数，local 直连 DB 生成/管理 pv_ key，无需 remote 模式）
- T011: 用户管理 API+CLI
  - `GET /admin/users`：管理员查询用户列表（支持 ?username= 精确匹配）
  - `DELETE /admin/users/{id}`：管理员删用户（级联删除 entries/files/apikeys，禁止删自己 → 400）
  - `POST /admin/users/{id}/reset-password`：管理员重置他人密码
  - `DELETE /auth/me`：用户自助注销（唯一 admin 需 confirm_username 确认 → 409）
  - `POST /auth/change-password`：自助改密码（需验证旧密码）
  - CLI: `peekview user delete/reset-password/change-password` + `peekview whoami`
  - PeekClient: 新增 list_users/delete_user/reset_user_password/change_password/delete_self/whoami/update_entry 方法


## [mcp-v0.9.0] - 2026-06-15

### 新增

- **Path namespace mapping**：Docker 容器内 Agent（Hermes/OpenClaw）可通过 `X-Peekview-Namespace` header 声明命名空间，MCP Server 自动翻译容器内路径到主机路径（如 `/opt/data` → `~/docker-data1`）
- **expandHome**：配置中的 `~` 路径（allowed_paths 和 namespace host_path）现在正确展开为用户 HOME 目录

### 修复

- **allowed_paths ~ 前缀静默失效**：配置 `~/xxx` 以前不生效，现在正确展开


## [0.1.60] - 2026-06-15

### 新增

- **/{slug}/raw 短链接**：302 redirect 到 /api/v1/entries/{slug}/raw，方便用户和 Agent 直接在人类链接后加 `/raw` 获取原始内容

### 修复

- **SQLite pragma 未在所有连接生效**：`busy_timeout`/`synchronous`/`cache_size` 等连接级 pragma 只在初始化连接上设置，NullPool 下新连接缺失导致并发写时 SQLITE_BUSY 立即失败而非等待重试


## [0.1.59] - 2026-06-14

### 新增

- **GET /api/v1/entries/{slug}/raw**：Agent 原始内容接口，返回 entry 全部文件的原始文本内容（base64 URL 用于二进制文件），支持 API Key 认证访问私有条目


## [mcp-v0.8.6] - 2026-06-14

### 变更

- **改为无状态 Streamable HTTP 模式**：彻底消除 session 过期导致 opencode 需要重启的问题
- 每次请求独立认证，无 session 概念，服务端重启对客户端透明
- DELETE /mcp 无状态下直接返回 200（无 session 可终止）


## [0.1.58] - 2026-06-14

### 变更

- **移除生产路径警告**：`PeekConfig()` 不再对指向 `~/.peekview/` 的裸调用打印 WARNING。该警告对正常 CLI 用户（`peekview list`、`peekview user list` 等）产生噪音，而实际防护价值极低——pytest 有 L1 强制隔离（conftest），debug mode 有 L2 自动隔离，不依赖人看到警告


## [0.1.57] - 2026-06-14

### 新增

- **`PEEKVIEW_DEBUG_MODE` 自动隔离**：`PeekConfig()` 无参调用在 `PEEKVIEW_DEBUG_MODE=1` 时自动隔离 `data_dir`/`db_path` 到 `/tmp/peekview-debug/` 并禁用 captcha。显式 env var 或 kwargs 仍然优先生效
- **生产库写保护警告**：`PeekConfig()` 无参调用指向 `~/.peekview/` 且不是 `peekview serve` 进程时打印 WARNING 提醒，agent 读到警告应立即设 `PEEKVIEW_DEBUG_MODE=1`
- **pytest 全局存储隔离**：`conftest.py` `isolate_config_file` fixture 自动设置 `PEEKVIEW_STORAGE__DATA_DIR`/`PEEKVIEW_STORAGE__DB_PATH` 环境变量，所有 `PeekConfig()` 无参调用在测试中自动指向 tmp_path

### 修复

- **Debug 服务器 captcha 配置泄漏**：`scripts/dev-server.sh` 未显式设置 `PEEKVIEW_AUTH__CAPTCHA_ENABLED=false`，导致 debug 服务器读取生产 `~/.peekview/config.yaml` 的 `captcha_enabled: true`，E2E 测试 register 返回 401


## [0.1.56] - 2026-06-13

### 新增

- **`require_admin` FastAPI 依赖**：统一管理员端点权限守卫，链式调用 `require_auth` + `is_admin` 检查
- **`GET /api/v1/admin/stats`**：系统统计端点（用户数、entry 数、API key 数、磁盘占用）
- **`POST /api/v1/admin/cleanup`**：手动清理过期 entry 端点（返回删除数量、slug 列表、释放空间）
- **`peekview admin stats`** CLI 命令：系统统计，支持本地/远程模式和 `--json-output`
- **`peekview admin cleanup`** CLI 命令：手动清理过期 entry，支持本地/远程模式和 `--json-output`
- **`PeekClient.admin_stats()` / `admin_cleanup()`**：远程客户端新增方法

### 修复

- **文件下载端点管理员权限缺失**：`api/files.py` 的文件下载/内容端点复用 `EntryService.get_entry()` 做可见性检查，管理员和全局 API Key 现在可以正确访问私有 entry 的文件
- **MCP Server session 失效返回 400**：改为返回 404（符合 MCP Streamable HTTP 规范），客户端可自动重新 initialize
- **Debug 服务器 captcha 配置泄漏**：`scripts/dev-server.sh` 未显式设置 `PEEKVIEW_AUTH__CAPTCHA_ENABLED=false`，导致 debug 服务器读取生产 `~/.peekview/config.yaml` 的 `captcha_enabled: true`，E2E 测试 register 返回 401


## [mcp-v0.8.5] - 2026-06-14

### 修复

- **Session 失效返回 404**：过期/无效 session 改为返回 404（符合 MCP Streamable HTTP 规范），客户端收到 404 后可自动重新 initialize；此前返回 400 导致客户端无法区分"需要重新初始化"和"请求格式错误"


## [mcp-v0.8.4] - 2026-06-12

### 变更

-


## [0.1.55] - 2026-06-12

### 新增

- **默认 15 天过期策略**：未传 `expires_in` 时自动设置 15 天后过期，避免条目无限堆积
  - `parse_expires_in("0")` / `"0d"` / `"0h"` / `"0m"` → `None`（永不过期）
  - 新增 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN` 配置项（默认 `"15d"`），支持 `999999d` 等超大值
  - `CreateEntryResponse` / `EntryListItem` 新增 `expires_at` 字段
  - 新增 `GET /api/v1/config/limits` 端点，返回 `default_expires_in`
  - CLI `config list` 支持 `limits.default_expires_in`；`create --help` 说明默认行为
  - MCP `create_entry` / `publish_files` 工具 description 更新，响应含 `expires_at`
  - 前端详情页展示过期倒计时 / "Never expires"；列表卡片展示过期标签

## [0.1.54] - 2026-06-12

### 修复

- **`peekview user list` 崩溃修复**：`from sqlalchemy import select` 改为 `from sqlmodel import select`
  - `sqlalchemy.select` 返回 `Row` 对象，Cython `BaseRow` 无法映射 ORM 字段
  - `sqlmodel.select` 返回正确的 `User` ORM 实体
  - 影响所有 `select(User)` 查询（`user list/create/promote/demote`）

## [0.1.53] - 2026-06-12

### 修复

- **数据库迁移机制修复**：Server 独占迁移执行权，消除 CLI 与 Server 的迁移锁竞争
  - `init_db` 新增 `run_migrations` 参数（默认 `False`），Server 启动时显式传 `True`
  - CLI 新增 `check_schema()` 兼容检查，schema 过期时输出清晰升级指引
  - 新增 `SchemaMismatchError` 异常（继承 `PeekError`），含 `peekview service restart` 提示
  - 每个 DDL 后独立 `conn.commit()`，防御性编程

## [0.1.52] - 2026-06-11

### 新增

-

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

-

### 变更

-


## [0.1.51] - 2026-06-11

### 新增

-

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

-

### 变更

-


## [0.1.50] - 2026-06-11

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Captcha PoW 性能**：difficulty 4→2, count 50→10（~2560 hash, ~1-2s）
- **Captcha site_key 默认值**：`""` → `"peekview-default"`（前端不再报 missing config）

## [0.1.49] - 2026-06-11

### 新增

- **Captcha WASM 本地离线化**：通过 `window.CAP_CUSTOM_WASM_URL` 覆盖，cap.js 优先使用本地 WASM
- **Captcha E2E 测试**：4 个独立测试（config/challenge/siteverify/注册拦截），需要 `PEEKVIEW_AUTH__CAPTCHA_ENABLED=true`

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **CSP**：移除 CDN `connect-src`，新增 `worker-src blob:`（captcha Web Worker 必需）

## [0.1.48] - 2026-06-11

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **httpx 缺失**：`captcha.py` 运行时依赖 `httpx`，但之前写在 `[optional-dependencies]` 的 `test` 组里，`pipx install` 不会安装。已将 `httpx` 移至主 `dependencies`。

## [0.1.47] - 2026-06-11

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **PeekConfig 空 YAML 段导致崩溃**：config.yaml 中 `auth:`（无子项）被 PyYAML 解析为 `None`，导致 `PeekConfig()` 初始化失败。修复：过滤文件配置中的 `None` 值。

## [0.1.46] - 2026-06-11

### 新增

- **CLI config list 全量展示**：对齐 MCP 风格，显示所有配置项（含未设置的默认值）、中文注释、按 section 分组
- **captcha 配置 CLI 支持**：`config set auth.captcha_enabled true/false` 开关验证码
- **config set 重启提示**：设置成功后提示 `peekview service restart`

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **config.py**：合并重复 `captcha_secret_key` 字段
- **cli.py**：`config set` 类型转换补充 captcha 键（bool/int）

### 变更

- **cli.py**：`supported_keys` 提取为模块级常量（`tuple`）
- **cli.py**：`config --help` 引导用户使用 `config list` 发现配置

## [mcp-v0.8.3] - 2026-06-11

### 变更

- **config get**：支持默认值回退（对齐 peekview），无配置文件时不报错
- **config set**：成功后提示重启 + 显示配置文件路径（对齐 peekview）
- **config.ts**：提取 `DEFAULT_CONFIG` 常量（`config list` 和 `config get` 共享）

## [0.1.45] - 2026-06-11

### 新增

- **Rate limiting 配置化真正落地** (#2)：
  - captcha 端点限速从硬编码改为可配置（`rate_limit_per_minute`）
  - `limiter.default_limits` 兜底保护所有 API 端点
  - `create_app()` 新增 `rate_limit_login_per_minute` / `rate_limit_per_minute` 参数

### 变更

- **JWT → httpOnly Cookie** (#4)：
  - login/register 返回 `Set-Cookie` 替代 `localStorage` 存 token
  - Cookie 优先级：Authorization header > Cookie > API key
  - SameSite=Lax, Max-Age 从 config 读取
- **前端 CSP 强化** (#5)：
  - SPA 页面添加 `script-src 'self' 'unsafe-eval'` CSP 头
  - `unsafe-eval` 为 Mermaid/d3 的 `new Function()` 所需
  - theme-init 脚本外部化到 `js/theme-init.js`
  - DOMPurify 集成，清理 markdown 渲染输出
  - `MarkdownViewer.vue` 内联 onclick → data-action 事件委托
  - `HtmlViewer` iframe 添加 `csp` 属性限制 blob 内容

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Mermaid DOMPurify 兼容**：源码从 `data-mermaid-code` 属性改为 `Map` 传递，绕过 DOMPurify 换行符清理
- **E2E 测试 Cookie 隔离**：`beforeEach` 清除 Cookie，`setupAuth` 域从 `BASE_URL` 派生
- **健康检查 503 vs 200 决策**：保持 200，单实例服务无需负载均衡切换


## [0.1.44] - 2026-06-10

### 新增

- **内置 Cap 兼容验证码引擎**（零外部依赖）：
  - 纯 Python 标准库实现 Cap 的 challenge/redeem/siteverify 协议
  - fnv1a + xorshift32 PRNG + HS256 JWT PoW，算法与 Cap JS 交叉验证（504 向量 100% 匹配）
  - `PEEKVIEW_AUTH__CAPTCHA_VERIFY_URL` 为空或默认值时自动切换到内置引擎
  - `/api/v1/captcha/{challenge,redeem,siteverify}` 端点，含速率限制
  - 独立 JWT 签名密钥（`captcha_secret_key`），与认证 JWT 密钥隔离
- **前端 captcha 集成**：
  - `LoginDialog.vue` 集成 `@cap.js/widget`，验证码未解决时禁用提交按钮
  - 支持 `CAPTCHA_REQUIRED` / `CAPTCHA_INVALID` 错误处理
- **MCP Server publish_files 二进制文件支持**：
  - 二进制文件不再跳过，改为 base64 编码上传（`content_base64` 字段）
  - 大小检查考虑 base64 膨胀（×1.34 估算）
  - `EntryFile` 类型增加 `content_base64?` 字段
- **MCP Server package-lock.json 版本同步验证**

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- `dev-server.sh` 使用 `PYTHONPATH=$(pwd)` 替代 pipx 安装路径，避免加载旧版本
- 内置模式下 `_config_to_dataclass` 跳过 `verify_url` 检查

### 变更

- `config_router.py` 返回 `mode` 字段（`builtin`/`external`）供前端判断


## [0.1.43] - 2026-06-09

### 新增

- **Cap captcha 集成**（登录/注册）：
  - 自托管 captcha [Cap](https://github.com/tiagozip/cap)，无第三方追踪，GDPR 友好
  - 新增 `peekview.auth.captcha.*` 配置段：`enabled` / `site_key` / `secret_key` / `verify_url` / `exempt_first_user`
  - `/api/v1/auth/register` 和 `/api/v1/auth/login` 在 captcha 启用时验证 `cap-token`
  - 公开端点 `GET /api/v1/config/captcha` 返回 `site_key` / `endpoint` / `enabled`（不含 `secret_key`）
  - 第一个用户（admin）可豁免 captcha，方便初始化（`exempt_first_user=True`）
  - 失败错误码：`CAPTCHA_REQUIRED`（401）、`CAPTCHA_INVALID`（401）、`CAPTCHA_CONFIG_ERROR`（500）

### 测试

- 新增 `tests/test_captcha.py`：15 个测试覆盖 `verify_captcha`、register/login 集成、exempt 场景、公开端点
- 全部 432 后端测试通过

## [mcp-v0.8.2] - 2026-06-10

### 新增

- **publish_files 二进制文件支持**：
  - 二进制文件不再跳过，改为 base64 编码上传（`content_base64` 字段）
  - 大小检查考虑 base64 膨胀（×1.34 估算）
  - `EntryFile` 类型增加 `content_base64?` 字段
  - 二进制文件上限 20MB，文本文件 7MB，总大小上限 100MB

### 变更

- `publishFiles.ts` 重构：按文件类型分别检查大小（文本/二进制）
- `bump-mcp-version` 现在自动同步 `package-lock.json` 版本并验证一致性

## [mcp-v0.8.1] - 2026-06-10

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 health endpoint `config.source`/`config.path` 永远返回默认值的 bug（`MergedConfig` 未填充这两个字段）
- 统一 `ServerConfig` 类型定义：消除 `config.ts`/`types.ts`/`merge.ts` 三处重复，`MergedConfig` 为唯一真相源
- 会话注册加防御性错误日志：`transport.sessionId` 为空时记录 error（而非静默跳过）
- `setInterval` 添加 `.unref()` 防止进程挂起

### 变更

- `ServerConfig` 现在是 `MergedConfig` 的类型别名（re-export）
- `MergedConfig` 新增 `configSource` 和 `configPath` 必填字段

## [mcp-v0.8.0] - 2026-06-10

### ⚠️ Breaking Change

- **传输协议迁移**：SSE → Streamable HTTP。客户端配置需同步更新：
  - 旧：`claude mcp add peekview -t sse http://localhost:33333/sse`
  - 新：`claude mcp add peekview -t http http://localhost:33333/mcp`
- 端点变更：`/sse` + `/messages` → `/mcp`（POST/GET/DELETE）
- 认证时机变更：从 SSE 连接时验证改为 initialize 请求时验证

### 新增

- Streamable HTTP 传输，符合 MCP 规范最新要求
- Per-session Server 实例（SDK `Server.connect()` 不支持多 transport）
- `enableJsonResponse: true` 模式（请求-响应式，无需 SSE 流）
- `isValidOrigin()` DNS rebinding 防护
- Session idle timeout 自动清理（30 分钟）
- `mcp-session-id` header 自动管理

### 变更

- SDK 升级：`@modelcontextprotocol/sdk` 1.4.0 → 1.29.0
- 认证从 SSE 连接时移至 initialize 请求时
- AsyncLocalStorage session 传播机制保留不变
- 工具逻辑零改动（create_entry/get_entry/list_entries/delete_entry/publish_files）

## [mcp-v0.7.3] - 2026-06-09

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 MCP 单元测试意外删除真实 `~/.peekview/mcp-config.yaml` 的问题
- 测试环境改用 mkdtemp 唯一 HOME，完全隔离

## [mcp-v0.7.2] - 2026-06-09

### 新增

- CLI `config allowed_paths add/remove/list` 子命令，管理 local 模式文件读取边界

## [mcp-v0.7.1] - 2026-06-09

### 改进

- `publish_files`: 零配置默认允许 cwd + 系统临时目录，解决 `/tmp` 中 agent 生成文件无法发布的问题
- `publish_files`: 新增 `server.trust_all_paths` 危险选项，适合完全本机自用场景（denylist 仅 best-effort）
- `publish_files`: 错误信息区分敏感路径命中与超出白名单，并给出配置修复命令
- `publish_files`: 工具描述强化“传文件 vs 传目录”语义，避免误发布整个项目目录
- CLI: `config help/list` 增加 `allowed_paths`、`trust_all_paths`、本地模式路径规则说明

### 安全

- `publish_files`: 默认不允许整个 `$HOME`，避免 `.env`/`.npmrc`/`.pypirc`/`.kube` 等泄露
- `publish_files`: 扩展敏感路径 denylist，覆盖常见 token/credential/history/system 路径及云/IaC/editor 凭证存储
- `publish_files`: local 模式默认 `is_public=false`，公开发布需显式指定
- `publish_files`: cwd 为 `/` 仍拒绝；`trust_all_paths` 仍受 denylist 保护（best-effort）
- `publish_files`: `/tmp` 下可选 owner 检查（当前用户文件）；TOCTOU 记录为已知限制

## [0.1.42] - 2026-06-09

### 新增

- 发布 Backend/Frontend v0.1.42，承接 MCP v0.7.0 收尾后的文档、测试和静态资源同步
- 新增 `publish_files` local-mode opt-in E2E 测试，强制只指向 `127.0.0.1:8888`

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 legacy MCP 前端 E2E 与当前 UI 行为不一致导致的失败
- 修复文档中 `PEEKVIEW_SERVER__HOST` 默认值与实际配置不一致的问题
- 修复发布文档/索引/README 中 Backend、Frontend、MCP 版本不同步的问题

### 变更

- 重新生成前端静态资源并纳入 v0.1.42 wheel
- 明确 MCP 测试与 E2E 必须使用临时 HOME 和 debug backend，避免污染生产数据


## [mcp-v0.7.0] - 2026-06-09

### 新增

- **MCP Server 本地/远程双模式**
  - `remote` 模式（默认）：暴露 `create_entry`, `get_entry`, `list_entries`, `delete_entry`
  - `local` 模式：暴露 `publish_files`, `get_entry`, `list_entries`, `delete_entry`，不暴露 `create_entry`
  - 新增 `server.mode` / `MCP_MODE` 配置，支持 `local` 与 `remote`
  - 新增 `server.allowed_paths` / `MCP_ALLOWED_PATHS` 配置，用于 local 模式文件读取边界
- **MCP `publish_files` 工具**
  - 支持绝对路径文件与目录递归发布
  - 支持 `include_patterns` / `exclude_patterns` 文件名过滤
  - 从路径自动推断文件名和后缀，不向后端传 `language`
  - 返回 skipped 文件及原因

### 安全

- `publish_files` 使用三层安全模型：敏感路径黑名单 → `allowed_paths` → cwd fallback
- 使用 `fs.realpath()` 解析符号链接后做边界检查，目录扫描记录 visited realpath 防环
- local 模式未配置 `allowed_paths` 且 cwd 为 `/` 时拒绝 fallback，避免系统服务场景全盘可读
- MCP 测试环境改为临时 HOME，不再读写或 rename 用户真实 `~/.peekview/mcp-config.yaml`

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 `publish_files` 目录扫描时后端 `path` 带入被扫描目录 basename 的问题；现在目录内文件使用干净相对路径（如 `src/main.py`）
- 修复 MCP 测试因真实环境变量或真实配置文件导致的不稳定和污染风险

### 变更

- MCP Server `npm test` 改为纯单元测试；integration/e2e 测试通过独立命令运行
- MCP Server package 版本更新为 `0.7.0`

## [0.1.41] - 2026-05-24

### 新增

- **MCP create_entry 文件扩展名建议** — 改善 Agent 生成条目时的文件名/后缀提示，降低渲染语言识别错误概率
- MCP dual-mode 设计、计划和专家评审文档，明确 local/remote 部署拓扑与工具边界

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **文件上传 path/filename 处理** — 修复同时提供 `path` 和 `filename` 时 filename 被忽略的问题
- **MCP 测试环境隔离** — 清理测试环境变量，避免本机 `PORT` 等变量污染测试结果

### 变更

- MCP Server 设计进入独立版本线，v0.7.0 起支持本地/远程双模式

## [0.1.40] - 2026-05-23

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **文件创建 path/filename 处理** — 修复当同时提供 path 和 filename 时，filename 被忽略的问题
  - 修复 `_process_file_input` 函数错误地从 path 提取文件名
  - 现在 `{"path": "docs", "filename": "CLAUDE.md"}` 正确创建 `docs/CLAUDE.md`
  - 影响 MCP Server 等客户端的文件上传功能

## [mcp-v0.3.9] - 2026-05-23

### 新增

- **E2E 安全检查脚本** — 新增 `scripts/e2e-safety-check.sh` 前置安全检查脚本
  - `make debug-test` 必须通过安全检查才能运行 E2E 测试
  - 禁止直接运行 `run-e2e-tests.sh`，强制使用 `make debug-test`
  - 检查调试服务是否使用独立数据库 (`/tmp/peekview-debug/`)
  - 运行前确认生产数据库中的条目数，检测已有测试数据

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Systemd 服务配置读取问题** — 安装时将配置写入环境变量
  - `service install` 现在读取 `~/.peekview/mcp-config.yaml` 并写入 `Environment="PEEKVIEW_URL=..."`
  - 解决 systemd 环境下配置文件读取失败问题
  - 支持 `PEEKVIEW_PUBLIC_URL` 和 `PEEKVIEW_API_KEY`（可选）

## [0.1.39] - 2026-05-23

### 安全

- **P0 安全加固** — 4 项关键安全修复
  - **Rate Limiting**: 添加基于 slowapi 的速率限制，登录/注册端点限制 10/分钟
  - **安全头中间件**: API 和 health 端点添加 X-Frame-Options, X-Content-Type-Options, CSP 等安全头
  - **Health Check 增强**: 检查 DB 连通性、存储目录可写性、磁盘空间（低于 100MB 告警）
  - **Content-Disposition 修复**: ZIP 下载文件名使用 `_sanitize_filename` 防止头注入

### 变更

- **⚠️ BREAKING CHANGE**: 默认监听地址从 `127.0.0.1` 改为 `0.0.0.0`
  - VPS 部署开箱即用，无需手动设置环境变量
  - 如需限制本地访问，请设置 `PEEKVIEW_SERVER__HOST=127.0.0.1`
  - CLI `--host` 帮助文本同步更新

## [0.1.38] - 2026-05-23

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **E2E 测试认证稳定性修复** — 修复 9 个测试用例的认证初始化问题
  - 修复 `page.context().addInitScript()` 在 Vue 应用挂载前执行导致 token 丢失的问题
  - 新认证模式：`goto('/')` → `evaluate(set token)` → `reload()` → `waitForSelector`
  - 增加超时时间至 15 秒，确保 auth store 初始化完成
  - 24/26 E2E 测试稳定通过

### 变更

- MCP Server 版本同步更新至 v0.1.38（与 backend 版本保持一致）


## [0.1.37] - 2026-05-22

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **关键配置层级修复**：环境变量现在能正确覆盖嵌套配置文件值
  - 修复 `PEEKVIEW_AUTH__ALLOW_REGISTRATION=true` 无法覆盖 `config.yaml` 中的 `auth.allow_registration: false`
  - 修复 `PEEKVIEW_SERVER__PORT` 等嵌套配置项的优先级问题
  - 配置层级现在严格遵循：CLI > 环境变量 > 配置文件 > 代码默认值

### 变更

- 更新 dev-server.sh 设置 `ALLOW_REGISTRATION=true`，确保 E2E 测试环境可注册


## [0.1.36] - 2026-05-22

### 重构

- `peekview service install` 不再向服务文件写入环境变量
  - 服务文件现在只包含 `ExecStart=peekview serve`
  - 所有配置从 `~/.peekview/config.yaml` 运行时读取
  - 支持 systemd 和 launchd (macOS)

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复测试隔离问题：添加全局 `isolate_config_file` fixture
  - 防止测试读取用户生产环境的 `~/.peekview/config.yaml`
  - 修复 14 个因此失败的测试

### 改进

- 配置层级更清晰：CLI 参数 > 环境变量 > config.yaml > 代码默认值
- `config set/get/list` 支持全部 25+ 个配置参数


## [0.1.35] - 2026-05-22

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- `config get` 未设置时显示默认值
  - 例如 `peekview config get server.port` 显示 `(not set, default: 8080)`

### 改进

- 简化 `config set/get --help` 的帮助格式
  - 使用逗号分隔列表，避免换行被错误合并


## [0.1.34] - 2026-05-22

### 新增

- CLI `-h` / `-v` 快捷选项
  - `peekview -h` 显示帮助（等同于 `--help`）
  - `peekview -v` 显示版本（等同于 `--version`）
- 扩展 `peekview config` 支持更多配置键
  - `server.host`, `server.port`, `server.base_url`
  - `storage.data_dir`, `storage.db_path`
  - `auth.secret_key`, `auth.token_expire_days`, `auth.allow_registration`
- `peekview service install` 自动读取配置文件中的 host/port

### 改进

- 改善所有命令的 `--help` 输出格式
  - 使用 epilog 显示 Examples，避免内容被挤在一起
  - 按分类显示 config 支持的配置键（Server/Storage/Auth/Remote）


## [0.1.33] - 2026-05-22

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 `peekview uninstall` 命令失败问题
  - 移除 pipx uninstall 命令中不支持的 `-y` 参数
  - 现在可以正确卸载 PeekView

## [0.1.32] - 2026-05-21

### 新增

- CLI `peekview uninstall` 命令 - 一键卸载 PeekView
  - 支持 `--yes` 跳过确认
  - 支持 `--keep-data` 保留数据目录
  - 自动检测 pipx/pip 安装方式
- CLI `peekview-mcp uninstall` 命令 - 显示卸载说明
- Agent 部署指南 - 完整的 VPS 部署手册

### 文档

- 添加 `docs/agent-deployment-guide.md` - Agent 部署完整指南



## [0.1.31] - 2026-05-21

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 降低 Python 版本要求从 >=3.12 到 >=3.10，提升兼容性

## [0.1.30] - 2026-05-21

### 安全加固（P0）

- Rate limiting：slowapi 限速，login/register 10次/分钟，可配置（`PEEKVIEW_SERVER__RATE_LIMIT_*`）
- 安全响应头：X-Content-Type-Options、X-Frame-Options、Cache-Control、Referrer-Policy、CSP（API-only）
- Health check 增强：DB 连通性、存储目录可写、磁盘空间监控，降级报 "degraded"（`PEEKVIEW_STORAGE__HEALTH_DISK_WARNING_MB`）
- Content-Disposition 头注入修复：ZIP download 端点复用 `_sanitize_filename`

### 新增

- npm publish workflow：GitHub Actions CI，mcp-v* tag 触发，Node 18/20 并行测试 + 发布
- `make bump-mcp-version`：MCP Server 版本独立管理（不再与 Python 版本强制同步）
- `make pre-publish-npm`：含 dry-run + unit test，不再双重构建
- 安全规格文档：`docs/specs/spec-security-hardening.md`
- 实现计划文档：`docs/plans/impl-plan-security-hardening.md`

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- Makefile `debug-verify-isolation` shell 语法错误（多行 Python 转单行）
- npm workflow 并发控制、版本校验（3轮 gstack 评审全部通过）
- MCP Server package-lock.json 版本同步（`npm install --package-lock-only`）

### 变更

- MCP Server 版本独立演进（当前 v0.2.0），`bump-version` 不再覆盖 MCP package.json


## [mcp-v0.3.8] - 2026-05-23

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Systemd 服务启动失败** — 修复 shebang PATH 解析问题
  - `ExecStart` 改为 `${nodePath} ${execPath} serve` 格式
  - 优先查找 `~/.nvm/versions/node/current/bin/node`（nvm 软链接，升级自动生效）
  - 回退到 `which node`，找不到时抛出清晰错误
- **用户服务权限问题** — `--user` 模式不再生成 `User=` 字段

### 测试

- 新增 `tests/cli/service.test.ts`（3 个测试）
  - `getNodePath()` nvm 路径查找
  - `getNodePath()` which 回退
  - `getNodePath()` 错误处理

## [mcp-v0.2.0] - 2026-05-20

### 新增

- **MCP Server v0.2.0** — 多用户 SSE 传输 + API Key 透传
  - SSE transport with AsyncLocalStorage session isolation
  - pv_ API Key 认证（SSE 连接时验证，tool 调用透传）
  - Tools: create_entry, get_entry, list_entries, delete_entry
  - 中文错误消息（认证失败, 权限不足）
  - Health check endpoint (/health)
  - Docker support (multi-stage build)

### 安全

- 无服务端 API Key 存储 — 用户自带 pv_ keys
- SSE auth 拒绝 JWT/non-pv_ token
- 503 on PeekView unreachable during validation

### 测试

- 72 tests passing (16 unit + 12 integration + 13 E2E + 31 config/tools)
- 三轮 gstack 评审全部通过

## [0.1.29] - 2026-05-18

### 新增

- **FileTree 目录树层级结构** — 多文件 entry 支持嵌套目录显示
  - 支持层级路径（如 `css/style.css`、`assets/images/logo.png`）
  - 目录折叠/展开功能（默认全部展开）
  - 点击文件切换内容，点击目录切换折叠状态
  - 自动展开包含当前选中文件的目录
  - 扁平文件列表（无 path）保持向后兼容

- **HTML 多文件资源注入** — HTML 文件可引用同 entry 的其他文件
  - CSS 文件自动注入为 `<style>` 标签（内联）
  - JS 文件自动注入为 `<script>` 标签（内联）
  - 图片文件（PNG/JPG/GIF/SVG/WebP）自动转换为 data URI
  - 相对路径警告仅显示未匹配成功的引用
  - 支持层级路径引用（如 `../css/style.css`）

- **SVG 图片渲染** — SVG 文件现在作为图片渲染，而非显示源码
  - 新增 `image/svg+xml` MIME 类型映射
  - SVG 作为文本格式特殊处理（不依赖 isBinary 标志）
  - 支持点击缩放查看

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Pack 按钮功能** — 实现多文件打包下载
  - 新增后端 API `/api/v1/entries/{slug}/download`，返回 ZIP 归档
  - 桌面端 Pack 按钮点击下载 ZIP
  - 移动端操作栏添加 Pack 按钮
  - ZIP 包含 entry 所有文件，保持原始文件名

### 测试

- **FileTree 单元测试**：`FileTree.spec.ts` 13 项测试
  - buildTree 逻辑：层级/扁平/混合场景
  - 折叠状态管理
  - 文件选择事件

- **E2E 测试**：`html-render.spec.ts` 新增
  - TC-TREE-01/02/03：目录树层级结构
  - TC-HTML-INJECT-001~004：资源注入功能
  - TC-HTML-BIN-001~003：二进制资源注入

- **总计**：393 后端测试 + 55+ E2E 测试通过

### 变更

- `guessMimeType()` 新增 SVG 映射
- `isImage` computed 特殊处理 SVG（文本格式）

## [0.1.28] - 2026-05-17

### 新增

- **HTML 网页渲染**：HTML 文件（`.html`）现在直接渲染为网页，而非显示源码
  - 使用 Blob URL + `<iframe sandbox="allow-scripts">` 实现，最小权限沙盒
  - 自动检测相对路径引用并显示警告条（DOMParser 静态检测）
  - 大文件分级处理：< 512KB 正常 / 512KB~2MB 性能警告 / > 2MB 手动触发
  - iframe load/error 事件控制 Loading 态
  - 多文件 entry：`.html` 文件渲染为网页，其他文件保持原有渲染方式
  - Copy 按钮 tooltip 显示"Copy HTML source"，明确复制的是源码
  - HTML 文件不显示 Wrap 按钮

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **前端兼容性**：`isPublic` 字段缺失时默认为 `true`（升级自 v0.1.24 时所有条目被错误标为私有）
  - `api/client.ts`：`is_public ?? true` 替代 `!is_public`

## [0.1.27] - 2026-05-17

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **依赖缺失**：`requests` 库未在 `pyproject.toml` 中声明，导致 `pipx install` 后 Remote CLI 报 `ModuleNotFoundError`


## [0.1.26] - 2026-05-17

### 新增

- **API Key 管理系统** — 用户级 API Key，支持自动化和 CLI 远程操作
  - `pv_` 前缀 + `secrets.token_urlsafe(24)` 生成，HMAC-SHA256 哈希存储
  - 用户级 API Key = JWT 等价权限（正常所有权检查）
  - 支持过期时间（7d/30d/90d/永不）
  - 每用户最多 10 个活跃 Key
  - 撤销、清理过期 Key 功能

- **CLI apikey 命令组** — 远程 API Key 管理
  - `peekview apikey create <name> [--expires 30d]`
  - `peekview apikey list`
  - `peekview apikey revoke <key_id>`
  - `peekview apikey cleanup`

- **API Key 前端管理页** — `/settings/apikeys`
  - 创建 Key 对话框（名称 + 过期时间选择）
  - Key 列表展示（前缀、过期、最后使用时间）
  - 撤销确认、清理过期 Key
  - 创建后显示完整 Key（仅一次）+ 复制按钮

- **All/Mine 标签页筛选** — 条目列表按所有权筛选
  - 已登录用户：All（所有公开 + 自己私有）/ Mine（仅自己条目）
  - 匿名用户：不显示标签页

- **Admin 角色基础功能**
  - 首个注册用户自动成为管理员
  - `peekview user promote/demote` 命令
  - 管理员可撤销任何用户的 API Key

### 变更

- 全局 API Key 中间件：`pv_` 前缀 Key 透传到 JWT 认证流程
- 条目创建：新增 `allow_anonymous_create` 配置项（默认 true）
- 条目列表：新增 `owner` 查询参数（`owner=me` 筛选自己的条目）
- 登录成功提示新增 API Key 使用建议

### 测试

- 后端：新增 `test_apikey.py`（26 测试）
- E2E：新增 All/Mine 标签页测试（3 测试）+ API Key 测试（5 测试）
- 总计：393 后端测试 + 52 E2E 测试通过

## [0.1.25] - 2026-05-16

### 新增

- **Remote CLI 模式** - 支持 CLI 作为 HTTP 客户端连接远程服务端
  - 新增 `PeekClient` 类，通过 HTTP API 与远程服务端通信
  - 透明模式切换：CLI 自动检测本地/远程模式，无需改变命令语法
  - 支持三种配置方式：Config 文件、环境变量、命令行参数
  - 新增 `--remote-url` 选项用于临时指定远程服务端
  - 支持 API Key 认证（`PEEKVIEW_REMOTE__API_KEY`）
  - 二进制文件自动跳过并显示警告

- **API 文档命令** - 新增 `peekview api` 子命令
  - `peekview api endpoints` - 列出所有 API 端点
  - `peekview api openapi` - 显示 OpenAPI/Swagger 文档地址

### 配置

- 新增远程配置项（`~/.peekview/config.yaml`）:
  ```yaml
  remote:
    url: https://peek.example.com
    api_key: sk-your-api-key
    timeout: 30
    verify_ssl: true
  ```

### 文档

- 更新 README.md 添加 Remote CLI 完整使用指南
- 更新 DEPLOYMENT.md 添加远程模式部署说明
- 新增 Remote CLI 集成测试脚本 (`scripts/debug-remote-cli.sh`)

## [0.1.24] - 2026-05-08

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **移动端底部栏布局**
  - 单文件条目：Copy/Download 按钮靠右对齐
  - 多文件条目：Files (N) 按钮靠左，其他按钮靠右
  - 添加 `justify-content: flex-end` 到 `.mobile-actions`

## [0.1.23] - 2026-05-08

### 优化

- **移动端文件按钮优化**
  - 多文件条目：底部栏显示 "Files (N)"，带文件数量
  - 单文件条目：隐藏 Files 按钮（无需文件抽屉）
  - 添加 E2E 测试验证移动端行为

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **数据污染防护**
  - 归档旧 Python E2E 测试 (`tests/archived/e2e/`)
  - 清理生产环境 38 条测试数据
  - 更新发布流程，添加生产数据检查步骤

## [0.1.22] - 2026-05-08

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Front Matter 正则匹配**
  - 移除 `/m` 多行标志，确保只有文件开头的 `---` 被识别为 frontmatter
  - 修复内容中的水平分隔线 `---` 被错误识别为 frontmatter 的问题

- **调试环境数据隔离**
  - 修复 `dev-server.sh` 环境变量名：`PEEKVIEW_DB_PATH` → `PEEKVIEW_STORAGE__DB_PATH`
  - 修复 `dev-server.sh` 环境变量名：`PEEKVIEW_DATA_DIR` → `PEEKVIEW_STORAGE__DATA_DIR`
  - 调试环境 (:8888) 现在正确使用独立数据库，不再污染生产数据

## [0.1.21] - 2026-05-08

### 新增

- **Front Matter 支持**
  - Markdown详情页自动检测并渲染Front Matter元数据
  - 支持YAML格式key-value显示
  - 支持数组类型（如tags）渲染为标签
  - 支持多行文本（`>`折叠语法）
  - 紧凑设计，key对齐，暗色主题适配

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Mermaid resize handle 位置问题**
  - 移除`aspect-ratio`约束，修复resize后handle错位
  - 优化resize起始高度计算
  - 添加`resizing`状态样式确保handle固定

### 文档

- 全面文档整理
  - 归档过时过程文档（P0-P4 checkpoints, superpowers, design等）
  - 修复API路径引用（`/api/entries` → `/api/v1/entries`）
  - 修复包名路径（`backend/peek/` → `backend/peekview/`）
  - 修复前端目录引用（`frontend/` → `frontend-v3/`）
  - 更新active-tasks.md，清理已完成任务
  - 添加归档文档索引

### 新增

- **首页页脚改进**
  - 添加 GitHub 和 PyPI 图标链接
  - 版本号动态从 package.json 读取（构建时注入）
  - 美化布局：图标 + 分隔符 + 版权信息

- **详情页改进**
  - 左上角返回按钮改为房子图标 ⌂
  - 右上角添加主题切换按钮

### 文档

- 更新 `docs/process/release.md` - 说明前端版本号自动注入机制

## [0.1.19] - 2026-05-06

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **静态文件打包修复**
  - 修复 PyPI 包包含旧静态文件的问题（Vite 构建生成新文件名）
  - 确保 `make build` 先清理 `backend/peekview/static/` 目录

## [0.1.18] - 2026-05-06

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Mermaid 图表显示完全修复**
  - SVG 填满容器（修复内联样式 `max-width: 177px` 覆盖 CSS 的问题）
  - Code/Diagram 切换后图表不再消失（改用 CSS clip 方案替代 `display:none`）
  - Fullscreen 模态框正确铺满窗口
  - 添加 `refreshPanZoom()` 方法在切换时重新初始化

### 改进

- **分页器增强**
  - 添加页码列表，支持直接点击跳转
  - 添加快速跳转输入框（Go to page X / Y）
  - 当前页码高亮显示
  - 移动端适配优化

### 文档

- 新增 `docs/frontend/svg-mermaid-patterns.md` - SVG/Mermaid 开发经验总结

## [0.1.17] - 2026-05-06

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Mermaid 图表显示问题**
  - 移除固定高度限制，SVG按自然高度显示
  - 修复 Code 切换回 Diagram 时空白的问题
  - PNG下载使用原始SVG尺寸，避免被截断

### 新增

- **Mermaid 交互增强**
  - Header 添加全屏按钮 (⧉)
  - Diagram/Code 合并为单个切换按钮
  - 添加下拉菜单 (⋯) 收纳 PNG下载 和 Copy Code
  - 添加右下角 resize handle，支持拖动调整图表区域高度
  - 移动端优化：切换按钮仅显示图标

## [0.1.15] - 2026-05-06

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **Mermaid 图表显示问题**
  - 修复区块嵌套层级过多导致可视区域减少（从4层减少到2层）
  - 修复图表被裁剪的问题，SVG完整显示
  - 使用 ResizeObserver 确保 pan-zoom 正确初始化

### 新增

- **Mermaid 图表工具栏增强**
  - 工具栏移至 MERMAID 区块头部，避免占用图表空间
  - Header 显示 Diagram/Code 切换 + PNG 下载 + Copy 按钮
  - 全屏模式工具栏显示缩放控制

- **Mermaid PNG 下载功能**
  - 支持将 Mermaid 图表下载为 PNG 图片
  - 使用原生 Canvas API 实现，无需额外依赖
  - 自动处理背景色和 2x 高清输出

### 变更

- **Mermaid 组件重构**
  - 简化 MermaidDiagram.vue 组件结构
  - 移除内部嵌套工具栏
  - 优化移动端显示

## [0.1.14] - 2026-05-06

### 新增

- **条目列表分页功能**
  - 支持分页显示条目（每页 20 条）
  - 添加 Prev/Next 导航按钮
  - 显示当前页码和总页数

- **Mermaid 图表交互增强**
  - 支持鼠标滚轮缩放
  - 支持鼠标拖拽平移
  - 支持移动端双指缩放和单指拖动
  - 添加全屏查看功能

- **Mermaid Code/Diagram 切换**
  - 支持在渲染图表和源代码之间切换
  - Code 模式支持语法高亮和复制

### 变更

- **发布流程优化**
  - 根目录添加统一 Makefile (`make publish`)
  - 添加版本一致性检查脚本
  - GitHub Actions 自动发布支持前端构建

## [0.1.13] - 2026-05-06

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **版本号一致性**
  - 修复版本号硬编码问题
  - 所有模块统一从 `__init__.py` 导入版本号

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **移动端代码查看器高度问题**
  - 使用 `100dvh` 替代 `100vh` 解决移动端浏览器工具栏导致的高度计算错误
  - 移动端 `.content-area` 和 `.code-viewer` 添加 `min-height: 0` 确保正确填充
  - 代码区现在能在手机浏览器中填满可用空间

## [0.1.10] - 2026-04-28

### 变更

- **所有外部资源本地化**
  - GitHub Markdown CSS: CDN → `/css/github-markdown.css`
  - Inter 字体: Google Fonts → `/fonts/inter-*.ttf`
  - 应用现在可以在无网络环境下正常使用

## [0.1.9] - 2026-04-28

### 新增

- **配置文件支持 (`~/.peekview/config.yaml`)**
  - `peekview config set base_url <url>` - 持久化配置 base URL
  - `peekview config get base_url` - 查看配置
  - `peekview config list` - 列出所有配置
  - CLI `create` 自动读取配置文件中的 base_url
  - `service install --base-url` 自动写入配置文件

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 解决了服务端配置 base_url 后，CLI create 仍返回 127.0.0.1:8080 的问题

## [0.1.8] - 2026-04-28

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **修复版本号不一致**
  - `cli.py` 中硬编码的版本号未更新，导致 `peekview --version` 显示旧版本
  - 统一所有位置版本号为 0.1.8

## [0.1.7] - 2026-04-28

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- **代码查看器高度问题**
  - 修复代码查看器无法填满页面高度的问题
  - 采用 GitHub/VS Code 风格：代码区始终填满可用空间，内部滚动
  - 更新 CSS flexbox 布局（`code.css`, `layout.css`）
  - 短代码和长代码都能正确填满页面，无底部空白

## [0.1.6] - 2026-04-28

### 新增

- **CLI --base-url 选项**
  - `peekview serve --base-url https://example.com` - 支持自定义域名
  - `peekview create --base-url https://example.com` - 创建条目时使用自定义 URL
  - 适用于反向代理场景（如 Cloudflare Tunnel）

- **服务管理命令 (`peekview service`)**
  - `peekview service install` - 安装为系统服务（systemd/launchd）
  - `peekview service install --user` - 安装为用户服务（无需 sudo）
  - `peekview service status/start/stop/uninstall` - 服务管理
  - 支持 Linux (systemd) 和 macOS (launchd)
  - 开机自启、自动重启、日志管理

### 变更

- 版本号更新至 0.1.6

## [0.1.4] - 2026-04-24

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 CLI 创建的条目 URL 格式错误（`http://host/view/slug` → `http://host/slug`）
  - 问题：`peekview create` 生成的 URL 包含 `/view/` 前缀，但实际路由不匹配
  - 修复：移除 `build_view_url` 中的 `/view/` 前缀，与前端路由保持一致
  - 影响文件：`backend/peekview/config.py`, `backend/tests/test_config.py`, `backend/tests/test_entry_service.py`, `backend/tests/test_api.py`

- 修复前端桌面端显示问题 (Task 18)
  - Markdown 标题显示 `#` 符号：禁用 anchor permalink
  - 页面无法滚动：`height: 100vh` → `min-height: 100vh`
  - 代码高亮样式：添加 Shiki CSS 变量支持
  - 桌面端缺少按钮：在详情页 header 添加 Copy/Download 按钮
  - 新增测试：EntryDetailView Copy/Download 按钮显示测试

## [0.1.3] - 2026-04-24

### 新增

- 添加 pipx 安装说明（推荐安装方式）
- 建立开发流程章程 (`docs/process/workflow.md`)
- 添加活跃任务看板 (`docs/process/active-tasks.md`)

## [0.1.2] - 2026-04-24

### 修复

- **Captcha 完整修复**：secret_key 回退自动生成、verify_url 默认值内置模式、PoW 复杂度降低

- **Captcha secret_key**：`_config_to_dataclass` 空 secret 时回退到 `~/.peekview/.captcha_secret` 自动生成的密钥

- 修复 CLI 中 `uvicorn.run` 引用的模块路径错误 (`peek.main` → `peekview.main`)
- 修复所有文档字符串和注释中的项目名称 (`Peek` → `PeekView`)
- 修复错误信息中的配置路径 (`~/.peek` → `~/.peekview`)
- 更新版本号至 0.1.1（CLI 和帮助信息）

## [0.1.1] - 2026-04-24

### 变更

- 项目重命名为 PeekView
- CLI 命令从 `peek` 改为 `peekview`
- 环境变量前缀从 `PEEK_` 改为 `PEEKVIEW_`
- 数据目录从 `~/.peek` 改为 `~/.peekview`
- Python 包名从 `peek` 改为 `peekview`

## [0.1.0] - 2026-04-23

### 新增

- 核心后端功能
  - FastAPI 应用框架，支持异步处理
  - SQLModel 数据模型（Entry、File）
  - SQLite 数据库，支持 WAL 模式和 FTS5 全文搜索
  - 文件存储服务，原子写入和路径遍历防护
  - 完整的安全机制（allowlist、symlink 检测、API Key 认证）

- CLI 工具
  - `peek serve` - 启动 Web 服务
  - `peek create` - 创建条目（支持文件、stdin、目录）
  - `peek get` - 获取条目详情
  - `peek list` - 列出入库（支持搜索、标签过滤、分页）
  - `peek delete` - 删除条目

- Web 前端
  - Vue 3 + Vite + TypeScript 项目
  - Shiki 代码高亮，支持 CSS 变量主题
  - Markdown 渲染（Markdown-it + sanitize-html）
  - 文件树组件（递归树形展示）
  - 主题系统（深色/浅色模式）
  - 移动端适配（抽屉菜单、底部工具栏）
  - EntryListView（条目列表、搜索、分页）
  - EntryDetailView（详情页、文件切换、TOC）

- 测试体系
  - 98 个前端单元测试（Vitest）
  - E2E 测试配置（Playwright）
  - 后端安全测试（26 个测试）
  - CLI 测试（32 个测试）

### 安全

- 路径遍历防护（allowlist 机制）
- Symlink 攻击防护（检查在 resolve 之前）
- API Key 认证（可选）
- XSS 防护（sanitize-html）
- 输入验证（Pydantic）

### 性能

- SQLite WAL 模式提升并发
- Shiki 语法高亮缓存
- 前端代码分割和懒加载
- 30 秒数据缓存
