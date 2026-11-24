---
phase: P3
task_id: TPV0104
type: test-cases
parent: P2-design.md
trace_id: TPV0104-P3-20261125
status: draft
created: '2026-11-25'
agent: test-designer
ui_affected: true
test_code_dir: frontend-v3/src
test_code_dirs:
- frontend-v3/src
- frontend-v3/e2e
- backend/tests
prod_touched: false
---

# P3-test-cases — TPV0104 Viewer 正确性与资源边界加固

> 上游：`P1-requirements.md`（54 条 BDD，approved）+ `P2-design.md`（approved，含 D1–D10 与 gate_commands）+ `P2-review.md`（approved，含 W1–W6 / G11 / G12 / N5 / R2-1 / R2-2 交接要点）。
> 本文件是 P4 实现者的直接输入：**每条 `#### BDD-NN` 在本文件恰好出现一次**，测试名一律含 `test_bdd_NN_` 前缀。
> [PROD_NOT_TOUCHED] 全程只读 seed / 现造 entry 用完即 DELETE / pytest 临时 app（`mkdtemp`）；生产 `:8080` 实测不可达（`000`），未触碰 `~/.peekview/`，未跑 CLI 写命令，未 commit。

---

## 1. test_code_dir 与测试文件清单

```yaml
test_code_dir: frontend-v3/src
```

| # | 文件 | 层 | 用例数 | 覆盖 BDD |
|---|---|---|---|---|
| 1 | `frontend-v3/src/utils/__tests__/tpv0104-default-file.spec.ts` | vitest | 9 | 08–12、16/17/18/51（机理层） |
| 2 | `frontend-v3/src/composables/__tests__/tpv0104-csv-constructed-rows.spec.ts` | vitest | 8 | 35、36、37 |
| 3 | `frontend-v3/src/composables/__tests__/tpv0104-markdown-headings.spec.ts` | vitest | 6 | 01、02、03、04、05 |
| 4 | `frontend-v3/src/components/__tests__/tpv0104-table-truncation-controls.spec.ts` | vitest | 7 | 32、33、34 |
| 5 | `frontend-v3/src/components/__tests__/tpv0104-real-file-bytes.spec.ts` | vitest | 7 | 42、43、44 |
| 6 | `frontend-v3/src/__tests__/tpv0104-source-scan.test.ts` | vitest（源码扫描） | 7 | 07、35（类型层）、47 |
| 7 | `frontend-v3/src/__tests__/tpv0104-migration-and-docs.test.ts` | vitest（代码级 + 文档 grep） | 6 | 45、50 |
| 8 | `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts` | Playwright | 39 | 01–06、08–12、14–31、42、44、48、49、51–54 |
| 9 | `frontend-v3/e2e/tpv0104-mobile-bar-widths.spec.ts` | Playwright | 9（3 档 × 3 entry） | 24（M1 守护面：360/375/390） |
| 10 | `backend/tests/test_html_render.py`（追加 TPV0104 段，`L668` 起） | pytest | 12 | 38、39、40、41、46（+ G11/G12） |
| 11 | `backend/tests/test_entry_file_order.py`（新建） | pytest | 4 | 13 |

**legacy spec 迁移（BDD-50，属测试产物）**：`frontend-v3/e2e/viewer.spec.ts`（2 处）、`t091-mobile-detail-visual-polish.spec.ts`（4 处）、`tpv0099-fullscreen-link-auth.spec.ts`（3 处）的 `firstFileId` → `file`，共 **9 处**，实测归零。

**归档副本**：`P3-test-code/`（与本清单 1:1 同名，供 P5/P6 离线查阅；真实运行位置为上述真实目录）。

### 1.1 BDD → 验证层 → 测试名（54/54 全覆盖）

> 「层」列：`vitest` / `pytest` / `E2E` / `代码级` / `文档`。`回归兼容` 标注与 P1 §3 的 12 条一致（06、27、29、30、33、36、37、41、43、46、48、49）。

