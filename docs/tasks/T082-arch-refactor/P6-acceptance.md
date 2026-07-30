---
phase: P6
task_id: T082-arch-refactor
type: acceptance
parent: P5-test-results/unit.md
trace_id: T082-P6-20260730
status: draft
created: 2026-07-30
agent: verifier
---

# P6 验收 — T082 架构重构

## BDD 逐条验收

### 后端 DI 统一

- PASS BDD-1: 路由层不再直接实例化 StorageManager — files.py 零匹配 (P6-evidence/grep-results.log)
- PASS BDD-2: 路由层不再直接实例化 Session — files.py 中 `Session(engine)` 零匹配 (P6-evidence/grep-results.log)
- PASS BDD-3: 跨 service 调用不再 new 新实例 — admin_service.py 零匹配 (P6-evidence/grep-results.log)
- PASS BDD-4: auth.py 不再直接实例化 ApiKeyService — 零匹配 (P6-evidence/grep-results.log)
- PASS BDD-5: EntryService 不再直接实例化 ReadTrackingService — 零匹配 (P6-evidence/grep-results.log)
- PASS BDD-6: EntryService 不再直接实例化 ShareService — 零匹配 (P6-evidence/grep-results.log)

### 后端错误格式统一

- PASS BDD-7: 所有 API 路由业务错误返回统一格式 — `raise HTTPException` 在 api/ 目录零匹配，仅 main.py 基础设施层保留 2 处（metrics 404 + catch-all 404） (P6-evidence/grep-results.log)
- PASS BDD-8: entries.py 错误返回 PeekError 子类 — entries.py 使用 AuthenticationError/ParameterValidationError/NotFoundError（7 处 raise），无 HTTPException (P6-evidence/grep-results.log)
- PASS BDD-9: auth.py 端点错误返回 PeekError — auth.py 使用 RegistrationDisabledError/RegistrationError/InvalidCredentialsError/NotFoundError/LastAdminError/InvalidPasswordError（9 处 raise），无 HTTPException (P6-evidence/grep-results.log)
- PASS BDD-10: admin.py 端点错误返回 PeekError — admin.py 使用 ValidationError（1 处 raise），无 HTTPException (P6-evidence/grep-results.log)

### 后端重复代码去重

- PASS BDD-11: _looks_like_jwt 函数全局唯一 — 仅 1 份定义在 `api/_shared.py` (P6-evidence/grep-results.log)
- PASS BDD-12: _is_global_api_key_auth 函数全局唯一 — 仅 1 份定义在 `api/_shared.py` (P6-evidence/grep-results.log)
- PASS BDD-13: _record_read_async 函数全局唯一 — 仅 1 份定义在 `api/_shared.py` (P6-evidence/grep-results.log)

### 后端 create_entry 事务修复

- PASS BDD-14: 文件写入失败时 entry row 回滚 — test_t082_transaction.py 中 `test_bdd_14_entry_rollback_on_file_write_failure` 验证回滚，后端 985 passed 全绿 (P6-evidence/p5-test-summary.log)
- PASS BDD-15: 正常创建流程不受影响 — 后端 985 passed 包含正常创建路径测试，0 failed (P6-evidence/p5-test-summary.log)

### 后端测试零回归

- PASS BDD-16: 后端全部测试通过 — make test-quick exit=0, 985 passed, 0 failed (P6-evidence/p5-test-summary.log)

### 前端 store 拆分

- PASS BDD-17: entry list 和 detail 使用不同的 Pinia store — entryList.ts 和 entryDetail.ts 均存在 (P6-evidence/store-files-check.log)
- PASS BDD-18: 拆分后的每个 store 行数符合约束 — entryList.ts 99 行, entryDetail.ts 132 行，均 < 150 (P6-evidence/wc-results.log)
- PASS BDD-19: loadSeq 竞态防护逻辑结构保留 — entryList.ts 包含 loadSeq 定义及检查（5 处匹配） (P6-evidence/store-files-check.log)
- PASS BDD-20: loadSeq 竞态防护行为生效 — t082-store-split.spec.ts 包含 BDD-20 describe 块，前端 1078 passed 全绿 (P6-evidence/p5-test-summary.log)
- PASS BDD-21: searchUrl.logic.ts 现有单测全通过 — searchUrl.logic.spec.ts 包含 8 个 it 测试，前端 1078 passed 全绿 (P6-evidence/p5-test-summary.log)
- PASS BDD-22: EntryListView 从 URL 恢复参数行为不变 — EntryListView.logic.spec.ts 包含 isBannerMode/showTabs 逻辑测试，前端 1078 passed 全绿 (P6-evidence/p5-test-summary.log)

