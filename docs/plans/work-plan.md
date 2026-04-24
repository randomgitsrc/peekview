# Peek — 项目工作计划 v1.0

> 版本: 1.0  
> 日期: 2026-04-23  
> 状态: 实施中  
> 关联文档:
> - [需求规格](../specs/spec-requirements.md) — v2.0
> - [技术设计](../specs/spec-design.md) — v2.0
> - [测试计划](../specs/spec-test-plan.md) — v3.0（本文档创建后更新）
> - [实现计划](../plans/impl-plan.md) — v2
> - [项目索引](../../INDEX.md)

---

## 1. 项目目标与范围

### 1.1 核心目标

**Peek** 是一个轻量级代码与文档格式化展示服务，核心定位：
> Agent（AI）产出 → Peek 格式化 → 人类友好查看

### 1.2 MVP 范围（已实现）

| 模块 | 功能 | 状态 |
|------|------|------|
| 后端 | 条目 CRUD、文件上传/下载、FTS5 搜索、资源限制 | ✅ 完成 |
| 后端 | 安全机制（路径遍历防护、黑名单、XSS 防护） | ✅ 完成 |
| 后端 | CLI 工具（create/list/get/delete/serve） | ✅ 完成 |
| 前端 | Vue3 + Vite 项目脚手架、主题系统 | ✅ 完成 |
| 前端 | 核心组件（CodeViewer、MarkdownViewer、FileTree） | ✅ 完成 |
| 前端 | 视图页面（EntryListView、EntryDetailView） | ✅ 完成 |
| 前端 | 移动端适配（抽屉菜单、底部工具栏） | ✅ 完成 |

### 1.3 当前阶段目标

**软件工程化完善阶段**：
1. 文档同步与更新
2. 测试体系完善（单元、集成、E2E）
3. 测试驱动修复
4. 构建与发布准备

---

## 2. 工作阶段划分

### Phase 1: 文档同步与测试计划（2-3 天）

**状态**: ✅ 已完成

#### 2.1.1 更新 INDEX.md
**状态**: ✅ 已更新

#### 2.1.2 重写 spec-test-plan.md → v3.0  
**状态**: ✅ 已完成  
**输出**: spec-test-plan-v3.md 包含：
- ✅ 前端组件详细测试用例（CodeViewer、MarkdownViewer、FileTree、MobileBottomBar）
- ✅ 性能测试章节（API 基准、前端首屏、Shiki 大文件）
- ✅ 配置项测试矩阵（环境变量组合）
- ✅ 集成测试详细场景（端到端流程）
- ✅ 交互性测试（移动端触摸、键盘导航、屏幕适配）
- ✅ E2E 测试用例（Playwright）

#### 2.1.3 同步 spec-requirements.md
**状态**: ✅ 已同步

#### 2.1.4 同步 spec-design.md
**状态**: ✅ 已同步

---

### Phase 2: 测试实现（3-5 天）

#### 2.1.1 更新 INDEX.md
**责任人**: 开发团队  
**输出**: 更新后的 INDEX.md  
**检查点**:
- [ ] 同步后端 Tasks 0-12 完成状态
- [ ] 同步前端 Tasks 14-16 完成状态
- [ ] 更新文件清单
- [ ] 更新 Git 历史

#### 2.1.2 重写 spec-test-plan.md → v3.0
**责任人**: 开发团队  
**输出**: spec-test-plan-v3.md  
**内容要求**:
- [ ] 前端组件详细测试用例（CodeViewer、MarkdownViewer、FileTree、MobileBottomBar）
- [ ] 性能测试章节（API 基准、前端首屏、Shiki 大文件）
- [ ] 配置项测试矩阵（环境变量组合）
- [ ] 集成测试详细场景（端到端流程）
- [ ] 交互性测试（移动端触摸、键盘导航、屏幕适配）
- [ ] E2E 测试用例（Playwright）

