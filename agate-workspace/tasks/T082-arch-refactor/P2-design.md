---
phase: P2
task_id: T082-arch-refactor
type: design
parent: P1-requirements.md
trace_id: T082-P2-20260730
status: draft
created: 2026-07-30
agent: architect
---

# P2 方案设计 — T082 架构重构

## 声明字段

```yaml
packages:
  - backend    # 独立版本包（pipx 安装），DI/去重/错误格式/事务修复
  - frontend   # 独立部署包（vite 构建），store 拆分/component 拆分/错误格式兼容

domains:
  - backend
  - frontend

ui_affected: false
# 纯重构任务：无用户可见 UI 变化。
# 错误格式统一化是修 bug（后端 HTTPException→PeekError），前端 3 处 .detail→.error.message 同步更新读取路径，无新 UI。
# store 拆分和 component 拆分是纯结构重构，行为零回归。

gate_commands:
  P5: "make test-quick"
  P5_frontend: "make test-frontend"
  P5_typecheck: "make typecheck"
  P5_lint: "make lint"
# ui_affected: false → 不需 P5_e2e
# P6 仍需 Playwright 验证行为零回归（BDD-22~38），P6 命令由主 Agent 按需执行

env_constraints:
  debug_env: "PEEKVIEW_DEBUG_MODE=1 自动隔离到 /tmp/peekview-debug/，captcha 自动禁用"
  isolation_check: "make debug-verify-isolation（依赖 :8080 在线）；不在线时 sqlite3 /tmp/peekview-debug/peekview.db 手动验证"
  prod_not_touched: "[PROD_NOT_TOUCHED] 全程不触碰 :8080 服务和 ~/.peekview/ 生产数据库"

minimal_validation:
  assumption: "无外部系统行为依赖——纯代码逻辑重构"
  method: "不适用"
  result: "not_needed"
  note: "本任务不依赖浏览器行为/安全模型/外部系统行为。DI 模式、错误格式、事务、store/component 拆分均为项目内已有模式的复用或纯逻辑重构，TDD 覆盖即可验证。"
```

## 影响域分析

### 改什么

| # | 改动项 | 涉及文件 | 改动类型 |
|---|--------|----------|----------|
| R1 | DI 统一 | entries.py, files.py, api/auth.py, auth.py, entry_service.py, admin_service.py, main.py | 结构 |
| R2 | 去重 | 新建共享模块, entries.py, files.py, auth.py | 结构 |
| R3 | 错误格式统一 | entries.py, api/auth.py, api/admin.py, exceptions.py | 修 bug |
| R4 | 事务修复 | entry_service.py | 修 bug |
| R5 | store 拆分 | entry.ts → entryList.ts + entryDetail.ts, EntryListView.vue, EntryDetailView.vue, 测试文件 | 结构 |
| R6 | component 拆分 | EntryDetailView.vue → 主组件 + 子组件 | 结构 |
| R7 | 前端错误格式兼容 | ExpiresInDialog.vue, SecurityTab.vue, ProfileTab.vue | 同步 |

### 不改什么

