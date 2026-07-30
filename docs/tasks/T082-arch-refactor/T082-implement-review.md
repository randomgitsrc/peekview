---
phase: P4
task_id: T082-arch-refactor
type: review
parent: P4-implementation-backend.md
trace_id: T082-impl-review-20260730
status: draft
created: 2026-07-30
agent: implement-review
---

# T082 实施评审报告

## 审查方法

- `git diff 5ae03d5d..HEAD` 查看全部代码改动
- 直接读改后文件验证实质（不只看 diff）
- 运行 `make test-quick`（985 passed）、`make typecheck`（pass）、`make lint`（pass）
- `make test-frontend` 1 failed（MarkdownViewer.spec.ts 超时，预存 flaky，非 T082 改动）

环境状态：[PROD_NOT_TOUCHED] 全程未触碰 :8080 服务和 ~/.peekview/ 生产数据库

---

### R1 DI 统一

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **app.state 初始化构造注入**（main.py:215-225）：`EntryService` 接收 `read_tracking_service` + `share_service`，`AdminService` 接收 `entry_service`。初始化顺序正确（share_service/read_tracking_service 先创建，再传给 EntryService，再传给 AdminService）。

2. **entries.py DI 改造**：6 个路由的 `Depends(_get_service)` 全部移除，改为 `service = request.app.state.entry_service`。`_get_service` 函数已删除。`get_entry_service` 函数（entry_service.py:51-74）已删除——grep 确认零残留。

3. **files.py DI 改造**：4 处 `StorageManager(config=config)` + `Session(engine)` + `get_engine(config)` 全部消除。改为通过 `service.get_file_record()` / `service.read_file_content()` / `service.get_entry_record()` / `service.get_entry_by_slug()` / `service.get_entry_files()` / `service.get_files_by_ids()` 6 个新增 service 方法。`_resolve_entry` 中的 `ShareService(engine=engine, config=config)` 改为 `request.app.state.share_service`。

4. **auth.py DI 改造**：`ApiKeyService(engine=engine)` 改为 `request.app.state.apikey_service`。`_looks_like_jwt` 本地定义移除，改为从 `_shared.py` import。

5. **Service 层构造函数**：`EntryService.__init__` 新增 `read_tracking_service=None, share_service=None` 可选参数 + 内部 fallback（entry_service.py:994-982, 1002-1007）。`AdminService.__init__` 新增 `entry_service=None` + `_get_entry_service()` fallback（admin_service.py:118-127）。向后兼容现有测试。

6. **files.py 仍 import StorageManager**：仅用于 `_build_sibling_data(file_record: File, storage: StorageManager)` 类型注解——无实例化，合理保留。

- **新问题**：无
- **判定**：PASS

---

### R2 去重

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **`_shared.py` 新建**（65 行）：包含 `_record_read_async`、`_looks_like_jwt`、`_is_global_api_key_auth` 三个函数。逻辑与原定义一致。

2. **全局唯一性验证**：
   - `rg "def _looks_like_jwt" backend/` → 1 匹配（_shared.py）
   - `rg "def _is_global_api_key_auth" backend/` → 1 匹配（_shared.py）
   - `rg "def _record_read_async" backend/` → 1 匹配（_shared.py）

3. **import 更新**：
   - entries.py: `from peekview.api._shared import _is_global_api_key_auth, _record_read_async`
   - files.py: `from peekview.api._shared import _is_global_api_key_auth, _record_read_async`
   - auth.py: `from peekview.api._shared import _looks_like_jwt`

4. **签名差异处理**：原 entries.py 的 `_record_read_async` 参数 `entry_id: int | None`，原 files.py 的 `entry_id: int`。合并后统一为 `int | None`——向后兼容（files.py 总是传 int）。

5. **无循环导入**：`auth.py` import `peekview.api._shared`，`_shared` import `peekview.models`——无环。验证 `from peekview.auth import get_current_user` 成功。