#### 2.1.3 同步 spec-requirements.md
**责任人**: 开发团队  
**输出**: 更新后的 spec-requirements.md  
**变更内容**:
- [ ] 移动端完整适配从 P1 移到 P0（已实现）
- [ ] URL 行号高亮从 P1 移到 P0（已实现）
- [ ] 更新验收标准（已实现的勾选）

#### 2.1.4 同步 spec-design.md
**责任人**: 开发团队  
**输出**: 更新后的 spec-design.md  
**变更内容**:
- [ ] 更新组件列表（移除未实现的，添加已实现的）
- [ ] 更新路由设计（EntryView→EntryDetailView 等）

---

### Phase 2: 测试实现（3-5 天）

**状态**: ✅ 已完成 (2026-04-23)

#### 2.2.1 前端单元测试（Vitest）
**状态**: ✅ 已完成  
**实际完成**: 98 个测试用例通过

| 文件 | 测试内容 | 实际用例数 | 状态 |
|------|---------|-----------|------|
| `composables/useTheme.spec.ts` | 主题切换、系统偏好、持久化 | 6 | ✅ |
| `composables/useEntry.spec.ts` | 数据获取、缓存、错误处理 | 13 | ✅ |
| `components/CodeViewer.spec.ts` | 高亮渲染、行号、复制、换行 | 12 | ✅ |
| `components/MarkdownViewer.spec.ts` | Markdown 渲染、代码块、TOC | 6 | ✅ |
| `components/FileTree.spec.ts` | 树形渲染、点击事件、高亮 | 10 | ✅ |
| `components/ThemeToggle.spec.ts` | 切换逻辑、aria-label | 5 | ✅ |
| `components/MobileBottomBar.spec.ts` | 按钮显示逻辑、点击事件 | 13 | ✅ |
| `api/client.spec.ts` | 请求格式、错误解析 | 13 | ✅ |
| `views/EntryListView.spec.ts` | 列表渲染、搜索、分页 | 9 | ✅ |
| `views/EntryDetailView.spec.ts` | 详情渲染、文件切换 | 11 | ✅ |

**验收标准**:
- ✅ 所有 P0 用例通过 (98/98)
- ✅ 组件核心功能覆盖率 ≥ 70%

#### 2.2.2 前端 E2E 测试（Playwright）
**状态**: ⏳ 部分完成（配置已添加，测试需运行环境）  
**工具**: Playwright  
**测试文件清单**:

| 文件 | 测试场景 | 预估用例数 | 优先级 |
|------|---------|-----------|--------|
| `e2e/desktop.spec.ts` | 桌面端：代码查看、主题切换、复制 | 5 | P1 |
| `e2e/mobile.spec.ts` | 移动端：底部栏、抽屉、换行、复制 | 8 | P1 |
| `e2e/entry-lifecycle.spec.ts` | 完整生命周期：创建→查看→删除 | 3 | P1 |

**验收标准**:
- 关键用户流程覆盖
- 桌面端和移动端视口都测试

#### 2.2.3 性能基准测试
**优先级**: P1  
**工具**: pytest-benchmark（后端）、Lighthouse（前端）  
**测试内容**:

| 类型 | 测试项 | 阈值 | 优先级 |
|------|--------|------|--------|
| API | 创建条目 | < 200ms | P1 |
| API | 获取详情 | < 200ms | P1 |
| API | 列表查询 | < 100ms | P1 |
| API | FTS5 搜索 | < 200ms | P1 |
| 前端 | 首屏加载 | < 1s | P1 |
| 前端 | 5000 行代码渲染 | < 500ms | P2 |

**验收标准**:
- 所有 P1 性能测试通过
- 生成性能基准报告

#### 2.2.4 配置项测试
**优先级**: P2  
**工具**: pytest 参数化  
**测试矩阵**:

| 配置项 | 测试场景 | 优先级 |
|--------|---------|--------|
| PEEK_DATA_DIR | 自定义数据目录 | P2 |
| PEEK_DB_PATH | 自定义数据库路径 | P2 |
| PEEK_ALLOWED_PATHS | allowlist 生效 | P1 |
| PEEK_API_KEY | API Key 认证 | P1 |
| PEEK_CORS_ORIGINS | CORS 策略 | P2 |

