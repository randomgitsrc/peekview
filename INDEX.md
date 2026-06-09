# PeekView — 项目索引

> 最后更新：2026-05-21
> 当前版本：v0.1.42（Backend/Frontend）| MCP Server v0.8.0

---

## 项目状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| 需求规格 | ✅ 定稿 | MVP + Auth + Remote CLI |
| 技术设计 | ✅ 定稿 | FastAPI + SQLite + Vue 3 |
| 后端实现 | ✅ 完成 | Tasks 0-12 + Auth + API Keys + Admin |
| 前端实现 | ✅ 完成 | Tasks 14-16 + Auth UI + API Keys UI + All/Mine |
| MCP Server | ✅ 完成 | v0.8.0 Streamable HTTP + local/remote 双模式 + publish_files + API Key 透传 |
| E2E 测试 | ✅ 52 测试通过 | chromium + Mobile Chrome |
| 后端测试 | ✅ 417 测试通过 | pytest |
| MCP 测试 | ✅ 166 单元测试通过 | Streamable HTTP transport, integration/e2e 分离, publish_files local-mode E2E opt-in |

---

## 功能实现进度

### 后端（Python + FastAPI）

| 功能 | 状态 | 关键文件 |
|------|------|----------|
| 核心条目 CRUD | ✅ | `api/entries.py`, `services/entry_service.py` |
| 文件上传/下载 | ✅ | `api/files.py`, `services/file_service.py` |
| FTS5 全文搜索 | ✅ | `database.py` |
| 安全防护 | ✅ | `storage.py`, `file_service.py`, `test_security.py` |
| CLI 工具 | ✅ | `cli.py`, `client.py` |
| 用户认证 (JWT) | ✅ | `auth.py`, `api/auth.py` |
| 条目可见性 | ✅ | `models.py` (is_public, owner_id) |
| Admin 角色 | ✅ | `models.py` (is_admin), `cli.py` (promote/demote) |
| API Key 管理 | ✅ | `services/apikey_service.py`, `api/apikeys.py` |
| All/Mine 筛选 | ✅ | `entry_service.py` (owner param) |
| 远程 CLI 模式 | ✅ | `client.py`, `cli.py` |
| 系统服务管理 | ✅ | `cli.py` (service install/start/stop) |

**后端测试覆盖**: 393 测试通过（安全 26 + 认证 30 + API Key 26 + CLI 32 + API + 其他）

### 前端（Vue 3 + Vite + TypeScript）

| 功能 | 状态 | 关键文件 |
|------|------|----------|
| 代码高亮 (Shiki) | ✅ | `composables/useShiki.ts`, `components/CodeViewer.vue` |
| Markdown 渲染 | ✅ | `components/MarkdownViewer.vue` |
| Mermaid 图表 | ✅ | `components/MermaidDiagram.vue` |
| 文件树 | ✅ | `components/FileTree.vue`（支持层级目录结构）|
| 主题切换 | ✅ | `composables/useTheme.ts` |
| 移动端适配 | ✅ | `components/MobileBottomBar.vue`, `MobileFileDrawer.vue` |
| 条目列表 + 分页 | ✅ | `views/EntryListView.vue`, `components/Pagination.vue` |
| 条目详情 | ✅ | `views/EntryDetailView.vue` |
| 用户认证 UI | ✅ | `components/LoginDialog.vue`, `stores/auth.ts` |
| 所有者操作 | ✅ | 可见性切换、删除（卡片操作按钮） |
| All/Mine 标签页 | ✅ | `views/EntryListView.vue` |
| API Key 管理 | ✅ | `views/ApiKeyListView.vue` |
| 用户菜单 | ✅ | 下拉菜单（API Keys + Logout） |

**前端 E2E 测试**: 52 测试通过（基础 + Mermaid + 分页 + 主题 + 移动端 + 认证 + All/Mine + API Keys）

---

## 前端架构 (`frontend-v3/src/`)

