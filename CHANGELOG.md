# Changelog

所有对 PeekView 项目的显著更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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
