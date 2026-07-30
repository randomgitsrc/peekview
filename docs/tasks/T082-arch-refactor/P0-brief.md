---
phase: P0
task_id: T082
task_name: arch-refactor
trace_id: T082
created: 2026-07-30
status: pending
parent: null
---

# T082: 架构重构

## 问题

多维度架构审计发现 6 个结构性问题，分布在前端和后端，共同导致：新增功能时心智负担高、代码重复副本易漏改、god component 无法维护、API 契约不一致。

### 后端（4 项）

1. **DI 三种模式混用**
   - `Depends(_get_service)` 带 fallback new（entries、apikeys）
   - 直接 `request.app.state.*`（admin、shares、read_tracking）
   - 路由内手建 `StorageManager` + `Session()`（files.py 4 处）
   - 跨 service 调用时 new 新实例而非用注入的（AdminService→EntryService、EntryService→ShareService、EntryService→ReadTrackingService、auth.py→ApiKeyService）

2. **错误格式两套**
   - PeekError → `{"error": {"code": "...", "message": "...", "details": null}}`
   - HTTPException → `{"detail": "..."}`
   - 前端必须处理两种格式

3. **重复代码 3 处**
   - `_looks_like_jwt()`：entries.py + files.py + auth.py（3 份）
   - `_is_global_api_key_auth()`：entries.py + files.py（2 份）
   - `_record_read_async()`：entries.py + files.py（2 份）

4. **create_entry 事务不完整**
   - entry 先 commit（line 230），文件后写，文件写入失败时 entry 已落地
   - partial failure 留脏数据（无文件 entry）

### 前端（2 项）

5. **entry store 过载**
   - `src/stores/entry.ts`（223 行）同时管理：list 状态（entries/page/perPage/total/ownerFound）+ detail 状态（currentEntry/activeFile/fileContent）+ UI 状态（wrapEnabled/loading/error）
   - list 和 detail 是不同屏幕、不同数据生命周期，共享一个 store 导致互相干扰

6. **EntryDetailView god component**
   - 1003 行：335 行模板 + 473 行脚本 + 195 行样式
   - 管理 20+ ref、15+ computed、15+ 函数、4 watcher
   - 职责：zen mode、file tree toggle、TOC toggle、share dialog、delete confirm、expires-in dialog、login dialog、responsive layout、overflow menu、copy/download/pack、scroll-to-heading、resize、meta-tags-bar scroll hide、share watermark

## 约束

- 不加新功能，不改 API 契约（除了错误格式统一化，这本身是修 bug）
- 不改数据库 schema
- 不改 MCP server
- 后端先改（DI 统一是去重和错误统一的前置），前端后改（store 拆分是 component 拆分的前置）
- 现有测试必须全绿——重构不改行为，测试是安全网
- EntryDetailView 拆分后主组件目标 < 300 行，子组件各 < 200 行
- store 拆分后每个 store < 150 行

## 已知风险

- DI 统一改动面广（几乎每个 route + 几个 service），P4 可能需要分批 commit
- `files.py` 走 service 层需要 `EntryService` 暴露文件读取方法（或新建 FileService）
- `auth.py` 用 `app.state.apikey_service` 需要在 auth 依赖注入链中拿到 request 对象
- entry store 拆分可能影响 URL 状态同步逻辑（`searchUrl.logic.ts` 目前绑定 EntryListView）
- EntryDetailView 拆分时需保持 zen mode / drawer / responsive 行为不变
- create_entry 事务修复需确认文件写入失败时文件系统清理的正确性

## 验收标准（BDD 预览）

- Given 任意 API 路由，When 发生业务错误，Then 返回 `{"error": {"code", "message", "details"}}` 格式（无 `{"detail"}` 格式残留）
- Given 任意 service 调用链，When AdminService 需要操作 entry，Then 使用 `app.state.entry_service` 而非 new EntryService
- Given files.py 路由，When 请求文件内容，Then 通过 service 层获取（无 `StorageManager` + `Session` 直接实例化）
- Given `_looks_like_jwt` 函数，When 全局搜索，Then 只存在 1 份定义
- Given create_entry 操作，When 文件写入失败，Then entry row 也回滚（无脏数据）
- Given entry list 页面和 detail 页面，When 分别加载数据，Then 使用不同的 Pinia store（EntryListStore / EntryDetailStore）
- Given EntryDetailView.vue，When 统计行数，Then 主文件 < 300 行

## 关联

- 审计报告：本次对话中三路 subagent 审计结果
- DESIGN.md §12 Do's and Don'ts：token 所有权规则（此 task 遵循同一精神——统一获取依赖的方式）
- 不依赖 T079/T080/T081，可并行