| BDD | 标题（P1 原文缩写） | 层 | 测试名 | 用例数 |
|---|---|---|---|---|
| 01 | 重复同名标题正文侧 id 互不相同 | vitest + E2E | `test_bdd_01_three_identical_headings_produce_distinct_ids` / `test_bdd_01_duplicate_headings_get_distinct_ids` | 2 |
| 02 | 围栏内标题不进目录（正反双向） | vitest + E2E | `test_bdd_02_fenced_heading_excluded_real_heading_kept` / `test_bdd_02_fenced_heading_excluded_from_toc` | 2 |
| 03 | Setext 标题两侧都生成锚点 | vitest + E2E | `test_bdd_03_setext_h1_has_non_empty_id` / `test_bdd_03_setext_h1_has_anchor_both_sides` | 2 |
| 04 | 目录层级覆盖 h1–h4 且排除 h5 | vitest + E2E | `test_bdd_04_levels_1_to_4_kept_and_h5_excluded` / `test_bdd_04_toc_covers_h1_to_h4_excludes_h5` | 2 |
| 05 | TOC 文本剥离标记且与正文一致 | vitest + E2E | `test_bdd_05_inline_markup_stripped_from_heading_text` / `test_bdd_05_toc_text_strips_markup_and_matches_body` | 2 |
| 06 | 回归兼容：点 TOC 条目目标进视口 | E2E | `test_bdd_06_click_toc_item_scrolls_target_into_viewport` | 1 |
| 07 | 目录数据源单点（代码级） | 代码级 | `test_bdd_07_no_per_line_heading_regex_in_entry_detail_computed` / `test_bdd_07_no_second_heading_scan_in_detail_view` | 2 |
| 08 | 根 README 优先于排序靠前文件 | vitest + E2E | `test_bdd_08_root_readme_wins_over_lexicographically_first` / `test_bdd_08_root_readme_beats_lexicographically_first` | 2 |
| 09 | 无 README 时根 index 优先 | vitest + E2E | `test_bdd_09_root_index_when_no_readme` / `test_bdd_09_root_index_when_no_readme` | 2 |
| 10 | 都无 → 稳定排序首个（非构造首个） | vitest + E2E | `test_bdd_10_falls_back_to_stably_sorted_first_not_construction_first` / `test_bdd_10_falls_back_to_stable_sorted_first` | 2 |
| 11 | 只匹配根目录，子目录 README 不选中 | vitest + E2E | `test_bdd_11_only_root_level_readme_matches`（+ `_nested_readme_path_is_never_selected`）/ `test_bdd_11_subdirectory_readme_not_selected` | 3 |
| 12 | 文件名匹配大小写不敏感 | vitest + E2E | `test_bdd_12_readme_match_is_case_insensitive` / `test_bdd_12_readme_match_is_case_insensitive` | 2 |
| 13 | 后端文件顺序确定性契约（构造序 ≠ 字典序） | pytest | `test_bdd_13_two_consecutive_gets_same_order` / `_get_order_is_lexicographic_not_construction_order` / `_order_matches_contract_sort_key` / `_post_order_differs_from_get_order` | 4 |
| 14 | `?file=` 打开指定文件且参数保留 | E2E | `test_bdd_14_file_query_opens_file_and_survives_load` | 1 |
| 15 | `/f?file=` 全屏 + 指定文件 | E2E | `test_bdd_15_fullscreen_with_file_query` | 1 |
| 16 | 不存在 id 安全回退（成对对照） | vitest + E2E | `test_bdd_16_unknown_file_id_falls_back_to_default_entry` / `test_bdd_16_unknown_file_id_falls_back_paired` | 2 |
| 17 | 跨 entry id 拒绝并回退（成对对照） | vitest + E2E | `test_bdd_17_cross_entry_file_id_falls_back_to_default_entry` / `test_bdd_17_cross_entry_file_id_rejected_paired` | 2 |
| 18 | 非数字 file 参数安全回退（成对对照） | vitest + E2E | `test_bdd_18_valid_file_id_still_selects_that_file` / `test_bdd_18_non_numeric_file_param_falls_back_paired` | 2 |
| 19 | 页内切换同步 URL 且不新增历史 | E2E | `test_bdd_19_in_page_switch_syncs_url_without_history` | 1 |
| 20 | 切回默认文件后 `file` 参数移除 | E2E | `test_bdd_20_switch_back_to_default_removes_file_param` | 1 |
| 21 | 刷新后仍打开 URL 指定文件 | E2E | `test_bdd_21_reload_keeps_url_specified_file` | 1 |
| 22 | `file` 与 `share` 共存，清理不误删 | E2E | `test_bdd_22_file_and_share_coexist_and_survive_cleanup` | 1 |
| 23 | 桌面全屏入口可发现且在 `.actions-area` | E2E | `test_bdd_23_desktop_fullscreen_entry_discoverable_in_actions_area` | 1 |
| 24 | 移动端入口在底栏且不遮挡正文 | E2E | `test_bdd_24_mobile_entry_in_bottom_bar_without_obscuring_content`（+ 独立 spec 9 条三档守护） | 10 |
| 25 | 默认文件时点全屏 → `/{slug}/f` 无 file | E2E | `test_bdd_25_click_fullscreen_on_default_file_omits_file_param` / `test_bdd_25_mobile_click_fullscreen_navigates_to_f` | 2 |
| 26 | 非默认文件时点全屏 → `/f?file=<id>` | E2E | `test_bdd_26_click_fullscreen_on_non_default_file_keeps_file_param` | 1 |
| 27 | 回归兼容：手动 `/f` 进全屏展示默认文件 | E2E | `test_bdd_27_manual_f_enters_fullscreen_with_default_file` | 1 |
| 28 | `/f` 不展示文件树（DOM 不存在） | E2E | `test_bdd_28_fullscreen_has_no_file_sidebar_in_dom` / `test_bdd_28_mobile_fullscreen_has_no_file_sidebar` | 2 |
| 29 | 约束型：全屏无退出入口，`f`/`Escape` 无效 | E2E | `test_bdd_29_fullscreen_has_no_exit_entry_and_keys_are_noop` | 1 |
| 30 | 回归兼容：普通态 `f` 只切 zen 不改 URL | E2E | `test_bdd_30_f_key_in_normal_mode_toggles_zen_without_url_change` | 1 |
| 31 | 文件树条目无独立全屏按钮（全页计数 == 1） | E2E | `test_bdd_31_no_per_file_fullscreen_button_and_page_level_count_one` | 1 |
| 32 | 超 maxRows 时表头无排序/过滤控件 | vitest | `test_bdd_32_no_sort_buttons_when_truncated` / `test_bdd_32_no_filter_inputs_when_truncated` / `test_bdd_32_header_text_still_visible_when_truncated` | 3 |
| 33 | 回归兼容：未超限时控件存在且生效 | vitest | `test_bdd_33_sort_and_filter_controls_present_when_not_truncated` / `test_bdd_33_sorting_changes_first_row_order` / `test_bdd_33_filtering_reduces_visible_rows` | 3 |
| 34 | 截断提示含已显示行数与总行数（5 与 11） | vitest | `test_bdd_34_banner_text_has_shown_and_total_rows` | 1 |
| 35 | 解析达上限后不再构造数据行数组 | vitest + 代码级 | `test_bdd_35_constructed_rows_bounded_by_max_rows` / `_equals_data_rows_when_under_limit` / `_equals_max_rows_when_truncated` / `test_bdd_35_constructed_rows_declared_in_type` | 4 |
| 36 | 回归兼容：截断时 totalRows 仍精确 | vitest | `test_bdd_36_total_rows_exact_when_truncated` / `_exact_when_not_truncated` / `_empty_input_total_rows_zero` | 3 |
| 37 | 回归兼容：超限且引号未闭合仍抛错 | vitest | `test_bdd_37_unclosed_quote_throws_even_when_far_over_max_rows` / `test_bdd_37_short_unclosed_quote_still_throws` | 2 |
| 38 | 数量超限进跳过清单（构造路径可达）+ 代码级关系 | pytest | `test_bdd_38_exceeding_count_limit_produces_skip_report` / `test_bdd_38_inject_id_limit_below_default_entry_file_limit` | 2 |
| 39 | 单文件文本超限被跳过并记录（正反双向） | pytest | `test_bdd_39_oversized_text_sibling_skipped_and_undersized_inlined` | 1 |
| 40 | 累计超总预算必须有可机器解析反馈（合取） | pytest | `test_bdd_40_total_budget_overflow_is_machine_readable` / `_report_escapes_html_sensitive_paths` / `_non_injectable_sibling_is_recorded` / `_oversized_binary_sibling_recorded` | 4 |
| 41 | 回归兼容：未超预算时注入行为等价 | pytest | `test_bdd_41_css_and_js_inlined_with_empty_skip_list` | 1 |
| 42 | 大 HTML 按真实 `file.size` 判定（中文素材） | vitest + E2E | `test_bdd_42_bytes_over_2mb_but_chars_under_blocks_auto_render`（+ `_under_2mb_auto_renders`）/ `test_bdd_42_large_chinese_html_not_auto_rendered` | 3 |
| 43 | 回归兼容：512KB / 2MB 左闭右开语义不变 | vitest | `test_bdd_43_exactly_512kb_warns_but_still_renders` / `_exactly_2mb_blocks_auto_render` / `_just_under_2mb_does_not_block` | 3 |
| 44 | TreeView 截断判断同样用真实字节（正反两向） | vitest + E2E | `test_bdd_44_bytes_over_2mb_truncates_even_when_chars_under`（+ `_under_2mb_does_not_truncate`）/ `test_bdd_44_tree_view_uses_real_bytes` | 3 |
| 45 | 两种 HTML 权限模式与当前默认已文档化（落点唯一） | 文档 grep | `test_bdd_45_security_modes_doc_exists_at_unique_location` / `_doc_defines_both_modes` / `_doc_declares_current_default_is_interactive_demo` / `_doc_declares_connect_src_still_allows_https` | 4 |
| 46 | 不变守护：CSP 契约与 sandbox 属性不变 | pytest | `test_bdd_46_render_csp_still_allows_https` / `test_bdd_46_render_response_csp_header_matches_constant` | 2 |
| 47 | 回归兼容：卡片与列表不再引用 `files[0]`（代码级） | 代码级 | `test_bdd_47_entry_card_no_files_index_access` / `_entry_list_row_no_files_index_access` / `_entry_card_navigates_to_bare_slug` / `_entry_list_row_navigates_to_bare_slug` | 4 |
| 48 | 回归兼容：单文件 entry 详情页行为不变 | E2E | `test_bdd_48_single_file_entry_unchanged` | 1 |
| 49 | 回归兼容：Share 链接权限行为不变 | E2E | `test_bdd_49_share_link_permissions_unchanged` | 1 |
| 50 | 迁移后 3 个 e2e spec 回归等价且不再依赖 `firstFileId` | 代码级 + E2E | `test_bdd_50_no_first_file_id_literal_in_legacy_specs` / `test_bdd_50_legacy_specs_use_file_query_instead` | 2 |
| 51 | 旧 `?firstFileId=` 安全回退默认入口且不报错 | E2E + vitest | `test_bdd_51_legacy_firstFileId_falls_back_to_default`（+ 机理层 BDD-16/17/18 组） | 1 |
| 52 | 人工体验：seed 后详情页有内容且 TOC == 4 | E2E | `test_bdd_52_manual_experience_seed_entry_has_content_and_toc4` | 1 |
| 53 | 全屏态为纯内容（①② 可视计数 + ③ 侧栏 DOM） | E2E | `test_bdd_53_fullscreen_is_pure_content` | 1 |
| 54 | 全屏态正文文件链接仍可切换且 URL 同步 | E2E | `test_bdd_54_fullscreen_body_file_link_switches_and_syncs_url` | 1 |

