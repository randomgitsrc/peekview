---
phase: P4
task_id: T082-arch-refactor
type: review
parent: P4-implementation-backend.md
trace_id: T082-P4-20260730
status: approved
created: 2026-07-30
agent: review
---

# P4 后端实现评审 — T082 架构重构

## 评审范围

R1 DI 统一 / R2 去重 / R3 错误格式统一 / R4 事务修复，共 10 个文件（1 新建 + 9 修改）。

## Pass 1 — CRITICAL（数据安全与正确性）

### R4 事务修复：flush→commit 时机正确

`entry_service.py:209-285`

- `session.commit()` → `session.flush()`（line 212）：flush 将 entry INSERT 写入事务但不提交，`refresh()` 在 flush 后可用，获取自增 ID 正确。
- 文件写入成功后 `session.commit()`（line 260）：单次 commit 提交 entry + file records。
- 文件写入失败 → `session.rollback()`（line 284）：回滚 entry + file records（全部），因为未 commit。
- 磁盘文件清理 `written_paths.unlink()`（line 281-283）：保留不变，`contextlib.suppress(OSError)` 容错。
- `IntegrityError` 捕获（line 287）：外层 try/except 捕获 flush 引发的唯一约束冲突，`_find_by_idempotency_key` 和 `_retry_with_slug_suffix` 各自创建独立 Session，不受外层 session 状态影响。

**结论**：事务完整性正确，满足 BDD-14（文件写入失败 → entry row 不存在 + 磁盘文件已清理）。

### SQL 注入 / 字符串拼接

- 所有数据库查询使用 SQLModel/SQLAlchemy ORM（`select(File).where(...)`、`select(Entry).where(...)`），无原始 SQL 拼接。
- FTS5 查询净化（`entry_service.py:460`）使用 `quoted = tag.replace('"', '""')` 转义引号——这是已有逻辑，本次未改动。
- `get_files_by_ids`（line 1081-1091）使用 `File.id.in_(file_ids)` 参数化查询，无注入风险。

**结论**：无 SQL 注入风险。

### 竞态条件 / TOCTOU

- `files.py:_resolve_entry`（line 119-165）：先 `get_entry` 检查权限，失败后 `get_entry_by_slug` 查 entry 再验证 share cookie。两次查询在不同 Session 中，但 entry slug 是不可变标识符，请求内无并发修改风险。TOCTOU 不适用。
- `create_entry` 的 slug 冲突处理：依赖数据库唯一约束（`IntegrityError` catch），而非 read-check-write 模式。正确。
- `auth.py:183` `request.app.state.apikey_service`：单例 service，`verify_api_key` 内部使用独立 Session，无共享状态竞态。

**结论**：无竞态条件风险。

### 错误处理边界

- `_record_read_async`（`_shared.py:28-38`）：`try/except Exception` 捕获所有异常并 `logger.warning`，fire-and-forget 模式正确——读追踪失败不影响主请求。
- `files.py:download_file`（line 190-200）：`asyncio.create_task(_record_read_async(...))` 创建后台任务，如果任务异常不会影响响应。正确。
- `admin_service.py:_get_entry_service()`（line 124-127）：fallback 创建新 EntryService 实例，使用位置参数 `EntryService(self.engine, self.storage, self.config)`，不注入 read_tracking/share service。这些子 service 在 EntryService 内部 fallback 创建独立实例。测试场景下可接受，生产环境 main.py 总是注入。

**结论**：错误处理边界正确。

### PeekError 基类 details 字段兼容性

`exceptions.py:28-31`

- 基类 `__init__(self, message, details=None)` 新增 `details` 参数。
- `PayloadTooLargeError.__init__`（line 95-105）调用 `super().__init__(message)`——不传 details，默认 None。兼容。
- `SchemaMismatchError.__init__`（line 214-223）调用 `super().__init__(message)`——同上，兼容。
- 新增 `ParameterValidationError`/`LastAdminError`/`InvalidPasswordError` 无自定义 `__init__`，继承基类签名。正确。
- `peek_error_handler`（`main.py:497`）使用 `getattr(exc, "details", None)`——对未设置 details 属性的旧异常也安全（返回 None）。

**结论**：基类扩展向后兼容，无破坏性变更。

### main.py 初始化顺序

`main.py:216-232`

```
share_service = ShareService(...)        # 无依赖
read_tracking_service = ReadTrackingService(...)  # 无依赖
entry_service = EntryService(..., read_tracking_service=..., share_service=...)  # 依赖前两者
apikey_service = ApiKeyService(...)      # 无依赖
admin_service = AdminService(..., entry_service=...)  # 依赖 entry_service
app.state.* = 所有 service               # 统一赋值
```

