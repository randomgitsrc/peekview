# Changelog

所有对 PeekView 项目的显著更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.35] - 2026-05-22

### 新增

-

### 修复

-

### 变更

-


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

- Makefile `debug-verify-isolation` shell 语法错误（多行 Python 转单行）
- npm workflow 并发控制、版本校验（3轮 gstack 评审全部通过）
- MCP Server package-lock.json 版本同步（`npm install --package-lock-only`）

### 变更

- MCP Server 版本独立演进（当前 v0.2.0），`bump-version` 不再覆盖 MCP package.json


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

- **前端兼容性**：`isPublic` 字段缺失时默认为 `true`（升级自 v0.1.24 时所有条目被错误标为私有）
  - `api/client.ts`：`is_public ?? true` 替代 `!is_public`

## [0.1.27] - 2026-05-17

### 修复

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

- **数据污染防护**
  - 归档旧 Python E2E 测试 (`tests/archived/e2e/`)
  - 清理生产环境 38 条测试数据
  - 更新发布流程，添加生产数据检查步骤

## [0.1.22] - 2026-05-08

### 修复

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

- **静态文件打包修复**
  - 修复 PyPI 包包含旧静态文件的问题（Vite 构建生成新文件名）
  - 确保 `make build` 先清理 `backend/peekview/static/` 目录

## [0.1.18] - 2026-05-06

### 修复

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

- **版本号一致性**
  - 修复版本号硬编码问题
  - 所有模块统一从 `__init__.py` 导入版本号

### 修复

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

- 解决了服务端配置 base_url 后，CLI create 仍返回 127.0.0.1:8080 的问题

## [0.1.8] - 2026-04-28

### 修复

- **修复版本号不一致**
  - `cli.py` 中硬编码的版本号未更新，导致 `peekview --version` 显示旧版本
  - 统一所有位置版本号为 0.1.8

## [0.1.7] - 2026-04-28

### 修复

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