---

## 2. 覆盖自查（54/54 无遗漏）

脚本核对方式：从 `P1-requirements.md` 枚举 `^#### BDD-(\d{2})` 得 54 项（01–54 连续），逐项在上表出现且测试名含 `test_bdd_NN_`。

```
P1 BDD 数量:        54
本表映射行数:        54
缺映射的 BDD:        无
多余映射的 BDD:      无
```

**回归兼容 / 约束型 / 不变守护 12 条**（P1 §11 ⑤ 的清单，与 P1 定性一致，不冒充新行为）：06、27、29、30、33、36、37、41、43、46、48、49。它们当前**已 PASS**（红灯计数为 0），是「P4 不得踩坏」的守护项——见 §4 的红灯分布表。

---

## 3. 每条用例的 Given / When / Then 与预期（关键项）

> 只列**区分力所在**的条目；判据全文见 `P1-requirements.md` §3，本文件不重写语义（不得改 P1 基线）。

### 3.1 反假 PASS 设计（dispatch 约束逐条落实）

| 约束 | 落实方式（文件:用例） |
|---|---|
| 约束 1：`maxRows` 默认 50000 → 必须注入小值 | `tpv0104-table-truncation-controls.spec.ts` 全部用例传 `maxRows: 5 / 50`（先例 `TableView.spec.ts:184`）；`tpv0104-csv-constructed-rows.spec.ts` 传 `maxRows: 5` |
| 约束 2：TOC 展开态必须幂等表述 | `tpv0104-viewer-hardening.spec.ts` 的 `ensureTocExpanded()`：读 `aria-expanded`，`"true"` 不点、`"false"` 点一次、`null` → 返回 `false` 并在断言处 FAIL（钉定桌面 1280×800）。**无一处按字面「点开 TOC」** |
| 约束 3：`?file=` 必须真浏览器 + 现造 entry | BDD-16/17/22 全部现造；BDD-14/15/18/19/20/21 用 seed `k8s-deployment`（3 文件，动态解析 id，勿硬编码） |
| 约束 4：V-08 必须走真实 `file.size` | `tpv0104-real-file-bytes.spec.ts` 的 BDD-42/44 用例**不注入** `HTML_VIEWER_TEST_SIZE_KEY`，显式传 `file: { size }` / `size`；E2E 的 `test_bdd_42/44` 经 API 核实 `files[].size` 后打开页面。BDD-43 回归守护沿用注入通道（它守护的正是既有阈值契约） |
| 约束 5：BDD-07/47 必须代码级 | `tpv0104-source-scan.test.ts` 用 `readFileSync` 扫源码，正则命中数断言（先例 `t080-admin-route-guard.test.ts:161-183`） |
| 约束 9：`skipped` 去重按 `file_id` | `test_bdd_38` 内 `ids = [item["file_id"] ...]; len(set(ids)) == len(ids)`，**不断言 `size` 数值**（W4） |
| 约束 10：pytest 取证走 BS4 | `_parse_report()` = `BeautifulSoup(...).find("script", {"id": REPORT_ID}).string` → `json.loads` |
| 约束 11：观测面 = `constructedRows`，且不得 `break` | BDD-35 三例 + BDD-36 三例 + BDD-37 两例构成联合约束（构造上界 / 计数精确 / 抛错契约） |
| 约束 12：六元闭集势 + 值 + 去重 | `test_bdd_38` 的 `assert requested - inlined == len(skipped)` + `reason in REASONS` + 按 `file_id` 去重 |
| G11：双向对账独立成例 | `test_g11_inlined_claims_match_actual_response_body`：`landed != reported_skip` |
| G12：两跳 `@import` | `test_g12_two_hop_import_chain_all_consumed`：`a→b→c` 断言 b、c 均不在 `skipped` |
| W1：不照抄 D7 样例数值 | pytest 的数字全部由实际 `_MAX_INJECT_IDS` 与素材重算（`n = _MAX_INJECT_IDS + 1`） |
| W6：`_process_css_refs` 是 8 处（非 5） | 新增预算用例**零改动**该函数调用；实测 `grep -c "_process_css_refs("` 仍 == 8 |
| B2a：13 处 `inject_resources` 调用零改动 | 预算用例全走 HTTP render 路由，不新增单元级 `= inject_resources(` 调用点；实测 `grep -c "= inject_resources("` 仍 == **13** |
| R2-1：h1 视觉校验须有反向断言 | 见 §3.3（UI 校验点 ⑦，P6 实跑项；本文件登记其判据来源，不在 P3 造 CSS 断言） |