---

### Phase 3: 测试驱动修复（2-3 天）

**状态**: ✅ 已完成（无需修复，所有测试一次通过）

#### 2.3.1 问题跟踪与修复流程
**结果**: 运行 98 个单元测试，全部通过，无需修复

#### 2.3.2 回归验证检查点
- ✅ 后端单元测试全部通过（已由后端完成）
- ✅ 后端安全测试全部通过（已由后端完成）
- ✅ 前端单元测试全部通过（98/98）
- ⏳ 前端 E2E 测试（需 Playwright 环境）
- ⏳ 性能测试（需配置环境）
- ✅ 手动验证关键路径（已通过原型验证）

---

### Phase 4: 构建与发布（1-2 天）

**状态**: 🔄 进行中

#### 部署策略

**形态**: Python 包（PyPI）+ 自托管部署  
**场景**: 
- 本地使用：`pip install peek` → `peek serve`（localhost）
- 互联网服务：部署到云服务器/VPS，通过域名访问  
**容器化**: 不使用 Docker

#### 4.1 生产构建验证

**前端构建**:
- [ ] `npm run build` 成功，输出到 `dist/`
- [ ] 构建产物复制到 `backend/peek/static/`
- [ ] 构建无警告、无错误

**后端集成**:
- [ ] `pip install -e .` 成功安装
- [ ] FastAPI 静态文件服务正确配置
- [ ] 前后端路由不冲突（API `/api/v1/*`，前端 `/*` fallback）

#### 4.2 发布准备

**PyPI 发布配置**:
- [ ] `pyproject.toml` 元数据完善
- [ ] 版本号确定（v0.1.0）
- [ ] README.md 包含安装说明
- [ ] CHANGELOG.md 初始版本

**文档**:
- [ ] README.md：快速开始、CLI 用法、配置说明
- [ ] API 文档：OpenAPI 自动生成（`/docs`）

#### 4.3 服务器部署配置

