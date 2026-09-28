---
phase: P5
task_id: TPV0099
type: e2e-results
parent: P4-implementation.md
trace_id: TPV0099-P5-20260929
status: done
agent: verifier
ui_affected: true
---

# P5 E2E 实跑结果 — TPV0099（全屏模式链接 `/{slug}/f`）

> UI 任务必需产出。全部为本次（2026-09-29 00:32–00:43）**实跑**输出，非转录。
> 命令**原样执行** `gate_commands` 的 `P5_e2e` / `P5_e2e_auth`，档 900s，均带 `E2E_SPEC=`。

---

## 1. 跑前前置（陷阱 1 规避）

| 步骤 | 结果 |
|---|---|
| `curl :8888/health` | **200** |
| `find frontend-v3/src -type f -newer backend/peekview/static/index.html` | **0 行**（新鲜） |
| `make build-frontend-fast`（档 600s，为确保 Check 6 通过仍重建） | **exit 0**，`✓ built in 12.65s` / `✓ 388 static files` / `✓ Frontend built and copied` |
| 重建后新鲜度复查 | **0 行** |

→ `scripts/e2e-safety-check.sh` Check 6 满足，两次 `make debug-test` 均**未**触发 `✗ FATAL: frontend 源码比 static 产物新`。

---

## 2. `P5_e2e` — `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test`

```
[1/32]  [chromium]      › test_bdd_1_fullscreen_link_enters_content_only_view
[2/32]  [Mobile Chrome] › test_bdd_1_fullscreen_link_enters_content_only_view
[3/32]  [Mobile Chrome] › test_bdd_2_content_area_fills_viewport
...
[32/32] [Mobile Chrome] › TPV0099 Mobile 390x844 › test_bdd_14_mobile_fullscreen_no_chrome_and_fills_viewport
  32 passed (13.7s)

=== ✓ 所有 E2E 测试通过 ===
```

- **exit code = 0**
- **32 passed / 0 failed**（16 用例 × 2 project：`chromium` 1280×800 + `Mobile Chrome` 390×844）
- 该 spec 的 16 个用例（runner 逐条列出，证明加载的是目标 spec 而非缺省 `e2e/debug-server.spec.ts`）：
  `test_bdd_1_fullscreen_link_enters_content_only_view`、`test_bdd_2_content_area_fills_viewport`、`test_bdd_3_no_full_width_top_bar`、`test_bdd_4_f_key_does_not_change_view`、`test_bdd_5_escape_does_not_change_view`、`test_bdd_6_no_exit_route_announced`、`test_bdd_7_locked_mode_does_not_swallow_embedded_escape`、`test_bdd_8_file_switch_keeps_fullscreen`、`test_bdd_11_plain_slug_page_unchanged`、`test_bdd_12_existing_f_key_zen_unchanged`、`test_bdd_13_existing_slug_fullscreen_not_route_notfound`、`test_bdd_16_seeded_fullscreen_link_has_content`、`test_bdd_17_standalone_svg_renders_in_fullscreen`、`test_bdd_18_nonexistent_slug_fullscreen_not_route_notfound`、`test_bdd_19_mid_path_segment_not_matching_entry`、`test_bdd_14_mobile_fullscreen_no_chrome_and_fills_viewport`
- BDD 覆盖（P2 §6.1 映射）：**BDD-1,2,3,4,5,6,7,8,11,12,13,14,16,17,18,19**

> **重复性**：该 spec 本次共跑 **2 次**（00:34 与 00:42，第二次为重建 BDD-16 截图产物），**两次均 `32 passed` / exit 0** → 非偶然绿。

---

## 3. `P5_e2e_auth` — `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test`

```
[1/6] [chromium]      › TPV0099 Auth 1280x800 › test_bdd_9_toc_hidden_and_anchor_scroll_works
[2/6] [chromium]      › TPV0099 Auth 1280x800 › BDD-10 私有 entry + share token › test_bdd_10_private_entry_share_token_fullscreen
[3/6] [Mobile Chrome] › TPV0099 Auth 1280x800 › test_bdd_9_toc_hidden_and_anchor_scroll_works
[4/6] [Mobile Chrome] › TPV0099 Auth 1280x800 › BDD-10 私有 entry + share token › test_bdd_10_private_entry_share_token_fullscreen
[5/6] [Mobile Chrome] › TPV0099 Auth 1280x800 › test_bdd_15_mermaid_renders_and_builtin_viewer_works
[6/6] [chromium]      › TPV0099 Auth 1280x800 › test_bdd_15_mermaid_renders_and_builtin_viewer_works
  6 passed (8.2s)

=== ✓ 所有 E2E 测试通过 ===
```

- **exit code = 0**
- **6 passed / 0 failed**（3 用例 × 2 project）
- BDD 覆盖：**BDD-9, 10, 15**

### 3.1 与 P4 文档记录的差异（**P4 文档已陈旧，非实现缺陷**）