```
frontend-v3/src/
├── api/
│   ├── client.ts              # API 请求封装（含 API Key 方法）
│   └── types.ts               # API 响应类型
├── components/
│   ├── CodeViewer.vue         # 代码高亮查看器
│   ├── ConfirmDialog.vue      # 确认对话框
│   ├── LoginDialog.vue        # 登录/注册对话框
│   ├── MarkdownViewer.vue     # Markdown 渲染器
│   ├── MermaidDiagram.vue     # Mermaid 图表渲染
│   ├── FileTree.vue           # 文件目录树
│   ├── Pagination.vue         # 分页器
│   ├── ThemeToggle.vue        # 主题切换
│   ├── MobileFileDrawer.vue   # 移动端文件抽屉
│   ├── MobileTocDrawer.vue    # 移动端 TOC 抽屉
│   └── MobileBottomBar.vue    # 移动端底部工具栏
├── composables/
│   ├── useTheme.ts            # 主题管理
│   ├── useShiki.ts            # Shiki 高亮单例
│   ├── useEntry.ts            # 条目数据获取
│   └── useToast.ts            # Toast 通知
├── stores/
│   ├── auth.ts                # 认证状态（JWT, 三态）
│   └── entry.ts               # 条目列表状态
├── styles/
│   ├── variables.css          # 设计令牌
│   ├── dark.css               # 暗色主题
│   └── light.css              # 亮色主题
├── types/
│   └── index.ts               # TypeScript 类型（Entry, User, ApiKey）
├── views/
│   ├── EntryListView.vue      # 条目列表页（All/Mine 标签页）
│   ├── EntryDetailView.vue    # 条目详情页
│   └── ApiKeyListView.vue     # API Key 管理页
├── router.ts                  # 路由配置（注意：不是 router/index.ts）
├── App.vue
└── main.ts
```

---

## 文档清单

### 📋 规格文档 (`docs/specs/`)

| 文件 | 说明 | 状态 |
|------|------|------|
| [spec-user-auth.md](docs/specs/spec-user-auth.md) | 用户认证规格 — JWT + 可见性 + API Key | ✅ 已实现（v0.1.25）|
| [spec-remote-cli.md](docs/specs/spec-remote-cli.md) | 远程 CLI 规格 | ✅ 已实现（v0.1.25）|
| [spec-html-render.md](docs/specs/spec-html-render.md) | HTML 网页渲染规格 — iframe 沙盒渲染 | ✅ 已实现（v0.1.28）|
| [spec-file-tree.md](docs/specs/spec-file-tree.md) | FileTree 目录树层级结构规格 | ✅ 已实现（v0.1.29）|
| [spec-html-multi-file-inject.md](docs/specs/spec-html-multi-file-inject.md) | HTML 多文件资源注入规格 | ✅ 已实现（v0.1.29）|
| [spec-html-binary-inject.md](docs/specs/spec-html-binary-inject.md) | HTML 二进制资源注入规格 | ✅ 已实现（v0.1.29）|
| [spec-mcp-multi-user.md](docs/specs/spec-mcp-multi-user.md) | MCP Server 多用户认证规格 | ✅ 已实现（MCP v0.2.0）|

> MVP 阶段规格文档已归档至 `docs/archived/specs/`

### 📝 实现计划 (`docs/plans/`)

> 当前无活跃实现计划。已完成的计划均已归档至 `docs/archived/plans/`

### 🔍 评审 (`docs/reviews/`)

| 文件 | 说明 | 状态 |
|------|------|------|
| [ceo-review.md](docs/reviews/ceo-review.md) | CEO 战略评审 | 📖 战略建议仍有参考价值 |
| [design-review.md](docs/reviews/design-review.md) | UI/UX 设计评审 | 📖 前端问题仍需关注 |
| [dx-review.md](docs/reviews/dx-review.md) | DX 开发体验评审 | 📖 DX 改进建议仍适用 |

> 已解决的评审（Eng 评审、预实现审计、API Key 评审 v1/v2）已归档至 `docs/archived/reviews/`

### 🔧 开发与调试 (`docs/process/`)

