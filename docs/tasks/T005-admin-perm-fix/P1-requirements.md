---
phase: P1
task_id: T005
task_name: admin-perm-fix
type: requirements
trace_id: T005-P1-20260613
created: 2026-06-13
status: draft
parent: docs/plans/admin-capability-improvements.md
---

# T005 admin-perm-fix — 需求基线

## 1. 需求复述

### BUG-1: 文件下载端点管理员权限缺失

`api/files.py` 的两个文件端点（`GET /{slug}/files/{file_id}` 和 `GET /{slug}/files/{file_id}/content`）在做 entry 可见性检查时，只判断了 `entry.owner_id != current_user_id`，未考虑 `is_admin`。结果：管理员访问他人私有 entry 的文件时返回 404，与管理员应有的"可见所有 entry"权限不一致。

### IMPL-1: 新增 `require_admin` FastAPI 依赖

在 `auth.py` 中新增 `require_admin` FastAPI 依赖函数，用于保护管理员专属端点。该依赖链式调用 `require_auth` 后检查 `user.is_admin`，否则抛出 ForbiddenError。

**范围限定**：本任务仅处理 BUG-1 修复 + IMPL-1 实现。不涉及 FEAT-1~7。

## 2. 需求质疑与隐含需求识别

### 质疑 1: BUG-1 修复是否只需"传递 is_admin"？

**结论：否，应复用 EntryService 的可见性逻辑。**

`api/files.py` 当前完全绕过 `EntryService`，直接在路由层做 DB 查询 + 手写可见性判断。这与 `api/entries.py` 的做法不一致——entries 端点调用 `service.get_entry(slug, current_user_id, is_admin)`，可见性逻辑集中在 service 层。

如果只在 files.py 的手写判断里加 `is_admin` 条件，只是"补丁式"修复，存在两个问题：
1. **可见性逻辑分散**：entries.py 走 service，files.py 走手写，未来再改可见性规则（如增加"协作成员可见"）时容易再遗漏
2. **全局 API Key 绕过**：entries.py 对全局 API Key 有专门处理（`_is_global_api_key_auth` → `get_entry_by_api_key`），files.py 完全没有，这意味着全局 API Key 持有者也无法下载文件（这是另一个 bug，但不在本任务范围）

**决策**：files.py 的可见性检查应复用 `EntryService.get_entry()`，而非在手写判断中补 `is_admin`。这确保可见性逻辑单一真相源，且自动获得 admin 和 global API Key 的正确行为。

### 质疑 2: IMPL-1 的 require_admin 是否应替换现有散落的 is_admin 检查？

**结论：不替换，本任务范围限定为"新增依赖"，不改动现有端点。**

现有端点中 `is_admin` 的使用方式不同于 `require_admin` 的用途：
- `require_admin` 适用于**管理员专属端点**（如未来的 `GET /api/v1/admin/stats`），非管理员直接 403
- 现有端点的 `is_admin` 用于**可见性判断**（如 `get_entry`、`list_entries`），非管理员看到的是过滤后的结果，不是 403

两者语义不同，不应混用。现有 `is_admin` 传入 service 的模式是正确的。统一改造现有端点属于"优化"，不在 BUG 修复范围内。

### 隐含需求清单

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| IH-1 | files.py 应复用 EntryService.get_entry() 做可见性检查，而非手写 | 可见性逻辑单一真相源，防止未来再遗漏（BUG-1 的根因就是逻辑分散） |
| IH-2 | require_admin 依赖需在 auth.py 导出，供未来 admin 端点使用 | IMPL-1 的价值在于统一守卫模式，若不导出则无法被其他模块引用 |
| IH-3 | 需新增 ForbiddenError 的测试覆盖 | require_admin 抛出 ForbiddenError(403)，需确认异常处理链路正确（全局异常处理器是否能正确序列化） |
| IH-4 | files.py 的文件下载端点需支持全局 API Key 访问 | 复用 EntryService.get_entry() 后自动获得，但需测试验证 |
| IH-5 | require_admin 不可用于匿名用户可访问但管理员有额外权限的端点 | 需在 docstring 中明确语义：require_admin = "必须登录 + 必须是管理员"，与 get_current_user + is_admin 传入 service 的模式区分 |

## 3. BDD 验收条件

### BUG-1 修复

**AC-1**: 管理员可下载他人私有 entry 的文件
```
Given 用户 A 创建了一个私有 entry（is_public=False），该 entry 包含文件 F1
And 用户 B 是管理员（is_admin=True），且不是该 entry 的 owner
When 用户 B 请求 GET /api/v1/entries/{slug}/files/{file_id}
Then 返回 200，且响应体为文件 F1 的内容
```