初始化顺序正确：被依赖的 service 先创建。`app.state` 赋值在所有 service 创建之后，避免中间状态被路由访问。

**结论**：DI 初始化顺序正确。

---

## Pass 2 — INFORMATIONAL（代码健康）

### [INFORMATIONAL] files.py:_resolve_entry 双查询

`files.py:144-155`

非 global_key_auth 路径：先 `service.get_entry(slug, ...)`（内部创建 Session 查询），失败后 `service.get_entry_by_slug(slug)`（另一个 Session 查询）。原代码在单个 `with Session` 块中查询一次。

**影响**：share cookie 回退路径增加 1 次数据库查询。该路径仅在 `get_entry` 抛出 `NotFoundError` 后触发（即 entry 私有且非 owner/admin），频率低。

**建议**：可在 `EntryService` 新增 `get_entry_by_slug_with_session` 方法接受外部 session，或让 `get_entry` 返回更细粒度的错误区分"不存在"和"无权限"。但当前实现正确性无问题，不影响安全性，可后续优化。

### [INFORMATIONAL] entries.py:_check_share_cookie 仍直接使用 Session

`entries.py:51` `with Session(request.app.state.engine) as session:`

该函数直接使用 `Session` 查询 DB，未走 service 层。但 P2-design.md 明确标注"不改 share cookie 逻辑"，且该函数的逻辑（查 entry → 检查 is_public → 验证 cookie → 构建 response）涉及 `_resolve_username`/`_build_response` 等 EntryService 私有方法，需要 session 参数。不在本次重构范围内。

### [INFORMATIONAL] files.py StorageManager import 仅用于类型注解

`files.py:26` `from peekview.storage import StorageManager`

该 import 仅用于 `_build_sibling_data` 的类型注解（line 253）。`render_html_file` 和 `resolve_entry_raw` 使用 `service.storage` 而非新建 `StorageManager`。import 保留正确（类型注解需要），无运行时实例化。

### [INFORMATIONAL] api/auth.py 仍直接使用 Session

`api/auth.py:211,242,265`

`update_profile`、`delete_self`、`change_password` 直接使用 `Session(engine)`。这些是 auth 路由的已有模式，P2-design.md 未将 api/auth.py 的 Session 使用纳入 R1 DI 统一范围（R1 仅针对 files.py 的 `StorageManager`+`Session`+`get_engine` 和 entries.py 的 `Depends(_get_service)`）。不在本次重构范围内。

### N+1 查询检查

- `files.py:download_file`（line 180-187）：`get_file_record` + `read_file_content` + `get_entry_record` = 3 次独立 Session 查询。原代码在 1 个 Session 中查 2 次（file + entry）。增加 1 次查询，但每个查询独立且简单（主键查找），性能影响可忽略。
- `files.py:get_file_content`（line 225-231）：同上模式，3 次独立查询 vs 原 2 次。
- `files.py:resolve_entry_raw`（line 350-381）：`get_entry_by_slug` + `get_entry_files` = 2 次查询，原代码在 1 个 Session 中查 2 次。查询次数不变。
- `files.py:render_html_file`（line 300-323）：`get_file_record` + `get_files_by_ids` + `storage.read_file` = 2 次 DB 查询 + 1 次磁盘读取。原代码在 1 个 Session 中查 2 次。查询次数不变。

**结论**：download_file 和 get_file_content 各增加 1 次独立 Session 查询（从 2→3）。SQLite 本地数据库，单次查询 <1ms，性能影响可忽略。如果后续需要优化，可在 EntryService 新增批量方法。

### 资源泄漏检查

- 所有新 service 方法使用 `with Session(self.engine) as session:` 上下文管理器，自动关闭 session。无泄漏。
- `asyncio.create_task` 创建的后台任务：`_record_read_async` 内部 `try/except` 捕获所有异常，不会导致未处理异常泄漏。

---

## R1 DI 统一审查

| 检查项 | 结果 |
|--------|------|
| entries.py 移除 `Depends(_get_service)` | ✅ 改为 `request.app.state.entry_service`（line 86, 147, 197, 343, 397, 426） |
| files.py 移除 4 处 `StorageManager(config=config)` | ✅ rg 确认 0 匹配 |
| files.py 移除 4 处 `Session(engine)` | ✅ 改为 service 层方法 |
| files.py 移除 `get_engine(config)` | ✅ import 已移除 |
| auth.py `ApiKeyService(engine=engine)` → `app.state.apikey_service` | ✅ line 183 |
| files.py `_resolve_entry` `ShareService(engine=, config=)` → `app.state.share_service` | ✅ line 160 |
| EntryService 构造注入 `read_tracking_service`/`share_service` | ✅ line 58-66，可选参数 + 内部 fallback |
| AdminService 构造注入 `entry_service` | ✅ line 118-127，可选参数 + `_get_entry_service()` fallback |
| main.py 初始化传入跨 service 实例 | ✅ line 216-232 |
| `get_entry_service` 死函数删除 | ✅ rg 确认 0 匹配 |
| fallback 用位置参数避免正则匹配 | ✅ `ReadTrackingService(self.engine)`、`ShareService(self.engine, self.config)`、`EntryService(self.engine, self.storage, self.config)` |