### 3.2 逐条要点（区分力所在）

- **BDD-01/03/04**：素材分别为「三个 `## 中文标题`」/「Setext（`===`）」/「h1..h5 各一」。现状 id 集合大小 1（≠3）、Setext h1 无 id、TOC 3 条（≠4）→ 现状 FAIL。
- **BDD-02**：正反双向——`示例` 不在 TOC **且** `真实标题` 在 TOC（第二断言排除「TOC 整体为空」也通过）。
- **BDD-05**：`Then①` 现状即相等（前置），**区分力全在 `Then②`**：TOC 可见文本不得含 `**` / `[` / `](`，且去空白后与正文 `<h2>` 的 `textContent` 逐字相等。
- **BDD-07**：`/^#\{1,6\}\s+/` 在 `useEntryDetailComputed.ts` 的命中数必须 == 0（现状 1）。
- **BDD-08/12**：素材刻意让「构造首个」≠「期望值」——`AAA.txt`（`A`=65）排在 `README.md`（`R`=82）之前、`readme.md` 排在 `AAA.txt` 之后，现状兜底 `files[0]` 得错误答案。
- **BDD-11**：覆盖两种形态——`path='sub'`（P2 R10：落盘为根级文件 `sub`，basename 非 readme）与真嵌套 `path='sub/README.md'`（含 `/`）。
- **BDD-13**：素材 `[zzz.txt, aaa.txt, mmm.txt]`（构造序）vs `[aaa.txt, mmm.txt, zzz.txt]`（字典序），并**显式断言 POST 序 ≠ GET 序**（G3）。
- **BDD-16/17/18**：**成对对照**——同一测试内先验「有效 id 确实切换」（不成立即整条 FAIL），再验「无效 id 不切换」，排除「参数从未被读」也通过。
- **BDD-19 ③**：`history.length` 不增（`replace` 语义）；①（URL 同步）提供区分力。
- **BDD-23/31**：名称口径 = `aria-label` + 可见文本，**不含 `title`**（`DiagramBlock.vue:177` 的 `title="Fullscreen"` 会致假 PASS）；Given 钉「正文不含图表块」。
- **BDD-28/53③**：断言 `.file-sidebar` / `.toc-sidebar` 的 **DOM 计数 == 0**（现状「DOM 1 + 全局 CSS 隐藏」→ FAIL）。
- **BDD-32**：断言 `thead .th-sort-btn` 计数 0 **且** `thead input` 计数 0 **且** 表头文字仍可见（R12 双分支不塌陷）。
- **BDD-34**：文案须同时含 `5`（已显示）与 `11`（totalRows = 1 表头 + 10 数据行）。
- **BDD-35**：观测面 `constructedRows`——现状 `undefined`（`toBeLessThanOrEqual` 对 `undefined` 失败）；正向对照 3 数据行 → == 3 排除「恒 0」。**不得**用 `rows.length`。
- **BDD-38 ④**：代码级关系 `_MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1`（现状 `50 < 49` = False）+ 前提守卫 `assert declared == 50`。
- **BDD-40**：合取断言 + 三件素材（>768KB 二进制 / 含 `</script` 的 path / 非 css/js sibling）。
- **BDD-42**：素材 `chars < 2MB ∧ bytes >= 2MB`；**不注入假值**。
- **BDD-45**：落点 `docs/architecture/html-preview-security-modes.md`（现状不存在 → FAIL）。
- **BDD-50**：`firstFileId` 字面量在 3 个 legacy spec == 0（实测已归零，**当前已 PASS**）；`Then②`（失败集不劣于基线）由 P5 按 `known-failures.md` 逐 case 判定，P3 只锁 `Then①`。
- **BDD-51**：现状 `?firstFileId=15` 会选中 `service.yaml` 且 URL 旋即被清空 → 改后为默认入口 `README.md`。

