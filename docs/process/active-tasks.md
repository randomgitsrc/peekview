# 活跃任务看板 (Active Tasks Board)

> 只记录当前进行中的任务。已完成的任务归档到 INDEX.md 和 CHANGELOG.md。  
> **规则**：此文件只保留最近5个进行中的任务，更多任务请先在 impl-plan 中规划，再移入此处执行。

---

## 任务状态图例

| 符号 | 状态 | 说明 |
|------|------|------|
| ⬜ | 待开始 | 已规划，等待执行 |
| 🔄 | 进行中 | 正在开发 |
| ⏸️ | 暂停 | 阻塞或等待确认 |
| ✅ | 待验证 | 代码完成，等待测试/发布 |

---

## 当前活跃任务

> 当前版本 v0.1.36 已发布（Backend/Frontend）。MCP Server v0.2.0 已发布到 npm。
> 如需新增功能，请在 `docs/plans/` 中规划新任务。

**无进行中任务**

---

## 快速入口

- **认证规格**：`docs/specs/spec-user-auth.md`
- **远程 CLI 规格**：`docs/specs/spec-remote-cli.md`
- **MCP 多用户认证规格**：`docs/specs/spec-mcp-multi-user.md`
- **Admin 角色计划**：`docs/archived/plans/impl-plan-admin-role.md`（已完成）
- **项目索引**：`INDEX.md`
- **发布记录**：`CHANGELOG.md`
- **开发流程**：`docs/process/workflow.md`
- **调试流程**：`docs/process/debug-workflow.md`

---

## 任务生命周期

```
1. 需求提出 → 2. 编写规格文档 (docs/specs/)
    ↓
3. 技术设计 → 4. 编写实现计划 (docs/plans/)
    ↓
5. 移入 active-tasks.md (本文件)
    ↓
6. 开发实现 → 7. 编写测试 → 8. E2E 验证
    ↓
9. 提交 Git → 10. 更新 CHANGELOG.md
    ↓
11. 标记完成 → 12. 从本文件移除，归档到 INDEX.md
    ↓
13. 发布新版本 (可选)
```

---

## 模板：添加新任务

```markdown
### Task XX: 任务标题

**状态**: 🔄 进行中  
**优先级**: P0/P1/P2  
**影响范围**: 后端/前端/CLI  
**关联需求**: [需求文档链接]

**验收标准**:
- [ ] 标准1
- [ ] 标准2
- [ ] 测试覆盖

**变更文件清单**:
- `backend/peekview/xxx.py` - 功能实现
- `backend/tests/test_xxx.py` - 单元测试

**备注**:
- 风险点：xxx
- 依赖：Task XX

---
```

---

## 历史归档（已完成的任务）

### Task MCP: MCP Server v0.2.0 多用户认证
- **状态**: ✅ 已完成 (MCP v0.2.0)
- **完成日期**: 2026-05-20
- **主要内容**:
  - SSE 传输 + AsyncLocalStorage 多用户 session 隔离
  - pv_ API Key 透传认证（移除 MCP_TOKEN/PEEKVIEW_API_KEY）
  - Tools: create_entry, get_entry, list_entries, delete_entry
  - 中文错误消息、Health check、Docker 支持
  - npm 发布 (@peekview/mcp-server)
  - 三轮 gstack 评审全部通过
- **详情**: 见 CHANGELOG.md [mcp-v0.2.0]

### Task 27-30: FileTree + 资源注入 + Pack 按钮 + SVG 渲染
- **状态**: ✅ 已完成 (v0.1.29)
- **完成日期**: 2026-05-18
- **主要内容**: 
  - FileTree 目录树层级结构（支持嵌套目录）
  - HTML 多文件资源注入（CSS/JS/图片自动注入）
  - Pack 按钮功能实现（ZIP 下载）
  - SVG 图片渲染支持
- **详情**: 见 CHANGELOG.md

### Task 25-26: API Key 管理 + All/Mine 筛选
- **状态**: ✅ 已完成 (v0.1.26)
- **完成日期**: 2026-05-17
- **主要内容**: 用户级 API Key（pv_ 前缀）、API Key 前端管理页、All/Mine 标签页、apikey CLI 命令组
- **详情**: 见 CHANGELOG.md

### Task 23-24: 用户认证 + 条目可见性
- **状态**: ✅ 已完成 (v0.1.25)
- **完成日期**: 2026-05-16
- **主要内容**: JWT 认证、私有条目、所有者操作、登录 UI、Admin 角色
- **详情**: 见 CHANGELOG.md

### Task 22: Remote CLI 模式
- **状态**: ✅ 已完成 (v0.1.25)
- **完成日期**: 2026-05-16
- **主要内容**: HTTP 客户端、透明模式切换、配置文件支持
- **详情**: 见 CHANGELOG.md

### Task 18: 修复前端桌面端显示问题
- **状态**: ✅ 已完成 (v0.1.4)
- **完成日期**: 2026-04-24
- **详情**: 见 CHANGELOG.md

### Task 0-16: 核心 MVP 实现
- **状态**: ✅ 已完成 (v0.1.3)
- **完成日期**: 2026-04-22
- **详情**: 见 INDEX.md

## 技术债记录

### TD-001：语言判断逻辑分散在两处
- **位置**：`entry.ts`（canWrap 里的 language 判断）vs `EntryDetailView.vue`（isHtml / isMarkdown computed）
- **影响**：后端 language 值变更时需改两处
- **建议**：未来重构时把 isHtml / isMarkdown 提升到 store，与 canWrap 统一
- **发现于**：P2 代码评审（p2-code-review.md）
