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

### Task 18: 修复前端桌面端显示问题

**状态**: ✅ 已完成  
**完成日期**: 2026-04-24  
**版本**: v0.1.4 (待发布)

**问题描述**:
1. Markdown 标题显示 `#` 符号（anchor permalink）
2. 页面无法滚动（App.vue 设置 `height: 100vh`）
3. 代码高亮样式可能不正确
4. 桌面端详情页缺少 Copy/Download 按钮

**修复内容**:
- [x] MarkdownViewer: 禁用 anchor permalink (`permalink: false`)
- [x] App.vue: 改为 `min-height: 100vh` 允许滚动
- [x] CodeViewer: 添加 Shiki CSS 变量支持
- [x] EntryDetailView: 在 header 添加 Copy/Download 按钮
- [x] 添加测试：VED9 Copy/Download 按钮显示测试

**测试状态**:
- [x] 前端测试：100 passed
- [x] 后端测试：292 passed, 2 skipped
- [x] 构建成功

---

**状态**: ✅ 已完成  
**完成日期**: 2026-04-24  
**版本**: v0.1.4 (待发布)

**问题**: `peekview create` 生成的 URL 包含 `/view/` 前缀，但实际路由不匹配

**修复内容**:
- [x] 修改 `backend/peekview/config.py` - 移除 `/view/` 前缀
- [x] 更新 `backend/tests/test_config.py` - 修复 URL 测试断言
- [x] 更新 `backend/tests/test_entry_service.py` - 修复 URL 测试断言  
- [x] 更新 `backend/tests/test_api.py` - 修复 URL 测试断言
- [x] 更新 `CHANGELOG.md` - 记录修复
- [x] 全量测试通过 (292 passed, 2 skipped)

**变更说明**:
- 前端路由配置为 `/:slug`，后端生成 URL 应该匹配此格式
- 移除 `/view/` 前缀后，URL 从 `http://host/view/slug` 变为 `http://host/slug`

---

---

## 快速入口

- **需求规划**：`docs/specs/spec-requirements.md`
- **技术设计**：`docs/specs/spec-design.md`
- **实现计划**：`docs/plans/impl-plan.md`
- **历史完成**：`INDEX.md`
- **发布记录**：`CHANGELOG.md`
- **开发流程**：`docs/process/workflow.md`

---

## 任务生命周期

```
1. 需求提出 → 2. 更新 spec-requirements.md
    ↓
3. 技术设计 → 4. 更新 spec-design.md
    ↓
5. 任务分解 → 6. 更新 impl-plan.md (新Task编号)
    ↓
7. 移入 active-tasks.md (本文件)
    ↓
8. 开发实现 → 9. 编写测试 → 10. 测试通过
    ↓
11. 提交Git → 12. 更新 CHANGELOG.md
    ↓
13. 标记完成 → 14. 从本文件移除，归档到 INDEX.md
    ↓
15. 发布新版本 (可选)
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
- `docs/xxx.md` - 文档更新

**备注**:
- 风险点：xxx
- 依赖：Task XX

---
```

---

## 历史归档（已完成的任务）

### Task 16: 前端核心功能实现
- **状态**: ✅ 已完成 (v0.1.3)
- **完成日期**: 2026-04-23
- **主要内容**: Vue3 + Vite + TypeScript + Shiki SPA 完整实现
- **详情**: 见 INDEX.md

### Task 15: 前端基础组件
- **状态**: ✅ 已完成 (v0.1.3)
- **完成日期**: 2026-04-23
- **主要内容**: UI组件、Toast系统、API客户端
- **详情**: 见 INDEX.md

### Task 14: 前端项目脚手架
- **状态**: ✅ 已完成 (v0.1.3)
- **完成日期**: 2026-04-22
- **主要内容**: Vue3 + Vite + TypeScript 项目搭建
- **详情**: 见 INDEX.md

### Task 0-12: 后端完整实现
- **状态**: ✅ 已完成 (v0.1.3)
- **完成日期**: 2026-04-22
- **主要内容**: FastAPI + SQLite + CLI 完整后端
- **详情**: 见 INDEX.md