- **不改 API 契约**：所有 endpoint 的 URL、请求体、成功响应格式不变。错误格式统一化是修 bug（使所有端点返回统一格式），HTTP 状态码保持不变
- **不改数据库 schema**：不改表结构、索引、FTS5 配置
- **不改 MCP server**：packages/mcp-server/ 完全不动
- **不改 CLI**：cli.py 不涉及 API 路由层
- **不改 main.py 基础设施层 HTTPException**：main.py:535（metrics disabled 404）、main.py:580（SPA catch-all 404）是基础设施路由（非 /api/v1/* 端点），不返回 `{"detail":"..."}` 给 API 消费者，保留
- **不改 share cookie 逻辑**：entries.py `_check_share_cookie` 和 files.py `_resolve_entry` 中的 share cookie 验证逻辑保持不变
- **不改 _build_sibling_data**：files.py 的 HTML sibling 注入逻辑保持不变
- **不改 loadSeq 竞态防护机制**：仅迁移到新 store，不改逻辑本身

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| DI 统一后 files.py session 生命周期变化 | files.py 当前路由内 `Session(engine)`，改 service 层后需确保 session 正确关闭 | service 层方法内用 `with Session(self.engine)` 上下文管理器，自动关闭 |
| 跨 service 注入改构造函数签名 | EntryService/AdminService 构造函数加参数，main.py 初始化需同步更新 | 构造函数用默认参数 `None` + 内部 fallback，向后兼容 |
| 事务修复后 FTS 更新时机 | 当前 FTS 在 `with Session` 块退出后执行，方案 A 不改变此时机 | FTS 更新内部创建独立 session，不受外层 flush→commit 改动影响 |
| store 拆分后 toggleVisibility/deleteEntry 跨 list+detail | 这两个方法同时操作 list 状态和 detail 状态 | Pinia action 内引用模式：entryList action 内 `useEntryDetailStore()` 获取 detail store 实例，调用 syncVisibility/clearIfSlug（含 slug 匹配检查） |
| component 拆分后 zen mode/resize/scroll 事件协调 | 子组件需要访问主组件的 ref 状态 | zenMode/isMobile 用 provide/inject（Symbol key + Ref/ComputedRef 类型）；drawer 状态留主组件 props+emit；事件监听由主组件在 onMounted/onUnmounted 管理 |

---

## §1 重构方案设计

### R1: 后端 DI 统一

**follows_existing_pattern**: [backend/peekview/api/admin.py, backend/peekview/api/shares.py]

**现状**：三种 DI 模式混用：
- 模式 A（Depends+fallback）：entries.py `_get_service` → `get_entry_service(request.app)` 带 fallback new
- 模式 B（直接 app.state.*）：admin.py, shares.py, read_tracking.py
- 模式 C（路由内手建）：files.py 4 处 `StorageManager(config=config)` + `Session(engine)` + `get_engine(config)`
- 跨 service new：admin_service.py:226,275（EntryService）、entry_service.py:999（ReadTrackingService）、entry_service.py:1022（ShareService）、auth.py:185（ApiKeyService）、files.py:219（ShareService）

**目标模式**：统一为模式 B（`request.app.state.*`），消除所有 `Depends(_get_service)` 和路由内手建。

### 候选方案 A（选定）：统一为 app.state.* + 构造注入

**路由层改动**：
- entries.py：移除 `Depends(_get_service)`，改为 `service = request.app.state.entry_service`（与 admin.py 一致）
- files.py：移除 4 处 `StorageManager(config=config)` + `Session(engine)` + `get_engine(config)`，改为 `service = request.app.state.entry_service`，通过 service 层方法获取文件内容
- api/auth.py：已用 `request.app.state.engine`/`request.app.state.config`，无 DI 改动（HTTPException 改动在 R3）
- auth.py：`get_current_user` 中 `ApiKeyService(engine=engine)` 改为 `request.app.state.apikey_service`

**Service 层改动**（跨 service new → 构造注入）：
- EntryService.__init__ 新增可选参数 `read_tracking_service=None, share_service=None`，内部 fallback 为 `ReadTrackingService(engine=self.engine)` / `ShareService(engine=self.engine, config=self.config)`（向后兼容现有测试）
- AdminService.__init__ 新增可选参数 `entry_service=None`，内部 fallback 为 `EntryService(engine=self.engine, storage=self.storage, config=self.config)`
- main.py 初始化时传入已有实例：
  ```python
  entry_service = EntryService(engine, storage, config,
      read_tracking_service=read_tracking_service,
      share_service=share_service)
  admin_service = AdminService(engine, storage, config,
      entry_service=entry_service)
  ```
- files.py `ShareService(engine=engine, config=config)` 改为 `request.app.state.share_service`
- files.py 需新增 service 层方法暴露文件读取能力（见下方 files.py service 层扩展）

**files.py service 层扩展**：
files.py 4 个路由当前直接操作 `Session(engine)` + `storage.read_file()`。改为通过 EntryService 暴露的方法：
- `EntryService.get_file_content(entry_id, file_id) -> tuple[File, bytes]`：查询 file record + 读取磁盘内容
- `EntryService.get_file_record(entry_id, file_id) -> File`：仅查询 file record
- 这些方法内部用 `with Session(self.engine)` + `self.storage.read_file()`

**files.py `_resolve_entry` 改动**：
当前 `_resolve_entry` 内部 `get_engine(config)` + `Session(engine)`。改为用 `request.app.state.engine`（已在 app.state 中）。ShareService new 改为 `request.app.state.share_service`。

**`get_entry_service` 函数处理**：
entries.py:33 的 `_get_service`（Depends 包装）和 files.py:169 的 `_get_service` 调用 `get_entry_service(request.app)`（entry_service.py:51-74）。R1 移除 `Depends(_get_service)` 后，`get_entry_service` 不再被调用。**删除 `get_entry_service` 函数**（entry_service.py:51-74）——它是死代码，无其他调用点（grep 确认仅被 entries.py:35 和 files.py:169 的 `_get_service` 调用，两者均移除）。

**权衡**：
- 优点：与 admin.py/shares.py 完全一致的模式，消除三种模式混用的认知负担；构造注入使跨 service 调用使用同一实例（单例）；可选参数+fallback 保证现有测试不破
- 风险：files.py 路由需改为通过 service 层获取文件——需新增 service 方法，改动量较大
- 工作量：中等（路由层简单替换 + service 层新增 2-3 个方法 + 构造函数加参数）

**选择理由**：模式 B 已在 admin.py/shares.py/read_tracking.py 中验证可行，是项目已确立的 DI 模式。构造注入+fallback 兼顾了"用 app.state 单例"和"测试中独立 new"两种场景。files.py 走 service 层是 P0-brief 已预见的风险点（"files.py 走 service 层需要 EntryService 暴露文件读取方法"），方案已覆盖。

### 候选方案 B（否决）：保留 Depends 但统一 fallback 逻辑

将所有路由统一为 `Depends(_get_service)` 模式，但 `_get_service` 统一从 `app.state` 获取（移除 fallback new 逻辑）。

**否决理由**：
- `Depends` 包装一层无意义的间接——`request.app.state.entry_service` 更直接、更可读
- admin.py/shares.py 已用直接 `app.state.*` 模式，不应倒退回 Depends
- files.py 的 `StorageManager` + `Session` 问题不是 Depends 能解决的——需要走 service 层

---

### R2: 后端重复代码去重

**follows_existing_pattern**: [backend/peekview/services/file_service.py（已有工具函数模块先例）]

**现状**：3 处重复函数：
- `_looks_like_jwt`：entries.py:102, files.py:140, auth.py:193（3 份，逻辑完全相同）
- `_is_global_api_key_auth`：entries.py:108, files.py:145（2 份，逻辑完全相同）
- `_record_read_async`：entries.py:47, files.py:30（2 份，逻辑完全相同）

### 候选方案 A（选定）：新建 backend/peekview/api/_shared.py

新建 `backend/peekview/api/_shared.py`，放入 3 个去重函数：
```python
# backend/peekview/api/_shared.py
async def record_read_async(app_state, entry_id, entry_owner_id, action, channel, reader_id, reader_ip): ...
def looks_like_jwt(token: str) -> bool: ...
def is_global_api_key_auth(request: Request, current_user: User | None) -> bool: ...
```

entries.py/files.py/auth.py 移除本地定义，改为 `from peekview.api._shared import ...`。

**共享位置选择理由**：
- `_shared.py` 放在 `api/` 目录下（而非 `services/`），因为这些函数是 API 路由层的辅助函数（操作 request/headers），不是业务逻辑
- 文件名用 `_shared.py`（下划线前缀表示内部模块，不被 router 自动发现）
- `_record_read_async` 是 async 函数（调用 `app_state.read_tracking_service.record_read`），与 API 路由层紧密耦合
- `_is_global_api_key_auth` 依赖 `request.headers` + `API_KEY_PREFIX`，是 API 层认证辅助
- `_looks_like_jwt` 是纯函数但仅被 API 层使用

**权衡**：
- 优点：单一定义点，消除 3×2+1=7 份重复副本；位于 api/ 目录符合职责归属
- 风险：新建文件可能影响 import 路径——但 `_shared.py` 不注册 router，无副作用
- 工作量：小（新建 1 文件 + 3 个文件改 import）

### 候选方案 B（否决）：放入 auth.py 作为公共函数

将 `_looks_like_jwt` 保留在 auth.py（已有 1 份），entries.py/files.py 从 auth.py import。`_is_global_api_key_auth` 和 `_record_read_async` 也放 auth.py。

**否决理由**：
- auth.py 是认证服务模块（JWT/bcrypt/API key 验证），`_record_read_async` 是阅读追踪——职责不匹配
- `_is_global_api_key_auth` 虽然与认证相关，但它检查的是"是否全局 API key 认证"这一请求级状态，不是认证逻辑本身
- 放入 auth.py 会使 auth.py 变成杂烩模块

---

### R3: 后端错误格式统一

**follows_existing_pattern**: [backend/peekview/exceptions.py（已有完整 PeekError 层级）]

**现状**：API 路由中残留 7 处 HTTPException：
- entries.py:205 → `HTTPException(status_code=422, detail="Invalid status value...")` （status 参数验证）
- api/auth.py:208 → `HTTPException(status_code=404, detail="User not found")` （update_profile）
- api/auth.py:240 → `HTTPException(status_code=409, detail={"message":"...","code":"last_admin",...})` （delete_self，last admin 检查）
- api/auth.py:261 → `HTTPException(status_code=400, detail="Old password is incorrect")` （change_password）
- api/auth.py:266 → `HTTPException(status_code=404, detail="User not found")` （change_password）
- api/admin.py:57 → `HTTPException(status_code=400, detail=str(e))` （delete_user ValueError）
- main.py:535,580 → 基础设施层（保留）

**目标**：全部替换为 PeekError 子类，通过已有的 `peek_error_handler`（main.py:482）返回统一格式 `{"error":{"code","message","details"}}`。

### 候选方案 A（选定）：复用/新增 PeekError 子类

| HTTPException 位置 | 替换为 | HTTP 状态码 | error_code |
|---------------------|--------|-------------|------------|
| entries.py:205 (status 验证) | 新增 `ParameterValidationError(PeekError)` | 422 | PARAMETER_VALIDATION_ERROR |
| api/auth.py:208 (user not found) | `NotFoundError`（已有） | 404 | NOT_FOUND |
| api/auth.py:240 (last admin) | 新增 `LastAdminError(PeekError)` | 409 | LAST_ADMIN |
| api/auth.py:261 (old password) | 新增 `InvalidPasswordError(PeekError)` | 400 | INVALID_PASSWORD |
| api/auth.py:266 (user not found) | `NotFoundError`（已有） | 404 | NOT_FOUND |
| api/admin.py:57 (ValueError) | `ValidationError`（已有） | 400 | VALIDATION_ERROR |

**entries.py status 验证特殊处理**：
entries.py:205 当前用 `HTTPException(status_code=422, detail="Invalid status value...")`。需要替换为 PeekError 子类。

ValidationError（status_code=400）**不动**——它被 raise 9 处（share_service.py:55,58,68,79 / entry_service.py:173,175,857 / apikey_service.py:59），测试中有 10+ 处 `assert status_code == 400` 断言这些路径。改 ValidationError.status_code 会导致这些路径行为变更，违反"不改 API 契约"约束。

**新增 `ParameterValidationError(PeekError)` with status_code=422**，仅用于 entries.py:205 的 status 参数验证。零回归风险——不影响任何已有 ValidationError 使用路径。

```python
class ParameterValidationError(PeekError):
    status_code = 422
    error_code = "PARAMETER_VALIDATION_ERROR"
```

422 是更正确的参数验证状态码（与 FastAPI 自带 Pydantic 验证一致），但仅应用于此新替换点，不追溯已有 ValidationError 调用点。

**api/auth.py:240 last_admin 特殊处理**：
当前返回 `detail={"message":"...","code":"last_admin","confirm_required":True}`（dict 作为 detail）。替换为 `LastAdminError`，需在 `details` 字段中携带 `confirm_required: True`。

需扩展 PeekError 基类支持 `details` 字段：
```python
class PeekError(Exception):
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str | None = None, details: Any = None):
        self.message = message or "An unexpected error occurred"
        self.details = details
        super().__init__(self.message)
```
并更新 `peek_error_handler`（main.py:482）：
```python
content={"error":{"code":exc.error_code, "message":str(exc), "details":getattr(exc,'details',None)}}
```

**技术债 TD-T082-001**：`PayloadTooLargeError`（exceptions.py:78）携带 `limit_type`/`max_bytes`/`actual_bytes`，`SchemaMismatchError`（exceptions.py:200）携带 `missing_columns`——这些额外字段当前通过独立属性存储，不在 `self.details` 中。更新 handler 后这些信息仍不会被输出。本次重构不迁移这些字段到 details（避免改动面扩大），记录为技术债，后续单独处理。

**PeekError details 字段已有子类的兼容性**：扩展基类加 `details` 参数后，`PayloadTooLargeError.__init__` 和 `SchemaMismatchError.__init__` 需调用 `super().__init__(message)`——基类 `__init__` 签名变为 `(message, details=None)`，这两个子类不传 details，默认 None，向后兼容。

**权衡**：
- 优点：所有 API 端点返回统一格式，前端只需处理一种错误格式；复用已有 PeekError 层级
- 风险：新增 ParameterValidationError(422) 与 ValidationError(400) 并存——语义上 422 用于请求参数验证（query/path param），400 用于业务逻辑验证（service 层），两者职责清晰不冲突；扩展 PeekError 基类加 details 字段需更新 handler
- 工作量：小（exceptions.py 加 3 个子类 + 基类加 details + handler 更新 + 6 处 HTTPException 替换）

### 候选方案 B（否决）：新增统一中间件捕获 HTTPException

添加 `@app.exception_handler(HTTPException)` 将所有 HTTPException 转为 `{"error":{"code","message","details"}}` 格式。

**否决理由**：
- 这会让 HTTPException 静默存在——不鼓励用 HTTPException，但中间件让它"自动正确"反而降低了迁移动力
- 不同的 HTTPException 需要不同的 error_code（422→VALIDATION_ERROR, 404→NOT_FOUND, 409→CONFLICT），中间件无法从 status_code 反推正确的 error_code
- api/auth.py:240 的 `detail` 是 dict（含 `code:"last_admin"`），中间件需特殊处理才能提取
- P1 BDD-7 要求"不存在 `{"detail":"..."}` 格式的响应"——显式替换比隐式中间件更可审计

---

### R4: 后端 create_entry 事务修复

**现状**（entry_service.py:226-302）：
```python
with Session(self.engine) as session:
    session.add(entry)
    session.commit()          # line 229: entry row 先 commit
    session.refresh(entry)
    # ... write files to disk + create File records ...
    session.commit()          # line 277: file records commit
    # except: rollback + delete files  # line 296-302: 但 entry 已 commit
```

问题：entry row 在 line 229 已 commit，文件写入失败时 `session.rollback()` 只回滚 file records，entry row 残留为无文件的脏数据。

### 候选方案 A（选定）：commit 时机后移

将 line 229 的 `session.commit()` 移到文件写入成功之后（与 line 277 的 commit 合并为一次）。

```python
with Session(self.engine) as session:
    session.add(entry)
    session.flush()           # flush 获取 entry.id，但不 commit
    session.refresh(entry)
    entry_id = entry.id
    # ... write files to disk + create File records ...
    try:
        for fi in files_info:
            # write file to disk
            disk_path = self.storage.write_file(...)
            written_paths.append(disk_path)
            # create File record
            session.add(file_record)
        session.commit()       # 一次性 commit entry + file records
        # refresh to get file IDs
        for fr in file_records:
            session.refresh(fr)
    except Exception:
        for wp in written_paths:
            with contextlib.suppress(OSError):
                wp.unlink()
        session.rollback()     # 回滚 entry + file records（全部）
        raise
```

**关键改动**：
- `session.commit()` → `session.flush()`：flush 将 entry 写入数据库事务（获取自增 ID），但不提交事务。如果后续 rollback，entry 也会回滚
- 文件写入失败的 `session.rollback()` 现在能回滚 entry row（因为未 commit）
- `written_paths` 清理逻辑不变——已写入磁盘的文件仍需手动删除（磁盘操作不在数据库事务中）

**FTS 更新时机**：`_update_fts_content`（entry_service.py:85）内部创建自己的 `with Session(self.engine) as session`，不依赖外层 session。它在 `with Session` 块退出后、IntegrityError 处理之后执行。方案 A 不改变此时机——FTS 更新仍在 `with Session` 块退出后执行，不受 flush→commit 改动影响。

**flush vs commit 行为差异**：
- `flush()`：将 pending 对象写入数据库事务（SQL INSERT），可获取自增 ID，但事务未提交。`rollback()` 可撤销
- `commit()`：提交事务（持久化），`rollback()` 无法撤销已 commit 的内容
- `refresh()` 在 flush 后可用——从数据库读取 flush 后的状态

**权衡**：
- 优点：最小改动——仅将 `commit()` 改为 `flush()`，逻辑清晰；文件写入失败时 entry row 自动回滚
- 风险：flush 后 session 仍持有事务锁——如果文件写入耗时长（大文件），数据库事务持有时间变长。但 create_entry 的文件写入通常很快（<1s），且 SQLite 单写入者无并发问题
- 工作量：小（改 1 行 + 调整异常处理块位置）

### 候选方案 B（否决）：SAVEPOINT + rollback to savepoint

在 entry commit 后创建 SAVEPOINT，文件写入失败时 rollback to savepoint（而非 full rollback）。

```python
session.add(entry)
session.commit()
session.begin_nested()  # SAVEPOINT
# ... write files ...
session.commit()  # release savepoint
# except: session.rollback()  # rollback to savepoint, entry survives
```

**否决理由**：
- SAVEPOINT 回滚后 entry row 仍残留——这**不满足** BDD-14"entry row 已回滚"的要求
- SAVEPOINT 的语义是"部分回滚"——entry 已 commit 不在 savepoint 保护范围内
- 方案 A 的 flush+单次 commit 更简单且完全满足 BDD-14

---

### R5: 前端 store 拆分

**现状**：entry.ts（223 行）混合三种关注点：
- list 状态：entries, page, perPage, total, ownerFound, loadEntries, loadSeq
- detail 状态：currentEntry, activeFile, fileContent, loadEntry, selectFile, clearEntry, isMultiFile, canWrap, canCopy, canDownload, canPack
- UI 状态：wrapEnabled, loading, error, toggleWrap
- 跨域方法：toggleVisibility（同时操作 list + detail）, deleteEntry（同时操作 list + detail）

### 候选方案 A（选定）：2-store 拆分 + UI 状态归入 detail store

拆分为：
- `entryList.ts`（列表状态）：entries, page, perPage, total, ownerFound, loading, error, loadEntries, loadSeq, deleteEntry（list 侧）, toggleVisibility（list 侧）
- `entryDetail.ts`（详情+UI 状态）：currentEntry, activeFile, fileContent, wrapEnabled, loading, error, loadEntry, selectFile, clearEntry, toggleWrap, isMultiFile, canWrap, canCopy, canDownload, canPack, deleteEntry（detail 侧）, toggleVisibility（detail 侧）

**跨域方法处理**（toggleVisibility / deleteEntry）：
这两个方法同时操作 list 和 detail 状态。采用 **Pinia action 内引用** 模式——在 `entryList` store 的 action 内部调用 `useEntryDetailStore()` 获取 detail store 实例，调用其同步方法。Pinia 的 store 间引用模式允许在 action 内安全调用其他 store。

- `toggleVisibility`：保留在 entryList store（主要操作 list 中的 entry），action 内部获取 detail store 并调用 `syncVisibility(slug, isPublic)` 同步 detail 状态
- `deleteEntry`：保留在 entryList store（从列表中移除），action 内部获取 detail store 并调用 `clearIfSlug(slug)` 清理 detail 状态

**代码模式**：
```typescript
// entryList.ts
import { useEntryDetailStore } from './entryDetail'

export const useEntryListStore = defineStore('entryList', () => {
  // ... list state ...

  async function toggleVisibility(entry: Entry): Promise<boolean> {
    const originalPublic = entry.isPublic
    const index = entries.value.findIndex(e => e.id === entry.id)
    const newPublic = !originalPublic

    // 乐观更新 list 状态
    entry.isPublic = newPublic
    if (index >= 0) {
      entries.value[index] = { ...entries.value[index], isPublic: newPublic }
    }

    // 同步 detail 状态（如果当前查看的是同一 entry）
    const detailStore = useEntryDetailStore()
    detailStore.syncVisibility(entry.slug, newPublic)

    try {
      const updated = await api.toggleEntryVisibility(entry.slug, newPublic)
      // ... toast ...
      return true
    } catch {
      // 回滚 list 状态
      entry.isPublic = originalPublic
      if (index >= 0) {
        entries.value[index] = { ...entries.value[index], isPublic: originalPublic }
      }
      // 回滚 detail 状态
      detailStore.syncVisibility(entry.slug, originalPublic)
      return false
    }
  }

  async function deleteEntry(slug: string): Promise<boolean> {
    try {
      await api.deleteEntry(slug)
      entries.value = entries.value.filter(e => e.slug !== slug)
      const detailStore = useEntryDetailStore()
      detailStore.clearIfSlug(slug)
      return true
    } catch {
      return false
    }
  }
})
```

```typescript
// entryDetail.ts
export const useEntryDetailStore = defineStore('entryDetail', () => {
  // ... detail state ...

  function syncVisibility(slug: string, isPublic: boolean): void {
    if (currentEntry.value?.slug === slug) {
      currentEntry.value = { ...currentEntry.value, isPublic }
    }
  }

  function clearIfSlug(slug: string): void {
    if (currentEntry.value?.slug === slug) {
      clearEntry()
    }
  }
})
```

**syncVisibility 的 slug 检查**：toggleVisibility 被 EntryListView 和 EntryDetailView 同时调用。EntryListView 调用时 detail store 可能无 currentEntry（或 currentEntry 是不同 entry）。syncVisibility 内部检查 `currentEntry.value?.slug === slug`，不匹配时不做任何操作——安全处理 detail store 无 currentEntry 的情况。

**view 层调用方式不变**：EntryListView 和 EntryDetailView 仍调 `entryListStore.toggleVisibility(entry)` / `entryListStore.deleteEntry(slug)`，无需 view 层手动协调两个 store。跨 store 协调完全封装在 entryList store 的 action 内。

**loading/error 分离**：
list 和 detail 各自维护独立的 loading/error——当前共享导致切换页面时互相干扰（如 list 加载中跳转 detail，detail 的 loading 被 list 覆盖）。

**storeToRefs 拆分方式**：
当前 EntryDetailView.vue:387 `const { currentEntry, activeFile } = storeToRefs(entryStore)` 从单一 store 取 refs。拆分后需从两个 store 分别取 refs：
```typescript
const entryListStore = useEntryListStore()
const entryDetailStore = useEntryDetailStore()
const { currentEntry, activeFile, fileContent, wrapEnabled, loading, error } = storeToRefs(entryDetailStore)
// 如需 list 状态（如 toggleVisibility 调用），直接用 entryListStore.xxx()
```
EntryListView.vue 同理改为 `const { entries, page, perPage, total, ownerFound, loading, error } = storeToRefs(useEntryListStore())`。

**loadSeq 保留在 entryList store**：BDD-19/20 要求 loadSeq 竞态防护逻辑保留。loadSeq 是模块级变量（entry.ts:7），拆分后保留在 entryList.ts 模块级。

**searchUrl.logic.ts 影响**：
searchUrl.logic.ts 是纯函数（不直接引用 store），EntryListView.vue 调用 `useEntryStore()` → 改为 `useEntryListStore()`。parseRestoreQuery/mergeQuery 不变。

**测试文件迁移计划**：
当前 `entry.spec.ts` 测试 `useEntryStore` 的所有方法。拆分后迁移为两个测试文件：
- `entryList.spec.ts`：测试 `loadEntries`、`toggleVisibility`（list 侧乐观更新+回滚）、`deleteEntry`（list 侧移除）、loadSeq 竞态防护。toggleVisibility 测试需 mock `useEntryDetailStore` 的 `syncVisibility`（用 `vi.mock('@/stores/entryDetail')`）
- `entryDetail.spec.ts`：测试 `loadEntry`、`selectFile`、`syncVisibility`（slug 匹配检查）、`clearIfSlug`
- `entry-store-auth.spec.ts` 和 `t031-entry-store.spec.ts`：将 `useEntryStore` import 改为 `useEntryListStore` 或 `useEntryDetailStore`（按测试内容归属）
- `t031-entry-detail-view.spec.ts`：mock 路径从 `@/stores/entry` 改为 `@/stores/entryList` + `@/stores/entryDetail`（`vi.mock` 两个模块）

**行数预估**：
- entryList.ts：~100 行（state ~15 + loadEntries ~25 + deleteEntry ~10 + toggleVisibility ~30 + loadSeq + return ~20）
- entryDetail.ts：~130 行（state ~10 + getters ~30 + loadEntry ~35 + selectFile ~15 + clearEntry ~5 + toggleWrap ~3 + syncVisibility ~10 + clearIfSlug ~5 + return ~20）

**权衡**：
- 优点：list 和 detail 状态隔离，消除互相干扰；loading/error 独立；满足 < 150 行约束
- 风险：toggleVisibility/deleteEntry 跨 store 协调通过 Pinia action 内引用实现——entryList action 内 `useEntryDetailStore()` 获取 detail store 实例并调用 syncVisibility/clearIfSlug。view 层无需感知跨 store 协调
- 工作量：中等（新建 2 文件 + 改 2 view + 改测试文件）

### 候选方案 B（否决）：3-store 拆分（list + detail + UI composable）

将 UI 状态（wrapEnabled, loading, error）提取为 `useEntryUI()` composable。

**否决理由**：
- loading/error 是 list 和 detail 各自的状态（不是共享 UI 状态）——拆 3 个反而需要 composable 内部区分 list/detail
- wrapEnabled 仅在 detail 场景使用，归入 detail store 更自然
- 3-store 拆分增加间接层，不满足 YAGNI——2-store 已满足 < 150 行约束
- composable 与 store 混用增加认知负担

---

### R6: 前端 EntryDetailView 拆分

**现状**：EntryDetailView.vue 1003 行（335 模板 + 473 脚本 + 195 样式），管理 20+ ref、15+ computed、15+ 函数、4 watcher。

职责分组：
1. **布局/响应式**：isMobile/isDesktop/viewportWidth/handleResize/metaTagsHidden/scrollContainer
2. **Zen mode**：zenMode/zenAriaText/handleZenKeydown/updateZenAria
3. **文件树/TOC**：isFileTreeOpen/isTocOpen/showFileDrawer/showTocDrawer/selectFileAndCloseDrawer/selectTocAndCloseDrawer
4. **Share**：shareDialogOpen/shareBtnRef/shareErrorState/activeShareCount/isShareAccess/showShareButton/isShareExpired
5. **Delete/Visibility/ExpiresIn**：showConfirmDelete/confirmDeleteEntry/handleDelete/showExpiresInDialog/handleExpiresInUpdated/handleToggleVisibility
6. **文件操作**：copyContent/downloadFile/downloadPack/siblingFileIds/extractHeadings/scrollToHeading/tocHeadings
7. **Login**：showLogin
8. **内容渲染**：isMarkdown/isHtml/isImage/isBinary/pathMap/handleNavigateFile
9. **Overflow menu**：overflowItems
10. **元数据**：entryTitle/relativeTime/fullTime/isExpiredButActive

### 候选方案 A（选定）：按职责拆分为 5 个子组件 + 2 个 composable

**子组件**（各 < 200 行）：

| 子组件 | 职责 | 从主组件抽取的内容 |
|--------|------|---------------------|
| `EntryDetailHeader.vue` | desktop header + meta-row + mobile sticky header + mobile meta-tags-bar | 模板:1-124 + 232-251；脚本: entryTitle/relativeTime/fullTime/isExpiredButActive/metaTagsHidden/scrollContainer |
| `EntryDetailBanners.vue` | expired warning banner + archived banner | 模板:126-136；脚本: isExpiredButActive/showExpiresInDialog |
| `EntryDetailContent.vue` | file-sidebar + content-area + toc-sidebar + mobile drawers | 模板:138-307；脚本: isFileTreeOpen/isTocOpen/showFileDrawer/showTocDrawer/selectFileAndCloseDrawer/selectTocAndCloseDrawer/scrollToHeading/tocHeadings/extractHeadings/siblingFileIds/isMarkdown/isHtml/isImage/isBinary/pathMap/handleNavigateFile |
| `EntryDetailMobileBar.vue` | mobile bottom bar | 模板:253-278；脚本: copyContent（部分） |
| `EntryDetailDialogs.vue` | confirm delete + expires-in + login dialogs + share watermark | 模板:309-334；脚本: showConfirmDelete/confirmDeleteEntry/handleDelete/showExpiresInDialog/handleExpiresInUpdated/showLogin/isShareAccess |

**Composable**（从脚本中抽取逻辑）：

| Composable | 职责 | 抽取的 ref/函数 |
|------------|------|-----------------|
| `useZenMode.ts` | zen mode 状态管理 + 键盘快捷键 | zenMode/zenAriaText/handleZenKeydown/updateZenAria |
| `useResponsiveLayout.ts` | 响应式布局 + scroll hide | viewportWidth/handleResize/isMobile/isDesktop/metaTagsHidden/scrollContainer/tagsScrollHandler |

**主组件 EntryDetailView.vue 保留**：
- props（slug）、router/route、store 初始化
- onMounted/onUnmounted 生命周期（调用 composable 的 setup/teardown）
- watch（slug 变化、showShareButton、currentEntry）
- loadEntry 调用
- overflowItems computed（依赖多个状态，留在主组件协调）
- share 相关状态（shareDialogOpen/shareBtnRef/shareErrorState）——与 ShareDialog 组件直接交互
- delete/visibility 操作（handleDelete/handleToggleVisibility）——协调多个子组件

**主组件行数预估**：
- 模板：~50 行（引用 5 个子组件 + ShareDialog + 状态判断）
- 脚本：~120 行（props/stores/composable setup/watch/overflowItems/share/delete/visibility）
- 样式：~100 行（主容器样式，子组件样式随子组件迁移）
- 总计：~270 行（< 300 ✓）

**子组件行数预估**：
- EntryDetailHeader: ~150 行（模板 ~100 + 脚本 ~50）
- EntryDetailBanners: ~50 行
- EntryDetailContent: ~180 行（模板 ~120 + 脚本 ~60）
- EntryDetailMobileBar: ~60 行
- EntryDetailDialogs: ~80 行

**数据传递方式**：
- props 向下传递：`currentEntry`, `activeFile`, `isMobile` 等（见下方完整契约表）
- emit 向上通知：`@toggle-wrap`, `@select-file`, `@delete` 等（见下方完整契约表）
- provide/inject：zenMode 和 isMobile 通过 provide 注入（见下方定义）
- OverflowMenu 的 `overflowItems` 留在主组件 computed，作为 prop 传入 Header 和 MobileBar

**provide/inject 定义**：
```typescript
// keys.ts
import type { InjectionKey, Ref, ComputedRef } from 'vue'
import { inject } from 'vue'

export const ZenModeKey: InjectionKey<Ref<boolean>> = Symbol('zenMode')
export const IsMobileKey: InjectionKey<ComputedRef<boolean>> = Symbol('isMobile')
export const ZenAriaTextKey: InjectionKey<Ref<string>> = Symbol('zenAriaText')

// 主组件 provide
provide(ZenModeKey, zenMode)              // ref<boolean>
provide(IsMobileKey, isMobile)            // ComputedRef<boolean>
provide(ZenAriaTextKey, zenAriaText)       // ref<string>

// 子组件 inject（Header 和 MobileBar 用 v-show="!zenMode"）
const zenMode = inject(ZenModeKey)!
const isMobile = inject(IsMobileKey)!
```
provide 的值是 `Ref<boolean>` / `ComputedRef<boolean>`（保持响应性）。inject 的子组件：EntryDetailHeader（v-show="!zenMode"）、EntryDetailMobileBar（v-show="!zenMode"）、EntryDetailContent（isMobile 用于 desktop/mobile 分支）。aria-live `<span>` 留在主组件模板中（渲染 `zenAriaText`，主组件直接从 useZenMode 获取）。

**drawer 状态所有权**：
`showFileDrawer`/`showTocDrawer` 是 mobile 专用 drawer 开关，被 EntryDetailContent（drawer 渲染）和 EntryDetailMobileBar（drawer 触发按钮）共享。**留在主组件，通过 props 下传 + emit 上报**：
- 主组件持有 `showFileDrawer`/`showTocDrawer` ref
- EntryDetailContent 接收 `showFileDrawer`/`showTocDrawer` 作为 props，渲染 drawer overlay + drawer 内容
- EntryDetailMobileBar emit `@toggle-file-drawer` / `@toggle-toc-drawer`，主组件接收后切换 ref
- EntryDetailContent emit `@close-file-drawer` / `@close-toc-drawer`（点击 overlay 或选择文件/heading 后关闭）

**子组件 props/emit 契约表**：

```typescript
// ============ EntryDetailHeader.vue ============
props: {
  entryTitle: string
  relativeTime: string
  fullTime: string
  isExpiredButActive: boolean
  metaTagsHidden: boolean
  isFileTreeOpen: boolean
  isTocOpen: boolean
  isMarkdown: boolean
  tocHeadings: TocHeading[]        // for TOC toggle button visibility
  isMultiFile: boolean
  canCopy: boolean
  showShareButton: boolean
  shareDialogOpen: boolean
  activeShareCount: number
  overflowItems: OverflowMenuItem[]
  authState: string                 // 'anonymous' | 'authenticated' | ...
  currentEntry: Entry | null       // for username link, status tag, tags
}
emits: {
  'toggle-file-tree': []                                   // desktop file tree toggle
  'toggle-toc': []                                         // desktop TOC toggle
  'copy-content': []
  'toggle-share-dialog': [value: boolean]
  'open-login': []
}

// ============ EntryDetailBanners.vue ============
props: {
  isExpiredButActive: boolean
  isArchived: boolean
  isOwner: boolean
}
emits: {
  'show-expires-in-dialog': []
}

// ============ EntryDetailContent.vue ============
props: {
  isFileTreeOpen: boolean
  isTocOpen: boolean
  showFileDrawer: boolean           // mobile drawer state (from main)
  showTocDrawer: boolean            // mobile drawer state (from main)
  currentEntry: Entry | null
  activeFile: File | null
  fileContent: string
  fileLoading: boolean              // entryDetail.loading
  fileError: string | null          // entryDetail.error
  shareErrorState: boolean
  slug: string
  isMarkdown: boolean
  isHtml: boolean
  isImage: boolean
  isBinary: boolean
  pathMap: PathMap | null
  tocHeadings: TocHeading[]
  siblingFileIds: number[]
  wrapEnabled: boolean
  canWrap: boolean
  isMultiFile: boolean
}
emits: {
  'select-file': [file: File]
  'navigate-file': [fileId: number]
  'scroll-to-heading': [heading: TocHeading]
  'toggle-wrap': []
  'close-file-drawer': []
  'close-toc-drawer': []
}

// ============ EntryDetailMobileBar.vue ============
props: {
  isMultiFile: boolean
  isMarkdown: boolean
  tocHeadings: TocHeading[]
  isBinary: boolean
  canWrap: boolean
  canCopy: boolean
  wrapEnabled: boolean
  showFileDrawer: boolean
  showTocDrawer: boolean
  overflowItems: OverflowMenuItem[]
  currentEntry: Entry | null       // for file count badge
}
emits: {
  'toggle-file-drawer': []
  'toggle-toc-drawer': []
  'toggle-wrap': []
  'copy-content': []
}

// ============ EntryDetailDialogs.vue ============
props: {
  showConfirmDelete: boolean
  deleteMessage: string
  showExpiresInDialog: boolean
  showLogin: boolean
  isShareAccess: boolean
  slug: string
  isArchived: boolean
  sharedBy: string | null          // currentEntry?.shareContext?.sharedBy
}
emits: {
  'update:show-confirm-delete': [value: boolean]   // v-model:visible pattern
  'confirm-delete': []
  'cancel-delete': []
  'update:show-expires-in-dialog': [value: boolean]
  'expires-in-updated': []
  'update:show-login': [value: boolean]
}
```

**Composable 函数签名和返回值接口**：

```typescript
// ============ useZenMode.ts ============
function useZenMode(): {
  zenMode: Ref<boolean>
  zenAriaText: Ref<string>
  handleZenKeydown: (event: KeyboardEvent) => void
  updateZenAria: (zen: boolean) => void
}
// 生命周期管理：主组件在 onMounted 中 document.addEventListener('keydown', handleZenKeydown)
//              onUnmounted 中 document.removeEventListener('keydown', handleZenKeydown)
// composable 不自行注册/移除事件监听——由主组件控制生命周期

// ============ useResponsiveLayout.ts ============
function useResponsiveLayout(): {
  viewportWidth: Ref<number>
  isMobile: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  metaTagsHidden: Ref<boolean>
  handleResize: () => void           // 主组件 onMounted 注册 window.addEventListener('resize', handleResize)
  setupScrollHide: (container: HTMLElement) => () => void  // 返回 cleanup 函数
  // 内部管理 resizeTimer（requestAnimationFrame debounce）
}
// 主组件调用：
//   const layout = useResponsiveLayout()
//   onMounted(() => {
//     window.addEventListener('resize', layout.handleResize)
//     const cleanup = layout.setupScrollHide(contentEl)
//     onUnmounted(cleanup)  // 或手动在 onUnmounted 调
//   })
```

**权衡**：
- 优点：按职责拆分，每个子组件内聚；主组件 < 300 行；子组件各 < 200 行；composable 抽取可复用逻辑
- 风险：props/emit 传递增加模板复杂度——但比 1003 行 god component 更可维护；provide/inject 用于 zenMode/isMobile 避免逐层 prop drilling；drawer 状态留在主组件通过 props+emit 协调 Content 和 MobileBar
- 工作量：较大（新建 5 子组件 + 2 composable + 重写主组件模板），但纯结构重构不改行为

### 候选方案 B（否决）：按区域拆分（header / content / footer）

将组件拆为 3 个区域子组件：Header、Content、Footer/Mobile。

**否决理由**：
- "区域"拆分不解决职责混合问题——Content 区域仍包含文件树/TOC/渲染/抽屉等多个职责
- Header 区域混合了 zen mode/响应式/share/delete 等不同关注点
- 按职责拆分（方案 A）使每个子组件有明确的单一职责，更符合组件设计原则
- 方案 A 的子组件可独立测试（如 EntryDetailBanners 可单独测试 expired/archived banner 显示逻辑）

---

### R7: 前端错误格式兼容

**follows_existing_pattern**: [后端 R3 错误格式统一化的直接前端同步]

**现状**：3 个组件读 `e.response?.data?.detail`：
- ExpiresInDialog.vue:66 → `e.response?.data?.detail || e.message || 'Failed to update'`
- SecurityTab.vue:71 → `err?.response?.data?.detail`
- ProfileTab.vue:74 → `err?.response?.data?.detail || 'Failed to update profile'`

**改动**：将 `.detail` 改为 `.error?.message`：
- ExpiresInDialog.vue:66 → `e.response?.data?.error?.message || e.message || 'Failed to update'`
- SecurityTab.vue:71 → `err?.response?.data?.error?.message`
- ProfileTab.vue:74 → `err?.response?.data?.error?.message || 'Failed to update profile'`

**LoginDialog.vue:157/161 不受影响**：读的是 `e.detail`（DOM CustomEvent 属性，非 HTTP 错误格式）。

**权衡**：无需候选方案——目标明确（跟随后端 R3 同步改读取路径），改动量极小（3 行）。

---

## §2 BDD 覆盖矩阵

| BDD | 重构项 | 验证方式 |
|-----|--------|----------|
| BDD-1 | R1 | grep `StorageManager(config=config)` in files.py → 0 匹配 |
| BDD-2 | R1 | grep `Session(engine)` in files.py 路由函数体 → 0 匹配 |
| BDD-3 | R1 | grep `EntryService(engine=` in admin_service.py → 0 匹配 |
| BDD-4 | R1 | grep `ApiKeyService(engine=` in auth.py → 0 匹配 |
| BDD-5 | R1 | grep `ReadTrackingService(engine=` in entry_service.py → 0 匹配 |
| BDD-6 | R1 | grep `ShareService(engine=` in entry_service.py → 0 匹配 |
| BDD-7 | R3 | curl 任意 API 错误端点 → 响应含 `error.code` 不含 `detail` |
| BDD-8 | R3 | `GET /api/v1/entries?status=invalid` → 422 + `error.code`（ParameterValidationError） |
| BDD-9 | R3 | `PATCH /api/v1/auth/me` 错误 → `error.code` 非 `detail` |
| BDD-10 | R3 | admin 端点 ValueError → `error.code` 非 `detail` |
| BDD-11 | R2 | grep `def _looks_like_jwt` in backend/ → 1 匹配 |
| BDD-12 | R2 | grep `def _is_global_api_key_auth` in backend/ → 1 匹配 |
| BDD-13 | R2 | grep `def _record_read_async` in backend/ → 1 匹配 |
| BDD-14 | R4 | 测试：文件写入失败 → entry row 不存在 + 磁盘文件已清理 |
| BDD-15 | R4 | 测试：正常创建 → entry + files + FTS 正常 |
| BDD-16 | R1-R4 | `make test-quick` 全绿 |
| BDD-17 | R5 | stores/ 目录存在 entryList.ts + entryDetail.ts |
| BDD-18 | R5 | 每个 store 文件 < 150 行 |
| BDD-19 | R5 | grep `loadSeq` in entryList.ts → 存在 |
| BDD-20 | R5 | 测试：快速连续 loadEntries → 最终显示第二次结果 |
| BDD-21 | R5 | `make test-frontend` 全绿 |
| BDD-22 | R5 | Playwright：URL 含 ?q=foo → 搜索框值为 foo |
| BDD-23 | R6 | EntryDetailView.vue 主文件 < 300 行 |
| BDD-24 | R6 | 每个子组件 < 200 行 |
| BDD-25~38 | R6 | Playwright：zen mode/file tree/TOC/share/delete/mobile/scroll 行为零回归 |
| BDD-39 | R7 | 测试：3 组件错误消息从 `error.message` 读取且非 undefined |
| BDD-40 | R5-R7 | `make test-frontend` 全绿 |
| BDD-41 | R5-R7 | `make typecheck` 通过 |

---

## §3 实施顺序（P0 约束复述）

```
后端（R1→R2→R3→R4）：
  R1 DI 统一 → R2 去重（DI 统一后共享模块位置确定）→ R3 错误格式（去重后认证链路集中）→ R4 事务修复（独立，最后改避免冲突）

前端（R5→R6→R7）：
  R5 store 拆分 → R6 component 拆分（store 结构稳定后引用）→ R7 错误格式兼容（与后端 R3 同步）
```

---

## files_to_read

```yaml
files_to_read:
  # R1 DI 统一
  - path: backend/peekview/main.py:200-225
    why: app.state service 初始化——构造注入需在此传入跨 service 实例
  - path: backend/peekview/api/admin.py
    why: 模式 B 参照（直接 request.app.state.* 的标准写法）
  - path: backend/peekview/api/entries.py:33-36,131-237
    why: _get_service Depends 模式 → 改为 app.state；_check_share_cookie 用 Session 直接查 DB
  - path: backend/peekview/api/files.py:167-541
    why: 4 处 StorageManager+Session 手建 → 改为 service 层；_resolve_entry 中 ShareService new
  - path: backend/peekview/auth.py:137-190
    why: get_current_user 中 ApiKeyService new → 改为 app.state.apikey_service
  - path: backend/peekview/services/entry_service.py:51-80,973-1022
    why: 构造函数签名 + _build_response 跨 service new ReadTrackingService + _get_share_service new ShareService
  - path: backend/peekview/services/admin_service.py:117-121,226,275
    why: 构造函数签名 + cleanup_expired/delete_user 跨 service new EntryService

  # R2 去重
  - path: backend/peekview/api/entries.py:47-66,102-128
    why: _record_read_async + _looks_like_jwt + _is_global_api_key_auth 定义（待移除）
  - path: backend/peekview/api/files.py:30-49,140-164
    why: _record_read_async + _looks_like_jwt + _is_global_api_key_auth 定义（待移除）
  - path: backend/peekview/auth.py:193-195
    why: _looks_like_jwt 定义（待移除）
  - path: backend/peekview/services/file_service.py
    why: 工具函数模块先例（_shared.py 的参照模式）

  # R3 错误格式统一
  - path: backend/peekview/exceptions.py
    why: PeekError 层级——复用/新增子类 + 基类加 details 字段
  - path: backend/peekview/main.py:481-508
    why: peek_error_handler——需更新 details 字段输出
  - path: backend/peekview/api/entries.py:203-208
    why: HTTPException status 验证 → ParameterValidationError（新增，422）
  - path: backend/peekview/api/auth.py:198-269
    why: 4 处 HTTPException → PeekError 子类
  - path: backend/peekview/api/admin.py:48-57
    why: HTTPException ValueError → ValidationError

  # R4 事务修复
  - path: backend/peekview/services/entry_service.py:215-302
    why: create_entry 事务——commit 时机后移（flush → 单次 commit）

  # R5 store 拆分
  - path: frontend-v3/src/stores/entry.ts
    why: 223 行 store 待拆分为 entryList.ts + entryDetail.ts
  - path: frontend-v3/src/views/EntryListView.vue
    why: useEntryStore → useEntryListStore；storeToRefs 解构 list 状态
  - path: frontend-v3/src/views/EntryDetailView.vue:338-388
    why: useEntryStore → useEntryDetailStore；storeToRefs 解构 detail 状态

  # R6 component 拆分
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: 1003 行 god component 待拆分为 5 子组件 + 2 composable
  - path: frontend-v3/src/components/ShareDialog.vue
    why: 已有子组件参照（props/emit 模式）
  - path: frontend-v3/src/components/FileTree.vue
    why: 已有子组件参照（props/emit 模式）

  # R7 前端错误格式兼容
  - path: frontend-v3/src/components/ExpiresInDialog.vue:60-70
    why: e.response?.data?.detail → .error?.message
  - path: frontend-v3/src/components/settings/SecurityTab.vue:65-75
    why: err?.response?.data?.detail → .error?.message
  - path: frontend-v3/src/components/settings/ProfileTab.vue:70-78
    why: err?.response?.data?.detail → .error?.message

  # 测试参照
  - path: backend/tests/conftest.py
    why: 测试隔离配置（autouse isolate_config_file）
  - path: frontend-v3/src/stores/__tests__/entry.spec.ts
    why: entry store 现有测试——拆分后需对应调整
  - path: frontend-v3/src/components/__tests__/t031-entry-detail-view.spec.ts
    why: EntryDetailView 现有测试——拆分后需对应调整
```

---

## 实现完成的标志

| 标志 | 验证命令 |
|------|----------|
| 后端 DI 无路由内手建 | `rg "StorageManager\(config=" backend/peekview/api/files.py` → 0 |
| 后端 DI 无跨 service new | `rg "EntryService\(engine=" backend/peekview/services/admin_service.py` → 0；同理 ReadTrackingService/ShareService/ApiKeyService |
| 去重函数全局唯一 | `rg "def _looks_like_jwt" backend/peekview/` → 1；同理 _is_global_api_key_auth, _record_read_async |
| API 无 HTTPException 残留 | `rg "HTTPException" backend/peekview/api/` → 0（main.py 基础设施层除外） |
| 事务完整 | 文件写入失败测试 → entry row 不存在 |
| store 拆分 | `wc -l frontend-v3/src/stores/entryList.ts frontend-v3/src/stores/entryDetail.ts` → 各 < 150 |
| component 拆分 | `wc -l frontend-v3/src/views/EntryDetailView.vue` → < 300；子组件各 < 200 |
| 后端测试全绿 | `make test-quick` |
| 前端测试全绿 | `make test-frontend` |
| 类型检查通过 | `make typecheck` |
| lint 通过 | `make lint` |