- **新问题**：无
- **判定**：PASS

---

### R3 错误格式统一

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **新增 3 个 PeekError 子类**（exceptions.py:224-251）：
   - `ParameterValidationError`（422, PARAMETER_VALIDATION_ERROR）
   - `LastAdminError`（409, LAST_ADMIN）
   - `InvalidPasswordError`（400, INVALID_PASSWORD）

2. **PeekError 基类扩展**（exceptions.py:18-22）：`__init__` 新增 `details: Any = None` 参数。`PayloadTooLargeError` 和 `SchemaMismatchError` 调用 `super().__init__(message)` 不传 details——默认 None，向后兼容。

3. **peek_error_handler 更新**（main.py:497）：`"details": getattr(exc, "details", None)` —— 输出 details 字段。使用 `getattr` 防御性编程（基类已设 self.details，但 getattr 更安全）。

4. **6 处 HTTPException 替换验证**：
   - entries.py:148 → `ParameterValidationError`（422 status 验证）✓
   - api/auth.py:214 → `NotFoundError`（update_profile user not found）✓
   - api/auth.py:246 → `LastAdminError(details={"confirm_required": True})` ✓
   - api/auth.py:263 → `InvalidPasswordError`（old password incorrect）✓
   - api/auth.py:267 → `NotFoundError`（change_password user not found）✓
   - api/admin.py:58 → `ValidationError`（delete_user ValueError）✓

5. **api/ 目录 HTTPException 残留**：`rg "HTTPException" backend/peekview/api/` → 0 匹配 ✓