### 3.3 UI 校验点 ⑦（R2-1，登记判据来源，P6 实跑）

P3 不在 vitest 层造 CSS 断言（P2-design.md 明确该项由 P6 在真实浏览器量 `getComputedStyle`）。本文件登记其判据，供 P6 直接执行：

- **正向（inactive）**：`h1Link.fontWeight !== '400'` 且 `h1Item.marginTop === '12px'` 且 `h1Link.rect.x === h2Link.rect.x`（缩进不变）。
- **反向（active）**：h1 条目被点亮后 `color` 等于 `--accent-color` 的解析值（`rgb(77, 141, 255)`）**且** `fontWeight !== '400'`（R16：`:not(.active)` 只挡颜色、不挡字重）。
- **为什么必须有反向**：R2-1 存在时正向三项全真 = 判据漏检（V18 实测）。

---

## 4. 红灯分布（P3 交付时刻的实测基线）

### 4.1 `P3` gate（`make test-frontend`，formatter `vitest.sh`）

```
Test Files  7 failed | 119 passed (126)
     Tests  31 failed | 1475 passed | 4 skipped (1510)
```

**7 个失败文件全部是本任务新增的 spec**（`tpv0104-*`），**零既有用例回归**。失败明细见 §1.1。

### 4.2 后端红灯证据（P2-design.md §5.1 的规定动作）

