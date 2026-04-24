# PeekView — 项目索引

> 最后更新：2026-04-24  
> 工作计划：[docs/plans/work-plan.md](docs/plans/work-plan.md)

---

## 项目状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| 需求规格 | ✅ v2.0 定稿 | 2026-04-17 |
| 技术设计 | ✅ v2.0 定稿 | 2026-04-17 |
| 测试计划 | ✅ v3.0 定稿 | 2026-04-24 |
| 三方评审（PM/架构/QA） | ✅ 修正已提交 `ece3c0e` | 2026-04-17 |
| 实现计划 | ✅ v2 定稿 | 2026-04-18 |
| autoplan 对抗评审 | ✅ CEO/Design/Eng/DX 四方完成 | 2026-04-18 |
| 后端实现 | ✅ Tasks 0-12 完成 | 2026-04-22 |
| 前端实现 | ✅ Tasks 14-16 完成 | 2026-04-23 |
| 软件工程化 | ✅ Phase 1-4 完成 | 2026-04-24 |

---

## 实现进度详情

### 后端（Python + FastAPI）

| 任务 | 内容 | 状态 | 关键文件 |
|------|------|------|----------|
| Task 0 | 测试基础设施 | ✅ | `tests/conftest.py`, `tests/factories.py` |
| Task 1 | 项目脚手架 | ✅ | `pyproject.toml`, `peek/__main__.py` |
| Task 2 | 异常层级 | ✅ | `peek/exceptions.py` |
| Task 3 | 配置管理 | ✅ | `peek/config.py` |
| Task 4 | 数据模型 | ✅ | `peek/models.py` |
| Task 5 | 语言检测 | ✅ | `peek/language.py` |
| Task 6 | 数据库初始化 | ✅ | `peek/database.py` (WAL + FTS5) |
| Task 7 | 文件存储层 | ✅ | `peek/storage.py` (原子写入、路径安全) |
| Task 8 | 文件服务 | ✅ | `peek/services/file_service.py` (allowlist) |
| Task 9 | 条目服务 | ✅ | `peek/services/entry_service.py` (事务) |
| Task 10 | API 路由 | ✅ | `peek/api/entries.py`, `peek/api/files.py` |
| Task 11 | 安全测试 | ✅ | `tests/test_security.py` (26 tests) |
| Task 12 | CLI 命令 | ✅ | `peek/cli.py`, `tests/test_cli.py` (32 tests) |

**后端测试覆盖**:
- 单元测试：models, storage, language, cleanup
- API 测试：所有 HTTP 端点
- CLI 测试：所有命令
- 安全测试：路径遍历、黑名单、XSS、SQL 注入
- **当前覆盖率**: ~75%

### 前端（Vue 3 + Vite + TypeScript）

| 任务 | 内容 | 状态 | 关键文件 |
|------|------|------|----------|
| Task 14 | 项目脚手架 | ✅ | `package.json`, `vite.config.ts`, `tsconfig.json` |
| Task 14 | 设计系统 | ✅ | `variables.css`, `dark.css`, `light.css` |
| Task 14 | 主题系统 | ✅ | `useTheme.ts`, FOUC 预防 |
| Task 15 | 类型定义 | ✅ | `types/index.ts` |
| Task 15 | API 客户端 | ✅ | `api/client.ts` |
| Task 15 | UI 组件 | ✅ | `Button.vue`, `IconButton.vue`, `Toast.vue`, `Tooltip.vue`, `LoadingSkeleton.vue` |
| Task 15 | Toast 系统 | ✅ | `useToast.ts`, `Toast.vue` |
| Task 16a | 主题基础设施 | ✅ | `index.html` FOUC 脚本, `useTheme.ts` |
| Task 16b | Shiki 高亮 | ✅ | `useShiki.ts` (单例, CSS variables 模式) |
| Task 16b | CodeViewer | ✅ | `CodeViewer.vue` (行号、复制、换行、URL hash) |
| Task 16b | MarkdownViewer | ✅ | `MarkdownViewer.vue` (TOC、代码块复制、表格滚动) |
| Task 16b | FileTree | ✅ | `FileTree.vue`, `TreeNodeItem.vue` (递归树) |
| Task 16c | 数据获取 | ✅ | `useEntry.ts` (缓存、错误状态) |
| Task 16c | 主题切换组件 | ✅ | `ThemeToggle.vue` |
| Task 16c | 移动端抽屉 | ✅ | `MobileFileDrawer.vue`, `MobileTocDrawer.vue` |
| Task 16c | 移动端底部栏 | ✅ | `MobileBottomBar.vue` (Wrap/Copy/Download/TOC) |
| Task 16c | 列表视图 | ✅ | `EntryListView.vue` (搜索、分页、加载/错误态) |
| Task 16c | 详情视图 | ✅ | `EntryDetailView.vue` (三栏布局、URL 深链接) |

