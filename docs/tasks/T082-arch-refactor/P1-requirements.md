---
phase: P1
task_id: T082-arch-refactor
type: problems
parent: P0-brief.md
trace_id: T082-P1-20260730
status: draft
created: 2026-07-30
agent: analyst
---

# P1 需求基线 — T082 架构重构

## 1. 需求复述

对 PeekView 后端和前端进行 6 项结构性重构，**不改行为、不改 API 契约**（错误格式统一化除外——这本身是修 bug）。目标是将散乱的 DI 模式、重复代码、不一致错误格式、不完整事务、过载 store、god component 整理为可维护的结构，同时确保现有 976 条后端测试 + 全部前端测试全绿。

**六项重构按依赖顺序：**

1. **后端 DI 统一**：将三种 DI 模式（Depends+fallback / 直接 app.state / 路由内 new）统一为 `request.app.state.*` 模式；消除跨 service new 实例（AdminService→EntryService、EntryService→ReadTrackingService/ShareService、auth.py→ApiKeyService、files.py→ShareService），改为通过 app.state 或构造注入获取已有实例
2. **后端错误格式统一**：将 API 路由中残留的 `HTTPException`（`{"detail":"..."}`）替换为 `PeekError`（`{"error":{"code","message","details"}}`），实现前端只需处理一种错误格式
3. **后端重复代码去重**：将 3 处重复函数（`_looks_like_jwt`、`_is_global_api_key_auth`、`_record_read_async`）提取到单一共享位置
4. **后端 create_entry 事务修复**：将 `session.commit()` 移到文件写入成功之后，确保文件写入失败时 entry row 也回滚
5. **前端 store 拆分**：将 `entry.ts`（223 行，list+detail+UI 三种关注点混合）拆分为 `entryList.ts`（列表状态）+ `entryDetail.ts`（详情+文件状态）+ 可能的 UI 状态 composable
6. **前端 EntryDetailView 拆分**：将 1003 行 god component 拆分为主组件（< 300 行）+ 多个子组件（各 < 200 行），保持 zen mode / drawer / responsive 等全部行为不变

## 2. 隐含需求识别

### 2.1 数据：已有数据受影响吗？
- **无数据迁移**。不改数据库 schema，不改表结构，不改索引。事务修复只改代码执行顺序（commit 时机），不改数据模型
- create_entry 事务修复后，文件写入失败时 entry row 不再残留——这对已存在的脏数据（如果有）不产生清理动作，只防止未来产生新脏数据

### 2.2 前端：有显示/交互变化吗？
- **错误格式统一化**有前端可见影响：3 个组件（ExpiresInDialog.vue:66、SecurityTab.vue:71、ProfileTab.vue:74）当前读 `e.response?.data?.detail`，迁移后后端返回 `e.response?.data?.error?.message`。前端必须同步更新这 3 处读取路径
- store 拆分和 component 拆分**无用户可见行为变化**——纯结构重构
- LoginDialog.vue:157/161 读 `e.detail` 是 DOM CustomEvent 的属性，不是 HTTP 错误格式——**不受影响**

### 2.3 多端：MCP / CLI / API 需要同步吗？
- **MCP server 不改**（P0 约束明确）
- **CLI 不改**——CLI 通过 Click 操作，不涉及 API 路由层的 DI/错误格式
- API 契约不变（错误格式统一化是修 bug，使所有端点返回统一格式——这是改善而非破坏）

### 2.4 边界：空值、极值、并发、回滚？
- **create_entry 并发场景**：事务修复后，如果文件写入中途失败，entry row + file records 一起回滚。需确保 `written_paths` 列表中的已写文件被清理（当前代码已有此逻辑 line 296-302，但 entry row 已 commit 无法回滚）
- **DI 统一后的 session 生命周期**：files.py 当前路由内 `new Session(engine)`，改为 service 层后需确保 session 正确关闭，不泄漏
- **跨 service 实例共享**：AdminService→EntryService new 实例时，两者共享 engine/storage/config，new 新实例功能上等价但破坏了单例假设（如果未来 service 有内部状态缓存则出错）。改为通过 app.state 或注入获取同一个实例

### 2.5 兼容：破坏现有行为吗？
- **核心约束：不破坏**。976 条后端测试 + 前端测试是安全网
- 错误格式统一化是**唯一有行为变更的部分**：HTTPException 返回 `{"detail":"..."}` 改为 PeekError 返回 `{"error":{"code","message","details"}}`。这是修 bug（统一格式），不是破坏
- 前端 3 处 `.detail` 读取必须在后端迁移时同步更新——否则用户看到的错误消息会变成 `undefined`