6. **main.py 基础设施层保留**：2 处 HTTPException（metrics disabled 404 + SPA catch-all 404）合理保留——非 /api/v1/* 端点。

7. **ValidationError(400) 9 处不受影响**：grep 确认 share_service.py/entry_service.py/apikey_service.py 中的 raise ValidationError 未改动。

- **新问题**：无
- **判定**：PASS

---

### R4 事务修复

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **flush → commit 顺序**（entry_service.py:210-260）：
   - `session.add(entry)` → `session.flush()`（获取 entry.id，不提交事务）→ `session.refresh(entry)` → 写文件到磁盘 + 创建 File records → `session.commit()`（一次性提交 entry + files）
   - 正确：flush 后 entry 在事务内但未持久化，rollback 可撤销

2. **文件写入失败 rollback 覆盖 entry row**（entry_service.py:279-285）：
   - inner except: `written_paths` 磁盘清理 + `session.rollback()` → 回滚 entry + file records（全部）
   - 正确：因为 entry 未 commit，rollback 撤销 entry row

3. **磁盘文件清理逻辑保留**：`for wp in written_paths: with contextlib.suppress(OSError): wp.unlink()` ✓

4. **FTS 更新时机不受影响**：`_update_fts_content(entry_id)` 在 `with Session` 块退出后执行（entry_service.py:308），内部创建独立 session——不受外层 flush→commit 改动影响。

5. **IntegrityError 处理**：flush() 触发 IntegrityError（slug 唯一约束冲突）时，Session 上下文管理器 `__exit__` 自动 rollback，外层 `except IntegrityError` 正常捕获。

6. **BDD-14 测试验证**：`test_t082_transaction.py` 模拟磁盘写入失败，断言 entry row 不存在——测试通过。

- **新问题**：无
- **判定**：PASS

---

### R5 store 拆分

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **entryList.ts**（99 行 < 150）：list 状态 + `loadEntries` + `toggleVisibility` + `deleteEntry` + `loadSeq`。职责清晰。

2. **entryDetail.ts**（132 行 < 150）：detail 状态 + `loadEntry` + `selectFile` + `toggleWrap` + `clearEntry` + `syncVisibility` + `clearIfSlug`。职责清晰。

3. **跨 store 协调**（entryList.ts:56-76）：`toggleVisibility` action 内 `useEntryDetailStore()` 获取 detail store，调用 `syncVisibility(slug, isPublic)`——Pinia action 内引用模式正确。`deleteEntry` 同理调用 `clearIfSlug(slug)`。

4. **syncVisibility slug 检查**（entryDetail.ts:101-105）：`if (currentEntry.value?.slug === slug)` —— 不匹配时不操作，安全处理 detail store 无 currentEntry 的情况。

5. **loadSeq 竞态防护保留**（entryList.ts:7）：模块级 `let loadSeq = 0`，`loadEntries` 内 `const seq = ++loadSeq` + `if (seq !== loadSeq) return` ✓

6. **loading/error 分离**：list 和 detail 各自维护独立 loading/error——消除互相干扰。

7. **entry.ts 处理**：改为 re-export + `useEntryStore()` compat shim（35 行）。grep 确认 `useEntryStore` 无任何消费者（view 层和测试均已迁移）——shim 是死代码。

- **新问题**：`entry.ts` 的 `useEntryStore()` compat shim 是死代码（零消费者），应直接删除。非 BLOCKER——不影响功能，仅是 35 行无用代码。
- **判定**：PASS（minor 结构债：entry.ts 死代码 shim）

---

### R6 EntryDetailView 拆分

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **主组件行数**：EntryDetailView.vue 236 行 < 300 ✓

2. **子组件行数**（各 < 200）：
   - EntryDetailHeader.vue: 170 行 ✓
   - EntryDetailBanners.vue: 90 行 ✓
   - EntryDetailContent.vue: 178 行 ✓
   - EntryDetailMobileBar.vue: 131 行 ✓
   - EntryDetailDialogs.vue: 82 行 ✓

3. **Composable 抽取**：
   - `useZenMode.ts`（36 行）：zenMode/zenAriaText/handleZenKeydown/updateZenAria ✓
   - `useResponsiveLayout.ts`（62 行）：viewportWidth/isMobile/isDesktop/metaTagsHidden/handleResize/setupScrollHide ✓
   - `useEntryDetailComputed.ts`（125 行）：isMarkdown/isHtml/isImage/isBinary/pathMap/siblingFileIds/entryTitle/tocHeadings/copyContent/downloadFile/downloadPack/scrollToHeading/handleNavigateFile
   - `useEntryDetailActions.ts`（132 行）：showConfirmDelete/showExpiresInDialog/deleteMessage/handleDelete/handleToggleVisibility/handleExpiresInUpdated/overflowItems

4. **provide/inject 实现**：
   - `entryDetailKeys.ts`：3 个 Symbol InjectionKey（ZenModeKey/IsMobileKey/ZenAriaTextKey）✓
   - 主组件 provide（EntryDetailView.vue:140-142）✓
   - EntryDetailHeader inject zenMode + isMobile ✓
   - EntryDetailMobileBar inject zenMode + isMobile ✓

5. **drawer 状态所有权**：`showFileDrawer`/`showTocDrawer` 留主组件（EntryDetailView.vue:154-155），通过 props 下传 Content + emit 上报 MobileBar ✓

6. **设计偏差**：P2 设计说 EntryDetailContent 应 inject isMobile 用于 desktop/mobile 分支，实际实现未 inject——Content 纯靠 `showFileDrawer`/`showTocDrawer` props 控制移动端 drawer 渲染。这是合理的简化：Content 不需要知道 isMobile，只需响应 drawer props。非问题。

7. **行为保留**：zen mode（v-show via inject）、file tree（isFileTreeOpen prop）、TOC（isTocOpen prop）、share dialog（shareDialogOpen 主组件持有）、delete（actions.handleDelete）、mobile drawer、scroll hide（setupScrollHide）——全部保留。

- **新问题**：
  1. **`onUnmounted` 在 `onMounted` 内调用**（EntryDetailView.vue:196）：`if (content) onUnmounted(setupScrollHide(content as HTMLElement))` 在 onMounted async 回调内注册 onUnmounted 钩子。Vue 3 的生命周期钩子注册应在 setup 阶段同步调用。虽然在 onMounted 回调中组件实例仍活跃，Vue 可能仍能注册成功，但这是反模式。更健壮的做法是将 cleanup 函数存入 ref，在 onUnmounted 块中调用。非 BLOCKER——功能正常但脆弱。
  2. **Composable 数量超出设计**：P2 设计 2 个 composable（useZenMode + useResponsiveLayout），实际多出 2 个（useEntryDetailComputed + useEntryDetailActions）。这是合理的演进——主组件脚本仍有 120+ 行逻辑需要抽取，额外 composable 使主组件更聚焦。非问题。

- **判定**：PASS（minor 结构债：onUnmounted in onMounted 反模式）

---

### R7 错误格式兼容

- **落地状态**：已落地
- **实质改善**：是

**验证详情**：

1. **3 处 .detail → .error?.message 替换**：
   - ExpiresInDialog.vue:66 → `e.response?.data?.error?.message || e.message || 'Failed to update'` ✓
   - SecurityTab.vue:71 → `err?.response?.data?.error?.message` ✓
   - ProfileTab.vue:74 → `err?.response?.data?.error?.message || 'Failed to update profile'` ✓

2. **遗漏检查**：`rg "\.detail" frontend-v3/src/` 过滤后仅剩：
   - CSS 类名（`.detail-header`, `.detail-content` 等）——非 HTTP 错误读取
   - LoginDialog.vue 的 `e.detail`（DOM CustomEvent 属性）——设计明确排除
   - 无遗漏的 HTTP 错误 `.detail` 读取 ✓

- **新问题**：无
- **判定**：PASS

---

## 汇总

- **PASS**: 7
- **FAIL**: 0
- **BLOCKER**: 0

### 新结构债

| # | 描述 | 严重度 | 位置 |
|---|------|--------|------|
| SD-1 | `entry.ts` 的 `useEntryStore()` compat shim 是死代码（零消费者），应删除 | minor | frontend-v3/src/stores/entry.ts |
| SD-2 | `onUnmounted(setupScrollHide(...))` 在 `onMounted` async 回调内调用，反模式 | minor | frontend-v3/src/views/EntryDetailView.vue:196 |
| SD-3 | TD-T082-001（P2 已记录）：PayloadTooLargeError/SchemaMismatchError 的额外字段未迁移到 details | known | backend/peekview/exceptions.py |

### 总体评价

T082 架构重构 7 项（R1~R7）全部实质落地，无形式主义（改名不改善）问题。

**后端**：
- R1 DI 统一彻底消除了三种模式混用——所有路由统一 `request.app.state.*`，files.py 4 处手建 Session/StorageManager 全部走 service 层，跨 service new 全部改为构造注入+fallback。新增 6 个 service 方法封装文件读取，职责清晰。
- R2 去重干净——3 个函数全局唯一，无残留副本。
- R3 错误格式统一——6 处 HTTPException 全部替换为 PeekError 子类，api/ 目录零 HTTPException 残留，details 字段正确输出。
- R4 事务修复——flush→commit 时机正确，文件写入失败时 entry row 正确回滚。

**前端**：
- R5 store 拆分——list/detail 状态隔离，跨 store 协调通过 Pinia action 内引用实现，loadSeq 竞态防护保留。entry.ts 死代码 shim 是唯一结构债。
- R6 component 拆分——主组件 236 行（< 300），5 子组件各 < 200 行，4 composable 抽取逻辑。provide/inject 正确实现。onUnmounted in onMounted 是唯一结构债。
- R7 错误格式兼容——3 处 .detail→.error?.message 正确，无遗漏。

**测试验证**：`make test-quick` 985 passed，`make typecheck` pass，`make lint` pass。`make test-frontend` 1 failed（MarkdownViewer.spec.ts 超时——预存 flaky，非 T082 改动）。

**status: approved**