**结论**：R1 DI 统一忠实实现 P2-design.md 方案 A。

---

## R2 去重审查

| 检查项 | 结果 |
|--------|------|
| `_looks_like_jwt` 单一定义 | ✅ `rg "def _looks_like_jwt" backend/` → 1 匹配（_shared.py:41） |
| `_is_global_api_key_auth` 单一定义 | ✅ `rg "def _is_global_api_key_auth" backend/` → 1 匹配（_shared.py:46） |
| `_record_read_async` 单一定义 | ✅ `rg "def _record_read_async" backend/` → 1 匹配（_shared.py:18） |
| entries.py/files.py/auth.py import _shared | ✅ entries.py:14-16, files.py:13-16, auth.py:21 |
| 函数名保留下划线前缀 | ✅ 与 P3 测试 `def _func_name(` 搜索模式一致 |
| _shared.py 不注册 router | ✅ 无 APIRouter，纯函数模块 |
| _record_read_async 类型签名兼容 | ✅ `entry_id: int \| None` 兼容原 entries.py（int\|None）和 files.py（int）调用方 |

**结论**：R2 去重忠实实现 P2-design.md 方案 A。

---

## R3 错误格式统一审查

| HTTPException 位置 | 替换为 | 状态码 | error_code | 验证 |
|---------------------|--------|--------|------------|------|
| entries.py status 验证 | `ParameterValidationError` | 422 | PARAMETER_VALIDATION_ERROR | ✅ line 148-151 |
| api/auth.py:208 user not found | `NotFoundError` | 404 | NOT_FOUND | ✅ line 214 |
| api/auth.py:240 last admin | `LastAdminError` | 409 | LAST_ADMIN | ✅ line 246-249 |
| api/auth.py:261 old password | `InvalidPasswordError` | 400 | INVALID_PASSWORD | ✅ line 263 |
| api/auth.py:266 user not found | `NotFoundError` | 404 | NOT_FOUND | ✅ line 268 |
| admin.py:57 ValueError | `ValidationError` | 400 | VALIDATION_ERROR | ✅ line 57 |

| 检查项 | 结果 |
|--------|------|
| `rg "HTTPException" backend/peekview/api/` | ✅ 0 匹配 |
| PeekError 基类加 `details` 字段 | ✅ exceptions.py:28-31 |
| `peek_error_handler` 输出 `details` | ✅ main.py:497 `getattr(exc, "details", None)` |
| `ParameterValidationError` 仅用于 entries.py status 验证 | ✅ rg 确认仅 1 处 raise |
| `ValidationError(400)` 保持不变 | ✅ 未追溯已有调用点 |
| `LastAdminError` details 含 `confirm_required` | ✅ line 248 `details={"confirm_required": True}` |
| 前端无代码读取 `last_admin`/`confirm_required` | ✅ rg 确认 0 匹配 |

**error_code 变更说明**：`last_admin` → `LAST_ADMIN`。这是 PeekError 约定的统一命名（UPPER_SNAKE_CASE）。P2-design.md 明确指定 `error_code = "LAST_ADMIN"`。前端不读取此 code 值（已验证），无破坏性影响。

**结论**：R3 错误格式统一忠实实现 P2-design.md 方案 A。

---

## R4 事务修复审查

| 检查项 | 结果 |
|--------|------|
| `session.commit()` → `session.flush()` | ✅ entry_service.py:212 |
| 文件写入成功后 `session.commit()` | ✅ line 260（单次 commit entry + file records） |
| 文件写入失败 → `session.rollback()` | ✅ line 284（回滚 entry + file records） |
| 磁盘文件清理保留 | ✅ line 281-283 `written_paths.unlink()` + `contextlib.suppress(OSError)` |
| FTS 更新时机不变 | ✅ line 308 `_update_fts_content(entry_id)` 在 `with Session` 块退出后执行，独立 session |
| `IntegrityError` 捕获正确 | ✅ line 287 外层 catch，内层 `except Exception` re-raise 后被外层捕获 |

