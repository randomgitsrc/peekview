# Changelog

所有对 PeekView 项目的显著更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
