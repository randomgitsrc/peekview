# P5 E2E 测试结果 — T090 移动端详情页 UX 打磨

## 执行方式

debug backend（127.0.0.1:8888）已在运行（`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/` → 200），未重新执行 `make debug-quick`。
直接执行：

```
cd frontend-v3 && BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/t090-mobile-detail-ux-polish.spec.ts --project=chromium --reporter=line
```

## 结果汇总

```
Running 12 tests using 6 workers
12 passed (7.0s)
```

命令 exit code: 0

## 逐条结果（12/12 PASS）

| # | 行号 | 分组 | test id | 结果 |
|---|------|------|---------|------|
| 1 | 84 | Mobile viewport (390x844) | test_bdd_1_markdown_mobile_scroll_no_jump | PASS |
| 2 | 112 | Mobile viewport (390x844) | test_bdd_2_code_mobile_scroll_no_jump | PASS |
| 3 | 139 | Mobile viewport (390x844) | test_bdd_3_meta_bar_visibility_position_driven_not_direction_driven | PASS |
| 4 | 180 | Mobile viewport (390x844) | test_bdd_4_bottom_bar_fixed_across_scroll_positions | PASS |
| 5 | 214 | Mobile viewport (390x844) | test_bdd_5_bottom_bar_not_occluded_two_viewport_heights | PASS |
| 6 | 240 | Mobile viewport (390x844) | test_bdd_6_bottom_bar_markdown_buttons_functional | PASS |
| 7 | 285 | Mobile viewport (390x844) | test_bdd_7_wrap_button_toggles_non_markdown_non_html | PASS |
| 8 | 305 | Mobile viewport (390x844) | test_bdd_8_markdown_mobile_margin_reduced_75_percent | PASS |
| 9 | 335 | Extra-small viewport (375x812) | test_bdd_9_375px_no_horizontal_overflow_no_text_clip | PASS |
| 10 | 359 | Desktop viewport (1280x800) | test_bdd_10_desktop_meta_bar_scroll_behavior_unchanged | PASS |
| 11 | 388 | Desktop viewport (1280x800) | test_bdd_11_desktop_markdown_padding_unchanged | PASS |
| 12 | 401 | Desktop viewport (1280x800) | test_bdd_12_desktop_no_mobile_bottom_bar | PASS |

全部 12 条 BDD 场景测试通过，覆盖：mobile (390x844) + extra-small (375x812) + desktop (1280x800) 三种视口，markdown + code 两种 viewer 类型，跳变检测、meta bar 显示机制、底部栏固定定位与遮挡检测、按钮功能性、markdown 边距缩减比例、桌面端行为不变性。

EXIT_CODE: 0