`P4-implementation.md` §4.2 记录本 spec 为 **4 failed / 2 passed**，并在 §8 登记两条 `[DESIGN_GAP]`。本次 P5 实测 **6 passed / 0 failed** —— 两条 DESIGN_GAP 的所指断言**已在 committed spec（`f1cfd5c3`）中修正**，独立核验如下：

| P4 DESIGN_GAP | P4 文档所述红灯点 | 本次 spec 实际代码 | 结论 |
|---|---|---|---|
| #1 BDD-9 pathname | `:151` 期望 `/markdown-test`，实收 `/markdown-test/f` | `:151` → `.toBe(\`/${SLUG_MD}/f\`)`（含注释「须保持在 /f 全屏视图」） | ✅ 已修正，断言绿 |
| #2 BDD-10 匿名基线 | `:288` 期望 404 实收 200（共享 `request` context 被登录 cookie 污染） | `:313` `const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })`；`:318`/`:319` 匿名无/伪 token → 404；`:322` `finally { await anonCtx.dispose() }` | ✅ 已修正为独立匿名 context，断言绿 |

→ **两条 DESIGN_GAP 在 P5 时点均已消解**（属 P3 产出修正，已随 P4 commit 落地）。建议主 Agent 据此写 P7 的 `[DESIGN_GAP_REVIEWED:]` 配对；`P4-implementation.md` §4.2/§4.5 的失败计数与「用例缺陷」定性**已过时**。

---

## 4. 截图证据

runner 尾部「测试截图:」为空 —— 因 `frontend-v3/playwright.config.ts:19` 设 `screenshot: 'only-on-failure'`，**全绿即无失败截图**（本身即「零失败」的旁证）。`/tmp/e2e-results/` 本次未生成文件（makerunner 的 `ls` 分支无输出）。

spec 自身的**主动截图**（BDD-16 人工体验路径，`tpv0099-fullscreen-link.spec.ts:549` `await page.screenshot({ path: 'test-results/tpv0099-bdd16-desktop_1280x800.png', fullPage: false })`）：

| 项 | 值 |
|---|---|
| 生成位置 | `frontend-v3/test-results/tpv0099-bdd16-desktop_1280x800.png` |
| **持久化副本（推荐引用）** | **`P5-test-results/evidence/tpv0099-bdd16-desktop_1280x800.png`** |
| 大小 | 445,918 bytes |
| 格式 | PNG image data, **3520 x 2200**, 8-bit/color RGB, non-interlaced |
| md5 | `9fe109450b1a46fda7793637706925dd`（持久化副本与生成位置**同 md5**，已核对） |
| 非空白量化检查 | 灰度 mean=240.9 / **stdev=36.43**（方差 **1327** ≫ 50 阈值）/ 224 个灰阶 → **非空白、有实质内容** |
| 生成时刻 | 2026-09-29 00:42（E2E #1 第二次跑） |
| git 状态 | `frontend-v3/test-results/` 被 `.gitignore:60` 忽略；持久化副本在任务目录内，可随 P5 产出提交 |

> ⚠️ **为什么必须持久化**：Playwright 在每次 run 启动时清空 `test-results/` —— 本次 E2E #2（auth spec）跑完后，E2E #1 生成的该 png **被删除**（首次 `cp` 失败即因此）。故已重跑 E2E #1 并在跑完**立即复制**到 `P5-test-results/evidence/`。后续若再跑任何 Playwright 命令，`frontend-v3/test-results/` 下该文件会再次消失，**请以 `evidence/` 副本为准**。

---

## 5. 清理与残留核查

| 项 | 结果 |
|---|---|
| E2E 自建 entry 残留 | E2E 后 alice 检索 `GET /api/v1/entries?limit=200` → `total_visible=20`，**`residual_hits=0`**（无 `tpv0099` / `e2e-` 前缀残留）→ `afterEach` 清理钩子（含 P4 修正的「登记服务端返回 slug」防 `-2` 后缀残留缺陷）有效 |
| 本次新增临时文件 | **0 个**（无需探针即全绿）；`git status --porcelain frontend-v3/` **输出为空** → 未污染 vitest 基线 |
| E2E 目标后端 | `:8888`（debug）；runner 第 30-31 行对「指向生产」有 FATAL 护栏 |
| 生产 `:8080` | `curl :8080/health` → **000 不可达**，全程未触碰 → **`[PROD_NOT_TOUCHED]`** |

---

## 6. 结论

- 两个 E2E 键**均已实跑且 `E2E_SPEC=` 定向**（陷阱 2 已规避；runner 逐条列出 16 + 3 个目标用例名可证）。
- **`P5_e2e` = 32 passed / 0 failed（exit 0）**；**`P5_e2e_auth` = 6 passed / 0 failed（exit 0）**。
- **无失败可定性**：既无真 bug，也无环境性失败，flaky 亦未触发。
- UI 层共 **19 条 BDD 全覆盖**（16 条匿名组 + 3 条登录组，与 P2 §6.1 映射一致）。