### 2.6 测试覆盖依赖
- 后端 976 条测试必须全绿——这是重构的安全网，任何测试失败 = 行为变更
- 前端单测（vitest）必须全绿
- 前端 E2E（Playwright）用于 P6 验收时验证行为零回归

## 3. BDD 验收条件

### 后端 DI 统一

#### BDD-1: 路由层不再直接实例化 StorageManager
- Given files.py 中的任意路由（download_file / get_file_content / render_html_file / resolve_entry_raw）
- When 检查路由函数体
- Then 不存在 `StorageManager(config=config)` 的直接实例化，文件操作通过 service 层或注入的 storage 实例完成

#### BDD-2: 路由层不再直接实例化 Session
- Given files.py 中的任意路由
- When 检查路由函数体
- Then 不存在 `Session(engine)` 的直接实例化，数据库操作通过 service 层完成

#### BDD-3: 跨 service 调用不再 new 新实例
- Given AdminService 需要操作 entry（cleanup_expired / delete_user）
- When AdminService 调用 EntryService 方法
- Then 使用通过构造注入或 app.state 获取的 EntryService 单例，而非 `EntryService(engine=..., storage=..., config=...)` 新建

#### BDD-4: auth.py 不再直接实例化 ApiKeyService
- Given auth.py 的 get_current_user 函数处理用户级 API key
- When 验证 pv_ 前缀的 API key
- Then 使用 app.state 中的 ApiKeyService 单例，而非 `ApiKeyService(engine=engine)` 新建

#### BDD-5: EntryService 不再直接实例化 ReadTrackingService
- Given EntryService._build_response 需要 read_stats（include_read_stats=True）
- When 调用 get_read_stats
- Then 使用注入的 ReadTrackingService 实例，而非 `ReadTrackingService(engine=self.engine)` 新建

#### BDD-6: EntryService 不再直接实例化 ShareService
- Given EntryService.update_entry 需要 revoke shares（private→public）
- When 调用 revoke_all_for_entry
- Then 使用注入的 ShareService 实例，而非 `ShareService(engine=self.engine, config=self.config)` 新建

### 后端错误格式统一