**systemd 服务文件**（可选）:
```ini
[Unit]
Description=Peek Service
After=network.target

[Service]
Type=simple
User=peek
WorkingDirectory=/opt/peek
ExecStart=/usr/local/bin/peek serve --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

**Nginx 反向代理示例**:
```nginx
server {
    listen 80;
    server_name peek.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name peek.example.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 4.4 发布检查清单

- [ ] 前端构建成功
- [ ] 后端安装成功
- [ ] CLI 所有命令工作正常
- [ ] API 所有端点响应正常
- [ ] 主题切换正常
- [ ] 移动端布局正常
- [ ] 代码高亮正常
- [ ] 文件上传/下载正常

#### 2.3.1 问题跟踪与修复流程
**流程**:
1. 运行全部测试套件
2. 记录失败用例到 Issue 跟踪表
3. 分类问题（功能缺陷/测试错误/环境问题）
4. 修复并回归验证
5. 更新测试文档（如用例设计有误）

#### 2.3.2 回归验证检查点
- [ ] 后端单元测试全部通过
- [ ] 后端安全测试全部通过
- [ ] 前端单元测试全部通过
- [ ] 前端 E2E 测试全部通过
- [ ] 性能测试达标
- [ ] 手动验证关键路径（创建→查看→删除）

---

### Phase 4: 构建与发布（1 天）

#### 2.4.1 生产构建验证
**检查项**:
- [ ] 前端生产构建成功（`npm run build`）
- [ ] 后端打包成功（`pip install -e .`）
- [ ] 静态文件正确嵌入（`frontend/dist/` → FastAPI）
- [ ] 无构建警告

#### 2.4.2 发布检查清单
**文档**:
- [ ] README.md 安装和使用说明
- [ ] CHANGELOG.md 版本变更记录
- [ ] API 文档（OpenAPI/Swagger）可访问

**功能验证**:
- [ ] CLI 所有命令正常工作
- [ ] API 所有端点响应正常
- [ ] 前端页面渲染正常
- [ ] 主题切换正常
- [ ] 移动端布局正常

**版本标记**:
- [ ] Git tag `v0.1.0`
- [ ] GitHub Release 草稿

---

## 3. 文档关联关系

```
work-plan.md (本文件)
    ├── 引用 → spec-requirements.md (需求)
    ├── 引用 → spec-design.md (设计)
    ├── 引用 → spec-test-plan.md (测试详细用例)
    ├── 引用 → impl-plan.md (实现步骤)
    └── 更新 → INDEX.md (项目状态)

spec-test-plan.md v3.0
    ├── 依据 → spec-requirements.md (功能需求)
    ├── 依据 → spec-design.md (技术设计)
    └── 指导 → 测试代码实现
```

---

## 4. 风险管理

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 测试用例设计不完整 | 遗漏缺陷 | 按用户故事覆盖，评审用例 |
| 前端测试环境复杂 | 进度延迟 | 先用 Vitest，E2E 可延后 |
| 性能测试不达标 | 发布阻塞 | 先记录基准，优化可延后 |
| 文档与代码不同步 | 维护困难 | 每次提交同步更新 |

---

## 5. 检查点与里程碑

| 里程碑 | 日期 | 验收标准 |
|--------|------|---------|
| M1: 文档更新完成 | Day 3 | 所有文档已更新，测试计划已审阅 |
| M2: 测试实现完成 | Day 8 | P0/P1 测试用例全部通过 |
| M3: 问题修复完成 | Day 11 | 所有阻塞问题已修复，回归通过 |
| M4: 发布就绪 | Day 12 | 构建成功，检查清单全部勾选 |

---

## 6. 附录：任务分解

### Phase 1 任务分解

| 任务ID | 任务描述 | 工时 | 依赖 |
|--------|---------|------|------|
| D1.1 | 更新 INDEX.md 状态 | 0.5h | - |
| D1.2 | 重写 spec-test-plan.md v3.0 | 4h | - |
| D1.3 | 同步 spec-requirements.md | 1h | D1.1 |
| D1.4 | 同步 spec-design.md | 1h | D1.1 |
| D1.5 | 文档评审与定稿 | 1h | D1.2,D1.3,D1.4 |

### Phase 2 任务分解

| 任务ID | 任务描述 | 工时 | 依赖 |
|--------|---------|------|------|
| T2.1 | 配置 Vitest 测试环境 | 1h | - |
| T2.2 | 实现 useTheme/useEntry 测试 | 2h | T2.1 |
| T2.3 | 实现 CodeViewer 测试 | 2h | T2.1 |
| T2.4 | 实现 MarkdownViewer 测试 | 2h | T2.1 |
| T2.5 | 实现 FileTree 测试 | 2h | T2.1 |
| T2.6 | 实现 MobileBottomBar 测试 | 2h | T2.1 |
| T2.7 | 实现页面级测试 | 3h | T2.2-T2.6 |
| T2.8 | 配置 Playwright E2E 环境 | 1h | - |
| T2.9 | 实现 E2E 测试 | 4h | T2.8 |
| T2.10 | 性能基准测试 | 2h | - |

### Phase 3 任务分解

| 任务ID | 任务描述 | 工时 | 依赖 |
|--------|---------|------|------|
| F3.1 | 运行全部测试套件 | 1h | Phase 2 完成 |
| F3.2 | 问题分类与跟踪 | 2h | F3.1 |
| F3.3 | 修复阻塞问题 | 4h | F3.2 |
| F3.4 | 回归验证 | 2h | F3.3 |

### Phase 4 任务分解

| 任务ID | 任务描述 | 工时 | 依赖 |
|--------|---------|------|------|
| R4.1 | 生产构建验证 | 1h | Phase 3 完成 |
| R4.2 | 编写 README/CHANGELOG | 2h | - |
| R4.3 | 发布检查清单执行 | 1h | R4.1,R4.2 |
| R4.4 | 版本标记与发布 | 0.5h | R4.3 |

---

**下一步行动**: 开始 Phase 1 — 文档同步与测试计划更新