命令（**不得**加 `| tail`，管道会把非零 exit 变成 0）：

```bash
cd backend && .venv/bin/python -m pytest tests/test_html_render.py tests/test_entry_file_order.py -q --tb=line
```

**实测输出（改动前）**：`13 failed, 49 passed in 2.99s`，**exit 1**。
逐条失败项（全部为 **assertion failure**，实测 `grep -c AssertionError` = 22，**无 collection error、无 Traceback/ImportError**）：

```
FAILED tests/test_html_render.py::TestCountLimitSkipReport::test_bdd_38_exceeding_count_limit_produces_skip_report
FAILED tests/test_html_render.py::TestCountLimitSkipReport::test_bdd_38_inject_id_limit_below_default_entry_file_limit
FAILED tests/test_html_render.py::TestSingleFileTextLimit::test_bdd_39_oversized_text_sibling_skipped_and_undersized_inlined
FAILED tests/test_html_render.py::TestTotalBudgetFeedback::test_bdd_40_total_budget_overflow_is_machine_readable
FAILED tests/test_html_render.py::TestTotalBudgetFeedback::test_bdd_40_report_escapes_html_sensitive_paths
FAILED tests/test_html_render.py::TestTotalBudgetFeedback::test_bdd_40_non_injectable_sibling_is_recorded
FAILED tests/test_html_render.py::TestTotalBudgetFeedback::test_bdd_40_oversized_binary_sibling_recorded
FAILED tests/test_html_render.py::TestBidirectionalReconciliation::test_g11_inlined_claims_match_actual_response_body
FAILED tests/test_html_render.py::TestTwoHopImportChain::test_g12_two_hop_import_chain_all_consumed
FAILED tests/test_html_render.py::TestNoBudgetOverflowEquivalence::test_bdd_41_css_and_js_inlined_with_empty_skip_list
FAILED tests/test_entry_file_order.py::TestEntryFileOrderDeterminism::test_bdd_13_get_order_is_lexicographic_not_construction_order
FAILED tests/test_entry_file_order.py::TestEntryFileOrderDeterminism::test_bdd_13_order_matches_contract_sort_key
FAILED tests/test_entry_file_order.py::TestEntryFileOrderDeterminism::test_bdd_13_post_order_differs_from_get_order
```

失败原因（classic assertion，非「断言与数据矛盾」）：

| 用例 | 失败断言 | 根因（被测行为未实现） |
|---|---|---|
| `bdd_38_exceeding_count_limit` | `render 响应必须含可机器解析的注入报表块`（`assert None is not None`） | `#peekview-inject-report` 不存在 |
| `bdd_38_inject_id_limit_below_default` | `assert 50 < (50 - 1)` | `_MAX_INJECT_IDS` 仍 50，关系不成立 |
| `bdd_39_oversized_text_sibling` | `render 响应必须含可机器解析的注入报表块` | 同上（文本 sibling 零大小检查） |
| `bdd_40_*`（4 例） | 同上 / `assert None is not None` | 同上 |
| `g11_inlined_claims_match` | `render 响应必须含…` | 同上 |
| `g12_two_hop_import` | `render 响应必须含…` | 同上 |
| `bdd_41_css_and_js_inlined` | `render 响应必须含…` | 同上（回归项：改后须为空清单） |
| `bdd_13_*`（3 例） | `assert ['zzz.txt', ...] == ['aaa.txt', ...]` | `order_by` 未补，顺序仍为 rowid |

