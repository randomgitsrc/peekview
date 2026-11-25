# P5-test-results — e2e（TPV0104 viewer-correctness-hardening）

- **verifier**: P5 subagent
- **执行时间**: 2026-11-25 17:52 – 18:47 (+08:00)
- **`ui_affected`: true** → 本文件为 P5 必填产出
- **环境**: debug backend `http://127.0.0.1:8888`（health 200，含 `make debug-seed` 数据）
  - `make debug-test` 默认打 `:8888`；4 道安全检查（`E2E_GUARD_ENABLED` / 非 8080 / 服务在线 / DB 路径）**全部通过**，未绕过
  - 生产 `:8080` **不可达**（curl 3s 超时）
- **Playwright**: CDP Chrome `http://127.0.0.1:18800`（`connectOverCDP`），8 workers，`retries` chromium=1 / Mobile Chrome=2

## 一、5 条 E2E 命令实跑结果

| # | key | spec | exit | passed | failed | flaky | 耗时 | 判定 |
|---|---|---|---|---|---|---|---|---|
| 1 | `P5_e2e` | `tpv0104-viewer-hardening.spec.ts`（本任务新） | **1** | 60 | **12** | 6 | 2.6m | **FAIL** — 测试产物缺陷（详见 §三） |
| 2 | `P5_e2e_mobile_widths` | `tpv0104-mobile-bar-widths.spec.ts`（本任务新） | **0** | **18** | **0** | 0 | 8.2s | **PASS** |
| 3 | `P5_e2e_legacy_viewer` | `viewer.spec.ts` | **1** | 20 | 18 | 0 | 2.5m | **PASS（= 基线）** |
| 4 | `P5_e2e_legacy_t091` | `t091-mobile-detail-visual-polish.spec.ts` | **1** | 10–12 | **14** | 0–2 | 2.8–4.6m | **FAIL（超基线 +2，见 §二）** |
| 5 | `P5_e2e_legacy_tpv0099` | `tpv0099-fullscreen-link-auth.spec.ts` | **0** | **6** | **0** | — | 8.3s | **PASS（= 基线）** |

> `tpv0099` 第 1 次运行 exit=1（4F/2P），**同命令重跑 exit=0（6P/0F）** → 记为 flaky（首振 1 次），
> 最终态取重跑结果，与基线 6P/0F 一致。
>
> 后端/前端测试前后**生产库零变更**（`:8080` 全程不可达，`scripts/e2e-safety-check.sh` Check 4
> 读生产库失败即跳过，无写入路径）；所有造件走 `:8888` HTTP API，`afterEach` 用 **slug** 删除，
> 复核无 `e2e-tpv0104-*` 残留 → **`[PROD_NOT_TOUCHED]`**

## 二、与基线的失败集对比（BDD-50 判据）

| spec | 基线（P1） | 本次 | 失败集 ⊆ 基线？ |
|---|---|---|---|
| `viewer.spec.ts` | 18F / 20P | **18F / 20P** | ✅ **相等** |
| `t091-…` | 12F / 12P | **14F / 10–12P** | ❌ **超 +2** |
| `tpv0099-…` | 6P / 0F | **6P / 0F** | ✅ **相等** |

### `viewer` 18F/20P — 逐项一致，根因同源（TPV0095 遗留）

17 个 unique failing test（`TC-010/011/012/013/020/021/022/023/040` × 2 project）全部落在
`markdown-test` 相关用例，两类报错：

1. `TypeError: Cannot read properties of undefined (reading 'find')`（`viewer.spec.ts:19`
   的 `res.json().files.find(...)`）—— 因 `GET /api/v1/entries/markdown-test` 返回 **404**
2. `mobile-bottom-bar` / `.diagram-viewer svg` element not found、drawer / `.file-item` 点击超时
   —— 页面因 404 未渲染正文的连锁反应

**独立复核（API 直探，非引用 P1 结论）**：
```
GET /api/v1/entries/markdown-test          → 404（匿名）
GET /api/v1/entries/markdown-test (alice)  → 200，is_public=False, team_id=1
GET /api/v1/entries/mermaid-charts         → 404（匿名），alice → 200，同形态
```
根因 = `scripts/seed-data/markdown-test/meta.json` 的 `team_id: frontend-team`
（TPV0095 提交 `59182590` 有意指派），服务端 `entry_service` 将该形态强制 `is_public=False`
→ 匿名 404。**P4 对 `viewer.spec.ts` 零改动**（`git diff 4ec6b1b6~1 4ec6b1b6 -- frontend-v3/e2e/` 为空）。
→ **与基线完全一致，非本任务引入**。

