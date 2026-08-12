---
phase: P3
task_id: T082-arch-refactor
type: test-cases
parent: P2-design.md
trace_id: T082-P3-20260730
status: draft
created: 2026-07-30
agent: test-designer
---

# P3 测试用例清单 — T082 架构重构

## 声明

```yaml
test_code_dir:
  backend: backend/tests/
  frontend: frontend-v3/src/
test_files:
  backend:
    - backend/tests/test_t082_di.py
    - backend/tests/test_t082_errors.py
    - backend/tests/test_t082_dedup.py
    - backend/tests/test_t082_transaction.py
  frontend:
    - frontend-v3/src/stores/t082-store-split.spec.ts
    - frontend-v3/src/components/t082-error-format.spec.ts
test_commands:
  backend: "make test-quick"
  frontend: "make test-frontend"
  typecheck: "make typecheck"
red_status: "全红灯（14 后端 RED + 18 前端 RED + 3 前端标注已有覆盖）"
ui_affected: false
```

## BDD 覆盖矩阵

| BDD | 重构项 | 测试文件 | 测试函数 | 策略 | 红灯原因 |
|-----|--------|----------|----------|------|----------|
| BDD-1 | R1 DI | test_t082_di.py | test_bdd_1_no_storage_manager_in_files_routes | AST 源码检查 | files.py 路由仍含 StorageManager(config=config) |
| BDD-2 | R1 DI | test_t082_di.py | test_bdd_2_no_session_in_files_routes | AST 源码检查 | files.py 路由仍含 Session(engine) |
| BDD-3 | R1 DI | test_t082_di.py | test_bdd_3_no_entry_service_new_in_admin_service | regex 源码检查 | admin_service.py 仍 new EntryService(engine= |
| BDD-4 | R1 DI | test_t082_di.py | test_bdd_4_no_apikey_service_new_in_auth | regex 源码检查 | auth.py 仍 new ApiKeyService(engine= |
| BDD-5 | R1 DI | test_t082_di.py | test_bdd_5_no_read_tracking_service_new_in_entry_service | regex 源码检查 | entry_service.py 仍 new ReadTrackingService(engine= |
| BDD-6 | R1 DI | test_t082_di.py | test_bdd_6_no_share_service_new_in_entry_service | regex 源码检查 | entry_service.py 仍 new ShareService(engine= |
| BDD-7 | R3 错误格式 | test_t082_errors.py | test_bdd_7_no_detail_format_in_api_errors | HTTP 请求 | entries.py status 验证仍返回 {"detail":"..."} |
| BDD-8 | R3 错误格式 | test_t082_errors.py | test_bdd_8_status_validation_returns_peekerror | HTTP 请求 | GET ?status=invalid 仍返回 detail 非 error |
| BDD-9 | R3 错误格式 | test_t082_errors.py | test_bdd_9_auth_endpoint_returns_peekerror | HTTP 请求 | change-password 错误仍返回 detail |
| BDD-10 | R3 错误格式 | test_t082_errors.py | test_bdd_10_admin_endpoint_returns_peekerror | HTTP 请求 | admin delete_user ValueError 仍返回 detail |
| BDD-11 | R2 去重 | test_t082_dedup.py | test_bdd_11_looks_like_jwt_unique | 全库 grep | _looks_like_jwt 3 份定义（预期 1） |
| BDD-12 | R2 去重 | test_t082_dedup.py | test_bdd_12_is_global_api_key_auth_unique | 全库 grep | _is_global_api_key_auth 2 份定义（预期 1） |
| BDD-13 | R2 去重 | test_t082_dedup.py | test_bdd_13_record_read_async_unique | 全库 grep | _record_read_async 2 份定义（预期 1） |
| BDD-14 | R4 事务 | test_t082_transaction.py | test_bdd_14_entry_rollback_on_file_write_failure | mock 测试 | entry row 在文件写入失败后仍残留（已 commit） |
| BDD-15 | R4 事务 | 已有覆盖 | — | make test-quick 覆盖正常创建路径 | — |
| BDD-16 | R1-R4 | 已有覆盖 | — | make test-quick 全绿覆盖 | — |
| BDD-17 | R5 store | t082-store-split.spec.ts | entryList.ts 文件存在等 6 条 | fs 检查 | entryList.ts/entryDetail.ts 不存在 |
| BDD-18 | R5 store | t082-store-split.spec.ts | entryList.ts < 150 行等 2 条 | fs 行数检查 | store 文件不存在 |
| BDD-19 | R5 store | t082-store-split.spec.ts | entryList.ts 包含 loadSeq | fs 检查 | store 文件不存在 |
| BDD-20 | R5 store | t082-store-split.spec.ts | 标注: P4 后行为测试覆盖 | deferred | store 不存在无法 import |
| BDD-21 | R5 store | t082-store-split.spec.ts | 标注: 已有覆盖 | make test-frontend 覆盖 | — |
| BDD-22 | R5 store | t082-store-split.spec.ts | 标注: P6 Playwright 验证 | deferred | UI 行为验证需 Playwright |
| BDD-23 | R6 component | t082-error-format.spec.ts | EntryDetailView.vue 行数 < 300 | fs 行数检查 | 当前 1004 行 |
| BDD-24 | R6 component | t082-error-format.spec.ts | 5 个子组件存在且 < 200 行 | fs 检查 | 子组件文件不存在 |
| BDD-25~38 | R6 行为零回归 | 已有覆盖 | — | P6 Playwright 验证 | P6 阶段验证 |
| BDD-39 | R7 错误格式 | t082-error-format.spec.ts | 3 组件读 .error?.message 非 .detail | fs 源码检查 | 仍读 response.data.detail |
| BDD-40 | R5-R7 | 已有覆盖 | — | make test-frontend 全绿覆盖 | — |
| BDD-41 | R5-R7 | 已有覆盖 | — | make typecheck 通过 | — |

## 测试分类

### 后端 pytest（14 条，全 RED）

| 文件 | BDD 覆盖 | 测试数 | 策略 |
|------|----------|--------|------|
| test_t082_di.py | BDD-1~6 | 6 | AST/regex 源码检查 |
| test_t082_errors.py | BDD-7~10 | 4 | AsyncClient HTTP 请求 |
| test_t082_dedup.py | BDD-11~13 | 3 | 全库函数定义计数 |
| test_t082_transaction.py | BDD-14 | 1 | monkeypatch mock + DB 查询 |

### 前端 vitest（21 条，18 RED + 3 deferred）

| 文件 | BDD 覆盖 | 测试数 | 策略 |
|------|----------|--------|------|
| t082-store-split.spec.ts | BDD-17~22 | 13 (10 RED + 3 deferred) | fs 文件存在/行数/源码内容检查 |
| t082-error-format.spec.ts | BDD-23, 24, 39 | 8 (8 RED) | fs 文件存在/行数/源码内容检查 |

### 已有覆盖（不新增测试）

| BDD | 覆盖方式 |
|-----|----------|
| BDD-15 | make test-quick 中已有正常创建测试 |
| BDD-16 | make test-quick 全绿（976 条） |
| BDD-21 | make test-frontend 中 searchUrl.logic.spec.ts |
| BDD-25~38 | P6 Playwright E2E 验证（ui_affected=false 但行为零回归需 UI 验证） |
| BDD-40 | make test-frontend 全绿 |
| BDD-41 | make typecheck 通过 |

## 红灯验证结果

### 后端
```
14 failed in 2.04s
```
全部 14 条测试因实现未写而失败（assertion 失败，非 SyntaxError/import error）。

### 前端
```
18 failed | 3 passed (21 total)
```
18 条因实现未写而失败（文件不存在/源码不含目标模式）。3 条 deferred（标注已有覆盖或 P6 验证）。

## P5 验证命令

```bash
make test-quick      # 后端 14 条 RED → 应转 GREEN
make test-frontend   # 前端 18 条 RED → 应转 GREEN
make typecheck       # 类型检查
make lint            # lint 检查
```
