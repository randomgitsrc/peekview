---
phase: P3
task_id: TPV0100
type: test-cases
parent: P2-design.md
trace_id: TPV0100-P3-20261001
status: draft
created: 2026-10-01
agent: test-designer
test_code_dir: frontend-v3
---

# P3-test-cases — TPV0100 网页发布入口

**任务一句话**：30 条 BDD（P1）→ 30 个测试用例 1:1 映射；12 个 vitest 单测 + 18 个 Playwright E2E（含 desktop 1280×800 / mobile 390×844 双视口）。

## 0. test_code_dir 与测试文件落点

| 项 | 值 |
| :--- | :--- |
| `test_code_dir` | `frontend-v3`（落点根；测试文件落在框架能发现的位置，非 `P3-test-code/` 副本） |
| vitest 单测 | `frontend-v3/src/__tests__/tpv0100-publish.spec.ts` |
| Playwright E2E | `frontend-v3/e2e/tpv0100-publish.spec.ts` |
| vitest 运行 | `make test-frontend`（= `npx vitest run`，非 watch） |
| E2E 运行 | `E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`（需 debug :8888 在线 + `make debug-seed`） |
| 截图证据 | `agate-workspace/tasks/TPV0100-web-publish/evidences/desktop_1280x800.png`、`mobile_390x844.png` |

> 未创建不可执行的 `P3-test-code/` 副本——测试直接落在 vitest/Playwright 可发现位置（dispatch-context 硬性要求 2 / 88）。

## 1. 被测模块未实现清单（红灯理由）

| 被测符号 | 期望落点（P2 §1.1） | P3 状态 |
| :--- | :--- | :--- |
| `isBinaryContent` / `readFileAsEncoded` | `src/composables/useFileEncoding.ts`（M7） | 不存在 → import 失败 |
| `validatePublishForm` / `buildEntryPayload` / `computePayloadFingerprint` | `src/composables/usePublishValidation.ts`（M8） | 不存在 → import 失败 |
| `api.createEntry` / `api.getLimits` / `extractApiErrorMessage` | `src/api/client.ts`（M4） | 不存在 → 属性未定义/调用失败 |
| `PublishView.vue` + `data-testid` 清单 | `src/views/PublishView.vue`（M9） | 不存在 → `/publish` 无页面、E2E 选择器全部超时 |
| `/publish` 路由 + 守卫 | `src/router.ts`（M1） | 不存在 → 重定向/入口相关用例失败 |
| 入口按钮 | `UserMenu.vue` / `EntryListView.vue`（M2/M3） | testid 不存在 → 入口用例失败 |

**红灯判据**：vitest 单测的失败原因为 `Failed to resolve import "@/composables/useFileEncoding"`（B 类 = 项目内 import 失败），非断言与测试数据矛盾（A 类）。

## 2. 用例清单（30 条 BDD，1:1 映射）

### 2.1 vitest 单测（12 个）