#### BDD-7: 所有 API 路由业务错误返回统一格式
- Given 任意 API 路由（/api/v1/*）
- When 发生业务错误（如认证失败、未找到、验证错误、权限不足）
- Then 返回 `{"error":{"code":"<ERROR_CODE>","message":"<human readable>","details":null}}` 格式
- And 不存在 `{"detail":"..."}` 格式的响应

#### BDD-8: entries.py list_entries 的 status 参数验证返回 PeekError
- Given 调用 `GET /api/v1/entries?status=invalid`
- When 后端验证 status 参数
- Then 返回 `{"error":{"code":"<ERROR_CODE>","message":"...","details":null}}` 格式，HTTP 状态码 422

#### BDD-9: auth.py 端点错误返回 PeekError
- Given 调用 `PATCH /api/v1/auth/me` 修改用户信息时发生错误
- When 后端处理请求
- Then 返回 `{"error":{"code":"...","message":"...","details":null}}` 格式，而非 `{"detail":"..."}` 格式

#### BDD-10: admin.py 端点错误返回 PeekError
- Given 调用 admin 端点时发生 ValueError
- When 后端处理请求
- Then 返回 `{"error":{"code":"...","message":"...","details":null}}` 格式，而非 `{"detail":"..."}` 格式

### 后端重复代码去重

#### BDD-11: _looks_like_jwt 函数全局唯一
- Given 搜索 `_looks_like_jwt` 函数定义
- When 在整个 backend/ 代码库中全局搜索函数定义
- Then 只存在 1 份定义（当前 3 份：entries.py:102, files.py:140, auth.py:193）

#### BDD-12: _is_global_api_key_auth 函数全局唯一
- Given 搜索 `_is_global_api_key_auth` 函数定义
- When 在整个 backend/ 代码库中全局搜索函数定义
- Then 只存在 1 份定义（当前 2 份：entries.py:108, files.py:145）

#### BDD-13: _record_read_async 函数全局唯一
- Given 搜索 `_record_read_async` 函数定义
- When 在整个 backend/ 代码库中全局搜索函数定义
- Then 只存在 1 份定义（当前 2 份：entries.py:47, files.py:30）

### 后端 create_entry 事务修复

#### BDD-14: 文件写入失败时 entry row 回滚
- Given 创建一个包含文件的 entry
- When 文件写入过程中发生异常（如磁盘空间不足、权限错误）
- Then 数据库中不存在该 entry 的记录（entry row 已回滚）
- And 已成功写入的磁盘文件被清理
- And 不残留无文件的脏 entry

#### BDD-15: 正常创建流程不受影响
- Given 创建一个包含文件的 entry
- When 所有文件写入成功
- Then entry row + file records 全部提交到数据库
- And FTS 内容更新正常执行
- And 返回 CreateEntryResponse 包含正确的 file 信息

### 后端测试零回归

#### BDD-16: 后端全部测试通过
- Given 执行 `make test-quick`
- When 所有测试运行完毕
- Then 976 条测试全部通过（0 失败）

### 前端 store 拆分

#### BDD-17: entry list 和 detail 使用不同的 Pinia store
- Given 前端 entry store 拆分后
- When 查看 stores 目录
- Then 存在分离的 store 文件（如 entryList.ts 和 entryDetail.ts），列表状态（entries/page/perPage/total/ownerFound）和详情状态（currentEntry/activeFile/fileContent）不再共享同一个 store

#### BDD-18: 拆分后的每个 store 行数符合约束
- Given store 拆分完成
- When 统计每个 store 文件行数
- Then 每个 store 文件 < 150 行

#### BDD-19: loadSeq 竞态防护逻辑结构保留
- Given entry list store 拆分后
- When 检查拆分后的 entryList store 文件
- Then loadSeq 序号检查逻辑存在于该 store 中（grep `loadSeq` 在 entryList.ts 中存在）

#### BDD-20: loadSeq 竞态防护行为生效
- Given entry list store 拆分后
- When 快速连续调用 loadEntries 两次（第一次延迟 500ms，第二次延迟 100ms）
- Then 两次调用都完成后，最终显示的是第二次调用的结果（非第一次的过期数据）

#### BDD-21: searchUrl.logic.ts 现有单测全通过
- Given store 拆分后
- When 执行 `make test-frontend`
- Then searchUrl.logic.ts 相关单测（searchUrl.logic.spec.ts 等）全部通过（0 失败）

#### BDD-22: EntryListView 从 URL 恢复参数行为不变
- Given store 拆分后，EntryListView 加载并从 URL 恢复搜索状态
- When URL 中包含 q/page/owner/status/tags 参数
- Then 各参数被正确解析并应用到 store 状态中（每个参数可通过 Playwright 验证：URL 含 `?q=foo` → 搜索框值为 foo）

### 前端 EntryDetailView 拆分

#### BDD-23: 拆分后主组件行数符合约束
- Given EntryDetailView.vue 拆分完成
- When 统计主组件文件行数
- Then 主文件 < 300 行

#### BDD-24: 拆分后子组件行数符合约束
- Given EntryDetailView.vue 拆分出的每个子组件
- When 统计子组件文件行数
- Then 每个子组件文件 < 200 行

#### BDD-25: zen mode 进入行为零回归
- Given EntryDetailView 拆分后
- When 用户按 'f' 键
- Then 进入 zen mode（隐藏 header / sidebar / bottom bar）

#### BDD-26: zen mode 退出行为零回归
- Given EntryDetailView 处于 zen mode
- When 用户按 'f' 或 'Escape' 键
- Then 退出 zen mode，恢复正常显示

#### BDD-27: file tree 自动打开行为零回归
- Given EntryDetailView 拆分后，桌面端，多文件 entry
- When 页面加载完成
- Then file tree 自动打开（如果 isMultiFile）

#### BDD-28: file tree 手动切换行为零回归
- Given EntryDetailView 拆分后，file tree 处于任意状态
- When 用户点击 file tree toggle 按钮
- Then file tree 切换开/关状态

#### BDD-29: TOC 自动打开行为零回归
- Given EntryDetailView 拆分后，桌面端，markdown 文件含标题
- When 页面加载完成
- Then TOC sidebar 自动打开（如果 isMarkdown 且有标题）

#### BDD-30: TOC 手动切换行为零回归
- Given EntryDetailView 拆分后，TOC sidebar 处于任意状态
- When 用户点击 TOC toggle 按钮
- Then TOC sidebar 切换开/关状态

#### BDD-31: share dialog 打开行为零回归
- Given EntryDetailView 拆分后，entry 是 private 且用户是 owner
- When 用户点击 share 按钮
- Then share dialog 打开

#### BDD-32: share link 创建行为零回归
- Given EntryDetailView 拆分后，share dialog 已打开
- When 用户创建 share link
- Then share badge 显示活跃 share 数量

#### BDD-33: delete confirm dialog 显示行为零回归
- Given EntryDetailView 拆分后，用户是 owner
- When 用户通过 overflow menu 选择 delete
- Then confirm dialog 显示

#### BDD-34: delete 确认跳转行为零回归
- Given EntryDetailView 拆分后，confirm dialog 已显示
- When 用户确认删除
- Then entry 被删除并跳转到 /explore

#### BDD-35: mobile 布局行为零回归
- Given EntryDetailView 拆分后
- When 视口宽度 <= 640
- Then 显示 mobile 布局（mobile sticky header / mobile bottom bar / drawer 模式）

#### BDD-36: desktop 布局行为零回归
- Given EntryDetailView 拆分后
- When 视口宽度 > 640
- Then 显示 desktop 布局（desktop header / sidebar 模式）

#### BDD-37: meta-tags-bar 向下滚动隐藏行为零回归
- Given EntryDetailView 拆分后，mobile 端
- When 用户向下滚动内容区域
- Then meta-tags-bar 不可见

#### BDD-38: meta-tags-bar 回顶恢复行为零回归
- Given EntryDetailView 拆分后，mobile 端，meta-tags-bar 已隐藏
- When 用户滚动回到顶部
- Then meta-tags-bar 恢复可见

### 前端错误格式兼容

#### BDD-39: 前端正确读取统一错误格式
- Given 后端错误格式统一化后
- When 3 个组件（ExpiresInDialog / ProfileTab / SecurityTab）中任一发生错误
- Then 错误消息从 `response.data.error.message` 读取且非 undefined

### 前端测试零回归

#### BDD-40: 前端单测全部通过
- Given 执行 `make test-frontend`
- When 所有测试运行完毕
- Then 全部通过（0 失败）

#### BDD-41: 前端类型检查通过
- Given 执行 `make typecheck`
- When vue-tsc 检查完毕
- Then 无类型错误

## 4. 待确认清单

[NO_NEED_CONFIRM]

所有需求在 P0-brief.md 和 dispatch-context 中已明确界定，无业务方向歧义。错误格式统一化是明确的修 bug 方向（P0 约束"错误格式统一化除外——这本身是修 bug"），store/component 拆分有明确的行数约束，事务修复有明确的正确性标准。

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
# P1 需求基线（不可裁）
# P2 方案设计（不可裁——涉及 6 项跨层改动，需完整设计）
# P3 TDD 测试（保留——risk=high，事务修复和错误格式变更需 TDD 红灯保护）
# P4 代码实现（核心阶段）
# P5 技术验证（保留——976 测试 + 前端测试是安全网，必须全绿验证）
# P6 验收（不可裁——BDD 逐条实跑，UI 必须 Playwright 实跑）
# P7 一致性检查（保留——多文件改动，需跨文件交叉核对）
# P8 发布准备（保留——releaser 产出文件，主 Agent gate 后 bump-version）
```

**无裁剪**。理由：

1. risk_level=high（见 §范围声明）——涉及 6 项跨层改动，包含安全相关（DI 统一影响认证链路）、事务修复（数据一致性）、多端影响（错误格式影响前端 3 处）
2. 涉及 schema 间接变更——虽然不改数据库 schema，但改 service 构造签名（注入方式变化），影响所有 service 的实例化方式
3. 机制交叉——DI 统一 + 去重 + 错误格式 + 事务修复 4 项后端改动相互依赖（DI 统一是去重的前置，去重是错误格式统一的前置，事务修复独立但同属 service 层），≥2 个子系统交互

## 6. 范围声明

```yaml
domains:
  - backend    # DI 统一、去重、错误格式、事务修复
  - frontend   # store 拆分、component 拆分、错误格式兼容（3 处 .detail 读取更新）
```

```yaml
packages:
  backend:
    - backend/peekview/api/entries.py       # DI 模式 A → B、HTTPException → PeekError、去重
    - backend/peekview/api/files.py         # DI 模式 C → service 层、去重
    - backend/peekview/api/auth.py          # 去重、HTTPException → PeekError、DI 统一（ApiKeyService）
    - backend/peekview/api/admin.py        # HTTPException → PeekError
    - backend/peekview/main.py              # HTTPException 残留评估（基础设施层可能保留）
    - backend/peekview/services/entry_service.py  # 事务修复、跨 service new → 注入
    - backend/peekview/services/admin_service.py  # 跨 service new → 注入
    - backend/peekview/exceptions.py       # 可能新增 ValidationError 复用（status 验证）
    - backend/peekview/auth.py             # _looks_like_jwt 去重、ApiKeyService DI 统一
    - (新建) 去重函数共享模块  # _looks_like_jwt / _is_global_api_key_auth / _record_read_async 的归宿
  frontend:
    - frontend-v3/src/stores/entry.ts       # 拆分为 entryList.ts + entryDetail.ts
    - frontend-v3/src/stores/entryList.ts   # 新建（列表状态）
    - frontend-v3/src/stores/entryDetail.ts # 新建（详情状态）
    - frontend-v3/src/views/EntryDetailView.vue  # 拆分为多个子组件
    - frontend-v3/src/components/ (多个新子组件)    # 从 EntryDetailView 抽出
    - frontend-v3/src/components/ExpiresInDialog.vue  # .detail → .error.message
    - frontend-v3/src/components/settings/SecurityTab.vue  # .detail → .error.message
    - frontend-v3/src/components/settings/ProfileTab.vue  # .detail → .error.message
```

```yaml
risk_level: high
# 理由：
# 1. DI 统一改动面广（几乎每个 route + 几个 service 构造函数）
# 2. 错误格式变更影响前端 3 处组件的错误处理路径
# 3. create_entry 事务修复影响数据一致性（文件写入失败时的回滚正确性）
# 4. store/component 拆分影响前端状态管理和组件交互（loadSeq 竞态、URL 同步、zen mode 等）
# 5. 4 项后端改动 + 2 项前端改动 = 跨层多子系统交互
```

```yaml
capability_requirements:
  - need: pytest-backend
    why: P5/P6 验证 976 条后端测试全绿
    available:
      - "make test-quick（venv Python，AGENTS.md 声明的标准命令）"
    status: available

  - need: vitest-frontend
    why: P5/P6 验证前端单测全绿
    available:
      - "make test-frontend（vitest，非 watch 模式）"
    status: available

  - need: typecheck-frontend
    why: P5/P6 验证前端类型安全
    available:
      - "make typecheck（vue-tsc --noEmit）"
    status: available

  - need: playwright-browser
    why: P6 验收 EntryDetailView 拆分后行为零回归（zen mode / drawer / responsive 等需 UI 实跑）
    available:
      - "playwright-cdp skill（CDP 连接 Chrome :18800）"
      - "make debug-test（Playwright E2E via debug backend）"
    status: supplementable
    requires_minimal_validation: true
    # P2 architect 需产出 minimal_validation 块，确认 CDP Chrome 可用性
    # 如果 CDP 不可用，降级为 make debug-test（依赖 debug backend :8888）

  - need: lint
    why: P5 代码规范验证（ruff + eslint）
    available:
      - "make lint（ruff，系统 python3）"
    status: available
```

## 7. BDD 反模式自检

- [x] Then 子句不绑定 CSS 类名（BDD-37/38 用"不可见/恢复可见"描述行为效果，未绑定具体类名）
- [x] Then 子句不绑定 HTML 属性名
- [x] Then 子句不含主观形容词（所有验收标准可二值判定：存在/不存在、通过/失败、< N 行 / >= N 行）
- [x] 所有 BDD 可二值判定（PASS = 条件满足 / FAIL = 条件不满足）
- [x] Given/When 不绑定实现细节（描述用户行为或系统状态，不描述"调用哪个函数"）
- [x] 每条 BDD 只有一条 Given-When-Then（多场景已拆为独立编号）
- [x] BDD 编号连续（BDD-1 到 BDD-41）

## 8. 实施顺序约束（P0 约束复述，非方案设计）

P0-brief 已明确顺序约束，此处复述供 P2 设计参考：

1. **后端先改**：DI 统一 → 去重 → 错误格式 → 事务修复
   - DI 统一是去重的前置（统一后才能在共享位置放去重函数）
   - 去重是错误格式统一的前置（去重后 _is_global_api_key_auth 等函数集中，便于审查认证链路）
   - 事务修复独立但同属 service 层，最后改避免与其他改动冲突
2. **前端后改**：store 拆分 → component 拆分
   - store 拆分是 component 拆分的前置（store 结构稳定后才能稳定地引用）
   - 错误格式兼容（3 处 .detail 更新）与后端错误格式统一同步进行