| 文件 | 说明 | 状态 |
|------|------|------|
| [workflow.md](docs/process/workflow.md) | 开发工作流程 (P0-P4) | ✅ 定稿 |
| [release.md](docs/process/release.md) | 发布流程 | ✅ 定稿 |
| [debug-workflow.md](docs/process/debug-workflow.md) | 调试工作流程 | ✅ 定稿 |
| [debug-lessons.md](docs/process/debug-lessons.md) | 调试经验总结 | ✅ 定稿 |
| [doc-sync-guide.md](docs/process/doc-sync-guide.md) | 文档同步指南 | ✅ 定稿 |
| [doc-sync-pipeline.md](docs/process/doc-sync-pipeline.md) | 文档同步流水线 | ✅ 定稿 |
| [multi-device-guide.md](docs/process/multi-device-guide.md) | 多设备开发指南 | ✅ 定稿 |
| [active-tasks.md](docs/process/active-tasks.md) | 活跃任务看板 | 🔄 使用中 |

### 📦 归档文档 (`docs/archived/`)

| 子目录 | 说明 |
|--------|------|
| `specs/` | 所有规格文档（MVP + Auth + Remote CLI，对应功能均已实现）|
| `plans/` | 所有实现计划（MVP + Auth + Remote CLI + API Keys + Admin Role）|
| `mermaid-feature/` | Mermaid 功能开发过程文档（已上线）|
| `checkpoints/` | 历史任务检查点（P0-T19 等）|
| `incident-report-data-pollution.md` | v0.1.22 生产数据污染事件记录 |
| `reviews/` | 已解决的评审（Eng 评审、预实现审计、API Key 评审 v1/v2） |
| `P0-T19/` ~ `P4-T19/` | 软件工程化检查点文档 |
| `superpowers/` | AI 辅助设计历史 |
| `design/` | UI 设计规范 v1.0（已过时） |

### 🎨 前端技术文档 (`docs/frontend/`)

| 文件 | 说明 | 状态 |
|------|------|------|
| [svg-mermaid-patterns.md](docs/frontend/svg-mermaid-patterns.md) | SVG/Mermaid 组件开发经验 | ✅ 定稿 |

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | FastAPI | 0.110+ |
| 数据库 | SQLite + SQLModel | 3.40+ |
| 全文搜索 | SQLite FTS5 | 内置 |
| 前端框架 | Vue | 3.4+ |
| 构建工具 | Vite | 5.4+ |
| 代码高亮 | Shiki | 1.10+ |
| 测试（后端）| pytest | 8.0+ |
| E2E 测试 | Playwright | 1.59+ |

---

## MVP 功能边界

### 已实现

**后端**:
- ✅ 条目 CRUD（创建、查看、更新、删除）
- ✅ 文件上传（内容直传、本地路径引用、目录扫描）
- ✅ FTS5 全文搜索 + 标签过滤
- ✅ 资源限制（文件大小、条目文件数、总存储）
- ✅ 安全机制（路径遍历防护、allowlist、symlink 检测、XSS 防护）
- ✅ CLI 工具（serve/create/list/get/delete/user/login/apikey/config/service）
- ✅ 远程 CLI 模式
- ✅ 用户认证（JWT、bcrypt、注册/登录/登出）
- ✅ 条目可见性（public/private、owner_id）
- ✅ Admin 角色（首用户自动 admin、promote/demote）
- ✅ API Key 管理（pv_ 前缀、HMAC-SHA256、过期时间、CLI 管理）
- ✅ All/Mine 条目筛选

**前端**:
- ✅ 条目详情页（代码高亮、Markdown 渲染、目录树、Mermaid）
- ✅ 条目列表页（列表 + 搜索 + 分页 + All/Mine 标签页）
- ✅ 用户认证 UI（登录/注册对话框、用户菜单）
- ✅ API Key 管理页（创建/列表/撤销/复制）
- ✅ 所有者操作（可见性切换、删除）
- ✅ 主题切换（暗色/亮色）
- ✅ 移动端完整适配
- ✅ URL 行号高亮 + 文件深链接

**MCP Server**:
- ✅ Streamable HTTP 传输 + 多用户 API Key 透传
- ✅ Tools: create_entry, get_entry, list_entries, delete_entry
- ✅ 中文错误消息（认证失败, 权限不足）
- ✅ Health check endpoint (/health)
- ✅ Docker 支持 + npm 发布 (@peekview/mcp-server)

### 未实现（P1/P2）

- ❌ 条目编辑 UI（API 已支持 PATCH）
- ❌ 嵌入式分享 iframe