**前端架构**:
```
src/
├── api/
│   └── client.ts              # API 请求封装
├── components/
│   ├── CodeViewer.vue         # 代码高亮查看器
│   ├── MarkdownViewer.vue     # Markdown 渲染器
│   ├── FileTree.vue           # 文件目录树
│   ├── TreeNodeItem.vue       # 递归树节点
│   ├── ThemeToggle.vue        # 主题切换按钮
│   ├── MobileFileDrawer.vue   # 移动端文件抽屉
│   ├── MobileTocDrawer.vue    # 移动端 TOC 抽屉
│   ├── MobileBottomBar.vue    # 移动端底部工具栏
│   └── ui/                    # 基础 UI 组件
│       ├── Button.vue
│       ├── IconButton.vue
│       ├── Toast.vue
│       ├── Tooltip.vue
│       └── LoadingSkeleton.vue
├── composables/
│   ├── useTheme.ts            # 主题管理
│   ├── useShiki.ts            # Shiki 高亮单例
│   ├── useEntry.ts            # 条目数据获取（含缓存）
│   └── useToast.ts            # Toast 通知
├── styles/
│   ├── variables.css          # 设计令牌
│   ├── dark.css               # 暗色主题
│   ├── light.css              # 亮色主题
│   └── components.css         # 组件基础样式
├── types/
│   └── index.ts               # TypeScript 类型定义
├── views/
│   ├── EntryListView.vue      # 条目列表页
│   └── EntryDetailView.vue    # 条目详情页
├── App.vue
└── main.ts
```

**前端测试**: ✅ 98 测试通过（Vitest + Playwright 配置）

---

## 文档清单

### 📋 规格文档 (`docs/specs/`)

| 文件 | 说明 | 状态 | 版本 | 日期 |
|------|------|------|------|------|
| [spec-requirements.md](docs/specs/spec-requirements.md) | 需求规格 — 10 用户故事 | ✅ 定稿 | v2.0 | 2026-04-17 |
| [spec-design.md](docs/specs/spec-design.md) | 技术设计 — FastAPI+SQLite+Vue3 | ✅ 定稿 | v2.0 | 2026-04-17 |
| [spec-test-plan.md](docs/specs/spec-test-plan.md) | 测试计划 — 详细用例 | ✅ 定稿 | v3.0 | 2026-04-24 |
| [spec-review-report.md](docs/specs/spec-review-report.md) | 三方评审综合报告 | ✅ 定稿 | v2.0 | 2026-04-17 |
| [spec-design-review.md](docs/specs/spec-design-review.md) | 架构师评审意见 | ✅ 定稿 | - | 2026-04-17 |
| [spec-test-review.md](docs/specs/spec-test-review.md) | QA 评审意见 | ✅ 定稿 | - | 2026-04-17 |

### 📝 实现与计划 (`docs/plans/`)

| 文件 | 说明 | 状态 | 版本 | 日期 |
|------|------|------|------|------|
| [impl-plan.md](docs/plans/impl-plan.md) | MVP 实现计划 — 16 任务 | ✅ 定稿 | v2 | 2026-04-18 |
| [work-plan.md](docs/plans/work-plan.md) | **工作计划 — 软件工程化** | ✅ 已完成 | v1.0 | 2026-04-24 |
| [impl-plan.restore.md](docs/plans/impl-plan.restore.md) | v1 计划还原点 | 📦 归档 | v1 | 2026-04-18 |

### 🔍 对抗评审 (`docs/reviews/`)