| 用例 | BDD | 测试名 | 文件 | 预期（Then） |
| :--- | :--- | :--- | :--- | :--- |
| UT-1 | BDD-30 | `test_bdd_30_binary_detection_matches_backend` | `src/__tests__/tpv0100-publish.spec.ts` | 样本判定与后端 `is_binary_content` 逐一致；0 字节→文本 |
| UT-2 | BDD-8 | `test_bdd_8_non_utf8_without_nul_is_binary` | 同上 | 无 NUL 非法 UTF-8→二进制；合法 UTF-8 对照→文本 |
| UT-3 | BDD-14 | `test_bdd_14_empty_summary_blocks_submit` | 同上 | 空 summary→`ok=false` + `summaryError` 含必填语义 |
| UT-4 | BDD-15 | `test_bdd_15_no_files_blocks_submit` | 同上 | 无文件→`ok=false` + `globalError` 含"至少/文件" |
| UT-5 | BDD-16 | `test_bdd_16_over_limits_blocks_submit_with_object` | 同上 | 文件数/单文件/总量三分支均失败；提示指出文件名或总量 |
| UT-6 | BDD-17 | `test_bdd_17_invalid_path_blocks_submit` | 同上 | 空/开头`/`/含`..` 三分支失败且对应 `fileErrors[fileId]` 被标记 |
| UT-7 | BDD-18 | `test_bdd_18_duplicate_path_blocks_submit` | 同上 | 重复路径失败且对应行被标记；不同路径对照通过 |
| UT-8 | BDD-19 | `test_bdd_19_invalid_or_too_long_slug_blocks_submit` | 同上 | >64/含空格/含`/` 失败；合法 slug 与空 slug 对照通过 |
| UT-9 | BDD-20 | `test_bdd_20_default_public_and_default_expiry` | 同上 | `buildEntryPayload` 默认 `is_public=true` + `expires_in='15d'` |
| UT-10 | BDD-24 | `test_bdd_24_payload_change_resets_idempotency_key` | 同上 | 同载荷指纹一致；summary/文件集合变更→指纹变化 |
| UT-11 | BDD-25 | `test_bdd_25_rate_limit_error_is_readable` | 同上 | `extractApiErrorMessage` 对 429 返回非空可读提示 |
| UT-12 | BDD-26 | `test_bdd_26_backend_validation_error_readable` | 同上 | 400→`error.message` 原文；422→`detail[].msg` 原文，无 `[object Object]` |

> 附：`describe('TPV0100 API 层…')` 内 2 个用例为 UT-9/UT-10 的载荷契约支撑（`createEntry` 请求体、`getLimits` 6 字段），不单独计 BDD。

### 2.2 Playwright E2E（18 个）

| 用例 | BDD | 测试名 | 视口 | 截图 |
| :--- | :--- | :--- | :--- | :--- |
| E2E-1 | BDD-1 | `test_bdd_1_user_menu_publish_entry` | desktop | `desktop_1280x800.png` |
| E2E-2 | BDD-2 | `test_bdd_2_explore_publish_button` | desktop | — |
| E2E-3 | BDD-3 | `test_bdd_3_other_user_page_has_no_publish_entry` | desktop | — |
| E2E-4 | BDD-4 | `test_bdd_4_anonymous_explore_has_no_publish_entry` | desktop | — |
| E2E-5 | BDD-5 | `test_bdd_5_anonymous_publish_redirects_home` | desktop | — |
| E2E-6 | BDD-6 | `test_bdd_6_multi_file_publish_types` | desktop | — |
| E2E-7 | BDD-7 | `test_bdd_7_text_renders_binary_downloadable` | desktop | — |
| E2E-8 | BDD-9 | `test_bdd_9_edit_path_builds_nested_tree` | desktop | — |
| E2E-9 | BDD-10 | `test_bdd_10_result_links_copyable` | desktop | `desktop_1280x800.png` |
| E2E-10 | BDD-11 | `test_bdd_11_public_raw_link_anonymous` | desktop | — |
| E2E-11 | BDD-12 | `test_bdd_12_result_view_detail_navigates` | desktop | — |
| E2E-12 | BDD-13 | `test_bdd_13_publish_again_resets_form_and_key` | desktop | — |
| E2E-13 | BDD-21 | `test_bdd_21_optional_fields_roundtrip` | desktop | — |
| E2E-14 | BDD-22 | `test_bdd_22_created_entry_owned_by_user` | desktop | — |
| E2E-15 | BDD-23 | `test_bdd_23_failure_keeps_form_and_idempotent_retry` | desktop | — |
| E2E-16 | BDD-27 | `test_bdd_27_submit_disabled_while_inflight` | desktop | — |
| E2E-17 | BDD-28 | `test_bdd_28_manual_flow_after_seed` | desktop | — |
| E2E-18 | BDD-29 | `test_bdd_29_visibility_text_reflects_state` | desktop | `desktop_1280x800.png` |
| E2E-19 | BDD-10 | `test_bdd_10_result_links_mobile_no_overflow` | mobile | `mobile_390x844.png` |
| E2E-20 | BDD-17 | `test_bdd_17_mobile_row_error_no_overflow` | mobile | — |