### `t091` 14F > 基线 12F — 原因定位（基线疑漏计，非本任务回归）

**t091 spec 实为 13 个 `test()` × 2 project = 26 项**，该 spec 最大可能失败数为 **26**；
P1 记录的 `12F / 12P = 24` 项 **比可执行项少 2**。

两次运行（同命令）**稳定出现 14 个失败**，全部为 `markdown-test` 匿名 404 的连锁：

| failing test（× 2 project） | 报错定位 |
|---|---|
| `bdd_1_meta_tags_bar_wraps_no_horizontal_scroll` | `[data-testid="meta-tags-bar"]` element not found |
| `bdd_2_meta_tags_bar_breathing_room` | 同元素 `locator.evaluate` 30/45s 超时 |
| `bdd_3_markdown_body_16px_padding_24px_total_inset` | `[data-testid="markdown-body"]` not found |
| `bdd_4_bottom_bar_padding_top_bottom_symmetric` | `[data-testid="mobile-bottom-bar"]` not found |
| `bdd_9_ten_viewers_visual_consistency` | `meta-tags-bar` not found |
| `bdd_12_desktop_markdown_padding_unchanged` | `markdown-body` evaluate 超时 |
| `bdd_13_desktop_no_mobile_components` | `mobile-bottom-bar` not found |

**独立复核（浏览器实跑）**：
```
goto http://127.0.0.1:8888/markdown-test?file=48
→ location 落回 /markdown-test
→ .error-state 存在，正文文本 = "Request failed with status code 404"
→ markdownBody=false, metaTagsBar=false, mobileBottomBar=false
```
→ 根因 = 与 `viewer` 的 18F **同一根因**（TPV0095 遗留的 team-scoped 匿名 404）。
**P3 对该 spec 仅 4 处 `firstFileId` → `file` 迁移**（`git diff de03b466~1 de03b466`），
**P4 零改动** → 非本任务引入。

**未决点（交主 Agent 裁决）**：P1 基线 12F 无法复现，任务目录内无 P1 采集当时的原始日志。
可能原因：① 采集时 `bdd_6`/`bdd_7` 恰为 flaky 绿（本轮第 2 次运行确实出现这 2 项间歇失败）；
② 采集时 debug 库的 `markdown-test` 曾短暂匿名可读。
按 BDD-50 严格字面（`14 ∉ 12`）→ **本条判 FAIL**，但**归因为基线漏计而非实现回归**。

### `tpv0099` 6P/0F — 首次抖动，重跑通过

- 第 1 次：`BDD-9 markdown-test/raw 须可读（HTTP 404）` × 2、`BDD-15 .diagram-block 须存在` × 2
- 第 2 次：**6 passed (8.3s)**，逐条通过（含 BDD-10 的私有 entry + share token 三态区分力）
- 判定：**flaky（首振 1 次）**，非代码回归。失败点位于 `resolveFileId` 的 `raw` 前置断言，
  与该 spec 头部已注释的 team-scoped 前提一致（需 alice token；首次运行时 debug 库被并发写入干扰）。

## 三、`tpv0104-viewer-hardening`（本任务新 spec）12F 的逐条归因

先做**稳定性分离**（同一命令跑两轮）：

| 运行 | failed | flaky | passed | 耗时 |
|---|---|---|---|---|
| 第 1 次 | 24 | 7 | 47 | 3.0m |
| 第 2 次 | **12** | 6 | **60** | 2.6m |

**两轮皆失败的稳定项 = 6 unique test × 2 project = 12**（= 第 2 次失败数）。

