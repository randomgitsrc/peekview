---
phase: P5
task_id: TPV0100
type: e2e-results
role: verifier
created: 2026-10-02
---

# P5 E2E 实跑结果 — TPV0100 网页发布入口

## 命令与结果

- 命令：`E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`
- 超时：`timeout 600`
- **exit code：0**
- 签名行：`39 passed (39.7s)` / `=== ✓ 所有 E2E 测试通过 ===` / `1 flaky`
- **N passed / N failed：39 passed / 0 failed**（另 1 flaky，见下）
- 运行器：Playwright，双 project（`chromium` + `Mobile Chrome`）
- 环境：debug backend `127.0.0.1:8888` 在线（主 Agent 已 `debug-start` + `debug-seed`），verifier 未启动/停止服务

## Flaky（1 条，第 1 次记录）

- `[Mobile Chrome] › e2e/tpv0100-publish.spec.ts:354:3 › TPV0100 Publish 1280x800 › test_bdd_10_result_links_copyable`
- 现象：首次尝试在 `openPublish()` 的 `page.waitForSelector('#app > *', { timeout: 20000 })`（spec L111）超时——`#app` 下唯一元素 `div.toast-container` 为 hidden，页面根未及时渲染（懒加载/渲染竞态）。**重试 #1 通过**。
- 判定：flaky（非确定性），未阻断 gate（最终 exit 0）。

## 截图路径

- 失败截图（flaky 首次尝试）：
  - `frontend-v3/test-results/tpv0100-publish-TPV0100-Pu-8e8c5-dd-10-result-links-copyable-Mobile-Chrome/test-failed-1.png`
  - 错误上下文：同目录 `error-context.md`
- 套件汇总截图目录：`/tmp/e2e-results/`（`make debug-test` 输出声明）

## 覆盖的用例（40 用例槽 = 20 唯一用例 × 2 project；1 project 重试）

chromium project 全绿，含：
`test_bdd_1_user_menu_publish_entry` / `test_bdd_2_explore_publish_button` /
`test_bdd_3_other_user_page_has_no_publish_entry` / `test_bdd_4_anonymous_explore_has_no_publish_entry` /
`test_bdd_5_anonymous_publish_redirects_home` / `test_bdd_6_multi_file_publish_types` /
`test_bdd_7_text_renders_binary_downloadable` / `test_bdd_9_edit_path_builds_nested_tree` /
`test_bdd_10_result_links_copyable` / `test_bdd_11_public_raw_link_anonymous` /
`test_bdd_12_result_view_detail_navigates` / `test_bdd_13_publish_again_resets_form_and_key` /
`test_bdd_21_optional_fields_roundtrip` / `test_bdd_22_created_entry_owned_by_user` /
`test_bdd_23_failure_keeps_form_and_idempotent_retry` / `test_bdd_27_submit_disabled_while_inflight` /
`test_bdd_28_manual_flow_after_seed` / `test_bdd_29_visibility_text_reflects_state`，
及 390x844：`test_bdd_10_result_links_mobile_no_overflow` / `test_bdd_17_mobile_row_error_no_overflow`。

> 注：E2E 通过仅为代码正确性验证；用户视角视觉/交互确认属 P6。verifier 未改代码/测试。