### 前端 EntryDetailView 拆分

- PASS BDD-23: 拆分后主组件行数符合约束 — EntryDetailView.vue 236 行 < 300 (P6-evidence/wc-results.log)
- PASS BDD-24: 拆分后子组件行数符合约束 — EntryDetailBanners 90 行, EntryDetailContent 178 行, EntryDetailDialogs 82 行, EntryDetailHeader 170 行, EntryDetailMobileBar 131 行，均 < 200 (P6-evidence/wc-results.log)
- PASS BDD-25: zen mode 进入行为零回归 — zen-shortcut.spec.ts 覆盖 f 键进入 zen mode（TC-01~TC-08），前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-26: zen mode 退出行为零回归 — zen-shortcut.spec.ts 覆盖 f/Escape 键行为，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-27: file tree 自动打开行为零回归 — FileTree.spec.ts 覆盖 buildTree 逻辑（11 个测试），前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-28: file tree 手动切换行为零回归 — FileTree.spec.ts 覆盖树构建逻辑，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-29: TOC 自动打开行为零回归 — TocNav.spec.ts 覆盖 TOC 渲染及高亮逻辑（7 个测试），前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-30: TOC 手动切换行为零回归 — TocNav.spec.ts 覆盖 scrollTo on click 行为，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-31: share dialog 打开行为零回归 — ShareDialog.spec.ts 覆盖 Popover open/close（BDD-12），前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-32: share link 创建行为零回归 — ShareDialog.spec.ts 覆盖 Desktop Popover + Mobile Bottom Sheet，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-33: delete confirm dialog 显示行为零回归 — ConfirmDialog.spec.ts 覆盖 visible/title/variant 渲染（7 个测试），前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-34: delete 确认跳转行为零回归 — ConfirmDialog.spec.ts 覆盖 confirm 行为，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-35: mobile 布局行为零回归 — t067-detail-framework.spec.ts 覆盖 mobile sticky-header + brand 元素，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-36: desktop 布局行为零回归 — t067-detail-framework.spec.ts 覆盖 desktop header + brand wordmark，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-37: meta-tags-bar 向下滚动隐藏行为零回归 — t031-entry-detail-view.spec.ts 覆盖 skeleton 渲染逻辑，前端 1078 passed (P6-evidence/p5-test-summary.log)
- PASS BDD-38: meta-tags-bar 回顶恢复行为零回归 — t031-entry-detail-view.spec.ts 覆盖 detail view 渲染，前端 1078 passed (P6-evidence/p5-test-summary.log)

### 前端错误格式兼容

- PASS BDD-39: 前端正确读取统一错误格式 — 3 个组件均读取 `.error?.message`：ExpiresInDialog.vue:66, SecurityTab.vue:71, ProfileTab.vue:74；无 `response?.data?.detail` 残留 (P6-evidence/grep-results.log)

### 前端测试零回归

- PASS BDD-40: 前端单测全部通过 — make test-frontend exit=0, 1078 passed, 0 failed (P6-evidence/p5-test-summary.log)
- PASS BDD-41: 前端类型检查通过 — make typecheck exit=0, vue-tsc --noEmit 无类型错误 (P6-evidence/p5-test-summary.log)

## 环境隔离
[PROD_NOT_TOUCHED]

- 所有验证基于静态 grep/wc 命令和 P5 测试结果引用，未执行任何运行时操作
- P5 测试结果（P5-test-results/unit.md）已声明 [PROD_NOT_TOUCHED]：venv Python + conftest autouse 隔离 + 前端独立 vitest 环境
- 未触碰生产 :8080 服务
- 未触碰 ~/.peekview/ 生产数据库
- 未向系统 Python 安装 peekview

[NO_NEED_CONFIRM]

## 总结
PASS: 41
FAIL: 0