**AC-2**: 管理员可获取他人私有 entry 的文件内容（inline）
```
Given 用户 A 创建了一个私有 entry（is_public=False），该 entry 包含文件 F1
And 用户 B 是管理员（is_admin=True），且不是该 entry 的 owner
When 用户 B 请求 GET /api/v1/entries/{slug}/files/{file_id}/content
Then 返回 200，且响应体为文件 F1 的内容（无 Content-Disposition header）
```

**AC-3**: 非管理员非 owner 仍无法访问私有 entry 的文件
```
Given 用户 A 创建了一个私有 entry（is_public=False），该 entry 包含文件 F1
And 用户 C 是普通用户（is_admin=False），且不是该 entry 的 owner
When 用户 C 请求 GET /api/v1/entries/{slug}/files/{file_id}
Then 返回 404（NOT_FOUND）
```

**AC-4**: 匿名用户仍无法访问私有 entry 的文件
```
Given 用户 A 创建了一个私有 entry（is_public=False），该 entry 包含文件 F1
When 匿名用户（无认证）请求 GET /api/v1/entries/{slug}/files/{file_id}
Then 返回 404（NOT_FOUND）
```

**AC-5**: 全局 API Key 可下载私有 entry 的文件
```
Given 配置了 PEEKVIEW_SERVER__API_KEY="test-key"
And 存在一个私有 entry，包含文件 F1
When 使用 X-API-Key: test-key 请求 GET /api/v1/entries/{slug}/files/{file_id}
Then 返回 200
```

**AC-6**: 公开 entry 的文件访问不受影响
```
Given 存在一个公开 entry（is_public=True），包含文件 F1
When 匿名用户请求 GET /api/v1/entries/{slug}/files/{file_id}
Then 返回 200
```

### IMPL-1 实现

**AC-7**: require_admin 依赖拒绝非管理员
```
Given 用户 D 是普通用户（is_admin=False）
When 请求使用 require_admin 依赖的端点
Then 返回 403（FORBIDDEN）
```

**AC-8**: require_admin 依赖拒绝未认证用户
```
Given 请求未携带任何认证信息
When 请求使用 require_admin 依赖的端点
Then 返回 401（NOT_AUTHENTICATED）
```

**AC-9**: require_admin 依赖允许管理员通过
```
Given 用户 B 是管理员（is_admin=True）
When 请求使用 require_admin 依赖的端点
Then 正常处理请求（非 401/403）
```

**AC-10**: 现有端点行为不受 require_admin 影响
```
Given require_admin 已添加到 auth.py
When 现有端点（entries, files, apikeys, auth）正常调用
Then 行为与修改前完全一致（回归测试通过）
```

## 4. 待确认清单

无。所有隐含需求已自行判断，方向明确：
- files.py 复用 EntryService.get_entry() 而非手写补丁 — 技术决策，不涉及业务方向
- require_admin 不替换现有 is_admin 传入 service 的模式 — 语义不同，范围限定

## 5. 裁剪说明

**任务复杂度**：小（bug 修复 + 小型基础设施新增，无架构变更，无前端影响）

**阶段执行**：

| 阶段 | 是否执行 | 理由 |
|------|---------|------|
| P1 | ✅ | 需求基线，不可跳过 |
| P2 | ❌ 跳过 | 修复方案明确（复用 service + 新增依赖），无设计歧义，无需评审 |
| P3 | ❌ 跳过 | 修复逻辑简单，测试与实现可同步完成 |
| P4 | ✅ | 代码实现 |
| P5 | ✅ | 手动 + 自动验证，确保 admin 权限正确 + 回归无破坏 |
| P6 | ❌ 跳过 | 无文档/配置/前端需同步，一致性检查无额外产出 |
| P7 | ❌ 跳过 | patch 版本发布由主 Agent 按发布流程统一处理，不在本任务范围 |

**裁剪总结**：phases: [P1, P4, P5]

## 6. 范围声明

```
packages:
  - peekview

domains:
  - backend
  - security

ui_affected: none
```

**说明**：
- 仅涉及后端 Python 代码修改（`auth.py`, `api/files.py`），不涉及前端、MCP Server
- 安全域：权限模型修复（admin visibility bypass）
- IMPL-1 的 `require_admin` 虽然本任务内无消费者，但作为基础设施新增供后续 FEAT 使用