| 文件 | 说明 | 评分 | 日期 |
|------|------|------|------|
| [ceo-review.md](docs/reviews/ceo-review.md) | CEO 战略评审 | 3.5/10 | 2026-04-18 |
| [design-review.md](docs/reviews/design-review.md) | Design UI/UX 评审 | 3.2/10 | 2026-04-18 |
| [eng-review.md](docs/reviews/eng-review.md) | Eng 架构评审 | 4 CRIT / 11 HIGH | 2026-04-18 |
| [dx-review.md](docs/reviews/dx-review.md) | DX 开发体验评审 | 3.5/10 | 2026-04-18 |
| [pre-impl-audit.md](docs/reviews/pre-impl-audit.md) | 编码前审查汇总 | 审查报告 | 2026-04-21 |

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | FastAPI | 0.110+ |
| 数据库 | SQLite + SQLModel | 3.40+ |
| 全文搜索 | SQLite FTS5 | 内置 |
| 前端框架 | Vue | 3.4+ |
| 构建工具 | Vite | 5.2+ |
| 代码高亮 | Shiki | 1.6+ |
| Markdown | markdown-it | 14.1+ |
| 图标 | @iconify/vue | 4.1+ |
| 测试（后端）| pytest | 8.0+ |
| 测试（前端）| Vitest | 1.5+ |
| E2E 测试 | Playwright | 1.43+ |

---

## MVP 功能边界

### 已实现（P0）

**后端**:
- ✅ 条目 CRUD（创建、查看、删除）
- ✅ 文件上传（内容直传、本地路径引用）
- ✅ 文件下载（单文件、zip 打包）
- ✅ 目录结构保留（src/main.py → src/main.py）
- ✅ FTS5 全文搜索
- ✅ 资源限制（文件大小、条目文件数、总存储）
- ✅ 安全机制（路径遍历防护、黑名单、XSS 防护）
- ✅ CLI 工具（serve/create/list/get/delete）
- ✅ 健康检查（/health）

**前端**:
- ✅ 条目详情页（代码高亮、Markdown 渲染、目录树）
- ✅ 条目列表页（列表 + 搜索 + 分页）
- ✅ 主题切换（暗色/亮色）
- ✅ 移动端完整适配（抽屉菜单、底部工具栏）
- ✅ 复制/下载按钮
- ✅ URL 行号高亮（#L5-L10）
- ✅ URL 文件选择（?file=main.py）

### 明确不在 MVP（P1/P2）

- ❌ 更新条目（可用删除+重建替代）
- ❌ MCP Server（P1 实现）
- ❌ 过期自动清理（P1 实现）
- ❌ Mermaid 图表渲染（P2 实现）
- ❌ 嵌入式分享 iframe（P1 实现）

---

## 评审修订追踪

v2 计划已包含以下修订：

🔴 **CRITICAL (7)**: 文件内容端点 / allowlist / API key / 符号链接 / path遍历 / get_engine / EntryCreate  
🟠 **HIGH (8)**: DI app.state / 模块级app / conftest Task0 / Shiki单例 / FileTree树 / FOUC主题 / 事务 / 静态文件  
🟡 **MEDIUM+LOW (5)**: .gitignore+Makefile / 201状态码 / URL行号 / expires_in边界 / created_at默认值

---

## Git 历史

| Commit | 说明 | 日期 |
|--------|------|------|
| `193cfbd` | auto sync: 前端 Task 16b/16c 核心组件 | 2026-04-23 |
| `0c9ff3c` | feat(frontend): Task 15 - UI Components | 2026-04-23 |
| `240113e` | feat(frontend): Task 14 - Vue 3 + Vite | 2026-04-22 |
| `ab1c8be` | feat(backend): Task 8 - File Service | 2026-04-21 |
| `f0feddf` | docs: pre-implementation audit | 2026-04-21 |
| `ece3c0e` | v2.0 文档评审修正 | 2026-04-17 |

---

## 下一步行动

所有 Phase 已完成，项目已就绪：

- ✅ 代码：前后端完整实现
- ✅ 测试：98 个单元测试通过
- ✅ 文档：README、DEPLOYMENT、CHANGELOG 完整
- 🚀 可选：PyPI 发布、服务器部署