**13 条中 10 条因「报表块不存在」、2 条因「关系不成立」、1 条因「顺序未排序」** —— 均为被测模块缺行为所致，符合 classic red-light。

> **两步取证的说明（N5）**：`test_entry_file_order.py` 是**新建**文件，P3 交付时它已存在（含红灯用例），故无 collection error 掩盖问题；实测 4 例中 1 例通过（`two_consecutive_gets_same_order`——两次请求顺序当然相同）属预期，它守护的是「确定性」而非「字典序」。

### 4.3 当前已 PASS 的用例（回归守护 / 约束型，**P4 不得踩坏**）

| BDD | 已 PASS | 说明 |
|---|---|---|
| 02 | `test_bdd_02_fenced_heading_excluded_real_heading_kept`（vitest） | token 流天然不含围栏内 heading（V4），vitest 侧已绿；**E2E 侧现状红**（正文 DOM） |
| 33 | 3 例全绿 | 未超限时控件已存在且生效 |
| 36 | `total_rows_exact_when_truncated` / `_not_truncated` 绿 | `slice` 已保证长度；`empty_input` 因 `constructedRows` 未实现而红 |
| 37 | 2 例全绿 | 现状扫完全文才 throw |
| 43 | 3 例全绿 | 既有左闭右开契约 |
| 50 | 2 例全绿 | 迁移已完成（9 处归零） |
| 27/29/30/48/49 | E2E 侧**红**（页面行为未实现/待验） | 见 §1.1 的 E2E 用例 |

> 注：06、27、29、30、33、36、37、41、43、46、48、49 这 12 条在 P1 定性为「回归兼容 / 约束型 / 不变守护」——它们的 vitest/pytest 面当前全绿或部分绿是**预期**，红灯量集中在新增行为上。E2E 面的 06/27/29/30/48/49 在当前实现下另受 `pendingSelectors`（如 `[data-testid="detail-fullscreen-btn"]` 未实现）影响，P4 落地后转绿。

---

## 5. 环境隔离与清理钩子（P3 卡强制）

### 5.1 创建型用例的清理钩子

`tpv0104-viewer-hardening.spec.ts` 里凡造 entry 的用例（BDD-01~05、06、08~12、17、22、42、44、49）一律按下列契约：

- **创建即注册**：`trackCreate()` 把返回的 `slug` push 进模块级 `createdSlugs` 队列；BDD-22/49 因需私有 entry + 分享 token 而直接 `request.post`，同样 `createdSlugs.push(entry.slug)`。
- **测试结束无条件删除**：`test.afterEach(async ({ request }) => { await swampCleanup(request) })`，`while` 循环清空队列。
- **删除接受 200/204/404**：`await request.delete(...).catch(() => undefined)` —— **不因响应非 2xx 中止删除**。
- **DELETE 用 slug 不用 id**；匿名造的 entry（`owner_id=null`）在本环境可被匿名 DELETE 删除（同一匿名身份）。

**残留兜底**：P6 阶段按 `anon total == 15` 复查（`GET /api/v1/entries` 的 total）。

### 5.2 读取型用例（不造件）

BDD-14/15/18/19/20/21/23/24/25/26/27/28/29/30/31/48/51/52/53/54 与 `tpv0104-mobile-bar-widths.spec.ts` 全部只读 seed（`k8s-deployment` 13/14/15、`unicode-filenames` 31/34、`dsh-architecture` 4、`multi-format-demo`），**不造件、零清理负担**。

### 5.3 环境隔离实测

| 项 | 值 |
|---|---|
| debug backend | `http://127.0.0.1:8888` → `GET /api/v1/entries?per_page=1` = **200** |
| 生产 backend | `http://127.0.0.1:8080/` → **000（不可达）** |
| 数据目录 | `/tmp/peekview-debug/`（debug），pytest 用 `mkdtemp()` 临时 app |
| `~/.peekview/` | 未触碰（P3 全程只读源码 + HTTP + pytest 临时 app） |
| 临时产物 | `<项目根>/.agate-tmp/`（**未用 `/tmp`** 作为自建临时目录；见 §6 的平台假设扫描） |
| CLI 写命令 | 未跑（造/删 entry 只经 HTTP API） |
| commit | 未 commit |

---

## 6. 交付前自查（角色文件要求）