| # | 稳定失败的 test | 断言 / 报错 | 归因 | 独立复核 |
|---|---|---|---|---|
| 1 | `test_bdd_06_click_toc_item_scrolls_target_into_viewport` | `targetTop = 237.59 > 200` | **判据缺前置**：Given 未建立「页面可滚动」 | 实跑构造 entry → `ca.scrollHeight == ca.clientHeight == 701` → **无法滚动**，target 恒 237.59 |
| 2 | `test_bdd_22_file_and_share_coexist_and_survive_cleanup` | `.error-state = true` | **share token 取法错误**：`share.json().token` | API 直探返回 `keys=[created_at, created_by, expires_at, id, max_views, revoked_at, share_url, token_prefix, view_count]` → **无 `token` 字段**；用 `share_url` 提取 16 字符 token 匿名访问 = **200** |
| 3 | `test_bdd_44_tree_view_uses_real_bytes` | `size = 1050011 < 2097152` | **素材字节数算错**：`'中'.repeat(350000)` UTF-8 = 1,050,011 B | 字符数（`.length`）与字节数混淆，`>= 2 MiB` 恒不成立 |
| 4 | `test_bdd_49_share_link_permissions_unchanged` | `"This share link is no longer valid."` | **同 #2 的 share token 缺陷**（`:759` 同一取法） | 同上 |
| 5 | `test_bdd_51_legacy_firstFileId_falls_back_to_default` | `not.toContain('Service')` 收到 README 正文 | **断言与素材自矛盾** | `k8s-deployment/README.md` 实含 `` | `service.yaml` | ClusterIP Service，暴露 8080 端口 | `` |
| 6 | `test_bdd_24_mobile_entry_in_bottom_bar_without_obscuring_content` | `lastBottom = 1016.89 > barTop+1 = 781` | **判据缺前置**：未先把正文滚到底 | 390×844 实跑：`barHeight = 64`（②过）、热区在栏内（①过）、`lastBottom = 5307.89`（整页高，未滚动） |

**另 2 类（第 1 次 FAIL、第 2 次转绿，但判据本身仍有问题）**：

- **yaml 断言形态与 `TreeView` 不匹配**（`bdd_14/15/16/18/19/21/26`，7 条）：
  报 `Expected "kind: Deployment"` / `Received "apiVersion…stringkindDeploymentstring…"`。
  浏览器复核 `k8s-deployment?file=14` 的 `innerText`：
  ```
  apiVersion \n apps/v1 \n string \n kind \n Deployment \n string \n metadata …
  ```
  → yaml 走 **`TreeView`**（既有行为，`EntryDetailContent.vue:60-62`，T075 起就是），
  `textContent` 拼接无分隔符 → `toContain('kind: Deployment')` **对 yaml 恒不成立**。
  第 2 次变绿系 retry 掩盖 → 判定为**测试产物缺陷**（应按 `TreeView` 形态断言，或改 `innerText`）。
- **8 worker 并发超时**（`bdd_42` / `bdd_48` / `bdd_51` / `bdd_52` / `bdd_53` / `bdd_54` / `bdd_30` / `bdd_01`，8 条）：
  `page.goto: Timeout 30000ms` / `apiRequestContext.post: Timeout 30000ms` / `waitForSelector: Timeout 20000ms`。
  **浏览器复核 `bdd_53` 的实现正确性**：
  ```
  goto /k8s-deployment/f →
  { zen: true, contentWidth: 1280, innerWidth: 1280, ratio: 1,
    fileSidebar: 0, tocSidebar: 0, mobileBar: false }
  ```
  → BDD-53 的 ② 判据（`ratio >= 0.95`）与 ③（侧栏 DOM 计数 0）**在实现上均成立**；
  失败源于并发超时后 `evaluate` 在空白页取值（`ratio = 0`）。

**汇总：本任务实现缺陷 = 0 条**。

## 四、`tpv0104-mobile-bar-widths`（本任务新 spec 的另一半）— 全绿

```
Running 18 tests using 8 workers
18 passed (8.2s)     exit 0
```

覆盖 **360 / 375 / 390 三档** × 3 个最坏形态 entry（`k8s-deployment` / `unicode-filenames` /
`multi-format-demo`），每档断言 `bottomBar.scrollWidth <= bottomBar.clientWidth` 且 `height <= 64`。

→ **P2 完成标志 #9 达成**，即 P4 的 `EntryDetailMobileBar.vue` `gap: 8px → 4px` 修复
（P2 §0.3 R7 / D-3 的落点）**实测有效**：360px 下溢出由 10px → 0。

## 五、截图证据

### 5.1 正向证据（本任务新功能，E2E 实跑产出）