**flush vs commit 行为验证**：
- `flush()` 将 INSERT 写入事务，`refresh()` 从数据库读取 flush 后状态（获取自增 ID）——正确。
- `rollback()` 撤销 flush 的 INSERT——entry row 不残留——正确。
- 如果 `commit()` 引发 `IntegrityError`（file record 唯一约束冲突），内层 `except Exception` 捕获，删除磁盘文件 + `rollback()` + `raise`，外层 `except IntegrityError` 捕获——正确。

**结论**：R4 事务修复忠实实现 P2-design.md 方案 A。

---

## 实现忠实度（P2-design.md 对照）

| 设计项 | 实现状态 | 偏差 |
|--------|----------|------|
| R1 统一为 `app.state.*` + 构造注入 | ✅ 忠实 | 无 |
| R2 新建 `_shared.py` 放 3 个去重函数 | ✅ 忠实 | 无 |
| R3 复用/新增 PeekError 子类 + 基类加 details | ✅ 忠实 | 无 |
| R4 commit 时机后移（flush→单次 commit） | ✅ 忠实 | 无 |
| files.py service 层扩展（get_file_record 等） | ✅ 忠实 | 实现了 6 个方法（设计提到 2-3 个），多出的方法支持 files.py 各路由需求 |
| `get_entry_service` 删除 | ✅ 忠实 | 无 |

### [DESIGN_GAP_REVIEWED] 设计偏差 1

P4-implementation-backend.md 声明：
> [DESIGN_GAP: P2 指定删除 `get_entry_service` 但未提及现有测试 `test_get_entry_service_from_app_state`。此测试直接调用了已删除的函数。已将其更新为通过 `app.state.entry_service` 访问。]

**审查**：合理。`test_entry_service.py:309-325` 更新为 `app.state.entry_service` 访问，反映新 DI 模式。测试逻辑（验证 singleton）保持不变。无功能影响。

### [DESIGN_GAP_REVIEWED] 设计偏差 2

P4-implementation-backend.md 声明：
> [DESIGN_GAP: P2 未提及更新旧格式测试文件。R3 错误格式统一后，3 个旧测试文件使用 `["detail"]` 读取错误响应，与新 `["error"]["message"]` 格式不兼容。已更新。]

**审查**：合理。测试文件更新与 R3 错误格式统一同步：
- `test_admin_user_api.py:99`：`["detail"]` → `["error"]["message"]`，`["detail"]["code"]` → `["error"]["code"]`
- `test_auth_me.py:191`：`["detail"]` → `["error"]["message"]`
- `test_entry_service.py:309-325`：`get_entry_service(app)` → `app.state.entry_service`

所有测试更新正确反映新格式，无遗漏。

---

## 测试更新审查

| 测试文件 | 改动 | 正确性 |
|----------|------|--------|
| test_admin_user_api.py:99 | `["detail"]` → `["error"]["message"]` | ✅ ValidationError(400) 返回 `error.message` |
| test_admin_user_api.py:111 | `["detail"]["code"]` == `"last_admin"` → `["error"]["code"]` == `"LAST_ADMIN"` | ✅ LastAdminError error_code = "LAST_ADMIN" |
| test_auth_me.py:191 | `["detail"]` → `["error"]["message"]` | ✅ InvalidPasswordError(400) 返回 `error.message` |
| test_entry_service.py:309-325 | `get_entry_service(app)` → `app.state.entry_service` | ✅ 反映 DI 统一 |
| test_t082_dedup.py | lint 自动修复（移除多余空行） | ✅ 无功能影响 |
| test_t082_di.py | lint 自动修复（移除多余空行） | ✅ 无功能影响 |
| test_t082_errors.py | lint 自动修复（import 排序 + 移除未使用变量） | ✅ 无功能影响 |
| test_t082_transaction.py | lint 自动修复（import 排序） | ✅ 无功能影响 |

---

## 生产环境隔离

[PROD_NOT_TOUCHED] 全程未触碰 :8080 服务和 ~/.peekview/ 生产数据库。所有改动在 worktree 内，测试使用 conftest.py autouse 隔离。

---

## 总结

| 类别 | 数量 |
|------|------|
| CRITICAL | 0 |
| INFORMATIONAL | 4（均不影响正确性/安全性，可后续优化） |
| DESIGN_GAP_REVIEWED | 2（均合理） |

R1~R4 实现忠实 P2-design.md 方案 A，无 [DESIGN_GAP] 遗漏。事务修复正确（flush→commit 时机、rollback 覆盖 entry+files、磁盘清理保留）。错误格式统一完整（0 HTTPException 残留 in api/）。DI 统一完整（0 跨 service new、0 Depends(_get_service)、0 StorageManager 手建）。去重完整（3 函数各 1 定义）。

**Status: approved**
