---
phase: P6
task_id: TPV0104
type: acceptance
parent: P5-verification.md
trace_id: TPV0104-P6-20261125
status: draft
created: 2026-11-25
agent: verifier
# ── v2.0 机器汇总（系统字段，由 results 现算） ──
pass: 54
fail: 0
ui_affected: true
prod_touched: false
p5_evidence_reuse: false   # 本任务不声明复用：P6 独立实跑全部 54 条（含全量套件与 E2E）
# ── TAG0050 批 D 结构化验收结果（bdd 集合 == P1 的 #### BDD-NN: 集合） ──
results:
  - {bdd: '01', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b01-duplicate-heading-ids.png'], vision: 'vision-reports/b01.yaml'}
  - {bdd: '02', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b02-fenced-heading-excluded.png'], vision: 'vision-reports/b02.yaml'}
  - {bdd: '03', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b03-setext-h1-anchor.png'], vision: 'vision-reports/b03.yaml'}
  - {bdd: '04', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b04-toc-levels-h1-h4.png'], vision: 'vision-reports/b04.yaml'}
  - {bdd: '05', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b05-toc-text-stripped.png'], vision: 'vision-reports/b05.yaml'}
  - {bdd: '06', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b06b-toc-click-scroll-natural.png', 'screenshots/b06-toc-click-scroll.png'], vision: 'vision-reports/b06b.yaml'}
  - {bdd: '07', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/code-level-checks.log']}
  - {bdd: '08', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b08-readme-priority.png'], vision: 'vision-reports/b08.yaml'}
  - {bdd: '09', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b09-index-priority.png'], vision: 'vision-reports/b09.yaml'}
  - {bdd: '10', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b10-sorted-first-fallback.png'], vision: 'vision-reports/b10.yaml'}
  - {bdd: '11', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b11-subdir-readme-not-selected.png'], vision: 'vision-reports/b11.yaml'}
  - {bdd: '12', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b12-readme-case-insensitive.png'], vision: 'vision-reports/b12.yaml'}
  - {bdd: '13', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd13-live-http.log']}
  - {bdd: '14', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b14-file-deeplink.png'], vision: 'vision-reports/b14.yaml'}
  - {bdd: '15', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b15-fullscreen-with-file.png'], vision: 'vision-reports/b15.yaml'}
  - {bdd: '16', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '17', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '18', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '19', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '20', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '21', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '22', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b22-share-and-file-coexist.png'], vision: 'vision-reports/b22.yaml'}
  - {bdd: '23', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b23-desktop-fullscreen-entry.png'], vision: 'vision-reports/b23.yaml'}
  - {bdd: '24', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b24d-mobile-bar-content-boundary.png', 'screenshots/b24-mobile-bottom-bar.png', 'screenshots/b24b-mobile-bottom-bar-top.png', 'screenshots/b24c-mobile-bar-notes-section.png'], vision: 'vision-reports/b24d.yaml'}
  - {bdd: '25', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '26', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '27', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '28', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '29', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '30', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '31', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '32', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '33', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '34', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '35', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '36', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '37', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '38', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd38-41-live-http-fix2.log', 'logs/bdd38-code-relation.log']}
  - {bdd: '39', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd39-40-live-http.log']}
  - {bdd: '40', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd39-40-live-http.log']}
  - {bdd: '41', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd38-41-live-http.log', 'logs/full-suites.log']}
  - {bdd: '42', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b42-big-chinese-html.png'], vision: 'vision-reports/b42.yaml'}
  - {bdd: '43', verdict: PASS, evidence: ['logs/vitest-tpv0104.log']}
  - {bdd: '44', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b44b-small-json-tree-control.png', 'screenshots/b44-treeview-real-bytes.png'], vision: 'vision-reports/b44b.yaml'}
  - {bdd: '45', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/code-level-checks.log']}
  - {bdd: '46', verdict: PASS, evidence: ['logs/pytest-tpv0104.log', 'logs/bdd46-csp-check.log']}
  - {bdd: '47', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/code-level-checks.log']}
  - {bdd: '48', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b48-single-file-unchanged.png'], vision: 'vision-reports/b48.yaml'}
  - {bdd: '49', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '50', verdict: PASS, evidence: ['logs/vitest-tpv0104.log', 'logs/e2e-legacy-three.log']}
  - {bdd: '51', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'ui-assertions.json']}
  - {bdd: '52', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b52-seed-manual-experience.png'], vision: 'vision-reports/b52.yaml'}
  - {bdd: '53', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b53-fullscreen-pure-content.png', 'logs/vision-results.log'], vision: 'vision-reports/b53.yaml'}
  - {bdd: '54', verdict: PASS, evidence: ['logs/e2e-viewer-hardening.log', 'logs/ui-run.log', 'screenshots/b54-fullscreen-link-switch.png'], vision: 'vision-reports/b54.yaml'}
---
# P6-acceptance — TPV0104 Viewer 正确性与资源边界加固

> 验收依据：`P1-requirements.md`（54 条 BDD，approved）。每条**只判 PASS 或 FAIL**，无中间态。
> 判定纪律：先跑验证命令 → 看客观输出 → 再写结论 → 引证据路径。**本文件记录验收当时的事实**，
> 不含任何「修复后 PASS」的表述（本任务验收期间未改实现代码与测试）。

**Summary**: 54 条 BDD 全部 PASS，0 FAIL。其中 12 条为 P1 显式标注的回归兼容/约束型/不变守护项。

## 1. 验收范围与环境

| 项 | 值 |
|---|---|
| 验收对象 | git HEAD `e11208ad`（P5 已提交，验收期间工作树仅本任务产出文件变动） |
| debug backend | `http://127.0.0.1:8888`（在线，跑 P4 后新代码）；`:8890` 亦在线 |
| 生产 backend | `http://127.0.0.1:8080` → **000 不可达**，全程零接触 |
| `~/.peekview/` | mtime 仍 `2026-11-12 12:40`，**零写入** |
| 浏览器 | headless Chromium（Playwright）；E2E 另经 `make debug-test` 走 CDP Chrome :18800 |
| 造件方式 | 仅 debug HTTP API（`POST /api/v1/entries`），**禁 CLI**；用完按 **slug** DELETE 并复核 404 |
| 视觉分析 | vision-engine，`--model volcengine/doubao-seed-2-0-lite-260428` 钉定模型 |
| 临时文件 | 项目根 `.agate-tmp/tpv0104-p6/`（未用 `/tmp`） |
| 提交 | **未 commit**（按派发约束） |

**`[PROD_NOT_TOUCHED]`** —— 全程只用 `:8888`/`:8890`；`:8080` 实测 000 不可达；`~/.peekview/` 零写入；
造件全部经 debug HTTP API 并在同一验收轮内删除；未跑任何写生产数据的命令。

### 1.1 证据层级分布

| 层 | 命令 | 结果 | 证据 |
|---|---|---|---|
| vitest（本任务 7 个 spec） | `vitest run src/**/tpv0104-*` | exit 0，**7 files / 50 tests 全通过** | `logs/vitest-tpv0104.log` |
| pytest（render 预算 + 文件顺序） | `pytest tests/test_html_render.py tests/test_entry_file_order.py` | exit 0，**62 passed** | `logs/pytest-tpv0104.log` |
| E2E（本任务主 spec） | `E2E_SPEC=e2e/tpv0104-viewer-hardening.spec.ts make debug-test` | exit 0，**70 passed / 8 flaky / 0 failed**，输出「✓ 所有 E2E 测试通过」 | `logs/e2e-viewer-hardening.log` |
| 浏览器逐 BDD 取证 | 自建 Playwright 脚本（37 条 UI 类逐条 execution） | **37/37 PASS** | `logs/ui-run.log`、`ui-assertions.json` |
| 后端全量 | `make test-quick` | 1221P / **1F（预存）** / 3S | `logs/full-suites.log` |
| 前端全量 | `make test-frontend` | exit 0，**127 files / 1514P / 4S / 0F** | `logs/full-suites.log` |
| 代码级/文档级 | 源码 grep 断言 | 全部满足 | `logs/code-level-checks.log` |

## 2. 预存失败豁免口径（RM-AG0106）

「全绿」类判据的 PASS 基准是「**本次任务引入的失败 = 0**」，不是「全量 0 失败」。
豁免来源 `known-failures.md` 已登记 **3 条**，逐条对应本任务 P6 实测：

| # | 登记项 | 本任务 P6 实测 | 是否本次引入 |
|---|---|---|---|
| 1 | `test_cli_remote::TestCLIRemoteConfig::test_config_set_remote_api_key`（沙箱 `~/.peekview/` 只读，`Errno 30`） | `logs/full-suites.log`：`1 failed, 1221 passed, 3 skipped`，唯一失败即本项 | **否**（环境只读，非代码） |
| 2 | `viewer.spec.ts` 18 failed（`markdown-test` 团队归属 → 匿名 404，TPV0095 遗留） | `logs/e2e-legacy-three.log`：**18 failed / 20 passed**，与登记基线逐项一致 | **否** |
| 3 | `t091-mobile-detail-visual-polish.spec.ts` 14 failed（同源） | `logs/e2e-legacy-three.log`：**14 failed / 12 passed** | **否**（同源；失败项全部指向 `markdown-test` 匿名 404） |

**未登记的失败 → 视为本次引入**。本次 3 条实测失败**全部**在豁免集内，且失败集与基线**逐项相等**，
新引入失败 = 0。`tpv0099-fullscreen-link-auth.spec.ts` 实测 **6 passed / exit 0**（与基线一致，另有 flaky 记录见其日志）。

## 3. 逐条结果

### 3.1 V-02 Markdown 标题与目录单一来源

- PASS BDD-01: 重复同名标题在正文侧获得互不相同的锚点 ID（三个 `## 中文标题`） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b01-duplicate-heading-ids.png) (vision: vision-reports/b01.yaml)
- PASS BDD-02: 代码围栏内的标题不进入目录（正反双向：示例不在、真实标题在） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b02-fenced-heading-excluded.png) (vision: vision-reports/b02.yaml)
- PASS BDD-03: Setext 标题在正文与目录两侧都生成锚点 (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b03-setext-h1-anchor.png) (vision: vision-reports/b03.yaml)
- PASS BDD-04: 目录层级覆盖 h1–h4 且排除 h5（条目数 == 4，层级 1/2/3/4） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b04-toc-levels-h1-h4.png) (vision: vision-reports/b04.yaml)
- PASS BDD-05: 标题含内联强调与链接时，TOC 可见文本已剥离标记且与正文一致 (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b05-toc-text-stripped.png) (vision: vision-reports/b05.yaml)
- PASS BDD-06: 回归兼容：点击目录条目后目标标题进入视口（2s 内 top ∈ [0,200]） (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b06b-toc-click-scroll-natural.png, screenshots/b06-toc-click-scroll.png) (vision: vision-reports/b06b.yaml)
- PASS BDD-07: 目录数据源单点，不存在第二套逐行正则扫描（代码级） (logs/vitest-tpv0104.log, logs/code-level-checks.log)

### 3.2 V-01 默认入口 resolver

- PASS BDD-08: 根目录 README.md 优先于排序更靠前的其他文件（AAA.txt） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b08-readme-priority.png) (vision: vision-reports/b08.yaml)
- PASS BDD-09: 无 README 时根目录 index.md 优先（排序首个为 aaa.md） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b09-index-priority.png) (vision: vision-reports/b09.yaml)
- PASS BDD-10: README 与 index 均无时回落到稳定排序后的第一个文件（非构造首个） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b10-sorted-first-fallback.png) (vision: vision-reports/b10.yaml)
- PASS BDD-11: 只匹配根目录，子目录的 README.md 不被选中 (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b11-subdir-readme-not-selected.png) (vision: vision-reports/b11.yaml)
- PASS BDD-12: 默认入口文件名匹配大小写不敏感（readme.md 全小写） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b12-readme-case-insensitive.png) (vision: vision-reports/b12.yaml)
- PASS BDD-13: 后端文件列表顺序具有确定性契约（构造序 ≠ 字典序；同键按 id 升序） (logs/pytest-tpv0104.log, logs/bdd13-live-http.log)

### 3.3 `?file=` 深链与 URL 状态一致性

- PASS BDD-14: `?file=` 打开指定文件且该参数在加载后仍保留在 URL (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b14-file-deeplink.png) (vision: vision-reports/b14.yaml)
- PASS BDD-15: `/f?file=` 同时进入全屏并打开指定文件 (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b15-fullscreen-with-file.png) (vision: vision-reports/b15.yaml)
- PASS BDD-16: 不存在的 file id 安全回退默认入口（成对对照：有效 id 确实切换） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-17: 其他 entry 的 file id 被拒绝并回退，不跨 entry 读取（成对对照） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-18: 非数字 file 参数安全回退默认入口（成对对照） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-19: 页内切换文件后 URL 同步更新且不新增历史记录 (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-20: 切回默认文件后 `file` 参数被移除 (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-21: 刷新后仍打开 URL 指定的文件（持续态语义） (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-22: `file` 与 `share` 共存时各自生效，清理不误删 (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b22-share-and-file-coexist.png) (vision: vision-reports/b22.yaml)

### 3.4 全屏阅读入口

- PASS BDD-23: 桌面普通态存在可发现的「全屏阅读」入口且位于 `.actions-area` (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b23-desktop-fullscreen-entry.png) (vision: vision-reports/b23.yaml)
- PASS BDD-24: 移动端入口在底部操作栏内且不遮挡正文（栏高 ≤64px） (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b24d-mobile-bar-content-boundary.png, screenshots/b24-mobile-bottom-bar.png, screenshots/b24b-mobile-bottom-bar-top.png, screenshots/b24c-mobile-bar-notes-section.png) (vision: vision-reports/b24d.yaml)
- PASS BDD-25: 当前为默认文件时点击全屏入口进入 `/{slug}/f`（不带 file 参数） (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-26: 当前为非默认文件时点击全屏入口进入 `/{slug}/f?file=<当前 id>` (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-27: 回归兼容：手动追加 `/f` 直接进入全屏并展示默认文件 (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-28: 全屏态不展示文件树（`.file-sidebar` DOM 计数 == 0） (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-29: 约束型：全屏态不引入退出入口，`f`/`Escape` 不改变视图 (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-30: 回归兼容：普通态按 `f` 仅切换纯前端 zen，不改 URL (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-31: 文件树内每个文件条目无独立全屏按钮，全页名称匹配计数 == 1 (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)

### 3.5 V-04 截断态表头控件

- PASS BDD-32: 数据超 maxRows 时表头不渲染排序按钮与过滤输入框 (logs/vitest-tpv0104.log)
- PASS BDD-33: 回归兼容：数据未超限时排序与过滤控件存在且生效 (logs/vitest-tpv0104.log)
- PASS BDD-34: 截断提示可见且行数为实际总行数（含已显示 5 与总计 11） (logs/vitest-tpv0104.log)

### 3.6 V-03 CSV 解析成本

- PASS BDD-35: 解析达到行数上限后不再构造数据行数组（observed constructedRows ≤ maxRows） (logs/vitest-tpv0104.log)
- PASS BDD-36: 回归兼容：截断时 totalRows 仍为精确总行数（1001） (logs/vitest-tpv0104.log)
- PASS BDD-37: 回归兼容：超限且引号未闭合时仍抛出解析错误 (logs/vitest-tpv0104.log)

### 3.7 V-06/V-07 注入预算与显式反馈

- PASS BDD-38: 超过数量上限的文件进入「被跳过清单」而非静默丢弃（含代码级关系断言；**Then③「每项可对应到具体文件名」经 P6.5 judge 退回后于 P4 重试 #2 修复并重验**） (logs/pytest-tpv0104.log, logs/bdd38-41-live-http-fix2.log, logs/bdd38-code-relation.log)
- PASS BDD-39: 新增单文件文本注入上限，超限文本 sibling 被跳过并记录（正反双向） (logs/pytest-tpv0104.log, logs/bdd39-40-live-http.log)
- PASS BDD-40: sibling 累计大小超总预算时必须有可机器解析的反馈（合取断言） (logs/pytest-tpv0104.log, logs/bdd39-40-live-http.log)
- PASS BDD-41: 回归兼容：未超任何预算时注入行为与现状等价（test_html_render.py 注入类用例全绿） (logs/pytest-tpv0104.log, logs/bdd38-41-live-http.log, logs/full-suites.log)

### 3.8 V-08 真实字节数判断

- PASS BDD-42: 大 HTML 按后端真实 `file.size`（字节）判定，而非 JS 字符数（中文素材） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b42-big-chinese-html.png) (vision: vision-reports/b42.yaml)
- PASS BDD-43: 回归兼容：512KB 与 2MB 的左闭右开边界语义不变 (logs/vitest-tpv0104.log)
- PASS BDD-44: TreeView 的截断判断同样改用真实字节数（正反两向） (logs/vitest-tpv0104.log, logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b44b-small-json-tree-control.png, screenshots/b44-treeview-real-bytes.png) (vision: vision-reports/b44b.yaml)

### 3.9 V-05 安全边界（只记录策略，不改 CSP）

- PASS BDD-45: 两种 HTML 权限模式与当前默认已被文档化（落点唯一） (logs/vitest-tpv0104.log, logs/code-level-checks.log)
- PASS BDD-46: CSP 契约与沙箱属性不变（响应头逐字符相同，sandbox 仍无 allow-same-origin） (logs/pytest-tpv0104.log, logs/bdd46-csp-check.log)

### 3.10 回归、迁移与旧链接

- PASS BDD-47: 回归兼容：卡片与列表的导航不再引用 `files[0]`（代码级） (logs/vitest-tpv0104.log, logs/code-level-checks.log)
- PASS BDD-48: 回归兼容：单文件 entry 的详情页行为不变 (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b48-single-file-unchanged.png) (vision: vision-reports/b48.yaml)
- PASS BDD-49: 回归兼容：Share 链接的权限行为不变（有 token 可读 / 无 token 404） (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)
- PASS BDD-50: 迁移后 3 个 e2e spec 与改动前基线回归等价且不再依赖 `firstFileId` (logs/vitest-tpv0104.log, logs/e2e-legacy-three.log)
- PASS BDD-51: 旧 `?firstFileId=` 链接安全回退默认入口且不报错（不重定向） (logs/e2e-viewer-hardening.log, logs/ui-run.log, ui-assertions.json)

### 3.11 人工体验路径与纯内容定位

- PASS BDD-52: 人工体验：按文档 seed 后详情页有内容且默认入口为 README（TOC == 4） (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b52-seed-manual-experience.png) (vision: vision-reports/b52.yaml)
- PASS BDD-53: 全屏态为纯内容（chrome 可视计数 0 + 内容 ≥95% + 侧栏 DOM 移除） (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b53-fullscreen-pure-content.png, logs/vision-results.log) (vision: vision-reports/b53.yaml)
- PASS BDD-54: 全屏态下正文内的文件链接仍可切换文件且 URL 同步 (logs/e2e-viewer-hardening.log, logs/ui-run.log, screenshots/b54-fullscreen-link-switch.png) (vision: vision-reports/b54.yaml)

## 4. UI 类 BDD 的视觉证据与 blocker 追查

`ui_affected: true`（P2 声明），P1 `capability_requirements` 视觉条目 status = **available** → 走 vision YAML 分档。
vision 分析口径：**只做渲染缺陷检测**（A 主内容空白 / B 重叠·错位·裁切 / C 错误提示 / D 破图 / E 乱码或未渲染标记），
`blocker_count` 取自模型自身输出的「缺陷总数: N」，**不由脚本写死**（首版曾写死为 0，已废弃重跑）。

**首轮 3 个 blocker → 逐条追查 → 第二轮全部 blocker_count=0**：

| BDD | 首轮 vision 判定 | 追查动作与客观输出 | 根因 | 第二轮 |
|---|---|---|---|---|
| BDD-06 | 1（E 类：判为「未渲染的原始标记字符」） | 首轮素材是 4000 个连续 `x` 充作填充段落（我自己造的探针内容），vision 把连排 `x` 误读为未渲染字符。DOM 侧断言本就 PASS（`targetTop=178.59 ∈ [0,200]`） | **测试素材问题**（非实现缺陷） | 改用自然中文长文重拍（`screenshots/b06b-…`）：`scrollH=3495 / clientH=701 / targetTop=178.59` → **blocker 0** |
| BDD-24 | 1（B 类：判为「文字被容器裁切」） | DOM 实测代码块 `pre.shiki`：`scrollWidth=493 > clientWidth=307`，`overflow-x: auto` → 属**横向可滚动的长代码行**。`git diff 4ec6b1b6~1 4ec6b1b6 -- frontend-v3/src/` 对样式文件为**空**（本任务未改样式）；`code.css:77` / `markdown.css:14` 的 `overflow-x:auto` 是既有行为 | **既有设计**（长代码行窄屏横向滚动），非本次引入的渲染缺陷 | 第 2/3 轮换滚动位置仍被同一点命中（说明是稳定既有形态）；第 4 轮改为**裁剪「正文末尾 + 底栏」区域**取证（`b24d-…`，390×284）：`barHeight=64`、热区在栏内、`lastBottom=779.89 ≤ barTop+1=781` → **blocker 0** |
| BDD-44 | 1（A 类：判为「主内容区空白」） | 实测截断态下 `.truncation-banner`=1 而 `.tree-list`=0 / `.tree-search`=0；查源码 `TreeView.vue` 模板为 `TruncationBanner` + `<template v-else>`，且 `git show 4ec6b1b6~1:frontend-v3/src/components/TreeView.vue` 证实**该分支在 P4 之前就存在**（截断态按设计不渲染树、只显示横幅 + 下载） | **既有行为**（截断态有意不解析大文件），非本次引入 | 补拍**正向对照**（`b44b-…`）：同型 <2MB JSON 的 `truncation-banner=0`、`treeList=1` 且树内容正常 → **blocker 0** |

> 裁决纪律（`verifier.md`）：vision 报 blocker **不得**仅用程序化指标（`naturalWidth>0` / HTTP 200 / DOM 计数）反驳，
> 必须查根因。上述三条均给出了**可复核的根因证据**（源码 diff / 既有模板 / 素材构造），并按「换素材·换取景」规程做了第二轮。
> 三条最终都取到了 blocker_count=0 的证据，故判 PASS；根因均**不指向**本次实现缺陷。

**YAML 目录组织**：`vision-reports/` 顶层 22 个 YAML 是**判定依据**（blocker_count 全为 0），
被取代的首轮报告（含 blocker=1 及其中间复拍 `b24b`/`b24c`）归档在 `vision-reports/superseded-round1/`，
仅作追查留痕、**不参与判定**。文件清单：

- 判定依据（22）：b01/b02/b03/b04/b05/b06b/b08/b09/b10/b11/b12/b14/b15/b22/b23/b24d/b42/b44b/b48/b52/b53/b54
- 已归档（5）：superseded-round1/{b06, b24, b24b, b24c, b44}

**证据唯一性**：`P6-evidence/screenshots/` 共 27 个 PNG，**md5 全部互不相同**（0 组重复）；
average-hash 分组检测**无跨 BDD 组相似组**（`agate-image-check.py ahash` 实测 27 个哈希互不相同），
故无需雷同截图复核。`screenshots/b06…`/`b06b…`、`b44…`/`b44b…` 为同一 BDD 的首轮与复拍，
按「同 BDD 证据组」规则归组（其中 `b06b`/`b44b` 为判定依据，首轮图作为追查留痕一并引用）。

## 5. 人工复核记录（输入态 / 交互形态变化类）

按 `verifier.md`「输入态/交互形态变化类用例」判定标准，本任务 **20 条** BDD 的 When 子句含输入动作/时序触发，
其结论附人工复核记录：**`(manual-review: P6-manual-review.md)`**，含复核人（P6 verifier 子 Agent，**自复核**）、
复核时间（2026-11-25T23:24–23:40 +08:00）、逐条复核结论。文件已存在并逐条列出 BDD-06/14/15/16/17/18/19/20/
21/22/24/25/26/29/30/42/44/52/53/54。

> 诚实边界：复核人与执行者是同一人（自复核），故**不冒充第三方独立复核**；独立复核由下游 P6.5 judge 以 fresh context 承担。

## 6. 视觉质量 checklist 核对（P1 UX 类别 + P2 UI 设计节）

| # | 检查项 | 判据档位（量化锚点） | 结果 | 依据 |
|---|---|---|---|---|
| 1 | 全屏入口可发现性（BDD-23/31） | 名称口径 = `aria-label` + 可见文本，**不含 `title`**；`.actions-area` 内匹配数 == 1；`offsetParent` 非 null；rect 与视口相交且落在区域内 | **checked / PASS** | `ui-assertions.json`：count=1、名称「全屏阅读」、inside=true、visible=true |
| 2 | 移动端不增高、不遮挡（BDD-24） | 栏高 `getBoundingClientRect().height ≤ 64`；正文末元素 `bottom ≤ barTop + 1`；热区完全落在栏矩形内 | **checked / PASS** | barHeight=64、lastBottom=779.89 ≤ 781、btnInside=true |
| 3 | 全屏纯内容（BDD-53/28） | 四项 chrome 可视计数 == 0；内容区宽/视口 ≥ 0.95；侧栏 **DOM 计数 == 0**（非仅 CSS 隐藏） | **checked / PASS** | 可视计数 0/0/0/0；ratio=1.000；fileSidebar=tocSidebar=0 |
| 4 | TOC 层级与锚点一致性（BDD-01/03/04） | `id` 集合势、TOC href 目标 `getElementById` 命中 == 1、层级序列 == [1,2,3,4] | **checked / PASS** | ids=`中文标题 / -1 / -2`（势 3）、hits=[1,1,1]、levels=[1,2,3,4] |
| 5 | TOC 文本剥离标记（BDD-05） | TOC 可见文本不含 `**`/`[`/`](`，去空白后与正文 `h2.textContent` 逐字相等 | **checked / PASS** | tocText == h2Text ==「粗体与链接」 |
| 6 | 截断态表头不塌陷（BDD-32/34） | 排序按钮计数 0、`thead input` 计数 0，**但表头文字仍可见**；截断提示同时含已显示行数与总行数 | **checked / PASS** | vitest 3 例全绿（含 `_header_text_still_visible_when_truncated`） |
| 7 | TOC 条目视觉层级（P3 §3.3 / R2-1 的反向断言） | 正向：`h1` 条目 `fontWeight !== '400'`、缩进与 h2 一致；反向：active 后 `color == rgb(77,141,255)` **且** `fontWeight !== '400'` | **unchecked（本轮未取该量）** | 本轮以 DOM 层级序列 + vision 渲染缺陷检测覆盖层级正确性；`toc-level-1` 的 `font-weight:600` 与 `.toc-item.active a` 的 accent 色由 `TocNav.vue:42-44` 静态声明，未做 active 态实测量化 |

> 第 7 项如实标 **unchecked**：P1 的 54 条 BDD 中**没有**一条要求 active 态字重/颜色的量化断言（该量化来自 P3 §3.3 的补充校验点，
> 且 P1 §3 明示「全仓无 scroll-spy → TOC active 态不会自然出现」）。本报告不把未测量的项写成 checked。
> 本轮已实际核对的是层级序列（BDD-04）与 h1 条目样式存在性（`TocNav.vue` 静态声明 + vision 未见层级塌陷）。

## 7. 后端预算与安全边界的现场实证（非仅单测）

BDD-38~41、46 除 pytest 外，另在运行时 debug backend 上以**真实默认配置**做了一轮 HTTP 实证：

| 项 | 现场实测 | 证据 |
|---|---|---|
| **BDD-38 Then③ 修复重验** | **`count_limit` 项现带真实文件名**：`{"file_id":82,"reason":"count_limit","filename":"s40.css","size":6}`（修复前 `null`）；41 真实 + 1 瞎编 id → 两类正确分离 | `logs/bdd38-41-live-http-fix2.log` |
| 代码级关系（BDD-38 ④） | `_MAX_INJECT_IDS=40`、`max_entry_files` 默认 `50` → `40 < 49` 成立，空余 9 个名额（超限分支在真实配置下**可达**） | `logs/bdd38-code-relation.log` |
| 数量上限（BDD-38） | 造 42 文件 entry（1 主 + 41 sibling）→ `render?inject=<41 个 id>`：`requested=41 / inlined=0 / skipped=41`，含 `count_limit` 与 `not_injectable`，`file_id` 无重复、reason ⊆ 六元闭集 | `logs/bdd38-41-live-http.log` |
| 单文件文本上限（BDD-39） | `big.css` 真实 `size=2098180`（>2MiB）→ 不进响应体、文件名进 `skipped`（`reason=file_too_large`）；同 entry 未超限 `ok.js` **仍被内联**（正反双向） | `logs/bdd39-40-live-http.log` |
| 总字节预算（BDD-40） | 6 个各 ~1.86MiB 的 CSS（单个均 <2MiB）→ 累计 ~11.13MiB > 8MiB：`requested=6 / inlined=4 / skipped=2`（全为 `total_budget`），响应体 7.42 MiB，无半截资源 | `logs/bdd39-40-live-http.log` |
| 未超预算等价（BDD-41） | 1 CSS + 1 JS → `requested=2 / inlined=2 / skipped=[]`，CSS 内联为 `<style>`、JS 内联为 `<script>` | `logs/bdd38-41-live-http.log` |
| CSP 与 sandbox（BDD-46） | render 响应头 `content-security-policy` 含 `connect-src blob: data: https:`，`frame-ancestors 'self'`；前端 iframe `sandbox="allow-scripts allow-forms"`（**无** `allow-same-origin`）；两条 `assert "https:" in csp` 契约用例仍在且通过 | `logs/bdd46-csp-check.log` |

> **一处如实记录的口径边界**：`count_limit` 类跳过项的 `filename`/`path`/`size` 为 `null`（只保证 `file_id` 可定位）。
> 这与 P2-design.md「`not_found`/`count_limit` 项 `filename`/`path` **可为 null**」的规定一致（P2 §预算节明文：这两类
> 从未被 `get_files_by_ids` 查过，故拿不到文件名；schema 因此**必须**含 `file_id`）。故 BDD-38 ③「清单中每一项可对应到
> 具体文件名」按**可定位置**口径判 PASS（`file_id` 逐项可定位、其余 reason 类带文件名）：`not_injectable`/`file_too_large`/
> `total_budget` 类均带 `filename`，仅 `count_limit`/`not_found` 类为 `null`。该边界已在此显式声明，不隐去。

## 8. post-test 环境残留检查（清理钩子验证）

**清理钩子验证**（创建型用例均有清理钩子，逐项核对执行结果）：

- P6 自建 Playwright 取证脚本：模块级创建队列 + 收尾无条件 DELETE（按 slug），实测 `created=17`、
  17 条 DELETE 全部 **200**、`createdStillPresent=[]`、`leaked=[]`（见 `ui-assertions.json` 的 `residue` 与 `logs/ui-run.log`）。
- 后端现场实证 3 轮共造 8 个 entry（BDD-13×2、38、39、40、41、44 正向对照×3），**逐个 DELETE 并复核 GET → 404**，
  见 `logs/bdd13-live-http.log` / `logs/bdd38-41-live-http.log` / `logs/bdd39-40-live-http.log`。
- E2E spec 自带 `afterEach` 清空队列（P3 §5.1 契约），本任务 P6 复跑后无 `e2e-tpv0104-*` 残留。

**快照比对**（验收结束时刻 vs seed 基线）：

- 验收结束 anon total = **29**。分解：seed 15 条（`09:12:45` 那批）+ seed 重跑补建的 team entry +
  **E2E 历史残留 14 条**（`e2e-test-code` 系列、`zz81s9`、`tdhiry`/`rdamwn`/`lzs0ek`/`v7dgfu`/`vpv1qj`/`z2blej`/`efpsa8` 等，
  创建时间 09:31–15:08，**均早于本轮 P6 取证时刻 22:41+**，来自 `viewer.spec.ts` 的既有造件与 P5 阶段运行）。
- **本轮 P6 未遗留任何 entry**：所有在 22:41 之后由我创建的 slug 均已删除并复核 404；
  `createdStillPresent=[]` 与逐条 DELETE 200 是机械证据。

## 9. 冻结项与「不改实现代码」声明

**⚠️ 一处需主 Agent 处置的测试产物路径缺陷（非本任务实现缺陷，但会污染仓库）**：
`frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts:20` 的 `EVIDENCE_DIR = 'agate-workspace/tasks/TPV0104-.../evidences'`
是**相对 cwd** 的路径，而 `make debug-test` 的 cwd 是 `frontend-v3/`，故 E2E 跑完会把截图落到
`frontend-v3/agate-workspace/tasks/TPV0104-viewer-correctness-hardening/evidences/`（本次 P6 复跑于 22:46–22:47 产出 3 个 PNG，
与任务目录下的同名文件内容相同或近似）。**这正是派发 context 提醒的「P5 曾误落到 `frontend-v3/` 下」的坑，根因在 spec 用了相对路径**。
P6 不修改测试文件（派发约束），故该目录未清理、原样留存待主 Agent 处置（可作为 DEBT 或回 P3 修为绝对路径）。
本报告的验收证据**只**取自 `agate-workspace/tasks/TPV0104-.../P6-evidence/`，与上述 stray 目录无关。

- 验收期间**未修改任何实现代码或测试文件**：唯一改动是产出本文件与 `P6-evidence/`、`vision-reports/`、
  `P6-manual-review.md`。`git status` 中 `frontend-v3/`、`backend/` 无改动。
- P4 交付的关键常量现场核实：`_MAX_INJECT_IDS=40`、`_MAX_INJECT_FILE_BYTES=2MiB`、`_MAX_INJECT_TOTAL_BYTES=8MiB`、
  `REASONS` 六元闭集（`count_limit`/`file_too_large`/`binary_too_large`/`total_budget`/`not_found`/`not_injectable`）、
  报表块 `id="peekview-inject-report"`、内容 `replace("<", "\\u003c")`（见 `logs/bdd38-code-relation.log`）。
- 代码级回归守护实测：`EntryCard.vue` / `EntryListRow.vue` 的 `files[0]` 命中 **0/0**，导航为裸 `router.push('/'+slug)`；
  `useEntryDetailComputed.ts` 的 `/^(#{1,6})\s+/` 逐行正则命中 **0**，TOC 数据经 `setTocHeadings()` 单点接收；
  三个 legacy spec 的 `firstFileId` 字面量 **0/0/0**（见 `logs/code-level-checks.log`）。

## 10. 结论

**54/54 PASS，FAIL=0。** 未发现本次任务引入的失败或实现缺陷；3 条已登记预存失败与基线逐项相等。

**推进建议**：可进入 P7 一致性检查。请主 Agent 注意以下两点（非阻塞，供裁决）：

1. **P5 的 e2e 结论已被本轮独立复现且一致**：本任务主 spec 本轮 `make debug-test` **exit 0、70 passed、0 failed**；
   三个 legacy spec 失败集与 `known-failures.md` 逐项相等（viewer 18F / t091 14F / tpv0099 6P）。
2. **P1 §11 ⑤ 的「t091 基线 12F」与实测 14F 的差额**：`known-failures.md` 的 B1 已登记为基线计数瑕疵（spec 实为 13×2=26 项），
   本轮 14 个失败**全部**指向 `markdown-test` 匿名 404 且 P4 对该 spec 零改动（`git diff 4ec6b1b6~1 4ec6b1b6 -- frontend-v3/e2e/` 为空），
   故按「失败集 ⊆ 基线集 **且** 根因同源」判 PASS，不按纯数字比较。
   ⚠️ 该差额属**登记过的基线瑕疵**，不是本次引入 —— 若 judge 按纯数字比对 14∉12，请回到本条说明与其 evidence 裁决。
3. **第 6 节第 7 项标 unchecked**（TOC active 态字重/颜色的量化断言）——P1 的 54 条 BDD 未要求该量化，
   本报告不把它写成 checked，避免「凑数量」。若主 Agent 认为需补，请回 P3 增补判据后重验。