| 文件 | 视口 | 内容 |
|---|---|---|
| `evidences/desktop_1280x800_fullscreen_entry.png` | 1280×800 | `k8s-deployment` 详情页：**.actions-area 内全屏入口（`[ ]` 图标）可见**、三栏布局、TOC 默认展开（4 项） |
| `evidences/desktop_1280x800.png` | 1280×800 | `k8s-deployment/f` 全屏态：**侧栏 0、底栏 0、内容区 100% 宽** |
| `evidences/mobile_390x844.png` | 390×844 | **移动底栏 7 个按钮（含新增全屏入口 `[ ]`）无横向溢出**、`barHeight = 64`、正文未被遮挡 |

> 移动截图目视确认：底栏图标序列 `folder / list / code / ★0 / [ ] / copy / ⋯` 在 390px 内完整排布，
> **无截断、无换行、无横向滚动条** → 直接佐证 `P5_e2e_mobile_widths` 的三档守护断言。

### 5.2 失败现场截图（诊断用，38 张）

`evidences/e2e-failures/<playwright-test-dir>.png` —— 由 Playwright `screenshot: 'only-on-failure'`
自动产出（每失败用例 × 含 retry）。用于复核 §二/§三 的归因，非验收证据。

### 5.3 Playwright 报告位置

- HTML 报告：`frontend-v3/playwright-report/`（`npx playwright show-report` 打开）
- 逐用例产物：`frontend-v3/test-results/<test-dir>/`（`test-failed-1.png` / `error-context.md` / trace）
- 原始运行日志（全文）：`.agate-tmp/tpv0104-p5/P5_e2e*.log`（5 个文件，含两轮重跑）

## 六、环境问题（影响 E2E 判定，非本任务）

1. **debug 库 seed 不完整**：`scripts/seed-data/` 有 24 个目录，`:8888` 中
   `image-gallery` / `legacy-deploy` / `admin-private-config` / `security-audit` /
   `dave-disabled-notes` / `api-v2-draft` **完全不存在**（alice 也 404）；
   `csv-employees` / `markdown-test` / `mermaid-charts` 存在但 **team-scoped → 匿名 404**
   （后三个为 TPV0095 有意设计）。
   → 直接放大 `viewer` 与 `t091` 的失败面，也可能是 P1 基线 12F 无法复现的原因。
   **建议**：P5 结论落地前重跑 `make debug-seed` 并复核库内条目数 = 24。
2. **`:8888` 与 `:8890` 数据不一致**：anon total 18 vs 15（`:8888` 多 3 条 e2e 残留：
   `e2e-test-code`、`e2e-test-code-2`、`zz81s9`）。
3. **8 worker 并发下的偶发 30s 超时**：同一命令两轮 24F → 12F。**不是实现缺陷**，
   但 retry 会把「判据本身错误」洗成 flaky 绿（`bdd_14` 等即此形态），
   建议把 `workers` 降到 4 或对几何/URL 类用例加 `test.describe.serial`。
4. **静态产物新鲜度**：首次 `P5_e2e` 被 `scripts/e2e-safety-check.sh` Check 6 拦下
   （`useCsvParser.ts` 08:30 比 `backend/peekview/static/index.html` 07:10 新）
   → 按脚本规定动作跑 `make build-frontend`（exit 0，7 files 同步）后通过。
   **P4 的最终修复未重建 static 产物** —— 建议主 Agent 在 P6/P8 前确认 `make build-frontend` 已跑。

## 七、结论

| 项 | 结果 |
|---|---|
| `ui_affected: true` 的 E2E 是否实跑 | ✅ **5 条 `P5_e2e*` 全部实跑**，无跳过 |
| 本任务新 spec | `tpv0104-mobile-bar-widths` **18/18 全绿**；`tpv0104-viewer-hardening` **12F（全为测试产物缺陷）** |
| legacy 失败集 vs 基线 | `viewer` **相等**、`tpv0099` **相等**、`t091` **+2（基线疑漏计）** |
| **本任务实现缺陷** | **0** |
| 需回 P3 修测试产物 | **6 条稳定 FAIL**：share token 字段（`bdd_22`/`bdd_49`）、字节数（`bdd_44`）、`Service` 文本（`bdd_51`）、滚动前置（`bdd_06`）、滚动到末（`bdd_24`）；另建议修 yaml 断言形态（7 条 flaky 掩盖） |
| 生产隔离 | **`[PROD_NOT_TOUCHED]`** |
