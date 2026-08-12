# Peek 项目 —— 编码前审查汇总报告

> 审查日期: 2026-04-21  
> 审查范围: 所有规格文档、实现计划、四方评审报告  
> 审查目的: 在编码开始前统一修正发现的问题，避免开发返工

---

## 执行摘要

本次审查发现 **20个关键问题**（CRITICAL/HIGH），其中 **5个阻塞编码**：

| 优先级 | 数量 | 状态 |
|--------|------|------|
| 🔴 CRITICAL | 7 | 已修正 (v2修订) |
| 🟠 HIGH | 13 | 已修正 (v2修订) |
| 🟡 MEDIUM | 5 | 待评估 |

**结论**: v2修订版已解决主要技术问题，但文档分散、MVP边界不清、任务顺序错乱仍需整理。

---

## 阻塞编码的5个问题

### 1. 任务顺序错乱（已修正）
**问题**: `conftest.py` 在 Task 13，但从 Task 2 就需要  
**影响**: 测试 fixture 重复定义，测试不可靠  
**修正**: 将 conftest.py 移到 **Task 0**

### 2. 缺少文件内容端点（已修正）
**问题**: 前端无法获取文件内容进行展示  
**影响**: 核心功能无法工作，点击文件显示空白  
**修正**: 添加 `GET /entries/{slug}/files/{file_id}/content` 端点

### 3. local_path 安全风险（已修正）
**问题**: 黑名单机制可被符号链接绕过  
**影响**: 任意文件读取漏洞  
**修正**: 改为 **allowlist（白名单）** 机制

### 4. 前端工作量低估（需调整计划）
**问题**: Task 16 试图在一个任务中完成7个组件+2个视图+3个CSS  
**影响**: 实际工作量是估计的3-4倍  
**修正**: 拆分为 Task 16a/16b/16c

### 5. MVP边界不清（需补充文档）
**问题**: 需求文档第6节才提到MVP，且无明确边界  
**影响**: 范围膨胀风险  
**修正**: 在需求规格开头添加明确的MVP定义

---

## 20个关键修订（v2版已包含）

### CRITICAL (7项)

| # | 问题 | 来源 | 修正方案 |
|---|------|------|----------|
| 1 | 缺少文件内容端点 | CEO+Eng+Design+DX | 添加 `/content` 端点 |
| 2 | local_path 黑名单→allowlist | CEO+Eng | 白名单机制 |
| 3 | API Key 认证 | CEO+DX | `PEEK_API_KEY` header |
| 6 | 符号链接检查顺序错误 | Eng | 先检查 `is_symlink()` 再 `resolve()` |
| 7 | files.path 路径遍历 | Eng | 验证解析后路径在 base 目录内 |
| 9 | 模块级 `app = create_app()` | Eng+DX | 改为 lazy factory |
| 29 | EntryCreate/EntryUpdate 未定义 | Eng | 在 models.py 中定义 |

### HIGH (8项)

| # | 问题 | 来源 | 修正方案 |
|---|------|------|----------|
| 4 | DI 使用 app.state | CEO+Eng+DX | 统一依赖注入 |
| 8 | conftest.py 移到 Task 0 | CEO+Eng+DX | 提前创建共享 fixtures |
| 10 | created_at/updated_at 默认值 | Eng | 添加 server_default |
| 11 | Shiki CSS变量+单例 | Design+Eng | 单例 highlighter |
| 12 | FileTree 真实树结构 | Design | 递归目录树 |
| 13 | FOUC-free 主题系统 | Design | index.html 内联脚本 |
| 19 | 条目创建事务包裹 | Eng | 数据库事务 |
| 20 | 静态文件托管 | Eng+DX | `StaticFiles` 挂载 |

### MEDIUM+LOW (5项)

| # | 问题 | 来源 | 修正方案 |
|---|------|------|----------|
| 14 | .gitignore + Makefile | DX+CEO | 开发基础设施 |
| 15 | POST /entries 返回 201 | Eng | HTTP 状态码修正 |
| 16 | URL 行号 hash #L5-L10 | Design+CEO | 前端路由支持 |
| 17 | Dockerfile | CEO+DX | 容器化部署 |
| 18 | expires_in 边界检查 | Eng | 输入验证 |

---

## 仍需人工决策的问题

### 1. 移动端适配 (US-07)
**现状**: 需求规格列为 P0，但实现计划无响应式CSS  
**选项**:
- A: 保留 P0，增加前端工作量
- B: 降级到 P1，先完成桌面版
- C: 基础响应式（目录树下移）但不实现抽屉菜单

**建议**: 选 C，MVP 实现基础适配即可

### 2. MCP Server 优先级
**现状**: 列为 P1 stub，但 CEO 评审建议提升到 P0  
**选项**:
- A: 保持 P1，先完成 REST API
- B: 提升到 P0，作为核心入口

**建议**: 选 A，REST API 稳定后再封装 MCP

### 3. CLI `peek update` 命令
**现状**: 任务 19 计划实现，CEO 评审建议移除  
**选项**:
- A: 保留，Agent 需要更新功能
- B: 移除，删除+重建可满足需求

**建议**: 选 B，从 MVP 中移除

### 4. Mermaid 图表渲染
**现状**: 列为 P1，但增加 bundle 大小  
**选项**:
- A: 保留 P1
- B: 降级到 P2

**建议**: 选 B，非核心功能

---

## 文档更新检查清单

编码开始前，确认以下文档已更新：

- [x] `CLAUDE.md` - 项目指导文档
- [ ] `INDEX.md` - 添加"编码前检查清单"
- [ ] `docs/specs/spec-requirements.md` - 添加MVP边界、用户故事
- [ ] `docs/specs/spec-design.md` - 整合v2修订
- [ ] `docs/plans/impl-plan.md` - 修正任务顺序
- [x] `docs/reviews/pre-impl-audit.md` - 本报告

---

## 编码启动建议

### 阶段 0: 基础设施 (1-2天)
1. Task 0: 测试基础设施 + Makefile + .gitignore
2. 创建 `backend/` 和 `frontend/` 目录结构
3. 验证 `make dev` 和 `make test` 可用

### 阶段 1: 后端核心 (3-4天)
按 v2 计划 Tasks 1-13，注意：
- Task 0 的 conftest.py 已提供 fixtures
- 使用 `app.state` 进行依赖注入
- 实现 allowlist 而非 blacklist

### 阶段 2: 前端核心 (3-4天)
拆分为3个任务：
- Task 16a: 主题系统 + CSS 变量
- Task 16b: CodeViewer + MarkdownViewer（含 Shiki 单例）
- Task 16c: 视图 + 路由 + FileTree

### 阶段 3: 集成与部署 (1-2天)
- Task 17: Dockerfile
- 端到端测试
- 文档更新

---

## 附录：评审来源

| 评审文档 | 评分 | 关键发现 |
|----------|------|----------|
| `2026-04-18-ceo-review.md` | 3.5/10 | 战略定位、竞争风险、文件内容端点缺失 |
| `2026-04-18-design-review.md` | 3.2/10 | Shiki 性能、FileTree 实现、FOUC、移动端缺失 |
| `2026-04-18-eng-review.md` | 4CRIT/11HIGH | 符号链接检查、路径遍历、DI 模式、事务 |
| `2026-04-18-dx-review.md` | 3.5/10 | 开发环境、测试基础设施、CLI 体验、MCP 设计 |

---

*本报告汇总了所有评审发现，应在编码开始前与团队同步。*