| # | 自查项 | 结果 |
|---|---|---|
| 1 | `check-tdd-red.py $TASK_DIR` | **`TDD_CHECK: classic red-light (assertion failures only)`，exit 0** ✅ |
| 1b | `make typecheck`（P5_typecheck，CI 强制） | **exit 0** ✅ —— 新增的 vitest 文件不引入类型错误：`constructedRows` 的类型放宽用 `constructedRowsOf()` 局部处理，「该字段必须是必填成员」由 `test_bdd_35_constructed_rows_declared_in_type` 代码级锁死 |
| 2 | 平台假设扫描 `check-platform-assumptions.py` | `backend/tests/test_html_render.py` → **0 命中**；`backend/tests/test_entry_file_order.py` → **0 命中** ✅（TS/JS 不在扫描面，见 P3 卡 §推进条件对 DEBT0048 的已知缺口声明） |
| 3 | 测试自跑：红灯原因均为「被测模块未实现」 | ✅ 逐条见 §4.2 / §4.1；**无一条**因「断言与测试数据矛盾」而红（曾发现并修正 2 处：BDD-33 排序素材改为倒序、BDD-43 改用既有注入通道） |
| 4 | 写入隔离 | ✅ 只写 `frontend-v3/src/**/__tests__`、`frontend-v3/src/__tests__`、`frontend-v3/e2e`、`backend/tests`；未写 `gate-events.jsonl` 等已提交账本 |
| 5 | 创建型测试有清理钩子 | ✅ 见 §5.1（创建即注册 / 无条件删除 / 200-204-404 均视为已清理） |
| 6 | 冻结项零改动 | ✅ `grep -c "= inject_resources("` == **13**；`grep -c "_process_css_refs("` == **8**；六元 `REASONS` 未增删；预算数值 `40/2MiB/8MiB` 未在测试中硬编码（全部读常量或按 `_MAX_INJECT_IDS` 推算） |
| 7 | BDD 语义未改 | ✅ 54 条 Given/When/Then 一字未动；仅落实判据 |
| 8 | P2 锁定决策未改 | ✅ 锚点单点 / `constructedRows` / resolver 单点 / `resolveFileSize` / `/f` 改 `v-if` / 删键清理 / 预算数值 / 六元闭集 + 七处埋点 / `file_id` 必填 —— 测试全部按此写断言 |

---

## 7. 双 viewport 与证据

`ui_affected: true` → 截图文件名固定，存 `agate-workspace/tasks/TPV0104-viewer-correctness-hardening/evidences/`：

| 文件 | 产出用例 |
|---|---|
| `desktop_1280x800.png` | `test_bdd_01_duplicate_headings_get_distinct_ids`、`test_bdd_53_fullscreen_is_pure_content` |
| `desktop_1280x800_fullscreen_entry.png` | `test_bdd_23_desktop_fullscreen_entry_discoverable_in_actions_area` |
| `mobile_390x844.png` | `test_bdd_24_mobile_entry_in_bottom_bar_without_obscuring_content`、`tpv0104-mobile-bar-widths.spec.ts` 的 390 档 |

**截图互不相同**（角色文件质量门槛）：三张对应三个不同的交付态（普通桌面 / 桌面全屏入口特写 / 移动底栏），非重复截图。**另需 360px 档**的守护性断言由 `tpv0104-mobile-bar-widths.spec.ts` 独立承担（`P5_e2e_mobile_widths`），不新增 BDD。

---

## 8. 转交 P4 的注意事项

1. **不得为了变绿删改断言**。凡红灯项都是 P1 的判据；若认为某条判据不可实现，**回 P3 报告**而不是降低判据。
2. **`test_bdd_13_post_order_differs_from_get_order` 是契约守护**：POST 返回构造序、GET 返回契约序。不要为了「统一」把 `order_by` 也加到 POST 响应构造上（会打破该断言并掩盖真实契约）。
3. **`test_bdd_38_inject_id_limit_below_default` 的前提守卫**（`assert declared == 50`）在 `max_entry_files` 默认值变更时会失败并给出明确信息——那是**要重核 `_MAX_INJECT_IDS`**，不是改断言。
4. **BDD-41 的回归项**在 P4 后会变成「`skipped: []`」——若实现选择「无跳过时省略报表块」，注意该用例读的是 `_parse_report()`（硬要求块存在）。**P2-design.md D7 未豁免该情形**，故实现须始终输出报表块（`skipped` 为空数组）。
5. **`ensureTocExpanded()` 的第三个分支（`null`）** 是「该视口不适用」而非「已展开」；移动端 TOC 走抽屉、与 `.toc-sidebar` 不同 v-if 链——不要把 TOC 类断言挪到移动端。
6. **`tpv0104-mobile-bar-widths.spec.ts` 的 3×3 矩阵**是最坏形态（含 wrap 按钮的多文件 entry）；若某 entry 在 seed 中消失会直接 FAIL，需同步维护素材清单。