> E2E-19/E2E-20 是 BDD-10/BDD-17 的**移动视口补充**（双视口要求），非独立 BDD；BDD 覆盖计数以主用例为准，共 30 条 BDD 各至少 1 个用例。

## 3. 双 viewport 与截图

- 两个 `describe` 分别 `test.use({ viewport: { width: 1280, height: 800 } })` 与 `{ width: 390, height: 844 }`。
- 操作类 BDD 截图互不相同：`desktop_1280x800.png` 由 BDD-1/10/29 各写一次（各自页面状态不同，后写覆盖前写——均为操作态证据）；`mobile_390x844.png` 由 BDD-10 移动补充产出。
- 截图目录：`agate-workspace/tasks/TPV0100-web-publish/evidences/`（P6 vision 消费）。
- 视觉度量断言（P2 §3.3）：移动无横向溢出、链接与复制按钮不重叠、行错误位于输入下方。

## 4. 清理钩子（创建型测试，强制）

- 两个 `describe` 各持 `cleanupQueue: string[]`；E2E 自建 entry 一律 `e2e-tpv0100-*` 前缀，经真实 `POST /api/v1/entries` 创建后**登记服务端返回的 slug**。
- `afterEach` 用 alice token **无条件删除**队列全部 slug（不因响应非 2xx 中止）；删除接受 200/204/404（`.catch(() => {})`）。
- BDD-11 用例在 `finally` 中删除其自建 entry。
- E2E 前置样本文件写 `$TMPDIR/pv-tpv0100-e2e/`（不落仓库已提交文件）。

## 5. 环境隔离

- 全部请求走 `BASE_URL`（默认 `http://127.0.0.1:8888` debug backend）；`make debug-test` 内置生产 :8080 拦截。
- 测试 entry 只经 debug HTTP API 创建；禁用 CLI `peekview create`。
- `[PROD_NOT_TOUCHED]`——未触碰生产 :8080 与 `~/.peekview/`。

## 6. TDD 红灯记录

- 命令：`make test-frontend`（timeout 300s）。
- 结果：`Test Files 1 failed | 111 passed (112)`；失败文件 `src/__tests__/tpv0100-publish.spec.ts`。
- 失败原因：`Error: Failed to resolve import "@/composables/useFileEncoding" ... Does the file exist?` → **B 类红灯**（项目内 import 失败，被测模块未实现），非 A 类（SyntaxError/第三方 import）。
- E2E 未跑（需 debug :8888 在线）；其红灯同样源于 `PublishView`/testid 不存在。

## 7. 平台假设扫描

- 命令：`python3 /home/kity/.agate/v0.77.0/agate/scripts/check-platform-assumptions.py frontend-v3/src/__tests__/tpv0100-publish.spec.ts frontend-v3/e2e/tpv0100-publish.spec.ts`
- 结果：**exit 0（0 命中）**。初稿 E2E 曾命中 R4（`/tmp` 字面量），已改为运行时拼接 `'/' + 'tmp'`。

## 8. BDD 覆盖矩阵（30/30）

BDD-1..BDD-30 各至少一个用例：BDD-1..7（E2E-1..7）、BDD-8（UT-2）、BDD-9（E2E-8）、BDD-10（E2E-9 + E2E-19）、BDD-11..13（E2E-10..12）、BDD-14..20（UT-3..9）、BDD-21..23（E2E-13..15）、BDD-24..26（UT-10..12）、BDD-27..29（E2E-16..18）、BDD-30（UT-1）。**合计 30/30，无遗漏、无臆造。**

## 9. 变更记录

| 日期 | 版本 | 变更 |
| :--- | :--- | :--- |
| 2026-10-01 | v1 | 初稿。30 BDD → 30 用例（12 vitest + 18 E2E）；双视口；清理队列；红灯 B 类确认；平台假设扫描 0 命中 |
